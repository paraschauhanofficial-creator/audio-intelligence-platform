import { extractChroma }
  from "./chromaExtractor";

import {
  generateKeyProfiles,
} from "./keyProfiles";

import {
  correlation,
} from "./correlation";

import { detectTonic }
  from "./tonicDetector";


import {
  NOTES,
} from "./musicTheory";

import {
  findMatchingScales,
} from "./scaleMatcher";

import {
  detectTonicV2,
} from "./tonicDetectorV2";



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


      const detectedNotes =
  chroma
    .map(
      (
        value,
        index
      ) => ({
        note:
          NOTES[index],
        value,
      })
    )
    .filter(
      (item) =>
        item.value > 0
    )
    .sort(
      (a, b) =>
        b.value -
        a.value
    )
    .slice(0, 7)
    .map(
      (item) =>
        item.note
    );

console.log(
  "[Aura Ears] Detected Notes:",
  detectedNotes
);

const matchingScales =
  findMatchingScales(
    detectedNotes
  );

console.log(
  "[Aura Ears] Matching Scales:"
);

console.table(
  matchingScales.slice(
    0,
    10
  )
);

      const tonicIndex =
  detectTonic(
    chroma
  );

console.log(
  "[Aura Ears] Tonic Index:",
  tonicIndex
);

console.log(
  "[Aura Ears] Tonic Note:",
  NOTES[tonicIndex]
);




const tonicData =
  detectTonicV2(
    chroma
  );

console.log(
  "[Aura Ears V2]",
  tonicData
);




      const profiles =
  generateKeyProfiles();

let bestMatch = null;
let bestScore = -Infinity;

for (const candidate of profiles) {

  let score =
    correlation(
      chroma,
      candidate.profile
    );

  if (
    candidate.key ===
    NOTES[tonicIndex]
  ) {
    score += 0.20;
  }

  if (
  candidate.key ===
  NOTES[tonicIndex]
) {
  console.log(
    "[Aura Ears]",
    candidate.key,
    candidate.scale,
    score
  );
}

  if (score > bestScore) {

    bestScore = score;

    bestMatch = candidate;
  }
}



console.log(
  "[Aura Ears] Best Match:",
  bestMatch
);

console.log(
  "[Aura Ears] Final Score:",
  bestScore
);




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