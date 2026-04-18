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
import robotoFontUrl from '../assets/Roboto-Regular.ttf'

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
const FONT_MEMFS_NAME = 'Roboto-Regular.ttf'

export function useFFmpegExport() {
  const ffmpegRef = useRef<FFmpeg | null>(null)
  const loadedRef = useRef(false)
  const progressHandlerRef = useRef<((e: { progress: number }) => void) | null>(null)
  const logHandlerRef = useRef<((e: { message: string }) => void) | null>(null)
  const logBufferRef = useRef<string[]>([])

  // Clean up on hook unmount
  useEffect(() => {
    return () => {
      if (progressHandlerRef.current && ffmpegRef.current) {
        ffmpegRef.current.off('progress', progressHandlerRef.current)
      }
      if (logHandlerRef.current && ffmpegRef.current) {
        ffmpegRef.current.off('log', logHandlerRef.current)
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

        // Wire up log listener to capture ffmpeg stderr for error diagnostics
        const logHandler = ({ message }: { message: string }) => {
          logBufferRef.current.push(message)
          // Keep only the last 50 lines to avoid unbounded growth
          if (logBufferRef.current.length > 50) logBufferRef.current.shift()
        }
        logHandlerRef.current = logHandler
        ffmpegRef.current.on('log', logHandler)

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

        // Load font into MEMFS for drawtext filter.
        // Fetch via the Vite-processed asset URL (bundled, hashed) so we always
        // get the real binary — never a 404 HTML page.
        try {
          const fontResp = await fetch(robotoFontUrl)
          if (!fontResp.ok) throw new Error(`HTTP ${fontResp.status}`)
          const fontBytes = new Uint8Array(await fontResp.arrayBuffer())
          // Validate TTF magic bytes (0x00010000 or 'true' or 'OTTO')
          const magic = (fontBytes[0] << 24) | (fontBytes[1] << 16) | (fontBytes[2] << 8) | fontBytes[3]
          if (magic !== 0x00010000 && magic !== 0x74727565 && magic !== 0x4F54544F) {
            throw new Error('font file is not a valid TTF/OTF')
          }
          await ffmpegRef.current.writeFile(FONT_MEMFS_NAME, fontBytes)
        } catch (fontErr) {
          loadedRef.current = false
          ffmpegRef.current = null
          throw new Error(
            `Failed to load font for text overlays. ${fontErr instanceof Error ? fontErr.message : String(fontErr)}`
          )
        }

        loadedRef.current = true
      }

      const ffmpeg = ffmpegRef.current

      // Write source video to MEMFS with a fixed name (avoids parsing issues with
      // filenames containing spaces, unicode, or special characters)
      await ffmpeg.writeFile('input.mp4', await fetchFile(file!))

      // Build the filter_complex (or fast-path) args.
      // clips already hold real video timestamps (clipsStore is never rebased by applyTrim).
      // overlays are stored in display-space (0-based from trim start), which equals
      // output-relative time after trim+setpts resets PTS to 0 — no adjustment needed.
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

      // Reset log buffer before each exec so error messages are from this run
      logBufferRef.current = []

      const exitCode = await ffmpeg.exec(execArgs)
      if (exitCode !== 0) {
        // Include the last few log lines so the error is diagnosable
        const lastLogs = logBufferRef.current.slice(-10).join('\n')
        throw new Error(
          `FFmpeg exited with code ${exitCode}.${lastLogs ? `\n\nDetails:\n${lastLogs}` : ''}`
        )
      }

      // Read result and deliver as blob URL
      const data = await ffmpeg.readFile('output.mp4')
      if (typeof data === 'string') throw new Error('Export failed: could not read output video data.')
      const blob = new Blob([data.buffer], { type: 'video/mp4' })
      const outputUrl = URL.createObjectURL(blob)

      useExportStore.getState().setReady(outputUrl)
    } catch (err) {
      const msg =
        err instanceof Error ? err.message
        : typeof err === 'string' ? err
        : 'Export failed. Please try again.'
      useExportStore.getState().setError(msg)
      // Reset the ffmpeg instance so "Try again" re-initializes from scratch.
      // This ensures a failed export (bad font, crashed exec, etc.) never leaves
      // stale MEMFS data that poisons the next attempt.
      if (ffmpegRef.current) {
        ffmpegRef.current.terminate()
        ffmpegRef.current = null
      }
      loadedRef.current = false
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
