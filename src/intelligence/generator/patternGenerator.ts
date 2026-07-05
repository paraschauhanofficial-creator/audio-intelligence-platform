// ─────────────────────────────────────────────────────────────────────────────
// PATTERN GENERATOR
// Pure TypeScript — no audio, no DOM. Takes user inputs, produces structured
// note/beat sequences that the synthesis and MIDI layers consume.
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

function noteIndex(note: string): number { return NOTE_NAMES.indexOf(note); }
function noteFromIndex(idx: number): string { return NOTE_NAMES[((idx % 12) + 12) % 12]; }
function rand(min: number, max: number) { return Math.random() * (max - min) + min; }
function randInt(min: number, max: number) { return Math.floor(rand(min, max + 1)); }
function pick<T>(arr: T[]): T { return arr[randInt(0, arr.length - 1)]; }
function weighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

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
  const midBols     = new Set(["Na","Ge","Ne","Ke","Trakt","Gadi","Gana","Kit","Kata"]);
  const velocity    = isKhali ? 0.35 : bassBols.has(bol) ? 0.85 : trebleBols.has(bol) ? 0.70 : 0.55;
  const element     = bassBols.has(bol) ? "bass" : trebleBols.has(bol) ? "treble" : "mid";
  return { element, velocity };
}

export function generateRhythmPattern(params: RhythmParams): RhythmEvent[] {
  const events: RhythmEvent[] = [];

  if (params.style === "indian" && params.taalId) {
    const taal = TAAL_DATA[params.taalId];
    if (!taal) return [];

    // One cycle = taal.beats quarter notes (simplified — each beat = 1 quarter note)
    for (let cycle = 0; cycle < params.bars; cycle++) {
      taal.bol.forEach((bol, beatIdx) => {
        const beatOffset   = cycle * taal.beats + beatIdx;
        const isSam        = beatIdx === 0 && !taal.khali.includes(0);
        const isKhali      = taal.khali.includes(beatIdx);
        const { element, velocity } = bolCharacteristics(bol, isKhali);

        if (params.elements !== "all" && element !== params.elements && element !== "mid") return;

        // Sam always hits; other beats have slight probability of ghost notes or rests for variation
        const shouldPlay = isSam ? true : Math.random() > (isKhali ? 0.3 : 0.08);
        if (!shouldPlay) return;

        events.push({
          beat:     beatOffset,
          duration: 1,
          velocity: isSam ? Math.min(1, velocity + 0.1) : velocity,
          element,
          bol,
          isSam,
          isKhali,
        });

        // Add subdivision (16th note fills) on strong beats for variation
        if (!isKhali && beatIdx % 2 === 0 && Math.random() > 0.6) {
          events.push({
            beat:     beatOffset + 0.5,
            duration: 0.5,
            velocity: velocity * 0.55,
            element:  "treble",
            bol:      "fill",
            isSam:    false,
            isKhali:  false,
          });
        }
      });
    }

  } else {
    // Western rhythm generation
    const ts       = params.timeSignature ?? "4/4";
    const [num, den] = ts.split("/").map(Number);
    const beatsPerBar = num / (den / 4); // normalised to quarter notes

    for (let bar = 0; bar < params.bars; bar++) {
      const barStart = bar * beatsPerBar;

      // Always hit beat 1 (downbeat)
      events.push({ beat: barStart, duration: 1, velocity: 0.90, element: "bass", isSam: true });

      // Generate pattern based on time signature character
      const beatPositions: number[] = [];
      if (num === 4 || num === 2) {
        // 4/4, 2/4 — standard rock/pop pattern
        beatPositions.push(barStart + 1, barStart + 2, barStart + 3); // snare on 2+4 etc
      } else if (num === 3) {
        beatPositions.push(barStart + 1, barStart + 2);
      } else if (den === 8) {
        // Compound meters — 6/8, 9/8, 12/8 etc.
        for (let i = 0.5; i < beatsPerBar; i += 0.5) beatPositions.push(barStart + i);
      } else {
        // 5/4, 7/8, 11/8 etc. — fill all beats with varying velocity
        for (let i = 1; i < beatsPerBar; i++) beatPositions.push(barStart + i);
      }

      beatPositions.forEach((pos, i) => {
        const isAccent = (num === 4 && (i === 1 || i === 3)) || (num === 3 && i === 0);
        const element: "bass"|"treble"|"mid" = isAccent ? "treble" : (i % 2 === 0 ? "bass" : "mid");
        if (params.elements !== "all" && element !== params.elements) return;
        if (Math.random() > 0.85) return; // occasional rest for groove
        events.push({
          beat:     pos,
          duration: den === 8 ? 0.5 : 1,
          velocity: isAccent ? 0.80 : rand(0.45, 0.65),
          element,
        });
      });
    }
  }

  return events.sort((a, b) => a.beat - b.beat);
}

// ─────────────────────────────────────────────────────────────────────────────
// MELODY GENERATOR — Rule-based for Indian Ragas, musical for Western
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

// Duration values in quarter notes with weights for musical phrasing
const DURATION_CHOICES = [0.25, 0.5, 0.75, 1, 1.5, 2];
const WESTERN_WEIGHTS  = [0.10, 0.25, 0.08, 0.30, 0.12, 0.15];
const RAGA_WEIGHTS     = [0.05, 0.15, 0.10, 0.35, 0.15, 0.20]; // Ragas favour longer notes

export function generateMelodyPattern(params: MelodyParams): MelodyNote[] {
  const notes:    MelodyNote[] = [];
  const rootIdx   = NOTE_NAMES.indexOf(params.rootNote);
  const totalBeats = params.phraseLength * 4;
  const rules      = RAGA_RULES[params.scaleId];

  // Build the pool of playable notes across octaves
  // respecting activeNotes (deselected = forbidden) and raga forbidden notes
  const notePool: { note: string; octave: number; interval: number }[] = [];
  for (let oct = params.octaveRange[0]; oct <= params.octaveRange[1]; oct++) {
    params.intervals.forEach(interval => {
      const noteIdx  = (rootIdx + interval) % 12;
      const noteName = NOTE_NAMES[noteIdx];
      // Skip if user deselected this note
      if (!params.activeNotes.includes(noteName)) return;
      // Skip if raga forbids this interval
      if (rules && rules.forbidden.includes(interval)) return;
      notePool.push({ note: noteName, octave: oct, interval });
    });
  }

  if (notePool.length === 0) return [];

  // For Indian Ragas — separate aaroh/avaroh pools
  let aarohPool = notePool;
  let avarohPool = notePool;
  if (rules) {
    aarohPool  = notePool.filter(n => rules.aaroh.includes(n.interval)  || rules.aaroh.includes(n.interval + 12));
    avarohPool = notePool.filter(n => rules.avaroh.includes(n.interval) || rules.avaroh.includes(n.interval + 12));
    if (aarohPool.length === 0)  aarohPool  = notePool;
    if (avarohPool.length === 0) avarohPool = notePool;
  }

  let currentBeat  = 0;
  let isAscending  = true;  // for raga direction tracking
  let prevInterval = rules ? 0 : notePool[Math.floor(notePool.length / 2)].interval; // start from Sa for ragas

  // Opening — ragas typically start from Sa or a low note, then ascend
  if (rules) {
    const sa = notePool.find(n => n.interval === 0 && n.octave === params.octaveRange[0]);
    if (sa) {
      notes.push({ note: sa.note, octave: sa.octave, duration: 1, velocity: 0.75, isVadi: false });
      currentBeat += 1;
      prevInterval = 0;
    }
  }

  while (currentBeat < totalBeats - 0.25) {
    const remaining = totalBeats - currentBeat;

    // Phrase boundary — land on a rest note every 4 beats for Indian, or every 2 bars for Western
    const phrasePoint = rules ? currentBeat % 4 === 0 : currentBeat % 8 === 0;

    if (phrasePoint && currentBeat > 0 && rules) {
      // Land on a rest/vadi note at phrase boundary
      const restTargets = rules.restNotes
        .flatMap(ri => notePool.filter(n => n.interval === ri));
      if (restTargets.length > 0) {
        const target = pick(restTargets);
        const dur    = Math.min(remaining, weighted([1, 1.5, 2], [0.3, 0.4, 0.3]));
        notes.push({
          note:      target.note,
          octave:    target.octave,
          duration:  dur,
          velocity:  0.80,
          isVadi:    target.interval === rules.vadi,
          isSamvadi: target.interval === rules.samvadi,
          isGamak:   rules.gamakNotes.includes(target.interval),
        });
        currentBeat  += dur;
        prevInterval  = target.interval;

        // Brief rest after phrase landing (silence)
        if (Math.random() > 0.5 && remaining > 1.5) {
          notes.push({ note: "rest", octave: 0, duration: 0.5, velocity: 0, isRest: true });
          currentBeat += 0.5;
        }
        continue;
      }
    }

    // Choose pool based on direction
    const pool = rules ? (isAscending ? aarohPool : avarohPool) : notePool;

    // Build weighted candidate list
    // Prefer notes closer to previous (stepwise motion) for musical flow
    const candidates = pool.map(n => {
      let weight = 1.0;
      const dist = Math.abs(n.interval - prevInterval);

      // Stepwise motion preferred (distance 1-2 semitones)
      if (dist <= 2) weight *= 2.5;
      else if (dist <= 4) weight *= 1.5;
      else if (dist > 7) weight *= 0.4; // large leaps less common

      // Vadi note gets strong boost
      if (rules && n.interval === rules.vadi)    weight *= (1 + rules.vadiWeight * 3);
      if (rules && n.interval === rules.samvadi) weight *= 1.6;

      // In aaroh — prefer ascending intervals; in avaroh — descending
      if (rules) {
        if (isAscending  && n.interval > prevInterval) weight *= 1.8;
        if (!isAscending && n.interval < prevInterval) weight *= 1.8;
      }

      // Avoid repeating the same note immediately
      if (n.interval === prevInterval) weight *= 0.2;

      return { note: n, weight };
    });

    if (candidates.length === 0) break;

    const selected = weighted(
      candidates.map(c => c.note),
      candidates.map(c => c.weight)
    );

    const durationWeights = rules ? RAGA_WEIGHTS : WESTERN_WEIGHTS;
    const maxDur = Math.min(remaining, 2);
    const eligibleDurations = DURATION_CHOICES.filter(d => d <= maxDur);
    const eligibleWeights   = durationWeights.slice(0, eligibleDurations.length);
    const duration = eligibleDurations.length > 0
      ? weighted(eligibleDurations, eligibleWeights)
      : remaining;

    const isVadi    = rules ? selected.interval === rules.vadi    : false;
    const isSamvadi = rules ? selected.interval === rules.samvadi : false;
    const isGamak   = rules ? rules.gamakNotes.includes(selected.interval) : false;

    // Velocity: vadi notes louder, gamak notes slightly quieter (ornament effect)
    const velocity = isVadi ? rand(0.80, 0.95) : isGamak ? rand(0.55, 0.70) : rand(0.60, 0.80);

    notes.push({
      note:      selected.note,
      octave:    selected.octave,
      duration,
      velocity,
      isGamak,
      isVadi,
      isSamvadi,
    });

    currentBeat  += duration;
    prevInterval  = selected.interval;

    // Direction change logic for Indian ragas
    if (rules) {
      const highestInterval = Math.max(...aarohPool.map(n => n.interval));
      const lowestInterval  = Math.min(...avarohPool.map(n => n.interval));
      if (isAscending  && prevInterval >= highestInterval - 2 && Math.random() > 0.3) isAscending = false;
      if (!isAscending && prevInterval <= lowestInterval  + 2 && Math.random() > 0.4) isAscending = true;
    }
  }

  // Closing — land on Sa (root) for Indian, root note for Western
  if (currentBeat < totalBeats) {
    const finalNote = rules
      ? notePool.find(n => n.interval === 0 && n.octave === params.octaveRange[0]) ?? notePool[0]
      : notePool.find(n => n.interval === 0) ?? notePool[0];
    notes.push({
      note:     finalNote.note,
      octave:   finalNote.octave,
      duration: totalBeats - currentBeat,
      velocity: 0.85,
      isVadi:   false,
    });
  }

  return notes;
}