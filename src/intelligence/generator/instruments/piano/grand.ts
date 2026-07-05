// ─────────────────────────────────────────────────────────────────────────────
// GRAND PIANO SYNTHESIS — V2
// Additive synthesis approximating a concert grand piano.
// Character: bright hammer attack → dual-slope percussive decay → soundboard bloom
//
// What changed vs V1 (and why it sounds more real):
// - NO SUSTAIN PLATEAU: a piano is a struck string — the tone decays from the
//   instant of impact. V1's held sustainLevel was the biggest realism killer.
// - TWO-STAGE DECAY: fast "prompt sound" (~0.4s) crossing into a long slow
//   "aftersound" tail. This dual slope is the defining piano envelope shape,
//   caused by unison strings drifting out of phase.
// - REAL UNISON BEATING: strings detuned ±1–2 cents (V1 used ±0.15 — inaudible).
//   Produces the characteristic shimmer and slow amplitude beating.
// - STRIKE-POINT COMB: hammers hit at ~1/8 of string length, notching every
//   8th partial family → amplitude ∝ sin(π·n·d)/n^p.
// - 16–20 PARTIALS with per-partial two-stage decay (higher partials die faster).
// - VELOCITY → SPECTRAL TILT: soft playing steepens partial rolloff (mellow),
//   hard playing flattens it (bright), instead of only moving a filter.
// - SOUNDBOARD CONVOLUTION: short generated impulse response (cached per
//   context) adds body/bloom. Zero assets, zero egress, fully client-side.
// - KEYBED THUMP + improved hammer noise; damper felt noise on release.
// - STEREO PLACEMENT: notes panned as heard from the player's bench
//   (bass left, treble right). Safe on mono OfflineAudioContexts.
// - UNDAMPED TOP REGISTER: notes above ~F#6 have no dampers on a real grand —
//   they ring after release.
// - Fixes: V1 envelope scheduling conflict on short notes; "isBasss" typo.
//
// Public API is unchanged: renderGrandPiano / renderGrandPianoChord /
// renderGrandPianoArpeggio keep identical signatures — wavSynthesis.ts
// requires no edits.
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

// Inharmonicity — real piano strings are stiff, so upper partials run sharp.
// B coefficient grows toward the treble (shorter, stiffer strings).
function inharmonicRatio(partial: number, freq: number): number {
  const B =
    freq < 100  ? 0.00020 :
    freq < 200  ? 0.00028 :
    freq < 500  ? 0.00050 :
    freq < 1000 ? 0.00120 :
                  0.00350;
  return partial * Math.sqrt(1 + B * partial * partial);
}

// ── Soundboard impulse response — generated once per AudioContext ────────────
// A short burst of exponentially decaying, lowpass-tilted noise. Convolving
// the piano through it simulates the soundboard/case resonance ("bloom").
const soundboardCache = new WeakMap<BaseAudioContext, ConvolverNode>();

function getSoundboard(ctx: BaseAudioContext): ConvolverNode {
  const cached = soundboardCache.get(ctx);
  if (cached) return cached;

  const durSec    = 0.45;
  const rate      = ctx.sampleRate;
  const length    = Math.ceil(rate * durSec);
  const channels  = 2;
  const irBuffer  = ctx.createBuffer(channels, length, rate);

  for (let ch = 0; ch < channels; ch++) {
    const data = irBuffer.getChannelData(ch);
    // One-pole lowpass state — tilts the IR dark, like wood
    let lp = 0;
    const lpCoeff = Math.exp(-2 * Math.PI * 2200 / rate);
    for (let i = 0; i < length; i++) {
      const t     = i / rate;
      const env   = Math.exp(-t * 11);              // ~0.45s decay
      const noise = Math.random() * 2 - 1;
      lp = lp * lpCoeff + noise * (1 - lpCoeff);
      // early reflections slightly denser at the start
      data[i] = lp * env * (i < rate * 0.005 ? 1.6 : 1.0);
    }
    // normalise-ish
    data[0] = 0;
  }

  const convolver  = ctx.createConvolver();
  convolver.buffer = irBuffer;
  convolver.connect(ctx.destination);
  soundboardCache.set(ctx, convolver);
  return convolver;
}

// ── Per-partial dual-slope percussive envelope ────────────────────────────────
// attack → fast "prompt" decay → slow "aftersound" → damper release.
// Uses setTargetAtTime throughout: monotonic, no zero-value exceptions, and
// immune to the short-note scheduling conflicts the V1 ramp chain had.
function scheduleDecayEnvelope(
  gain: AudioParam,
  peak: number,
  t0: number,
  attack: number,
  promptTau: number,   // fast-stage time constant
  afterTau: number,    // slow-stage time constant
  noteEnd: number,
  releaseTau: number,
): void {
  const tAttack = t0 + attack;
  gain.setValueAtTime(0, t0);
  gain.linearRampToValueAtTime(peak, tAttack);
  // Stage 1 — prompt sound: dive fast toward ~22% of peak
  gain.setTargetAtTime(peak * 0.22, tAttack, promptTau);
  // Stage 2 — aftersound: from roughly where stage 1 lands, glide slowly to 0
  gain.setTargetAtTime(0, tAttack + promptTau * 2.2, afterTau);
  // Damper release — overrides whatever the decay was doing
  if (noteEnd > tAttack) {
    gain.setTargetAtTime(0, noteEnd, releaseTau);
  }
}

// ── Main synthesis function ───────────────────────────────────────────────────
// ctx        — OfflineAudioContext to render into
// note       — note name e.g. "C#"
// octave     — octave number (4 = middle octave)
// startTime  — when to start in seconds
// duration   — note duration in seconds
// velocity   — 0–1 (affects brightness, partial tilt, hammer + thump volume)
// sustained  — true = sustain pedal held (natural full decay, resonance)

export function renderGrandPiano(
  ctx: OfflineAudioContext,
  note: string,
  octave: number,
  startTime: number,
  duration: number,
  velocity: number,
  sustained: boolean = false,
): void {
  const freq    = noteFreq(note, octave);
  const nyquist = ctx.sampleRate / 2;
  const isBass  = freq < 150;
  const noteEnd = startTime + duration;

  // Dampers on a real grand stop around F#6 (~1480Hz) — above that, strings
  // ring freely after key release.
  const undamped = freq > 1400;

  // ── Output chain: note bus → (dry + soundboard wet) → pan → destination ──
  const noteBus = ctx.createGain();
  noteBus.gain.value = 1;

  // Stereo placement, as heard from the bench: C4 centre, bass left, treble right
  const midiNum = 12 * (Math.log2(freq / 440)) + 69;
  const pan     = Math.max(-0.55, Math.min(0.55, (midiNum - 60) / 42));
  let output: AudioNode = noteBus;
  if (typeof ctx.createStereoPanner === "function") {
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    noteBus.connect(panner);
    output = panner;
  }

  const dry = ctx.createGain();
  dry.gain.value = 0.85;
  output.connect(dry);
  dry.connect(ctx.destination);

  const wet = ctx.createGain();
  wet.gain.value = 0.16; // soundboard bloom — subtle but essential
  output.connect(wet);
  wet.connect(getSoundboard(ctx));

  // ── Decay time constants by register ─────────────────────────────────────
  // Bass strings ring for many seconds; treble dies quickly.
  const promptTau  = isBass ? 0.30 : freq > 800 ? 0.10 : 0.18;
  const afterTau   = isBass ? 2.6  : freq > 800 ? 0.55 : 1.4;
  // Damper release: bass dampers stop slower; undamped treble rings on
  const releaseTau = undamped ? 0.9 : sustained ? 0.6 : isBass ? 0.14 : 0.07;
  const tailStop   = noteEnd + (undamped || sustained ? 4.0 : 1.2);

  const attack = 0.002 + (1 - velocity) * 0.004; // soft touch = slower bloom

  // ── Spectral profile ──────────────────────────────────────────────────────
  // Strike-point comb: hammer at d ≈ 1/8 of string → amplitude ∝ sin(π·n·d).
  // Velocity tilt: rolloff exponent p — soft ≈ 2.8 (mellow), hard ≈ 1.55 (bright).
  const strikePos = 0.116;
  const p         = 2.8 - velocity * 1.25;
  const partialCount = isBass ? 20 : freq > 1000 ? 8 : 16;

  // Real bass notes have a weak fundamental — the soundboard can't radiate it.
  const fundamentalScale = freq < 110 ? 0.45 : freq < 160 ? 0.7 : 1.0;

  // Overall level compensation so bass/treble sit evenly in a mix
  const masterLevel = (0.30 + velocity * 0.45) * (isBass ? 0.9 : freq > 1000 ? 1.15 : 1.0);

  for (let n = 1; n <= partialCount; n++) {
    const partialFreq = freq * inharmonicRatio(n, freq);
    if (partialFreq > nyquist * 0.94) break;

    // Strike-point comb + power-law rolloff
    const comb = Math.abs(Math.sin(Math.PI * n * strikePos));
    let amp    = (comb / Math.sin(Math.PI * strikePos)) / Math.pow(n, p);
    if (n === 1) amp *= fundamentalScale;
    if (n >= 2 && n <= 4 && freq < 160) amp *= 1.35; // bass body lives in partials 2–4
    if (amp < 0.002) continue;

    // Higher partials decay faster (both stages)
    const nPrompt = promptTau / (1 + 0.55 * (n - 1));
    const nAfter  = afterTau  / Math.pow(n, 0.75);

    // Unison strings: middle/treble notes have 3 strings tuned ~1–2 cents
    // apart. Their beating creates the shimmer + dual-slope decay. Modelling
    // it on the first 3 partials is enough — beating is inaudible higher up.
    // Bass notes have 1–2 strings.
    const detunes =
      n <= 3 && !isBass ? [-1.4 + Math.random() * 0.5, 0, 1.3 + Math.random() * 0.5] :
      n <= 2 && isBass  ? [0, 0.9 + Math.random() * 0.4] :
                          [0];

    for (const cents of detunes) {
      const osc = ctx.createOscillator();
      osc.type  = "sine";
      osc.frequency.value = partialFreq * Math.pow(2, cents / 1200);

      const g = ctx.createGain();
      scheduleDecayEnvelope(
        g.gain,
        (amp / detunes.length) * masterLevel,
        startTime, attack, nPrompt, nAfter, noteEnd, releaseTau,
      );

      osc.connect(g);
      g.connect(noteBus);
      // Random sub-period start offset ≈ random phase — avoids the artificial
      // "all partials phase-locked at zero" additive-synth signature.
      osc.start(startTime + Math.random() / Math.max(partialFreq, 40) * 0.9);
      osc.stop(tailStop);
    }
  }

  // ── HAMMER NOISE (felt-on-string transient) ───────────────────────────────
  const clickDur    = 0.006 + velocity * 0.008;
  const clickBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * clickDur) + 1, ctx.sampleRate);
  const clickData   = clickBuffer.getChannelData(0);
  for (let i = 0; i < clickData.length; i++) {
    clickData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * clickDur * 0.28));
  }
  const clickSource  = ctx.createBufferSource();
  clickSource.buffer = clickBuffer;

  const clickFilter = ctx.createBiquadFilter();
  clickFilter.type  = "bandpass";
  clickFilter.frequency.value = Math.min(2200 + velocity * 2600, nyquist * 0.8);
  clickFilter.Q.value = 1.2;

  const clickGain = ctx.createGain();
  // velocity² — hammer noise grows disproportionately with force
  clickGain.gain.setValueAtTime(velocity * velocity * 0.4, startTime);
  clickGain.gain.setTargetAtTime(0, startTime + 0.002, clickDur * 0.4);

  clickSource.connect(clickFilter);
  clickFilter.connect(clickGain);
  clickGain.connect(noteBus);
  clickSource.start(startTime);

  // ── KEYBED THUMP (low mechanical knock, felt more than heard) ─────────────
  if (velocity > 0.35) {
    const thump = ctx.createOscillator();
    thump.type  = "sine";
    thump.frequency.setValueAtTime(isBass ? 55 : 75, startTime);
    thump.frequency.exponentialRampToValueAtTime(isBass ? 38 : 50, startTime + 0.04);

    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime((velocity - 0.35) * 0.22, startTime);
    thumpGain.gain.setTargetAtTime(0, startTime + 0.005, 0.02);

    thump.connect(thumpGain);
    thumpGain.connect(noteBus);
    thump.start(startTime);
    thump.stop(startTime + 0.15);
  }

  // ── DAMPER FELT NOISE on release (skip if undamped or pedal held) ─────────
  if (!sustained && !undamped && duration > 0.15) {
    const dDur    = 0.05;
    const dBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dDur) + 1, ctx.sampleRate);
    const dData   = dBuffer.getChannelData(0);
    for (let i = 0; i < dData.length; i++) {
      dData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * dDur * 0.3));
    }
    const dSource  = ctx.createBufferSource();
    dSource.buffer = dBuffer;

    const dFilter = ctx.createBiquadFilter();
    dFilter.type  = "lowpass";
    dFilter.frequency.value = 900;

    const dGain = ctx.createGain();
    dGain.gain.setValueAtTime(0.02 + velocity * 0.015, noteEnd);
    dGain.gain.setTargetAtTime(0, noteEnd + 0.005, 0.015);

    dSource.connect(dFilter);
    dFilter.connect(dGain);
    dGain.connect(noteBus);
    dSource.start(noteEnd);
  }

  // ── SYMPATHETIC RESONANCE (pedal down: other strings ring quietly) ────────
  if (sustained || duration > 0.8) {
    const resDur    = Math.min(2.0, duration * 0.8);
    const resBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * resDur) + 1, ctx.sampleRate);
    const resData   = resBuffer.getChannelData(0);
    for (let i = 0; i < resData.length; i++) resData[i] = Math.random() * 2 - 1;

    const resSource  = ctx.createBufferSource();
    resSource.buffer = resBuffer;

    // Two narrow resonators — octave and twelfth above — richer than one band
    const bands = [
      { f: freq * 2, g: 0.014 },
      { f: freq * 3, g: 0.007 },
    ];
    for (const band of bands) {
      if (band.f > nyquist * 0.9) continue;
      const resFilter = ctx.createBiquadFilter();
      resFilter.type  = "bandpass";
      resFilter.frequency.value = band.f;
      resFilter.Q.value = 18;

      const resGain = ctx.createGain();
      resGain.gain.setValueAtTime(band.g * velocity, startTime + 0.05);
      resGain.gain.setTargetAtTime(0, noteEnd, 0.5);

      resSource.connect(resFilter);
      resFilter.connect(resGain);
      resGain.connect(noteBus);
    }
    resSource.start(startTime + 0.05);
    resSource.stop(noteEnd + resDur);
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
    // Slight humanisation — each finger hits slightly different time.
    // Lowest note tends to land a hair early (natural hand roll).
    const humanOffset = i * (0.006 + Math.random() * 0.006);
    // Outer fingers slightly stronger than inner — natural voicing
    const edge         = i === 0 || i === notes.length - 1 ? 1.0 : 0.88;
    const velVariation = velocity * edge * (0.9 + Math.random() * 0.1);
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
    // Human rolls accelerate very slightly and swell in velocity
    const noteStart = startTime + i * rollSpeed * (1 - i * 0.008);
    const vel       = velocity * (0.85 + (i / Math.max(notes.length - 1, 1)) * 0.12 + Math.random() * 0.05);
    renderGrandPiano(ctx, n.note, n.octave, noteStart, noteDuration, Math.min(vel, 1), sustained);
  });
}