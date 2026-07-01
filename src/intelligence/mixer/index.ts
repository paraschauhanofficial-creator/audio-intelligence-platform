/**
 * Aura Mixer — src/intelligence/mixer/index.ts
 * V2 — Comprehensive industry-standard mixing engine
 *
 * Built from research into:
 * - Western mixing standards (pan placement, gain staging, HPF, EQ)
 * - Indian classical/devotional standards (tabla, harmonium, tanpura, sitar)
 * - Streaming loudness targets (Spotify -14 LUFS, Apple Music -16 LUFS)
 * - Genre-specific level relationships (drums anchor, vocals loudest, bass center)
 *
 * Pipeline position:
 *   analyzeStem() per stem
 *       ↓
 *   runAutoMix() — decode AudioBuffers
 *       ↓
 *   mixStems() ← THIS FILE
 *       ↓
 *   auraMaster()
 *
 * Nothing outside this file is touched. Drop-in replacement — same signature.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface MixerStemRecord {
  section:         string;       // "drums"|"instruments"|"vocals"|"other"
  slot:            string;       // e.g. "kick","lead_vocal","tabla","harmonium"
  slot_index:      number;       // 1 = first instance, 2 = second, etc.
  mix_role:        string;       // "main" | "supporting" — set by user on identification page
  integrated_lufs: number | null;
  true_peak:       number | null;
  freq_sub:        number | null;   // dB at ~40Hz
  freq_bass:       number | null;   // dB at ~130Hz
  freq_low_mid:    number | null;   // dB at ~350Hz
  freq_mid:        number | null;   // dB at ~1kHz
  freq_high_mid:   number | null;   // dB at ~4kHz
  freq_air:        number | null;   // dB at ~13kHz
  stereo_width:    number | null;   // 0–100%
  musical_key:     string | null;
  scale:           string | null;
}

interface ProcessedStem {
  buffer:       AudioBuffer;
  stem:         MixerStemRecord;
  gainDb:       number;
  pan:          number;
  hpfHz:        number;
  lpfHz:        number | null;
  sectionLabel: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION TARGET LUFS
// Research-backed relative levels before summing.
// Industry standard: lead vocal sits loudest, kick/bass anchor, drums energy.
// Indian music: vocal sits same position; tabla replaces drums; tanpura is bed.
// ─────────────────────────────────────────────────────────────────────────────
const SECTION_TARGET_LUFS: Record<string, number> = {
  drums:       -18,   // Kick/snare anchor — full energy, tightly controlled
  instruments: -22,   // Support layer — below drums and vocals
  vocals:      -16,   // Lead element — sits above everything else
  other:       -23,   // Pads, drones, FX, tanpura — deepest in the mix
};

// ─────────────────────────────────────────────────────────────────────────────
// PAN MAP — WESTERN INSTRUMENTS
// Research sources: industry pan cheat sheets, pro engineer consensus
// Rules applied:
//   - Sub-bass below 80Hz: always center (bass, kick, 808)
//   - Lead elements: always center (lead vocal, snare, kick)
//   - Counterbalance: guitar L → guitar R, backing vocal L → BV R
//   - Avoid hard pan (>0.8) for primary elements — causes mono issues
//   - Hi-hats, overheads: moderate spread reflecting live drum kit
// ─────────────────────────────────────────────────────────────────────────────
const SLOT_PAN_WESTERN: Record<string, number> = {
  // ── DRUMS ──────────────────────────────────────────────────────────────
  kick:           0,      // always center — sub energy must stay mono
  snare:          0,      // always center — primary beat anchor
  hihat:          0.45,   // audience perspective: right of center
  hi_hat:         0.45,
  overhead:       0,      // overheads capture kit as stereo pair, keep wide
  room:           0,
  clap:           0,      // clap replaces snare — center
  percussion:     0.25,
  shaker:         0.35,
  tambourine:     -0.3,
  tom:            0.2,
  tom_1:          0.2,    // high tom: slight right (audience perspective)
  tom_2:          -0.2,   // mid tom: slight left
  floor_tom:      -0.45,  // floor tom: moderate left
  ride:           -0.4,   // ride cymbal: left (audience perspective)
  crash:          0.5,    // crash right
  crash_1:        0.5,
  crash_2:        -0.4,

  // ── BASS & LOW INSTRUMENTS ─────────────────────────────────────────────
  bass:           0,      // always center — sub frequencies are non-directional
  sub_bass:       0,
  bass_guitar:    0,
  electric_bass:  0,

  // ── GUITARS ────────────────────────────────────────────────────────────
  // Research: doubled guitars panned hard L/R is industry standard.
  // Single guitar: moderate pan, not hard. Chord-heavy guitar: wider spread.
  guitar:         -0.55,  // primary guitar: left
  guitar_1:       -0.55,  // first guitar: left
  guitar_2:       0.55,   // second guitar: right (counterbalance)
  guitar_3:       -0.3,   // third guitar: moderate left fill
  acoustic_guitar:-0.5,
  electric_guitar:-0.55,
  rhythm_guitar:  -0.6,
  lead_guitar:    0.6,    // lead guitar solos: spread right

  // ── KEYBOARDS & PIANO ──────────────────────────────────────────────────
  // Research: piano as chord carpet = center + wide. Solo piano = center.
  // Multiple keys: spread to opposite sides.
  piano:          0,      // main piano: center with width
  piano_1:        -0.2,
  piano_2:        0.2,
  grand_piano:    0,
  electric_piano: 0.15,
  organ:          0,
  keys:           0,
  synth:          -0.35,
  synth_1:        -0.35,
  synth_2:        0.35,   // second synth: opposite side
  synth_3:        -0.5,
  pad:            0,      // pads: center but wide (handled by stereo_width)
  arp:            0.4,
  strings:        0,
  strings_1:      -0.3,
  strings_2:      0.3,
  brass:          0.2,
  woodwind:       -0.2,

  // ── VOCALS ─────────────────────────────────────────────────────────────
  // Industry rule: lead vocal always center. Backing/harmony spread symmetrically.
  // Research: "vocals are the most important element — center keeps listener focused"
  lead_vocal:     0,      // center — non-negotiable
  vocal:          0,
  lead:           0,
  backing:        -0.45,  // first backing vocal: left
  backing_1:      -0.45,
  backing_2:      0.45,   // second backing: right (mirror)
  backing_3:      -0.6,
  harmony:        -0.5,
  harmony_1:      -0.5,
  harmony_2:      0.5,
  adlibs:         0.35,
  choir:          0,      // choir: center (stereo_width handles spread)
  bgv:            -0.45,

  // ── FX & OTHER ─────────────────────────────────────────────────────────
  fx:             0.3,
  fx_1:           -0.4,
  fx_2:           0.4,
  foley:          0.2,
  ambience:       0,
  drone:          0,
  misc:           0,
};

// ─────────────────────────────────────────────────────────────────────────────
// PAN MAP — INDIAN INSTRUMENTS
// Research: Indian classical/devotional mixing standards
//
// Core principles:
//   - Tanpura (drone): wide stereo spread, center — foundational bed of the mix
//   - Tabla: sits like a drum kit — center/slight right (audience perspective),
//     the bayan (bass drum) left, dayan (treble drum) right
//   - Harmonium: center-left — melodic foundation supporting vocalist
//   - Sitar/Sarod: slight right spread — lead melodic instrument
//   - Bansuri (flute): opposite to sitar — creates dialogue
//   - Vocalist: always center, front of mix — same as Western lead vocal
//   - Sarangi/Violin: slight left — bowing instrument, string texture
//   - Santoor/Swarmandal: wide, supporting harmonic role
//   - Manjira/Khartal: moderate spread — rhythmic accents
// ─────────────────────────────────────────────────────────────────────────────
const SLOT_PAN_INDIAN: Record<string, number> = {
  // ── PERCUSSION ─────────────────────────────────────────────────────────
  tabla:          0,      // center — primary rhythm instrument
  tabla_1:        0,
  tabla_2:        0,
  dayan:          0.2,    // right hand drum (treble)
  bayan:          -0.2,   // left hand drum (bass)
  mridangam:      0,
  dholak:         0,
  dhol:           0,
  pakhawaj:       0,
  ghatam:         0.3,
  kanjira:        0.3,
  morsing:        0.4,
  morchang:       0.4,
  khol:           0,
  manjira:        -0.5,   // finger cymbals: slight left
  khartal:        0.5,    // wooden clappers: slight right
  chimta:         -0.35,

  // ── DRONE / HARMONIC BED ───────────────────────────────────────────────
  // Tanpura is the foundation — wide, immersive, supporting the tonal center
  tanpura:        0,      // center but with full stereo_width expansion
  tamboura:       0,
  shruti_box:     0,
  swarmandal:     0,      // harp-like drone — center/wide

  // ── MELODIC (LEAD) ─────────────────────────────────────────────────────
  sitar:          0.3,    // lead string: slight right
  sarod:          0.3,
  surbahar:       0.25,
  veena:          0.25,
  santoor:        -0.3,   // hammered dulcimer: slight left (dialogue with sitar)
  sarangi:        -0.3,   // bowed strings: left — texture and ornament
  esraj:          -0.25,
  dilruba:        -0.25,
  violin:         -0.35,  // Indian violin: left (Carnatic tradition)
  viola:          -0.2,
  cello:          0.15,

  // ── WIND ───────────────────────────────────────────────────────────────
  bansuri:        -0.4,   // bamboo flute: left — dialogue opposite sitar
  flute:          -0.35,
  shehnai:        0.3,    // oboe-like: slight right
  nadaswaram:     0.35,
  pungi:          0.4,

  // ── KEYBOARD/HARMONY ───────────────────────────────────────────────────
  harmonium:      -0.2,   // left-center — melodic support under vocal
  accordion:      -0.2,

  // ── VOCALS (Indian) ────────────────────────────────────────────────────
  // In Indian music, the soloist is always absolutely center, very upfront.
  // Accompanying vocalists (choir, chorus) spread wide.
  // Vocal ornamentation and alap: same center position.
  khyal:          0,
  dhrupad:        0,
  thumri:         0,
  qawwali:        0,
  ghazal:         0,
  bhajan_vocal:   0,
  kirtan_lead:    0,
  kirtan_chorus:  0,      // chorus treated as wide choir

  // ── REGIONAL/FOLK ──────────────────────────────────────────────────────
  dholki:         0,
  nagara:         0,
  dhimay:         0.25,
  damru:          0.4,
  ektara:         -0.4,
  dotara:         -0.35,
  rabab:          0.3,
  rubab:          0.3,
};

// Merge both maps — Indian slots override Western defaults where they overlap
const SLOT_PAN: Record<string, number> = {
  ...SLOT_PAN_WESTERN,
  ...SLOT_PAN_INDIAN,
};

// ─────────────────────────────────────────────────────────────────────────────
// HIGH-PASS FILTER CUTOFFS (Hz)
// Industry practice: every non-bass instrument gets an HPF to remove
// inaudible low-end that muddies the mix and wastes headroom.
// Indian instruments: similar logic — tabla keeps low end, most other
// instruments roll off below their fundamental frequency range.
// ─────────────────────────────────────────────────────────────────────────────
const SLOT_HPF: Record<string, number> = {
  // Western drums
  kick:           20,     // keep full range — sub defines kick character
  snare:          80,     // remove sub but keep body
  hihat:          250,    // hi-hats have almost no useful energy below 250Hz
  hi_hat:         250,
  overhead:       80,
  room:           60,
  clap:           200,
  percussion:     100,
  shaker:         300,
  tambourine:     350,
  tom:            60,
  tom_1:          60,
  tom_2:          50,
  floor_tom:      40,
  ride:           200,
  crash:          200,
  crash_1:        200,
  crash_2:        200,

  // Bass
  bass:           30,     // keep fundamental but remove rumble
  sub_bass:       20,
  bass_guitar:    30,

  // Guitars
  guitar:         80,     // guitars have almost nothing below 80Hz worth keeping
  guitar_1:       80,
  guitar_2:       80,
  guitar_3:       80,
  acoustic_guitar:100,
  electric_guitar:80,
  rhythm_guitar:  80,
  lead_guitar:    120,

  // Keys
  piano:          40,
  grand_piano:    40,
  electric_piano: 60,
  organ:          40,
  synth:          40,
  synth_1:        40,
  synth_2:        40,
  synth_3:        60,
  pad:            60,
  arp:            80,
  strings:        60,
  brass:          80,
  woodwind:       120,

  // Vocals (industry standard: roll off everything below 80-100Hz)
  lead_vocal:     80,
  vocal:          80,
  lead:           80,
  backing:        120,
  backing_1:      120,
  backing_2:      120,
  harmony:        120,
  harmony_1:      120,
  harmony_2:      120,
  adlibs:         150,
  choir:          100,
  bgv:            120,

  // FX
  fx:             60,
  fx_1:           60,
  fx_2:           80,
  foley:          80,
  ambience:       40,
  drone:          40,
  misc:           60,

  // ── Indian percussion ──────────────────────────────────────────────────
  // Tabla: bayan (bass) has significant low-end, dayan is bright
  // Keep more low-end than Western snare equivalents
  tabla:          40,
  tabla_1:        40,
  tabla_2:        40,
  dayan:          100,    // treble drum — bright, less low-end
  bayan:          40,     // bass drum — keep low-end
  mridangam:      50,
  dholak:         50,
  dhol:           40,
  pakhawaj:       40,
  ghatam:         80,
  kanjira:        150,
  morchang:       200,
  morchang_1:     200,
  manjira:        400,    // finger cymbals — almost entirely high frequency
  khartal:        350,
  chimta:         300,

  // Indian drone/bed
  tanpura:        60,     // tanpura has full rich low-mid content — keep it
  tamboura:       60,
  shruti_box:     80,
  swarmandal:     80,

  // Indian melodic
  sitar:          100,    // sitar fundamental is mostly above 100Hz
  sarod:          80,
  surbahar:       60,     // surbahar is lower-pitched than sitar
  veena:          80,
  santoor:        100,
  sarangi:        80,
  esraj:          80,
  dilruba:        80,
  violin:         120,    // Indian violin plays in mid-high range
  bansuri:        120,    // flute — roll off everything below fundamental
  flute:          120,
  shehnai:        200,    // oboe-like, mostly mid-high
  nadaswaram:     150,
  harmonium:      60,     // harmonium has low notes — keep some low-end
  accordion:      80,

  // Indian vocals (slightly tighter HPF — Indian vocal styles have strong sibilance)
  khyal:          100,
  dhrupad:        80,     // dhrupad has deeper voice quality — less cut
  thumri:         100,
  qawwali:        100,
  ghazal:         100,
  bhajan_vocal:   100,
  kirtan_lead:    100,
  kirtan_chorus:  120,
};

// ─────────────────────────────────────────────────────────────────────────────
// LOW-PASS FILTER — applied only to specific low-only instruments
// to prevent unwanted high-frequency content
// ─────────────────────────────────────────────────────────────────────────────
const SLOT_LPF: Record<string, number | null> = {
  sub_bass:    120,    // sub bass only wants very low frequencies
  bass:        null,   // full bass keeps clarity in highs
  bass_guitar: null,
  tanpura:     8000,   // tanpura drone — roll off harsh highs for bed quality
  drone:       6000,
  ambience:    10000,
  pad:         null,   // pads can have full range
};

// ─────────────────────────────────────────────────────────────────────────────
// SLOT PRIORITY — determines gain precedence when multiple stems compete
// Higher number = more forward in the mix
// ─────────────────────────────────────────────────────────────────────────────
const SLOT_PRIORITY: Record<string, number> = {
  lead_vocal: 10, vocal: 10, lead: 10,
  khyal: 10, dhrupad: 10, thumri: 10, qawwali: 10, ghazal: 10,
  bhajan_vocal: 10, kirtan_lead: 10,
  kick: 8, snare: 8,
  tabla: 7, mridangam: 7, dholak: 7,
  bass: 7, bass_guitar: 7,
  guitar: 5, guitar_1: 5, guitar_2: 5,
  sitar: 6, sarod: 6, bansuri: 5, harmonium: 5,
  piano: 4, strings: 4,
  backing: 3, backing_1: 3, backing_2: 3,
  harmony: 3, harmony_1: 3, harmony_2: 3,
  tanpura: 2, tamboura: 2, shruti_box: 2, drone: 2, ambience: 1, pad: 2,
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

function slotBase(slot: string): string {
  return slot.replace(/_\d+$/, "");
}

function getSlotValue<T>(map: Record<string, T>, stem: MixerStemRecord, fallback: T): T {
  const base = slotBase(stem.slot);
  return map[stem.slot] ?? map[base] ?? fallback;
}

/**
 * Compute gain adjustment to bring a stem toward its section target LUFS.
 * Also applies a priority-based fine-trim to push lead elements slightly
 * forward and supporting elements slightly back.
 */
function gainForStem(stem: MixerStemRecord): number {
  const targetLufs = SECTION_TARGET_LUFS[stem.section] ?? -20;
  const measuredLufs = stem.integrated_lufs;

  let gainDb: number;
  if (measuredLufs == null || measuredLufs === 0) {
    gainDb = -1; // conservative fallback
  } else {
    gainDb = targetLufs - measuredLufs;
    gainDb = Math.max(-18, Math.min(18, gainDb));
  }

  // Priority trim: ±1.5dB nudge based on how forward this instrument should be
  const base = slotBase(stem.slot);
  const priority = SLOT_PRIORITY[stem.slot] ?? SLOT_PRIORITY[base] ?? 5;
  const priorityTrim = ((priority - 5) / 10) * 1.5;
  gainDb += priorityTrim;

  // mix_role override: Main gets +2dB forward push, Supporting gets -1dB back
  if (stem.mix_role === "main") {
    gainDb += 2.0;
  } else {
    gainDb -= 1.0;
  }

  return dbToLinear(gainDb);
}

/**
 * Compute stereo pan position.
 * For stems with a high slot_index (e.g. guitar_3 = third guitar),
 * mirror the pan of the base slot to counterbalance automatically.
 * Wide-source stems (stereo_width > 40%) are pulled toward center.
 */
function panForStem(stem: MixerStemRecord): number {
  const base = slotBase(stem.slot);
  let pan = getSlotValue(SLOT_PAN, stem, 0);

  // Auto-mirror for multiple instances: even index → mirror
  if (stem.slot_index > 1 && stem.slot_index % 2 === 0) {
    pan = -pan;
  }

  // Wide sources — pull pan toward center to avoid mono imaging issues
  if (stem.stereo_width != null && stem.stereo_width > 40) {
    const widthFactor = Math.min(1, (stem.stereo_width - 40) / 60);
    pan = pan * (1 - widthFactor * 0.6);
  }

  // Tanpura/drone special case: always center regardless
  if (["tanpura", "tamboura", "shruti_box", "drone", "ambience"].includes(base)) {
    pan = 0;
  }

  // mix_role override: Main pulls strongly toward center
  // Supporting stays at its natural slot pan position
  if (stem.mix_role === "main") {
    pan = pan * 0.2; // 80% pull toward center — main element anchors the mix
  }

  return Math.max(-1, Math.min(1, pan));
}

/**
 * Compute HPF cutoff.
 * Also checks frequency analysis — if low-end content is already minimal,
 * push the HPF up slightly more aggressively.
 */
function hpfForStem(stem: MixerStemRecord): number {
  let hz = getSlotValue(SLOT_HPF, stem, 80);

  // Frequency-aware adjustment: if sub content is already very low,
  // push HPF up a bit more (the stem doesn't need those frequencies)
  if (stem.freq_sub != null && stem.freq_sub < -48) {
    hz = Math.min(hz * 1.4, 200);
  }
  if (stem.freq_bass != null && stem.freq_bass < -42 && hz < 150) {
    hz = Math.min(hz * 1.3, 150);
  }

  return Math.max(20, hz);
}

/**
 * Compute LPF cutoff, if applicable.
 */
function lpfForStem(stem: MixerStemRecord): number | null {
  const base = slotBase(stem.slot);
  return SLOT_LPF[stem.slot] ?? SLOT_LPF[base] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * mixStems — Aura Mixer V2 entry point.
 *
 * @param buffers     Decoded AudioBuffers, one per stem, same order as stems[].
 * @param stems       Analysis records, same order as buffers[].
 * @param sampleRate  Output sample rate (default: 44100).
 * @returns A properly mixed stereo AudioBuffer, ready for auraMaster().
 */
export async function mixStems(
  buffers:    AudioBuffer[],
  stems:      MixerStemRecord[],
  sampleRate: number = 44100,
): Promise<AudioBuffer> {
  if (buffers.length === 0) throw new Error("[AuraMixer] No buffers provided.");
  if (buffers.length !== stems.length) throw new Error("[AuraMixer] Buffer/stem count mismatch.");

  const maxLength = Math.max(...buffers.map(b => b.length));

  // OfflineAudioContext — faster than real-time, exact length output
  const offlineCtx = new OfflineAudioContext(2, maxLength, sampleRate);

  // Master output gain — leave headroom for auraMaster's limiter
  // Research: mixes should land around -18 to -23 LUFS pre-master
  // We target the mix to sum cleanly, auraMaster handles final loudness
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = 0.80;
  masterGain.connect(offlineCtx.destination);

  // Log what the mixer is doing for debugging
  const log: string[] = [];

  for (let i = 0; i < buffers.length; i++) {
    const buffer = buffers[i];
    const stem   = stems[i];
    const base   = slotBase(stem.slot);

    const gainLinear = gainForStem(stem);
    const pan        = panForStem(stem);
    const hpfHz      = hpfForStem(stem);
    const lpfHz      = lpfForStem(stem);
    const gainDb     = 20 * Math.log10(gainLinear);

    log.push(
      `[${stem.section}/${stem.slot}] gain=${gainDb.toFixed(1)}dB pan=${pan.toFixed(2)} HPF=${hpfHz}Hz${lpfHz ? ` LPF=${lpfHz}Hz` : ""}`
    );

    // ── SOURCE ────────────────────────────────────────────────────────────
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;

    // ── HPF (two cascaded = 12dB/oct Butterworth roll-off) ────────────────
    const hpf1 = offlineCtx.createBiquadFilter();
    hpf1.type = "highpass";
    hpf1.frequency.value = hpfHz;
    hpf1.Q.value = 0.707;

    const hpf2 = offlineCtx.createBiquadFilter();
    hpf2.type = "highpass";
    hpf2.frequency.value = hpfHz;
    hpf2.Q.value = 0.707;

    // ── LPF (optional — only for drone/sub elements) ──────────────────────
    let lastNode: AudioNode = hpf2;
    if (lpfHz != null) {
      const lpf = offlineCtx.createBiquadFilter();
      lpf.type = "lowpass";
      lpf.frequency.value = lpfHz;
      lpf.Q.value = 0.707;
      hpf2.connect(lpf);
      lastNode = lpf;
    }

    // ── GAIN STAGING ─────────────────────────────────────────────────────
    const gainNode = offlineCtx.createGain();
    gainNode.gain.value = gainLinear;

    // ── STEREO PANNING ────────────────────────────────────────────────────
    const panNode = offlineCtx.createStereoPanner();
    panNode.pan.value = pan;

    // ── SIGNAL CHAIN: source → hpf1 → hpf2 → [lpf] → gain → pan → master ──
    source.connect(hpf1);
    hpf1.connect(hpf2);
    if (lpfHz != null) {
      // lastNode is already connected: hpf2 → lpf
    } else {
      lastNode = hpf2;
    }
    lastNode.connect(gainNode);
    gainNode.connect(panNode);
    panNode.connect(masterGain);

    source.start(0);
  }

  console.log("[AuraMixer V2] Processing stems:");
  log.forEach(l => console.log(" ", l));

  // ── RENDER ────────────────────────────────────────────────────────────────
  const mixedBuffer = await offlineCtx.startRendering();

  // ── OUTPUT SAFETY NORMALIZATION ───────────────────────────────────────────
  // Target: leave the mix at 0.85 peak max so auraMaster has clean headroom
  let peak = 0;
  for (let ch = 0; ch < mixedBuffer.numberOfChannels; ch++) {
    const data = mixedBuffer.getChannelData(ch);
    for (let s = 0; s < data.length; s++) {
      const abs = Math.abs(data[s]);
      if (abs > peak) peak = abs;
    }
  }

  if (peak > 0.85) {
    const scale = 0.85 / peak;
    for (let ch = 0; ch < mixedBuffer.numberOfChannels; ch++) {
      const data = mixedBuffer.getChannelData(ch);
      for (let s = 0; s < data.length; s++) data[s] *= scale;
    }
    console.log(`[AuraMixer V2] Peak ${peak.toFixed(3)} → scaled by ${(0.85/peak).toFixed(3)}`);
  } else {
    console.log(`[AuraMixer V2] Peak ${peak.toFixed(3)} — no scaling needed`);
  }

  const durSec = (maxLength / sampleRate).toFixed(1);
  console.log(`[AuraMixer V2] ✓ ${stems.length} stems → ${durSec}s stereo — ready for auraMaster`);

  return mixedBuffer;
}