/** Width of the DOM label column to the left of the canvas (px). */
export const LABEL_WIDTH = 96

/** Height of the video track row (px). */
export const VIDEO_ROW_HEIGHT = 48

/** Height of the audio track row (px). */
export const AUDIO_ROW_HEIGHT = 48

/** Total height of the timeline strip (px). Must equal VIDEO_ROW_HEIGHT + AUDIO_ROW_HEIGHT. */
export const TIMELINE_HEIGHT = VIDEO_ROW_HEIGHT + AUDIO_ROW_HEIGHT

/**
 * Returns the CSS Y-origin (top edge) of each track row within the canvas.
 * The canvas height equals TIMELINE_HEIGHT; row 0 starts at y=0.
 */
export function getRowBands(_cssHeight: number): { videoY: number; audioY: number } {
  return {
    videoY: 0,
    audioY: VIDEO_ROW_HEIGHT,
  }
}
