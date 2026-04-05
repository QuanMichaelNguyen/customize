import { useEffect } from 'react'
import { usePlaybackStore } from '../stores/playbackStore'

/* 
This hook owns the Canvas-based timeline — it drives a 60fps render loop that draws the timeline 
track/ playing video normally without triggering React re-renders
*/

export function useTimelineRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  videoRef: React.RefObject<HTMLVideoElement>,
  isDraggingRef: React.MutableRefObject<boolean>,
  scrubTimeRef: React.MutableRefObject<number>,
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
      const trackHeight = 8
      ctx.fillStyle = '#374151' // gray-700
      ctx.fillRect(0, trackY - trackHeight / 2, cssWidth, trackHeight)

      // Played portion
      if (playheadX > 0) {
        ctx.fillStyle = '#6366f1' // indigo-500
        ctx.fillRect(0, trackY - trackHeight / 2, playheadX, trackHeight)
      }

      // Playhead vertical line
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
  }, [canvasRef, videoRef, isDraggingRef, scrubTimeRef])
}
