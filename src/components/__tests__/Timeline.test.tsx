import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import Timeline from '../Timeline'
import { usePlaybackStore } from '../../stores/playbackStore'

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
