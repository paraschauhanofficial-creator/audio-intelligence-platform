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
  "[Aura Ears] Best Scale Candidate:",
  matchingScales[0]
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





const tonicData =
  detectTonicV2(
    chroma
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

  

  if (score > bestScore) {

    bestScore = score;

    bestMatch = candidate;
  }
}



console.log(
  "[Aura Ears] Best Match:",
  bestMatch
);






    return {
  key:
    bestMatch?.key ??
    matchingScales[0]?.key ??
    null,

  scale:
    bestMatch?.scale ??
    matchingScales[0]?.scale ??
    null,
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