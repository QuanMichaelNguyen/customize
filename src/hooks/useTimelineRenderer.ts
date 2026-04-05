/*
This hook owns the Canvas-based timeline — it drives a 60fps render loop
that draws the timeline track/playing video, video/audio, clip/overlays,
waveform caching, normally without triggering React re-renders.
*/
import { useEffect } from 'react'
import { usePlaybackStore } from '../stores/playbackStore'
import { useClipsStore } from '../stores/clipsStore'
import { useOverlaysStore } from '../stores/overlaysStore'
import { useAudioStore } from '../stores/audioStore'
import { timeToPixel } from '../utils/timelineGeometry'
import { getRowBands, VIDEO_ROW_HEIGHT, AUDIO_ROW_HEIGHT, LABEL_WIDTH } from '../utils/laneGeometry'
import { buildWaveformCache } from '../utils/waveformRenderer'
import type { WaveformData } from '../types/editor'

export function useTimelineRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  isDraggingRef: React.MutableRefObject<boolean>,
  scrubTimeRef: React.MutableRefObject<number>,
  inPointDragRef: React.MutableRefObject<{ clipId: string; time: number } | null>,
  outPointDragRef: React.MutableRefObject<{ clipId: string; time: number } | null>,
  waveformDataRef: React.MutableRefObject<WaveformData | null>,
) {
  useEffect(() => {
    const canvasOrNull = canvasRef.current
    if (!canvasOrNull) return
    // Reassign after null guard so closures capture HTMLCanvasElement (not | null)
    const canvas = canvasOrNull

    const ctxOrNull = canvas.getContext('2d')
    if (!ctxOrNull) return
    // Reassign after null guard so closures capture CanvasRenderingContext2D (not | null)
    const ctx = ctxOrNull

    let rafHandle = 0
    const cancelledRef = { current: false }

    // Waveform offscreen cache — rebuilt only when canvas dimensions change
    let waveformCache: HTMLCanvasElement | null = null
    let lastCacheWidth = 0
    let lastCacheHeight = 0

    // DPR scaling via ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1]
      if (!entry) return
      const { width, height } = entry.contentRect
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    })

    resizeObserver.observe(canvas)

    function drawFrame() {
      if (cancelledRef.current) return

      const { duration } = usePlaybackStore.getState()
      const clips = useClipsStore.getState().clips
      const { extractionStatus, hasAudio, waveformData } = useAudioStore.getState()
      const cssWidth = canvas.clientWidth
      const cssHeight = canvas.clientHeight

      const currentTime = isDraggingRef.current
        ? scrubTimeRef.current
        : (videoRef.current?.currentTime ?? usePlaybackStore.getState().currentTime)

      const safeDuration = Math.max(duration, 0.001)
      const playheadX = timeToPixel(currentTime, safeDuration, cssWidth, LABEL_WIDTH)

      const { videoY, audioY } = getRowBands(cssHeight)

      // Clear
      ctx.clearRect(0, 0, cssWidth, cssHeight)

      // ── Video track row ───────────────────────────────────────────────────────
      const trackH = 8
      const videoTrackY = videoY + VIDEO_ROW_HEIGHT / 2

      // Track background bar
      ctx.fillStyle = '#374151' // gray-700
      ctx.fillRect(LABEL_WIDTH, videoTrackY - trackH / 2, cssWidth - LABEL_WIDTH, trackH)

      // Kept regions (between in/out points per clip)
      if (duration > 0) {
        for (const clip of clips) {
          const inX = inPointDragRef.current?.clipId === clip.id
            ? timeToPixel(inPointDragRef.current.time, duration, cssWidth, LABEL_WIDTH)
            : timeToPixel(clip.startTime, duration, cssWidth, LABEL_WIDTH)
          const outX = outPointDragRef.current?.clipId === clip.id
            ? timeToPixel(outPointDragRef.current.time, duration, cssWidth, LABEL_WIDTH)
            : timeToPixel(clip.endTime, duration, cssWidth, LABEL_WIDTH)
          ctx.fillStyle = 'rgba(16, 185, 129, 0.25)' // emerald-500 at 25%
          ctx.fillRect(inX, videoTrackY - trackH / 2, outX - inX, trackH)
        }
      }

      // Played portion
      if (playheadX > LABEL_WIDTH) {
        ctx.fillStyle = '#6366f1' // indigo-500
        ctx.fillRect(LABEL_WIDTH, videoTrackY - trackH / 2, playheadX - LABEL_WIDTH, trackH)
      }

      // Trim handles (in-point and out-point per clip)
      if (duration > 0) {
        for (const clip of clips) {
          const inX = inPointDragRef.current?.clipId === clip.id
            ? timeToPixel(inPointDragRef.current.time, duration, cssWidth, LABEL_WIDTH)
            : timeToPixel(clip.startTime, duration, cssWidth, LABEL_WIDTH)
          const outX = outPointDragRef.current?.clipId === clip.id
            ? timeToPixel(outPointDragRef.current.time, duration, cssWidth, LABEL_WIDTH)
            : timeToPixel(clip.endTime, duration, cssWidth, LABEL_WIDTH)

          ctx.strokeStyle = '#10b981' // emerald-500
          ctx.lineWidth = 2

          // In-point handle (confined to video row)
          ctx.beginPath()
          ctx.moveTo(inX, videoY)
          ctx.lineTo(inX, videoY + VIDEO_ROW_HEIGHT)
          ctx.stroke()
          ctx.fillStyle = '#10b981'
          ctx.fillRect(inX - 4, videoY, 8, 8)

          // Out-point handle (confined to video row)
          ctx.beginPath()
          ctx.moveTo(outX, videoY)
          ctx.lineTo(outX, videoY + VIDEO_ROW_HEIGHT)
          ctx.stroke()
          ctx.fillRect(outX - 4, videoY, 8, 8)
        }
      }

      // Overlay time range row — thin amber bars at the bottom of the video row
      const overlays = useOverlaysStore.getState().overlays
      if (duration > 0 && overlays.length > 0) {
        const overlayRowH = 10
        const overlayRowY = videoY + VIDEO_ROW_HEIGHT - overlayRowH - 2
        ctx.fillStyle = '#f59e0b' // amber-500
        for (const overlay of overlays) {
          const barX = timeToPixel(overlay.startTime, duration, cssWidth, LABEL_WIDTH)
          const barEnd = timeToPixel(overlay.endTime, duration, cssWidth, LABEL_WIDTH)
          const barW = barEnd - barX
          if (barW > 0) {
            ctx.fillRect(barX, overlayRowY, barW, overlayRowH)
          }
        }
      }

      // ── Audio track row ───────────────────────────────────────────────────────
      if (extractionStatus === 'loading') {
        // Placeholder: low-opacity gray fill
        ctx.fillStyle = 'rgba(75, 85, 99, 0.4)' // gray-600 at 40%
        ctx.fillRect(LABEL_WIDTH, audioY, cssWidth - LABEL_WIDTH, AUDIO_ROW_HEIGHT)
      } else if (!hasAudio || extractionStatus === 'error') {
        // Gray fill + "No audio" text
        ctx.fillStyle = 'rgba(55, 65, 81, 0.5)' // gray-700 at 50%
        ctx.fillRect(LABEL_WIDTH, audioY, cssWidth - LABEL_WIDTH, AUDIO_ROW_HEIGHT)
        ctx.fillStyle = '#6b7280' // gray-500
        ctx.font = '11px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('No audio', LABEL_WIDTH + (cssWidth - LABEL_WIDTH) / 2, audioY + AUDIO_ROW_HEIGHT / 2)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      } else if (extractionStatus === 'ready') {
        // Draw waveform via offscreen cache
        const wdata = waveformDataRef.current ?? waveformData
        const trackWidth = cssWidth - LABEL_WIDTH
        if (wdata && trackWidth > 0) {
          if (
            waveformCache === null ||
            trackWidth !== lastCacheWidth ||
            AUDIO_ROW_HEIGHT !== lastCacheHeight
          ) {
            waveformCache = buildWaveformCache(
              wdata,
              trackWidth,
              AUDIO_ROW_HEIGHT,
              window.devicePixelRatio || 1,
            )
            lastCacheWidth = trackWidth
            lastCacheHeight = AUDIO_ROW_HEIGHT
          }
          ctx.drawImage(waveformCache, LABEL_WIDTH, audioY, trackWidth, AUDIO_ROW_HEIGHT)
        }
      }

      // ── Playhead — spans both rows ────────────────────────────────────────────
      ctx.strokeStyle = '#f9fafb' // gray-50
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(playheadX, 0)
      ctx.lineTo(playheadX, cssHeight)
      ctx.stroke()

      rafHandle = requestAnimationFrame(drawFrame)
    }

    rafHandle = requestAnimationFrame(drawFrame)

    return () => {
      cancelledRef.current = true
      cancelAnimationFrame(rafHandle)
      resizeObserver.disconnect()
    }
  }, [canvasRef, videoRef, isDraggingRef, scrubTimeRef, inPointDragRef, outPointDragRef, waveformDataRef])
}
