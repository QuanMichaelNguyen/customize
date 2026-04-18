/*
Playback time/duration/play state/video metadata.
*/
import { create } from 'zustand'
import type { VideoMetadata } from '../types/editor'

interface PlaybackState {
  currentTime: number
  duration: number
  isPlaying: boolean
  playbackRate: number
  videoWidth: number
  videoHeight: number
  hasVideo: boolean
  trimOffset: number
  videoDuration: number
}

interface PlaybackActions {
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setPlaying: (playing: boolean) => void
  setPlaybackRate: (rate: number) => void
  setVideoMetadata: (meta: VideoMetadata) => void
  applyTrim: (start: number, end: number) => void
  reset: () => void
}

const initialState: PlaybackState = {
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  playbackRate: 1,
  videoWidth: 0,
  videoHeight: 0,
  hasVideo: false,
  trimOffset: 0,
  videoDuration: 0,
}

export const usePlaybackStore = create<PlaybackState & PlaybackActions>()(
  (set, get) => ({
    ...initialState,

    setCurrentTime: (time) => {
      const { duration } = get()
      const clamped = Math.max(0, Math.min(time, duration > 0 ? duration : 0))
      set({ currentTime: clamped })
    },

    setDuration: (duration) => set({ duration }),

    setPlaying: (isPlaying) => set({ isPlaying }),

    setPlaybackRate: (rate) => set({ playbackRate: Math.max(0.1, Math.min(16, rate)) }),

    setVideoMetadata: ({ duration, videoWidth, videoHeight }) =>
      set({ duration, videoWidth, videoHeight, hasVideo: true, currentTime: 0, isPlaying: false, trimOffset: 0, videoDuration: duration }),

    applyTrim: (start, end) =>
      set({ trimOffset: start, duration: end - start, currentTime: 0 }),

    reset: () => set({ ...initialState }),
  }),
)
