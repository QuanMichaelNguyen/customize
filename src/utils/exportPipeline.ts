/*
Pure utility functions for building ffmpeg.wasm arguments from editor state.
No React, no Zustand — all inputs passed explicitly for testability.
*/
import type { ClipSegment, CropRegion, TextOverlay, Track } from '../types/editor'

const FONT_MEMFS_PATH = 'Roboto-Regular.ttf'

// ---------------------------------------------------------------------------
// Text escaping for ffmpeg drawtext filter
// ---------------------------------------------------------------------------

/**
 * Escapes a string for use in the ffmpeg drawtext `text=` option.
 * Order matters: backslash must be escaped first.
 */
export function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\') // backslash → \\
    .replace(/'/g, "\\'")   // single quote → \'
    .replace(/:/g, '\\:')   // colon → \: (ffmpeg option separator)
}

// ---------------------------------------------------------------------------
// Color conversion: CSS → ffmpeg-compatible
// ---------------------------------------------------------------------------

/**
 * Converts a CSS color string to an ffmpeg-compatible color string.
 * Handles: named colors, #rrggbb hex, rgb(), rgba().
 */
function cssColorToFFmpeg(cssColor: string): string {
  // Named colors (white, black…) and hex (#rrggbb) pass through directly
  if (/^[a-zA-Z]+$/.test(cssColor) || /^#[0-9a-fA-F]{3,8}$/.test(cssColor)) {
    return cssColor
  }
  // rgba(r, g, b, a) or rgb(r, g, b)
  const m = cssColor.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/,
  )
  if (m) {
    const r = parseInt(m[1]).toString(16).padStart(2, '0')
    const g = parseInt(m[2]).toString(16).padStart(2, '0')
    const b = parseInt(m[3]).toString(16).padStart(2, '0')
    const a = m[4] !== undefined ? parseFloat(m[4]) : 1
    return a < 1 ? `#${r}${g}${b}@${a.toFixed(2)}` : `#${r}${g}${b}`
  }
  return cssColor // best-effort fallback
}

// ---------------------------------------------------------------------------
// atempo chain for playback rate (handles values outside [0.5, 2.0])
// ---------------------------------------------------------------------------

/**
 * Builds a comma-joined atempo filter chain for the given rate.
 * atempo accepts [0.5, 2.0] per instance; rates outside that range are
 * achieved by chaining: rate=4.0 → "atempo=2.0,atempo=2.0"
 */
function buildAtempoChain(rate: number): string {
  const filters: string[] = []
  let remaining = rate

  while (remaining > 2.0 + 1e-9) {
    filters.push('atempo=2.0')
    remaining /= 2.0
  }
  while (remaining < 0.5 - 1e-9) {
    filters.push('atempo=0.5')
    remaining *= 2.0
  }
  filters.push(`atempo=${remaining.toFixed(6)}`)
  return filters.join(',')
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

/**
 * Returns an error message if export inputs are invalid, or null if valid.
 * Always call before touching ffmpeg.
 */
export function validateExportInputs(
  file: File | null,
  clips: ClipSegment[],
): string | null {
  if (!file) {
    return 'No video file loaded.'
  }
  if (file.size > 500 * 1024 * 1024) {
    return 'File is too large to export (500 MB limit). Try a shorter clip.'
  }
  if (clips.length === 0) {
    return 'No clip segments to export.'
  }
  for (const clip of clips) {
    if (clip.endTime - clip.startTime <= 0.1) {
      return 'One or more clip segments are too short (minimum 100 ms). Trim or remove before exporting.'
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// filter_complex construction
// ---------------------------------------------------------------------------

export interface FilterComplexResult {
  /** null → use fast path (-c copy trim); non-null → use filter_complex */
  filterComplex: string | null
  /** flat -map args e.g. ['-map', '[vfinal]', '-map', '[afinal]'] */
  mapArgs: string[]
  /** codec args e.g. ['-c:v', 'libx264', '-preset', 'ultrafast', …] */
  codecArgs: string[]
  /** fast-path only: [startTime, endTime] seconds for -ss/-to */
  fastPathTrim: [number, number] | null
}

/**
 * Builds ffmpeg filter_complex and supporting exec args from editor state.
 *
 * Fast path applies when ALL of the following are true:
 *   - exactly 1 clip
 *   - no crop region
 *   - no non-empty text overlays
 *   - playback rate = 1.0
 *   - no audio, OR audio is unmuted with volume = 1.0
 * Fast path uses -c copy (no re-encode).
 *
 * Normalised crop/overlay positions (0–1) are converted to pixels using
 * videoWidth/videoHeight (original source dimensions from playbackStore).
 */
export function buildFilterComplex(
  clips: ClipSegment[],
  cropRegion: CropRegion | null,
  videoWidth: number,
  videoHeight: number,
  overlays: TextOverlay[],
  audioTrack: Track | null,
  hasAudio: boolean,
  playbackRate: number,
): FilterComplexResult {
  // Skip overlays with empty content — ffmpeg rejects text=''
  const validOverlays = overlays.filter((o) => o.content.trim().length > 0)

  const audioOk = !hasAudio || (audioTrack !== null && !audioTrack.muted && Math.abs(audioTrack.volume - 1.0) < 1e-9)
  const isFastPath =
    clips.length === 1 &&
    !cropRegion &&
    validOverlays.length === 0 &&
    Math.abs(playbackRate - 1.0) < 1e-9 &&
    audioOk

  if (isFastPath) {
    return {
      filterComplex: null,
      mapArgs: [],
      codecArgs: ['-c', 'copy'],
      fastPathTrim: [clips[0].startTime, clips[0].endTime],
    }
  }

  const parts: string[] = []

  // Sort clips by startTime for consistent output ordering
  const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime)

  // --- Step 1: Trim each clip from the single input ---
  for (let i = 0; i < sortedClips.length; i++) {
    const { startTime, endTime } = sortedClips[i]
    parts.push(`[0:v]trim=start=${startTime}:end=${endTime},setpts=PTS-STARTPTS[v${i}]`)
    if (hasAudio) {
      parts.push(`[0:a]atrim=start=${startTime}:end=${endTime},asetpts=PTS-STARTPTS[a${i}]`)
    }
  }

  // --- Step 2: Concat (or alias for single clip) ---
  let vLabel: string
  let aLabel: string

  if (sortedClips.length === 1) {
    vLabel = '[v0]'
    aLabel = hasAudio ? '[a0]' : ''
  } else {
    const n = sortedClips.length
    const vIn = Array.from({ length: n }, (_, i) => `[v${i}]`).join('')
    parts.push(`${vIn}concat=n=${n}:v=1:a=0[vcat]`)
    vLabel = '[vcat]'

    if (hasAudio) {
      const aIn = Array.from({ length: n }, (_, i) => `[a${i}]`).join('')
      parts.push(`${aIn}concat=n=${n}:v=0:a=1[acat]`)
      aLabel = '[acat]'
    } else {
      aLabel = ''
    }
  }

  // --- Step 3: Crop ---
  if (cropRegion) {
    const w = Math.round(cropRegion.width * videoWidth)
    const h = Math.round(cropRegion.height * videoHeight)
    const x = Math.round(cropRegion.x * videoWidth)
    const y = Math.round(cropRegion.y * videoHeight)
    parts.push(`${vLabel}crop=${w}:${h}:${x}:${y}[vcrop]`)
    vLabel = '[vcrop]'
  }

  // --- Step 4: Playback rate ---
  if (Math.abs(playbackRate - 1.0) >= 1e-9) {
    parts.push(`${vLabel}setpts=${(1 / playbackRate).toFixed(6)}*PTS[vrate]`)
    vLabel = '[vrate]'

    if (hasAudio && aLabel) {
      const atempoChain = buildAtempoChain(playbackRate)
      parts.push(`${aLabel}${atempoChain}[arate]`)
      aLabel = '[arate]'
    }
  }

  // --- Step 5: Text overlays ---
  // Output pixel dimensions after crop (for normalised position conversion)
  const outW = cropRegion ? Math.round(cropRegion.width * videoWidth) : videoWidth
  const outH = cropRegion ? Math.round(cropRegion.height * videoHeight) : videoHeight

  if (validOverlays.length > 0) {
    // Multiple drawtext filters are chained with commas on the same pad
    const drawtextChain = validOverlays
      .map((o) => {
        const px = Math.round(o.x * outW)
        const py = Math.round(o.y * outH)
        // Commas inside between() must be escaped as \, in filter_complex context
        return [
          `drawtext=fontfile=${FONT_MEMFS_PATH}`,
          `text='${escapeDrawtext(o.content)}'`,
          `x=${px}`,
          `y=${py}`,
          `fontsize=${o.fontSize}`,
          `fontcolor=${cssColorToFFmpeg(o.color)}`,
          `box=1`,
          `boxcolor=${cssColorToFFmpeg(o.background)}`,
          `enable='between(t\\,${o.startTime}\\,${o.endTime})'`,
        ].join(':')
      })
      .join(',')

    parts.push(`${vLabel}${drawtextChain}[vfinal]`)
    vLabel = '[vfinal]'
  }

  // --- Step 6: Audio volume/mute ---
  const audioFinalLabel = hasAudio && aLabel ? '[afinal]' : ''
  if (hasAudio && aLabel) {
    const vol = audioTrack?.muted ? 0 : (audioTrack?.volume ?? 1)
    parts.push(`${aLabel}volume=${vol}[afinal]`)
  }

  const filterComplex = parts.join(';')

  // Build -map args using the final video label and audio label (if present)
  const mapArgs: string[] = ['-map', vLabel]
  if (audioFinalLabel) {
    mapArgs.push('-map', audioFinalLabel)
  }

  const codecArgs = [
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '23',
    ...(audioFinalLabel ? ['-c:a', 'aac', '-b:a', '128k'] : []),
    '-movflags', '+faststart',
  ]

  return { filterComplex, mapArgs, codecArgs, fastPathTrim: null }
}
