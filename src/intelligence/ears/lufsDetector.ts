import type {
  LoudnessAnalysis,
} from "./types";

export async function detectLUFS(
  file: File
): Promise<LoudnessAnalysis> {

  return {

    integratedLUFS: null,

    shortTermLUFS: null,

    momentaryLUFS: null,

    loudnessRange: null,
  };
}