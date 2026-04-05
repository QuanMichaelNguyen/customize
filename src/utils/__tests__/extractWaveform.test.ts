import { describe, it, expect, vi, afterEach } from 'vitest'
import { computePeaksFromBuffer, extractWaveform } from '../extractWaveform'

afterEach(() => {
  vi.unstubAllGlobals()
})

// ----- helpers ---------------------------------------------------------------

function makeFile(content = 'fake video data'): File {
  return new File([content], 'test.mp4', { type: 'video/mp4' })
}

function makeMockAudioBuffer(channels: Float32Array[]): AudioBuffer {
  return {
    numberOfChannels: channels.length,
    length: channels[0]?.length ?? 0,
    sampleRate: 44100,
    duration: (channels[0]?.length ?? 0) / 44100,
    getChannelData: (channel: number) => channels[channel] ?? new Float32Array(0),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer
}

// ----- computePeaksFromBuffer ------------------------------------------------

describe('computePeaksFromBuffer', () => {
  it('returns peaks and mins arrays of the requested targetSamples length', () => {
    const ch0 = new Float32Array([0.5, -0.5, 0.8, -0.8, 0.3, -0.3, 0.1, -0.1])
    const ch1 = new Float32Array([0.2, -0.2, 0.6, -0.6, 0.4, -0.4, 0.7, -0.7])
    const buf = makeMockAudioBuffer([ch0, ch1])

    const result = computePeaksFromBuffer(buf, 4)
    expect(result.peaks.length).toBe(4)
    expect(result.mins.length).toBe(4)
    expect(result.length).toBe(4)
  })

  it('returns correct peak and min values for a mono source', () => {
    // 4 samples; request 2 buckets → blockSize=2
    // Bucket 0: [0.5, -0.3] → peak=0.5, min=-0.3
    // Bucket 1: [0.8, -0.6] → peak=0.8, min=-0.6
    const ch0 = new Float32Array([0.5, -0.3, 0.8, -0.6])
    const result = computePeaksFromBuffer(makeMockAudioBuffer([ch0]), 2)

    expect(result.peaks[0]).toBeCloseTo(0.5)
    expect(result.mins[0]).toBeCloseTo(-0.3)
    expect(result.peaks[1]).toBeCloseTo(0.8)
    expect(result.mins[1]).toBeCloseTo(-0.6)
  })

  it('mixes two channels to mono before computing peaks', () => {
    // ch0 = [0.8], ch1 = [0.4] → mono average = [0.6]
    const ch0 = new Float32Array([0.8])
    const ch1 = new Float32Array([0.4])
    const result = computePeaksFromBuffer(makeMockAudioBuffer([ch0, ch1]), 1)

    expect(result.peaks[0]).toBeCloseTo(0.6)
  })

  it('does not throw when targetSamples exceeds source sample count', () => {
    // 2 samples, request 10 buckets — remainder stays at 0
    const ch0 = new Float32Array([0.5, -0.5])
    expect(() => computePeaksFromBuffer(makeMockAudioBuffer([ch0]), 10)).not.toThrow()

    const result = computePeaksFromBuffer(makeMockAudioBuffer([ch0]), 10)
    expect(result.length).toBe(10)
  })

  it('returns all-zero peaks/mins for a silent buffer (no division by zero)', () => {
    const ch0 = new Float32Array([0, 0, 0, 0])
    const result = computePeaksFromBuffer(makeMockAudioBuffer([ch0]), 2)

    expect(result.peaks[0]).toBe(0)
    expect(result.mins[0]).toBe(0)
  })
})

// ----- extractWaveform (error path only — success path delegates to computePeaksFromBuffer) ---

describe('extractWaveform', () => {
  it('returns null when decodeAudioData rejects (no audio stream)', async () => {
    vi.stubGlobal(
      'OfflineAudioContext',
      class {
        decodeAudioData() {
          return Promise.reject(new DOMException('Unable to decode audio data', 'EncodingError'))
        }
      },
    )

    const result = await extractWaveform(makeFile(), 100)
    expect(result).toBeNull()
  })
})
