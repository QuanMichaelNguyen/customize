import { describe, it, expect } from 'vitest'
import {
  VIDEO_ROW_Y,
  AUDIO_ROW_Y,
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

  it('video row starts at y=0', () => {
    expect(VIDEO_ROW_Y).toBe(0)
  })

  it('audio row starts at VIDEO_ROW_HEIGHT', () => {
    expect(AUDIO_ROW_Y).toBe(VIDEO_ROW_HEIGHT)
  })

  it('audio row fits within TIMELINE_HEIGHT', () => {
    expect(AUDIO_ROW_Y + AUDIO_ROW_HEIGHT).toBeLessThanOrEqual(TIMELINE_HEIGHT)
  })
})
