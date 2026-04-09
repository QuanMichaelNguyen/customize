/*
Tracks the export lifecycle: status, progress, output URL, and error.
Mirrors the audioStore async-with-status pattern.
*/
import { create } from 'zustand'
import type { ExportStatus } from '../types/editor'

interface ExportState {
  status: ExportStatus
  // progress is 0–1 during encoding; clamped by setProgress
  progress: number
  outputUrl: string | null
  error: string | null
}

interface ExportActions {
  startExport: () => void
  setProgress: (ratio: number) => void
  setReady: (url: string) => void
  setError: (msg: string) => void
  resetExport: () => void
}

const initialState: ExportState = {
  status: 'idle',
  progress: 0,
  outputUrl: null,
  error: null,
}

export const useExportStore = create<ExportState & ExportActions>()(
  (set, get) => ({
    ...initialState,

    startExport: () =>
      set({ status: 'loading', progress: 0, outputUrl: null, error: null }),

    // Clamp to [0, 1] — ffmpeg.wasm can emit values slightly above 1.0 at end of encode
    setProgress: (ratio) => set({ progress: Math.min(1, Math.max(0, ratio)) }),

    setReady: (url) => set({ status: 'ready', outputUrl: url, progress: 1 }),

    setError: (msg) => set({ status: 'error', error: msg }),

    resetExport: () => {
      const { outputUrl } = get()
      if (outputUrl) {
        URL.revokeObjectURL(outputUrl)
      }
      set({ ...initialState })
    },
  }),
)
