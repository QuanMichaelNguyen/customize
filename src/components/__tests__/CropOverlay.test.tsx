import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import CropOverlay from '../CropOverlay'
import { useCropStore } from '../../stores/cropStore'
import { usePlaybackStore } from '../../stores/playbackStore'

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
  useCropStore.getState().reset()
  usePlaybackStore.getState().reset()
  HTMLDivElement.prototype.setPointerCapture = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CropOverlay', () => {
  it('renders preset buttons', () => {
    const containerRef = makeContainerRef()
    const { getByTestId } = render(<CropOverlay containerRef={containerRef} />)
    expect(getByTestId('preset-16:9')).toBeTruthy()
    expect(getByTestId('preset-9:16')).toBeTruthy()
    expect(getByTestId('preset-1:1')).toBeTruthy()
    expect(getByTestId('preset-free')).toBeTruthy()
  })

  it('renders the crop box when cropRegion is set', () => {
    useCropStore.getState().setCropRegion({ x: 0.1, y: 0.1, width: 0.8, height: 0.45 })
    const containerRef = makeContainerRef()
    const { getByTestId } = render(<CropOverlay containerRef={containerRef} />)
    expect(getByTestId('crop-box')).toBeTruthy()
  })

  it('does not render the crop box when cropRegion is null', () => {
    const containerRef = makeContainerRef()
    const { queryByTestId } = render(<CropOverlay containerRef={containerRef} />)
    expect(queryByTestId('crop-box')).toBeNull()
  })

  it('clicking a preset button calls setAspectRatio with that preset', () => {
    const containerRef = makeContainerRef()
    const { getByTestId } = render(<CropOverlay containerRef={containerRef} />)
    fireEvent.click(getByTestId('preset-16:9'))
    expect(useCropStore.getState().aspectRatio).toBe('16:9')
    expect(useCropStore.getState().cropRegion).not.toBeNull()
  })

  it('clicking Free button calls setAspectRatio with free', () => {
    useCropStore.getState().setAspectRatio('16:9')
    const containerRef = makeContainerRef()
    const { getByTestId } = render(<CropOverlay containerRef={containerRef} />)
    fireEvent.click(getByTestId('preset-free'))
    expect(useCropStore.getState().aspectRatio).toBe('free')
  })

  it('does not crash when cropRegion is null', () => {
    const containerRef = makeContainerRef()
    expect(() => render(<CropOverlay containerRef={containerRef} />)).not.toThrow()
  })

  it('does not crash when videoWidth is 0', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 0, videoHeight: 0 })
    useCropStore.getState().setCropRegion({ x: 0.1, y: 0.1, width: 0.8, height: 0.45 })
    const containerRef = makeContainerRef()
    expect(() => render(<CropOverlay containerRef={containerRef} />)).not.toThrow()
  })

  describe('corner drag', () => {
    it('pointerdown on corner handle calls setPointerCapture', () => {
      usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })
      useCropStore.getState().setCropRegion({ x: 0.1, y: 0.1, width: 0.8, height: 0.45 })
      const containerRef = makeContainerRef(800, 450)
      const { getByTestId } = render(<CropOverlay containerRef={containerRef} />)
      const tlHandle = getByTestId('corner-tl')

      dispatchPointerWithClient(tlHandle, 'pointerdown', 80, 45)
      expect(HTMLDivElement.prototype.setPointerCapture).toHaveBeenCalled()
    })

    it('pointerup after drag calls setCropRegion exactly once', () => {
      usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })
      useCropStore.getState().setCropRegion({ x: 0.1, y: 0.1, width: 0.8, height: 0.45 })
      const containerRef = makeContainerRef(800, 450)
      const { getByTestId } = render(<CropOverlay containerRef={containerRef} />)
      const brHandle = getByTestId('corner-br')

      act(() => {
        dispatchPointerWithClient(brHandle, 'pointerdown', 720, 248)
        dispatchPointerWithClient(brHandle, 'pointermove', 700, 230)
        dispatchPointerWithClient(brHandle, 'pointerup', 700, 230)
      })

      // cropRegion should have been updated (committed once)
      const { cropRegion } = useCropStore.getState()
      expect(cropRegion).not.toBeNull()
      // Width should have decreased (dragged left from 720→700)
      expect(cropRegion!.width).toBeLessThan(0.8)
    })

    it('pointercancel commits the last drag position', () => {
      usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1920, videoHeight: 1080 })
      useCropStore.getState().setCropRegion({ x: 0.1, y: 0.1, width: 0.8, height: 0.45 })
      const containerRef = makeContainerRef(800, 450)
      const { getByTestId } = render(<CropOverlay containerRef={containerRef} />)
      const brHandle = getByTestId('corner-br')

      act(() => {
        dispatchPointerWithClient(brHandle, 'pointerdown', 720, 248)
        dispatchPointerWithClient(brHandle, 'pointermove', 700, 230)
        dispatchPointerWithClient(brHandle, 'pointercancel', 700, 230)
      })

      expect(useCropStore.getState().cropRegion).not.toBeNull()
      expect(useCropStore.getState().cropRegion!.width).toBeLessThan(0.8)
    })
  })
})
