import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import TextOverlayLayer from '../TextOverlayLayer'
import { useOverlaysStore } from '../../stores/overlaysStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import type { TextOverlay } from '../../types/editor'

function makeContainerRef(width = 800, height = 450) {
  const div = document.createElement('div')
  vi.spyOn(div, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect)
  return { current: div } as React.RefObject<HTMLDivElement>
}

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

function dispatchPointerWithClient(
  el: Element,
  type: string,
  clientX: number,
  clientY: number,
  pointerId = 1,
) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY })
  Object.defineProperty(event, 'pointerId', { configurable: true, value: pointerId })
  el.dispatchEvent(event)
}

beforeEach(() => {
  useOverlaysStore.getState().reset()
  usePlaybackStore.getState().reset()
  HTMLDivElement.prototype.setPointerCapture = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TextOverlayLayer', () => {
  it('renders the layer wrapper', () => {
    const containerRef = makeContainerRef()
    const { getByTestId } = render(<TextOverlayLayer containerRef={containerRef} />)
    expect(getByTestId('text-overlay-layer')).toBeTruthy()
  })

  it('renders no overlays when store is empty', () => {
    const containerRef = makeContainerRef()
    const { queryAllByTestId } = render(<TextOverlayLayer containerRef={containerRef} />)
    expect(queryAllByTestId(/^overlay-/).length).toBe(0)
  })

  it('renders overlay when currentTime is within its time range', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })
    usePlaybackStore.getState().setCurrentTime(5)
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1', startTime: 0, endTime: 10 }))
    const containerRef = makeContainerRef()
    const { getByTestId } = render(<TextOverlayLayer containerRef={containerRef} />)
    expect(getByTestId('overlay-o1')).toBeTruthy()
  })

  it('does not render overlay when currentTime is before startTime', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })
    usePlaybackStore.getState().setCurrentTime(3)
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1', startTime: 5, endTime: 10 }))
    const containerRef = makeContainerRef()
    const { queryByTestId } = render(<TextOverlayLayer containerRef={containerRef} />)
    expect(queryByTestId('overlay-o1')).toBeNull()
  })

  it('renders overlay at boundary endTime (inclusive)', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })
    usePlaybackStore.getState().setCurrentTime(10)
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1', startTime: 5, endTime: 10 }))
    const containerRef = makeContainerRef()
    const { getByTestId } = render(<TextOverlayLayer containerRef={containerRef} />)
    expect(getByTestId('overlay-o1')).toBeTruthy()
  })

  it('renders both overlays when two are visible at the same time', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })
    usePlaybackStore.getState().setCurrentTime(5)
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1', startTime: 0, endTime: 10 }))
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o2', startTime: 0, endTime: 10 }))
    const containerRef = makeContainerRef()
    const { getByTestId } = render(<TextOverlayLayer containerRef={containerRef} />)
    expect(getByTestId('overlay-o1')).toBeTruthy()
    expect(getByTestId('overlay-o2')).toBeTruthy()
  })

  it('pointerDown on overlay calls setSelectedOverlay with correct id', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })
    usePlaybackStore.getState().setCurrentTime(5)
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1', startTime: 0, endTime: 10 }))
    const containerRef = makeContainerRef()
    const { getByTestId } = render(<TextOverlayLayer containerRef={containerRef} />)
    act(() => {
      dispatchPointerWithClient(getByTestId('overlay-o1'), 'pointerdown', 400, 225)
    })
    expect(useOverlaysStore.getState().selectedOverlayId).toBe('o1')
  })

  it('pointerUp after drag commits updated position to store', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })
    usePlaybackStore.getState().setCurrentTime(5)
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1', startTime: 0, endTime: 10, x: 0.5, y: 0.5 }))
    const containerRef = makeContainerRef(800, 450)
    const { getByTestId } = render(<TextOverlayLayer containerRef={containerRef} />)
    act(() => {
      dispatchPointerWithClient(getByTestId('overlay-o1'), 'pointerdown', 400, 225)
      dispatchPointerWithClient(getByTestId('overlay-o1'), 'pointermove', 480, 270)
      dispatchPointerWithClient(getByTestId('overlay-o1'), 'pointerup', 480, 270)
    })
    const updated = useOverlaysStore.getState().overlays[0]
    // Dragged right by 80px on 800px wide → +0.1 in x
    expect(updated.x).toBeCloseTo(0.6, 5)
    // Dragged down by 45px on 450px → +0.1 in y
    expect(updated.y).toBeCloseTo(0.6, 5)
  })
})
