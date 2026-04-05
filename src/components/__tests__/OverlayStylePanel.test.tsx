import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import OverlayStylePanel from '../OverlayStylePanel'
import { useOverlaysStore } from '../../stores/overlaysStore'
import type { TextOverlay } from '../../types/editor'

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

beforeEach(() => {
  useOverlaysStore.getState().reset()
})

describe('OverlayStylePanel', () => {
  it('renders nothing when no overlay is selected', () => {
    const { container } = render(<OverlayStylePanel />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when selectedOverlayId references a removed overlay', () => {
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1' }))
    useOverlaysStore.getState().setSelectedOverlay('o1')
    useOverlaysStore.getState().removeOverlay('o1')
    const { container } = render(<OverlayStylePanel />)
    expect(container.firstChild).toBeNull()
  })

  it('renders panel with overlay values when overlay is selected', () => {
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1', content: 'Test text' }))
    useOverlaysStore.getState().setSelectedOverlay('o1')
    const { getByTestId } = render(<OverlayStylePanel />)
    expect(getByTestId('overlay-style-panel')).toBeTruthy()
    expect((getByTestId('overlay-content-input') as HTMLInputElement).value).toBe('Test text')
  })

  it('changing text input calls updateOverlay with new content', () => {
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1' }))
    useOverlaysStore.getState().setSelectedOverlay('o1')
    const { getByTestId } = render(<OverlayStylePanel />)
    fireEvent.change(getByTestId('overlay-content-input'), { target: { value: 'New content' } })
    expect(useOverlaysStore.getState().overlays[0].content).toBe('New content')
  })

  it('changing color input calls updateOverlay with new color', () => {
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1', color: '#ffffff' }))
    useOverlaysStore.getState().setSelectedOverlay('o1')
    const { getByTestId } = render(<OverlayStylePanel />)
    fireEvent.change(getByTestId('overlay-color-input'), { target: { value: '#ff0000' } })
    expect(useOverlaysStore.getState().overlays[0].color).toBe('#ff0000')
  })

  it('clicking Delete calls removeOverlay and clears selectedOverlayId', () => {
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1' }))
    useOverlaysStore.getState().setSelectedOverlay('o1')
    const { getByTestId } = render(<OverlayStylePanel />)
    fireEvent.click(getByTestId('overlay-delete-btn'))
    expect(useOverlaysStore.getState().overlays).toHaveLength(0)
    expect(useOverlaysStore.getState().selectedOverlayId).toBeNull()
  })

  it('clicking None button sets background to transparent', () => {
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1', background: '#000000' }))
    useOverlaysStore.getState().setSelectedOverlay('o1')
    const { getByTestId } = render(<OverlayStylePanel />)
    fireEvent.click(getByTestId('overlay-bg-transparent-btn'))
    expect(useOverlaysStore.getState().overlays[0].background).toBe('transparent')
  })

  it('font size select pre-fills with overlay fontSize', () => {
    useOverlaysStore.getState().addOverlay(makeOverlay({ id: 'o1', fontSize: 32 }))
    useOverlaysStore.getState().setSelectedOverlay('o1')
    const { getByTestId } = render(<OverlayStylePanel />)
    expect((getByTestId('overlay-fontsize-select') as HTMLSelectElement).value).toBe('32')
  })
})
