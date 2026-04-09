import { describe, it, expect, beforeEach } from 'vitest'
import { useSourceStore } from '../sourceStore'

function makeFile(name = 'test.mp4', size = 1024): File {
  return new File([new ArrayBuffer(size)], name, { type: 'video/mp4' })
}

beforeEach(() => {
  useSourceStore.getState().reset()
})

describe('useSourceStore', () => {
  describe('initial state', () => {
    it('starts with file null', () => {
      expect(useSourceStore.getState().file).toBeNull()
    })
  })

  describe('setFile', () => {
    it('stores the provided File object', () => {
      const file = makeFile()
      useSourceStore.getState().setFile(file)
      expect(useSourceStore.getState().file).toBe(file)
    })

    it('replaces a previously stored file with the new one', () => {
      const first = makeFile('first.mp4')
      const second = makeFile('second.mp4')
      useSourceStore.getState().setFile(first)
      useSourceStore.getState().setFile(second)
      expect(useSourceStore.getState().file).toBe(second)
    })
  })

  describe('reset', () => {
    it('sets file back to null', () => {
      useSourceStore.getState().setFile(makeFile())
      useSourceStore.getState().reset()
      expect(useSourceStore.getState().file).toBeNull()
    })
  })
})
