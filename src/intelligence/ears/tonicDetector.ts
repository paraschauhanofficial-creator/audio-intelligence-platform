export function detectTonic(
  histogram: number[]
) {
  let maxValue = -Infinity;
  let tonicIndex = 0;

  for (
    let i = 0;
    i < histogram.length;
    i++
  ) {
    if (
      histogram[i] > maxValue
    ) {
      maxValue =
        histogram[i];

      tonicIndex = i;
    }
  }

  return tonicIndex;
}