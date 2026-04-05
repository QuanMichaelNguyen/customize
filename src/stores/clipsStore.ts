/* 
clip segments + trim/split/default clip logic.
*/
import { create } from 'zustand'
import type { ClipSegment } from '../types/editor'

interface ClipsState {
  clips: ClipSegment[]
}

interface ClipsActions {
  addClip: (clip: ClipSegment) => void
  removeClip: (id: string) => void
  initDefaultClip: (duration: number) => void
  setTrimIn: (id: string, time: number) => void
  setTrimOut: (id: string, time: number) => void
  splitClip: (id: string, atTime: number) => void
  reset: () => void
}

export const useClipsStore = create<ClipsState & ClipsActions>()((set, get) => ({
  clips: [],

  addClip: (clip) =>
    set((state) => ({ clips: [...state.clips, clip] })),

  removeClip: (id) =>
    set((state) => ({ clips: state.clips.filter((c) => c.id !== id) })),

  reset: () => set({ clips: [] }),

  initDefaultClip: (duration) =>
    set({
      clips: [{
        id: crypto.randomUUID(),
        startTime: 0,
        endTime: duration,
        trackId: 'video-0',
      }],
    }),

  setTrimIn: (id, time) =>
    set((state) => ({
      clips: state.clips.map((clip) => {
        if (clip.id !== id) return clip
        if (time >= clip.endTime - 0.1) return clip
        return { ...clip, startTime: time }
      }),
    })),

  setTrimOut: (id, time) =>
    set((state) => ({
      clips: state.clips.map((clip) => {
        if (clip.id !== id) return clip
        if (time <= clip.startTime + 0.1) return clip
        return { ...clip, endTime: time }
      }),
    })),

  splitClip: (id, atTime) => {
    const clip = get().clips.find((c) => c.id === id)
    if (!clip) return
    if (atTime <= clip.startTime + 0.1) return
    if (atTime >= clip.endTime - 0.1) return
    set((state) => ({
      clips: [
        ...state.clips.filter((c) => c.id !== id),
        { id: crypto.randomUUID(), startTime: clip.startTime, endTime: atTime, trackId: clip.trackId },
        { id: crypto.randomUUID(), startTime: atTime, endTime: clip.endTime, trackId: clip.trackId },
      ],
    }))
  },
}))
