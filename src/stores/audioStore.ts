/*
Waveform extraction status + data + audio availability flags.
*/
import { create } from 'zustand'
import type { WaveformData } from '../types/editor'

type ExtractionStatus = 'idle' | 'loading' | 'ready' | 'error'

interface AudioState {
  waveformData: WaveformData | null
  extractionStatus: ExtractionStatus
  hasAudio: boolean
}

interface AudioActions {
  setLoading: () => void
  setWaveform: (data: WaveformData | null) => void
  setError: () => void
  reset: () => void
}

const initialState: AudioState = {
  waveformData: null,
  extractionStatus: 'idle',
  hasAudio: false,
}

export const useAudioStore = create<AudioState & AudioActions>()(
  (set) => ({
    ...initialState,

    setLoading: () => set({ extractionStatus: 'loading' }),

    setWaveform: (data) =>
      set({
        waveformData: data,
        hasAudio: data !== null,
        extractionStatus: 'ready',
      }),

    setError: () => set({ extractionStatus: 'error', hasAudio: false }),

    reset: () => set({ ...initialState }),
  }),
)
