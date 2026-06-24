import { getAudioMetadata }
  from "./audioMetadata";

import { detectTempo }
  from "./tempoDetector";

import { detectKey }
  from "./keyDetector";

export interface AudioAnalysis {

  // Metadata

  duration?: number;
  sampleRate?: number;
  bitrate?: number;
  codec?: string;

  // Tempo

  tempo?: number | null;
  timeSignature?: string | null;

  // Harmonic

  key?: string | null;
  scale?: string | null;
}

export async function analyzeAudio(
  file: File
): Promise<AudioAnalysis> {

  try {

    console.log(
      "[Aura Ears] Analysis Started"
    );

    const metadata =
      await getAudioMetadata(
        file
      );

    const tempoData =
      await detectTempo(
        file
      );

    const keyData =
      await detectKey(
        file
      );

    const result: AudioAnalysis = {

      ...metadata,

      tempo:
        tempoData.tempo,

      timeSignature:
        tempoData.timeSignature,

      key:
        keyData.key,

      scale:
        keyData.scale,
    };

    console.log(
      "[Aura Ears] Analysis Complete",
      result
    );

    return result;

  } catch (error) {

    console.error(
      "[Aura Ears] Analysis Error:",
      error
    );

    return {};
  }
}