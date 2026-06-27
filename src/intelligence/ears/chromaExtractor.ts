export async function extractChroma(
  audioBuffer: AudioBuffer
): Promise<{ energy: number[]; consistency: number[]; combined: number[] }> {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);

  const fftSize = 8192;
  const hopSize = 4096;
  const freqResolution = sampleRate / fftSize;

  const hannWindow = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
  }

  const totalEnergy = new Array(12).fill(0);
  const presenceCount = new Array(12).fill(0);
  let totalWindows = 0;

  for (
    let start = 0;
    start + fftSize <= channelData.length;
    start += hopSize
  ) {
    const windowed = new Float32Array(fftSize);
    let energy = 0;

    for (let i = 0; i < fftSize; i++) {
      windowed[i] = channelData[start + i] * hannWindow[i];
      energy += windowed[i] * windowed[i];
    }

    if (energy / fftSize < 0.0001) continue;

    totalWindows++;
    const spectrum = computeFFT(windowed);
    const local = new Array(12).fill(0);

    for (let bin = 0; bin < spectrum.length; bin++) {
      const freq = bin * freqResolution;
      if (freq < 200 || freq > 5000) continue;
      const midi = 69 + 12 * Math.log2(freq / 440);
      const chroma = ((Math.floor(midi + 0.5) % 12) + 12) % 12;
      local[chroma] += spectrum[bin];
    }

    // Harmonic suppression
    const suppressed = [...local];
    for (let i = 0; i < 12; i++) {
      suppressed[(i + 3) % 12] = Math.max(0, suppressed[(i + 3) % 12] - local[i] * 0.3);
      suppressed[(i + 4) % 12] = Math.max(0, suppressed[(i + 4) % 12] - local[i] * 0.25);
      suppressed[(i + 7) % 12] = Math.max(0, suppressed[(i + 7) % 12] - local[i] * 0.2);
    }

    for (let i = 0; i < 12; i++) {
      totalEnergy[i] += suppressed[i];
    }

    // Consistency — count windows where note is above 10% of window max
    const windowMax = Math.max(...suppressed);
    if (windowMax > 0) {
      const threshold = windowMax * 0.1;
      for (let i = 0; i < 12; i++) {
        if (suppressed[i] > threshold) presenceCount[i]++;
      }
    }
  }

  // Normalize energy
  const maxEnergy = Math.max(...totalEnergy);
  const energyNorm = totalEnergy.map((v) => (maxEnergy > 0 ? v / maxEnergy : 0));

  // Consistency = fraction of windows note appeared in
  const consistency = presenceCount.map((v) =>
    totalWindows > 0 ? v / totalWindows : 0
  );

  // Combined = energy × consistency
  const combined = energyNorm.map((e, i) => e * consistency[i]);
  const maxCombined = Math.max(...combined);
  const combinedNorm = combined.map((v) => (maxCombined > 0 ? v / maxCombined : 0));

  return {
    energy: energyNorm,
    consistency,
    combined: combinedNorm,
  };
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
      let curReal = 1;
      let curImag = 0;

      for (let k = 0; k < len / 2; k++) {
        const uReal = real[i + k];
        const uImag = imag[i + k];
        const vReal =
          real[i + k + len / 2] * curReal -
          imag[i + k + len / 2] * curImag;
        const vImag =
          real[i + k + len / 2] * curImag +
          imag[i + k + len / 2] * curReal;

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