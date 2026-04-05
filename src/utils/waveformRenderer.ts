import type { WaveformData } from '../types/editor'

/**
 * Builds an offscreen HTMLCanvasElement pre-drawn with the waveform peak/min bars.
 *
 * This canvas is built once (and rebuilt only when dimensions change) then blitted
 * into the main timeline canvas with a single ctx.drawImage call per RAF frame.
 *
 * Rules:
 * - Uses ctx.setTransform for DPR scaling (never ctx.scale, which compounds on resize).
 * - Column alignment: x + 0.5 for crisp 1px vertical lines at any pixel density.
 * - Center-mirrored: peak goes above center, min goes below.
 */
export function buildWaveformCache(
  waveformData: WaveformData,
  width: number,
  height: number,
  dpr: number,
): HTMLCanvasElement {
  const offscreen = document.createElement('canvas')
  offscreen.width = Math.round(width * dpr)
  offscreen.height = Math.round(height * dpr)

  const ctx = offscreen.getContext('2d')
  if (!ctx) return offscreen

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const { peaks, mins, length } = waveformData
  if (length === 0 || width === 0) return offscreen

  const mid = height / 2
  const amp = mid * 0.9 // 10% padding top and bottom

  ctx.strokeStyle = '#818cf8' // indigo-400
  ctx.lineWidth = 1

  for (let x = 0; x < width; x++) {
    // Map canvas column to waveform data index — safe even when width > length
    const idx = Math.min(Math.floor((x / width) * length), length - 1)
    const peakY = mid - peaks[idx] * amp
    const minY = mid - mins[idx] * amp // mins are negative, so this is below center

    ctx.beginPath()
    ctx.moveTo(x + 0.5, peakY)
    ctx.lineTo(x + 0.5, minY)
    ctx.stroke()
  }

  return offscreen
}
