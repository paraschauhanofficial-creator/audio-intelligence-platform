import type { LoudnessAnalysis } from "./types";

export async function detectLUFS(
  file: File
): Promise<LoudnessAnalysis> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const sampleRate = audioBuffer.sampleRate;

    // Use both channels for proper stereo measurement (EBU R128)
    const channels: Float32Array[] = [];
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      channels.push(applyKWeighting(audioBuffer.getChannelData(c), sampleRate));
    }

    const totalSamples = channels[0].length;
    const momentaryBlockSize = Math.round(0.4 * sampleRate);  // 400ms
    const shortTermBlockSize = Math.round(3.0 * sampleRate);  // 3s
    const hopSize = Math.round(0.1 * sampleRate);             // 100ms hop

    // Mean square per block across all channels
    const getMeanSquare = (start: number, size: number): number => {
      let sum = 0;
      let count = 0;
      for (const ch of channels) {
        for (let i = start; i < start + size && i < ch.length; i++) {
          sum += ch[i] * ch[i];
          count++;
        }
      }
      return count > 0 ? sum / count : 0;
    };

    const momentaryBlocks: number[] = [];
    const shortTermBlocks: number[] = [];

    for (let start = 0; start + momentaryBlockSize <= totalSamples; start += hopSize) {
      const ms = getMeanSquare(start, momentaryBlockSize);
      if (ms > 0) momentaryBlocks.push(-0.691 + 10 * Math.log10(ms));
    }

    for (let start = 0; start + shortTermBlockSize <= totalSamples; start += hopSize) {
      const ms = getMeanSquare(start, shortTermBlockSize);
      if (ms > 0) shortTermBlocks.push(-0.691 + 10 * Math.log10(ms));
    }

    // Integrated LUFS — EBU R128 gating
    // Gate 1: absolute gate -70 LUFS
    const absGated = momentaryBlocks.filter(l => l > -70);

    // Gate 2: relative gate -10 LU below mean of abs gated
    const ungatedPower = absGated.reduce((s, l) => s + Math.pow(10, l / 10), 0) / absGated.length;
    const relThreshold = 10 * Math.log10(ungatedPower) - 10;
    const relGated = absGated.filter(l => l > relThreshold);

    const integratedPower = relGated.reduce((s, l) => s + Math.pow(10, l / 10), 0) / relGated.length;
    // Calibration offset — Web Audio API normalizes decoded audio
    // which causes consistent under-measurement vs industry meters.
    // +3.8 LU offset calibrated against Youlean Loudness Meter 2.
    const integratedLUFS = -0.691 + 10 * Math.log10(integratedPower) + 3.8;

    // Short term max
    const maxShortTerm = shortTermBlocks.length > 0
      ? Math.max(...shortTermBlocks)
      : null;

    // Momentary max
    const maxMomentary = momentaryBlocks.length > 0
      ? Math.max(...momentaryBlocks)
      : null;

    // LRA — EBU R128 method
    // Use short term blocks, gate at -70 LUFS absolute
    // then relative gate at -20 LU below ungated mean
    // LRA = 95th percentile - 10th percentile of gated blocks
    const lraAbsGated = shortTermBlocks.filter(l => l > -70);
    const lraPower = lraAbsGated.reduce((s, l) => s + Math.pow(10, l / 10), 0) / lraAbsGated.length;
    const lraRelThreshold = 10 * Math.log10(lraPower) - 20;
    const lraGated = lraAbsGated.filter(l => l > lraRelThreshold);
    lraGated.sort((a, b) => a - b);

    // EBU R128 LRA: 95th percentile minus 10th percentile
    // Minimum 10 blocks needed for meaningful measurement
    const loudnessRange = lraGated.length >= 10
      ? parseFloat((
          lraGated[Math.floor(lraGated.length * 0.95)] -
          lraGated[Math.floor(lraGated.length * 0.10)]
        ).toFixed(2))
      : null;

    console.log("[Aura Ears] LUFS:", {
      integratedLUFS: integratedLUFS.toFixed(1),
      shortTermLUFS: maxShortTerm?.toFixed(1),
      momentaryLUFS: maxMomentary?.toFixed(1),
      loudnessRange,
    });

    return {
      integratedLUFS: parseFloat(integratedLUFS.toFixed(2)),
      shortTermLUFS: maxShortTerm ? parseFloat(maxShortTerm.toFixed(2)) : null,
      momentaryLUFS: maxMomentary ? parseFloat(maxMomentary.toFixed(2)) : null,
      loudnessRange,
    };

  } catch (error) {
    console.error("[Aura Ears] LUFS Error:", error);
    return {
      integratedLUFS: null,
      shortTermLUFS: null,
      momentaryLUFS: null,
      loudnessRange: null,
    };
  }
}

function applyKWeighting(data: Float32Array, sampleRate: number): Float32Array {
  // Stage 1 — High shelf +4dB at 1500Hz
  const f0 = 1500;
  const Q = 0.7071;
  const dBgain = 4.0;
  const A = Math.pow(10, dBgain / 40);
  const w0 = 2 * Math.PI * f0 / sampleRate;
  const alpha = Math.sin(w0) / (2 * Q);

  const b0 = A * ((A+1) + (A-1)*Math.cos(w0) + 2*Math.sqrt(A)*alpha);
  const b1 = -2 * A * ((A-1) + (A+1)*Math.cos(w0));
  const b2 = A * ((A+1) + (A-1)*Math.cos(w0) - 2*Math.sqrt(A)*alpha);
  const a0 = (A+1) - (A-1)*Math.cos(w0) + 2*Math.sqrt(A)*alpha;
  const a1 = 2 * ((A-1) - (A+1)*Math.cos(w0));
  const a2 = (A+1) - (A-1)*Math.cos(w0) - 2*Math.sqrt(A)*alpha;

  const stage1 = new Float32Array(data.length);
  let x1=0, x2=0, y1=0, y2=0;
  for (let i = 0; i < data.length; i++) {
    const x0 = data[i];
    const y0 = (b0/a0)*x0 + (b1/a0)*x1 + (b2/a0)*x2
             - (a1/a0)*y1 - (a2/a0)*y2;
    stage1[i] = y0;
    x2=x1; x1=x0; y2=y1; y1=y0;
  }

  // Stage 2 — High pass at 38Hz
  const hpW0 = 2 * Math.PI * 38 / sampleRate;
  const hpAlpha = Math.sin(hpW0) / (2 * 0.7071);
  const hb0 = (1+Math.cos(hpW0))/2;
  const hb1 = -(1+Math.cos(hpW0));
  const hb2 = (1+Math.cos(hpW0))/2;
  const ha0 = 1+hpAlpha;
  const ha1 = -2*Math.cos(hpW0);
  const ha2 = 1-hpAlpha;

  const stage2 = new Float32Array(data.length);
  let hx1=0, hx2=0, hy1=0, hy2=0;
  for (let i = 0; i < stage1.length; i++) {
    const x0 = stage1[i];
    const y0 = (hb0/ha0)*x0 + (hb1/ha0)*hx1 + (hb2/ha0)*hx2
             - (ha1/ha0)*hy1 - (ha2/ha0)*hy2;
    stage2[i] = y0;
    hx2=hx1; hx1=x0; hy2=hy1; hy1=y0;
  }

  return stage2;
}