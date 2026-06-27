import type { PeakAnalysis } from "./types";

export async function detectPeaks(
  file: File
): Promise<PeakAnalysis> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);

    // Sample Peak — highest absolute sample value
    let samplePeak = 0;
    for (let i = 0; i < channelData.length; i++) {
      const abs = Math.abs(channelData[i]);
      if (abs > samplePeak) samplePeak = abs;
    }

    // True Peak — interpolated peak (4x oversampling approximation)
    // Catches inter-sample peaks that sample peak misses
    const truePeak = estimateTruePeak(channelData);

    // Average Peak — mean of all absolute sample values above silence
    const threshold = 0.001;
    let peakSum = 0;
    let peakCount = 0;
    for (let i = 0; i < channelData.length; i++) {
      const abs = Math.abs(channelData[i]);
      if (abs > threshold) {
        peakSum += abs;
        peakCount++;
      }
    }
    const averagePeak = peakCount > 0 ? peakSum / peakCount : 0;

    // Convert to dBFS
    const toDBFS = (v: number) =>
      v > 0 ? parseFloat((20 * Math.log10(v)).toFixed(2)) : -Infinity;

    console.log("[Aura Ears] Peaks:", {
      truePeak: toDBFS(truePeak),
      samplePeak: toDBFS(samplePeak),
      averagePeak: toDBFS(averagePeak),
    });

    return {
      truePeak: toDBFS(truePeak),
      samplePeak: toDBFS(samplePeak),
      averagePeak: toDBFS(averagePeak),
    };

  } catch (error) {
    console.error("[Aura Ears] Peak Error:", error);
    return {
      truePeak: null,
      samplePeak: null,
      averagePeak: null,
    };
  }
}

// True peak estimation via 4x oversampling
// Inserts 3 zero samples between each real sample then low-pass filters
function estimateTruePeak(data: Float32Array): number {
  const factor = 4;
  const upsampled = new Float32Array(data.length * factor);

  for (let i = 0; i < data.length; i++) {
    upsampled[i * factor] = data[i];
  }

  // Simple sinc-like low-pass filter for interpolation
  const filterLen = 16;
  const filtered = new Float32Array(upsampled.length);
  for (let i = 0; i < upsampled.length; i++) {
    let sum = 0;
    for (let k = -filterLen; k <= filterLen; k++) {
      const idx = i + k;
      if (idx < 0 || idx >= upsampled.length) continue;
      const sinc = k === 0 ? 1 : Math.sin(Math.PI * k / factor) / (Math.PI * k / factor);
      const window = 0.5 * (1 + Math.cos(Math.PI * k / filterLen));
      sum += upsampled[idx] * sinc * window;
    }
    filtered[i] = sum;
  }

  let peak = 0;
  for (let i = 0; i < filtered.length; i++) {
    const abs = Math.abs(filtered[i]);
    if (abs > peak) peak = abs;
  }

  return peak;
}