import { describe, it, expect, beforeEach } from 'vitest'
import { useHistoryStore } from '../historyStore'
import { useClipsStore } from '../clipsStore'
import type { ClipSegment } from '../../types/editor'

function makeClip(id: string, start: number, end: number): ClipSegment {
  return { id, startTime: start, endTime: end, trackId: 'video-0' }
}

beforeEach(() => {
  useHistoryStore.getState().reset()
  useClipsStore.getState().reset()
})

describe('push', () => {
  it('adds snapshot to past stack and clears future', () => {
    const clips = [makeClip('a', 0, 10)]
    useHistoryStore.getState().push(clips)
    expect(useHistoryStore.getState().past).toHaveLength(1)
    expect(useHistoryStore.getState().future).toHaveLength(0)
  })

  it('accumulates multiple pushes', () => {
    useHistoryStore.getState().push([makeClip('a', 0, 10)])
    useHistoryStore.getState().push([makeClip('b', 0, 20)])
    expect(useHistoryStore.getState().past).toHaveLength(2)
  })

  it('clears future stack when a new push is made after undo', () => {
    const clips = [makeClip('a', 0, 10)]
    useClipsStore.getState().restoreSnapshot(clips)
    useHistoryStore.getState().push(clips)
    useHistoryStore.getState().undo()
    expect(useHistoryStore.getState().future).toHaveLength(1)

    useHistoryStore.getState().push([makeClip('c', 0, 30)])
    expect(useHistoryStore.getState().future).toHaveLength(0)
  })
})

describe('undo', () => {
  it('restores clipsStore to the last pushed snapshot', () => {
    const snapshot = [makeClip('a', 0, 10)]
    useHistoryStore.getState().push(snapshot)
    useClipsStore.getState().restoreSnapshot([makeClip('b', 0, 5), makeClip('c', 5, 10)])

    useHistoryStore.getState().undo()

    expect(useClipsStore.getState().clips).toEqual(snapshot)
  })

  it('moves present to future after undo', () => {
    const snapshot = [makeClip('a', 0, 10)]
    useHistoryStore.getState().push(snapshot)
    useClipsStore.getState().restoreSnapshot([makeClip('b', 0, 5)])

    useHistoryStore.getState().undo()

    expect(useHistoryStore.getState().past).toHaveLength(0)
    expect(useHistoryStore.getState().future).toHaveLength(1)
  })

  it('is a no-op when past is empty', () => {
    useClipsStore.getState().restoreSnapshot([makeClip('x', 0, 10)])
    useHistoryStore.getState().undo()
    expect(useClipsStore.getState().clips).toEqual([makeClip('x', 0, 10)])
    expect(useHistoryStore.getState().past).toHaveLength(0)
  })

  it('modifies clipsStore directly (integration)', () => {
    const snapshot = [makeClip('original', 0, 10)]
    useHistoryStore.getState().push(snapshot)
    useClipsStore.getState().restoreSnapshot([makeClip('mutated', 0, 5)])

    useHistoryStore.getState().undo()

    expect(useClipsStore.getState().clips[0].id).toBe('original')
  })
})

describe('redo', () => {
  it('restores clipsStore to the first future snapshot', () => {
    const snapshot = [makeClip('a', 0, 10)]
    useHistoryStore.getState().push(snapshot)
    const afterMutation = [makeClip('b', 0, 5)]
    useClipsStore.getState().restoreSnapshot(afterMutation)

    useHistoryStore.getState().undo()
    useHistoryStore.getState().redo()

    expect(useClipsStore.getState().clips).toEqual(afterMutation)
  })

  it('moves present to past after redo', () => {
    const snapshot = [makeClip('a', 0, 10)]
    useHistoryStore.getState().push(snapshot)
    useClipsStore.getState().restoreSnapshot([makeClip('b', 0, 5)])

    useHistoryStore.getState().undo()
    useHistoryStore.getState().redo()

    expect(useHistoryStore.getState().past).toHaveLength(1)
    expect(useHistoryStore.getState().future).toHaveLength(0)
  })

  it('is a no-op when future is empty', () => {
    useClipsStore.getState().restoreSnapshot([makeClip('x', 0, 10)])
    useHistoryStore.getState().redo()
    expect(useClipsStore.getState().clips).toEqual([makeClip('x', 0, 10)])
  })
})

describe('clear', () => {
  it('empties both past and future stacks', () => {
    useHistoryStore.getState().push([makeClip('a', 0, 10)])
    useClipsStore.getState().restoreSnapshot([makeClip('b', 0, 5)])
    useHistoryStore.getState().undo()
    expect(useHistoryStore.getState().future).toHaveLength(1)

    useHistoryStore.getState().clear()

    expect(useHistoryStore.getState().past).toHaveLength(0)
    expect(useHistoryStore.getState().future).toHaveLength(0)
  })
})
