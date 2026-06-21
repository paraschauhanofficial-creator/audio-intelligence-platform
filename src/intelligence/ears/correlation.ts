export function correlation(
  a: number[],
  b: number[]
) {
  const n = a.length;

  const meanA =
    a.reduce((x, y) => x + y, 0) / n;

  const meanB =
    b.reduce((x, y) => x + y, 0) / n;

  let numerator = 0;
  let denomA = 0;
  let denomB = 0;

  for (let i = 0; i < n; i++) {
    const diffA = a[i] - meanA;
    const diffB = b[i] - meanB;

    numerator += diffA * diffB;

    denomA += diffA * diffA;
    denomB += diffB * diffB;
  }

  return (
    numerator /
    Math.sqrt(
      denomA * denomB
    )
  );
}