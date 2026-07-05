import { renderGrandPiano, renderGrandPianoChord, renderGrandPianoArpeggio } from "./instruments/piano/grand";
// ─────────────────────────────────────────────────────────────────────────────
// WAV SYNTHESIS ENGINE
// OfflineAudioContext-based synthesis — no external dependencies.
// Instrument-specific ADSR envelopes, waveforms, and timbres.
// Gamak (ornament) notes get pitch oscillation to approximate andolan.
// ─────────────────────────────────────────────────────────────────────────────

import type { RhythmEvent, MelodyNote } from "./patternGenerator";

const NOTE_FREQ: Record<string, number> = {
  "C":261.63,"C#":277.18,"D":293.66,"D#":311.13,"E":329.63,
  "F":349.23,"F#":369.99,"G":392.00,"G#":415.30,"A":440.00,"A#":466.16,"B":493.88,
};

function noteFreq(note: string, octave: number): number {
  const base = NOTE_FREQ[note] ?? 440;
  return base * Math.pow(2, octave - 4);
}

// ── ADSR + instrument profile ─────────────────────────────────────────────────
interface InstrumentProfile {
  waveform:   OscillatorType | "noise";
  attack:     number;  // seconds
  decay:      number;
  sustain:    number;  // 0–1 gain level
  release:    number;
  gainScale:  number;  // overall volume multiplier
  harmonics?: { ratio: number; gain: number }[]; // additional partials
  filterFreq?: number;    // low-pass filter cutoff
  filterQ?:    number;
  pitchDecay?: number;    // for drums: freq sweep from start
  pitchStart?: number;    // starting freq multiplier for drums
}

const INSTRUMENT_PROFILES: Record<string, InstrumentProfile> = {
  // ── Melodic ──
  "Piano": {
    waveform: "triangle", attack: 0.005, decay: 0.3, sustain: 0.4, release: 0.8,
    gainScale: 0.6,
    harmonics: [{ ratio: 2, gain: 0.3 }, { ratio: 3, gain: 0.15 }, { ratio: 4, gain: 0.08 }],
    filterFreq: 6000,
  },
  "Sitar": {
    waveform: "sawtooth", attack: 0.01, decay: 0.4, sustain: 0.5, release: 1.2,
    gainScale: 0.45,
    harmonics: [{ ratio: 2, gain: 0.5 }, { ratio: 3, gain: 0.3 }, { ratio: 4, gain: 0.2 }, { ratio: 5, gain: 0.1 }],
    filterFreq: 4000, filterQ: 2,
  },
  "Flute": {
    waveform: "sine", attack: 0.08, decay: 0.1, sustain: 0.8, release: 0.3,
    gainScale: 0.5,
    harmonics: [{ ratio: 2, gain: 0.15 }, { ratio: 3, gain: 0.05 }],
    filterFreq: 8000,
  },
  "Violin": {
    waveform: "sawtooth", attack: 0.12, decay: 0.1, sustain: 0.85, release: 0.4,
    gainScale: 0.4,
    harmonics: [{ ratio: 2, gain: 0.4 }, { ratio: 3, gain: 0.25 }, { ratio: 4, gain: 0.12 }],
    filterFreq: 5000, filterQ: 1,
  },
  "Guitar": {
    waveform: "triangle", attack: 0.005, decay: 0.5, sustain: 0.3, release: 0.6,
    gainScale: 0.55,
    harmonics: [{ ratio: 2, gain: 0.35 }, { ratio: 3, gain: 0.2 }, { ratio: 4, gain: 0.1 }],
    filterFreq: 5000,
  },
  "Synth Pad": {
    waveform: "sine", attack: 0.4, decay: 0.2, sustain: 0.9, release: 1.5,
    gainScale: 0.5,
    harmonics: [{ ratio: 2, gain: 0.3 }, { ratio: 3, gain: 0.1 }],
    filterFreq: 3000,
  },
  "Synth Lead": {
    waveform: "sawtooth", attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.3,
    gainScale: 0.4,
    harmonics: [],
    filterFreq: 4000, filterQ: 3,
  },
  "Cello": {
    waveform: "sawtooth", attack: 0.15, decay: 0.1, sustain: 0.9, release: 0.5,
    gainScale: 0.45,
    harmonics: [{ ratio: 2, gain: 0.5 }, { ratio: 3, gain: 0.3 }, { ratio: 4, gain: 0.15 }],
    filterFreq: 3000,
  },
  "Sarangi": {
    waveform: "sawtooth", attack: 0.05, decay: 0.2, sustain: 0.75, release: 0.6,
    gainScale: 0.4,
    harmonics: [{ ratio: 2, gain: 0.55 }, { ratio: 3, gain: 0.35 }, { ratio: 4.5, gain: 0.2 }],
    filterFreq: 4500, filterQ: 1.5,
  },
  "Santoor": {
    waveform: "triangle", attack: 0.003, decay: 0.8, sustain: 0.2, release: 1.0,
    gainScale: 0.55,
    harmonics: [{ ratio: 2, gain: 0.4 }, { ratio: 3, gain: 0.2 }, { ratio: 4, gain: 0.1 }],
    filterFreq: 7000,
  },
  "Harmonium": {
    waveform: "sawtooth", attack: 0.03, decay: 0.05, sustain: 0.95, release: 0.2,
    gainScale: 0.4,
    harmonics: [{ ratio: 2, gain: 0.3 }, { ratio: 3, gain: 0.2 }, { ratio: 4, gain: 0.1 }],
    filterFreq: 3500,
  },
  "Veena": {
    waveform: "triangle", attack: 0.01, decay: 0.6, sustain: 0.45, release: 1.0,
    gainScale: 0.5,
    harmonics: [{ ratio: 2, gain: 0.45 }, { ratio: 3, gain: 0.25 }, { ratio: 5, gain: 0.1 }],
    filterFreq: 4000,
  },
  "Saxophone": {
    waveform: "sawtooth", attack: 0.06, decay: 0.1, sustain: 0.85, release: 0.35,
    gainScale: 0.45,
    harmonics: [{ ratio: 2, gain: 0.35 }, { ratio: 3, gain: 0.2 }],
    filterFreq: 4500, filterQ: 1,
  },
  "Oud": {
    waveform: "triangle", attack: 0.008, decay: 0.6, sustain: 0.35, release: 0.8,
    gainScale: 0.5,
    harmonics: [{ ratio: 2, gain: 0.4 }, { ratio: 3, gain: 0.22 }, { ratio: 4, gain: 0.1 }],
    filterFreq: 5000,
  },
};

// Drum profiles — noise + pitched oscillator combinations
interface DrumProfile {
  bass:   DrumVoice;
  treble: DrumVoice;
  mid:    DrumVoice;
}
interface DrumVoice {
  type:        "noise" | "sine" | "triangle";
  freq?:       number;
  freqEnd?:    number;    // pitch sweep end
  attack:      number;
  decay:       number;
  gain:        number;
  filterFreq?: number;
  filterType?: BiquadFilterType;
}

const DRUM_PROFILES: Record<string, DrumProfile> = {
  "Tabla": {
    bass:   { type:"sine",  freq:80,  freqEnd:55,  attack:0.003, decay:0.35, gain:0.8,  filterFreq:200 },
    treble: { type:"sine",  freq:320, freqEnd:280, attack:0.002, decay:0.15, gain:0.6,  filterFreq:600 },
    mid:    { type:"noise",                         attack:0.001, decay:0.08, gain:0.4,  filterFreq:800,  filterType:"bandpass" },
  },
  "Dhol": {
    bass:   { type:"sine",  freq:60,  freqEnd:40,  attack:0.003, decay:0.5,  gain:0.9 },
    treble: { type:"noise",                         attack:0.001, decay:0.12, gain:0.7,  filterFreq:3000, filterType:"highpass" },
    mid:    { type:"sine",  freq:150, freqEnd:120, attack:0.003, decay:0.2,  gain:0.5 },
  },
  "Mridangam": {
    bass:   { type:"sine",  freq:90,  freqEnd:60,  attack:0.003, decay:0.3,  gain:0.75, filterFreq:180 },
    treble: { type:"sine",  freq:280, freqEnd:250, attack:0.002, decay:0.12, gain:0.60, filterFreq:500 },
    mid:    { type:"noise",                         attack:0.001, decay:0.06, gain:0.35, filterFreq:700,  filterType:"bandpass" },
  },
  "Kick+Snare+Hat": {
    bass:   { type:"sine",  freq:150, freqEnd:40,  attack:0.002, decay:0.4,  gain:0.9 },
    treble: { type:"noise",                         attack:0.001, decay:0.15, gain:0.8,  filterFreq:8000, filterType:"highpass" },
    mid:    { type:"noise",                         attack:0.001, decay:0.2,  gain:0.7,  filterFreq:2000, filterType:"bandpass" },
  },
  "Cajon": {
    bass:   { type:"sine",  freq:100, freqEnd:60,  attack:0.003, decay:0.4,  gain:0.8 },
    treble: { type:"noise",                         attack:0.001, decay:0.1,  gain:0.6,  filterFreq:5000, filterType:"highpass" },
    mid:    { type:"noise",                         attack:0.001, decay:0.15, gain:0.5,  filterFreq:1500, filterType:"bandpass" },
  },
  "Congas": {
    bass:   { type:"sine",  freq:120, freqEnd:90,  attack:0.003, decay:0.3,  gain:0.7 },
    treble: { type:"sine",  freq:250, freqEnd:220, attack:0.002, decay:0.15, gain:0.6 },
    mid:    { type:"noise",                         attack:0.001, decay:0.08, gain:0.35, filterFreq:1000, filterType:"bandpass" },
  },
  "Drum Machine": {
    bass:   { type:"sine",  freq:160, freqEnd:40,  attack:0.001, decay:0.35, gain:0.95 },
    treble: { type:"noise",                         attack:0.001, decay:0.12, gain:0.85, filterFreq:10000,filterType:"highpass" },
    mid:    { type:"noise",                         attack:0.001, decay:0.18, gain:0.75, filterFreq:2500, filterType:"bandpass" },
  },
  "Khol": {
    bass:   { type:"sine",  freq:75,  freqEnd:50,  attack:0.004, decay:0.45, gain:0.75 },
    treble: { type:"sine",  freq:300, freqEnd:270, attack:0.002, decay:0.12, gain:0.55 },
    mid:    { type:"noise",                         attack:0.001, decay:0.07, gain:0.35, filterFreq:800,  filterType:"bandpass" },
  },
  "Pakhawaj": {
    bass:   { type:"sine",  freq:70,  freqEnd:45,  attack:0.003, decay:0.5,  gain:0.85 },
    treble: { type:"sine",  freq:260, freqEnd:230, attack:0.002, decay:0.14, gain:0.60 },
    mid:    { type:"noise",                         attack:0.001, decay:0.08, gain:0.40, filterFreq:700,  filterType:"bandpass" },
  },
  "Djembe": {
    bass:   { type:"sine",  freq:110, freqEnd:70,  attack:0.003, decay:0.4,  gain:0.80 },
    treble: { type:"noise",                         attack:0.001, decay:0.1,  gain:0.70, filterFreq:6000, filterType:"highpass" },
    mid:    { type:"noise",                         attack:0.001, decay:0.1,  gain:0.50, filterFreq:1200, filterType:"bandpass" },
  },
  "Dholak": {
    bass:   { type:"sine",  freq:85,  freqEnd:55,  attack:0.003, decay:0.45, gain:0.80 },
    treble: { type:"noise",                         attack:0.001, decay:0.12, gain:0.65, filterFreq:4000, filterType:"highpass" },
    mid:    { type:"sine",  freq:180, freqEnd:150, attack:0.002, decay:0.18, gain:0.50 },
  },
};

// ── Render a single drum voice into an OfflineAudioContext ───────────────────
function renderDrumVoice(ctx: OfflineAudioContext, voice: DrumVoice, startTime: number, velocity: number) {
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(voice.gain * velocity, startTime + voice.attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + voice.attack + voice.decay + 0.01);

  if (voice.filterFreq) {
    const filter = ctx.createBiquadFilter();
    filter.type = voice.filterType ?? "lowpass";
    filter.frequency.value = voice.filterFreq;
    gainNode.connect(filter);
    filter.connect(ctx.destination);
  } else {
    gainNode.connect(ctx.destination);
  }

  if (voice.type === "noise") {
    const bufferSize  = ctx.sampleRate * (voice.attack + voice.decay + 0.01);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data        = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.connect(gainNode);
    source.start(startTime);
  } else {
    const osc = ctx.createOscillator();
    osc.type = voice.type;
    osc.frequency.setValueAtTime(voice.freq ?? 440, startTime);
    if (voice.freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(voice.freqEnd, startTime + voice.decay);
    }
    osc.connect(gainNode);
    osc.start(startTime);
    osc.stop(startTime + voice.attack + voice.decay + 0.05);
  }
}

// ── Render a single melodic note ─────────────────────────────────────────────
function renderMelodicNote(
  ctx: OfflineAudioContext,
  noteName: string,
  octave: number,
  startTime: number,
  duration: number,
  velocity: number,
  profile: InstrumentProfile,
  isGamak: boolean,
) {
  const freq    = noteFreq(noteName, octave);
  const noteDur = Math.max(0.05, duration);

  // Master gain node for this note
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0, startTime);
  masterGain.gain.linearRampToValueAtTime(profile.gainScale * velocity, startTime + profile.attack);
  masterGain.gain.setValueAtTime(profile.gainScale * velocity, startTime + profile.attack + profile.decay);
  masterGain.gain.linearRampToValueAtTime(profile.gainScale * velocity * profile.sustain, startTime + profile.attack + profile.decay + 0.05);
  const releaseStart = startTime + noteDur - profile.release;
  if (releaseStart > startTime + profile.attack) {
    masterGain.gain.setValueAtTime(profile.gainScale * velocity * profile.sustain, Math.max(startTime + profile.attack, releaseStart));
    masterGain.gain.setTargetAtTime(0.0001, startTime + noteDur - 0.05, 0.03);
  }

  // Optional low-pass filter
  if (profile.filterFreq) {
    const filter = ctx.createBiquadFilter();
    filter.type  = "lowpass";
    filter.frequency.value = profile.filterFreq;
    if (profile.filterQ) filter.Q.value = profile.filterQ;
    masterGain.connect(filter);
    filter.connect(ctx.destination);
  } else {
    masterGain.connect(ctx.destination);
  }

  // Fundamental
  const fundamental = ctx.createOscillator();
  fundamental.type = profile.waveform === "noise" ? "sine" : profile.waveform;
  fundamental.frequency.setValueAtTime(freq, startTime);

  // Gamak: slow frequency oscillation (andolan) — characteristic of Indian classical
  if (isGamak && duration > 0.3) {
    const lfoDepth = freq * 0.03; // ±3% pitch variation
    const lfoRate  = 4.5;         // oscillations per second
    fundamental.frequency.setValueAtTime(freq, startTime);
    // Manual LFO via multiple setValueAtTime calls
    const lfoSteps = Math.ceil(duration * lfoRate * 2);
    for (let i = 0; i <= lfoSteps; i++) {
      const t     = startTime + (i / (lfoSteps)) * duration;
      const phase = (i / lfoSteps) * Math.PI * 2 * lfoRate * duration;
      fundamental.frequency.setValueAtTime(freq + Math.sin(phase) * lfoDepth, t);
    }
  }

  fundamental.start(startTime);
  fundamental.stop(startTime + noteDur + 0.05);
  fundamental.connect(masterGain);

  // Harmonics
  if (profile.harmonics) {
    for (const harmonic of profile.harmonics) {
      const harmonicOsc = ctx.createOscillator();
      harmonicOsc.type = "sine";
      harmonicOsc.frequency.setValueAtTime(freq * harmonic.ratio, startTime);
      const harmonicGain = ctx.createGain();
      harmonicGain.gain.value = harmonic.gain;
      harmonicOsc.connect(harmonicGain);
      harmonicGain.connect(masterGain);
      harmonicOsc.start(startTime);
      harmonicOsc.stop(startTime + noteDur + 0.05);
    }
  }
}

// ── AudioBuffer → WAV Blob ────────────────────────────────────────────────────
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate  = buffer.sampleRate;
  const length      = buffer.length;
  const arrayBuffer = new ArrayBuffer(44 + length * numChannels * 2);
  const view        = new DataView(arrayBuffer);

  const write = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4,  36 + length * numChannels * 2, true);
  write(8, "WAVE"); write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, length * numChannels * 2, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  return new Blob([arrayBuffer], { type: "audio/wav" });
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export async function synthMelodyToWav(notes: MelodyNote[], tempo: number, instrument: string): Promise<Blob> {
  const profile   = INSTRUMENT_PROFILES[instrument] ?? INSTRUMENT_PROFILES["Piano"];
  const secPerBeat = 60 / tempo;
  const totalSecs  = notes.reduce((sum, n) => sum + n.duration * secPerBeat, 0) + 1.5; // +1.5s tail

  const OAC = (typeof window !== "undefined" && (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)) as typeof OfflineAudioContext;
  const ctx = new OAC(2, Math.ceil(totalSecs * 44100), 44100);

  let currentTime = 0.1; // tiny offset to avoid t=0 artifacts

  // Route Piano instruments to dedicated synthesis modules
  const isPiano = ["Piano","Grand Piano"].includes(instrument);

  for (const note of notes) {
    const durSecs = note.duration * secPerBeat;
    if (note.isRest || note.note === "rest") {
      currentTime += durSecs;
      continue;
    }

    if (isPiano) {
      const style = note.playingStyle ?? "melody";
      if (style === "chords" && note.chordNotes && note.chordNotes.length > 0) {
        renderGrandPianoChord(ctx, note.chordNotes, currentTime, durSecs, note.velocity, true);
      } else if (style === "arpeggiated" && note.chordNotes && note.chordNotes.length > 0) {
        renderGrandPianoArpeggio(ctx, note.chordNotes, currentTime, durSecs, 0.06, note.velocity, true);
      } else {
        // melody or two-hand
        renderGrandPiano(ctx, note.note, note.octave, currentTime, durSecs, note.velocity, false);
        if (style === "two-hand" && note.bassNote) {
          renderGrandPiano(ctx, note.bassNote.note, note.bassNote.octave, currentTime, durSecs, note.velocity * 0.7, false);
        }
      }
    } else {
      renderMelodicNote(ctx, note.note, note.octave, currentTime, durSecs, note.velocity, profile, note.isGamak ?? false);
    }

    currentTime += durSecs;
  }

  const renderedBuffer = await ctx.startRendering();
  return audioBufferToWav(renderedBuffer);
}

export async function synthRhythmToWav(events: RhythmEvent[], tempo: number, instrument: string): Promise<Blob> {
  const profile  = DRUM_PROFILES[instrument] ?? DRUM_PROFILES["Kick+Snare+Hat"];
  const secPerBeat = 60 / tempo;
  const maxBeat  = Math.max(...events.map(e => e.beat + e.duration));
  const totalSecs = maxBeat * secPerBeat + 1.0;

  const OAC2 = (typeof window !== "undefined" && (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)) as typeof OfflineAudioContext;
  const ctx = new OAC2(2, Math.ceil(totalSecs * 44100), 44100);

  for (const ev of events) {
    const startTime = ev.beat * secPerBeat + 0.05;
    const voice     = ev.element === "bass"   ? profile.bass
                    : ev.element === "treble" ? profile.treble
                    : profile.mid;
    renderDrumVoice(ctx, voice, startTime, ev.velocity);
  }

  const renderedBuffer = await ctx.startRendering();
  return audioBufferToWav(renderedBuffer);
}