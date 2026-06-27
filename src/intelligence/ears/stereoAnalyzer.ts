import type { StereoAnalysis } from "./types";

export async function analyzeStereo(
  file: File
): Promise<StereoAnalysis> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Need stereo — if mono, return defaults
    if (audioBuffer.numberOfChannels < 2) {
      console.log("[Aura Ears] Mono file — stereo analysis skipped");
      return { correlation: 1.0, stereoWidth: 0 };
    }

    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    const length = left.length;

    // Stereo correlation — Pearson between L and R
    // +1 = perfect mono, 0 = uncorrelated, -1 = phase cancelled
    let sumL = 0, sumR = 0;
    for (let i = 0; i < length; i++) {
      sumL += left[i];
      sumR += right[i];
    }
    const meanL = sumL / length;
    const meanR = sumR / length;

    let numerator = 0, denomL = 0, denomR = 0;
    for (let i = 0; i < length; i++) {
      const dL = left[i] - meanL;
      const dR = right[i] - meanR;
      numerator += dL * dR;
      denomL += dL * dL;
      denomR += dR * dR;
    }

    const correlation = parseFloat(
      (numerator / Math.sqrt(denomL * denomR)).toFixed(3)
    );

    // Stereo width — based on mid/side energy ratio
    // Mid = L+R, Side = L-R
    // Width = Side RMS / Mid RMS
    let midRMS = 0, sideRMS = 0;
    for (let i = 0; i < length; i++) {
      const mid = (left[i] + right[i]) * 0.5;
      const side = (left[i] - right[i]) * 0.5;
      midRMS += mid * mid;
      sideRMS += side * side;
    }
    midRMS = Math.sqrt(midRMS / length);
    sideRMS = Math.sqrt(sideRMS / length);

    // Width as percentage 0-100
    const stereoWidth = midRMS > 0
      ? parseFloat(Math.min(100, (sideRMS / midRMS) * 100).toFixed(1))
      : 0;

    // Also generate Lissajous sample points for display
    // Sample every N frames for performance
    const sampleRate = 500; // points to sample
    const step = Math.floor(length / sampleRate);
    const lissajousPoints: { x: number; y: number }[] = [];
    for (let i = 0; i < length; i += step) {
      lissajousPoints.push({ x: left[i], y: right[i] });
    }

    console.log("[Aura Ears] Stereo Analysis:", { correlation, stereoWidth });

    return {
      correlation,
      stereoWidth,
      // @ts-ignore — extended for display, not in base type
      lissajousPoints,
    };

  } catch (error) {
    console.error("[Aura Ears] Stereo Analysis Error:", error);
    return { correlation: null, stereoWidth: null };
  }
}
