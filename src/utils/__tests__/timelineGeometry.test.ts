import { describe, it, expect } from 'vitest'
import { pixelToTime, timeToPixel } from '../timelineGeometry'

describe('pixelToTime', () => {
  it('returns midpoint time for midpoint x', () => {
    expect(pixelToTime(100, 10, 200)).toBe(5)
  })

  it('returns 0 for x=0', () => {
    expect(pixelToTime(0, 10, 200)).toBe(0)
  })

  it('returns duration for x=canvasWidth', () => {
    expect(pixelToTime(200, 10, 200)).toBe(10)
  })

  it('clamps negative x to 0', () => {
    expect(pixelToTime(-20, 10, 200)).toBe(0)
  })

  it('clamps x beyond canvas width to duration', () => {
    expect(pixelToTime(300, 10, 200)).toBe(10)
  })

  it('returns 0 when duration is 0 (no divide-by-zero)', () => {
    expect(pixelToTime(100, 0, 200)).toBe(0)
  })

  it('returns 0 when canvasWidth is 0 (no divide-by-zero)', () => {
    expect(pixelToTime(100, 10, 0)).toBe(0)
  })
})

describe('timeToPixel', () => {
  it('returns midpoint pixel for midpoint time', () => {
    expect(timeToPixel(5, 10, 200)).toBe(100)
  })

  it('returns 0 for time=0', () => {
    expect(timeToPixel(0, 10, 200)).toBe(0)
  })

  it('returns canvasWidth for time=duration', () => {
    expect(timeToPixel(10, 10, 200)).toBe(200)
  })

  it('returns 0 when duration is 0 (no divide-by-zero)', () => {
    expect(timeToPixel(5, 0, 200)).toBe(0)
  })
})
