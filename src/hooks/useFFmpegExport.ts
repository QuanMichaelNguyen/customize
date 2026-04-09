/*
Hook that manages the ffmpeg.wasm lifecycle and orchestrates the export pipeline.

The FFmpeg instance is held in a ref (not Zustand) — it is mutable and not serializable.
The WASM core (~25 MB) is fetched from CDN lazily on first Export click.

Cancellation uses ffmpeg.terminate(), which kills the WASM worker immediately.
This triggers a fresh CDN fetch (~25 MB) on the next export — a known UX tradeoff.
*/
import { useRef, useEffect, useCallback } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

import { useExportStore } from '../stores/exportStore'
import { useClipsStore } from '../stores/clipsStore'
import { useCropStore } from '../stores/cropStore'
import { useOverlaysStore } from '../stores/overlaysStore'
import { useTracksStore } from '../stores/tracksStore'
import { usePlaybackStore } from '../stores/playbackStore'
import { validateExportInputs, buildFilterComplex } from '../utils/exportPipeline'

// Single-threaded core — no COOP/COEP required at runtime.
// Switch to @ffmpeg/core-mt for multi-threaded (faster) encoding.
const FFMPEG_CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm'
const FONT_PUBLIC_PATH = '/fonts/Roboto-Regular.ttf'
const FONT_MEMFS_NAME = 'Roboto-Regular.ttf'

export function useFFmpegExport() {
  const ffmpegRef = useRef<FFmpeg | null>(null)
  const loadedRef = useRef(false)
  const progressHandlerRef = useRef<((e: { progress: number }) => void) | null>(null)

  // Clean up on hook unmount
  useEffect(() => {
    return () => {
      if (progressHandlerRef.current && ffmpegRef.current) {
        ffmpegRef.current.off('progress', progressHandlerRef.current)
      }
      // Do not terminate on unmount — let the export finish if ongoing.
      // Cancel is explicit via cancelExport().
    }
  }, [])

  const startExport = useCallback(async (file: File | null) => {
    // Re-entrancy guard — only one export at a time
    if (useExportStore.getState().status === 'loading') return

    // --- Snapshot all store state synchronously before any await ---
    // VideoPlayer.handleFileChange can reset stores if user loads a new file mid-export.
    // Local variables protect the in-flight export against that race.
    const clips = useClipsStore.getState().clips
    const cropRegion = useCropStore.getState().cropRegion
    const videoWidth = usePlaybackStore.getState().videoWidth
    const videoHeight = usePlaybackStore.getState().videoHeight
    const overlays = useOverlaysStore.getState().overlays
    const tracks = useTracksStore.getState().tracks
    const playbackRate = usePlaybackStore.getState().playbackRate
    const audioTrack = tracks.find((t) => t.id === 'audio-0') ?? null
    const hasAudio = audioTrack !== null

    // Validate before touching ffmpeg
    const validationError = validateExportInputs(file, clips)
    if (validationError) {
      useExportStore.getState().setError(validationError)
      return
    }

    useExportStore.getState().startExport()

    try {
      // --- Lazy-initialize FFmpeg ---
      if (!loadedRef.current || ffmpegRef.current === null) {
        ffmpegRef.current = new FFmpeg()

        // Wire up progress listener
        const handler = ({ progress }: { progress: number }) => {
          useExportStore.getState().setProgress(progress)
        }
        progressHandlerRef.current = handler
        ffmpegRef.current.on('progress', handler)

        try {
          await ffmpegRef.current.load({
            coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
          })
        } catch (loadErr) {
          loadedRef.current = false
          ffmpegRef.current = null
          throw new Error(
            `Failed to load ffmpeg. Check your internet connection and try again. (${loadErr instanceof Error ? loadErr.message : String(loadErr)})`,
          )
        }

        // Load font into MEMFS for drawtext filter
        try {
          const fontData = await fetchFile(FONT_PUBLIC_PATH)
          await ffmpegRef.current.writeFile(FONT_MEMFS_NAME, fontData)
        } catch {
          throw new Error('Failed to load font for text overlays. Export aborted.')
        }

        loadedRef.current = true
      }

      const ffmpeg = ffmpegRef.current

      // Write source video to MEMFS with a fixed name (avoids parsing issues with
      // filenames containing spaces, unicode, or special characters)
      await ffmpeg.writeFile('input.mp4', await fetchFile(file!))

      // Build the filter_complex (or fast-path) args
      const { filterComplex, mapArgs, codecArgs, fastPathTrim } = buildFilterComplex(
        clips,
        cropRegion,
        videoWidth,
        videoHeight,
        overlays,
        audioTrack,
        hasAudio,
        playbackRate,
      )

      let execArgs: string[]

      if (filterComplex === null && fastPathTrim !== null) {
        // Fast path: single -c copy trim, no re-encode
        execArgs = [
          '-ss', String(fastPathTrim[0]),
          '-to', String(fastPathTrim[1]),
          '-i', 'input.mp4',
          ...codecArgs,
          'output.mp4',
        ]
      } else {
        execArgs = [
          '-i', 'input.mp4',
          '-filter_complex', filterComplex!,
          ...mapArgs,
          ...codecArgs,
          'output.mp4',
        ]
      }

      await ffmpeg.exec(execArgs)

      // Read result and deliver as blob URL
      const data = await ffmpeg.readFile('output.mp4') as Uint8Array
      const blob = new Blob([data.buffer], { type: 'video/mp4' })
      const outputUrl = URL.createObjectURL(blob)

      useExportStore.getState().setReady(outputUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed. Please try again.'
      useExportStore.getState().setError(msg)
    } finally {
      // Clean up MEMFS files — wrapped in its own try/catch so a missing-file
      // error does not shadow the original export error
      if (ffmpegRef.current && loadedRef.current) {
        for (const name of ['input.mp4', 'output.mp4']) {
          try {
            await ffmpegRef.current.deleteFile(name)
          } catch {
            // File may not exist if the error occurred before/during write — ignore
          }
        }
      }
    }
  }, [])

  const cancelExport = useCallback(() => {
    if (progressHandlerRef.current && ffmpegRef.current) {
      ffmpegRef.current.off('progress', progressHandlerRef.current)
      progressHandlerRef.current = null
    }
    if (ffmpegRef.current) {
      ffmpegRef.current.terminate()
      ffmpegRef.current = null
    }
    loadedRef.current = false
    useExportStore.getState().resetExport()
  }, [])

  return { startExport, cancelExport }
}
