import Pitchfinder from "pitchfinder";

const detectPitch =
  Pitchfinder.YIN();

export async function extractChroma(
  audioBuffer: AudioBuffer
) {
  const channelData =
    audioBuffer.getChannelData(0);

  const sampleRate =
    audioBuffer.sampleRate;

  const histogram =
    new Array(12).fill(0);

  const windowSize = 2048;

  for (
    let i = 0;
    i < channelData.length;
    i += windowSize * 10
  ) {
    const slice =
      channelData.slice(
        i,
        i + windowSize
      );

    const frequency =
      detectPitch(slice);

    if (!frequency) {
      continue;
    }

    const midi =
      Math.round(
        69 +
        12 *
          Math.log2(
            frequency / 440
          )
      );

    const noteIndex =
      ((midi % 12) + 12) % 12;

    histogram[noteIndex]++;
  }

  return histogram;
}