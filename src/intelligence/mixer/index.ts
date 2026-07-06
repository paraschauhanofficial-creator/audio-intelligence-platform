/**
 * Aura Mixer — src/intelligence/mixer/index.ts
 * V3 — Bug fixes + industry-standard summing, loudness & width handling
 *
 * Changes from V2:
 *   [FIX] Double-mirror pan bug — explicitly-mapped even-index slots (guitar_2,
 *         backing_2, synth_2 …) no longer get flipped to the wrong side.
 *   [FIX] Render length computed in SECONDS, not frames — mixed-sample-rate
 *         stems (48k uploads into a 44.1k context) no longer truncate/pad.
 *   [FIX] mix_role checked explicitly — unset/unknown roles are neutral,
 *         they no longer silently receive the -1dB "supporting" penalty.
 *   [FIX] Dead LPF routing branch removed.
 *   [FIX] HPF is now a single 12dB/oct Butterworth (V2 accidentally built a
 *         24dB/oct Linkwitz-Riley that bit ~-6dB at the stated cutoff).
 *   [NEW] Per-section summing compensation — N stems matched individually to
 *         a section target sum ~10·log10(N) dB louder than intended. Without
 *         this, 5 instrument stems overpower the lead vocal.
 *   [NEW] true_peak ceiling — LUFS matching can no longer push an already-hot
 *         stem into inter-sample clipping (which previously forced the whole
 *         mix down during normalization).
 *   [NEW] Final loudness trim — rendered mix is measured (gated-RMS
 *         approximation of integrated loudness) and trimmed toward -20 LUFS
 *         so auraMaster receives a consistent pre-master level every time.
 *   [NEW] Stereo width is now actually implemented — M/S widener for stereo
 *         bed elements (tanpura, pads, choir…), light Haas spread for mono
 *         bed sources. V2 only promised this in comments.
 *   [NEW] Wide stereo stems (stereo_width > 60) bypass StereoPanner to avoid
 *         collapsing their image (StereoPanner attenuates one channel).
 *   [NEW] "Supporting" duplicates of the same instrument get pushed wider
 *         (pan ×1.3) and a slightly higher HPF (×1.2) so they separate from
 *         the "main" instance instead of just being quieter.
 *
 * Pipeline position (unchanged):
 *   analyzeStem() per stem
 *       ↓
 *   runAutoMix() — decode AudioBuffers
 *       ↓
 *   mixStems() ← THIS FILE
 *       ↓
 *   auraMaster()
 *
 * Drop-in replacement — same exported signature.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface MixerStemRecord {
  section:         string;       // "drums"|"instruments"|"vocals"|"other"
  slot:            string;       // e.g. "kick","lead_vocal","tabla","harmonium"
  slot_index:      number;       // 1 = first instance, 2 = second, etc.
  mix_role:        string;       // "main" | "supporting" | "" — set by user
  integrated_lufs: number | null;
  true_peak:       number | null; // dBTP from analysis
  freq_sub:        number | null;
  freq_bass:       number | null;
  freq_low_mid:    number | null;
  freq_mid:        number | null;
  freq_high_mid:   number | null;
  freq_air:        number | null;
  stereo_width:    number | null; // 0–100%
  musical_key:     string | null;
  scale:           string | null;
}

/** Per-render context computed once from the full stem list. */
interface MixContext {
  /** How many stems share each section — used for summing compensation. */
  sectionCounts:   Record<string, number>;
  /** Slot bases that appear more than once (guitar, backing, tabla …). */
  duplicatedBases: Set<string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION TARGET LUFS
// Relative per-stem levels BEFORE summing compensation.
// Hierarchy: vocals > drums > instruments > bed. Unchanged from V2.
// ─────────────────────────────────────────────────────────────────────────────
const SECTION_TARGET_LUFS: Record<string, number> = {
  drums:       -18,
  instruments: -22,
  vocals:      -16,
  other:       -23,
};

// Pre-master loudness target for the FINAL summed mix.
// Industry practice: hand the mastering stage ~-18 to -23 LUFS with real
// peaks well under 0dBFS. We trim toward the middle of that window.
const PREMASTER_TARGET_LUFS = -20;
const PREMASTER_TRIM_LIMIT  = 6;     // never trim more than ±6dB
const OUTPUT_PEAK_CEILING   = 0.85;  // linear — headroom for auraMaster

// ─────────────────────────────────────────────────────────────────────────────
// PAN MAP — WESTERN INSTRUMENTS (unchanged values from V2)
// ─────────────────────────────────────────────────────────────────────────────
const SLOT_PAN_WESTERN: Record<string, number> = {
  // ── DRUMS ──────────────────────────────────────────────────────────────
  kick:           0,
  snare:          0,
  hihat:          0.45,
  hi_hat:         0.45,
  overhead:       0,
  room:           0,
  clap:           0,
  percussion:     0.25,
  shaker:         0.35,
  tambourine:     -0.3,
  tom:            0.2,
  tom_1:          0.2,
  tom_2:          -0.2,
  floor_tom:      -0.45,
  ride:           -0.4,
  crash:          0.5,
  crash_1:        0.5,
  crash_2:        -0.4,

  // ── BASS & LOW INSTRUMENTS ─────────────────────────────────────────────
  bass:           0,
  sub_bass:       0,
  bass_guitar:    0,
  electric_bass:  0,

  // ── GUITARS ────────────────────────────────────────────────────────────
  guitar:         -0.55,
  guitar_1:       -0.55,
  guitar_2:       0.55,
  guitar_3:       -0.3,
  acoustic_guitar:-0.5,
  electric_guitar:-0.55,
  rhythm_guitar:  -0.6,
  lead_guitar:    0.6,

  // ── KEYBOARDS & PIANO ──────────────────────────────────────────────────
  piano:          0,
  piano_1:        -0.2,
  piano_2:        0.2,
  grand_piano:    0,
  electric_piano: 0.15,
  organ:          0,
  keys:           0,
  synth:          -0.35,
  synth_1:        -0.35,
  synth_2:        0.35,
  synth_3:        -0.5,
  pad:            0,
  arp:            0.4,
  strings:        0,
  strings_1:      -0.3,
  strings_2:      0.3,
  brass:          0.2,
  woodwind:       -0.2,

  // ── VOCALS ─────────────────────────────────────────────────────────────
  lead_vocal:     0,
  vocal:          0,
  lead:           0,
  backing:        -0.45,
  backing_1:      -0.45,
  backing_2:      0.45,
  backing_3:      -0.6,
  harmony:        -0.5,
  harmony_1:      -0.5,
  harmony_2:      0.5,
  adlibs:         0.35,
  choir:          0,
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
// PAN MAP — INDIAN INSTRUMENTS (unchanged values from V2)
// ─────────────────────────────────────────────────────────────────────────────
const SLOT_PAN_INDIAN: Record<string, number> = {
  // ── PERCUSSION ─────────────────────────────────────────────────────────
  tabla:          0,
  tabla_1:        0,
  tabla_2:        0,
  dayan:          0.2,
  bayan:          -0.2,
  mridangam:      0,
  dholak:         0,
  dhol:           0,
  pakhawaj:       0,
  ghatam:         0.3,
  kanjira:        0.3,
  morsing:        0.4,
  morchang:       0.4,
  khol:           0,
  manjira:        -0.5,
  khartal:        0.5,
  chimta:         -0.35,

  // ── DRONE / HARMONIC BED ───────────────────────────────────────────────
  tanpura:        0,
  tamboura:       0,
  shruti_box:     0,
  swarmandal:     0,

  // ── MELODIC (LEAD) ─────────────────────────────────────────────────────
  sitar:          0.3,
  sarod:          0.3,
  surbahar:       0.25,
  veena:          0.25,
  santoor:        -0.3,
  sarangi:        -0.3,
  esraj:          -0.25,
  dilruba:        -0.25,
  violin:         -0.35,
  viola:          -0.2,
  cello:          0.15,

  // ── WIND ───────────────────────────────────────────────────────────────
  bansuri:        -0.4,
  flute:          -0.35,
  shehnai:        0.3,
  nadaswaram:     0.35,
  pungi:          0.4,

  // ── KEYBOARD/HARMONY ───────────────────────────────────────────────────
  harmonium:      -0.2,
  accordion:      -0.2,

  // ── VOCALS (Indian) ────────────────────────────────────────────────────
  khyal:          0,
  dhrupad:        0,
  thumri:         0,
  qawwali:        0,
  ghazal:         0,
  bhajan_vocal:   0,
  kirtan_lead:    0,
  kirtan_chorus:  0,

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

// Merge — Indian slots override Western defaults where they overlap
const SLOT_PAN: Record<string, number> = {
  ...SLOT_PAN_WESTERN,
  ...SLOT_PAN_INDIAN,
};

// ─────────────────────────────────────────────────────────────────────────────
// HIGH-PASS FILTER CUTOFFS (Hz)
// Now applied as a SINGLE 12dB/oct Butterworth (Q=0.707) — the V2 cascade
// was effectively a 24dB/oct LR4 hitting -6dB at the stated cutoff, which
// bit noticeably higher than these numbers imply.
// ─────────────────────────────────────────────────────────────────────────────
const SLOT_HPF: Record<string, number> = {
  // Western drums
  kick:           20,
  snare:          80,
  hihat:          250,
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
  bass:           30,
  sub_bass:       20,
  bass_guitar:    30,

  // Guitars
  guitar:         80,
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

  // Vocals
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
  tabla:          40,
  tabla_1:        40,
  tabla_2:        40,
  dayan:          100,
  bayan:          40,
  mridangam:      50,
  dholak:         50,
  dhol:           40,
  pakhawaj:       40,
  ghatam:         80,
  kanjira:        150,
  morsing:        200,    // [FIX] was missing — jaw harp, same range as morchang
  morchang:       200,
  manjira:        400,
  khartal:        350,
  chimta:         300,

  // Indian drone/bed
  tanpura:        60,
  tamboura:       60,
  shruti_box:     80,
  swarmandal:     80,

  // Indian melodic
  sitar:          100,
  sarod:          80,
  surbahar:       60,
  veena:          80,
  santoor:        100,
  sarangi:        80,
  esraj:          80,
  dilruba:        80,
  violin:         120,
  bansuri:        120,
  flute:          120,
  shehnai:        200,
  nadaswaram:     150,
  harmonium:      60,
  accordion:      80,

  // Indian vocals
  khyal:          100,
  dhrupad:        80,
  thumri:         100,
  qawwali:        100,
  ghazal:         100,
  bhajan_vocal:   100,
  kirtan_lead:    100,
  kirtan_chorus:  120,
};

// ─────────────────────────────────────────────────────────────────────────────
// LOW-PASS FILTER — specific low-only / bed instruments
// ─────────────────────────────────────────────────────────────────────────────
const SLOT_LPF: Record<string, number | null> = {
  sub_bass:    120,
  bass:        null,
  bass_guitar: null,
  tanpura:     8000,
  drone:       6000,
  ambience:    10000,
  pad:         null,
};

// ─────────────────────────────────────────────────────────────────────────────
// SLOT PRIORITY — gain precedence. Higher = more forward.
// Trim formula gives roughly -0.6dB (priority 1) … +0.75dB (priority 10).
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
// STEREO WIDTH — slots that should be rendered as a WIDE bed.
// V2 promised this in comments; V3 actually implements it.
//   - Stereo sources: M/S widener (side boost, mono-compatible fold-down)
//   - Mono sources:   light Haas spread (12ms, reduced level on delayed side)
// ─────────────────────────────────────────────────────────────────────────────
const WIDE_SLOTS = new Set([
  "tanpura", "tamboura", "shruti_box", "swarmandal",
  "pad", "choir", "kirtan_chorus", "strings", "ambience", "overhead",
]);
const WIDTH_SIDE_BOOST = 1.35;  // M/S side gain for wide stereo beds
const HAAS_DELAY_SEC   = 0.012; // 12ms — inside the Haas window
const HAAS_SIDE_LEVEL  = 0.85;  // delayed side slightly lower → gentler comb on mono fold

// Slots forced to pan center regardless of anything else
const FORCE_CENTER = new Set(["tanpura", "tamboura", "shruti_box", "drone", "ambience"]);

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

/** Build per-render context: section counts + duplicated slot bases. */
function buildMixContext(stems: MixerStemRecord[]): MixContext {
  const sectionCounts: Record<string, number> = {};
  const baseCounts:    Record<string, number> = {};

  for (const s of stems) {
    sectionCounts[s.section] = (sectionCounts[s.section] ?? 0) + 1;
    const b = slotBase(s.slot);
    baseCounts[b] = (baseCounts[b] ?? 0) + 1;
  }

  const duplicatedBases = new Set<string>(
    Object.keys(baseCounts).filter(b => baseCounts[b] > 1)
  );

  return { sectionCounts, duplicatedBases };
}

/**
 * Gain for a stem, in dB. Order of operations:
 *   1. Match to section target LUFS (clamped ±18dB)
 *   2. Summing compensation: N stems in a section sum ~10·log10(N) dB hotter
 *      than one — subtract it so the SECTION lands at its target, not each stem.
 *      (10·log10 assumes uncorrelated sources — the accepted compromise for stems.)
 *   3. Priority fine-trim (±<1dB)
 *   4. mix_role: "main" +2dB, "supporting" -1dB, anything else NEUTRAL.
 *      [FIX] V2 penalized every unset role by -1dB.
 *   5. true_peak ceiling: never gain a stem so its true peak would exceed -1dBTP.
 *      [NEW] prevents one hot stem forcing the whole mix down at normalization.
 */
function gainDbForStem(stem: MixerStemRecord, ctx: MixContext): number {
  const targetLufs   = SECTION_TARGET_LUFS[stem.section] ?? -20;
  const measuredLufs = stem.integrated_lufs;

  let gainDb: number;
  if (measuredLufs == null || measuredLufs === 0) {
    gainDb = -1; // conservative fallback when analysis is missing
  } else {
    gainDb = targetLufs - measuredLufs;
    gainDb = Math.max(-18, Math.min(18, gainDb));
  }

  // 2. Summing compensation
  const n = ctx.sectionCounts[stem.section] ?? 1;
  if (n > 1) gainDb -= 10 * Math.log10(n);

  // 3. Priority trim
  const base = slotBase(stem.slot);
  const priority = SLOT_PRIORITY[stem.slot] ?? SLOT_PRIORITY[base] ?? 5;
  gainDb += ((priority - 5) / 10) * 1.5;

  // 4. mix_role — explicit values only
  if (stem.mix_role === "main") {
    gainDb += 2.0;
  } else if (stem.mix_role === "supporting") {
    gainDb -= 1.0;
  }
  // unset / unknown → neutral

  // 5. true_peak ceiling (analysis reports dBTP)
  if (stem.true_peak != null && Number.isFinite(stem.true_peak)) {
    const ceiling = -1.0 - stem.true_peak; // max gain before exceeding -1dBTP
    gainDb = Math.min(gainDb, ceiling);
  }

  return gainDb;
}

/**
 * Pan position for a stem.
 * [FIX] Auto-mirroring now applies ONLY when the exact slot key was not in
 * the pan map — explicitly-mapped even slots (guitar_2 = +0.55, backing_2 =
 * +0.45 …) already encode their counterbalance and must not be flipped again.
 */
function panForStem(stem: MixerStemRecord, ctx: MixContext): number {
  const base = slotBase(stem.slot);
  const exactMatch = SLOT_PAN[stem.slot] !== undefined;
  let pan = getSlotValue(SLOT_PAN, stem, 0);

  // Auto-mirror ONLY for fallback (base-map) lookups on even instances
  if (!exactMatch && stem.slot_index > 1 && stem.slot_index % 2 === 0) {
    pan = -pan;
  }

  // Wide sources — pull pan toward center to avoid mono imaging issues
  if (stem.stereo_width != null && stem.stereo_width > 40) {
    const widthFactor = Math.min(1, (stem.stereo_width - 40) / 60);
    pan = pan * (1 - widthFactor * 0.6);
  }

  // Drone/bed special case: always center
  if (FORCE_CENTER.has(base)) pan = 0;

  // mix_role shaping:
  //   main       → anchor near center (80% pull)
  //   supporting → if it duplicates another instance of the SAME instrument,
  //                push it wider so it separates from the main instance
  if (stem.mix_role === "main") {
    pan = pan * 0.2;
  } else if (stem.mix_role === "supporting" && ctx.duplicatedBases.has(base)) {
    pan = pan * 1.3;
  }

  return Math.max(-1, Math.min(1, pan));
}

/**
 * HPF cutoff. Supporting duplicates get a slightly higher cutoff (×1.2) so
 * they stop fighting the main instance in the low-mids.
 */
function hpfForStem(stem: MixerStemRecord, ctx: MixContext): number {
  let hz = getSlotValue(SLOT_HPF, stem, 80);

  const base = slotBase(stem.slot);
  if (stem.mix_role === "supporting" && ctx.duplicatedBases.has(base)) {
    hz = Math.min(hz * 1.2, 400);
  }

  // Frequency-aware nudge: if low content is already minimal, clean up harder
  if (stem.freq_sub != null && stem.freq_sub < -48) {
    hz = Math.min(hz * 1.4, 200);
  }
  if (stem.freq_bass != null && stem.freq_bass < -42 && hz < 150) {
    hz = Math.min(hz * 1.3, 150);
  }

  return Math.max(20, hz);
}

function lpfForStem(stem: MixerStemRecord): number | null {
  const base = slotBase(stem.slot);
  return SLOT_LPF[stem.slot] ?? SLOT_LPF[base] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEREO WIDTH PROCESSING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * M/S widener for STEREO sources.
 *   mid  = 0.5·(L+R)
 *   side = 0.5·(L−R) × sideBoost
 *   L'   = mid + side,  R' = mid − side
 * Mono fold-down = mid only → fully mono-compatible.
 * Returns the output node to continue the chain from.
 */
function buildMsWidener(
  ctx: OfflineAudioContext,
  input: AudioNode,
  sideBoost: number,
): AudioNode {
  const splitter = ctx.createChannelSplitter(2);
  input.connect(splitter);

  // mid = 0.5L + 0.5R
  const mid = ctx.createGain();
  mid.gain.value = 1; // sums two 0.5-scaled inputs
  const lHalf = ctx.createGain(); lHalf.gain.value = 0.5;
  const rHalf = ctx.createGain(); rHalf.gain.value = 0.5;
  splitter.connect(lHalf, 0);
  splitter.connect(rHalf, 1);
  lHalf.connect(mid);
  rHalf.connect(mid);

  // side = (0.5L − 0.5R) × boost
  const side = ctx.createGain();
  side.gain.value = sideBoost;
  const lPos = ctx.createGain(); lPos.gain.value = 0.5;
  const rNeg = ctx.createGain(); rNeg.gain.value = -0.5;
  splitter.connect(lPos, 0);
  splitter.connect(rNeg, 1);
  lPos.connect(side);
  rNeg.connect(side);

  // Recombine: L' = mid + side, R' = mid − side
  const sideInv = ctx.createGain();
  sideInv.gain.value = -1;
  side.connect(sideInv);

  const merger = ctx.createChannelMerger(2);
  const outL = ctx.createGain();
  const outR = ctx.createGain();
  mid.connect(outL);  side.connect(outL);
  mid.connect(outR);  sideInv.connect(outR);
  outL.connect(merger, 0, 0);
  outR.connect(merger, 0, 1);

  return merger;
}

/**
 * Haas spread for MONO bed sources: dry → L, 12ms delayed (slightly lower) → R.
 * Gives a mono tanpura/pad a sense of width. Small comb artifact on mono
 * fold-down is the accepted trade-off; delay is short and side level reduced.
 */
function buildHaasSpread(ctx: OfflineAudioContext, input: AudioNode): AudioNode {
  const delay = ctx.createDelay(0.05);
  delay.delayTime.value = HAAS_DELAY_SEC;

  const wet = ctx.createGain();
  wet.gain.value = HAAS_SIDE_LEVEL;
  input.connect(delay);
  delay.connect(wet);

  const merger = ctx.createChannelMerger(2);
  input.connect(merger, 0, 0);
  wet.connect(merger, 0, 1);
  return merger;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOUDNESS MEASUREMENT (gated-RMS approximation of integrated LUFS)
// Full BS.1770 needs K-weighting + two-stage gating; for a pre-master trim a
// 400ms-block gated RMS tracks integrated LUFS within ~1–2dB on typical
// program material, which is plenty for a static trim toward -20.
// ─────────────────────────────────────────────────────────────────────────────
function measureLoudnessApproxDb(buffer: AudioBuffer): number | null {
  const blockLen = Math.floor(0.4 * buffer.sampleRate); // 400ms blocks
  if (blockLen === 0 || buffer.length < blockLen) return null;

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  const blockPowers: number[] = [];
  for (let start = 0; start + blockLen <= buffer.length; start += blockLen) {
    let sumSq = 0;
    for (const data of channels) {
      for (let s = start; s < start + blockLen; s++) {
        sumSq += data[s] * data[s];
      }
    }
    blockPowers.push(sumSq / (blockLen * channels.length));
  }
  if (blockPowers.length === 0) return null;

  // Absolute gate: ignore silence/near-silence blocks (below -60dBFS power)
  const gateThreshold = Math.pow(10, -60 / 10);
  const gated = blockPowers.filter(p => p > gateThreshold);
  if (gated.length === 0) return null;

  const meanPower = gated.reduce((a, b) => a + b, 0) / gated.length;
  return 10 * Math.log10(meanPower);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * mixStems — Aura Mixer V3 entry point.
 *
 * @param buffers     Decoded AudioBuffers, one per stem, same order as stems[].
 * @param stems       Analysis records, same order as buffers[].
 * @param sampleRate  Output sample rate (default: 44100).
 * @returns A mixed stereo AudioBuffer at ~-20 LUFS / ≤0.85 peak, ready for auraMaster().
 */
export async function mixStems(
  buffers:    AudioBuffer[],
  stems:      MixerStemRecord[],
  sampleRate: number = 44100,
): Promise<AudioBuffer> {
  if (buffers.length === 0) throw new Error("[AuraMixer] No buffers provided.");
  if (buffers.length !== stems.length) throw new Error("[AuraMixer] Buffer/stem count mismatch.");

  // [FIX] Length in SECONDS, not frames — handles mixed sample rates correctly
  const maxDuration  = Math.max(...buffers.map(b => b.duration));
  const renderLength = Math.ceil(maxDuration * sampleRate);

  const offlineCtx = new OfflineAudioContext(2, renderLength, sampleRate);

  // Master output gain — summing compensation now does the heavy lifting,
  // this is just a final safety pad before render.
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = 0.9;
  masterGain.connect(offlineCtx.destination);

  const mixCtx = buildMixContext(stems);
  const log: string[] = [];

  for (let i = 0; i < buffers.length; i++) {
    const buffer = buffers[i];
    const stem   = stems[i];
    const base   = slotBase(stem.slot);

    const gainDb     = gainDbForStem(stem, mixCtx);
    const gainLinear = dbToLinear(gainDb);
    const pan        = panForStem(stem, mixCtx);
    const hpfHz      = hpfForStem(stem, mixCtx);
    const lpfHz      = lpfForStem(stem);

    const isWideBed     = WIDE_SLOTS.has(base);
    const isWideStereo  = buffer.numberOfChannels >= 2
                       && stem.stereo_width != null
                       && stem.stereo_width > 60;
    // Wide stereo material bypasses StereoPanner (it attenuates one channel
    // and collapses the image). Wide beds get explicit width processing.
    const skipPanner = isWideBed || isWideStereo;

    log.push(
      `[${stem.section}/${stem.slot}]` +
      ` gain=${gainDb.toFixed(1)}dB pan=${skipPanner ? "wide" : pan.toFixed(2)}` +
      ` HPF=${hpfHz.toFixed(0)}Hz${lpfHz ? ` LPF=${lpfHz}Hz` : ""}` +
      `${stem.mix_role ? ` role=${stem.mix_role}` : ""}`
    );

    // ── SOURCE ────────────────────────────────────────────────────────────
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;

    // ── HPF (single 12dB/oct Butterworth — see header note) ──────────────
    const hpf = offlineCtx.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = hpfHz;
    hpf.Q.value = 0.707;
    source.connect(hpf);
    let lastNode: AudioNode = hpf;

    // ── LPF (optional — drone/sub elements only) ──────────────────────────
    if (lpfHz != null) {
      const lpf = offlineCtx.createBiquadFilter();
      lpf.type = "lowpass";
      lpf.frequency.value = lpfHz;
      lpf.Q.value = 0.707;
      lastNode.connect(lpf);
      lastNode = lpf;
    }

    // ── GAIN STAGING ─────────────────────────────────────────────────────
    const gainNode = offlineCtx.createGain();
    gainNode.gain.value = gainLinear;
    lastNode.connect(gainNode);
    lastNode = gainNode;

    // ── WIDTH / PANNING ───────────────────────────────────────────────────
    if (isWideBed) {
      // Bed elements: real width processing instead of a panner
      if (buffer.numberOfChannels >= 2) {
        lastNode = buildMsWidener(offlineCtx, lastNode, WIDTH_SIDE_BOOST);
      } else {
        lastNode = buildHaasSpread(offlineCtx, lastNode);
      }
    } else if (!skipPanner) {
      const panNode = offlineCtx.createStereoPanner();
      panNode.pan.value = pan;
      lastNode.connect(panNode);
      lastNode = panNode;
    }
    // (wide stereo non-bed stems: connect straight through, image preserved)

    lastNode.connect(masterGain);
    source.start(0);
  }

  console.log("[AuraMixer V3] Processing stems:");
  log.forEach(l => console.log(" ", l));

  // ── RENDER ────────────────────────────────────────────────────────────────
  const mixedBuffer = await offlineCtx.startRendering();

  // ── PRE-MASTER LOUDNESS TRIM ──────────────────────────────────────────────
  // [NEW] Peak normalization alone controls peaks, not loudness — a dense mix
  // could hand auraMaster -10 LUFS with no dynamics headroom. Measure and trim
  // toward the target so mastering always receives a consistent level.
  const measuredDb = measureLoudnessApproxDb(mixedBuffer);
  let trimLinear = 1;
  if (measuredDb != null) {
    let trimDb = PREMASTER_TARGET_LUFS - measuredDb;
    trimDb = Math.max(-PREMASTER_TRIM_LIMIT, Math.min(PREMASTER_TRIM_LIMIT, trimDb));
    trimLinear = dbToLinear(trimDb);
    console.log(
      `[AuraMixer V3] Loudness ≈ ${measuredDb.toFixed(1)}dB → trim ${trimDb >= 0 ? "+" : ""}${trimDb.toFixed(1)}dB toward ${PREMASTER_TARGET_LUFS} LUFS`
    );
  }

  // ── APPLY TRIM + OUTPUT PEAK SAFETY (single pass) ─────────────────────────
  let peak = 0;
  for (let ch = 0; ch < mixedBuffer.numberOfChannels; ch++) {
    const data = mixedBuffer.getChannelData(ch);
    for (let s = 0; s < data.length; s++) {
      data[s] *= trimLinear;
      const abs = Math.abs(data[s]);
      if (abs > peak) peak = abs;
    }
  }

  if (peak > OUTPUT_PEAK_CEILING) {
    const scale = OUTPUT_PEAK_CEILING / peak;
    for (let ch = 0; ch < mixedBuffer.numberOfChannels; ch++) {
      const data = mixedBuffer.getChannelData(ch);
      for (let s = 0; s < data.length; s++) data[s] *= scale;
    }
    console.log(`[AuraMixer V3] Peak ${peak.toFixed(3)} → scaled by ${scale.toFixed(3)}`);
  } else {
    console.log(`[AuraMixer V3] Peak ${peak.toFixed(3)} — within ceiling`);
  }

  const durSec = (renderLength / sampleRate).toFixed(1);
  console.log(`[AuraMixer V3] ✓ ${stems.length} stems → ${durSec}s stereo — ready for auraMaster`);

  return mixedBuffer;
}