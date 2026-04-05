/*
Text overlay CRUD + selected overlay state.
*/
import { create } from 'zustand'
import type { TextOverlay } from '../types/editor'

interface OverlaysState {
  overlays: TextOverlay[]
  selectedOverlayId: string | null
}

interface OverlaysActions {
  addOverlay: (overlay: TextOverlay) => void
  removeOverlay: (id: string) => void
  updateOverlay: (id: string, partial: Partial<Omit<TextOverlay, 'id'>>) => void
  setSelectedOverlay: (id: string | null) => void
  reset: () => void
}

const initialState: OverlaysState = {
  overlays: [],
  selectedOverlayId: null,
}

export const useOverlaysStore = create<OverlaysState & OverlaysActions>()((set) => ({
  ...initialState,

  addOverlay: (overlay) =>
    set((state) => ({ overlays: [...state.overlays, overlay] })),

  removeOverlay: (id) =>
    set((state) => ({
      overlays: state.overlays.filter((o) => o.id !== id),
      selectedOverlayId: state.selectedOverlayId === id ? null : state.selectedOverlayId,
    })),

  updateOverlay: (id, partial) =>
    set((state) => ({
      overlays: state.overlays.map((o) =>
        o.id === id ? { ...o, ...partial } : o
      ),
    })),

  setSelectedOverlay: (id) => set({ selectedOverlayId: id }),

  reset: () => set({ ...initialState }),
}))
