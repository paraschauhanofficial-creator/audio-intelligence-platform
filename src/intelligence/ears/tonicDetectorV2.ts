import { NOTES } from "./musicTheory";

export function detectTonicV2(
  histogram: number[]
) {

  const candidates =
    histogram
      .map((value, index) => ({
        note: NOTES[index],
        index,
        value,
      }))
      .sort(
        (a, b) =>
          b.value - a.value
      );

  return {
    tonic: candidates[0].note,
    tonicIndex:
      candidates[0].index,
    candidates:
      candidates.slice(0, 3),
  };
}