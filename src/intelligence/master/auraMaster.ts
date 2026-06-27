import { detectLUFS } from "../ears/lufsDetector";

import { detectPeaks } from "../ears/peakDetector";
import { analyzeDynamics } from "../ears/dynamicAnalyzer";

const TARGET_LUFS = -14;
const TRUE_PEAK_CEILING = -1; // dBTP

export interface MasterResult {
  masterBlob: Blob;
  lufs: number | null;
  truePeak: number | null;
  dynamicRange: number | null;
  rms: number | null;
}

export async function auraMaster(file: File): Promise<MasterResult> {
  console.log("[Aura Master] Starting mastering chain...");

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

  // ── STEP 2: Input Gain — push toward -14 LUFS ───────────────
  console.log("[Aura Master] Step 2 — Applying input gain...");
  const gainDB = TARGET_LUFS - inputLUFS;
  const gainLinear = Math.pow(10, gainDB / 20);
  console.log(`[Aura Master] Gain: ${gainDB.toFixed(2)} dB (${gainLinear.toFixed(3)}x)`);

  for (let c = 0; c < numberOfChannels; c++) {
    for (let i = 0; i < length; i++) {
      channels[c][i] *= gainLinear;
    }
  }

  // ── STEP 3: Low Shelf -1.5dB at 100Hz — reduce mud ─────────
  console.log("[Aura Master] Step 3 — Low shelf EQ (-1.5dB @ 100Hz)...");
  for (let c = 0; c < numberOfChannels; c++) {
    channels[c] = applyLowShelf(channels[c], sampleRate, 100, -1.5);
  }

  // ── STEP 4: High Shelf +1.5dB at 10kHz — add air ───────────
  console.log("[Aura Master] Step 4 — High shelf EQ (+1.5dB @ 10kHz)...");
  for (let c = 0; c < numberOfChannels; c++) {
    channels[c] = applyHighShelf(channels[c], sampleRate, 10000, 1.5);
  }

  // ── STEP 5: Soft Clipper — warmth before limiter ────────────
  console.log("[Aura Master] Step 5 — Soft saturation...");
  for (let c = 0; c < numberOfChannels; c++) {
    channels[c] = applySoftClipper(channels[c], 0.95);
  }

  // ── STEP 6: Brickwall Limiter — ceiling at -1 dBTP ──────────
  console.log("[Aura Master] Step 6 — Brickwall limiting...");
  const ceilingLinear = Math.pow(10, TRUE_PEAK_CEILING / 20);
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

  return {
    masterBlob,
    lufs: parseFloat(outputLUFS.toFixed(2)),
    truePeak: parseFloat(outputPeakDB.toFixed(2)),
    dynamicRange: outputDR ? parseFloat(outputDR.toFixed(2)) : null,
    rms: parseFloat(outputRMS.toFixed(2)),
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