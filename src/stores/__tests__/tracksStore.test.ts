import { describe, it, expect, beforeEach } from 'vitest'
import { useTracksStore } from '../tracksStore'
import type { Track } from '../../types/editor'

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'video-0',
    type: 'video',
    label: 'Video',
    muted: false,
    volume: 1,
    ...overrides,
  }
}

beforeEach(() => {
  useTracksStore.getState().reset()
})

describe('useTracksStore', () => {
  describe('addTrack', () => {
    it('adds a track to the array', () => {
      useTracksStore.getState().addTrack(makeTrack({ id: 'video-0' }))
      expect(useTracksStore.getState().tracks).toHaveLength(1)
      expect(useTracksStore.getState().tracks[0].id).toBe('video-0')
    })

    it('appends multiple tracks with different ids', () => {
      useTracksStore.getState().addTrack(makeTrack({ id: 'video-0' }))
      useTracksStore.getState().addTrack(makeTrack({ id: 'audio-0', type: 'audio', label: 'Audio' }))
      expect(useTracksStore.getState().tracks).toHaveLength(2)
    })

    it('replaces existing track when id already exists', () => {
      useTracksStore.getState().addTrack(makeTrack({ id: 'video-0', label: 'Video' }))
      useTracksStore.getState().addTrack(makeTrack({ id: 'video-0', label: 'Updated Video' }))
      const tracks = useTracksStore.getState().tracks
      expect(tracks).toHaveLength(1)
      expect(tracks[0].label).toBe('Updated Video')
    })
  })

  describe('setMuted', () => {
    it('sets muted to true on the correct track', () => {
      useTracksStore.getState().addTrack(makeTrack({ id: 'audio-0', muted: false }))
      useTracksStore.getState().setMuted('audio-0', true)
      expect(useTracksStore.getState().tracks[0].muted).toBe(true)
    })

    it('does not throw on unknown id', () => {
      useTracksStore.getState().addTrack(makeTrack({ id: 'video-0' }))
      expect(() => useTracksStore.getState().setMuted('nonexistent', true)).not.toThrow()
    })

    it('does not mutate other tracks when id is unknown', () => {
      useTracksStore.getState().addTrack(makeTrack({ id: 'video-0', muted: false }))
      useTracksStore.getState().setMuted('nonexistent', true)
      expect(useTracksStore.getState().tracks[0].muted).toBe(false)
    })
  })

  describe('setVolume', () => {
    it('sets volume on the correct track', () => {
      useTracksStore.getState().addTrack(makeTrack({ id: 'audio-0', volume: 1 }))
      useTracksStore.getState().setVolume('audio-0', 0.5)
      expect(useTracksStore.getState().tracks[0].volume).toBe(0.5)
    })

    it('clamps volume above 1 to 1', () => {
      useTracksStore.getState().addTrack(makeTrack({ id: 'audio-0', volume: 1 }))
      useTracksStore.getState().setVolume('audio-0', 1.5)
      expect(useTracksStore.getState().tracks[0].volume).toBe(1)
    })

    it('clamps volume below 0 to 0', () => {
      useTracksStore.getState().addTrack(makeTrack({ id: 'audio-0', volume: 1 }))
      useTracksStore.getState().setVolume('audio-0', -0.5)
      expect(useTracksStore.getState().tracks[0].volume).toBe(0)
    })

    it('does not throw on unknown id', () => {
      expect(() => useTracksStore.getState().setVolume('nonexistent', 0.5)).not.toThrow()
    })
  })

  describe('reset', () => {
    it('clears all tracks', () => {
      useTracksStore.getState().addTrack(makeTrack({ id: 'video-0' }))
      useTracksStore.getState().addTrack(makeTrack({ id: 'audio-0', type: 'audio', label: 'Audio' }))
      useTracksStore.getState().reset()
      expect(useTracksStore.getState().tracks).toHaveLength(0)
    })

    it('allows adding tracks after reset', () => {
      useTracksStore.getState().addTrack(makeTrack({ id: 'video-0' }))
      useTracksStore.getState().reset()
      useTracksStore.getState().addTrack(makeTrack({ id: 'video-0' }))
      expect(useTracksStore.getState().tracks).toHaveLength(1)
    })
  })
})
