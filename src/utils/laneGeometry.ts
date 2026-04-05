/*
Constants for timeline row heights + band layout for video/audio rows.
*/
export const LABEL_WIDTH = 96

export const VIDEO_ROW_HEIGHT = 48

export const AUDIO_ROW_HEIGHT = 48

export const TIMELINE_HEIGHT = VIDEO_ROW_HEIGHT + AUDIO_ROW_HEIGHT

/**
 * Returns the CSS Y-origin (top edge) of each track row within the canvas.
 * The canvas height equals TIMELINE_HEIGHT; row 0 starts at y=0.
 */
export function getRowBands(_: number): { videoY: number; audioY: number } {
  return {
    videoY: 0,
    audioY: VIDEO_ROW_HEIGHT,
  }
}
