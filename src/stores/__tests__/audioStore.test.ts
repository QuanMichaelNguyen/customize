import { describe, it, expect, beforeEach } from 'vitest'
import { useAudioStore } from '../audioStore'
import type { WaveformData } from '../../types/editor'

function makeWaveformData(length = 10): WaveformData {
  return {
    peaks: new Float32Array(length).fill(0.5),
    mins: new Float32Array(length).fill(-0.5),
    length,
  }
}

beforeEach(() => {
  useAudioStore.getState().reset()
})

describe('useAudioStore', () => {
  describe('initial state', () => {
    it('starts with idle status and no waveform data', () => {
      const state = useAudioStore.getState()
      expect(state.extractionStatus).toBe('idle')
      expect(state.waveformData).toBeNull()
      expect(state.hasAudio).toBe(false)
    })
  })

  describe('setLoading', () => {
    it('transitions extractionStatus to loading', () => {
      useAudioStore.getState().setLoading()
      expect(useAudioStore.getState().extractionStatus).toBe('loading')
    })
  })

  describe('setWaveform', () => {
    it('stores waveform data and transitions to ready when data is non-null', () => {
      const data = makeWaveformData(100)
      useAudioStore.getState().setWaveform(data)
      const state = useAudioStore.getState()
      expect(state.extractionStatus).toBe('ready')
      expect(state.hasAudio).toBe(true)
      expect(state.waveformData).toBe(data)
    })

    it('sets hasAudio to false when data is null (no audio stream)', () => {
      useAudioStore.getState().setWaveform(null)
      const state = useAudioStore.getState()
      expect(state.extractionStatus).toBe('ready')
      expect(state.hasAudio).toBe(false)
      expect(state.waveformData).toBeNull()
    })
  })

  describe('setError', () => {
    it('transitions extractionStatus to error and sets hasAudio to false', () => {
      useAudioStore.getState().setLoading()
      useAudioStore.getState().setError()
      const state = useAudioStore.getState()
      expect(state.extractionStatus).toBe('error')
      expect(state.hasAudio).toBe(false)
    })
  })

  describe('reset', () => {
    it('restores all fields to initial values', () => {
      useAudioStore.getState().setWaveform(makeWaveformData())
      useAudioStore.getState().reset()
      const state = useAudioStore.getState()
      expect(state.extractionStatus).toBe('idle')
      expect(state.waveformData).toBeNull()
      expect(state.hasAudio).toBe(false)
    })
  })
})
