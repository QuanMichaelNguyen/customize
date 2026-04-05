import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTimelineRenderer } from '../useTimelineRenderer'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useClipsStore } from '../../stores/clipsStore'

// Mock requestAnimationFrame / cancelAnimationFrame
let rafCallbacks: FrameRequestCallback[] = []
let rafHandleCounter = 0

beforeEach(() => {
  usePlaybackStore.getState().reset()
  useClipsStore.getState().reset()
  rafCallbacks = []
  rafHandleCounter = 0

  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    rafCallbacks.push(cb)
    return ++rafHandleCounter
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})

  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

function makeCanvasRef(width = 800, height = 80) {
  const canvas = document.createElement('canvas')
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: width })
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: height })
  const ctx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
  }
  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
  const ref = { current: canvas } as React.RefObject<HTMLCanvasElement>
  return { ref, ctx }
}

function makeVideoRef(currentTime = 0) {
  const video = document.createElement('video')
  Object.defineProperty(video, 'currentTime', { configurable: true, value: currentTime })
  const ref = { current: video } as React.RefObject<HTMLVideoElement>
  return ref
}

function renderRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  videoRef: React.RefObject<HTMLVideoElement>,
  opts: {
    isDraggingRef?: React.MutableRefObject<boolean>
    scrubTimeRef?: React.MutableRefObject<number>
    inPointDragRef?: React.MutableRefObject<{ clipId: string; time: number } | null>
    outPointDragRef?: React.MutableRefObject<{ clipId: string; time: number } | null>
  } = {},
) {
  const isDraggingRef = opts.isDraggingRef ?? ({ current: false } as React.MutableRefObject<boolean>)
  const scrubTimeRef = opts.scrubTimeRef ?? ({ current: 0 } as React.MutableRefObject<number>)
  const inPointDragRef = opts.inPointDragRef ?? ({ current: null } as React.MutableRefObject<{ clipId: string; time: number } | null>)
  const outPointDragRef = opts.outPointDragRef ?? ({ current: null } as React.MutableRefObject<{ clipId: string; time: number } | null>)
  return renderHook(() =>
    useTimelineRenderer(canvasRef, videoRef, isDraggingRef, scrubTimeRef, inPointDragRef, outPointDragRef)
  )
}

describe('useTimelineRenderer', () => {
  it('starts RAF loop on mount', () => {
    const { ref: canvasRef } = makeCanvasRef()
    const videoRef = makeVideoRef()
    renderRenderer(canvasRef, videoRef)
    expect(window.requestAnimationFrame).toHaveBeenCalled()
  })

  it('calls cancelAnimationFrame on unmount', () => {
    const { ref: canvasRef } = makeCanvasRef()
    const videoRef = makeVideoRef()
    const { unmount } = renderRenderer(canvasRef, videoRef)
    unmount()
    expect(window.cancelAnimationFrame).toHaveBeenCalled()
  })

  it('does not reschedule RAF after unmount (cancelledRef guard)', () => {
    const { ref: canvasRef } = makeCanvasRef()
    const videoRef = makeVideoRef()
    const { unmount } = renderRenderer(canvasRef, videoRef)
    unmount()

    const callCountAfterUnmount = (window.requestAnimationFrame as ReturnType<typeof vi.fn>).mock.calls.length

    // Run all pending RAF callbacks — cancelledRef guard should prevent re-scheduling
    const callbacks = [...rafCallbacks]
    rafCallbacks = []
    callbacks.forEach((cb) => cb(0))

    const callCountAfterFlush = (window.requestAnimationFrame as ReturnType<typeof vi.fn>).mock.calls.length
    expect(callCountAfterFlush).toBe(callCountAfterUnmount)
  })

  it('draws at position 0 when duration is 0 (no division by zero)', () => {
    const { ref: canvasRef } = makeCanvasRef()
    const videoRef = makeVideoRef(0)
    renderRenderer(canvasRef, videoRef)
    expect(() => rafCallbacks[0](0)).not.toThrow()
  })

  it('reads scrubTimeRef when isDragging is true', () => {
    const { ref: canvasRef, ctx } = makeCanvasRef(800, 80)
    const videoRef = makeVideoRef(0)
    const isDraggingRef = { current: true } as React.MutableRefObject<boolean>
    const scrubTimeRef = { current: 30 } as React.MutableRefObject<number>

    usePlaybackStore.getState().setVideoMetadata({ duration: 120, videoWidth: 1920, videoHeight: 1080 })

    renderRenderer(canvasRef, videoRef, { isDraggingRef, scrubTimeRef })

    // Run one RAF frame
    rafCallbacks[0](0)

    // playheadX = (30/120) * 800 = 200
    expect(ctx.moveTo).toHaveBeenCalledWith(200, 0)
  })

  describe('trim handle drawing', () => {
    it('draws in-point and out-point handles at correct positions', () => {
      const { ref: canvasRef, ctx } = makeCanvasRef(200, 80)
      const videoRef = makeVideoRef(0)

      usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })
      useClipsStore.getState().initDefaultClip(10)
      const clipId = useClipsStore.getState().clips[0].id
      useClipsStore.getState().setTrimIn(clipId, 2)
      useClipsStore.getState().setTrimOut(clipId, 8)

      renderRenderer(canvasRef, videoRef)
      rafCallbacks[0](0)

      // in-point at x = timeToPixel(2, 10, 200) = 40
      // out-point at x = timeToPixel(8, 10, 200) = 160
      expect(ctx.moveTo).toHaveBeenCalledWith(40, 0)
      expect(ctx.lineTo).toHaveBeenCalledWith(40, 80)
      expect(ctx.moveTo).toHaveBeenCalledWith(160, 0)
      expect(ctx.lineTo).toHaveBeenCalledWith(160, 80)
    })

    it('draws in-point at drag position when inPointDragRef is set', () => {
      const { ref: canvasRef, ctx } = makeCanvasRef(200, 80)
      const videoRef = makeVideoRef(0)

      usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })
      useClipsStore.getState().initDefaultClip(10)
      const clipId = useClipsStore.getState().clips[0].id
      useClipsStore.getState().setTrimIn(clipId, 2)

      const inPointDragRef = { current: { clipId, time: 3 } } as React.MutableRefObject<{ clipId: string; time: number } | null>

      renderRenderer(canvasRef, videoRef, { inPointDragRef })
      rafCallbacks[0](0)

      // drag position: timeToPixel(3, 10, 200) = 60, not store position 40
      expect(ctx.moveTo).toHaveBeenCalledWith(60, 0)
      expect(ctx.moveTo).not.toHaveBeenCalledWith(40, 0)
    })

    it('draws out-point at drag position when outPointDragRef is set', () => {
      const { ref: canvasRef, ctx } = makeCanvasRef(200, 80)
      const videoRef = makeVideoRef(0)

      usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })
      useClipsStore.getState().initDefaultClip(10)
      const clipId = useClipsStore.getState().clips[0].id
      useClipsStore.getState().setTrimOut(clipId, 8)

      const outPointDragRef = { current: { clipId, time: 7 } } as React.MutableRefObject<{ clipId: string; time: number } | null>

      renderRenderer(canvasRef, videoRef, { outPointDragRef })
      rafCallbacks[0](0)

      // drag position: timeToPixel(7, 10, 200) = 140, not store position 160
      expect(ctx.moveTo).toHaveBeenCalledWith(140, 0)
      expect(ctx.moveTo).not.toHaveBeenCalledWith(160, 0)
    })

    it('renders without handles when no clips in store', () => {
      const { ref: canvasRef, ctx } = makeCanvasRef(200, 80)
      const videoRef = makeVideoRef(0)

      usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })
      // no clips

      renderRenderer(canvasRef, videoRef)
      expect(() => rafCallbacks[0](0)).not.toThrow()

      // Only playhead moveTo should be called (at x=0, duration>0 but no clips)
      const moveToCalls = (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls
      expect(moveToCalls).toHaveLength(1) // only playhead
    })

    it('draws four handles after splitClip produces two clips', () => {
      const { ref: canvasRef, ctx } = makeCanvasRef(300, 80)
      const videoRef = makeVideoRef(0)

      usePlaybackStore.getState().setVideoMetadata({ duration: 30, videoWidth: 1920, videoHeight: 1080 })
      useClipsStore.getState().initDefaultClip(30)
      const clipId = useClipsStore.getState().clips[0].id
      useClipsStore.getState().splitClip(clipId, 15)

      renderRenderer(canvasRef, videoRef)
      rafCallbacks[0](0)

      // Two clips: [0,15] and [15,30] on 300px canvas
      // Handles at x=0, x=150, x=150, x=300 — split handles overlap at x=150
      expect(ctx.moveTo).toHaveBeenCalledWith(0, 0)
      expect(ctx.moveTo).toHaveBeenCalledWith(150, 0)
      expect(ctx.moveTo).toHaveBeenCalledWith(300, 0)
    })
  })
})
