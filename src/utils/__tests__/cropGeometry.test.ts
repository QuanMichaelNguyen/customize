import { describe, it, expect } from 'vitest'
import { getVideoDisplayRect } from '../cropGeometry'

describe('getVideoDisplayRect', () => {
  it('fills the container when aspect ratios match (16:9 video in 16:9 container)', () => {
    const rect = getVideoDisplayRect(800, 450, 1920, 1080)
    expect(rect).toEqual({ left: 0, top: 0, width: 800, height: 450 })
  })

  it('letterboxes a 16:9 video in a 4:3 container (bars top and bottom)', () => {
    // Container 800×600, video 1920×1080 (16:9)
    // displayWidth=800, displayHeight=800/(16/9)=450, top=(600-450)/2=75
    const rect = getVideoDisplayRect(800, 600, 1920, 1080)
    expect(rect.left).toBe(0)
    expect(rect.top).toBe(75)
    expect(rect.width).toBe(800)
    expect(rect.height).toBe(450)
  })

  it('pillarboxes a 9:16 portrait video in a wider container (bars left and right)', () => {
    // Container 600×800, video 1080×1920 (9:16)
    // videoRatio = 1080/1920 = 9/16 < containerRatio = 600/800 = 3/4
    // pillarbox: displayHeight=800, displayWidth=800*(9/16)=450, left=(600-450)/2=75
    const rect = getVideoDisplayRect(600, 800, 1080, 1920)
    expect(rect.top).toBe(0)
    expect(rect.height).toBe(800)
    expect(rect.left).toBeCloseTo(75)
    expect(rect.width).toBeCloseTo(450)
  })

  it('returns zero rect when videoWidth is 0', () => {
    expect(getVideoDisplayRect(800, 450, 0, 1080)).toEqual({ left: 0, top: 0, width: 0, height: 0 })
  })

  it('returns zero rect when videoHeight is 0', () => {
    expect(getVideoDisplayRect(800, 450, 1920, 0)).toEqual({ left: 0, top: 0, width: 0, height: 0 })
  })
})
