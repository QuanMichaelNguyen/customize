/* 
Crop region/aspect preset/overlay visibility state.
*/
import { create } from 'zustand'
import type { CropRegion, AspectRatioPreset } from '../types/editor'

const RATIO_MAP: Record<Exclude<AspectRatioPreset, 'free'>, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
}

function applyAspectRatio(region: CropRegion, preset: AspectRatioPreset): CropRegion {
  if (preset === 'free') return region
  const ratio = RATIO_MAP[preset]
  const { x, y } = region
  let { width } = region
  let height = width / ratio
  if (y + height > 1) {
    height = 1 - y
    width = height * ratio
  }
  return { x, y, width, height }
}

interface CropState {
  cropRegion: CropRegion | null
  aspectRatio: AspectRatioPreset
  isCropOverlayOpen: boolean
}

interface CropActions {
  setCropRegion: (region: CropRegion) => void
  setAspectRatio: (preset: AspectRatioPreset) => void
  clearCrop: () => void
  toggleCropOverlay: () => void
  reset: () => void
}

const initialState: CropState = {
  cropRegion: null,
  aspectRatio: 'free',
  isCropOverlayOpen: false,
}

const DEFAULT_REGION: CropRegion = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }

export const useCropStore = create<CropState & CropActions>()((set, get) => ({
  ...initialState,

  setCropRegion: (region) => set({ cropRegion: region }),

  setAspectRatio: (preset) => {
    const base = get().cropRegion ?? DEFAULT_REGION
    const newRegion = applyAspectRatio(base, preset)
    set({ aspectRatio: preset, cropRegion: newRegion })
  },

  clearCrop: () => set({ cropRegion: null, aspectRatio: 'free' }),

  toggleCropOverlay: () =>
    set((state) => ({ isCropOverlayOpen: !state.isCropOverlayOpen })),

  reset: () => set({ ...initialState }),
}))
