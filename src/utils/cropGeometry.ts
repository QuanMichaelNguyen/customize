export interface VideoDisplayRect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Computes the displayed video rectangle within a container, accounting for
 * object-fit: contain letterboxing/pillarboxing.
 * Returns coordinates in container-relative CSS pixels.
 */
export function getVideoDisplayRect(
  containerWidth: number,
  containerHeight: number,
  videoWidth: number,
  videoHeight: number,
): VideoDisplayRect {
  if (videoWidth <= 0 || videoHeight <= 0) {
    return { left: 0, top: 0, width: 0, height: 0 }
  }

  const containerRatio = containerWidth / containerHeight
  const videoRatio = videoWidth / videoHeight

  let displayWidth: number
  let displayHeight: number

  if (videoRatio > containerRatio) {
    // Video wider than container — letterboxed (bars top/bottom)
    displayWidth = containerWidth
    displayHeight = containerWidth / videoRatio
  } else {
    // Video narrower than container — pillarboxed (bars left/right)
    displayHeight = containerHeight
    displayWidth = containerHeight * videoRatio
  }

  const left = (containerWidth - displayWidth) / 2
  const top = (containerHeight - displayHeight) / 2

  return { left, top, width: displayWidth, height: displayHeight }
}
