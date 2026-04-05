export interface VideoMetadata {
  duration: number
  videoWidth: number
  videoHeight: number
}

export interface ClipSegment {
  id: string
  startTime: number
  endTime: number
  trackId: string
}
export interface CropRegion {
  x: number
  y: number
  width: number
  height: number
}

export type AspectRatioPreset = '16:9' | '9:16' | '1:1' | 'free'

export interface TextOverlay {
  id: string
  content: string
  startTime: number
  endTime: number
  x: number
  y: number
  fontSize: number
  color: string
  background: string
}
