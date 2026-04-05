import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTimelineRenderer } from '../useTimelineRenderer'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useClipsStore } from '../../stores/clipsStore'
import { useOverlaysStore } from '../../stores/overlaysStore'
import { useAudioStore } from '../../stores/audioStore'
import { LABEL_WIDTH, VIDEO_ROW_HEIGHT, AUDIO_ROW_HEIGHT } from '../../utils/laneGeometry'
import type { TextOverlay, WaveformData } from '../../types/editor'

// Mock buildWaveformCache so we can observe calls without a real canvas
vi.mock('../../utils/waveformRenderer', () => ({
  buildWaveformCache: vi.fn(() => document.createElement('canvas')),
}))
import { buildWaveformCache } from '../../utils/waveformRenderer'

function makeOverlay(overrides: Partial<TextOverlay> = {}): TextOverlay {
  return {
    id: 'o1',
    content: 'Hello',
    startTime: 0,
    endTime: 10,
    x: 0.5,
    y: 0.5,
    fontSize: 24,
    color: '#ffffff',
    background: 'rgba(0,0,0,0.5)',
    ...overrides,
  }
}

// Mock requestAnimationFrame / cancelAnimationFrame
let rafCallbacks: FrameRequestCallback[] = []
let rafHandleCounter = 0

beforeEach(() => {
  usePlaybackStore.getState().reset()
  useClipsStore.getState().reset()
  useOverlaysStore.getState().reset()
  useAudioStore.getState().reset()
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
  vi.unstubAllGlobals()
})

/**
 * Canvas helper. Width is total canvas width (including label column).
 * Height defaults to TIMELINE_HEIGHT (96px: 48px video + 48px audio).
 * Track area = width - LABEL_WIDTH.
 *
 * Use widths where (width - LABEL_WIDTH) gives a round number for clean pixel math in tests.
 * Examples: width=196 → trackWidth=100, width=296 → trackWidth=200, width=896 → trackWidth=800
 */
function makeCanvasRef(width = 296, height = VIDEO_ROW_HEIGHT + AUDIO_ROW_HEIGHT) {
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
    drawImage: vi.fn(),
    fillText: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
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

function makeWaveformRef(data: WaveformData | null = null) {
  return { current: data } as React.MutableRefObject<WaveformData | null>
}

function renderRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  videoRef: React.RefObject<HTMLVideoElement>,
  opts: {
    isDraggingRef?: React.MutableRefObject<boolean>
    scrubTimeRef?: React.MutableRefObject<number>
    inPointDragRef?: React.MutableRefObject<{ clipId: string; time: number } | null>
    outPointDragRef?: React.MutableRefObject<{ clipId: string; time: number } | null>
    waveformDataRef?: React.MutableRefObject<WaveformData | null>
  } = {},
) {
  const isDraggingRef = opts.isDraggingRef ?? ({ current: false } as React.MutableRefObject<boolean>)
  const scrubTimeRef = opts.scrubTimeRef ?? ({ current: 0 } as React.MutableRefObject<number>)
  const inPointDragRef = opts.inPointDragRef ?? ({ current: null } as React.MutableRefObject<{ clipId: string; time: number } | null>)
  const outPointDragRef = opts.outPointDragRef ?? ({ current: null } as React.MutableRefObject<{ clipId: string; time: number } | null>)
  const waveformDataRef = opts.waveformDataRef ?? makeWaveformRef()
  return renderHook(() =>
    useTimelineRenderer(canvasRef, videoRef, isDraggingRef, scrubTimeRef, inPointDragRef, outPointDragRef, waveformDataRef)
  )
}

// ── Core RAF loop ─────────────────────────────────────────────────────────────

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
    // canvas 896×96 → trackWidth=800; playhead at time=30/120 = LABEL_WIDTH + 200 = 296
    const { ref: canvasRef, ctx } = makeCanvasRef(896, 96)
    const videoRef = makeVideoRef(0)
    const isDraggingRef = { current: true } as React.MutableRefObject<boolean>
    const scrubTimeRef = { current: 30 } as React.MutableRefObject<number>

    usePlaybackStore.getState().setVideoMetadata({ duration: 120, videoWidth: 1920, videoHeight: 1080 })

    renderRenderer(canvasRef, videoRef, { isDraggingRef, scrubTimeRef })
    rafCallbacks[0](0)

    // playheadX = LABEL_WIDTH + (30/120)*800 = 96 + 200 = 296
    expect(ctx.moveTo).toHaveBeenCalledWith(296, 0)
  })

  // ── Trim handles ──────────────────────────────────────────────────────────────

  describe('trim handle drawing', () => {
    it('draws in-point and out-point handles at correct positions', () => {
      // canvas 296×96 → trackWidth=200; in=2s→x=136, out=8s→x=256 (duration=10)
      const { ref: canvasRef, ctx } = makeCanvasRef(296, 96)
      const videoRef = makeVideoRef(0)

      usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })
      useClipsStore.getState().initDefaultClip(10)
      const clipId = useClipsStore.getState().clips[0].id
      useClipsStore.getState().setTrimIn(clipId, 2)
      useClipsStore.getState().setTrimOut(clipId, 8)

      renderRenderer(canvasRef, videoRef)
      rafCallbacks[0](0)

      // in-point: LABEL_WIDTH + (2/10)*200 = 96+40=136; out-point: 96+160=256
      // handles confined to video row (y=0 to y=VIDEO_ROW_HEIGHT=48)
      expect(ctx.moveTo).toHaveBeenCalledWith(136, 0)
      expect(ctx.lineTo).toHaveBeenCalledWith(136, VIDEO_ROW_HEIGHT)
      expect(ctx.moveTo).toHaveBeenCalledWith(256, 0)
      expect(ctx.lineTo).toHaveBeenCalledWith(256, VIDEO_ROW_HEIGHT)
    })

    it('draws in-point at drag position when inPointDragRef is set', () => {
      const { ref: canvasRef, ctx } = makeCanvasRef(296, 96)
      const videoRef = makeVideoRef(0)

      usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })
      useClipsStore.getState().initDefaultClip(10)
      const clipId = useClipsStore.getState().clips[0].id
      useClipsStore.getState().setTrimIn(clipId, 2)

      // drag to time=3: LABEL_WIDTH + (3/10)*200 = 96+60=156
      const inPointDragRef = { current: { clipId, time: 3 } } as React.MutableRefObject<{ clipId: string; time: number } | null>

      renderRenderer(canvasRef, videoRef, { inPointDragRef })
      rafCallbacks[0](0)

      expect(ctx.moveTo).toHaveBeenCalledWith(156, 0)
      expect(ctx.moveTo).not.toHaveBeenCalledWith(136, 0)
    })

    it('draws out-point at drag position when outPointDragRef is set', () => {
      const { ref: canvasRef, ctx } = makeCanvasRef(296, 96)
      const videoRef = makeVideoRef(0)

      usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })
      useClipsStore.getState().initDefaultClip(10)
      const clipId = useClipsStore.getState().clips[0].id
      useClipsStore.getState().setTrimOut(clipId, 8)

      // drag to time=7: LABEL_WIDTH + (7/10)*200 = 96+140=236
      const outPointDragRef = { current: { clipId, time: 7 } } as React.MutableRefObject<{ clipId: string; time: number } | null>

      renderRenderer(canvasRef, videoRef, { outPointDragRef })
      rafCallbacks[0](0)

      expect(ctx.moveTo).toHaveBeenCalledWith(236, 0)
      expect(ctx.moveTo).not.toHaveBeenCalledWith(256, 0)
    })

    it('renders without handles when no clips in store', () => {
      const { ref: canvasRef, ctx } = makeCanvasRef(296, 96)
      const videoRef = makeVideoRef(0)

      usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })

      renderRenderer(canvasRef, videoRef)
      expect(() => rafCallbacks[0](0)).not.toThrow()

      // Only playhead moveTo should be called
      const moveToCalls = (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls
      expect(moveToCalls).toHaveLength(1) // only playhead
    })

    it('draws four handles after splitClip produces two clips', () => {
      // canvas 396×96 → trackWidth=300; handles at 96, 246, 246, 396 (duration=30)
      const { ref: canvasRef, ctx } = makeCanvasRef(396, 96)
      const videoRef = makeVideoRef(0)

      usePlaybackStore.getState().setVideoMetadata({ duration: 30, videoWidth: 1920, videoHeight: 1080 })
      useClipsStore.getState().initDefaultClip(30)
      const clipId = useClipsStore.getState().clips[0].id
      useClipsStore.getState().splitClip(clipId, 15)

      renderRenderer(canvasRef, videoRef)
      rafCallbacks[0](0)

      // Two clips: [0,15] and [15,30] on 300px track
      // x=96+(0/30)*300=96, x=96+(15/30)*300=246, x=96+(30/30)*300=396
      expect(ctx.moveTo).toHaveBeenCalledWith(96, 0)
      expect(ctx.moveTo).toHaveBeenCalledWith(246, 0)
      expect(ctx.moveTo).toHaveBeenCalledWith(396, 0)
    })
  })

  // ── Overlay time range row ────────────────────────────────────────────────────

  describe('overlay time range row', () => {
    // canvas 196×96 → trackWidth=100; overlayRowY = VIDEO_ROW_HEIGHT - 10 - 2 = 36
    it('draws an amber bar for a single overlay', () => {
      const { ref: canvasRef, ctx } = makeCanvasRef(196, 96)
      const videoRef = makeVideoRef(0)

      usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })
      useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1', startTime: 2, endTime: 6 }))

      renderRenderer(canvasRef, videoRef)
      rafCallbacks[0](0)

      // barX = LABEL_WIDTH + (2/10)*100 = 96+20=116
      // barEnd = LABEL_WIDTH + (6/10)*100 = 96+60=156 → barW=40
      // overlayRowY = 0 + VIDEO_ROW_HEIGHT - 10 - 2 = 36
      const fillCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls
      expect(fillCalls).toContainEqual([116, 36, 40, 10])
    })

    it('draws two bars for two non-overlapping overlays', () => {
      const { ref: canvasRef, ctx } = makeCanvasRef(196, 96)
      const videoRef = makeVideoRef(0)

      usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })
      useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1', startTime: 0, endTime: 4 }))
      useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o2', startTime: 6, endTime: 10 }))

      renderRenderer(canvasRef, videoRef)
      rafCallbacks[0](0)

      const fillCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls
      // barX for [0,4]: LABEL_WIDTH + 0 = 96; barW = (4/10)*100 = 40 → [96, 36, 40, 10]
      // barX for [6,10]: LABEL_WIDTH + 60 = 156; barW = (4/10)*100 = 40 → [156, 36, 40, 10]
      expect(fillCalls).toContainEqual([96, 36, 40, 10])
      expect(fillCalls).toContainEqual([156, 36, 40, 10])
    })

    it('draws no overlay bars when store is empty', () => {
      const { ref: canvasRef, ctx } = makeCanvasRef(196, 96)
      const videoRef = makeVideoRef(0)

      usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })

      renderRenderer(canvasRef, videoRef)
      expect(() => rafCallbacks[0](0)).not.toThrow()

      const fillCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls
      // Background track bar + audio row placeholder — no overlay bar
      const overlayY = VIDEO_ROW_HEIGHT - 10 - 2
      expect(fillCalls.some((c) => c[1] === overlayY)).toBe(false)
    })

    it('does not draw a bar when overlay startTime === endTime (zero width)', () => {
      const { ref: canvasRef, ctx } = makeCanvasRef(196, 96)
      const videoRef = makeVideoRef(0)

      usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })
      useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1', startTime: 5, endTime: 5 }))

      renderRenderer(canvasRef, videoRef)
      rafCallbacks[0](0)

      const fillCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls
      const overlayY = VIDEO_ROW_HEIGHT - 10 - 2
      expect(fillCalls.some((c) => c[1] === overlayY && c[2] === 0)).toBe(false)
    })

    it('draws a full-width bar for an overlay spanning the whole duration', () => {
      const { ref: canvasRef, ctx } = makeCanvasRef(196, 96)
      const videoRef = makeVideoRef(0)

      usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })
      useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1', startTime: 0, endTime: 10 }))

      renderRenderer(canvasRef, videoRef)
      rafCallbacks[0](0)

      const fillCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls
      // barX = LABEL_WIDTH = 96; barW = trackWidth = 100
      expect(fillCalls).toContainEqual([96, 36, 100, 10])
    })
  })

  // ── Audio track row ────────────────────────────────────────────────────��──────

  describe('audio track row', () => {
    it('draws a placeholder fillRect in the audio row when status is loading', () => {
      const { ref: canvasRef, ctx } = makeCanvasRef(296, 96)
      const videoRef = makeVideoRef(0)

      useAudioStore.getState().setLoading()

      renderRenderer(canvasRef, videoRef)
      rafCallbacks[0](0)

      const fillCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls
      // Placeholder rect at audioY=VIDEO_ROW_HEIGHT=48, x=LABEL_WIDTH=96, h=AUDIO_ROW_HEIGHT=48
      expect(
        fillCalls.some((c) => c[0] === LABEL_WIDTH && c[1] === VIDEO_ROW_HEIGHT && c[3] === AUDIO_ROW_HEIGHT)
      ).toBe(true)
    })

    it('draws a gray fill and fillText "No audio" when hasAudio is false', () => {
      const { ref: canvasRef, ctx } = makeCanvasRef(296, 96)
      const videoRef = makeVideoRef(0)

      // Default state: idle / no audio
      renderRenderer(canvasRef, videoRef)
      rafCallbacks[0](0)

      const fillCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls
      expect(fillCalls.some((c) => c[1] === VIDEO_ROW_HEIGHT)).toBe(true)

      const textCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls
      expect(textCalls.some((c) => typeof c[0] === 'string' && c[0].toLowerCase().includes('no audio'))).toBe(true)
    })

    it('calls drawImage with the waveform cache when status is ready', () => {
      const { ref: canvasRef, ctx } = makeCanvasRef(296, 96)
      const videoRef = makeVideoRef(0)

      const fakeWaveform: WaveformData = {
        peaks: new Float32Array(2000),
        mins: new Float32Array(2000),
        length: 2000,
      }
      useAudioStore.getState().setWaveform(fakeWaveform)
      const waveformDataRef = makeWaveformRef(fakeWaveform)

      renderRenderer(canvasRef, videoRef, { waveformDataRef })
      rafCallbacks[0](0)

      expect(ctx.drawImage).toHaveBeenCalled()
      const drawImageCalls = (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls
      // drawImage(cache, LABEL_WIDTH, audioY, trackWidth, AUDIO_ROW_HEIGHT)
      expect(drawImageCalls[0][1]).toBe(LABEL_WIDTH)
      expect(drawImageCalls[0][2]).toBe(VIDEO_ROW_HEIGHT) // audioY
    })

    it('rebuilds waveform cache when canvas dimensions change but not on every frame', () => {
      const { ref: canvasRef } = makeCanvasRef(296, 96)
      const videoRef = makeVideoRef(0)

      const fakeWaveform: WaveformData = {
        peaks: new Float32Array(2000),
        mins: new Float32Array(2000),
        length: 2000,
      }
      useAudioStore.getState().setWaveform(fakeWaveform)
      const waveformDataRef = makeWaveformRef(fakeWaveform)

      renderRenderer(canvasRef, videoRef, { waveformDataRef })

      // Frame 1 — cache built for the first time
      rafCallbacks[0](0)
      const buildCallsAfterFrame1 = (buildWaveformCache as ReturnType<typeof vi.fn>).mock.calls.length
      expect(buildCallsAfterFrame1).toBe(1)

      // Frame 2 — same dimensions, cache NOT rebuilt
      rafCallbacks[1](0)
      const buildCallsAfterFrame2 = (buildWaveformCache as ReturnType<typeof vi.fn>).mock.calls.length
      expect(buildCallsAfterFrame2).toBe(1) // still 1

      // Simulate resize: change clientWidth
      Object.defineProperty(canvasRef.current!, 'clientWidth', { configurable: true, value: 400 })

      // Frame 3 — dimensions changed, cache rebuilt
      rafCallbacks[2](0)
      const buildCallsAfterFrame3 = (buildWaveformCache as ReturnType<typeof vi.fn>).mock.calls.length
      expect(buildCallsAfterFrame3).toBe(2) // rebuilt
    })
  })
})
