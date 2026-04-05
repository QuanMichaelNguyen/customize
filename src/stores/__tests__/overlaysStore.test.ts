import { beforeEach, describe, expect, it } from 'vitest'
import { useOverlaysStore } from '../overlaysStore'
import type { TextOverlay } from '../../types/editor'

const makeOverlay = (overrides: Partial<TextOverlay> = {}): TextOverlay => ({
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
})

beforeEach(() => {
  useOverlaysStore.getState().reset()
})

describe('addOverlay', () => {
  it('adds an overlay to the list', () => {
    const overlay = makeOverlay()
    useOverlaysStore.getState().addOverlay(overlay)
    expect(useOverlaysStore.getState().overlays).toHaveLength(1)
    expect(useOverlaysStore.getState().overlays[0]).toEqual(overlay)
  })

  it('can add multiple overlays', () => {
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1' }))
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o2' }))
    expect(useOverlaysStore.getState().overlays).toHaveLength(2)
  })
})

describe('removeOverlay', () => {
  it('removes the overlay with the matching id', () => {
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1' }))
    useOverlaysStore.getState().removeOverlay('o1')
    expect(useOverlaysStore.getState().overlays).toHaveLength(0)
  })

  it('clears selectedOverlayId when the selected overlay is removed', () => {
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1' }))
    useOverlaysStore.getState().setSelectedOverlay('o1')
    useOverlaysStore.getState().removeOverlay('o1')
    expect(useOverlaysStore.getState().selectedOverlayId).toBeNull()
  })

  it('preserves selectedOverlayId when a different overlay is removed', () => {
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1' }))
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o2' }))
    useOverlaysStore.getState().setSelectedOverlay('o1')
    useOverlaysStore.getState().removeOverlay('o2')
    expect(useOverlaysStore.getState().selectedOverlayId).toBe('o1')
  })

  it('is a no-op for a non-existent id', () => {
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1' }))
    useOverlaysStore.getState().removeOverlay('nonexistent')
    expect(useOverlaysStore.getState().overlays).toHaveLength(1)
  })
})

describe('updateOverlay', () => {
  it('updates only the specified fields', () => {
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1', content: 'Old' }))
    useOverlaysStore.getState().updateOverlay('o1', { content: 'New' })
    const updated = useOverlaysStore.getState().overlays[0]
    expect(updated.content).toBe('New')
    expect(updated.fontSize).toBe(24)
    expect(updated.x).toBe(0.5)
  })

  it('is a no-op for a non-existent id', () => {
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1' }))
    useOverlaysStore.getState().updateOverlay('nonexistent', { content: 'X' })
    expect(useOverlaysStore.getState().overlays[0].content).toBe('Hello')
  })
})

describe('setSelectedOverlay', () => {
  it('sets selectedOverlayId to the given id', () => {
    useOverlaysStore.getState().setSelectedOverlay('o1')
    expect(useOverlaysStore.getState().selectedOverlayId).toBe('o1')
  })

  it('sets selectedOverlayId to null', () => {
    useOverlaysStore.getState().setSelectedOverlay('o1')
    useOverlaysStore.getState().setSelectedOverlay(null)
    expect(useOverlaysStore.getState().selectedOverlayId).toBeNull()
  })
})

describe('reset', () => {
  it('clears overlays and selectedOverlayId', () => {
    useOverlaysStore.getState().addOverlay(makeOverlay())
    useOverlaysStore.getState().setSelectedOverlay('o1')
    useOverlaysStore.getState().reset()
    expect(useOverlaysStore.getState().overlays).toHaveLength(0)
    expect(useOverlaysStore.getState().selectedOverlayId).toBeNull()
  })
})
