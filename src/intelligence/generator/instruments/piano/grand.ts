// ─────────────────────────────────────────────────────────────────────────────
// GRAND PIANO SYNTHESIS
// Additive synthesis approximating a concert grand piano.
// Character: bright hammer attack → rich harmonic sustain → natural decay
//
// Technique:
// - Hammer click: short noise burst (5ms) filtered to 2-4kHz
// - String fundamentals: 3 slightly detuned oscillators (chorus effect)
// - Harmonics: partials at 2x, 3x, 4x, 5x with natural rolloff
// - Inharmonicity: upper partials slightly sharp (real piano string behavior)
// - Velocity sensitivity: affects hammer click volume + brightness
// - Register awareness: bass notes are darker, treble notes are brighter
// - Sympathetic resonance: subtle tail that lingers after note ends
// ─────────────────────────────────────────────────────────────────────────────

// Note frequency table — equal temperament, A4 = 440Hz
const NOTE_FREQ: Record<string, number> = {
  "C":261.63,"C#":277.18,"D":293.66,"D#":311.13,"E":329.63,
  "F":349.23,"F#":369.99,"G":392.00,"G#":415.30,"A":440.00,"A#":466.16,"B":493.88,
};

function noteFreq(note: string, octave: number): number {
  const base = NOTE_FREQ[note] ?? 440;
  return base * Math.pow(2, octave - 4);
}

// Inharmonicity coefficient — real piano strings are slightly inharmonic
// Upper partials are sharper than pure integer multiples
function inharmonicRatio(partial: number, freq: number): number {
  // B coefficient varies by register — higher strings have more inharmonicity
  const B = freq < 200 ? 0.0001 : freq < 500 ? 0.0003 : 0.0008;
  return partial * Math.sqrt(1 + B * partial * partial);
}

// ── Main synthesis function ───────────────────────────────────────────────────
// ctx        — OfflineAudioContext to render into
// note       — note name e.g. "C#"
// octave     — octave number (4 = middle octave)
// startTime  — when to start in seconds
// duration   — note duration in seconds
// velocity   — 0–1 (affects brightness and attack transient volume)
// sustained  — true = sustain pedal held (longer release, more sympathetic resonance)

export function renderGrandPiano(
  ctx: OfflineAudioContext,
  note: string,
  octave: number,
  startTime: number,
  duration: number,
  velocity: number,
  sustained: boolean = false,
): void {
  const freq       = noteFreq(note, octave);
  const masterGain = ctx.createGain();

  // Register-based brightness — bass notes are darker, treble brighter
  const isBasss    = freq < 150;
  const isTreble   = freq > 800;
  const brightness = isBasss ? 2500 : isTreble ? 8000 : 4000 + (freq - 150) * 6;

  // Master filter — simulates soundboard resonance
  const masterFilter = ctx.createBiquadFilter();
  masterFilter.type  = "lowpass";
  masterFilter.frequency.value = brightness * (0.6 + velocity * 0.4);
  masterFilter.Q.value = 0.8;
  masterGain.connect(masterFilter);
  masterFilter.connect(ctx.destination);

  // ── ADSR ─────────────────────────────────────────────────────────────────
  const attack       = 0.003;
  const decay        = isBasss ? 0.8 : isTreble ? 0.3 : 0.5;
  const sustainLevel = (0.3 + velocity * 0.25) * (isBasss ? 0.7 : 1.0);
  const release      = sustained ? 1.2 : 0.4;
  const noteEnd      = startTime + duration;

  masterGain.gain.setValueAtTime(0, startTime);
  masterGain.gain.linearRampToValueAtTime(0.8 * velocity, startTime + attack);
  masterGain.gain.exponentialRampToValueAtTime(sustainLevel, startTime + attack + decay);
  masterGain.gain.setValueAtTime(sustainLevel, noteEnd - release * 0.1);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd + release);

  // ── HAMMER CLICK (noise transient) ───────────────────────────────────────
  // Short noise burst — simulates hammer striking string
  const clickDur    = 0.008 + velocity * 0.006; // louder velocity = longer click
  const clickBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * clickDur), ctx.sampleRate);
  const clickData   = clickBuffer.getChannelData(0);
  for (let i = 0; i < clickData.length; i++) {
    clickData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * clickDur * 0.3));
  }
  const clickSource = ctx.createBufferSource();
  clickSource.buffer = clickBuffer;

  const clickFilter = ctx.createBiquadFilter();
  clickFilter.type  = "bandpass";
  clickFilter.frequency.value = 2500 + velocity * 1500; // harder hit = brighter click
  clickFilter.Q.value = 1.5;

  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(velocity * 0.35, startTime);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, startTime + clickDur);

  clickSource.connect(clickFilter);
  clickFilter.connect(clickGain);
  clickGain.connect(ctx.destination); // click bypasses master filter for full transient
  clickSource.start(startTime);

  // ── STRING OSCILLATORS ────────────────────────────────────────────────────
  // Three slightly detuned oscillators — simulates multiple strings per note
  // (grand pianos have 3 strings per note in middle/treble register)
  const detunings = isBasss ? [0] : [-0.15, 0, 0.15]; // bass has 1 string, others 3
  const stringGain = 1 / detunings.length;

  detunings.forEach(detuneCents => {
    const osc = ctx.createOscillator();
    osc.type  = "sine";
    osc.frequency.setValueAtTime(freq * Math.pow(2, detuneCents / 1200), startTime);

    const oscGain = ctx.createGain();
    oscGain.gain.value = stringGain * 0.55;

    osc.connect(oscGain);
    oscGain.connect(masterGain);
    osc.start(startTime);
    osc.stop(noteEnd + release + 0.1);
  });

  // ── HARMONICS (partials 2–8) ──────────────────────────────────────────────
  // Real piano tone is rich in harmonics — fundamental alone sounds like a sine wave
  const harmonics = [
    { partial: 2, gain: 0.45 },
    { partial: 3, gain: 0.25 },
    { partial: 4, gain: 0.14 },
    { partial: 5, gain: 0.08 },
    { partial: 6, gain: 0.05 },
    { partial: 7, gain: 0.03 },
    { partial: 8, gain: 0.02 },
  ];

  harmonics.forEach(({ partial, gain: harmonicGain }) => {
    const harmonicFreq = freq * inharmonicRatio(partial, freq);
    if (harmonicFreq > ctx.sampleRate / 2) return; // above Nyquist — skip

    // Higher harmonics decay faster
    const harmonicDecay = decay / (partial * 0.7);

    const osc = ctx.createOscillator();
    osc.type  = "sine";
    osc.frequency.setValueAtTime(harmonicFreq, startTime);

    const harmGain = ctx.createGain();
    // Velocity affects harmonic brightness — harder hit = more upper harmonics
    const velFactor = partial <= 3 ? 1.0 : (0.4 + velocity * 0.6);
    harmGain.gain.setValueAtTime(0, startTime);
    harmGain.gain.linearRampToValueAtTime(harmonicGain * velFactor, startTime + attack);
    harmGain.gain.exponentialRampToValueAtTime(harmonicGain * velFactor * 0.1, startTime + attack + harmonicDecay);
    harmGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd + release * 0.3);

    osc.connect(harmGain);
    harmGain.connect(masterGain);
    osc.start(startTime);
    osc.stop(noteEnd + release + 0.1);
  });

  // ── SYMPATHETIC RESONANCE (sustain tail) ─────────────────────────────────
  // When sustain pedal is held, other strings resonate subtly
  // Simulated as a very quiet filtered noise that lingers
  if (sustained || duration > 0.8) {
    const resDur    = Math.min(2.0, duration * 0.8);
    const resBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * resDur), ctx.sampleRate);
    const resData   = resBuffer.getChannelData(0);
    for (let i = 0; i < resData.length; i++) resData[i] = Math.random() * 2 - 1;

    const resSource = ctx.createBufferSource();
    resSource.buffer = resBuffer;

    const resFilter = ctx.createBiquadFilter();
    resFilter.type  = "bandpass";
    resFilter.frequency.value = freq * 2; // resonates at octave above
    resFilter.Q.value = 15; // very narrow band — pure resonance

    const resGain = ctx.createGain();
    resGain.gain.setValueAtTime(0.018 * velocity, noteEnd - 0.05);
    resGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd + resDur);

    resSource.connect(resFilter);
    resFilter.connect(resGain);
    resGain.connect(ctx.destination);
    resSource.start(noteEnd - 0.05);
  }
}

// ── Chord rendering ───────────────────────────────────────────────────────────
// Renders multiple notes simultaneously with slight timing humanisation
// notes: array of { note, octave } objects
export function renderGrandPianoChord(
  ctx: OfflineAudioContext,
  notes: { note: string; octave: number }[],
  startTime: number,
  duration: number,
  velocity: number,
  sustained: boolean = true,
): void {
  notes.forEach((n, i) => {
    // Slight humanisation — each finger hits slightly different time
    const humanOffset = i * (0.008 + Math.random() * 0.006);
    // Slight velocity variation per finger
    const velVariation = velocity * (0.85 + Math.random() * 0.15);
    renderGrandPiano(ctx, n.note, n.octave, startTime + humanOffset, duration, velVariation, sustained);
  });
}

// ── Arpeggio rendering ────────────────────────────────────────────────────────
// Rolls notes one after another with configurable speed
export function renderGrandPianoArpeggio(
  ctx: OfflineAudioContext,
  notes: { note: string; octave: number }[],
  startTime: number,
  noteDuration: number,
  rollSpeed: number = 0.06, // seconds between each note in the roll
  velocity: number = 0.7,
  sustained: boolean = true,
): void {
  notes.forEach((n, i) => {
    const noteStart = startTime + i * rollSpeed;
    renderGrandPiano(ctx, n.note, n.octave, noteStart, noteDuration, velocity * (0.9 + Math.random() * 0.1), sustained);
  });
}