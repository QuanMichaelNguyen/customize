import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcuts } from '../useKeyboardShortcuts'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useClipsStore } from '../../stores/clipsStore'
import { useHistoryStore } from '../../stores/historyStore'
import type { ClipSegment } from '../../types/editor'

function makeVideoRef(overrides: Partial<HTMLVideoElement> = {}): React.RefObject<HTMLVideoElement | null> {
  const video = {
    currentTime: 5,
    playbackRate: 1,
    pause: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as HTMLVideoElement
  return { current: video }
}

function makeClip(id: string, start: number, end: number): ClipSegment {
  return { id, startTime: start, endTime: end, trackId: 'video-0' }
}

function fireKey(key: string, options: Partial<KeyboardEventInit> = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }))
}

beforeEach(() => {
  usePlaybackStore.getState().reset()
  useClipsStore.getState().reset()
  useHistoryStore.getState().reset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useKeyboardShortcuts — play/pause/frame step', () => {
  it('K: pauses video when playing', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 60, videoWidth: 1280, videoHeight: 720 })
    usePlaybackStore.getState().setPlaying(true)
    const ref = makeVideoRef()
    renderHook(() => useKeyboardShortcuts(ref))

    fireKey('k')

    expect((ref.current as HTMLVideoElement).pause).toHaveBeenCalled()
  })

  it('K: plays video when paused', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 60, videoWidth: 1280, videoHeight: 720 })
    usePlaybackStore.getState().setPlaying(false)
    const ref = makeVideoRef()
    renderHook(() => useKeyboardShortcuts(ref))

    fireKey('k')

    expect((ref.current as HTMLVideoElement).play).toHaveBeenCalled()
  })

  it('L: calls play() and sets playbackRate to 1', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 60, videoWidth: 1280, videoHeight: 720 })
    const ref = makeVideoRef()
    renderHook(() => useKeyboardShortcuts(ref))

    fireKey('l')

    expect((ref.current as HTMLVideoElement).play).toHaveBeenCalled()
    expect(usePlaybackStore.getState().playbackRate).toBe(1)
  })

  it('J: pauses and steps currentTime back by 1/30', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 60, videoWidth: 1280, videoHeight: 720 })
    const video = { currentTime: 5, playbackRate: 1, pause: vi.fn(), play: vi.fn().mockResolvedValue(undefined) } as unknown as HTMLVideoElement
    const ref = { current: video }
    renderHook(() => useKeyboardShortcuts(ref))

    fireKey('j')

    expect(video.pause).toHaveBeenCalled()
    expect(video.currentTime).toBeCloseTo(5 - 1 / 30)
    expect(usePlaybackStore.getState().currentTime).toBeCloseTo(5 - 1 / 30)
  })

  it('ArrowLeft: same behavior as J', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 60, videoWidth: 1280, videoHeight: 720 })
    const video = { currentTime: 5, playbackRate: 1, pause: vi.fn(), play: vi.fn().mockResolvedValue(undefined) } as unknown as HTMLVideoElement
    const ref = { current: video }
    renderHook(() => useKeyboardShortcuts(ref))

    fireKey('ArrowLeft')

    expect(video.pause).toHaveBeenCalled()
    expect(video.currentTime).toBeCloseTo(5 - 1 / 30)
  })

  it('ArrowRight: pauses and steps currentTime forward by 1/30', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 60, videoWidth: 1280, videoHeight: 720 })
    const video = { currentTime: 5, playbackRate: 1, pause: vi.fn(), play: vi.fn().mockResolvedValue(undefined) } as unknown as HTMLVideoElement
    const ref = { current: video }
    renderHook(() => useKeyboardShortcuts(ref))

    fireKey('ArrowRight')

    expect(video.pause).toHaveBeenCalled()
    expect(video.currentTime).toBeCloseTo(5 + 1 / 30)
  })

  it('J: clamps to 0 when currentTime is already 0', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 60, videoWidth: 1280, videoHeight: 720 })
    const video = { currentTime: 0, playbackRate: 1, pause: vi.fn(), play: vi.fn().mockResolvedValue(undefined) } as unknown as HTMLVideoElement
    const ref = { current: video }
    renderHook(() => useKeyboardShortcuts(ref))

    fireKey('j')

    expect(video.currentTime).toBe(0)
  })

  it('ArrowRight: clamps to duration', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 10, videoWidth: 1280, videoHeight: 720 })
    const video = { currentTime: 10, playbackRate: 1, pause: vi.fn(), play: vi.fn().mockResolvedValue(undefined) } as unknown as HTMLVideoElement
    const ref = { current: video }
    renderHook(() => useKeyboardShortcuts(ref))

    fireKey('ArrowRight')

    expect(video.currentTime).toBe(10)
  })

  it('does not fire when no video is loaded', () => {
    // hasVideo is false (store not initialized)
    const ref = makeVideoRef()
    renderHook(() => useKeyboardShortcuts(ref))

    fireKey('k')

    expect((ref.current as HTMLVideoElement).pause).not.toHaveBeenCalled()
    expect((ref.current as HTMLVideoElement).play).not.toHaveBeenCalled()
  })

  it('does not fire when videoRef.current is null', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 60, videoWidth: 1280, videoHeight: 720 })
    const ref = { current: null }
    renderHook(() => useKeyboardShortcuts(ref))

    // Should not throw
    expect(() => fireKey('k')).not.toThrow()
  })
})

describe('useKeyboardShortcuts — clip editing', () => {
  it('S: pushes history and splits clip', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 60, videoWidth: 1280, videoHeight: 720 })
    usePlaybackStore.getState().setCurrentTime(5)
    useClipsStore.getState().restoreSnapshot([makeClip('a', 0, 10)])
    const ref = makeVideoRef({ currentTime: 5 })
    renderHook(() => useKeyboardShortcuts(ref))

    fireKey('s')

    expect(useHistoryStore.getState().past).toHaveLength(1)
    expect(useClipsStore.getState().clips).toHaveLength(2)
  })

  it('S: no-op when splitDisabled (at clip boundary)', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 60, videoWidth: 1280, videoHeight: 720 })
    usePlaybackStore.getState().setCurrentTime(0.05) // within 0.1 of startTime=0
    useClipsStore.getState().restoreSnapshot([makeClip('a', 0, 10)])
    const ref = makeVideoRef()
    renderHook(() => useKeyboardShortcuts(ref))

    fireKey('s')

    expect(useHistoryStore.getState().past).toHaveLength(0)
    expect(useClipsStore.getState().clips).toHaveLength(1)
  })

  it('I: pushes history and sets trim-in', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 60, videoWidth: 1280, videoHeight: 720 })
    usePlaybackStore.getState().setCurrentTime(3)
    useClipsStore.getState().restoreSnapshot([makeClip('a', 0, 10)])
    const ref = makeVideoRef()
    renderHook(() => useKeyboardShortcuts(ref))

    fireKey('i')

    expect(useHistoryStore.getState().past).toHaveLength(1)
    expect(useClipsStore.getState().clips[0].startTime).toBe(3)
  })

  it('O: pushes history and sets trim-out', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 60, videoWidth: 1280, videoHeight: 720 })
    usePlaybackStore.getState().setCurrentTime(7)
    useClipsStore.getState().restoreSnapshot([makeClip('a', 0, 10)])
    const ref = makeVideoRef()
    renderHook(() => useKeyboardShortcuts(ref))

    fireKey('o')

    expect(useHistoryStore.getState().past).toHaveLength(1)
    expect(useClipsStore.getState().clips[0].endTime).toBe(7)
  })
})

describe('useKeyboardShortcuts — undo/redo', () => {
  it('Ctrl+Z: calls undo', () => {
    const undoSpy = vi.spyOn(useHistoryStore.getState(), 'undo')
    const ref = makeVideoRef()
    renderHook(() => useKeyboardShortcuts(ref))

    fireKey('z', { ctrlKey: true })

    expect(undoSpy).toHaveBeenCalled()
  })

  it('Ctrl+Shift+Z: calls redo', () => {
    const redoSpy = vi.spyOn(useHistoryStore.getState(), 'redo')
    const ref = makeVideoRef()
    renderHook(() => useKeyboardShortcuts(ref))

    fireKey('z', { ctrlKey: true, shiftKey: true })

    expect(redoSpy).toHaveBeenCalled()
  })

  it('Ctrl+Y: calls redo (Windows convention)', () => {
    const redoSpy = vi.spyOn(useHistoryStore.getState(), 'redo')
    const ref = makeVideoRef()
    renderHook(() => useKeyboardShortcuts(ref))

    fireKey('y', { ctrlKey: true })

    expect(redoSpy).toHaveBeenCalled()
  })

  it('Ctrl+Z: restores clipsStore to prior snapshot (integration)', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 60, videoWidth: 1280, videoHeight: 720 })
    usePlaybackStore.getState().setCurrentTime(5)
    const original = [makeClip('a', 0, 10)]
    useClipsStore.getState().restoreSnapshot(original)
    const ref = makeVideoRef()
    renderHook(() => useKeyboardShortcuts(ref))

    // Split via keyboard — pushes history then mutates
    fireKey('s')
    expect(useClipsStore.getState().clips).toHaveLength(2)

    // Undo via keyboard
    fireKey('z', { ctrlKey: true })
    expect(useClipsStore.getState().clips).toHaveLength(1)
    expect(useClipsStore.getState().clips[0].id).toBe('a')
  })
})

describe('useKeyboardShortcuts — focus guard', () => {
  it('does not fire shortcuts when a text input has focus', () => {
    usePlaybackStore.getState().setVideoMetadata({ duration: 60, videoWidth: 1280, videoHeight: 720 })
    usePlaybackStore.getState().setPlaying(true)
    const ref = makeVideoRef()
    renderHook(() => useKeyboardShortcuts(ref))

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    // Dispatch from the input so e.target is an HTMLInputElement — the guard checks this.
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }))

    expect((ref.current as HTMLVideoElement).pause).not.toHaveBeenCalled()

    document.body.removeChild(input)
  })
})

describe('useKeyboardShortcuts — cleanup', () => {
  it('removes the event listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const ref = makeVideoRef()
    const { unmount } = renderHook(() => useKeyboardShortcuts(ref))

    unmount()

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
  })
})
