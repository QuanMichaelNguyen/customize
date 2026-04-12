/*
Track metadata (id, type, label, mute/volume).
*/

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Track } from '../types/editor'

interface TracksState {
  tracks: Track[]
}

interface TracksActions {
  addTrack: (track: Track) => void
  setMuted: (id: string, muted: boolean) => void
  setVolume: (id: string, volume: number) => void
  reset: () => void
}

const initialState: TracksState = {
  tracks: [],
}

export const useTracksStore = create<TracksState & TracksActions>()(
  persist(
    (set) => ({
      ...initialState,

      // Replace track if id already exists, otherwise append
      addTrack: (track) =>
        set((state) => {
          const exists = state.tracks.some((t) => t.id === track.id)
          if (exists) {
            return { tracks: state.tracks.map((t) => (t.id === track.id ? track : t)) }
          }
          return { tracks: [...state.tracks, track] }
        }),

      setMuted: (id, muted) =>
        set((state) => ({
          tracks: state.tracks.map((t) => (t.id === id ? { ...t, muted } : t)),
        })),

      setVolume: (id, volume) => {
        const clamped = Math.max(0, Math.min(1, volume))
        set((state) => ({
          tracks: state.tracks.map((t) => (t.id === id ? { ...t, volume: clamped } : t)),
        }))
      },

      reset: () => set({ ...initialState }),
    }),
    { name: 'tracks-storage' },
  ),
)
