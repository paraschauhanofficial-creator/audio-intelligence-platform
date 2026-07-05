// ─────────────────────────────────────────────────────────────────────────────
// MIDI EXPORT ENGINE
// Manual MIDI 1.0 file encoding — no external dependencies.
// Takes pattern data from patternGenerator.ts and produces a .mid Blob.
// ─────────────────────────────────────────────────────────────────────────────

import type { RhythmEvent, MelodyNote } from "./patternGenerator";

const NOTE_MIDI: Record<string, number> = {
  "C":0,"C#":1,"D":2,"D#":3,"E":4,"F":5,"F#":6,"G":7,"G#":8,"A":9,"A#":10,"B":11
};

const INSTRUMENT_PROGRAM: Record<string, number> = {
  // Melodic instruments — General MIDI program numbers (0-indexed)
  "Piano":       0,   // Acoustic Grand Piano
  "Sitar":       104, // Sitar
  "Flute":       73,  // Flute
  "Violin":      40,  // Violin
  "Guitar":      24,  // Acoustic Guitar (nylon)
  "Synth Pad":   88,  // Pad 1 (new age)
  "Synth Lead":  80,  // Lead 1 (square)
  "Cello":       42,  // Cello
  "Sarangi":     110, // Fiddle (closest GM)
  "Santoor":     15,  // Dulcimer (closest GM)
  "Harmonium":   20,  // Reed Organ
  "Veena":       104, // Sitar (closest GM)
  "Saxophone":   65,  // Alto Sax
  "Oud":         105, // Banjo (closest GM)
  // Rhythm instruments — map to MIDI channel 10 (drums)
  "Tabla":        0,
  "Dhol":         0,
  "Mridangam":    0,
  "Dholak":       0,
  "Kick+Snare+Hat": 0,
  "Cajon":        0,
  "Congas":       0,
  "Drum Machine": 0,
  "Khol":         0,
  "Pakhawaj":     0,
  "Djembe":       0,
};

// Rhythm instrument → GM drum note mapping
const RHYTHM_MIDI_NOTES: Record<string, { bass: number; treble: number; mid: number }> = {
  "Tabla":          { bass: 41, treble: 42, mid: 38 }, // Low Floor Tom, Closed HH, Snare
  "Dhol":           { bass: 36, treble: 48, mid: 38 }, // Kick, Hi Mid Tom, Snare
  "Mridangam":      { bass: 41, treble: 42, mid: 37 }, // Low Floor Tom, HH, Side Stick
  "Dholak":         { bass: 36, treble: 46, mid: 38 },
  "Kick+Snare+Hat": { bass: 36, treble: 42, mid: 38 }, // Kick, Closed HH, Snare
  "Cajon":          { bass: 36, treble: 39, mid: 37 },
  "Congas":         { bass: 64, treble: 63, mid: 62 }, // Low, High, Mute Hi Conga
  "Drum Machine":   { bass: 36, treble: 42, mid: 38 },
  "Khol":           { bass: 41, treble: 42, mid: 38 },
  "Pakhawaj":       { bass: 41, treble: 48, mid: 37 },
  "Djembe":         { bass: 64, treble: 63, mid: 62 },
};

// ── Low-level MIDI byte helpers ───────────────────────────────────────────────

function varLen(value: number): number[] {
  const bytes: number[] = [];
  bytes.unshift(value & 0x7F);
  value >>= 7;
  while (value > 0) { bytes.unshift((value & 0x7F) | 0x80); value >>= 7; }
  return bytes;
}

function int32(value: number): number[] {
  return [(value >> 24) & 0xFF, (value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF];
}

function int16(value: number): number[] {
  return [(value >> 8) & 0xFF, value & 0xFF];
}

interface MidiEvent {
  tick:  number;
  data:  number[];
}

function buildTrack(events: MidiEvent[]): number[] {
  // Sort by tick
  events.sort((a, b) => a.tick - b.tick);

  // Convert to delta time
  const bytes: number[] = [];
  let lastTick = 0;
  for (const ev of events) {
    const delta = ev.tick - lastTick;
    lastTick    = ev.tick;
    bytes.push(...varLen(delta), ...ev.data);
  }

  // End of track meta event
  bytes.push(0x00, 0xFF, 0x2F, 0x00);

  // Track header
  const header = [
    0x4D, 0x54, 0x72, 0x6B, // "MTrk"
    ...int32(bytes.length),
  ];

  return [...header, ...bytes];
}

// ─────────────────────────────────────────────────────────────────────────────
// MELODY → MIDI
// ─────────────────────────────────────────────────────────────────────────────

export function melodyToMidi(notes: MelodyNote[], tempo: number, instrument: string): Blob {
  const PPQ      = 480;   // pulses per quarter note
  const uspb     = Math.round(60_000_000 / tempo); // microseconds per beat

  const midiEvents: MidiEvent[] = [];
  const channel  = 0;
  const program  = INSTRUMENT_PROGRAM[instrument] ?? 0;

  // Tempo event
  midiEvents.push({ tick: 0, data: [0xFF, 0x51, 0x03, (uspb >> 16) & 0xFF, (uspb >> 8) & 0xFF, uspb & 0xFF] });
  // Time signature 4/4
  midiEvents.push({ tick: 0, data: [0xFF, 0x58, 0x04, 4, 2, 24, 8] });
  // Program change
  midiEvents.push({ tick: 0, data: [0xC0 | channel, program] });

  let tick = 0;
  for (const n of notes) {
    if (n.isRest || n.note === "rest") { tick += Math.round(n.duration * PPQ); continue; }

    const midiNote = (NOTE_MIDI[n.note] ?? 0) + (n.octave * 12);
    const velocity = Math.round(Math.min(127, n.velocity * 127));
    const durTicks = Math.round(n.duration * PPQ);

    // Gamak: add a slight pitch bend if isGamak (simulate andolan/oscillation)
    // MIDI pitch bend: center = 0x2000
    if (n.isGamak) {
      const bend = 0x2200; // slight upward bend
      midiEvents.push({ tick,             data: [0xE0 | channel, bend & 0x7F, (bend >> 7) & 0x7F] });
      midiEvents.push({ tick: tick + durTicks / 4, data: [0xE0 | channel, 0x00, 0x40] }); // return
    }

    midiEvents.push({ tick,             data: [0x90 | channel, midiNote, velocity] }); // Note On
    midiEvents.push({ tick: tick + durTicks, data: [0x80 | channel, midiNote, 0] });    // Note Off
    tick += durTicks;
  }

  const trackBytes = buildTrack(midiEvents);
  const header = [
    0x4D, 0x54, 0x68, 0x64, // "MThd"
    ...int32(6),             // header length
    ...int16(0),             // format 0 (single track)
    ...int16(1),             // 1 track
    ...int16(PPQ),           // pulses per quarter note
  ];

  const bytes = new Uint8Array([...header, ...trackBytes]);
  return new Blob([bytes], { type: "audio/midi" });
}

// ─────────────────────────────────────────────────────────────────────────────
// RHYTHM → MIDI
// ─────────────────────────────────────────────────────────────────────────────

export function rhythmToMidi(events: RhythmEvent[], tempo: number, instrument: string): Blob {
  const PPQ  = 480;
  const uspb = Math.round(60_000_000 / tempo);

  const midiEvents: MidiEvent[] = [];
  const channel = 9; // MIDI channel 10 (0-indexed as 9) = drums

  // Tempo + time sig
  midiEvents.push({ tick: 0, data: [0xFF, 0x51, 0x03, (uspb >> 16) & 0xFF, (uspb >> 8) & 0xFF, uspb & 0xFF] });
  midiEvents.push({ tick: 0, data: [0xFF, 0x58, 0x04, 4, 2, 24, 8] });

  const noteMap = RHYTHM_MIDI_NOTES[instrument] ?? { bass: 36, treble: 42, mid: 38 };

  for (const ev of events) {
    const tick     = Math.round(ev.beat * PPQ);
    const durTicks = Math.round(ev.duration * PPQ * 0.9); // slight staccato
    const velocity = Math.round(Math.min(127, ev.velocity * 127));
    const midiNote = ev.element === "bass" ? noteMap.bass : ev.element === "treble" ? noteMap.treble : noteMap.mid;

    // Sam (beat 1) gets an accent note too
    if (ev.isSam) {
      midiEvents.push({ tick,             data: [0x99, noteMap.bass, Math.min(127, velocity + 15)] });
      midiEvents.push({ tick: tick + durTicks, data: [0x89, noteMap.bass, 0] });
    }

    midiEvents.push({ tick,             data: [0x99, midiNote, ev.isKhali ? Math.round(velocity * 0.6) : velocity] });
    midiEvents.push({ tick: tick + durTicks, data: [0x89, midiNote, 0] });
  }

  const trackBytes = buildTrack(midiEvents);
  const header = [
    0x4D, 0x54, 0x68, 0x64,
    ...int32(6),
    ...int16(0),
    ...int16(1),
    ...int16(PPQ),
  ];

  const bytes = new Uint8Array([...header, ...trackBytes]);
  return new Blob([bytes], { type: "audio/midi" });
}