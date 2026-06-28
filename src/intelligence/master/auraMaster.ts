import { detectLUFS } from "../ears/lufsDetector";

import { detectPeaks } from "../ears/peakDetector";
import { analyzeDynamics } from "../ears/dynamicAnalyzer";



export interface MasterParams {
  inputGain?: number;
  lowShelfGain?: number;
  lowShelfFreq?: number;
  highShelfGain?: number;
  highShelfFreq?: number;
  saturationDrive?: number;
  limiterCeiling?: number;
  targetLUFS?: number;
}

export interface MasterResult {
  masterBlob: Blob;
  lufs: number | null;
  truePeak: number | null;
  dynamicRange: number | null;
  rms: number | null;
  freqSub: number | null;
  freqBass: number | null;
  freqLowMid: number | null;
  freqMid: number | null;
  freqHighMid: number | null;
  freqAir: number | null;
  stereoCorrelation: number | null;
  stereoWidth: number | null;
  // Chain params used
  inputGain: number;
  lowShelfGain: number;
  lowShelfFreq: number;
  highShelfGain: number;
  highShelfFreq: number;
  saturationDrive: number;
  limiterCeiling: number;
  targetLUFS: number;
}

export async function auraMaster(
  file: File,
  params?: MasterParams
): Promise<MasterResult> {
  // Use provided params or defaults
  const targetLUFS = params?.targetLUFS ?? -14;
  const limiterCeiling = params?.limiterCeiling ?? -1;
  const lowShelfGain = params?.lowShelfGain ?? -1.5;
  const lowShelfFreq = params?.lowShelfFreq ?? 100;
  const highShelfGain = params?.highShelfGain ?? 1.5;
  const highShelfFreq = params?.highShelfFreq ?? 10000;
  const saturationDrive = params?.saturationDrive ?? 0.95;

  console.log("[Aura Master] Starting mastering chain...", {
    targetLUFS, limiterCeiling, lowShelfGain, lowShelfFreq,
    highShelfGain, highShelfFreq, saturationDrive
  });

  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;

  // Get channel data for all channels
  const channels: Float32Array<ArrayBuffer>[] = [];
for (let c = 0; c < numberOfChannels; c++) {
  const channelData = audioBuffer.getChannelData(c);
  const copy = new Float32Array(channelData.length);
  copy.set(channelData);
  channels.push(copy);
}

  // ── STEP 1: Measure input LUFS ──────────────────────────────
  console.log("[Aura Master] Step 1 — Measuring input loudness...");
  const inputLUFS = await measureLUFS(channels, sampleRate);
  console.log(`[Aura Master] Input LUFS: ${inputLUFS.toFixed(2)}`);

  // ── STEP 2: Input Gain — push toward target LUFS ────────────
  console.log("[Aura Master] Step 2 — Applying input gain...");
  const gainDB = params?.inputGain ?? (targetLUFS - inputLUFS);
  const gainLinear = Math.pow(10, gainDB / 20);
  console.log(`[Aura Master] Gain: ${gainDB.toFixed(2)} dB (${gainLinear.toFixed(3)}x)`);

  for (let c = 0; c < numberOfChannels; c++) {
    for (let i = 0; i < length; i++) {
      channels[c][i] *= gainLinear;
    }
  }

  // ── STEP 3: Low Shelf — reduce mud ──────────────────────────
  console.log(`[Aura Master] Step 3 — Low shelf EQ (${lowShelfGain}dB @ ${lowShelfFreq}Hz)...`);
  for (let c = 0; c < numberOfChannels; c++) {
    channels[c] = applyLowShelf(channels[c], sampleRate, lowShelfFreq, lowShelfGain);
  }

  // ── STEP 4: High Shelf — add air ────────────────────────────
  console.log(`[Aura Master] Step 4 — High shelf EQ (+${highShelfGain}dB @ ${highShelfFreq}Hz)...`);
  for (let c = 0; c < numberOfChannels; c++) {
    channels[c] = applyHighShelf(channels[c], sampleRate, highShelfFreq, highShelfGain);
  }

  // ── STEP 5: Soft Clipper ─────────────────────────────────────
  console.log(`[Aura Master] Step 5 — Soft saturation (drive: ${saturationDrive})...`);
  for (let c = 0; c < numberOfChannels; c++) {
    channels[c] = applySoftClipper(channels[c], saturationDrive);
  }

  // ── STEP 6: Brickwall Limiter ────────────────────────────────
  console.log(`[Aura Master] Step 6 — Brickwall limiting (ceiling: ${limiterCeiling} dBTP)...`);
  const ceilingLinear = Math.pow(10, limiterCeiling / 20);
  for (let c = 0; c < numberOfChannels; c++) {
    channels[c] = applyLimiter(channels[c], ceilingLinear);
  }

  // ── STEP 7: Measure output ───────────────────────────────────
  console.log("[Aura Master] Step 7 — Measuring output...");
  const outputLUFS = await measureLUFS(channels, sampleRate);
  let outputPeak = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      if (Math.abs(ch[i]) > outputPeak) outputPeak = Math.abs(ch[i]);
    }
  }
  const outputPeakDB = 20 * Math.log10(outputPeak);

  // RMS
  let rmsSum = 0;
  let rmsCount = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      rmsSum += ch[i] * ch[i];
      rmsCount++;
    }
  }
  const outputRMS = 20 * Math.log10(Math.sqrt(rmsSum / rmsCount));

  // Dynamic range — 500ms windows
  const windowSize = Math.round(0.5 * sampleRate);
  const windowRMS: number[] = [];
  for (let start = 0; start + windowSize <= length; start += windowSize) {
    let wSum = 0;
    for (const ch of channels) {
      for (let i = start; i < start + windowSize; i++) {
        wSum += ch[i] * ch[i];
      }
    }
    const wRMS = Math.sqrt(wSum / (windowSize * numberOfChannels));
    if (wRMS > 0.001) windowRMS.push(20 * Math.log10(wRMS));
  }
  windowRMS.sort((a, b) => a - b);
  const outputDR = windowRMS.length > 1
    ? windowRMS[windowRMS.length - 1] - windowRMS[0]
    : null;

  console.log("[Aura Master] Output:", {
    lufs: outputLUFS.toFixed(2),
    truePeak: outputPeakDB.toFixed(2),
    rms: outputRMS.toFixed(2),
    dr: outputDR?.toFixed(2),
  });

  // ── STEP 8: Export to WAV blob ───────────────────────────────
  console.log("[Aura Master] Step 8 — Exporting WAV...");
  const masterBuffer = audioContext.createBuffer(
    numberOfChannels,
    length,
    sampleRate
  );
  for (let c = 0; c < numberOfChannels; c++) {
    masterBuffer.copyToChannel(channels[c], c);
  }

  const masterBlob = await encodeWAV(masterBuffer);

  console.log("[Aura Master] Mastering complete.");

  // Measure master frequency and stereo directly from processed channels
  console.log("[Aura Master] Measuring master frequency...");
  const masterFreq = analyzeChannelsFrequency(channels, sampleRate);
  const masterStereo = analyzeChannelsStereo(channels);
  console.log("[Aura Master] Master Frequency:", masterFreq);
  console.log("[Aura Master] Master Stereo:", masterStereo);

  return {
    masterBlob,
    lufs: parseFloat(outputLUFS.toFixed(2)),
    truePeak: parseFloat(outputPeakDB.toFixed(2)),
    dynamicRange: outputDR ? parseFloat(outputDR.toFixed(2)) : null,
    rms: parseFloat(outputRMS.toFixed(2)),
    freqSub: masterFreq.sub,
    freqBass: masterFreq.bass,
    freqLowMid: masterFreq.lowMid,
    freqMid: masterFreq.mid,
    freqHighMid: masterFreq.highMid,
    freqAir: masterFreq.air,
    stereoCorrelation: masterStereo.correlation,
    stereoWidth: masterStereo.stereoWidth,
    // Chain params used
    inputGain: parseFloat(gainDB.toFixed(2)),
    lowShelfGain,
    lowShelfFreq,
    highShelfGain,
    highShelfFreq,
    saturationDrive,
    limiterCeiling,
    targetLUFS,
  };
}

// ── DSP FUNCTIONS ─────────────────────────────────────────────

// Measure integrated LUFS from raw channel arrays
async function measureLUFS(
  channels: Float32Array[],
  sampleRate: number
): Promise<number> {
  const momentarySize = Math.round(0.4 * sampleRate);
  const hopSize = Math.round(0.1 * sampleRate);
  const length = channels[0].length;
  const blocks: number[] = [];

  for (let start = 0; start + momentarySize <= length; start += hopSize) {
    let sum = 0;
    let count = 0;
    for (const ch of channels) {
      for (let i = start; i < start + momentarySize; i++) {
        sum += ch[i] * ch[i];
        count++;
      }
    }
    const ms = sum / count;
    if (ms > 0) blocks.push(-0.691 + 10 * Math.log10(ms));
  }

  const absGated = blocks.filter(l => l > -70);
  const ungatedPower = absGated.reduce((s, l) => s + Math.pow(10, l / 10), 0) / absGated.length;
  const relThreshold = 10 * Math.log10(ungatedPower) - 10;
  const relGated = absGated.filter(l => l > relThreshold);
  const power = relGated.reduce((s, l) => s + Math.pow(10, l / 10), 0) / relGated.length;

  // Apply same calibration offset as lufsDetector
  return -0.691 + 10 * Math.log10(power) + 3.8;
}

// Low shelf filter
function applyLowShelf(
  data: Float32Array,
  sampleRate: number,
  frequency: number,
  gainDB: number
): Float32Array<ArrayBuffer> {
  const A = Math.pow(10, gainDB / 40);
  const w0 = 2 * Math.PI * frequency / sampleRate;
  const alpha = Math.sin(w0) / (2 * 0.7071);

  const b0 = A * ((A+1) - (A-1)*Math.cos(w0) + 2*Math.sqrt(A)*alpha);
  const b1 = 2*A * ((A-1) - (A+1)*Math.cos(w0));
  const b2 = A * ((A+1) - (A-1)*Math.cos(w0) - 2*Math.sqrt(A)*alpha);
  const a0 = (A+1) + (A-1)*Math.cos(w0) + 2*Math.sqrt(A)*alpha;
  const a1 = -2 * ((A-1) + (A+1)*Math.cos(w0));
  const a2 = (A+1) + (A-1)*Math.cos(w0) - 2*Math.sqrt(A)*alpha;

  const output = new Float32Array(data.length);
  let x1=0, x2=0, y1=0, y2=0;
  for (let i = 0; i < data.length; i++) {
    const x0 = data[i];
    const y0 = (b0/a0)*x0 + (b1/a0)*x1 + (b2/a0)*x2
             - (a1/a0)*y1 - (a2/a0)*y2;
    output[i] = y0;
    x2=x1; x1=x0; y2=y1; y1=y0;
  }
  return output;
}

// High shelf filter
function applyHighShelf(
  data: Float32Array,
  sampleRate: number,
  frequency: number,
  gainDB: number
): Float32Array<ArrayBuffer> {
  const A = Math.pow(10, gainDB / 40);
  const w0 = 2 * Math.PI * frequency / sampleRate;
  const alpha = Math.sin(w0) / (2 * 0.7071);

  const b0 = A * ((A+1) + (A-1)*Math.cos(w0) + 2*Math.sqrt(A)*alpha);
  const b1 = -2*A * ((A-1) + (A+1)*Math.cos(w0));
  const b2 = A * ((A+1) + (A-1)*Math.cos(w0) - 2*Math.sqrt(A)*alpha);
  const a0 = (A+1) - (A-1)*Math.cos(w0) + 2*Math.sqrt(A)*alpha;
  const a1 = 2 * ((A-1) - (A+1)*Math.cos(w0));
  const a2 = (A+1) - (A-1)*Math.cos(w0) - 2*Math.sqrt(A)*alpha;

  const output = new Float32Array(data.length);
  let x1=0, x2=0, y1=0, y2=0;
  for (let i = 0; i < data.length; i++) {
    const x0 = data[i];
    const y0 = (b0/a0)*x0 + (b1/a0)*x1 + (b2/a0)*x2
             - (a1/a0)*y1 - (a2/a0)*y2;
    output[i] = y0;
    x2=x1; x1=x0; y2=y1; y1=y0;
  }
  return output;
}

// Soft clipper — gentle waveshaping
function applySoftClipper(
  data: Float32Array,
  threshold: number
): Float32Array<ArrayBuffer> {
  const output = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    const abs = Math.abs(x);
    if (abs <= threshold) {
      output[i] = x;
    } else {
      // Soft knee above threshold
      const sign = x > 0 ? 1 : -1;
      output[i] = sign * (threshold + (1 - threshold) *
        Math.tanh((abs - threshold) / (1 - threshold)));
    }
  }
  return output;
}

// Brickwall limiter — lookahead peak limiting
function applyLimiter(
  data: Float32Array,
  ceiling: number
): Float32Array<ArrayBuffer> {
  const output = new Float32Array(data.length);
  const attackTime = 64;   // samples
  const releaseTime = 4410; // samples (~100ms at 44100)
  let gain = 1.0;

  for (let i = 0; i < data.length; i++) {
    const abs = Math.abs(data[i]);
    const targetGain = abs > ceiling ? ceiling / abs : 1.0;

    if (targetGain < gain) {
      // Attack — fast gain reduction
      gain = gain + (targetGain - gain) / attackTime;
    } else {
      // Release — slow gain recovery
      gain = gain + (targetGain - gain) / releaseTime;
    }

    output[i] = data[i] * Math.min(gain, 1.0);
  }

  return output;
}

// MP3 encoding using MediaRecorder API (built into browser, no library needed)
export async function encodeMp3(audioBuffer: AudioBuffer): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const audioContext = new AudioContext({
        sampleRate: audioBuffer.sampleRate,
      });

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;

      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";

      const recorder = new MediaRecorder(destination.stream, {
        mimeType,
        audioBitsPerSecond: 320000,
      });

      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: "audio/mpeg" }));
        audioContext.close();
      };

      recorder.onerror = reject;

      recorder.start(100);
      source.start(0);

      setTimeout(() => {
        recorder.stop();
        source.stop();
      }, (audioBuffer.duration + 0.5) * 1000);

    } catch (err) {
      reject(err);
    }
  });
}

// WAV encoder
function encodeWAV(audioBuffer: AudioBuffer): Promise<Blob> {
  return new Promise((resolve) => {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const bufferSize = 44 + dataSize;

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    // Interleave channels and write samples
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let c = 0; c < numberOfChannels; c++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(c)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    resolve(new Blob([buffer], { type: "audio/wav" }));
  });
}

// Measure frequency bands directly from processed channel arrays
function analyzeChannelsFrequency(
  channels: Float32Array<ArrayBuffer>[],
  sampleRate: number
) {
  const BANDS = [
    { name: "sub",     lo: 20,   hi: 60    },
    { name: "bass",    lo: 60,   hi: 200   },
    { name: "lowMid",  lo: 200,  hi: 500   },
    { name: "mid",     lo: 500,  hi: 2000  },
    { name: "highMid", lo: 2000, hi: 6000  },
    { name: "air",     lo: 6000, hi: 20000 },
  ];

  const fftSize = 8192;
  const hopSize = 4096;
  const freqResolution = sampleRate / fftSize;
  const channelData = channels[0];

  const hann = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
  }

  const bandEnergy: Record<string, number> = {
    sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, air: 0
  };
  let windowCount = 0;

  for (let start = 0; start + fftSize <= channelData.length; start += hopSize) {
    const windowed = new Float32Array(fftSize);
    let energy = 0;
    for (let i = 0; i < fftSize; i++) {
      windowed[i] = channelData[start + i] * hann[i];
      energy += windowed[i] * windowed[i];
    }
    if (energy / fftSize < 0.00001) continue;

    const spectrum = computeMasterFFT(windowed);
    windowCount++;

    for (const band of BANDS) {
      let sum = 0;
      const loBin = Math.floor(band.lo / freqResolution);
      const hiBin = Math.min(Math.ceil(band.hi / freqResolution), spectrum.length - 1);
      for (let b = loBin; b <= hiBin; b++) {
        sum += spectrum[b] * spectrum[b];
      }
      bandEnergy[band.name] += sum / (hiBin - loBin + 1);
    }
  }

  if (windowCount === 0) {
    return { sub: null, bass: null, lowMid: null, mid: null, highMid: null, air: null };
  }

  const toDb = (v: number) =>
    v > 0 ? parseFloat((10 * Math.log10(v / windowCount)).toFixed(2)) : null;

  return {
    sub:     toDb(bandEnergy.sub),
    bass:    toDb(bandEnergy.bass),
    lowMid:  toDb(bandEnergy.lowMid),
    mid:     toDb(bandEnergy.mid),
    highMid: toDb(bandEnergy.highMid),
    air:     toDb(bandEnergy.air),
  };
}

// Measure stereo directly from processed channel arrays
function analyzeChannelsStereo(channels: Float32Array<ArrayBuffer>[]) {
  if (channels.length < 2) return { correlation: 1.0, stereoWidth: 0 };

  const left = channels[0];
  const right = channels[1];
  const length = left.length;

  let sumL = 0, sumR = 0;
  for (let i = 0; i < length; i++) { sumL += left[i]; sumR += right[i]; }
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

  let midRMS = 0, sideRMS = 0;
  for (let i = 0; i < length; i++) {
    const mid = (left[i] + right[i]) * 0.5;
    const side = (left[i] - right[i]) * 0.5;
    midRMS += mid * mid;
    sideRMS += side * side;
  }
  midRMS = Math.sqrt(midRMS / length);
  sideRMS = Math.sqrt(sideRMS / length);

  const stereoWidth = midRMS > 0
    ? parseFloat(Math.min(100, (sideRMS / midRMS) * 100).toFixed(1))
    : 0;

  return { correlation, stereoWidth };
}

// FFT for master frequency analysis
function computeMasterFFT(signal: Float32Array): Float32Array {
  const n = signal.length;
  const real = new Float32Array(signal);
  const imag = new Float32Array(n);

  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curReal = 1, curImag = 0;
      for (let k = 0; k < len / 2; k++) {
        const uReal = real[i + k];
        const uImag = imag[i + k];
        const vReal = real[i + k + len / 2] * curReal - imag[i + k + len / 2] * curImag;
        const vImag = real[i + k + len / 2] * curImag + imag[i + k + len / 2] * curReal;
        real[i + k] = uReal + vReal;
        imag[i + k] = uImag + vImag;
        real[i + k + len / 2] = uReal - vReal;
        imag[i + k + len / 2] = uImag - vImag;
        const nextReal = curReal * wReal - curImag * wImag;
        curImag = curReal * wImag + curImag * wReal;
        curReal = nextReal;
      }
    }
  }

  const magnitude = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    magnitude[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }
  return magnitude;
}