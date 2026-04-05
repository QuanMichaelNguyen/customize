import { useEffect } from 'react'
import { usePlaybackStore } from '../stores/playbackStore'
import { useClipsStore } from '../stores/clipsStore'
import { timeToPixel } from '../utils/timelineGeometry'

/*
This hook owns the Canvas-based timeline — it drives a 60fps render loop that draws the timeline
track/ playing video normally without triggering React re-renders
*/

export function useTimelineRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  videoRef: React.RefObject<HTMLVideoElement>,
  isDraggingRef: React.MutableRefObject<boolean>,
  scrubTimeRef: React.MutableRefObject<number>,
  inPointDragRef: React.MutableRefObject<{ clipId: string; time: number } | null>,
  outPointDragRef: React.MutableRefObject<{ clipId: string; time: number } | null>,
) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafHandle = 0
    const cancelledRef = { current: false }

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
      const cssWidth = canvas.clientWidth
      const cssHeight = canvas.clientHeight

      const currentTime = isDraggingRef.current
        ? scrubTimeRef.current
        : (videoRef.current?.currentTime ?? usePlaybackStore.getState().currentTime)

      const safeDuration = Math.max(duration, 0.001)
      const playheadX = (currentTime / safeDuration) * cssWidth

      // Clear
      ctx.clearRect(0, 0, cssWidth, cssHeight)

      // Timeline track background
      const trackY = cssHeight / 2
      const trackH = 8
      ctx.fillStyle = '#374151' // gray-700
      ctx.fillRect(0, trackY - trackH / 2, cssWidth, trackH)

      // Kept regions (between in/out points per clip) — drawn before progress fill
      if (duration > 0) {
        for (const clip of clips) {
          const inX = inPointDragRef.current?.clipId === clip.id
            ? timeToPixel(inPointDragRef.current.time, duration, cssWidth)
            : timeToPixel(clip.startTime, duration, cssWidth)
          const outX = outPointDragRef.current?.clipId === clip.id
            ? timeToPixel(outPointDragRef.current.time, duration, cssWidth)
            : timeToPixel(clip.endTime, duration, cssWidth)
          ctx.fillStyle = 'rgba(16, 185, 129, 0.25)' // emerald-500 at 25%
          ctx.fillRect(inX, trackY - trackH / 2, outX - inX, trackH)
        }
      }

      // Played portion
      if (playheadX > 0) {
        ctx.fillStyle = '#6366f1' // indigo-500
        ctx.fillRect(0, trackY - trackH / 2, playheadX, trackH)
      }

      // Playhead vertical line
      ctx.strokeStyle = '#f9fafb' // gray-50
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(playheadX, 0)
      ctx.lineTo(playheadX, cssHeight)
      ctx.stroke()

      // Trim handles (in-point and out-point per clip)
      if (duration > 0) {
        for (const clip of clips) {
          const inX = inPointDragRef.current?.clipId === clip.id
            ? timeToPixel(inPointDragRef.current.time, duration, cssWidth)
            : timeToPixel(clip.startTime, duration, cssWidth)
          const outX = outPointDragRef.current?.clipId === clip.id
            ? timeToPixel(outPointDragRef.current.time, duration, cssWidth)
            : timeToPixel(clip.endTime, duration, cssWidth)

          ctx.strokeStyle = '#10b981' // emerald-500
          ctx.lineWidth = 2

          // In-point handle
          ctx.beginPath()
          ctx.moveTo(inX, 0)
          ctx.lineTo(inX, cssHeight)
          ctx.stroke()
          // Grip indicator at top
          ctx.fillStyle = '#10b981'
          ctx.fillRect(inX - 4, 0, 8, 8)

          // Out-point handle
          ctx.beginPath()
          ctx.moveTo(outX, 0)
          ctx.lineTo(outX, cssHeight)
          ctx.stroke()
          ctx.fillRect(outX - 4, 0, 8, 8)
        }
      }

      rafHandle = requestAnimationFrame(drawFrame)
    }

    rafHandle = requestAnimationFrame(drawFrame)

    return () => {
      cancelledRef.current = true
      cancelAnimationFrame(rafHandle)
      resizeObserver.disconnect()
    }
  }, [canvasRef, videoRef, isDraggingRef, scrubTimeRef, inPointDragRef, outPointDragRef])
}
