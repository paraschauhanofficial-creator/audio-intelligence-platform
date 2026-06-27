import { extractChroma } from "./chromaExtractor";
import { NOTES } from "./musicTheory";

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

function scoreKey(
  chroma: number[],
  rootIndex: number,
  intervals: number[]
): number {
  const isMinor = intervals === MINOR_INTERVALS;
  const thirdOffset = isMinor ? 3 : 4;

  // Chord fitness — root chord notes present
  const chordFit =
    chroma[rootIndex] +
    chroma[(rootIndex + thirdOffset) % 12] +
    chroma[(rootIndex + 7) % 12];

  // Scale coverage — how much energy is inside vs outside the scale
  const inScale = intervals.reduce(
    (sum, k) => sum + chroma[(rootIndex + k) % 12],
    0
  );
  const outOfScale = Array.from({ length: 12 }, (_, k) => k)
    .filter((k) => !intervals.includes(k))
    .reduce((sum, k) => sum + chroma[(rootIndex + k) % 12], 0);

  const scaleCov = inScale - outOfScale * 0.5;

  return chordFit * 0.6 + scaleCov * 0.4;
}

export async function detectKey(file: File) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const { energy, consistency, combined } = await extractChroma(audioBuffer);

    console.log("[Aura Ears] Chroma (energy | consistency | combined):");
    combined.forEach((val, i) => {
      console.log(
        `  ${NOTES[i]}: energy=${energy[i].toFixed(3)} consistency=${consistency[i].toFixed(3)} combined=${val.toFixed(3)}`
      );
    });

    // Score all 24 keys using the combined chroma
    const candidates: { key: string; scale: string; score: number }[] = [];

    for (let i = 0; i < 12; i++) {
      const majorScore = scoreKey(combined, i, MAJOR_INTERVALS);
      const minorScore = scoreKey(combined, i, MINOR_INTERVALS);
      candidates.push({ key: NOTES[i], scale: "Major", score: majorScore });
      candidates.push({ key: NOTES[i], scale: "Minor", score: minorScore });
    }

    candidates.sort((a, b) => b.score - a.score);

    console.log("[Aura Ears] Top 5 candidates:");
    candidates.slice(0, 5).forEach((c) => {
      console.log(`  ${c.key} ${c.scale}: ${c.score.toFixed(4)}`);
    });

    const best = candidates[0];

    console.log("[Aura Ears] Key Result:", best.key, best.scale);

    return {
      key: best.key,
      scale: best.scale,
    };

  } catch (error) {
    console.error("[Aura Ears] Key Detection Error:", error);
    return { key: null, scale: null };
  }
}