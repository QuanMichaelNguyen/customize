/**
 * Converts a canvas pixel X coordinate to a video time value.
 *
 * @param offsetX    Raw pixel X from a pointer event.
 * @param duration   Total video duration in seconds.
 * @param canvasWidth CSS width of the canvas in pixels.
 * @param labelWidth  Width of any DOM label column to the left of the canvas (default 0).
 *                   Subtract this from offsetX before computing time so the label area
 *                   is excluded from the timeline coordinate space.
 */
export function pixelToTime(
  offsetX: number,
  duration: number,
  canvasWidth: number,
  labelWidth = 0,
): number {
  const trackWidth = canvasWidth - labelWidth
  if (duration <= 0 || trackWidth <= 0) return 0
  const adjustedX = offsetX - labelWidth
  return Math.max(0, Math.min((adjustedX / trackWidth) * duration, duration))
}

/**
 * Converts a video time value to a canvas pixel X coordinate.
 *
 * @param time        Time in seconds.
 * @param duration    Total video duration in seconds.
 * @param canvasWidth CSS width of the canvas in pixels.
 * @param labelWidth  Width of any DOM label column to the left of the canvas (default 0).
 *                   The returned pixel is offset by labelWidth so it aligns with the
 *                   track area inside the canvas.
 */
export function timeToPixel(
  time: number,
  duration: number,
  canvasWidth: number,
  labelWidth = 0,
): number {
  const trackWidth = canvasWidth - labelWidth
  if (duration <= 0) return labelWidth
  return labelWidth + (time / duration) * trackWidth
}
