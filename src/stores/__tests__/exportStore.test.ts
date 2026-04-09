import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useExportStore } from '../exportStore'

beforeEach(() => {
  useExportStore.getState().resetExport()
})

describe('useExportStore', () => {
  describe('initial state', () => {
    it('starts idle with no progress, url, or error', () => {
      const state = useExportStore.getState()
      expect(state.status).toBe('idle')
      expect(state.progress).toBe(0)
      expect(state.outputUrl).toBeNull()
      expect(state.error).toBeNull()
    })
  })

  describe('startExport', () => {
    it('sets status to loading and resets progress, url, error', () => {
      useExportStore.getState().setReady('blob:old')
      useExportStore.getState().startExport()
      const state = useExportStore.getState()
      expect(state.status).toBe('loading')
      expect(state.progress).toBe(0)
      expect(state.outputUrl).toBeNull()
      expect(state.error).toBeNull()
    })
  })

  describe('setProgress', () => {
    it('updates progress to the given ratio', () => {
      useExportStore.getState().startExport()
      useExportStore.getState().setProgress(0.5)
      expect(useExportStore.getState().progress).toBe(0.5)
    })

    it('clamps progress above 1 to 1', () => {
      useExportStore.getState().setProgress(1.05)
      expect(useExportStore.getState().progress).toBe(1)
    })

    it('clamps progress below 0 to 0', () => {
      useExportStore.getState().setProgress(-0.1)
      expect(useExportStore.getState().progress).toBe(0)
    })
  })

  describe('setReady', () => {
    it('sets status to ready with the provided url and progress 1', () => {
      useExportStore.getState().setReady('blob:test-url')
      const state = useExportStore.getState()
      expect(state.status).toBe('ready')
      expect(state.outputUrl).toBe('blob:test-url')
      expect(state.progress).toBe(1)
    })
  })

  describe('setError', () => {
    it('sets status to error with the provided message', () => {
      useExportStore.getState().setError('Out of memory')
      const state = useExportStore.getState()
      expect(state.status).toBe('error')
      expect(state.error).toBe('Out of memory')
    })
  })

  describe('resetExport', () => {
    it('returns state to idle and clears all fields', () => {
      useExportStore.getState().setError('Something failed')
      useExportStore.getState().resetExport()
      const state = useExportStore.getState()
      expect(state.status).toBe('idle')
      expect(state.progress).toBe(0)
      expect(state.outputUrl).toBeNull()
      expect(state.error).toBeNull()
    })

    it('revokes the output blob URL when one is set', () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
      useExportStore.getState().setReady('blob:some-url')
      useExportStore.getState().resetExport()
      expect(revokeSpy).toHaveBeenCalledWith('blob:some-url')
      revokeSpy.mockRestore()
    })

    it('does not call revokeObjectURL when outputUrl is null', () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
      useExportStore.getState().resetExport()
      expect(revokeSpy).not.toHaveBeenCalled()
      revokeSpy.mockRestore()
    })
  })
})
