/*
Undo/redo history for clip mutations (split, trim-in, trim-out).
Snapshots are ClipSegment[] arrays captured before each mutation.

Undo/redo restores via clipsStore.restoreSnapshot — not raw setState —
so the change goes through the store's action surface.

Out of scope: overlays, crop, audio track changes.
*/
import { create } from 'zustand'
import type { ClipSegment } from '../types/editor'
import { useClipsStore } from './clipsStore'

interface HistoryState {
  past: ClipSegment[][]
  future: ClipSegment[][]
}

interface HistoryActions {
  // Push a snapshot of clips onto the past stack and clear the future stack.
  // Call this BEFORE the mutating clip action.
  push: (clips: ClipSegment[]) => void
  undo: () => void
  redo: () => void
  clear: () => void
  reset: () => void
}

const initialState: HistoryState = {
  past: [],
  future: [],
}

export const useHistoryStore = create<HistoryState & HistoryActions>()(
  (set, get) => ({
    ...initialState,

    push: (clips) =>
      set((state) => ({
        past: [...state.past, clips],
        future: [],
      })),

    undo: () => {
      const { past, future } = get()
      if (past.length === 0) return
      const snapshot = past[past.length - 1]
      const current = useClipsStore.getState().clips
      useClipsStore.getState().restoreSnapshot(snapshot)
      set({
        past: past.slice(0, -1),
        future: [current, ...future],
      })
    },

    redo: () => {
      const { past, future } = get()
      if (future.length === 0) return
      const snapshot = future[0]
      const current = useClipsStore.getState().clips
      useClipsStore.getState().restoreSnapshot(snapshot)
      set({
        past: [...past, current],
        future: future.slice(1),
      })
    },

    clear: () => set({ ...initialState }),

    reset: () => set({ ...initialState }),
  }),
)
