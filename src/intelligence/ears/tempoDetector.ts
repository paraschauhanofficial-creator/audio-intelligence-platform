import { analyze } from "web-audio-beat-detector";

export async function detectTempo(
  file: File
) {
  try {

    console.log(
      "[Aura Ears] Tempo analysis started"
    );

    const arrayBuffer =
      await file.arrayBuffer();

    const audioContext =
      new AudioContext();

    const audioBuffer =
      await audioContext.decodeAudioData(
        arrayBuffer
      );

    const bpm =
      await analyze(audioBuffer);

    const tempo =
      Math.round(bpm);

    const timeSignature =
      "4/4";

    console.log(
      "[Aura Ears] BPM:",
      tempo
    );

    console.log(
      "[Aura Ears] Time Signature:",
      timeSignature
    );

    return {
      tempo,
      timeSignature,
    };

  } catch (error) {

    console.error(
      "[Aura Ears] Tempo Error:",
      error
    );

    return {
      tempo: null,
      timeSignature: null,
    };
  }
}