import type { DynamicAnalysis } from "./types";

export async function analyzeDynamics(
  file: File
): Promise<DynamicAnalysis> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // RMS — Root Mean Square, overall loudness feel
    const rmsRaw = Math.sqrt(
      channelData.reduce((sum, s) => sum + s * s, 0) / channelData.length
    );
    const rms = parseFloat((20 * Math.log10(rmsRaw)).toFixed(2));

    // Sample Peak for crest factor
    let peak = 0;
    for (let i = 0; i < channelData.length; i++) {
      const abs = Math.abs(channelData[i]);
      if (abs > peak) peak = abs;
    }
    const peakDB = 20 * Math.log10(peak);

    // Crest Factor — difference between peak and RMS
    // High crest = lots of dynamic range
    // Low crest = heavily compressed/limited
    const crestFactor = parseFloat((peakDB - rms).toFixed(2));

    // Dynamic Range — difference between loudest and quietest
    // measured in 500ms windows, ignoring silence
    const windowSize = Math.round(0.5 * sampleRate);
    const windowRMS: number[] = [];

    for (let start = 0; start + windowSize <= channelData.length; start += windowSize) {
      const block = channelData.slice(start, start + windowSize);
      const blockRMS = Math.sqrt(
        block.reduce((sum, s) => sum + s * s, 0) / block.length
      );
      if (blockRMS > 0.001) {
        windowRMS.push(20 * Math.log10(blockRMS));
      }
    }

    windowRMS.sort((a, b) => a - b);
    const dynamicRange = windowRMS.length > 1
      ? parseFloat((windowRMS[windowRMS.length - 1] - windowRMS[0]).toFixed(2))
      : null;

    console.log("[Aura Ears] Dynamics:", {
      rms,
      crestFactor,
      dynamicRange,
    });

    return {
      rms,
      crestFactor,
      dynamicRange,
    };

  } catch (error) {
    console.error("[Aura Ears] Dynamics Error:", error);
    return {
      rms: null,
      crestFactor: null,
      dynamicRange: null,
    };
  }
}