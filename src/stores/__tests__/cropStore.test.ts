import { describe, it, expect, beforeEach } from 'vitest'
import { useCropStore } from '../cropStore'

beforeEach(() => {
  useCropStore.getState().reset()
})

describe('setCropRegion', () => {
  it('stores the provided region', () => {
    useCropStore.getState().setCropRegion({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 })
    expect(useCropStore.getState().cropRegion).toEqual({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 })
  })

  it('accepts a zero-size region (validation deferred to drag handler)', () => {
    useCropStore.getState().setCropRegion({ x: 0, y: 0, width: 0, height: 0 })
    expect(useCropStore.getState().cropRegion).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })
})

describe('setAspectRatio', () => {
  it('16:9 — computes height from width (fits within bounds)', () => {
    useCropStore.getState().setCropRegion({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 })
    useCropStore.getState().setAspectRatio('16:9')
    const { cropRegion } = useCropStore.getState()
    expect(cropRegion!.width).toBeCloseTo(0.8)
    // height = 0.8 / (16/9) ≈ 0.45
    expect(cropRegion!.height).toBeCloseTo(0.45)
  })

  it('9:16 — reduces width when computed height exceeds bounds', () => {
    useCropStore.getState().setCropRegion({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 })
    useCropStore.getState().setAspectRatio('9:16')
    const { cropRegion } = useCropStore.getState()
    // height would be 0.8/(9/16)≈1.42, exceeds 1-y=0.9; constrain
    expect(cropRegion!.height).toBeCloseTo(0.9)
    // width = 0.9 * (9/16) ≈ 0.506
    expect(cropRegion!.width).toBeCloseTo(0.506, 2)
  })

  it('1:1 — square crop', () => {
    useCropStore.getState().setCropRegion({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 })
    useCropStore.getState().setAspectRatio('1:1')
    const { cropRegion } = useCropStore.getState()
    expect(cropRegion!.width).toBeCloseTo(0.8)
    expect(cropRegion!.height).toBeCloseTo(0.8)
  })

  it('free — does not change region shape', () => {
    useCropStore.getState().setCropRegion({ x: 0.1, y: 0.1, width: 0.8, height: 0.5 })
    useCropStore.getState().setAspectRatio('free')
    const { cropRegion } = useCropStore.getState()
    expect(cropRegion!.width).toBeCloseTo(0.8)
    expect(cropRegion!.height).toBeCloseTo(0.5)
  })

  it('when cropRegion is null — sets a default centered region with the correct aspect ratio', () => {
    useCropStore.getState().setAspectRatio('16:9')
    const { cropRegion } = useCropStore.getState()
    expect(cropRegion).not.toBeNull()
    // Default base is {x:0.1, y:0.1, width:0.8, height:0.8}; 16:9 → height ≈ 0.45
    expect(cropRegion!.width).toBeCloseTo(0.8)
    expect(cropRegion!.height).toBeCloseTo(0.45)
  })

  it('updates aspectRatio state', () => {
    useCropStore.getState().setAspectRatio('16:9')
    expect(useCropStore.getState().aspectRatio).toBe('16:9')
  })
})

describe('clearCrop', () => {
  it('sets cropRegion to null and aspectRatio to free', () => {
    useCropStore.getState().setCropRegion({ x: 0.1, y: 0.1, width: 0.8, height: 0.45 })
    useCropStore.getState().setAspectRatio('16:9')
    useCropStore.getState().clearCrop()
    expect(useCropStore.getState().cropRegion).toBeNull()
    expect(useCropStore.getState().aspectRatio).toBe('free')
  })
})

describe('toggleCropOverlay', () => {
  it('flips isCropOverlayOpen from false to true', () => {
    useCropStore.getState().toggleCropOverlay()
    expect(useCropStore.getState().isCropOverlayOpen).toBe(true)
  })

  it('flips isCropOverlayOpen back to false', () => {
    useCropStore.getState().toggleCropOverlay()
    useCropStore.getState().toggleCropOverlay()
    expect(useCropStore.getState().isCropOverlayOpen).toBe(false)
  })
})

describe('reset', () => {
  it('restores all fields to initial values', () => {
    useCropStore.getState().setCropRegion({ x: 0.1, y: 0.1, width: 0.8, height: 0.45 })
    useCropStore.getState().setAspectRatio('16:9')
    useCropStore.getState().toggleCropOverlay()
    useCropStore.getState().reset()
    const state = useCropStore.getState()
    expect(state.cropRegion).toBeNull()
    expect(state.aspectRatio).toBe('free')
    expect(state.isCropOverlayOpen).toBe(false)
  })
})
