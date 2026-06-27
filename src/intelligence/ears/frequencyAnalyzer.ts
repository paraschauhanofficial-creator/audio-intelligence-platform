import type { FrequencyAnalysis } from "./types";

// Frequency bands — industry standard divisions
const BANDS = [
  { name: "sub",     lo: 20,   hi: 60   },
  { name: "bass",    lo: 60,   hi: 200  },
  { name: "lowMid",  lo: 200,  hi: 500  },
  { name: "mid",     lo: 500,  hi: 2000 },
  { name: "highMid", lo: 2000, hi: 6000 },
  { name: "air",     lo: 6000, hi: 20000},
];

export async function analyzeFrequency(
  file: File
): Promise<FrequencyAnalysis> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);

    const fftSize = 8192;
    const hopSize = 4096;
    const freqResolution = sampleRate / fftSize;

    // Hann window
    const hann = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    }

    // Accumulate energy per band
    const bandEnergy: Record<string, number> = {
      sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, air: 0
    };
    let windowCount = 0;

    for (
      let start = 0;
      start + fftSize <= channelData.length;
      start += hopSize
    ) {
      const windowed = new Float32Array(fftSize);
      let energy = 0;
      for (let i = 0; i < fftSize; i++) {
        windowed[i] = channelData[start + i] * hann[i];
        energy += windowed[i] * windowed[i];
      }
      if (energy / fftSize < 0.00001) continue;

      const spectrum = computeFFT(windowed);
      windowCount++;

      for (const band of BANDS) {
        let sum = 0;
        const loBin = Math.floor(band.lo / freqResolution);
        const hiBin = Math.min(
          Math.ceil(band.hi / freqResolution),
          spectrum.length - 1
        );
        for (let b = loBin; b <= hiBin; b++) {
          sum += spectrum[b] * spectrum[b]; // power
        }
        bandEnergy[band.name] += sum / (hiBin - loBin + 1);
      }
    }

    if (windowCount === 0) {
      return { sub: null, bass: null, lowMid: null, mid: null, highMid: null, air: null };
    }

    // Average across windows and convert to dBFS
    const toDb = (v: number) =>
      v > 0 ? parseFloat((10 * Math.log10(v / windowCount)).toFixed(2)) : null;

    const result: FrequencyAnalysis = {
      sub:     toDb(bandEnergy.sub),
      bass:    toDb(bandEnergy.bass),
      lowMid:  toDb(bandEnergy.lowMid),
      mid:     toDb(bandEnergy.mid),
      highMid: toDb(bandEnergy.highMid),
      air:     toDb(bandEnergy.air),
    };

    console.log("[Aura Ears] Frequency Analysis:", result);
    return result;

  } catch (error) {
    console.error("[Aura Ears] Frequency Analysis Error:", error);
    return { sub: null, bass: null, lowMid: null, mid: null, highMid: null, air: null };
  }
}

function computeFFT(signal: Float32Array): Float32Array {
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