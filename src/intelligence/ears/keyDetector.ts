import { extractChroma }
  from "./chromaExtractor";

import {
  generateKeyProfiles,
} from "./keyProfiles";

import {
  correlation,
} from "./correlation";

export async function detectKey(
  file: File
) {
  try {

    

    const arrayBuffer =
      await file.arrayBuffer();

    const audioContext =
      new AudioContext();

    const audioBuffer =
      await audioContext.decodeAudioData(
        arrayBuffer
      );

    const chroma =
      await extractChroma(
        audioBuffer
      );



      const profiles =
  generateKeyProfiles();

let bestMatch = null;
let bestScore = -Infinity;

for (const candidate of profiles) {

  const score =
    correlation(
      chroma,
      candidate.profile
    );

  if (score > bestScore) {

    bestScore = score;

    bestMatch = candidate;
  }
}


    return {
  key: bestMatch?.key ?? null,
  scale: bestMatch?.scale ?? null,
};

  } catch (error) {

    console.error(
      "[Aura Ears] Key Error:",
      error
    );

    return {
      key: null,
      scale: null,
    };
  }
}