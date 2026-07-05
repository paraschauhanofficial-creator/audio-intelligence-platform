// ─────────────────────────────────────────────────────────────────────────────
// PATTERN GENERATOR — V2
// Pure TypeScript — no audio, no DOM. Takes user inputs, produces structured
// note/beat sequences that the synthesis and MIDI layers consume.
//
// What changed vs V1 (and why it sounds more musical):
// - MOTIF STRUCTURE: western melodies use bar-level rhythm cells arranged in
//   an A A B A' form, so phrases repeat and vary instead of random-walking.
//   Indian melodies capture a pakad (signature phrase) and restate it.
// - RHYTHM CELLS: note durations come from pre-built cells that sum to exactly
//   one bar — melodies stay on the beat grid instead of drifting off it.
// - IMPLIED HARMONY: western melodies follow a diatonic chord progression
//   (I–V–vi–IV family); chord tones land on strong beats, passing tones on
//   weak beats. Creates tension/resolution instead of aimless wandering.
// - ABSOLUTE PITCH MATH: stepwise-motion and direction logic use real pitch
//   (octave × 12 + interval), fixing the V1 bug where C4→C5 counted as
//   "distance 0" and octave leaps were invisible to the weighting.
// - PLAYING STYLES IMPLEMENTED: "chords" emits block chords via chordNotes,
//   "arpeggiated" emits rolling eighth patterns over the progression,
//   "two-hand" adds bassNote (left hand) on bar downbeats. V1 declared these
//   fields but never populated them.
// - THEKA FIDELITY: Indian rhythm always plays the full bol cycle — variation
//   now comes from vibhag accents, a crescendo into Sam, and TiRaKiTa-style
//   sixteenth fills before the cycle boundary, never from dropping theka bols.
// - GROOVE TEMPLATES: western rhythm has real kick/snare/hat roles
//   (bass/treble/mid), backbeat on 2 and 4, compound-meter feels, odd-meter
//   groupings (5 = 3+2, 7 = 2+2+3), and a fill every fourth bar.
//
// Public API unchanged: all exported interfaces, types, and functions keep
// identical signatures — wavSynthesis.ts and midiExport.ts need no edits.
// ─────────────────────────────────────────────────────────────────────────────

export interface RhythmEvent {
  beat:      number;   // beat offset from start (in quarter notes)
  duration:  number;   // duration in quarter notes
  velocity:  number;   // 0–1
  element:   "bass" | "treble" | "mid";
  bol?:      string;   // Indian bol name if applicable
  isSam?:    boolean;  // first beat of cycle (strongest)
  isKhali?:  boolean;  // empty beat (softer, often muted)
}

export interface MelodyNote {
  note:       string;   // e.g. "C#" — for chords, this is the root note
  octave:     number;
  duration:   number;   // in quarter notes
  velocity:   number;   // 0–1
  isGamak?:   boolean;  // should this note have ornament/oscillation
  isVadi?:    boolean;  // is this the vadi (most important) note
  isSamvadi?: boolean;  // is this the samvadi note
  isRest?:    boolean;  // silent beat
  // Chord/arpeggio support
  chordNotes?:  { note: string; octave: number }[]; // all notes in chord
  playingStyle?: PlayingStyle;
  bassNote?:    { note: string; octave: number };   // two-hand left hand note
}

// ── Raga rules (inline — same data as raga_rules.ts) ──────────────────────
const RAGA_RULES: Record<string, {
  vadi: number; samvadi: number;
  aaroh: number[]; avaroh: number[];
  forbidden: number[]; gamakNotes: number[];
  vadiWeight: number; restNotes: number[];
}> = {
  yaman:      { vadi:9,  samvadi:2,  aaroh:[0,2,4,6,7,9,11,12],   avaroh:[12,11,9,7,6,4,2,0],     forbidden:[5],         gamakNotes:[4,9,11],    vadiWeight:0.35, restNotes:[0,7,9] },
  bhairav:    { vadi:8,  samvadi:1,  aaroh:[0,1,4,5,7,8,11,12],   avaroh:[12,11,8,7,5,4,1,0],     forbidden:[2,9],       gamakNotes:[1,4,8,11],  vadiWeight:0.35, restNotes:[0,5,7] },
  bhairavi:   { vadi:8,  samvadi:1,  aaroh:[0,1,3,5,7,8,10,12],   avaroh:[12,10,8,7,5,3,1,0],     forbidden:[],          gamakNotes:[1,3,8,10],  vadiWeight:0.30, restNotes:[0,5,7] },
  kafi:       { vadi:5,  samvadi:9,  aaroh:[0,2,3,5,7,9,10,12],   avaroh:[12,10,9,7,5,3,2,0],     forbidden:[4,11],      gamakNotes:[3,10],      vadiWeight:0.30, restNotes:[0,5,7] },
  asavari:    { vadi:8,  samvadi:1,  aaroh:[0,2,5,7,8,12],        avaroh:[12,10,8,7,5,3,2,0],     forbidden:[4,11],      gamakNotes:[3,8,10],    vadiWeight:0.35, restNotes:[0,5,7] },
  bilawal:    { vadi:9,  samvadi:2,  aaroh:[0,2,4,5,7,9,11,12],   avaroh:[12,11,9,7,5,4,2,0],     forbidden:[],          gamakNotes:[4,9],       vadiWeight:0.30, restNotes:[0,5,7,9] },
  khamaj:     { vadi:7,  samvadi:2,  aaroh:[0,2,4,5,7,9,10,12],   avaroh:[12,11,10,9,7,5,4,2,0],  forbidden:[11],        gamakNotes:[4,10],      vadiWeight:0.30, restNotes:[0,5,7] },
  todi:       { vadi:8,  samvadi:1,  aaroh:[0,1,3,6,7,8,11,12],   avaroh:[12,11,8,7,6,3,1,0],     forbidden:[2,4,5,9,10],gamakNotes:[1,3,6,8],  vadiWeight:0.40, restNotes:[0,7] },
  purvi:      { vadi:8,  samvadi:1,  aaroh:[0,1,4,6,7,8,11,12],   avaroh:[12,11,8,7,6,4,1,0],     forbidden:[2,5,9],     gamakNotes:[1,6,8,11],  vadiWeight:0.35, restNotes:[0,6,7] },
  marwa:      { vadi:9,  samvadi:1,  aaroh:[0,1,4,6,9,11,12],     avaroh:[12,11,9,6,4,1,0],       forbidden:[5,7],       gamakNotes:[1,4,9],     vadiWeight:0.40, restNotes:[0,6,9] },
  bhupali:    { vadi:9,  samvadi:2,  aaroh:[0,2,4,7,9,12],        avaroh:[12,9,7,4,2,0],           forbidden:[1,3,5,6,8,10,11], gamakNotes:[4,9], vadiWeight:0.35, restNotes:[0,4,7,9] },
  darbari:    { vadi:2,  samvadi:5,  aaroh:[0,2,5,7,12],          avaroh:[12,10,8,7,5,3,2,0],     forbidden:[4,11],      gamakNotes:[3,8,10],    vadiWeight:0.30, restNotes:[0,2,5,7] },
  bageshri:   { vadi:5,  samvadi:9,  aaroh:[0,2,3,5,7,12],        avaroh:[12,10,8,7,5,3,2,0],     forbidden:[4,11],      gamakNotes:[3,8],       vadiWeight:0.30, restNotes:[0,5,7] },
  des:        { vadi:2,  samvadi:7,  aaroh:[0,2,4,5,7,9,12],      avaroh:[12,10,9,7,5,4,2,0],     forbidden:[11],        gamakNotes:[4,10],      vadiWeight:0.30, restNotes:[0,2,5,7] },
  kedar:      { vadi:5,  samvadi:9,  aaroh:[0,5,6,7,11,12],       avaroh:[12,11,7,6,5,4,2,0],     forbidden:[1,3,8,10],  gamakNotes:[5,6,11],    vadiWeight:0.35, restNotes:[0,5,7] },
  hansdhwani: { vadi:7,  samvadi:2,  aaroh:[0,2,4,7,11,12],       avaroh:[12,11,7,4,2,0],          forbidden:[1,3,5,6,8,9,10], gamakNotes:[4,11], vadiWeight:0.35, restNotes:[0,4,7,11] },
};

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function rand(min: number, max: number) { return Math.random() * (max - min) + min; }
function randInt(min: number, max: number) { return Math.floor(rand(min, max + 1)); }
function pick<T>(arr: T[]): T { return arr[randInt(0, arr.length - 1)]; }
function weighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

// ─────────────────────────────────────────────────────────────────────────────
// RHYTHM GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export interface RhythmParams {
  style:      "western" | "indian";
  taalId?:    string;            // Indian
  timeSignature?: string;        // Western e.g. "7/8"
  tempo:      number;
  elements:   "bass" | "treble" | "all";
  bars:       number;            // how many cycles/bars to generate
}

const TAAL_DATA: Record<string, { beats: number; divisions: number[]; bol: string[]; khali: number[] }> = {
  teentaal:   { beats:16, divisions:[4,4,4,4],     bol:["Dha","Dhin","Dhin","Dha","Dha","Dhin","Dhin","Dha","Dha","Tin","Tin","Ta","Ta","Dhin","Dhin","Dha"], khali:[8] },
  rupak:      { beats:7,  divisions:[3,2,2],        bol:["Tin","Tin","Na","Dhin","Na","Dhin","Na"],                                                             khali:[0] }, // Rupak starts on khali
  jhaptaal:   { beats:10, divisions:[2,3,2,3],      bol:["Dhi","Na","Dhi","Dhi","Na","Ti","Na","Dhi","Dhi","Na"],                                               khali:[5] },
  ektal:      { beats:12, divisions:[2,2,2,2,2,2],  bol:["Dhin","Dhin","Dhage","Trakt","Tu","Na","Kat","Ta","Dhage","Trakt","Dhin","Na"],                       khali:[5,11] },
  keherwa:    { beats:8,  divisions:[4,4],           bol:["Dha","Ge","Na","Ti","Na","Ke","Dhi","Na"],                                                            khali:[4] },
  dadra:      { beats:6,  divisions:[3,3],           bol:["Dha","Dhi","Na","Dha","Ti","Na"],                                                                     khali:[3] },
  dhamar:     { beats:14, divisions:[5,2,3,4],       bol:["Ka","Dhi","Ta","Dhi","Ta","Dha","Ge","Ti","Ta","Ti","Ta","Ta","Dhi","Ta"],                            khali:[8] },
  chachar:    { beats:14, divisions:[2,4,4,4],       bol:["Dha","Dha","Tin","Tin","Ta","Dhin","Dhin","Dha","Dha","Tin","Tin","Ta","Ta","Dha"],                   khali:[2] },
  chautaal:   { beats:12, divisions:[2,2,2,2,2,2],  bol:["Dha","Dha","Dhin","Ta","Kit","Dha","Dhin","Ta","Tit","Kata","Gadi","Gana"],                           khali:[5] },
  tilvada:    { beats:16, divisions:[4,4,4,4],       bol:["Dha","Dhin","Dhin","Dha","Dha","Dhin","Dhin","Dha","Dha","Tin","Tin","Ta","Tete","Dhin","Dhin","Dha"],khali:[8] },
};

// Map bol names to bass/treble/velocity characteristics
function bolCharacteristics(bol: string, isKhali: boolean): { element: "bass"|"treble"|"mid"; velocity: number } {
  const bassBols    = new Set(["Dha","Dhin","Dhi","Ka","Dhage"]);
  const trebleBols  = new Set(["Tin","Ti","Ta","Tit","Tete","Kat"]);
  const velocity    = isKhali ? 0.35 : bassBols.has(bol) ? 0.85 : trebleBols.has(bol) ? 0.70 : 0.55;
  const element     = bassBols.has(bol) ? "bass" : trebleBols.has(bol) ? "treble" : "mid";
  return { element, velocity };
}

// Vibhag start positions from division sizes — e.g. [4,4,4,4] → [0,4,8,12]
function vibhagStarts(divisions: number[]): number[] {
  const starts: number[] = [];
  let acc = 0;
  for (const d of divisions) { starts.push(acc); acc += d; }
  return starts;
}

// Natural accent groupings for odd meters, in beats — 5 → 3+2, 7 → 2+2+3, etc.
function meterGroups(num: number): number[] {
  switch (num) {
    case 5:  return Math.random() > 0.5 ? [3, 2] : [2, 3];
    case 7:  return pick([[2, 2, 3], [3, 2, 2], [2, 3, 2]]);
    case 9:  return [3, 3, 3];
    case 10: return [3, 3, 2, 2];
    case 11: return pick([[3, 3, 3, 2], [2, 2, 3, 2, 2]]);
    case 13: return [3, 3, 3, 2, 2];
    default: return [];
  }
}

export function generateRhythmPattern(params: RhythmParams): RhythmEvent[] {
  const events: RhythmEvent[] = [];
  const wants = (el: "bass"|"treble"|"mid") =>
    params.elements === "all" || el === params.elements || el === "mid";

  if (params.style === "indian" && params.taalId) {
    const taal = TAAL_DATA[params.taalId];
    if (!taal) return [];
    const vStarts = vibhagStarts(taal.divisions);

    for (let cycle = 0; cycle < params.bars; cycle++) {
      taal.bol.forEach((bol, beatIdx) => {
        const beatOffset = cycle * taal.beats + beatIdx;
        const isSam      = beatIdx === 0 && !taal.khali.includes(0);
        const isKhali    = taal.khali.includes(beatIdx);
        const { element, velocity } = bolCharacteristics(bol, isKhali);
        const isVibhagStart = vStarts.includes(beatIdx);

        // Theka is sacred — every bol always plays. Variation lives in
        // dynamics and fills, never in dropping cycle strokes.
        let vel = velocity;
        if (isSam)               vel = Math.min(1, vel + 0.12);
        else if (isVibhagStart)  vel = Math.min(1, vel + 0.06);
        // Crescendo into Sam — the last three beats of the cycle lean forward
        const beatsToSam = taal.beats - beatIdx;
        if (beatsToSam <= 3 && !isKhali) vel = Math.min(1, vel + (4 - beatsToSam) * 0.04);
        vel = clamp01(vel + rand(-0.03, 0.03)); // human touch

        if (wants(element)) {
          events.push({
            beat: beatOffset, duration: 1, velocity: vel,
            element, bol, isSam, isKhali,
          });
        }

        // Ghost subdivision on non-khali beats — soft "&" stroke for flow
        if (!isKhali && !isSam && Math.random() > 0.68 && wants("mid")) {
          events.push({
            beat: beatOffset + 0.5, duration: 0.5, velocity: vel * 0.4,
            element: "mid", bol: "Ne", isSam: false, isKhali: false,
          });
        }
      });

      // TiRaKiTa fill — sixteenths on the beat before the next Sam.
      // More likely on later cycles (the pattern "opens up" over time).
      const fillChance = 0.25 + (cycle / Math.max(params.bars - 1, 1)) * 0.35;
      if (cycle < params.bars - 0 && Math.random() < fillChance && wants("treble")) {
        const fillBols = ["Ti", "Ra", "Ki", "Ta"];
        const fillBeat = cycle * taal.beats + taal.beats - 1;
        fillBols.forEach((fb, fi) => {
          events.push({
            beat: fillBeat + fi * 0.25, duration: 0.25,
            velocity: 0.45 + fi * 0.08, // slight crescendo into Sam
            element: fi % 2 === 0 ? "treble" : "mid",
            bol: fb, isSam: false, isKhali: false,
          });
        });
      }
    }

  } else {
    // Western rhythm generation — kick (bass) / snare (treble) / hat (mid)
    const ts = params.timeSignature ?? "4/4";
    const [num, den] = ts.split("/").map(Number);
    const beatsPerBar = num / (den / 4); // normalised to quarter notes
    const isCompound  = den === 8 && num % 3 === 0 && num >= 6;
    const groups      = meterGroups(num);
    const eighth      = 0.5;

    for (let bar = 0; bar < params.bars; bar++) {
      const barStart   = bar * beatsPerBar;
      const isFillBar  = (bar + 1) % 4 === 0 && params.bars >= 4;
      const fillStart  = barStart + beatsPerBar - 1; // last beat of fill bar

      // ── Kick pattern ──
      // Downbeat always hits, regardless of element filter (anchor of groove)
      events.push({ beat: barStart, duration: 1, velocity: 0.92 + rand(-0.02, 0.02), element: "bass", isSam: true });

      if (wants("bass")) {
        if (num === 4 || num === 2) {
          // Beat 3 kick (rock/pop), occasional syncopated push on the "& of 2"
          if (num === 4) events.push({ beat: barStart + 2, duration: 1, velocity: rand(0.72, 0.82), element: "bass" });
          if (Math.random() > 0.6) events.push({ beat: barStart + (num === 4 ? 2.5 : 1.5), duration: 0.5, velocity: rand(0.55, 0.68), element: "bass" });
        } else if (isCompound) {
          // Compound meter — kick on each dotted-quarter group start
          for (let g = 1.5; g < beatsPerBar; g += 1.5) {
            if (Math.random() > 0.35) events.push({ beat: barStart + g, duration: 0.5, velocity: rand(0.6, 0.75), element: "bass" });
          }
        } else if (groups.length > 0) {
          // Odd meter — kick anchors each grouping (5 = 3+2, 7 = 2+2+3 …)
          let acc = 0;
          groups.forEach((g, gi) => {
            if (gi > 0) events.push({ beat: barStart + acc * (den === 8 ? eighth : 1), duration: 0.5, velocity: rand(0.7, 0.8), element: "bass" });
            acc += g;
          });
        } else if (num === 3) {
          // Waltz — occasional pickup kick on beat 3
          if (Math.random() > 0.7) events.push({ beat: barStart + 2.5, duration: 0.5, velocity: rand(0.5, 0.6), element: "bass" });
        }
      }

      // ── Snare / backbeat ──
      if (wants("treble")) {
        if (num === 4) {
          [1, 3].forEach(b => events.push({ beat: barStart + b, duration: 1, velocity: rand(0.78, 0.86), element: "treble" }));
        } else if (num === 2) {
          events.push({ beat: barStart + 1, duration: 1, velocity: rand(0.78, 0.86), element: "treble" });
        } else if (num === 3) {
          events.push({ beat: barStart + 2, duration: 1, velocity: rand(0.7, 0.78), element: "treble" });
        } else if (isCompound) {
          // 6/8 backbeat — snare on the second dotted-quarter (mid-bar)
          events.push({ beat: barStart + beatsPerBar / 2, duration: 1, velocity: rand(0.76, 0.84), element: "treble" });
        } else if (groups.length > 0) {
          // Odd meter — snare on the start of the final group
          const beforeLast = groups.slice(0, -1).reduce((a, b) => a + b, 0);
          events.push({ beat: barStart + beforeLast * (den === 8 ? eighth : 1), duration: 1, velocity: rand(0.74, 0.82), element: "treble" });
        }
        // Ghost snare — soft grace on the "e" or "a" for pocket (4/4 only)
        if (num === 4 && Math.random() > 0.65) {
          events.push({ beat: barStart + pick([0.75, 2.75, 3.5]), duration: 0.25, velocity: rand(0.2, 0.3), element: "treble" });
        }
      }

      // ── Hats — steady subdivision with alternating strong/weak ──
      if (wants("mid")) {
        const step    = isCompound ? eighth : den === 8 ? eighth : eighth;
        const hatEnd  = isFillBar ? beatsPerBar - 1 : beatsPerBar; // leave room for fill
        for (let h = 0; h < hatEnd - 0.01; h += step) {
          if (Math.random() > 0.92) continue; // rare gap — breathing room
          const onBeat = Math.abs(h % 1) < 0.01;
          events.push({
            beat: barStart + h, duration: step,
            velocity: (onBeat ? rand(0.48, 0.56) : rand(0.3, 0.38)),
            element: "mid",
          });
        }
      }

      // ── Fill — sixteenth run into the next downbeat, every 4th bar ──
      if (isFillBar && wants("treble")) {
        for (let f = 0; f < 4; f++) {
          events.push({
            beat: fillStart + f * 0.25, duration: 0.25,
            velocity: 0.5 + f * 0.09, // crescendo into bar 1
            element: f === 3 ? "bass" : "treble",
          });
        }
      }
    }
  }

  return events.sort((a, b) => a.beat - b.beat);
}

// ─────────────────────────────────────────────────────────────────────────────
// MELODY GENERATOR — Rule-based for Indian Ragas, harmony-aware for Western
// ─────────────────────────────────────────────────────────────────────────────

export type PlayingStyle = "melody" | "chords" | "arpeggiated" | "two-hand";
export type PianoType    = "grand" | "rhodes" | "honkytonk" | "upright";

export interface MelodyParams {
  style:        "western" | "indian";
  rootNote:     string;       // e.g. "C#"
  activeNotes:  string[];     // user-selected notes (deselected = never used)
  scaleId:      string;       // raga id or western scale id
  intervals:    number[];     // scale intervals from root
  phraseLength: number;       // in bars (4/4)
  octaveRange:  [number,number];
  instrument:   string;
  playingStyle?: PlayingStyle; // default: "melody"
  pianoType?:    PianoType;    // only used when instrument is Piano
}

interface PoolNote { note: string; octave: number; interval: number; pitch: number }

// Rhythm cells — each sums to exactly 4 beats, so bars never drift off-grid.
const CELLS_WESTERN: number[][] = [
  [1, 1, 1, 1],
  [0.5, 0.5, 1, 1, 1],
  [1, 0.5, 0.5, 1, 1],
  [1.5, 0.5, 1, 1],
  [1, 1, 1.5, 0.5],
  [0.5, 0.5, 0.5, 0.5, 1, 1],
  [2, 1, 1],
  [1, 1, 2],
  [2, 0.5, 0.5, 1],
];
const CELLS_RAGA: number[][] = [
  [2, 2],
  [1, 1, 2],
  [2, 1, 1],
  [1, 2, 1],
  [4],
  [1, 1, 1, 1],
  [3, 1],
  [1.5, 0.5, 2],
];
const CELLS_CADENCE: number[][] = [ [2, 2], [1, 1, 2], [1, 3] ];

// Diatonic chord progressions expressed as scale-degree indices
const PROGRESSIONS_MAJOR: number[][] = [
  [0, 4, 5, 3],   // I  V  vi IV
  [0, 3, 4, 0],   // I  IV V  I
  [0, 5, 3, 4],   // I  vi IV V
  [0, 3, 0, 4],   // I  IV I  V
];
const PROGRESSIONS_MINOR: number[][] = [
  [0, 5, 2, 6],   // i  VI III VII (natural minor flavour)
  [0, 3, 4, 0],   // i  iv v  i
  [0, 6, 5, 4],   // i  VII VI v
];

function buildNotePool(params: MelodyParams, rules?: typeof RAGA_RULES[string]): PoolNote[] {
  const rootIdx = NOTE_NAMES.indexOf(params.rootNote);
  const pool: PoolNote[] = [];
  for (let oct = params.octaveRange[0]; oct <= params.octaveRange[1]; oct++) {
    params.intervals.forEach(interval => {
      const noteIdx  = (rootIdx + interval) % 12;
      const noteName = NOTE_NAMES[noteIdx];
      if (!params.activeNotes.includes(noteName)) return;
      if (rules && rules.forbidden.includes(interval % 12)) return;
      pool.push({ note: noteName, octave: oct, interval, pitch: oct * 12 + interval });
    });
  }
  return pool.sort((a, b) => a.pitch - b.pitch);
}

// Build a diatonic triad on a given scale degree by stacking scale thirds.
// Works for any scale length ≥ 5 (pentatonics included). Returns pool notes
// voiced ascending from a base octave, respecting user-deselected notes.
function buildTriad(degree: number, scale: number[], pool: PoolNote[], baseOctave: number): PoolNote[] {
  const len = scale.length;
  const tones: PoolNote[] = [];
  for (let stack = 0; stack < 3; stack++) {
    const degIdx   = (degree + stack * 2) % len;
    const wrapped  = Math.floor((degree + stack * 2) / len);
    const interval = scale[degIdx];
    const targetPitch = (baseOctave + wrapped) * 12 + interval;
    // Find the pool note at or nearest above this pitch (skips deselected notes)
    const found = pool.find(p => p.interval === interval && p.octave === baseOctave + wrapped)
               ?? pool.find(p => p.interval === interval);
    if (found && !tones.some(t => t.pitch === found.pitch)) tones.push(found);
    void targetPitch;
  }
  return tones.sort((a, b) => a.pitch - b.pitch);
}

// Phrase arch — velocity and register rise to a peak ~62% through, then relax
function arch(t: number): number {
  const peak = 0.62;
  return t <= peak ? t / peak : 1 - (t - peak) / (1 - peak) * 0.8;
}

export function generateMelodyPattern(params: MelodyParams): MelodyNote[] {
  const rules = RAGA_RULES[params.scaleId];
  const style: PlayingStyle = params.playingStyle ?? "melody";
  const pool  = buildNotePool(params, rules);
  if (pool.length === 0) return [];

  if (rules) return generateRagaMelody(params, rules, pool, style);
  return generateWesternMelody(params, pool, style);
}

// ── WESTERN — harmony-aware, motif-structured ────────────────────────────────
function generateWesternMelody(params: MelodyParams, pool: PoolNote[], style: PlayingStyle): MelodyNote[] {
  const notes: MelodyNote[] = [];
  const bars  = Math.max(1, params.phraseLength);
  const scale = [...new Set(params.intervals.map(i => i % 12))].sort((a, b) => a - b);
  const isMinor = scale.includes(3) && !scale.includes(4);

  const progPool  = isMinor ? PROGRESSIONS_MINOR : PROGRESSIONS_MAJOR;
  const progRaw   = pick(progPool).map(d => d % scale.length);
  const lowOct    = params.octaveRange[0];
  const midOct    = Math.min(params.octaveRange[1], lowOct + 1);

  // Chord per bar — progression loops; final bar resolves to the tonic
  const chords: PoolNote[][] = [];
  for (let b = 0; b < bars; b++) {
    const degree = b === bars - 1 ? 0 : progRaw[b % progRaw.length];
    const triad  = buildTriad(degree, scale, pool, midOct);
    chords.push(triad.length >= 2 ? triad : buildTriad(0, scale, pool, midOct));
  }

  // ── Style: block chords ──
  if (style === "chords") {
    const compCells = [[2, 2], [1, 1, 2], [2, 1, 1], [1.5, 1.5, 1], [4]];
    const cellA = pick(compCells);
    for (let b = 0; b < bars; b++) {
      const triad = chords[b];
      const cell  = b % 4 === 2 ? pick(compCells) : cellA; // A A B A form
      let slot = 0;
      for (const dur of cell) {
        const root = triad[0];
        notes.push({
          note: root.note, octave: root.octave, duration: dur,
          velocity: clamp01((slot === 0 ? 0.82 : 0.62) + rand(-0.04, 0.04)),
          chordNotes: triad.map(t => ({ note: t.note, octave: t.octave })),
          playingStyle: "chords",
        });
        slot++;
      }
    }
    return notes;
  }

  // ── Style: arpeggiated ──
  if (style === "arpeggiated") {
    for (let b = 0; b < bars; b++) {
      const triad = chords[b];
      // Arp figure: triad + octave-doubled root, up then down (8 eighths/bar)
      const top   = pool.find(p => p.interval === triad[0].interval && p.octave === triad[0].octave + 1);
      const shape = top ? [...triad, top] : [...triad, triad[0]];
      const order = [0, 1, 2, 3, 2, 1, 0, 1].map(i => Math.min(i, shape.length - 1));
      order.forEach((idx, s) => {
        const n = shape[idx];
        const t = (b + s / 8) / bars;
        notes.push({
          note: n.note, octave: n.octave, duration: 0.5,
          velocity: clamp01(0.55 + arch(t) * 0.2 + (s === 0 ? 0.1 : 0) + rand(-0.03, 0.03)),
          playingStyle: "arpeggiated",
          chordNotes: s === 0 ? shape.map(x => ({ note: x.note, octave: x.octave })) : undefined,
        });
      });
    }
    return notes;
  }

  // ── Styles: single melody / two-hand — motif form A A B A' ──
  const cellA = pick(CELLS_WESTERN);
  const cellB = pick(CELLS_WESTERN.filter(c => c !== cellA));
  let prevPitch = chords[0][0].pitch;

  // Melodic motif for the A bars: scale-degree offsets from each bar's chord,
  // reused across A bars so the ear hears the idea return over new harmony.
  const motifShape: number[] = [];

  for (let b = 0; b < bars; b++) {
    const isLast  = b === bars - 1;
    const barRole = isLast ? "cadence" : b % 4 === 2 ? "B" : "A";
    const cell    = barRole === "cadence" ? pick(CELLS_CADENCE) : barRole === "B" ? cellB : cellA;
    const triad   = chords[b];
    const chordPitches = new Set(triad.map(t => t.interval % 12));
    let beatInBar = 0;

    cell.forEach((dur, slot) => {
      const t = (b + beatInBar / 4) / bars;
      const strong = beatInBar % 2 === 0; // beats 1 and 3

      // Occasional breath — rest on a weak slot, never on the downbeat
      if (!strong && slot > 0 && !isLast && Math.random() > 0.9) {
        notes.push({ note: "rest", octave: 0, duration: dur, velocity: 0, isRest: true });
        beatInBar += dur;
        return;
      }

      let selected: PoolNote;
      const reuseMotif = barRole === "A" && b >= 4 && slot < motifShape.length;

      if (isLast && slot === cell.length - 1) {
        // Final note — the tonic, low register, home.
        selected = pool.find(p => p.interval % 12 === 0 && p.octave === lowOct) ?? pool[0];
      } else if (isLast && slot === cell.length - 2) {
        // Penultimate — step neighbour of the tonic (leading tone or supertonic)
        const tonicPitch = (pool.find(p => p.interval % 12 === 0 && p.octave === lowOct) ?? pool[0]).pitch;
        selected = pool.reduce((best, p) => {
          const d = Math.abs(p.pitch - tonicPitch);
          return d >= 1 && d <= 2 && d < Math.abs(best.pitch - tonicPitch) ? p : best;
        }, pool[Math.floor(pool.length / 2)]);
      } else if (reuseMotif) {
        // Restate the motif: same offset from THIS bar's chord root
        const target = triad[0].pitch + motifShape[slot];
        selected = pool.reduce((best, p) =>
          Math.abs(p.pitch - target) < Math.abs(best.pitch - target) ? p : best, pool[0]);
      } else {
        // Weighted choice: chord tones on strong beats, steps on weak,
        // register pulled by the phrase arch
        const archCenter = pool[0].pitch + (pool[pool.length - 1].pitch - pool[0].pitch) * (0.3 + arch(t) * 0.5);
        const cands = pool.map(p => {
          let w = 1.0;
          const dist = Math.abs(p.pitch - prevPitch);
          if (dist === 0)      w *= 0.15;      // avoid immediate repeats
          else if (dist <= 2)  w *= 2.6;       // stepwise motion preferred
          else if (dist <= 4)  w *= 1.4;
          else if (dist > 7)   w *= 0.25;      // big leaps rare
          if (strong && chordPitches.has(p.interval % 12)) w *= 2.4; // harmony anchor
          if (!strong && chordPitches.has(p.interval % 12)) w *= 1.2;
          w *= Math.exp(-Math.abs(p.pitch - archCenter) / 14); // follow the arch
          return { p, w };
        });
        selected = weighted(cands.map(c => c.p), cands.map(c => c.w));
      }

      // Record motif shape on the first A bar
      if (barRole === "A" && b < 4 && motifShape.length <= slot) {
        motifShape.push(selected.pitch - triad[0].pitch);
      }

      const vel = clamp01(0.58 + arch(t) * 0.24 + (strong ? 0.06 : 0) + rand(-0.04, 0.04));
      const noteOut: MelodyNote = {
        note: selected.note, octave: selected.octave, duration: dur, velocity: vel,
      };
      if (style === "two-hand") {
        noteOut.playingStyle = "two-hand";
        if (slot === 0) {
          // Left hand — chord root, below the melody register
          const bassOct = Math.max(1, triad[0].octave - 2);
          noteOut.bassNote = { note: triad[0].note, octave: bassOct };
        }
      }
      notes.push(noteOut);
      prevPitch = selected.pitch;
      beatInBar += dur;
    });
  }

  return notes;
}

// ── INDIAN — raga-rule walk with pakad restatement ───────────────────────────
function generateRagaMelody(
  params: MelodyParams,
  rules: typeof RAGA_RULES[string],
  pool: PoolNote[],
  style: PlayingStyle,
): MelodyNote[] {
  const notes: MelodyNote[] = [];
  const totalBeats = params.phraseLength * 4;

  let aarohPool  = pool.filter(n => rules.aaroh.includes(n.interval % 12)  || rules.aaroh.includes((n.interval % 12) + 12));
  let avarohPool = pool.filter(n => rules.avaroh.includes(n.interval % 12) || rules.avaroh.includes((n.interval % 12) + 12));
  if (aarohPool.length === 0)  aarohPool  = pool;
  if (avarohPool.length === 0) avarohPool = pool;

  // For non-melody styles on ragas, the harmonic unit is Sa–Pa (or Sa–vadi
  // if Pa is forbidden) — Western triads would break raga grammar.
  const drone: PoolNote[] = [];
  const sa = pool.find(n => n.interval % 12 === 0);
  const pa = pool.find(n => n.interval % 12 === 7 && !rules.forbidden.includes(7));
  const vd = pool.find(n => n.interval % 12 === rules.vadi);
  if (sa) drone.push(sa);
  if (pa) drone.push(pa);
  else if (vd) drone.push(vd);

  let currentBeat = 0;
  let isAscending = true;
  let prev: PoolNote = pool.find(n => n.interval % 12 === 0 && n.octave === params.octaveRange[0]) ?? pool[0];

  // Opening — start from Sa
  pushRagaNote(prev, 1, 0.75);
  currentBeat += 1;

  // Pakad — the raga's signature phrase, captured early and restated later
  const pakad: MelodyNote[] = [];
  let pakadReplayed = false;

  function pushRagaNote(n: PoolNote, dur: number, vel: number) {
    const iv = n.interval % 12;
    const out: MelodyNote = {
      note: n.note, octave: n.octave, duration: dur, velocity: clamp01(vel + rand(-0.03, 0.03)),
      isVadi:    iv === rules.vadi,
      isSamvadi: iv === rules.samvadi,
      isGamak:   rules.gamakNotes.includes(iv),
    };
    if (style === "two-hand" && sa) {
      out.playingStyle = "two-hand";
      // Left hand drones Sa on phrase starts
      if (Math.abs(currentBeat % 4) < 0.01) out.bassNote = { note: sa.note, octave: Math.max(1, sa.octave - 1) };
    } else if ((style === "chords" || style === "arpeggiated") && drone.length >= 2) {
      out.playingStyle = style;
      out.chordNotes = drone.map(d => ({ note: d.note, octave: d.octave }));
    }
    notes.push(out);
  }

  // Reserve the final beat — the closing Sa is non-negotiable in a raga
  const walkEnd = totalBeats - 1;

  while (currentBeat < walkEnd - 0.25) {
    const remaining = walkEnd - currentBeat;

    // Restate the pakad once past the halfway point — the ear recognises home
    if (!pakadReplayed && pakad.length >= 3 && currentBeat >= totalBeats / 2) {
      const pakadDur = pakad.reduce((a, n) => a + n.duration, 0);
      if (pakadDur <= remaining - 2) {
        pakad.forEach(pn => notes.push({ ...pn, velocity: clamp01(pn.velocity + 0.05) }));
        currentBeat += pakadDur;
        pakadReplayed = true;
        continue;
      }
      pakadReplayed = true; // doesn't fit — skip, don't retry every loop
    }

    // Phrase boundary every 4 beats — land on a rest/vadi note, then breathe
    if (currentBeat > 0 && currentBeat % 4 === 0) {
      const restTargets = rules.restNotes.flatMap(ri => pool.filter(n => n.interval % 12 === ri));
      if (restTargets.length > 0) {
        // Prefer the rest note nearest the current register — no teleporting
        const target = restTargets.reduce((best, n) =>
          Math.abs(n.pitch - prev.pitch) < Math.abs(best.pitch - prev.pitch) ? n : best, restTargets[0]);
        const dur = Math.min(remaining, weighted([1, 1.5, 2], [0.3, 0.4, 0.3]));
        pushRagaNote(target, dur, 0.80);
        currentBeat += dur;
        prev = target;
        if (Math.random() > 0.5 && remaining > 1.5) {
          notes.push({ note: "rest", octave: 0, duration: 0.5, velocity: 0, isRest: true });
          currentBeat += 0.5;
        }
        continue;
      }
    }

    const dirPool = isAscending ? aarohPool : avarohPool;
    const cands = dirPool.map(n => {
      let w = 1.0;
      const dist = Math.abs(n.pitch - prev.pitch);          // absolute pitch — octave-aware
      if (dist === 0)      w *= 0.2;
      else if (dist <= 2)  w *= 2.5;
      else if (dist <= 4)  w *= 1.5;
      else if (dist > 7)   w *= 0.35;
      const iv = n.interval % 12;
      if (iv === rules.vadi)    w *= (1 + rules.vadiWeight * 3);
      if (iv === rules.samvadi) w *= 1.6;
      if (isAscending  && n.pitch > prev.pitch) w *= 1.8;   // honour direction
      if (!isAscending && n.pitch < prev.pitch) w *= 1.8;
      return { n, w };
    });
    if (cands.length === 0) break;
    const selected = weighted(cands.map(c => c.n), cands.map(c => c.w));

    const maxDur = Math.min(remaining, 2);
    const durs   = [0.5, 1, 1.5, 2].filter(d => d <= maxDur);
    const dws    = [0.2, 0.4, 0.18, 0.22].slice(0, durs.length);
    const duration = durs.length > 0 ? weighted(durs, dws) : remaining;

    const iv  = selected.interval % 12;
    const vel = iv === rules.vadi ? rand(0.80, 0.95)
              : rules.gamakNotes.includes(iv) ? rand(0.55, 0.70)
              : rand(0.60, 0.80);

    pushRagaNote(selected, duration, vel);

    // First few notes after the opening become the pakad
    if (pakad.length < 4 && currentBeat < 8) pakad.push({ ...notes[notes.length - 1] });

    currentBeat += duration;
    prev = selected;

    // Direction change — octave-aware, at the register extremes
    const highest = Math.max(...aarohPool.map(n => n.pitch));
    const lowest  = Math.min(...avarohPool.map(n => n.pitch));
    if (isAscending  && prev.pitch >= highest - 3 && Math.random() > 0.3) isAscending = false;
    if (!isAscending && prev.pitch <= lowest  + 3 && Math.random() > 0.4) isAscending = true;
  }

  // Closing — return to Sa in the low register (always runs; ≥1 beat reserved)
  const finalSa = pool.find(n => n.interval % 12 === 0 && n.octave === params.octaveRange[0]) ?? pool[0];
  pushRagaNote(finalSa, Math.max(totalBeats - currentBeat, 0.5), 0.85);

  return notes;
}