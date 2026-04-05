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
