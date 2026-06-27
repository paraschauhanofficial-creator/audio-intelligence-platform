import { NOTES } from "./musicTheory";

// tonicDetectorV2 accepts the combined chroma array
// from extractChroma's output object
export function detectTonicV2(combinedChroma: number[]) {
  const scored = combinedChroma.map((value, index) => {
    const fifthIndex = (index + 7) % 12;
    const fourthIndex = (index + 5) % 12;
    const majorThirdIndex = (index + 4) % 12;
    const minorThirdIndex = (index + 3) % 12;

    const harmonicScore =
      value * 2.0 +
      combinedChroma[fifthIndex] * 0.7 +
      combinedChroma[fourthIndex] * 0.4 +
      Math.max(
        combinedChroma[majorThirdIndex],
        combinedChroma[minorThirdIndex]
      ) * 0.2;

    return {
      note: NOTES[index],
      index,
      value,
      harmonicScore,
    };
  });

  const candidates = [...scored].sort(
    (a, b) => b.harmonicScore - a.harmonicScore
  );

  return {
    tonic: candidates[0].note,
    tonicIndex: candidates[0].index,
    confidence: candidates[0].harmonicScore,
    candidates: candidates.slice(0, 3),
  };
}