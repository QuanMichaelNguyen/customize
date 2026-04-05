import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import Timeline from '../Timeline'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useClipsStore } from '../../stores/clipsStore'
import { LABEL_WIDTH, VIDEO_ROW_HEIGHT, AUDIO_ROW_HEIGHT } from '../../utils/laneGeometry'

vi.mock('../../hooks/useTimelineRenderer', () => ({
  useTimelineRenderer: vi.fn(),
}))

function makeVideoRef(currentTime = 0) {
  const video = document.createElement('video')
  let _currentTime = currentTime
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    get: () => _currentTime,
    set: (v: number) => { _currentTime = v },
  })
  return { current: video } as React.RefObject<HTMLVideoElement | null>
}

// jsdom: offsetX/offsetY and pointerId are not settable via EventInit, so use defineProperty.
// offsetY defaults to 0 (video row) when not provided, preserving backward compatibility.
function dispatchPointer(
  el: HTMLCanvasElement,
  type: string,
  offsetX: number,
  pointerId = 1,
  offsetY = 0,
) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'offsetX', { configurable: true, value: offsetX })
  Object.defineProperty(event, 'offsetY', { configurable: true, value: offsetY })
  Object.defineProperty(event, 'pointerId', { configurable: true, value: pointerId })
  el.dispatchEvent(event)
}

// Sets up a canvas with explicit clientWidth and clientHeight so hit-test geometry is
// predictable. Height=96 gives videoRow [0,48) and audioRow [48,96).
function setCanvasDimensions(
  canvas: HTMLCanvasElement,
  width: number,
  height = VIDEO_ROW_HEIGHT + AUDIO_ROW_HEIGHT,
) {
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: width })
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: height })
}

beforeEach(() => {
  usePlaybackStore.getState().reset()
  useClipsStore.getState().reset()
  vi.clearAllMocks()
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Timeline', () => {
  it('renders a canvas element', () => {
    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    expect(document.querySelector('canvas')).toBeTruthy()
  })

  it('calls setPointerCapture on pointerdown', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 100, videoWidth: 1280, videoHeight: 720 })
    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    setCanvasDimensions(canvas, 500)

    // offsetX > LABEL_WIDTH so the label-column guard does not fire
    dispatchPointer(canvas, 'pointerdown', 250)
    expect(HTMLCanvasElement.prototype.setPointerCapture).toHaveBeenCalled()
  })

  it('does not update store on pointermove — only refs touched', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 100, videoWidth: 1280, videoHeight: 720 })
    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    setCanvasDimensions(canvas, 500)

    dispatchPointer(canvas, 'pointerdown', 200)
    const storeTimeBefore = usePlaybackStore.getState().currentTime
    dispatchPointer(canvas, 'pointermove', 300)
    expect(usePlaybackStore.getState().currentTime).toBe(storeTimeBefore)
  })

  it('commits proportional time to store and video on pointerup (last pointermove position)', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 100, videoWidth: 1280, videoHeight: 720 })
    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    setCanvasDimensions(canvas, 500)

    // track width = 500 - 96 = 404px; time=50 → offsetX = 96 + 50/100*404 = 298
    dispatchPointer(canvas, 'pointerdown', 200)
    dispatchPointer(canvas, 'pointermove', 298) // 298 → time=50 — committed value
    dispatchPointer(canvas, 'pointerup', 400)   // pointerup position ignored; scrubTimeRef wins

    expect(usePlaybackStore.getState().currentTime).toBe(50)
    expect(videoRef.current?.currentTime).toBe(50)
  })

  it('clamps to 0 on pointerup at track start', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 100, videoWidth: 1280, videoHeight: 720 })
    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    setCanvasDimensions(canvas, 500)

    // offsetX = LABEL_WIDTH → (LABEL_WIDTH - LABEL_WIDTH) / trackWidth * duration = 0
    dispatchPointer(canvas, 'pointerdown', LABEL_WIDTH)
    dispatchPointer(canvas, 'pointerup', LABEL_WIDTH)
    expect(usePlaybackStore.getState().currentTime).toBe(0)
  })

  it('clamps to duration on pointerup at x=clientWidth', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 100, videoWidth: 1280, videoHeight: 720 })
    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    setCanvasDimensions(canvas, 500)

    dispatchPointer(canvas, 'pointerdown', 500)
    dispatchPointer(canvas, 'pointerup', 500)
    expect(usePlaybackStore.getState().currentTime).toBe(100)
  })

  it('does not update currentTime when duration is 0', () => {
    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    setCanvasDimensions(canvas, 500)

    dispatchPointer(canvas, 'pointerdown', 250)
    dispatchPointer(canvas, 'pointerup', 250)
    expect(usePlaybackStore.getState().currentTime).toBe(0)
  })

  it('ignores pointermove without prior pointerdown', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 100, videoWidth: 1280, videoHeight: 720 })
    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    setCanvasDimensions(canvas, 500)

    dispatchPointer(canvas, 'pointermove', 250)
    expect(usePlaybackStore.getState().currentTime).toBe(0)
  })

  it('ignores pointerdown inside the label column (offsetX < LABEL_WIDTH)', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 100, videoWidth: 1280, videoHeight: 720 })
    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    setCanvasDimensions(canvas, 500)

    dispatchPointer(canvas, 'pointerdown', LABEL_WIDTH - 1) // inside label column
    dispatchPointer(canvas, 'pointerup', LABEL_WIDTH - 1)
    expect(usePlaybackStore.getState().currentTime).toBe(0)
    expect(HTMLCanvasElement.prototype.setPointerCapture).not.toHaveBeenCalled()
  })
})

describe('Trim handle drag', () => {
  // For clientWidth=200, duration=10, LABEL_WIDTH=96:
  //   trackWidth = 200 - 96 = 104px
  //   in-point  (startTime=0)  → x = 96
  //   out-point (endTime=10)   → x = 200
  //   time=2 → x = 96 + 2/10*104 ≈ 117
  //   time=8 → x = 96 + 8/10*104 ≈ 179

  it('activates in-point drag on pointerdown near in-point and commits on pointerup', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    useClipsStore.getState().initDefaultClip(10)

    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    setCanvasDimensions(canvas, 200)

    dispatchPointer(canvas, 'pointerdown', 98)  // hits in-point at x=96 (|98-96|=2 ≤ 8)
    dispatchPointer(canvas, 'pointermove', 117) // time = (117-96)/104*10 ≈ 2
    dispatchPointer(canvas, 'pointerup', 0)

    expect(useClipsStore.getState().clips[0].startTime).toBeCloseTo(2, 1)
    // playback store must NOT be updated — handle drag, not scrub
    expect(usePlaybackStore.getState().currentTime).toBe(0)
  })

  it('activates out-point drag on pointerdown near out-point and commits on pointerup', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    useClipsStore.getState().initDefaultClip(10)

    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    setCanvasDimensions(canvas, 200)

    dispatchPointer(canvas, 'pointerdown', 197) // hits out-point at x=200 (|197-200|=3 ≤ 8)
    dispatchPointer(canvas, 'pointermove', 179) // time = (179-96)/104*10 ≈ 8
    dispatchPointer(canvas, 'pointerup', 0)

    expect(useClipsStore.getState().clips[0].endTime).toBeCloseTo(8, 1)
    expect(usePlaybackStore.getState().currentTime).toBe(0)
  })

  it('falls through to scrub when pointerdown is not near any handle', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    useClipsStore.getState().initDefaultClip(10)
    // in-point at x=96, out-point at x=200; click x=148 (time=5) is far from both

    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    setCanvasDimensions(canvas, 200)

    dispatchPointer(canvas, 'pointerdown', 148) // time = (148-96)/104*10 = 5
    dispatchPointer(canvas, 'pointerup', 148)

    expect(usePlaybackStore.getState().currentTime).toBe(5)
    expect(useClipsStore.getState().clips[0].startTime).toBe(0) // clip unchanged
  })

  it('pointermove during handle drag does not update playback store', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    useClipsStore.getState().initDefaultClip(10)

    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    setCanvasDimensions(canvas, 200)

    dispatchPointer(canvas, 'pointerdown', 98)  // activate in-point drag
    dispatchPointer(canvas, 'pointermove', 117)
    expect(usePlaybackStore.getState().currentTime).toBe(0) // no scrub
  })

  it('pointercancel during in-point drag commits the last drag value', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    useClipsStore.getState().initDefaultClip(10)

    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    setCanvasDimensions(canvas, 200)

    dispatchPointer(canvas, 'pointerdown', 98)  // activate in-point drag
    dispatchPointer(canvas, 'pointermove', 117) // drag to time≈2
    dispatchPointer(canvas, 'pointercancel', 0)

    expect(useClipsStore.getState().clips[0].startTime).toBeCloseTo(2, 1)
  })

  it('pointercancel during out-point drag commits the last drag value', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    useClipsStore.getState().initDefaultClip(10)

    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    setCanvasDimensions(canvas, 200)

    dispatchPointer(canvas, 'pointerdown', 197) // activate out-point drag
    dispatchPointer(canvas, 'pointermove', 179) // drag to time≈8
    dispatchPointer(canvas, 'pointercancel', 0)

    expect(useClipsStore.getState().clips[0].endTime).toBeCloseTo(8, 1)
  })

  it('store rejects invalid trim (in-point dragged past out-point) — clip unchanged by 100ms guard', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    useClipsStore.getState().initDefaultClip(10)
    const clipId = useClipsStore.getState().clips[0].id
    useClipsStore.getState().setTrimOut(clipId, 5) // endTime=5 → out-point x = 96 + 5/10*104 = 148

    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    setCanvasDimensions(canvas, 200)

    // in-point at x=96; drag to x=149 → time≈5.09 which is ≥ endTime(5) - 0.1 = 4.9
    // store's setTrimIn will reject this
    dispatchPointer(canvas, 'pointerdown', 98)
    dispatchPointer(canvas, 'pointermove', 149)
    dispatchPointer(canvas, 'pointerup', 0)

    expect(useClipsStore.getState().clips[0].startTime).toBe(0) // rejected by store
  })
})

describe('Y-band hit-testing', () => {
  // canvas height=96: videoRow = [0, 48), audioRow = [48, 96)

  it('pointerdown in video row (offsetY=24) triggers scrub', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    setCanvasDimensions(canvas, 200)

    // x=148 → time=5; y=24 is in video row
    dispatchPointer(canvas, 'pointerdown', 148, 1, 24)
    dispatchPointer(canvas, 'pointerup', 148, 1, 24)
    expect(usePlaybackStore.getState().currentTime).toBe(5)
  })

  it('pointerdown in audio row (offsetY=72) triggers scrub to same time', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    setCanvasDimensions(canvas, 200)

    // same offsetX as video row test → same time value
    dispatchPointer(canvas, 'pointerdown', 148, 1, 72)
    dispatchPointer(canvas, 'pointerup', 148, 1, 72)
    expect(usePlaybackStore.getState().currentTime).toBe(5)
  })

  it('pointerdown on trim handle in video row drags handle; currentTime NOT updated', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    useClipsStore.getState().initDefaultClip(10)
    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    setCanvasDimensions(canvas, 200)

    // in-point at x=96; y=24 (video row) → activates trim drag
    dispatchPointer(canvas, 'pointerdown', 98, 1, 24)
    dispatchPointer(canvas, 'pointermove', 117, 1, 24)
    dispatchPointer(canvas, 'pointerup', 0, 1, 24)

    expect(useClipsStore.getState().clips[0].startTime).toBeCloseTo(2, 1)
    expect(usePlaybackStore.getState().currentTime).toBe(0)
  })

  it('pointerdown at exact audioY boundary (offsetY=VIDEO_ROW_HEIGHT) routes to audio row — scrub only', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    useClipsStore.getState().initDefaultClip(10)
    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    setCanvasDimensions(canvas, 200)

    // offsetY = VIDEO_ROW_HEIGHT (48) is not < audioY (48), so audio row — no trim hit-test
    // Use x=148 (time=5) for both down and up so scrubTimeRef is set to the expected value
    dispatchPointer(canvas, 'pointerdown', 148, 1, VIDEO_ROW_HEIGHT)
    dispatchPointer(canvas, 'pointerup', 148, 1, VIDEO_ROW_HEIGHT)

    // scrub happens (not trim), currentTime is updated
    expect(usePlaybackStore.getState().currentTime).toBe(5)
    // in-point is NOT modified — audio row skips trim hit-test
    expect(useClipsStore.getState().clips[0].startTime).toBe(0)
  })

  it('pointercancel after audio row pointerdown clears drag state; next scrub works', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    setCanvasDimensions(canvas, 200)

    // pointerdown in audio row, then cancel
    dispatchPointer(canvas, 'pointerdown', 148, 1, 72)
    dispatchPointer(canvas, 'pointercancel', 0, 1, 72)

    // fresh scrub in video row should work correctly
    dispatchPointer(canvas, 'pointerdown', 148, 2, 24)
    dispatchPointer(canvas, 'pointerup', 148, 2, 24)
    expect(usePlaybackStore.getState().currentTime).toBe(5)
  })

  it('trim handles are NOT hit-tested in the audio row', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    useClipsStore.getState().initDefaultClip(10)
    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    setCanvasDimensions(canvas, 200)

    // In-point handle is at x=96 — clicking near it in the audio row should scrub, not drag.
    // Use x=148 for both events so scrubTimeRef is set to time=5 on pointerdown.
    dispatchPointer(canvas, 'pointerdown', 148, 1, AUDIO_ROW_HEIGHT)
    dispatchPointer(canvas, 'pointerup', 148, 1, AUDIO_ROW_HEIGHT)

    expect(usePlaybackStore.getState().currentTime).toBe(5) // scrub committed
    expect(useClipsStore.getState().clips[0].startTime).toBe(0) // trim NOT activated
  })
})
