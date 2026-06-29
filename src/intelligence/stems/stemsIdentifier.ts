// ─────────────────────────────────────────────────────────────────────────────
// Nokashi Stem Identification Engine
// src/intelligence/stems/stemsIdentifier.ts
//
// Layer 1 — Filename Parser  (keyword dictionary → section + slot)
// Layer 2 — Audio Fingerprint (frequency + stereo + dynamic profile)
// Layer 3 — Conflict resolution + slot de-duplication
// ─────────────────────────────────────────────────────────────────────────────

export type StemSection = "drums" | "instruments" | "vocals" | "other";

export interface StemSlotDefinition {
  section: StemSection;
  slot:    string;       // base slot name e.g. "guitar", "kick"
}

export interface IdentificationResult {
  section:              StemSection;
  slot:                 string;       // final slot name e.g. "guitar_1"
  slotBase:             string;       // base without index e.g. "guitar"
  slotIndex:            number;       // 1, 2, 3 …
  confidence:           number;       // 0–1
  method:               "filename" | "audio" | "combined" | "unidentified";
  needsReview:          boolean;
  runKeyDetection:      boolean;      // true for melodic / instrument / bass
  keySource:            "stem_melodic" | "stem_bass" | null;
  filenameMatch:        StemSlotDefinition | null;
  audioMatch:           StemSlotDefinition | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// KEYWORD DICTIONARY
// Each entry: keywords that match → { section, slot }
// Longer / more specific phrases listed first so they win over short ones.
// ─────────────────────────────────────────────────────────────────────────────
interface KeywordEntry {
  keywords: string[];
  result:   StemSlotDefinition;
  weight:   number; // 0–1 filename confidence when matched
}

const KEYWORD_MAP: KeywordEntry[] = [
  // ── DRUMS ──────────────────────────────────────────────────────────────────
  { keywords: ["kick", "bd", "bass drum", "bassdrum", "bass_drum", "kd", "k_drum"], result: { section: "drums", slot: "kick" },       weight: 0.95 },
  { keywords: ["snare", "sd", "snr", "sn_"],                                         result: { section: "drums", slot: "snare" },      weight: 0.95 },
  { keywords: ["hihat", "hi-hat", "hi_hat", "hhat", "hh", "hat", "cymbal", "cymb"], result: { section: "drums", slot: "hihat" },      weight: 0.90 },
  { keywords: ["perc", "percussion", "conga", "bongo", "shaker", "tamb", "clap"],   result: { section: "drums", slot: "percussion" }, weight: 0.88 },
  { keywords: ["overhead", "ovhd", "oh_", "_oh", "overheads"],                      result: { section: "drums", slot: "overhead" },   weight: 0.90 },
  { keywords: ["room", "drum_room", "room_mic", "ambroom"],                         result: { section: "drums", slot: "room" },       weight: 0.85 },
  { keywords: ["drum", "drm", "kit"],                                                result: { section: "drums", slot: "kick" },       weight: 0.60 }, // generic drum → default kick slot, low confidence

  // ── INSTRUMENTS ────────────────────────────────────────────────────────────
  { keywords: ["elec_guitar", "electric_guitar", "elec guitar", "egtr", "e_gtr"],   result: { section: "instruments", slot: "guitar" }, weight: 0.95 },
  { keywords: ["acou_guitar", "acoustic_guitar", "acou guitar", "agtr", "a_gtr"],   result: { section: "instruments", slot: "guitar" }, weight: 0.95 },
  { keywords: ["guitar", "gtr", "git", "guit"],                                     result: { section: "instruments", slot: "guitar" }, weight: 0.90 },
  { keywords: ["piano", "pno", "grand", "upright_piano", "pian"],                   result: { section: "instruments", slot: "piano" },  weight: 0.92 },
  { keywords: ["keys", "keyboard", "kbd", "key_"],                                  result: { section: "instruments", slot: "piano" },  weight: 0.80 },
  { keywords: ["synth", "syn", "pad", "lead_synth", "arp", "seq"],                  result: { section: "instruments", slot: "synth" },  weight: 0.88 },
  { keywords: ["elec_bass", "electric_bass", "bass_guitar", "ebass"],               result: { section: "instruments", slot: "bass" },   weight: 0.95 },
  { keywords: ["bass", "bs", "low_end"],                                             result: { section: "instruments", slot: "bass" },   weight: 0.85 },
  { keywords: ["strings", "violin", "viola", "cello", "orchestra", "orch"],         result: { section: "instruments", slot: "synth" },  weight: 0.82 },
  { keywords: ["brass", "trumpet", "trombone", "horn", "sax"],                      result: { section: "instruments", slot: "synth" },  weight: 0.80 },

  // ── VOCALS ─────────────────────────────────────────────────────────────────
  { keywords: ["lead_vox", "lead_vocal", "lead vocal", "main_vox", "main vocal", "lvox"], result: { section: "vocals", slot: "lead_vocal" },  weight: 0.97 },
  { keywords: ["backing_vox", "backing_vocal", "bvox", "bgv", "back_vox"],                result: { section: "vocals", slot: "backing" },      weight: 0.95 },
  { keywords: ["harmony", "harmonies", "harm"],                                            result: { section: "vocals", slot: "harmony" },      weight: 0.93 },
  { keywords: ["adlib", "ad_lib", "ad-lib", "adlibs", "vox_chop", "chop"],               result: { section: "vocals", slot: "adlibs" },       weight: 0.90 },
  { keywords: ["vocal", "vox", "voice", "vcl", "singer", "rap", "verse", "chorus_vox"],  result: { section: "vocals", slot: "lead_vocal" },  weight: 0.85 },

  // ── OTHER ──────────────────────────────────────────────────────────────────
  { keywords: ["fx", "sfx", "effect", "riser", "sweep", "impact", "stab"],          result: { section: "other", slot: "fx" },        weight: 0.88 },
  { keywords: ["foley", "fol"],                                                      result: { section: "other", slot: "foley" },     weight: 0.90 },
  { keywords: ["amb", "ambience", "ambiance", "atmosphere", "atmos"],                result: { section: "other", slot: "ambience" },  weight: 0.88 },
  { keywords: ["misc", "other", "extra", "add", "additional"],                       result: { section: "other", slot: "misc" },      weight: 0.50 },
];

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — FILENAME PARSER
// ─────────────────────────────────────────────────────────────────────────────
function parseFilename(fileName: string): { result: StemSlotDefinition; confidence: number } | null {
  // Normalise: lowercase, strip extension, replace separators with spaces
  const name = fileName
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")          // remove extension
    .replace(/[_\-\.]+/g, " ")         // separators → spaces
    .replace(/\d+/g, " $& ")           // pad numbers with spaces
    .replace(/\s+/g, " ")
    .trim();

  let bestMatch: { result: StemSlotDefinition; confidence: number } | null = null;

  for (const entry of KEYWORD_MAP) {
    for (const kw of entry.keywords) {
      const norm = kw.replace(/[_\-\.]+/g, " ").toLowerCase();
      if (name.includes(norm)) {
        // Longer keyword match = higher confidence boost
        const lengthBoost = Math.min(0.05, norm.length * 0.003);
        const confidence  = Math.min(1, entry.weight + lengthBoost);
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { result: entry.result, confidence };
        }
      }
    }
  }

  return bestMatch;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIO FINGERPRINT PROFILE
// Passed in from Aura Ears analysis
// ─────────────────────────────────────────────────────────────────────────────
export interface AudioFingerprint {
  freqSub:           number; // dBFS 20-60Hz
  freqBass:          number; // dBFS 60-200Hz
  freqLowMid:        number; // dBFS 200-500Hz
  freqMid:           number; // dBFS 500-2kHz
  freqHighMid:       number; // dBFS 2-6kHz
  freqAir:           number; // dBFS 6-20kHz
  stereoWidth:       number; // %
  stereoCorrelation: number; // -1 to 1
  dynamicRange:      number; // dB
  crestFactor:       number; // dB (high = transient-heavy)
  integratedLufs:    number;
  truePeak:          number;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2 — AUDIO FINGERPRINT CLASSIFIER
// ─────────────────────────────────────────────────────────────────────────────
function classifyByAudio(fp: AudioFingerprint): { result: StemSlotDefinition; confidence: number } | null {
  const scores: Array<{ result: StemSlotDefinition; score: number }> = [];

  // ── KICK: sub-heavy, high crest (transient), mono-ish ──
  {
    let s = 0;
    if (fp.freqSub  > -20) s += 0.30;
    if (fp.freqBass > -18) s += 0.20;
    if (fp.crestFactor > 12) s += 0.25;
    if (fp.stereoWidth < 20) s += 0.15;
    if (fp.freqAir < -30)   s += 0.10;
    scores.push({ result: { section: "drums", slot: "kick" }, score: s });
  }

  // ── SNARE: mid-heavy, high crest, some air ──
  {
    let s = 0;
    if (fp.freqMid    > -20) s += 0.25;
    if (fp.freqHighMid> -22) s += 0.20;
    if (fp.crestFactor > 10) s += 0.25;
    if (fp.freqSub    < -25) s += 0.15;
    if (fp.stereoWidth < 30) s += 0.15;
    scores.push({ result: { section: "drums", slot: "snare" }, score: s });
  }

  // ── HI-HATS: air-dominant, high freq, short transient ──
  {
    let s = 0;
    if (fp.freqAir    > -20) s += 0.35;
    if (fp.freqHighMid> -18) s += 0.25;
    if (fp.freqSub    < -35) s += 0.20;
    if (fp.freqBass   < -30) s += 0.20;
    scores.push({ result: { section: "drums", slot: "hihat" }, score: s });
  }

  // ── BASS: sub + bass dominant, harmonic, mono ──
  {
    let s = 0;
    if (fp.freqSub    > -15) s += 0.30;
    if (fp.freqBass   > -12) s += 0.30;
    if (fp.stereoWidth < 15) s += 0.15;
    if (fp.freqAir    < -28) s += 0.15;
    if (fp.crestFactor < 10) s += 0.10; // sustained, not transient
    scores.push({ result: { section: "instruments", slot: "bass" }, score: s });
  }

  // ── GUITAR: mid + high-mid dominant, some stereo ──
  {
    let s = 0;
    if (fp.freqMid    > -18) s += 0.25;
    if (fp.freqHighMid> -20) s += 0.25;
    if (fp.freqLowMid > -20) s += 0.15;
    if (fp.stereoWidth > 20) s += 0.20;
    if (fp.freqSub    < -28) s += 0.15;
    scores.push({ result: { section: "instruments", slot: "guitar" }, score: s });
  }

  // ── PIANO / KEYS: full spectrum, wide stereo, harmonic ──
  {
    let s = 0;
    if (fp.freqMid    > -20) s += 0.20;
    if (fp.freqHighMid> -22) s += 0.20;
    if (fp.freqBass   > -22) s += 0.15;
    if (fp.stereoWidth > 30) s += 0.25;
    if (fp.dynamicRange > 8) s += 0.20;
    scores.push({ result: { section: "instruments", slot: "piano" }, score: s });
  }

  // ── SYNTH / PAD: wide stereo, sustained, mid-air heavy ──
  {
    let s = 0;
    if (fp.stereoWidth  > 50) s += 0.30;
    if (fp.freqMid      > -20) s += 0.20;
    if (fp.freqAir      > -25) s += 0.20;
    if (fp.crestFactor  < 8)   s += 0.15; // sustained
    if (fp.dynamicRange < 6)   s += 0.15; // compressed/padded
    scores.push({ result: { section: "instruments", slot: "synth" }, score: s });
  }

  // ── LEAD VOCAL: mid + high-mid, wide, dynamic ──
  {
    let s = 0;
    if (fp.freqMid      > -18) s += 0.25;
    if (fp.freqHighMid  > -20) s += 0.20;
    if (fp.stereoWidth  > 15)  s += 0.15;
    if (fp.dynamicRange > 10)  s += 0.25;
    if (fp.freqSub      < -30) s += 0.15;
    scores.push({ result: { section: "vocals", slot: "lead_vocal" }, score: s });
  }

  // ── FX / AMBIENCE: very wide stereo, low crest, air heavy ──
  {
    let s = 0;
    if (fp.stereoWidth  > 70) s += 0.35;
    if (fp.freqAir      > -22) s += 0.25;
    if (fp.crestFactor  < 6)   s += 0.20;
    if (fp.dynamicRange < 4)   s += 0.20;
    scores.push({ result: { section: "other", slot: "ambience" }, score: s });
  }

  // Pick highest score
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  // Only trust audio classification if score is reasonably high
  if (best.score < 0.45) return null;

  // Normalise score to 0–1 confidence
  const confidence = Math.min(0.90, best.score);
  return { result: best.result, confidence };
}

// ─────────────────────────────────────────────────────────────────────────────
// KEY DETECTION ELIGIBILITY
// ─────────────────────────────────────────────────────────────────────────────
const MELODIC_SLOTS = new Set([
  "lead_vocal", "backing", "harmony", "adlibs",
  "guitar", "piano", "synth",
]);
const BASS_SLOTS = new Set(["bass"]);

function getKeyDetectionConfig(slot: string): {
  runKeyDetection: boolean;
  keySource: "stem_melodic" | "stem_bass" | null;
} {
  const base = slot.replace(/_\d+$/, ""); // strip index suffix
  if (BASS_SLOTS.has(base))    return { runKeyDetection: true, keySource: "stem_bass" };
  if (MELODIC_SLOTS.has(base)) return { runKeyDetection: true, keySource: "stem_melodic" };
  return { runKeyDetection: false, keySource: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 3 — CONFLICT RESOLUTION + SLOT DE-DUPLICATION
// ─────────────────────────────────────────────────────────────────────────────
function resolveConflict(
  filename: { result: StemSlotDefinition; confidence: number } | null,
  audio:    { result: StemSlotDefinition; confidence: number } | null,
): { result: StemSlotDefinition; confidence: number; method: IdentificationResult["method"] } {

  if (!filename && !audio) {
    return {
      result:     { section: "other", slot: "misc" },
      confidence: 0,
      method:     "unidentified",
    };
  }

  if (filename && !audio) {
    return { result: filename.result, confidence: filename.confidence, method: "filename" };
  }

  if (!filename && audio) {
    return { result: audio.result, confidence: audio.confidence, method: "audio" };
  }

  // Both exist
  const fn = filename!;
  const au = audio!;

  if (fn.result.section === au.result.section && fn.result.slot === au.result.slot) {
    // Agreement — boost confidence
    return {
      result:     fn.result,
      confidence: Math.min(1, (fn.confidence + au.confidence) / 2 + 0.10),
      method:     "combined",
    };
  }

  // Disagreement — higher confidence wins, but lower confidence overall
  const winner = fn.confidence >= au.confidence ? fn : au;
  return {
    result:     winner.result,
    confidence: Math.max(fn.confidence, au.confidence) * 0.80, // penalty for disagreement
    method:     fn.confidence >= au.confidence ? "filename" : "audio",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SLOT INDEX TRACKER — call once per batch of files
// ─────────────────────────────────────────────────────────────────────────────
export function createSlotIndexTracker() {
  const counts: Record<string, number> = {};
  return {
    assign(slotBase: string): { slot: string; slotIndex: number } {
      const key   = slotBase.replace(/_\d+$/, "");
      counts[key] = (counts[key] ?? 0) + 1;
      const idx   = counts[key];
      return {
        slot:      idx === 1 ? key : `${key}_${idx}`,
        slotIndex: idx,
      };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT — identify a single stem
// ─────────────────────────────────────────────────────────────────────────────
export function identifyStem(
  fileName:    string,
  fingerprint: AudioFingerprint | null,
  slotTracker: ReturnType<typeof createSlotIndexTracker>,
): IdentificationResult {

  const filenameMatch = parseFilename(fileName);
  const audioMatch    = fingerprint ? classifyByAudio(fingerprint) : null;

  const resolved = resolveConflict(filenameMatch, audioMatch);

  const slotBase           = resolved.result.slot;
  const { slot, slotIndex } = slotTracker.assign(slotBase);

  const needsReview = resolved.confidence < 0.65 || resolved.method === "unidentified";

  const { runKeyDetection, keySource } = getKeyDetectionConfig(slot);

  return {
    section:         resolved.result.section,
    slot,
    slotBase,
    slotIndex,
    confidence:      resolved.confidence,
    method:          resolved.method,
    needsReview,
    runKeyDetection,
    keySource,
    filenameMatch:   filenameMatch?.result ?? null,
    audioMatch:      audioMatch?.result    ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH IDENTIFY — for the popup, run all files at once
// ─────────────────────────────────────────────────────────────────────────────
export interface StemFileInput {
  fileName:    string;
  fingerprint: AudioFingerprint | null;
}

export function identifyStems(files: StemFileInput[]): IdentificationResult[] {
  const tracker = createSlotIndexTracker();
  return files.map(f => identifyStem(f.fileName, f.fingerprint, tracker));
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION DISPLAY HELPERS
// ─────────────────────────────────────────────────────────────────────────────
export const SECTION_LABELS: Record<StemSection, string> = {
  drums:       "Drums",
  instruments: "Instruments",
  vocals:      "Vocals",
  other:       "Other",
};

export const SLOT_OPTIONS: Record<StemSection, string[]> = {
  drums:       ["kick", "snare", "hihat", "percussion", "overhead", "room"],
  instruments: ["guitar", "piano", "bass", "synth", "strings", "brass"],
  vocals:      ["lead_vocal", "backing", "harmony", "adlibs"],
  other:       ["fx", "foley", "ambience", "misc"],
};

export const SLOT_LABELS: Record<string, string> = {
  kick:        "Kick",
  snare:       "Snare",
  hihat:       "Hi-Hats",
  percussion:  "Percussion",
  overhead:    "Overhead",
  room:        "Room",
  guitar:      "Guitar",
  piano:       "Piano",
  bass:        "Bass",
  synth:       "Synth",
  strings:     "Strings",
  brass:       "Brass",
  lead_vocal:  "Lead Vocal",
  backing:     "Backing",
  harmony:     "Harmony",
  adlibs:      "Ad-libs",
  fx:          "FX",
  foley:       "Foley",
  ambience:    "Ambience",
  misc:        "Misc",
};