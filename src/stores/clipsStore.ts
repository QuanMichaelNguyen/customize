import { create } from 'zustand'
import type { ClipSegment } from '../types/editor'

interface ClipsState {
  clips: ClipSegment[]
}

interface ClipsActions {
  addClip: (clip: ClipSegment) => void
  removeClip: (id: string) => void
}

export const useClipsStore = create<ClipsState & ClipsActions>()((set) => ({
  clips: [],

  addClip: (clip) =>
    set((state) => ({ clips: [...state.clips, clip] })),

  removeClip: (id) =>
    set((state) => ({ clips: state.clips.filter((c) => c.id !== id) })),
}))
