import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import Timeline from '../Timeline'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useClipsStore } from '../../stores/clipsStore'

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
  return { current: video } as React.RefObject<HTMLVideoElement>
}

// jsdom: offsetX and pointerId are not settable via EventInit, so use defineProperty
function dispatchPointer(
  el: HTMLCanvasElement,
  type: string,
  offsetX: number,
  pointerId = 1,
) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'offsetX', { configurable: true, value: offsetX })
  Object.defineProperty(event, 'pointerId', { configurable: true, value: pointerId })
  el.dispatchEvent(event)
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
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 500 })

    dispatchPointer(canvas, 'pointerdown', 250)
    expect(HTMLCanvasElement.prototype.setPointerCapture).toHaveBeenCalled()
  })

  it('does not update store on pointermove — only refs touched', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 100, videoWidth: 1280, videoHeight: 720 })
    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 500 })

    dispatchPointer(canvas, 'pointerdown', 100)
    const storeTimeBefore = usePlaybackStore.getState().currentTime
    dispatchPointer(canvas, 'pointermove', 200)
    expect(usePlaybackStore.getState().currentTime).toBe(storeTimeBefore)
  })

  it('commits proportional time to store and video on pointerup (last pointermove position)', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 100, videoWidth: 1280, videoHeight: 720 })
    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 500 })

    dispatchPointer(canvas, 'pointerdown', 100)
    dispatchPointer(canvas, 'pointermove', 250) // 250/500 * 100 = 50 — this is the committed value
    dispatchPointer(canvas, 'pointerup', 300)   // pointerup position is ignored; scrubTimeRef wins

    expect(usePlaybackStore.getState().currentTime).toBe(50)
    expect(videoRef.current?.currentTime).toBe(50)
  })

  it('clamps to 0 on pointerup at x=0', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 100, videoWidth: 1280, videoHeight: 720 })
    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 500 })

    dispatchPointer(canvas, 'pointerdown', 0)
    dispatchPointer(canvas, 'pointerup', 0)
    expect(usePlaybackStore.getState().currentTime).toBe(0)
  })

  it('clamps to duration on pointerup at x=clientWidth', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 100, videoWidth: 1280, videoHeight: 720 })
    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 500 })

    dispatchPointer(canvas, 'pointerdown', 500)
    dispatchPointer(canvas, 'pointerup', 500)
    expect(usePlaybackStore.getState().currentTime).toBe(100)
  })

  it('does not update currentTime when duration is 0', () => {
    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 500 })

    dispatchPointer(canvas, 'pointerdown', 250)
    dispatchPointer(canvas, 'pointerup', 250)
    expect(usePlaybackStore.getState().currentTime).toBe(0)
  })

  it('ignores pointermove without prior pointerdown', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 100, videoWidth: 1280, videoHeight: 720 })
    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 500 })

    dispatchPointer(canvas, 'pointermove', 250)
    expect(usePlaybackStore.getState().currentTime).toBe(0)
  })
})

describe('Trim handle drag', () => {
  it('activates in-point drag on pointerdown near in-point and commits on pointerup', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    useClipsStore.getState().initDefaultClip(10)
    // in-point at startTime=0 → x=0 on 200px canvas; x=5 is within 8px

    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 200 })

    dispatchPointer(canvas, 'pointerdown', 5)  // hits in-point at x=0
    dispatchPointer(canvas, 'pointermove', 40) // time = 40/200 * 10 = 2
    dispatchPointer(canvas, 'pointerup', 0)

    expect(useClipsStore.getState().clips[0].startTime).toBeCloseTo(2)
    // playback store must NOT be updated — handle drag, not scrub
    expect(usePlaybackStore.getState().currentTime).toBe(0)
  })

  it('activates out-point drag on pointerdown near out-point and commits on pointerup', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    useClipsStore.getState().initDefaultClip(10)
    // out-point at endTime=10 → x=200 on 200px canvas; x=195 is within 8px

    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 200 })

    dispatchPointer(canvas, 'pointerdown', 195) // hits out-point at x=200
    dispatchPointer(canvas, 'pointermove', 160) // time = 160/200 * 10 = 8
    dispatchPointer(canvas, 'pointerup', 0)

    expect(useClipsStore.getState().clips[0].endTime).toBeCloseTo(8)
    expect(usePlaybackStore.getState().currentTime).toBe(0)
  })

  it('falls through to scrub when pointerdown is not near any handle', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    useClipsStore.getState().initDefaultClip(10)
    // in-point at x=0, out-point at x=200; click x=100 is far from both

    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 200 })

    dispatchPointer(canvas, 'pointerdown', 100)
    dispatchPointer(canvas, 'pointerup', 100) // 100/200 * 10 = 5

    expect(usePlaybackStore.getState().currentTime).toBe(5)
    expect(useClipsStore.getState().clips[0].startTime).toBe(0) // clip unchanged
  })

  it('pointermove during handle drag does not update playback store', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    useClipsStore.getState().initDefaultClip(10)

    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 200 })

    dispatchPointer(canvas, 'pointerdown', 5)  // activate in-point drag
    dispatchPointer(canvas, 'pointermove', 40)
    expect(usePlaybackStore.getState().currentTime).toBe(0) // no scrub
  })

  it('pointercancel during in-point drag commits the last drag value', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    useClipsStore.getState().initDefaultClip(10)

    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 200 })

    dispatchPointer(canvas, 'pointerdown', 5)  // activate in-point drag
    dispatchPointer(canvas, 'pointermove', 40) // drag to time=2
    dispatchPointer(canvas, 'pointercancel', 0)

    expect(useClipsStore.getState().clips[0].startTime).toBeCloseTo(2)
  })

  it('pointercancel during out-point drag commits the last drag value', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    useClipsStore.getState().initDefaultClip(10)

    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 200 })

    dispatchPointer(canvas, 'pointerdown', 195) // activate out-point drag
    dispatchPointer(canvas, 'pointermove', 160) // drag to time=8
    dispatchPointer(canvas, 'pointercancel', 0)

    expect(useClipsStore.getState().clips[0].endTime).toBeCloseTo(8)
  })

  it('store rejects invalid trim (in-point dragged past out-point) — clip unchanged by 100ms guard', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    useClipsStore.getState().initDefaultClip(10)
    const clipId = useClipsStore.getState().clips[0].id
    useClipsStore.getState().setTrimOut(clipId, 5) // endTime=5

    const videoRef = makeVideoRef()
    render(<Timeline videoRef={videoRef} />)
    const canvas = document.querySelector('canvas')!
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 200 })

    // in-point at x=0; drag to x=101 → time=5.05 which is >= endTime(5) - 0.1 = 4.9
    // store's setTrimIn will reject this
    dispatchPointer(canvas, 'pointerdown', 5)
    dispatchPointer(canvas, 'pointermove', 101)
    dispatchPointer(canvas, 'pointerup', 0)

    expect(useClipsStore.getState().clips[0].startTime).toBe(0) // rejected by store
  })
})
