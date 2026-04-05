import { describe, it, expect } from 'vitest'
import { pixelToTime, timeToPixel } from '../timelineGeometry'

describe('pixelToTime', () => {
  describe('without labelWidth (backwards-compatible default)', () => {
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

  describe('with labelWidth offset', () => {
    it('returns midpoint time for midpoint x in the track area', () => {
      // canvas=200, label=96 → track width=104; midpoint at x=96+52=148
      expect(pixelToTime(148, 10, 200, 96)).toBeCloseTo(5)
    })

    it('returns 0 when x equals labelWidth (start of track area)', () => {
      expect(pixelToTime(96, 10, 200, 96)).toBe(0)
    })

    it('returns duration when x equals canvasWidth', () => {
      expect(pixelToTime(200, 10, 200, 96)).toBe(10)
    })

    it('clamps x inside label column (offsetX < labelWidth) to 0', () => {
      expect(pixelToTime(50, 10, 200, 96)).toBe(0)
    })

    it('returns 0 when trackWidth is 0 (labelWidth equals canvasWidth)', () => {
      expect(pixelToTime(100, 10, 96, 96)).toBe(0)
    })
  })
})

describe('timeToPixel', () => {
  describe('without labelWidth (backwards-compatible default)', () => {
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

  describe('with labelWidth offset', () => {
    it('returns labelWidth for time=0 (start of track area)', () => {
      expect(timeToPixel(0, 10, 200, 96)).toBe(96)
    })

    it('returns canvasWidth for time=duration', () => {
      expect(timeToPixel(10, 10, 200, 96)).toBe(200)
    })

    it('returns midpoint pixel offset by labelWidth', () => {
      // track width=104; midpoint = 96 + 52 = 148
      expect(timeToPixel(5, 10, 200, 96)).toBeCloseTo(148)
    })

    it('returns labelWidth when duration is 0 (no divide-by-zero)', () => {
      expect(timeToPixel(5, 0, 200, 96)).toBe(96)
    })
  })
})
