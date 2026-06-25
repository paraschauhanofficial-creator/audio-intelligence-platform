import type {
  DynamicAnalysis,
} from "./types";

export async function analyzeDynamics(
  file: File
): Promise<DynamicAnalysis> {

  return {

    rms: null,

    crestFactor: null,

    dynamicRange: null,
  };
}