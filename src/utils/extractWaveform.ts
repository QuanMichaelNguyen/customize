/**
 * Decodes the audio stream from a video File and returns downsampled peak/min arrays.
 * Uses OfflineAudioContext (not AudioContext) to avoid autoplay policy enforcement.
 * Returns null if the file has no decodable audio track.
 *
 * @param file         The video File to decode audio from.
 * @param targetSamples Number of peak/min samples to produce. Use a fixed high value (e.g. 2000)
 *                     and scale to canvas width at draw time — avoids re-extraction on resize.
 */
import type { WaveformData } from '../types/editor'

/**
 * Mixes a multi-channel AudioBuffer to mono and downsamples to targetSamples peak/min buckets.
 * Exported for unit testing without requiring OfflineAudioContext.
 */
export function computePeaksFromBuffer(
  audioBuffer: AudioBuffer,
  targetSamples: number,
): WaveformData {
  const channelCount = audioBuffer.numberOfChannels
  const sampleCount = audioBuffer.length

  // Mix all channels to mono by averaging
  const mono = new Float32Array(sampleCount)
  for (let c = 0; c < channelCount; c++) {
    const channelData = audioBuffer.getChannelData(c)
    for (let i = 0; i < sampleCount; i++) {
      mono[i] += channelData[i] / channelCount
    }
  }

  // Downsample to targetSamples using peak+min per bucket (preserves transients)
  const safeTarget = Math.max(1, targetSamples)
  const blockSize = Math.max(1, Math.floor(sampleCount / safeTarget))
  const actualSamples = Math.min(safeTarget, sampleCount)

  const peaks = new Float32Array(safeTarget)
  const mins = new Float32Array(safeTarget)

  for (let i = 0; i < actualSamples; i++) {
    const start = i * blockSize
    let max = 0
    let min = 0
    for (let j = 0; j < blockSize; j++) {
      const s = mono[start + j] ?? 0
      if (s > max) max = s
      if (s < min) min = s
    }
    peaks[i] = max
    mins[i] = min
  }
  // Remaining indices (when targetSamples > sampleCount) stay at 0 (already initialised)

  return { peaks, mins, length: safeTarget }
}


export async function extractWaveform(
  file: File,
  targetSamples: number,
): Promise<WaveformData | null> {
  let arrayBuffer: ArrayBuffer
  try {
    arrayBuffer = await file.arrayBuffer()
  } catch {
    return null
  }

  let audioBuffer: AudioBuffer
  try {
    // OfflineAudioContext(channels, length, sampleRate) — length=1 is valid because
    // decodeAudioData ignores it; we just need the context to call decodeAudioData.
    const offlineCtx = new OfflineAudioContext(1, 1, 44100)
    audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer)
  } catch {
    // EncodingError or similar — no decodable audio stream
    return null
  }

  return computePeaksFromBuffer(audioBuffer, targetSamples)
}
