import { describe, it, expect, beforeEach } from 'vitest'
import { useClipsStore } from '../clipsStore'

beforeEach(() => {
  useClipsStore.getState().reset()
})

describe('initDefaultClip', () => {
  it('creates exactly one clip with startTime=0, endTime=duration, trackId=video-0', () => {
    useClipsStore.getState().initDefaultClip(30)
    const { clips } = useClipsStore.getState()
    expect(clips).toHaveLength(1)
    expect(clips[0].startTime).toBe(0)
    expect(clips[0].endTime).toBe(30)
    expect(clips[0].trackId).toBe('video-0')
  })

  it('called twice replaces the first clip — store holds exactly one clip', () => {
    useClipsStore.getState().initDefaultClip(30)
    useClipsStore.getState().initDefaultClip(60)
    expect(useClipsStore.getState().clips).toHaveLength(1)
    expect(useClipsStore.getState().clips[0].endTime).toBe(60)
  })
})

describe('setTrimIn', () => {
  it('updates startTime for the matching clip', () => {
    useClipsStore.getState().initDefaultClip(30)
    const { id } = useClipsStore.getState().clips[0]
    useClipsStore.getState().setTrimIn(id, 5)
    expect(useClipsStore.getState().clips[0].startTime).toBe(5)
  })

  it('no-op when time would violate 100ms minimum (time >= endTime - 0.1)', () => {
    useClipsStore.getState().initDefaultClip(30)
    const { id } = useClipsStore.getState().clips[0]
    useClipsStore.getState().setTrimOut(id, 28.05)
    useClipsStore.getState().setTrimIn(id, 28)
    expect(useClipsStore.getState().clips[0].startTime).toBe(0)
  })

  it('no-op for unknown id — no crash', () => {
    useClipsStore.getState().initDefaultClip(30)
    expect(() => useClipsStore.getState().setTrimIn('nonexistent', 5)).not.toThrow()
    expect(useClipsStore.getState().clips[0].startTime).toBe(0)
  })
})

describe('setTrimOut', () => {
  it('updates endTime for the matching clip', () => {
    useClipsStore.getState().initDefaultClip(30)
    const { id } = useClipsStore.getState().clips[0]
    useClipsStore.getState().setTrimOut(id, 25)
    expect(useClipsStore.getState().clips[0].endTime).toBe(25)
  })

  it('no-op when time would violate 100ms minimum (time <= startTime + 0.1)', () => {
    useClipsStore.getState().initDefaultClip(30)
    const { id } = useClipsStore.getState().clips[0]
    useClipsStore.getState().setTrimIn(id, 5)
    useClipsStore.getState().setTrimOut(id, 5.05)
    expect(useClipsStore.getState().clips[0].endTime).toBe(30)
  })

  it('no-op for unknown id — no crash', () => {
    useClipsStore.getState().initDefaultClip(30)
    expect(() => useClipsStore.getState().setTrimOut('nonexistent', 25)).not.toThrow()
    expect(useClipsStore.getState().clips[0].endTime).toBe(30)
  })
})

describe('splitClip', () => {
  it('splits a clip into two with the correct time ranges and distinct IDs', () => {
    useClipsStore.getState().initDefaultClip(30)
    const { id } = useClipsStore.getState().clips[0]
    useClipsStore.getState().splitClip(id, 15)
    const { clips } = useClipsStore.getState()
    expect(clips).toHaveLength(2)
    const first = clips.find((c) => c.startTime === 0)
    const second = clips.find((c) => c.startTime === 15)
    expect(first?.endTime).toBe(15)
    expect(second?.endTime).toBe(30)
    expect(first?.id).not.toBe(second?.id)
  })

  it('no-op when atTime is within 100ms of clip start', () => {
    useClipsStore.getState().initDefaultClip(30)
    const { id } = useClipsStore.getState().clips[0]
    useClipsStore.getState().splitClip(id, 0.05)
    expect(useClipsStore.getState().clips).toHaveLength(1)
  })

  it('no-op when atTime is within 100ms of clip end', () => {
    useClipsStore.getState().initDefaultClip(30)
    const { id } = useClipsStore.getState().clips[0]
    useClipsStore.getState().splitClip(id, 29.95)
    expect(useClipsStore.getState().clips).toHaveLength(1)
  })

  it('no-op when atTime is outside clip range', () => {
    useClipsStore.getState().initDefaultClip(30)
    const { id } = useClipsStore.getState().clips[0]
    useClipsStore.getState().splitClip(id, 99)
    expect(useClipsStore.getState().clips).toHaveLength(1)
  })

  it('no-op for unknown id — no crash', () => {
    useClipsStore.getState().initDefaultClip(30)
    expect(() => useClipsStore.getState().splitClip('nonexistent', 15)).not.toThrow()
    expect(useClipsStore.getState().clips).toHaveLength(1)
  })
})
