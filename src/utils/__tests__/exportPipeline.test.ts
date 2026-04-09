import { describe, it, expect } from 'vitest'
import {
  escapeDrawtext,
  validateExportInputs,
  buildFilterComplex,
} from '../exportPipeline'
import type { ClipSegment, CropRegion, TextOverlay, Track } from '../../types/editor'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClip(startTime: number, endTime: number, id = 'c1'): ClipSegment {
  return { id, startTime, endTime, trackId: 'video-0' }
}

function makeCrop(x = 0, y = 0, width = 1, height = 1): CropRegion {
  return { x, y, width, height }
}

function makeOverlay(
  content: string,
  startTime = 0,
  endTime = 5,
  overrides: Partial<TextOverlay> = {},
): TextOverlay {
  return {
    id: 'o1',
    content,
    startTime,
    endTime,
    x: 0.5,
    y: 0.5,
    fontSize: 24,
    color: '#ffffff',
    background: 'rgba(0,0,0,0.5)',
    ...overrides,
  }
}

function makeAudioTrack(muted = false, volume = 1): Track {
  return { id: 'audio-0', type: 'audio', label: 'Audio', muted, volume }
}

function makeFile(size = 1024): File {
  return new File([new ArrayBuffer(size)], 'test.mp4', { type: 'video/mp4' })
}

// ---------------------------------------------------------------------------
// escapeDrawtext
// ---------------------------------------------------------------------------

describe('escapeDrawtext', () => {
  it('escapes backslashes first', () => {
    expect(escapeDrawtext('a\\b')).toBe('a\\\\b')
  })

  it("escapes single quotes", () => {
    expect(escapeDrawtext("it's")).toBe("it\\'s")
  })

  it('escapes colons', () => {
    expect(escapeDrawtext('time: now')).toBe('time\\: now')
  })

  it('escapes all special characters in combination', () => {
    const result = escapeDrawtext("hello: world's \\path")
    expect(result).toBe("hello\\: world\\'s \\\\path")
  })

  it('returns plain text unchanged', () => {
    expect(escapeDrawtext('Hello World')).toBe('Hello World')
  })
})

// ---------------------------------------------------------------------------
// validateExportInputs
// ---------------------------------------------------------------------------

describe('validateExportInputs', () => {
  it('returns null for valid inputs', () => {
    expect(validateExportInputs(makeFile(), [makeClip(0, 5)])).toBeNull()
  })

  it('returns error when file is null', () => {
    expect(validateExportInputs(null, [makeClip(0, 5)])).toBeTruthy()
  })

  it('returns error when file exceeds 500 MB', () => {
    const bigFile = makeFile(501 * 1024 * 1024)
    expect(validateExportInputs(bigFile, [makeClip(0, 5)])).toBeTruthy()
  })

  it('returns error when clips array is empty', () => {
    expect(validateExportInputs(makeFile(), [])).toBeTruthy()
  })

  it('returns error when a clip has duration ≤ 100ms', () => {
    expect(validateExportInputs(makeFile(), [makeClip(0, 0.05)])).toBeTruthy()
  })

  it('returns error for exactly 100ms duration (≤ 100ms is invalid)', () => {
    expect(validateExportInputs(makeFile(), [makeClip(0, 0.1)])).toBeTruthy()
  })

  it('returns null for clips just above 100ms', () => {
    expect(validateExportInputs(makeFile(), [makeClip(0, 0.11)])).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// buildFilterComplex — fast path
// ---------------------------------------------------------------------------

describe('buildFilterComplex — fast path', () => {
  it('returns filterComplex null for 1 clip, no crop, no overlays, rate=1.0, no audio', () => {
    const result = buildFilterComplex([makeClip(0, 5)], null, 1920, 1080, [], null, false, 1.0)
    expect(result.filterComplex).toBeNull()
    expect(result.fastPathTrim).toEqual([0, 5])
    expect(result.codecArgs).toContain('copy')
  })

  it('returns filterComplex null for 1 clip, no crop, no overlays, rate=1.0, unmuted audio vol=1', () => {
    const result = buildFilterComplex(
      [makeClip(2, 10)], null, 1920, 1080, [], makeAudioTrack(false, 1), true, 1.0,
    )
    expect(result.filterComplex).toBeNull()
    expect(result.fastPathTrim).toEqual([2, 10])
  })

  it('disqualifies fast path when audio is muted', () => {
    const result = buildFilterComplex(
      [makeClip(0, 5)], null, 1920, 1080, [], makeAudioTrack(true, 1), true, 1.0,
    )
    expect(result.filterComplex).not.toBeNull()
    expect(result.fastPathTrim).toBeNull()
  })

  it('disqualifies fast path when audio volume != 1.0', () => {
    const result = buildFilterComplex(
      [makeClip(0, 5)], null, 1920, 1080, [], makeAudioTrack(false, 0.8), true, 1.0,
    )
    expect(result.filterComplex).not.toBeNull()
  })

  it('disqualifies fast path for 2 clips', () => {
    const result = buildFilterComplex(
      [makeClip(0, 5), makeClip(10, 20, 'c2')], null, 1920, 1080, [], null, false, 1.0,
    )
    expect(result.filterComplex).not.toBeNull()
  })

  it('disqualifies fast path when crop is present', () => {
    const result = buildFilterComplex(
      [makeClip(0, 5)], makeCrop(0.1, 0.1, 0.8, 0.8), 1920, 1080, [], null, false, 1.0,
    )
    expect(result.filterComplex).not.toBeNull()
  })

  it('disqualifies fast path when overlays have non-empty content', () => {
    const result = buildFilterComplex(
      [makeClip(0, 5)], null, 1920, 1080, [makeOverlay('Hello')], null, false, 1.0,
    )
    expect(result.filterComplex).not.toBeNull()
  })

  it('does NOT disqualify fast path for overlays with only empty content', () => {
    const result = buildFilterComplex(
      [makeClip(0, 5)], null, 1920, 1080, [makeOverlay('')], null, false, 1.0,
    )
    // All overlays have empty content — treated as no overlays
    expect(result.filterComplex).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// buildFilterComplex — filter_complex path
// ---------------------------------------------------------------------------

describe('buildFilterComplex — filter_complex path', () => {
  it('produces concat=n=2 for 2 clips', () => {
    const result = buildFilterComplex(
      [makeClip(0, 5), makeClip(10, 20, 'c2')], null, 1920, 1080, [], null, false, 1.0,
    )
    expect(result.filterComplex).toContain('concat=n=2')
  })

  it('produces crop filter when cropRegion is set', () => {
    const result = buildFilterComplex(
      [makeClip(0, 5)], makeCrop(0, 0, 0.5, 0.5), 1920, 1080, [], null, false, 1.0,
    )
    expect(result.filterComplex).toContain('crop=960:540:0:0')
  })

  it('produces drawtext filter with time range for a text overlay', () => {
    const result = buildFilterComplex(
      [makeClip(0, 5)], null, 1920, 1080, [makeOverlay('Hello', 1, 3)], null, false, 1.0,
    )
    expect(result.filterComplex).toContain('drawtext=')
    expect(result.filterComplex).toContain("between(t")
  })

  it('skips overlays with empty content', () => {
    const result = buildFilterComplex(
      [makeClip(0, 5)], null, 1920, 1080,
      [makeOverlay(''), makeOverlay('Visible', 0, 5, { id: 'o2' })],
      null, false, 1.0,
    )
    // Should only have one drawtext
    const matches = result.filterComplex?.match(/drawtext=/g) ?? []
    expect(matches.length).toBe(1)
  })

  it('produces volume filter for non-muted audio with volume=0.5', () => {
    const result = buildFilterComplex(
      [makeClip(0, 5)], null, 1920, 1080, [], makeAudioTrack(false, 0.5), true, 1.0,
    )
    expect(result.filterComplex).toContain('volume=0.5')
  })

  it('produces volume=0 when audio is muted', () => {
    const result = buildFilterComplex(
      [makeClip(0, 5)], null, 1920, 1080, [], makeAudioTrack(true, 1), true, 1.0,
    )
    expect(result.filterComplex).toContain('volume=0')
  })

  it('omits audio filter chain entirely when hasAudio is false', () => {
    const result = buildFilterComplex(
      [makeClip(0, 5, 'c1'), makeClip(10, 20, 'c2')],
      null, 1920, 1080, [], null, false, 1.0,
    )
    expect(result.filterComplex).not.toContain('atrim')
    expect(result.filterComplex).not.toContain('volume')
    expect(result.mapArgs).not.toContain('[afinal]')
    expect(result.codecArgs).not.toContain('aac')
  })

  it('produces setpts and atempo=2.0 for rate=2.0', () => {
    const result = buildFilterComplex(
      [makeClip(0, 5)], null, 1920, 1080, [], makeAudioTrack(), true, 2.0,
    )
    expect(result.filterComplex).toContain('setpts=')
    expect(result.filterComplex).toContain('atempo=2.0')
  })

  it('chains atempo=2.0,atempo=2.0 for rate=4.0', () => {
    const result = buildFilterComplex(
      [makeClip(0, 5)], null, 1920, 1080, [], makeAudioTrack(), true, 4.0,
    )
    expect(result.filterComplex).toContain('atempo=2.0,atempo=2.0')
  })

  it('chains atempo=0.5,atempo=0.5 for rate=0.25', () => {
    const result = buildFilterComplex(
      [makeClip(0, 5)], null, 1920, 1080, [], makeAudioTrack(), true, 0.25,
    )
    expect(result.filterComplex).toContain('atempo=0.5,atempo=0.5')
  })

  it('omits rate-adjustment filters when rate=1.0', () => {
    const result = buildFilterComplex(
      [makeClip(0, 5)], null, 1920, 1080, [], makeAudioTrack(false, 0.5), true, 1.0,
    )
    // trim step always emits setpts=PTS-STARTPTS; only the rate-adjustment step
    // emits a multiplier form (e.g. setpts=0.5*PTS) — check that is absent
    expect(result.filterComplex).not.toContain('*PTS')
    expect(result.filterComplex).not.toContain('[vrate]')
    expect(result.filterComplex).not.toContain('atempo=')
  })

  it('includes -movflags +faststart in codecArgs', () => {
    const result = buildFilterComplex(
      [makeClip(0, 5)], null, 1920, 1080, [], null, false, 2.0,
    )
    expect(result.codecArgs).toContain('+faststart')
  })

  it('maps video output label in mapArgs', () => {
    const result = buildFilterComplex(
      [makeClip(0, 5)], null, 1920, 1080, [], null, false, 2.0,
    )
    expect(result.mapArgs).toContain('-map')
  })

  it('escapes special characters in overlay text', () => {
    const result = buildFilterComplex(
      [makeClip(0, 5)], null, 1920, 1080,
      [makeOverlay("it's great: yes")], null, false, 1.0,
    )
    expect(result.filterComplex).toContain("it\\'s great\\: yes")
  })
})
