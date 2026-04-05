import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import App from './App'
import { usePlaybackStore } from './stores/playbackStore'
import { useClipsStore } from './stores/clipsStore'
import { useOverlaysStore } from './stores/overlaysStore'

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

beforeEach(() => {
  usePlaybackStore.getState().reset()
  useClipsStore.getState().reset()
  useOverlaysStore.getState().reset()
})

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

describe('Split button', () => {
  it('does not render when no video is loaded', () => {
    const { queryByText } = render(<App />)
    expect(queryByText('Split')).toBeNull()
  })

  it('renders when video is loaded', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    const { getByText } = render(<App />)
    expect(getByText('Split')).toBeTruthy()
  })

  it('is disabled when clips array is empty', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    const { getByText } = render(<App />)
    expect((getByText('Split') as HTMLButtonElement).disabled).toBe(true)
  })

  it('is disabled when playhead is within 100ms of clip start', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    usePlaybackStore.getState().setCurrentTime(0.05)
    useClipsStore.getState().initDefaultClip(10)
    const { getByText } = render(<App />)
    expect((getByText('Split') as HTMLButtonElement).disabled).toBe(true)
  })

  it('is disabled when playhead is within 100ms of clip end', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    usePlaybackStore.getState().setCurrentTime(9.95)
    useClipsStore.getState().initDefaultClip(10)
    const { getByText } = render(<App />)
    expect((getByText('Split') as HTMLButtonElement).disabled).toBe(true)
  })

  it('is enabled when playhead is away from clip boundaries', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    usePlaybackStore.getState().setCurrentTime(5)
    useClipsStore.getState().initDefaultClip(10)
    const { getByText } = render(<App />)
    expect((getByText('Split') as HTMLButtonElement).disabled).toBe(false)
  })

  it('splits the clip when clicked', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    usePlaybackStore.getState().setCurrentTime(5)
    useClipsStore.getState().initDefaultClip(10)
    const { getByText } = render(<App />)
    fireEvent.click(getByText('Split'))
    expect(useClipsStore.getState().clips).toHaveLength(2)
    const clips = useClipsStore.getState().clips
    expect(clips.find((c) => c.endTime === 5)).toBeTruthy()
    expect(clips.find((c) => c.startTime === 5)).toBeTruthy()
  })
})

describe('Add Text button', () => {
  it('does not render when no video is loaded', () => {
    const { queryByTestId } = render(<App />)
    expect(queryByTestId('add-text-btn')).toBeNull()
  })

  it('renders when video is loaded', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    const { getByTestId } = render(<App />)
    expect(getByTestId('add-text-btn')).toBeTruthy()
  })

  it('creates an overlay with defaults and selects it', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    usePlaybackStore.getState().setCurrentTime(5)
    const { getByTestId } = render(<App />)
    fireEvent.click(getByTestId('add-text-btn'))
    const { overlays, selectedOverlayId } = useOverlaysStore.getState()
    expect(overlays).toHaveLength(1)
    expect(overlays[0].content).toBe('Text')
    expect(overlays[0].x).toBe(0.5)
    expect(overlays[0].y).toBe(0.5)
    expect(selectedOverlayId).toBe(overlays[0].id)
  })

  it('clamps startTime to 0 when currentTime < 2.5', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    usePlaybackStore.getState().setCurrentTime(0)
    const { getByTestId } = render(<App />)
    fireEvent.click(getByTestId('add-text-btn'))
    expect(useOverlaysStore.getState().overlays[0].startTime).toBe(0)
  })

  it('clamps endTime to duration when currentTime is near end', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    usePlaybackStore.getState().setCurrentTime(10)
    const { getByTestId } = render(<App />)
    fireEvent.click(getByTestId('add-text-btn'))
    expect(useOverlaysStore.getState().overlays[0].endTime).toBe(10)
  })
})
