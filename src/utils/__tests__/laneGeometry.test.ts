import { describe, it, expect } from 'vitest'
import {
  getRowBands,
  VIDEO_ROW_HEIGHT,
  AUDIO_ROW_HEIGHT,
  TIMELINE_HEIGHT,
  LABEL_WIDTH,
} from '../laneGeometry'

describe('laneGeometry constants', () => {
  it('TIMELINE_HEIGHT equals VIDEO_ROW_HEIGHT + AUDIO_ROW_HEIGHT', () => {
    expect(TIMELINE_HEIGHT).toBe(VIDEO_ROW_HEIGHT + AUDIO_ROW_HEIGHT)
  })

  it('LABEL_WIDTH is a positive number', () => {
    expect(LABEL_WIDTH).toBeGreaterThan(0)
  })
})

describe('getRowBands', () => {
  it('video row starts at y=0', () => {
    const { videoY } = getRowBands(TIMELINE_HEIGHT)
    expect(videoY).toBe(0)
  })

  it('audio row starts at VIDEO_ROW_HEIGHT', () => {
    const { audioY } = getRowBands(TIMELINE_HEIGHT)
    expect(audioY).toBe(VIDEO_ROW_HEIGHT)
  })

  it('audio row y is within canvas height', () => {
    const { audioY } = getRowBands(TIMELINE_HEIGHT)
    expect(audioY + AUDIO_ROW_HEIGHT).toBeLessThanOrEqual(TIMELINE_HEIGHT)
  })
})
