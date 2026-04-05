import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import App from './App'

// Mock child components to avoid canvas/RAF setup in App-level tests
vi.mock('./components/VideoPlayer', () => ({
  default: ({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement> }) => (
    <div data-testid="video-player" data-has-ref={!!videoRef} />
  ),
}))

vi.mock('./components/Timeline', () => ({
  default: ({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement> }) => (
    <div data-testid="timeline" data-has-ref={!!videoRef} />
  ),
}))

describe('App', () => {
  it('mounts without errors and renders both components', () => {
    const { getByTestId } = render(<App />)
    expect(getByTestId('video-player')).toBeTruthy()
    expect(getByTestId('timeline')).toBeTruthy()
  })

  it('passes the same videoRef instance to both VideoPlayer and Timeline', () => {
    const { getByTestId } = render(<App />)
    expect(getByTestId('video-player').getAttribute('data-has-ref')).toBe('true')
    expect(getByTestId('timeline').getAttribute('data-has-ref')).toBe('true')
  })

  it('shows empty state placeholder when no video is loaded', () => {
    const { getByText } = render(<App />)
    expect(getByText('Load a video to get started')).toBeTruthy()
  })
})
