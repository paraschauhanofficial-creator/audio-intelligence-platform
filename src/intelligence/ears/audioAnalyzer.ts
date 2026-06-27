import { getAudioMetadata } from "./audioMetadata";
import { detectTempo } from "./tempoDetector";
import { detectKey } from "./keyDetector";
import { detectLUFS } from "./lufsDetector";
import { detectPeaks } from "./peakDetector";
import { analyzeDynamics } from "./dynamicAnalyzer";
import type { AudioAnalysis } from "./types";

export async function analyzeAudio(
  file: File
): Promise<AudioAnalysis> {
  try {
    console.log("[Aura Ears] Analysis Started");

    const [metadata, tempoData, keyData, lufsData, peakData, dynamicData] =
      await Promise.all([
        getAudioMetadata(file),
        detectTempo(file),
        detectKey(file),
        detectLUFS(file),
        detectPeaks(file),
        analyzeDynamics(file),
      ]);

    const result: AudioAnalysis = {
      ...metadata,
      tempo: tempoData.tempo,
      timeSignature: tempoData.timeSignature,
      key: keyData.key,
      scale: keyData.scale,
      integratedLUFS: lufsData.integratedLUFS,
      shortTermLUFS: lufsData.shortTermLUFS,
      momentaryLUFS: lufsData.momentaryLUFS,
      loudnessRange: lufsData.loudnessRange,
      truePeak: peakData.truePeak,
      samplePeak: peakData.samplePeak,
      averagePeak: peakData.averagePeak,
      rms: dynamicData.rms,
      crestFactor: dynamicData.crestFactor,
      dynamicRange: dynamicData.dynamicRange,
    };

    console.log("[Aura Ears] Analysis Complete", result);

    return result;

  } catch (error) {
    console.error("[Aura Ears] Analysis Error:", error);
    return {};
  }
}