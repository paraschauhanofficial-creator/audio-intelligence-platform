import { NOTES } from "./musicTheory";

export function getAllScales() {

  const scales = [];

  const majorPattern = [
    0, 2, 4, 5, 7, 9, 11,
  ];

  const minorPattern = [
    0, 2, 3, 5, 7, 8, 10,
  ];

  for (
    let root = 0;
    root < NOTES.length;
    root++
  ) {

    scales.push({
      key: NOTES[root],
      scale: "Major",
      notes: majorPattern.map(
        (step) =>
          NOTES[
            (root + step) % 12
          ]
      ),
    });

    scales.push({
      key: NOTES[root],
      scale: "Minor",
      notes: minorPattern.map(
        (step) =>
          NOTES[
            (root + step) % 12
          ]
      ),
    });
  }

  return scales;
}

export function findMatchingScales(
  detectedNotes: string[]
) {

  const scales =
    getAllScales();

  return scales
    .map((scale) => {

      const matches =
        detectedNotes.filter(
          (note) =>
            scale.notes.includes(
              note
            )
        ).length;

      return {
        ...scale,
        matches,
      };
    })
    .sort(
      (a, b) =>
        b.matches -
        a.matches
    );
}