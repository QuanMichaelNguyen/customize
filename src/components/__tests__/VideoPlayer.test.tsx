import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import VideoPlayer from '../VideoPlayer'
import { usePlaybackStore } from '../../stores/playbackStore'

// jsdom does not implement play/pause on HTMLVideoElement
Object.defineProperty(HTMLVideoElement.prototype, 'play', {
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined),
})
Object.defineProperty(HTMLVideoElement.prototype, 'pause', {
  configurable: true,
  value: vi.fn(),
})

beforeEach(() => {
  usePlaybackStore.getState().reset()
  vi.clearAllMocks()
})

describe('VideoPlayer', () => {
  it('renders a file input and a video element', () => {
    const ref = createRef<HTMLVideoElement>()
    render(<VideoPlayer videoRef={ref} />)
    expect(document.querySelector('input[type="file"]')).toBeTruthy()
    expect(document.querySelector('video')).toBeTruthy()
  })

  it('hides the video element when no video is loaded', () => {
    const ref = createRef<HTMLVideoElement>()
    render(<VideoPlayer videoRef={ref} />)
    const video = document.querySelector('video')!
    expect(video.classList.contains('hidden')).toBe(true)
  })

  it('calls video.play() when play button is clicked (hasVideo = true)', () => {
    const ref = createRef<HTMLVideoElement>()
    // Set hasVideo so button renders
    usePlaybackStore.getState().setVideoMetadata({ duration: 60, videoWidth: 1280, videoHeight: 720 })
    render(<VideoPlayer videoRef={ref} />)
    const btn = screen.getByRole('button', { name: /play/i })
    fireEvent.click(btn)
    expect(HTMLVideoElement.prototype.play).toHaveBeenCalled()
  })

  it('calls video.pause() when pause button is clicked while playing', () => {
    const ref = createRef<HTMLVideoElement>()
    usePlaybackStore.getState().setVideoMetadata({ duration: 60, videoWidth: 1280, videoHeight: 720 })
    usePlaybackStore.getState().setPlaying(true)
    render(<VideoPlayer videoRef={ref} />)
    const btn = screen.getByRole('button', { name: /pause/i })
    fireEvent.click(btn)
    expect(HTMLVideoElement.prototype.pause).toHaveBeenCalled()
  })

  it('does not throw on AbortError from video.play()', async () => {
    const abortError = new DOMException('interrupted', 'AbortError')
    ;(HTMLVideoElement.prototype.play as ReturnType<typeof vi.fn>).mockRejectedValueOnce(abortError)
    const ref = createRef<HTMLVideoElement>()
    usePlaybackStore.getState().setVideoMetadata({ duration: 60, videoWidth: 1280, videoHeight: 720 })
    render(<VideoPlayer videoRef={ref} />)
    const btn = screen.getByRole('button', { name: /play/i })
    // Should not throw
    await expect(async () => fireEvent.click(btn)).not.toThrow()
  })

  it('updates store via loadedmetadata event', () => {
    const ref = createRef<HTMLVideoElement>()
    render(<VideoPlayer videoRef={ref} />)
    const video = document.querySelector('video')!
    // Simulate loadedmetadata
    Object.defineProperty(video, 'duration', { configurable: true, value: 90 })
    Object.defineProperty(video, 'videoWidth', { configurable: true, value: 1920 })
    Object.defineProperty(video, 'videoHeight', { configurable: true, value: 1080 })
    fireEvent(video, new Event('loadedmetadata'))
    const state = usePlaybackStore.getState()
    expect(state.duration).toBe(90)
    expect(state.videoWidth).toBe(1920)
    expect(state.videoHeight).toBe(1080)
    expect(state.hasVideo).toBe(true)
  })

  it('updates store isPlaying on play/pause DOM events', () => {
    const ref = createRef<HTMLVideoElement>()
    render(<VideoPlayer videoRef={ref} />)
    const video = document.querySelector('video')!
    fireEvent(video, new Event('play'))
    expect(usePlaybackStore.getState().isPlaying).toBe(true)
    fireEvent(video, new Event('pause'))
    expect(usePlaybackStore.getState().isPlaying).toBe(false)
  })
})
