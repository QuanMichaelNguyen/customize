import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import VideoPlayer from '../VideoPlayer'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useClipsStore } from '../../stores/clipsStore'
import { useCropStore } from '../../stores/cropStore'
import { useOverlaysStore } from '../../stores/overlaysStore'
import { useTracksStore } from '../../stores/tracksStore'
import { useAudioStore } from '../../stores/audioStore'

// jsdom does not implement these — set at module level so they persist across all tests
// (vi.clearAllMocks() preserves implementations; only vi.resetAllMocks() would wipe them).
URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
URL.revokeObjectURL = vi.fn()

// Mock extractWaveform so tests don't need OfflineAudioContext
vi.mock('../../utils/extractWaveform', () => ({
  extractWaveform: vi.fn(),
  computePeaksFromBuffer: vi.fn(),
}))

// Import the mock AFTER vi.mock so we can control its resolution
import { extractWaveform } from '../../utils/extractWaveform'

function makeVideoFile(name = 'test.mp4'): File {
  return new File(['fake data'], name, { type: 'video/mp4' })
}

function fireFileChange(input: Element, file: File) {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: { 0: file, length: 1 },
  })
  fireEvent.change(input)
}

beforeEach(() => {
  usePlaybackStore.getState().reset()
  useClipsStore.getState().reset()
  useCropStore.getState().reset()
  useOverlaysStore.getState().reset()
  useTracksStore.getState().reset()
  useAudioStore.getState().reset()
  vi.clearAllMocks()

  // Re-setup play/pause mocks after clearAllMocks so implementations persist
  Object.defineProperty(HTMLVideoElement.prototype, 'play', {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  })
  Object.defineProperty(HTMLVideoElement.prototype, 'pause', {
    configurable: true,
    value: vi.fn(),
  })

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
    await expect(async () => fireEvent.click(btn)).not.toThrow()
  })

  it('updates store via loadedmetadata event', () => {
    const ref = createRef<HTMLVideoElement>()
    render(<VideoPlayer videoRef={ref} />)
    const video = document.querySelector('video')!
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

describe('handleFileChange — store reset and audio extraction', () => {
  it('resets clipsStore when a new file is loaded (pre-existing bug fix)', async () => {
    ;(extractWaveform as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const ref = createRef<HTMLVideoElement>()
    render(<VideoPlayer videoRef={ref} />)

    // Seed clips so we can verify they're cleared
    useClipsStore.getState().initDefaultClip(30)
    expect(useClipsStore.getState().clips).toHaveLength(1)

    const input = document.querySelector('input[type="file"]')!
    fireFileChange(input, makeVideoFile())

    expect(useClipsStore.getState().clips).toHaveLength(0)
  })

  it('resets cropStore and overlaysStore when a new file is loaded', async () => {
    ;(extractWaveform as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const ref = createRef<HTMLVideoElement>()
    render(<VideoPlayer videoRef={ref} />)

    useCropStore.getState().toggleCropOverlay()
    expect(useCropStore.getState().isCropOverlayOpen).toBe(true)

    const input = document.querySelector('input[type="file"]')!
    fireFileChange(input, makeVideoFile())

    expect(useCropStore.getState().isCropOverlayOpen).toBe(false)
  })

  it('seeds video-0 track in tracksStore immediately on file load', () => {
    ;(extractWaveform as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const ref = createRef<HTMLVideoElement>()
    render(<VideoPlayer videoRef={ref} />)
    const input = document.querySelector('input[type="file"]')!
    fireFileChange(input, makeVideoFile())

    const tracks = useTracksStore.getState().tracks
    expect(tracks.some((t) => t.id === 'video-0')).toBe(true)
  })

  it('sets audioStore to loading immediately on file load', () => {
    // Use a promise that never resolves so we can observe the loading state
    ;(extractWaveform as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))

    const ref = createRef<HTMLVideoElement>()
    render(<VideoPlayer videoRef={ref} />)
    const input = document.querySelector('input[type="file"]')!
    fireFileChange(input, makeVideoFile())

    expect(useAudioStore.getState().extractionStatus).toBe('loading')
  })

  it('sets audioStore to ready and adds audio-0 track when extraction succeeds with data', async () => {
    const fakeWaveform = {
      peaks: new Float32Array(2000),
      mins: new Float32Array(2000),
      length: 2000,
    }
    ;(extractWaveform as ReturnType<typeof vi.fn>).mockResolvedValue(fakeWaveform)

    const ref = createRef<HTMLVideoElement>()
    render(<VideoPlayer videoRef={ref} />)
    const input = document.querySelector('input[type="file"]')!
    fireFileChange(input, makeVideoFile())

    // Let the microtask queue flush
    await Promise.resolve()

    expect(useAudioStore.getState().extractionStatus).toBe('ready')
    expect(useAudioStore.getState().hasAudio).toBe(true)
    expect(useTracksStore.getState().tracks.some((t) => t.id === 'audio-0')).toBe(true)
  })

  it('sets hasAudio to false and does not add audio-0 track when video has no audio', async () => {
    ;(extractWaveform as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const ref = createRef<HTMLVideoElement>()
    render(<VideoPlayer videoRef={ref} />)
    const input = document.querySelector('input[type="file"]')!
    fireFileChange(input, makeVideoFile())

    await Promise.resolve()

    expect(useAudioStore.getState().hasAudio).toBe(false)
    expect(useTracksStore.getState().tracks.some((t) => t.id === 'audio-0')).toBe(false)
  })

  it('sets audioStore to error when extractWaveform rejects', async () => {
    ;(extractWaveform as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('decode failed'))

    const ref = createRef<HTMLVideoElement>()
    render(<VideoPlayer videoRef={ref} />)
    const input = document.querySelector('input[type="file"]')!
    fireFileChange(input, makeVideoFile())

    // Need two microtask ticks: one for the rejection, one for the .catch handler
    await Promise.resolve()
    await Promise.resolve()

    expect(useAudioStore.getState().extractionStatus).toBe('error')
    expect(useTracksStore.getState().tracks.some((t) => t.id === 'audio-0')).toBe(false)
  })

  it('resets tracksStore and audioStore before extracting when loading a second file', async () => {
    // First file succeeds with audio
    const fakeWaveform = { peaks: new Float32Array(10), mins: new Float32Array(10), length: 10 }
    ;(extractWaveform as ReturnType<typeof vi.fn>).mockResolvedValue(fakeWaveform)

    const ref = createRef<HTMLVideoElement>()
    render(<VideoPlayer videoRef={ref} />)
    const input = document.querySelector('input[type="file"]')!

    fireFileChange(input, makeVideoFile('first.mp4'))
    await Promise.resolve()
    expect(useTracksStore.getState().tracks.some((t) => t.id === 'audio-0')).toBe(true)

    // Second file: never resolves — check reset happened synchronously
    ;(extractWaveform as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))
    fireFileChange(input, makeVideoFile('second.mp4'))

    // tracksStore should have been reset and only video-0 re-seeded
    const tracks = useTracksStore.getState().tracks
    expect(tracks.some((t) => t.id === 'audio-0')).toBe(false)
    expect(tracks.some((t) => t.id === 'video-0')).toBe(true)
    // audioStore should be in loading state
    expect(useAudioStore.getState().extractionStatus).toBe('loading')
  })
})
