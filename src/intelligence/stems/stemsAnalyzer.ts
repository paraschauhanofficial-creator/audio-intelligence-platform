// ─────────────────────────────────────────────────────────────────────────────
// Nokashi Stem Analyzer — stemsAnalyzer.ts
// src/intelligence/stems/stemsAnalyzer.ts
// ─────────────────────────────────────────────────────────────────────────────

import { getAudioMetadata } from "@/intelligence/ears/audioMetadata";
import { detectTempo }      from "@/intelligence/ears/tempoDetector";
import { detectKey }        from "@/intelligence/ears/keyDetector";
import { detectLUFS }       from "@/intelligence/ears/lufsDetector";
import { detectPeaks }      from "@/intelligence/ears/peakDetector";
import { analyzeDynamics }  from "@/intelligence/ears/dynamicAnalyzer";
import { analyzeFrequency } from "@/intelligence/ears/frequencyAnalyzer";
import { analyzeStereo }    from "@/intelligence/ears/stereoAnalyzer";
import type { AudioFingerprint } from "./stemsIdentifier";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
export interface StemAnalysisResult {
  duration:          string;
  sampleRate:        number;
  bitrate:           number | null;
  codec:             string | null;
  tempo:             number | null;
  timeSignature:     string | null;
  musicalKey:        string | null;
  scale:             string | null;
  keyConfidence:     null; // detectKey does not return confidence
  integratedLufs:    number | null;
  shortTermLufs:     number | null;
  momentaryLufs:     number | null;
  loudnessRange:     number | null;
  truePeak:          number | null;
  samplePeak:        number | null;
  averagePeak:       number | null;
  rms:               number | null;
  crestFactor:       number | null;
  dynamicRange:      number | null;
  freqSub:           number | null;
  freqBass:          number | null;
  freqLowMid:        number | null;
  freqMid:           number | null;
  freqHighMid:       number | null;
  freqAir:           number | null;
  stereoCorrelation: number | null;
  stereoWidth:       number | null;
  fingerprint:       AudioFingerprint;
}

export interface StemAnalysisProgress {
  stage:   "metadata" | "tempo" | "key" | "loudness" | "peaks" | "dynamics" | "frequency" | "stereo" | "done" | "error";
  message: string;
  percent: number;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUICK FINGERPRINT — runs before identification popup opens
// Only frequency + stereo + dynamics + peaks — fast
// ─────────────────────────────────────────────────────────────────────────────
export async function quickFingerprint(file: File): Promise<AudioFingerprint> {
  const [freqResult, stereoResult, dynamicsResult, lufsResult, peaksResult] =
    await Promise.all([
      analyzeFrequency(file),
      analyzeStereo(file),
      analyzeDynamics(file),
      detectLUFS(file),
      detectPeaks(file),
    ]);

  return {
    freqSub:           freqResult.sub           ?? 0,
    freqBass:          freqResult.bass          ?? 0,
    freqLowMid:        freqResult.lowMid        ?? 0,
    freqMid:           freqResult.mid           ?? 0,
    freqHighMid:       freqResult.highMid       ?? 0,
    freqAir:           freqResult.air           ?? 0,
    stereoWidth:       stereoResult.stereoWidth ?? 0,
    stereoCorrelation: stereoResult.correlation ?? 0,
    dynamicRange:      dynamicsResult.dynamicRange ?? 0,
    crestFactor:       dynamicsResult.crestFactor  ?? 0,
    integratedLufs:    lufsResult.integratedLUFS   ?? 0,
    truePeak:          peaksResult.truePeak         ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYZE SINGLE STEM — full Aura Ears suite
// Detectors confirmed return shapes:
//   getAudioMetadata  → { duration, sampleRate, bitrate, codec }
//   detectTempo       → { tempo, timeSignature }
//   detectKey         → { key, scale }           (no confidence)
//   detectLUFS        → { integratedLUFS, shortTermLUFS, momentaryLUFS, loudnessRange }
//   detectPeaks       → { truePeak, samplePeak, averagePeak }
//   analyzeDynamics   → { rms, crestFactor, dynamicRange }
//   analyzeFrequency  → { sub, bass, lowMid, mid, highMid, air }
//   analyzeStereo     → { correlation, stereoWidth }
// ─────────────────────────────────────────────────────────────────────────────
export async function analyzeStem(
  file:            File,
  runKeyDetection: boolean,
  onProgress:      (p: StemAnalysisProgress) => void = () => {},
): Promise<StemAnalysisResult> {

  onProgress({ stage: "metadata", message: "Reading metadata...", percent: 10 });
  const metadata = await getAudioMetadata(file);
  // duration from metadata may be undefined on some formats — decode for safety
  const arrayBuffer  = await file.arrayBuffer();
  const ctx          = new AudioContext();
  const audioBuffer  = await ctx.decodeAudioData(arrayBuffer);
  ctx.close();

  onProgress({ stage: "tempo", message: "Detecting tempo...", percent: 22 });
  const tempoResult = await detectTempo(file);
  // returns { tempo: number|null, timeSignature: string|null }

  let keyResult: { key: string | null; scale: string | null } | null = null;
  if (runKeyDetection) {
    onProgress({ stage: "key", message: "Detecting key...", percent: 34 });
    keyResult = await detectKey(file);
    // returns { key: string|null, scale: string|null }
  } else {
    onProgress({ stage: "key", message: "Skipping key (non-melodic stem)...", percent: 34 });
  }

  onProgress({ stage: "loudness", message: "Measuring loudness (EBU R128)...", percent: 48 });
  const lufsResult = await detectLUFS(file);
  // returns { integratedLUFS, shortTermLUFS, momentaryLUFS, loudnessRange }

  onProgress({ stage: "peaks", message: "Detecting peaks...", percent: 58 });
  const peaksResult = await detectPeaks(file);
  // returns { truePeak, samplePeak, averagePeak }

  onProgress({ stage: "dynamics", message: "Analysing dynamics...", percent: 68 });
  const dynamicsResult = await analyzeDynamics(file);
  // returns { rms, crestFactor, dynamicRange }

  onProgress({ stage: "frequency", message: "Analysing frequency bands...", percent: 78 });
  const freqResult = await analyzeFrequency(file);
  // returns { sub, bass, lowMid, mid, highMid, air }

  onProgress({ stage: "stereo", message: "Analysing stereo image...", percent: 88 });
  const stereoResult = await analyzeStereo(file);
  // returns { correlation, stereoWidth }

  onProgress({ stage: "done", message: "Analysis complete", percent: 100 });

  const fingerprint: AudioFingerprint = {
    freqSub:           freqResult.sub           ?? 0,
    freqBass:          freqResult.bass          ?? 0,
    freqLowMid:        freqResult.lowMid        ?? 0,
    freqMid:           freqResult.mid           ?? 0,
    freqHighMid:       freqResult.highMid       ?? 0,
    freqAir:           freqResult.air           ?? 0,
    stereoWidth:       stereoResult.stereoWidth ?? 0,
    stereoCorrelation: stereoResult.correlation ?? 0,
    dynamicRange:      dynamicsResult.dynamicRange ?? 0,
    crestFactor:       dynamicsResult.crestFactor  ?? 0,
    integratedLufs:    lufsResult.integratedLUFS   ?? 0,
    truePeak:          peaksResult.truePeak         ?? 0,
  };

  return {
    // Metadata — getAudioMetadata returns duration in seconds as number
    duration:          formatDuration(audioBuffer.duration),
    sampleRate:        audioBuffer.sampleRate,
    bitrate:           metadata.bitrate  ?? null,
    codec:             metadata.codec    ?? null,

    // Tempo — { tempo, timeSignature }
    tempo:             tempoResult.tempo         ?? null,
    timeSignature:     tempoResult.timeSignature ?? null,

    // Key — { key, scale } — no confidence field
    musicalKey:        keyResult?.key   ?? null,
    scale:             keyResult?.scale ?? null,
    keyConfidence:     null,

    // Loudness — { integratedLUFS, shortTermLUFS, momentaryLUFS, loudnessRange }
    integratedLufs:    lufsResult.integratedLUFS  ?? null,
    shortTermLufs:     lufsResult.shortTermLUFS   ?? null,
    momentaryLufs:     lufsResult.momentaryLUFS   ?? null,
    loudnessRange:     lufsResult.loudnessRange    ?? null,

    // Peaks — { truePeak, samplePeak, averagePeak }
    truePeak:          peaksResult.truePeak    ?? null,
    samplePeak:        peaksResult.samplePeak  ?? null,
    averagePeak:       peaksResult.averagePeak ?? null,

    // Dynamics — { rms, crestFactor, dynamicRange }
    rms:               dynamicsResult.rms          ?? null,
    crestFactor:       dynamicsResult.crestFactor  ?? null,
    dynamicRange:      dynamicsResult.dynamicRange ?? null,

    // Frequency — { sub, bass, lowMid, mid, highMid, air }
    freqSub:           freqResult.sub    ?? null,
    freqBass:          freqResult.bass   ?? null,
    freqLowMid:        freqResult.lowMid ?? null,
    freqMid:           freqResult.mid    ?? null,
    freqHighMid:       freqResult.highMid ?? null,
    freqAir:           freqResult.air    ?? null,

    // Stereo — { correlation, stereoWidth }
    stereoCorrelation: stereoResult.correlation ?? null,
    stereoWidth:       stereoResult.stereoWidth ?? null,

    fingerprint,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH ANALYZE — sequential, one stem at a time
// ─────────────────────────────────────────────────────────────────────────────
export interface BatchStemInput {
  file:            File;
  runKeyDetection: boolean;
  stemId:          string;
}

export interface BatchStemResult {
  stemId: string;
  result: StemAnalysisResult | null;
  error:  string | null;
}

export async function analyzeStems(
  stems:       BatchStemInput[],
  onStemStart: (stemId: string, fileName: string, index: number, total: number) => void,
  onProgress:  (stemId: string, progress: StemAnalysisProgress) => void,
  onStemDone:  (stemId: string, result: StemAnalysisResult | null, error: string | null) => void,
): Promise<BatchStemResult[]> {
  const results: BatchStemResult[] = [];

  for (let i = 0; i < stems.length; i++) {
    const { file, runKeyDetection, stemId } = stems[i];
    onStemStart(stemId, file.name, i, stems.length);
    try {
      const result = await analyzeStem(file, runKeyDetection, p => onProgress(stemId, p));
      onStemDone(stemId, result, null);
      results.push({ stemId, result, error: null });
    } catch (err: any) {
      const msg = err?.message ?? "Analysis failed";
      onStemDone(stemId, null, msg);
      results.push({ stemId, result: null, error: msg });
    }
  }

  return results;
}