import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTimelineRenderer } from '../useTimelineRenderer'
import { usePlaybackStore } from '../../stores/playbackStore'

// Mock requestAnimationFrame / cancelAnimationFrame
let rafCallbacks: FrameRequestCallback[] = []
let rafHandleCounter = 0

beforeEach(() => {
  usePlaybackStore.getState().reset()
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
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
  }
  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
  // Use plain object instead of createRef to allow mutable current
  const ref = { current: canvas } as React.RefObject<HTMLCanvasElement>
  return { ref, ctx }
}

function makeVideoRef(currentTime = 0) {
  const video = document.createElement('video')
  Object.defineProperty(video, 'currentTime', { configurable: true, value: currentTime })
  const ref = { current: video } as React.RefObject<HTMLVideoElement>
  return ref
}

describe('useTimelineRenderer', () => {
  it('starts RAF loop on mount', () => {
    const { ref: canvasRef } = makeCanvasRef()
    const videoRef = makeVideoRef()
    const isDraggingRef = { current: false } as React.MutableRefObject<boolean>
    const scrubTimeRef = { current: 0 } as React.MutableRefObject<number>

    renderHook(() => useTimelineRenderer(canvasRef, videoRef, isDraggingRef, scrubTimeRef))
    expect(window.requestAnimationFrame).toHaveBeenCalled()
  })

  it('calls cancelAnimationFrame on unmount', () => {
    const { ref: canvasRef } = makeCanvasRef()
    const videoRef = makeVideoRef()
    const isDraggingRef = { current: false } as React.MutableRefObject<boolean>
    const scrubTimeRef = { current: 0 } as React.MutableRefObject<number>

    const { unmount } = renderHook(() =>
      useTimelineRenderer(canvasRef, videoRef, isDraggingRef, scrubTimeRef)
    )
    unmount()
    expect(window.cancelAnimationFrame).toHaveBeenCalled()
  })

  it('does not reschedule RAF after unmount (cancelledRef guard)', () => {
    const { ref: canvasRef } = makeCanvasRef()
    const videoRef = makeVideoRef()
    const isDraggingRef = { current: false } as React.MutableRefObject<boolean>
    const scrubTimeRef = { current: 0 } as React.MutableRefObject<number>

    const { unmount } = renderHook(() =>
      useTimelineRenderer(canvasRef, videoRef, isDraggingRef, scrubTimeRef)
    )
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
    const isDraggingRef = { current: false } as React.MutableRefObject<boolean>
    const scrubTimeRef = { current: 0 } as React.MutableRefObject<number>

    renderHook(() => useTimelineRenderer(canvasRef, videoRef, isDraggingRef, scrubTimeRef))

    // Run one RAF frame — should not throw
    expect(() => rafCallbacks[0](0)).not.toThrow()
  })

  it('reads scrubTimeRef when isDragging is true', () => {
    const { ref: canvasRef, ctx } = makeCanvasRef(800, 80)
    const videoRef = makeVideoRef(0)
    const isDraggingRef = { current: true } as React.MutableRefObject<boolean>
    const scrubTimeRef = { current: 30 } as React.MutableRefObject<number>

    usePlaybackStore.getState().setVideoMetadata({ duration: 120, videoWidth: 1920, videoHeight: 1080 })

    renderHook(() => useTimelineRenderer(canvasRef, videoRef, isDraggingRef, scrubTimeRef))

    // Run one RAF frame
    rafCallbacks[0](0)

    // playheadX = (30/120) * 800 = 200
    expect(ctx.moveTo).toHaveBeenCalledWith(200, 0)
  })
})
