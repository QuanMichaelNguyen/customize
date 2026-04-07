import { describe, it, expect, beforeEach } from 'vitest'
import { usePlaybackStore } from '../playbackStore'

beforeEach(() => {
  usePlaybackStore.getState().reset()
})

describe('usePlaybackStore', () => {
  describe('setCurrentTime', () => {
    it('updates currentTime', () => {
      usePlaybackStore.getState().setVideoMetadata({ duration: 120, videoWidth: 1920, videoHeight: 1080 })
      usePlaybackStore.getState().setCurrentTime(30)
      expect(usePlaybackStore.getState().currentTime).toBe(30)
    })

    it('clamps negative values to 0', () => {
      usePlaybackStore.getState().setVideoMetadata({ duration: 120, videoWidth: 1920, videoHeight: 1080 })
      usePlaybackStore.getState().setCurrentTime(-1)
      expect(usePlaybackStore.getState().currentTime).toBe(0)
    })

    it('clamps values above duration to duration', () => {
      usePlaybackStore.getState().setVideoMetadata({ duration: 120, videoWidth: 1920, videoHeight: 1080 })
      usePlaybackStore.getState().setCurrentTime(200)
      expect(usePlaybackStore.getState().currentTime).toBe(120)
    })

    it('clamps to 0 when duration is 0', () => {
      usePlaybackStore.getState().setCurrentTime(50)
      expect(usePlaybackStore.getState().currentTime).toBe(0)
    })
  })

  describe('setVideoMetadata', () => {
    it('atomically updates duration, dimensions, and sets hasVideo = true', () => {
      usePlaybackStore.getState().setVideoMetadata({ duration: 120, videoWidth: 1920, videoHeight: 1080 })
      const state = usePlaybackStore.getState()
      expect(state.duration).toBe(120)
      expect(state.videoWidth).toBe(1920)
      expect(state.videoHeight).toBe(1080)
      expect(state.hasVideo).toBe(true)
    })

    it('resets isPlaying to false when loading a new video while playing', () => {
      usePlaybackStore.getState().setVideoMetadata({ duration: 120, videoWidth: 1920, videoHeight: 1080 })
      usePlaybackStore.getState().setPlaying(true)
      usePlaybackStore.getState().setVideoMetadata({ duration: 60, videoWidth: 1280, videoHeight: 720 })
      expect(usePlaybackStore.getState().isPlaying).toBe(false)
    })

    it('resets currentTime to 0 on new video load', () => {
      usePlaybackStore.getState().setVideoMetadata({ duration: 120, videoWidth: 1920, videoHeight: 1080 })
      usePlaybackStore.getState().setCurrentTime(30)
      usePlaybackStore.getState().setVideoMetadata({ duration: 60, videoWidth: 1280, videoHeight: 720 })
      expect(usePlaybackStore.getState().currentTime).toBe(0)
    })
  })

  describe('setPlaying', () => {
    it('updates isPlaying', () => {
      usePlaybackStore.getState().setPlaying(true)
      expect(usePlaybackStore.getState().isPlaying).toBe(true)
      usePlaybackStore.getState().setPlaying(false)
      expect(usePlaybackStore.getState().isPlaying).toBe(false)
    })
  })

  describe('reset', () => {
    it('restores all fields to initial values', () => {
      usePlaybackStore.getState().setVideoMetadata({ duration: 120, videoWidth: 1920, videoHeight: 1080 })
      usePlaybackStore.getState().setCurrentTime(30)
      usePlaybackStore.getState().setPlaying(true)
      usePlaybackStore.getState().setPlaybackRate(2)
      usePlaybackStore.getState().reset()
      const state = usePlaybackStore.getState()
      expect(state.currentTime).toBe(0)
      expect(state.duration).toBe(0)
      expect(state.isPlaying).toBe(false)
      expect(state.playbackRate).toBe(1)
      expect(state.videoWidth).toBe(0)
      expect(state.videoHeight).toBe(0)
      expect(state.hasVideo).toBe(false)
    })
  })
})

describe('setPlaybackRate', () => {
  beforeEach(() => {
    usePlaybackStore.getState().reset()
  })

  it('sets playbackRate', () => {
    usePlaybackStore.getState().setPlaybackRate(2)
    expect(usePlaybackStore.getState().playbackRate).toBe(2)
  })

  it('clamps to minimum 0.1', () => {
    usePlaybackStore.getState().setPlaybackRate(0)
    expect(usePlaybackStore.getState().playbackRate).toBe(0.1)
  })

  it('clamps to maximum 16', () => {
    usePlaybackStore.getState().setPlaybackRate(32)
    expect(usePlaybackStore.getState().playbackRate).toBe(16)
  })

  it('reset() restores playbackRate to 1', () => {
    usePlaybackStore.getState().setPlaybackRate(4)
    usePlaybackStore.getState().reset()
    expect(usePlaybackStore.getState().playbackRate).toBe(1)
  })
})
