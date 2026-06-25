import type {
  PeakAnalysis,
} from "./types";

export async function detectPeaks(
  file: File
): Promise<PeakAnalysis> {

  return {

    truePeak: null,

    samplePeak: null,

    averagePeak: null,
  };
}