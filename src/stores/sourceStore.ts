/*
Stores the source File object loaded by the user.
Needed by the export pipeline to pass the original file to ffmpeg.wasm.

DO NOT include this store in any Zustand persist middleware —
File objects are not serializable and cannot be persisted.
*/
import { create } from 'zustand'

interface SourceState {
  file: File | null
}

interface SourceActions {
  setFile: (file: File) => void
  reset: () => void
}

const initialState: SourceState = {
  file: null,
}

export const useSourceStore = create<SourceState & SourceActions>()(
  (set) => ({
    ...initialState,

    setFile: (file) => set({ file }),

    reset: () => set({ ...initialState }),
  }),
)
