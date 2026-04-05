/*
Playback time/duration/play state/video metadata.
*/
import { create } from 'zustand'
import type { VideoMetadata } from '../types/editor'

interface PlaybackState {
  currentTime: number
  duration: number
  isPlaying: boolean
  videoWidth: number
  videoHeight: number
  hasVideo: boolean
}

interface PlaybackActions {
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setPlaying: (playing: boolean) => void
  setVideoMetadata: (meta: VideoMetadata) => void
  reset: () => void
}

const initialState: PlaybackState = {
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  videoWidth: 0,
  videoHeight: 0,
  hasVideo: false,
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

    setVideoMetadata: ({ duration, videoWidth, videoHeight }) =>
      set({ duration, videoWidth, videoHeight, hasVideo: true, currentTime: 0, isPlaying: false }),

    reset: () => set({ ...initialState }),
  }),
)
