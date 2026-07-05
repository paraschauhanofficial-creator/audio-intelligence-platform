"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import AudioBackground from "@/components/AudioBackground";
import { generateRhythmPattern, generateMelodyPattern } from "@/intelligence/generator/patternGenerator";
import { synthMelodyToWav, synthRhythmToWav } from "@/intelligence/generator/wavSynthesis";
import { melodyToMidi, rhythmToMidi } from "@/intelligence/generator/midiExport";

// ─────────────────────────────────────────────────────────────────────────────
// SCALE & TAAL DATA
// ─────────────────────────────────────────────────────────────────────────────
const NOTE_NAMES   = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const NOTE_DISPLAY = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

const WESTERN_SCALES = [
  { id: "major",            name: "Major",              category: "western", intervals: [0,2,4,5,7,9,11],    degrees: ["1","2","3","4","5","6","7"] },
  { id: "natural_minor",    name: "Natural Minor",       category: "western", intervals: [0,2,3,5,7,8,10],   degrees: ["1","2","♭3","4","5","♭6","♭7"] },
  { id: "harmonic_minor",   name: "Harmonic Minor",      category: "western", intervals: [0,2,3,5,7,8,11],   degrees: ["1","2","♭3","4","5","♭6","7"] },
  { id: "melodic_minor",    name: "Melodic Minor",       category: "western", intervals: [0,2,3,5,7,9,11],   degrees: ["1","2","♭3","4","5","6","7"] },
  { id: "dorian",           name: "Dorian",              category: "western", intervals: [0,2,3,5,7,9,10],   degrees: ["1","2","♭3","4","5","6","♭7"] },
  { id: "phrygian",         name: "Phrygian",            category: "western", intervals: [0,1,3,5,7,8,10],   degrees: ["1","♭2","♭3","4","5","♭6","♭7"] },
  { id: "lydian",           name: "Lydian",              category: "western", intervals: [0,2,4,6,7,9,11],   degrees: ["1","2","3","♯4","5","6","7"] },
  { id: "mixolydian",       name: "Mixolydian",          category: "western", intervals: [0,2,4,5,7,9,10],   degrees: ["1","2","3","4","5","6","♭7"] },
  { id: "locrian",          name: "Locrian",             category: "western", intervals: [0,1,3,5,6,8,10],   degrees: ["1","♭2","♭3","4","♭5","♭6","♭7"] },
  { id: "pentatonic_major", name: "Pentatonic Major",    category: "western", intervals: [0,2,4,7,9],        degrees: ["1","2","3","5","6"] },
  { id: "pentatonic_minor", name: "Pentatonic Minor",    category: "western", intervals: [0,3,5,7,10],       degrees: ["1","♭3","4","5","♭7"] },
  { id: "blues",            name: "Blues",               category: "western", intervals: [0,3,5,6,7,10],     degrees: ["1","♭3","4","♯4","5","♭7"] },
  { id: "whole_tone",       name: "Whole Tone",          category: "western", intervals: [0,2,4,6,8,10],     degrees: ["1","2","3","♯4","♯5","♭7"] },
  { id: "diminished",       name: "Diminished (WH)",     category: "western", intervals: [0,2,3,5,6,8,9,11], degrees: ["1","2","♭3","4","♭5","♭6","6","7"] },
  { id: "phrygian_dom",     name: "Phrygian Dominant",   category: "western", intervals: [0,1,4,5,7,8,10],   degrees: ["1","♭2","3","4","5","♭6","♭7"] },
];

const INDIAN_RAGAS = [
  { id: "yaman",      name: "Yaman",          thaatOrigin: "Kalyan",   intervals: [0,2,4,6,7,9,11], swaras: ["Sa","Re","Ga","Ma♯","Pa","Dha","Ni"],       mood: "Romantic · Evening",  universalTS: "" },
  { id: "bhairav",    name: "Bhairav",         thaatOrigin: "Bhairav",  intervals: [0,1,4,5,7,8,11], swaras: ["Sa","Re♭","Ga","Ma","Pa","Dha♭","Ni"],      mood: "Solemn · Morning",    universalTS: "" },
  { id: "bhairavi",   name: "Bhairavi",        thaatOrigin: "Bhairavi", intervals: [0,1,3,5,7,8,10], swaras: ["Sa","Re♭","Ga♭","Ma","Pa","Dha♭","Ni♭"],   mood: "Pathos · Farewell",   universalTS: "" },
  { id: "kafi",       name: "Kafi",            thaatOrigin: "Kafi",     intervals: [0,2,3,5,7,9,10], swaras: ["Sa","Re","Ga♭","Ma","Pa","Dha","Ni♭"],      mood: "Romantic · Spring",   universalTS: "" },
  { id: "asavari",    name: "Asavari",         thaatOrigin: "Asavari",  intervals: [0,2,3,5,7,8,10], swaras: ["Sa","Re","Ga♭","Ma","Pa","Dha♭","Ni♭"],    mood: "Pathos · Morning",    universalTS: "" },
  { id: "bilawal",    name: "Bilawal",         thaatOrigin: "Bilawal",  intervals: [0,2,4,5,7,9,11], swaras: ["Sa","Re","Ga","Ma","Pa","Dha","Ni"],         mood: "Joyful · Morning",    universalTS: "" },
  { id: "khamaj",     name: "Khamaj",          thaatOrigin: "Khamaj",   intervals: [0,2,4,5,7,9,10], swaras: ["Sa","Re","Ga","Ma","Pa","Dha","Ni♭"],        mood: "Romantic · Night",    universalTS: "" },
  { id: "todi",       name: "Todi",            thaatOrigin: "Todi",     intervals: [0,1,3,6,7,8,11], swaras: ["Sa","Re♭","Ga♭","Ma♯","Pa","Dha♭","Ni"],   mood: "Serious · Morning",   universalTS: "" },
  { id: "purvi",      name: "Purvi",           thaatOrigin: "Purvi",    intervals: [0,1,4,6,7,8,11], swaras: ["Sa","Re♭","Ga","Ma♯","Pa","Dha♭","Ni"],     mood: "Solemn · Sunset",     universalTS: "" },
  { id: "marwa",      name: "Marwa",           thaatOrigin: "Marwa",    intervals: [0,1,4,6,7,9,11], swaras: ["Sa","Re♭","Ga","Ma♯","Pa","Dha","Ni"],       mood: "Tense · Sunset",      universalTS: "" },
  { id: "bhupali",    name: "Bhupali",         thaatOrigin: "Kalyan",   intervals: [0,2,4,7,9],      swaras: ["Sa","Re","Ga","Pa","Dha"],                   mood: "Joyful · Evening",    universalTS: "" },
  { id: "darbari",    name: "Darbari Kanada",  thaatOrigin: "Asavari",  intervals: [0,2,3,5,7,8,10], swaras: ["Sa","Re","Ga♭","Ma","Pa","Dha♭","Ni♭"],    mood: "Serious · Night",     universalTS: "" },
  { id: "bageshri",   name: "Bageshri",        thaatOrigin: "Kafi",     intervals: [0,2,3,5,7,8,10], swaras: ["Sa","Re","Ga♭","Ma","Pa","Dha♭","Ni♭"],    mood: "Longing · Night",     universalTS: "" },
  { id: "des",        name: "Des",             thaatOrigin: "Khamaj",   intervals: [0,2,4,5,7,9,10], swaras: ["Sa","Re","Ga","Ma","Pa","Dha","Ni♭"],        mood: "Romantic · Night",    universalTS: "" },
  { id: "kedar",      name: "Kedar",           thaatOrigin: "Kalyan",   intervals: [0,2,4,5,6,7,11], swaras: ["Sa","Re","Ga","Ma","Ma♯","Pa","Ni"],         mood: "Devotional · Evening", universalTS: "" },
  { id: "hansdhwani", name: "Hansdhwani",      thaatOrigin: "Bilawal",  intervals: [0,2,4,7,11],     swaras: ["Sa","Re","Ga","Pa","Ni"],                    mood: "Joyful · Night",      universalTS: "" },
];

const TAALS = [
  { id: "teentaal",   name: "Teentaal",        beats: 16, universalTS: "16/4",  divisions: [4,4,4,4],     bol: ["Dha","Dhin","Dhin","Dha","Dha","Dhin","Dhin","Dha","Dha","Tin","Tin","Ta","Ta","Dhin","Dhin","Dha"] },
  { id: "rupak",      name: "Rupak",           beats: 7,  universalTS: "7/8",   divisions: [3,2,2],       bol: ["Tin","Tin","Na","Dhin","Na","Dhin","Na"] },
  { id: "jhaptaal",   name: "Jhaptaal",        beats: 10, universalTS: "10/4",  divisions: [2,3,2,3],     bol: ["Dhi","Na","Dhi","Dhi","Na","Ti","Na","Dhi","Dhi","Na"] },
  { id: "ektal",      name: "Ektal",           beats: 12, universalTS: "12/8",  divisions: [2,2,2,2,2,2], bol: ["Dhin","Dhin","Dhage","Trakt","Tu","Na","Kat","Ta","Dhage","Trakt","Dhin","Na"] },
  { id: "keherwa",    name: "Keherwa",         beats: 8,  universalTS: "8/8",   divisions: [4,4],         bol: ["Dha","Ge","Na","Ti","Na","Ke","Dhi","Na"] },
  { id: "dadra",      name: "Dadra",           beats: 6,  universalTS: "6/8",   divisions: [3,3],         bol: ["Dha","Dhi","Na","Dha","Ti","Na"] },
  { id: "dhamar",     name: "Dhamar",          beats: 14, universalTS: "14/4",  divisions: [5,2,3,4],     bol: ["Ka","Dhi","Ta","Dhi","Ta","Dha","Ge","Ti","Ta","Ti","Ta","Ta","Dhi","Ta"] },
  { id: "chachar",    name: "Chachar",         beats: 14, universalTS: "14/4",  divisions: [2,4,4,4],     bol: ["Dha","Dha","Tin","Tin","Ta","Dhin","Dhin","Dha","Dha","Tin","Tin","Ta","Ta","Dha"] },
  { id: "chautaal",   name: "Chautaal",        beats: 12, universalTS: "12/4",  divisions: [2,2,2,2,2,2], bol: ["Dha","Dha","Dhin","Ta","Kit","Dha","Dhin","Ta","Tit","Kata","Gadi","Gana"] },
  { id: "tilvada",    name: "Tilvada",         beats: 16, universalTS: "16/4",  divisions: [4,4,4,4],     bol: ["Dha","Dhin","Dhin","Dha","Dha","Dhin","Dhin","Dha","Dha","Tin","Tin","Ta","Tete","Dhin","Dhin","Dha"] },
];

const WESTERN_TS = ["2/4","3/4","4/4","5/4","6/8","7/8","9/8","11/8","12/8","3/8","5/8"];
const MELODIC_INSTRUMENTS = ["Piano","Sitar","Flute","Violin","Guitar","Synth Pad","Synth Lead","Cello","Sarangi","Santoor","Harmonium","Veena","Saxophone","Oud"];
const RHYTHM_INSTRUMENTS  = ["Tabla","Dhol","Mridangam","Dholak","Kick+Snare+Hat","Cajon","Congas","Drum Machine","Khol","Pakhawaj","Djembe"];
const ROOTS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function getScaleNotes(rootIndex: number, intervals: number[]): string[] {
  return intervals.map(i => NOTE_NAMES[(rootIndex + i) % 12]);
}

// ─────────────────────────────────────────────────────────────────────────────
export default function GenerateInstrumentsPage() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const fromDAW     = searchParams.get("from") === "daw";
  const projectId   = searchParams.get("projectId") ?? "";

  const [userPlan,   setUserPlan]   = useState<string>("free");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [parallax,   setParallax]   = useState({ x: 0, y: 0 });

  // Main state
  const [type,       setType]       = useState<"rhythm"|"melody"|null>(null);
  const [style,      setStyle]      = useState<"western"|"indian">("western");

  // Rhythm state
  const [selectedTaal,     setSelectedTaal]     = useState("");
  const [selectedWesternTS,setSelectedWesternTS] = useState("4/4");
  const [customTS,         setCustomTS]          = useState("");
  const [tempo,            setTempo]             = useState(120);
  const [rhythmElements,   setRhythmElements]    = useState<"bass"|"treble"|"all">("all");
  const [rhythmInstrument, setRhythmInstrument]  = useState("Tabla");

  // Melody state
  const [selectedRoot,     setSelectedRoot]      = useState("C");
  const [scaleFilter,      setScaleFilter]       = useState<"all"|"western"|"indian">("all");
  const [scaleSearch,      setScaleSearch]       = useState("");
  const [selectedScaleId,  setSelectedScaleId]   = useState("");
  const [activeNotes,      setActiveNotes]       = useState<string[]>([]);
  const [melodyInstrument, setMelodyInstrument]  = useState("Piano");
  const [pianoType,        setPianoType]        = useState<"grand"|"rhodes"|"honkytonk"|"upright">("grand");
  const [playingStyle,     setPlayingStyle]     = useState<"melody"|"chords"|"arpeggiated"|"two-hand">("melody");
  const [octaveRange,      setOctaveRange]       = useState<[number,number]>([3,5]);
  const [phraseLength,     setPhraseLength]      = useState(4);

  // Output
  const [outputFormat, setOutputFormat] = useState<"wav"|"midi"|"both">("wav");
  const [generating,   setGenerating]   = useState(false);
  const [generated,    setGenerated]    = useState(false);
  const [wavBlob,       setWavBlob]       = useState<Blob | null>(null);
  const [midiBlob,      setMidiBlob]      = useState<Blob | null>(null);
  const [generateError, setGenerateError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("nokashi-theme");
    setIsDarkMode(saved !== "light");
    const observer = new MutationObserver(() => {
      setIsDarkMode(!document.documentElement.classList.contains("theme-light"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const mm = (e: MouseEvent) => setParallax({ x: (e.clientX/window.innerWidth - 0.5) * -20, y: (e.clientY/window.innerHeight - 0.5) * -14 });
    window.addEventListener("mousemove", mm);

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("plan,role").eq("id", user.id).single();
      const isUnlimited = profile?.role === "admin" || profile?.role === "super_user";
      setUserPlan(isUnlimited ? "studio" : profile?.plan ?? "free");
    })();

    return () => { observer.disconnect(); window.removeEventListener("mousemove", mm); };
  }, []);

  const canMidi = userPlan === "pro" || userPlan === "studio";

  // Derive selected scale object
  const allScales = [...WESTERN_SCALES, ...INDIAN_RAGAS.map(r => ({ ...r, category: "indian", degrees: r.swaras }))];
  const selectedScale = allScales.find(s => s.id === selectedScaleId);

  // When scale or root changes — reset activeNotes to full scale
  useEffect(() => {
    if (!selectedScale) { setActiveNotes([]); return; }
    const rootIdx = ROOTS.indexOf(selectedRoot);
    const notes   = getScaleNotes(rootIdx, selectedScale.intervals);
    setActiveNotes(notes);
  }, [selectedScaleId, selectedRoot]);

  const universalNotes = selectedScale
    ? getScaleNotes(ROOTS.indexOf("C"), selectedScale.intervals)
    : [];

  const userKeyNotes = selectedScale
    ? getScaleNotes(ROOTS.indexOf(selectedRoot), selectedScale.intervals)
    : [];

  const toggleNote = (note: string) => {
    setActiveNotes(prev =>
      prev.includes(note) ? prev.filter(n => n !== note) : [...prev, note]
    );
  };

  const filteredScales = allScales.filter(s => {
    if (scaleFilter !== "all" && s.category !== scaleFilter) return false;
    if (scaleSearch && !s.name.toLowerCase().includes(scaleSearch.toLowerCase())) return false;
    return true;
  });

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerated(false);
    setGenerateError("");
    setWavBlob(null);
    setMidiBlob(null);

    try {
      if (type === "rhythm") {
        const taalId        = style === "indian" ? selectedTaal : undefined;
        const timeSignature = style === "western"
          ? (selectedWesternTS === "Custom" ? customTS : selectedWesternTS)
          : undefined;

        if (style === "indian" && !taalId) {
          setGenerateError("Please select a Taal before generating.");
          setGenerating(false);
          return;
        }

        const pattern = generateRhythmPattern({
          style,
          taalId,
          timeSignature,
          tempo,
          elements: rhythmElements,
          bars: 8,
        });

        if (pattern.length === 0) {
          setGenerateError("Pattern generation failed — please check your settings.");
          setGenerating(false);
          return;
        }

        const wav = await synthRhythmToWav(pattern, tempo, rhythmInstrument);
        setWavBlob(wav);

        if (canMidi && (outputFormat === "midi" || outputFormat === "both")) {
          const midi = rhythmToMidi(pattern, tempo, rhythmInstrument);
          setMidiBlob(midi);
        }

      } else if (type === "melody") {
        if (!selectedScaleId) {
          setGenerateError("Please select a scale or raga before generating.");
          setGenerating(false);
          return;
        }
        if (activeNotes.length === 0) {
          setGenerateError("Please select at least one note.");
          setGenerating(false);
          return;
        }

        const pattern = generateMelodyPattern({
          style,
          rootNote:     selectedRoot,
          activeNotes,
          scaleId:      selectedScaleId,
          intervals:    selectedScale?.intervals ?? [],
          phraseLength,
          octaveRange,
          instrument:   melodyInstrument,
          playingStyle,
          pianoType,
        });

        if (pattern.length === 0) {
          setGenerateError("Melody generation failed — please check your settings.");
          setGenerating(false);
          return;
        }

        const wav = await synthMelodyToWav(pattern, 120, melodyInstrument);
        setWavBlob(wav);

        if (canMidi && (outputFormat === "midi" || outputFormat === "both")) {
          const midi = melodyToMidi(pattern, 120, melodyInstrument);
          setMidiBlob(midi);
        }
      }

      setGenerated(true);

    } catch (err: any) {
      console.error("Generation failed:", err);
      setGenerateError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const downloadWav = () => {
    if (!wavBlob) return;
    const url = URL.createObjectURL(wavBlob);
    const a   = document.createElement("a");
    a.href    = url;
    a.download = `${type}-${style}-${selectedScaleId || selectedTaal || "pattern"}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadMidi = () => {
    if (!midiBlob) return;
    const url = URL.createObjectURL(midiBlob);
    const a   = document.createElement("a");
    a.href    = url;
    a.download = `${type}-${style}-${selectedScaleId || selectedTaal || "pattern"}.mid`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const inputBg = isDarkMode ? "#0A0A0A" : "rgba(255,255,255,0.6)";
  const accentColor = "#A78BFA";

  const SectionCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-2xl border p-5 md:p-6 ${className}`} style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
      {children}
    </div>
  );

  const Label = ({ children }: { children: React.ReactNode }) => (
    <p className="text-xs uppercase tracking-wider mb-2 font-semibold" style={{ color: "var(--text-muted)" }}>{children}</p>
  );

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: "var(--background)", color: "var(--text)" }}>
      <AudioBackground parallax={parallax} lightMode={!isDarkMode} />
      <div className="relative z-20">
        <Navbar accentColor={accentColor} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 py-10">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            {fromDAW && (
              <button onClick={() => router.back()} className="text-xs border px-3 py-1.5 rounded-lg transition"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>← DAW</button>
            )}
            <h1 className="text-3xl md:text-4xl font-bold" style={{ color: "var(--text)" }}>Generate Instrument</h1>
          </div>
          <p style={{ color: "var(--text-muted)" }}>Build a rhythm or melody pattern from scratch — Western or Indian classical.</p>
        </div>

        {/* Step 1 — Type */}
        <SectionCard className="mb-5">
          <Label>What do you want to create?</Label>
          <div className="grid grid-cols-2 gap-3">
            {(["rhythm","melody"] as const).map(t => (
              <button key={t} onClick={() => { setType(t); setGenerated(false); }}
                className="rounded-xl py-6 border text-center transition capitalize font-semibold text-lg"
                style={{
                  borderColor:     type === t ? accentColor : "var(--border)",
                  backgroundColor: type === t ? accentColor + "15" : "transparent",
                  color:           type === t ? accentColor : "var(--text-muted)",
                }}>
                {t === "rhythm" ? "🥁" : "🎵"} {t}
              </button>
            ))}
          </div>
        </SectionCard>

        {type && (
          <>
            {/* Step 2 — Style */}
            <SectionCard className="mb-5">
              <Label>Style</Label>
              <div className="grid grid-cols-2 gap-3">
                {(["western","indian"] as const).map(s => (
                  <button key={s} onClick={() => setStyle(s)}
                    className="rounded-xl py-3 border text-center transition capitalize font-semibold"
                    style={{
                      borderColor:     style === s ? accentColor : "var(--border)",
                      backgroundColor: style === s ? accentColor + "15" : "transparent",
                      color:           style === s ? accentColor : "var(--text-muted)",
                    }}>
                    {s === "western" ? "🎸 Western" : "🪘 Indian Classical"}
                  </button>
                ))}
              </div>
            </SectionCard>

            {/* ── RHYTHM PATH ── */}
            {type === "rhythm" && (
              <>
                {/* Time signature / Taal */}
                <SectionCard className="mb-5">
                  {style === "indian" ? (
                    <>
                      <Label>Select Taal</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                        {TAALS.map(t => (
                          <button key={t.id} onClick={() => setSelectedTaal(t.id)}
                            className="flex items-center justify-between px-4 py-3 rounded-xl border text-left transition"
                            style={{
                              borderColor:     selectedTaal === t.id ? accentColor : "var(--border)",
                              backgroundColor: selectedTaal === t.id ? accentColor + "10" : "transparent",
                            }}>
                            <div>
                              <p className="text-sm font-semibold" style={{ color: selectedTaal === t.id ? accentColor : "var(--text)" }}>{t.name}</p>
                              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{t.beats} beats · {t.divisions.join("+")} vibhags</p>
                            </div>
                            <span className="text-xs font-mono px-2 py-1 rounded border flex-shrink-0 ml-3"
                              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>{t.universalTS}</span>
                          </button>
                        ))}
                      </div>
                      {selectedTaal && (() => {
                        const t = TAALS.find(t => t.id === selectedTaal)!;
                        return (
                          <div className="rounded-xl p-4 border" style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}>
                            <p className="text-[11px] mb-2 font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Bol Pattern</p>
                            <div className="flex flex-wrap gap-1.5">
                              {t.bol.map((b, i) => {
                                let vibhagStart = 0;
                                let vibhagIdx = 0;
                                for (let j = 0; j < t.divisions.length; j++) {
                                  if (i < vibhagStart + t.divisions[j]) { vibhagIdx = j; break; }
                                  vibhagStart += t.divisions[j];
                                }
                                const isSam = i === 0;
                                return (
                                  <span key={i} className="text-xs px-2 py-1 rounded border font-mono"
                                    style={{
                                      borderColor:     isSam ? accentColor : "var(--border)",
                                      color:           isSam ? accentColor : "var(--text)",
                                      backgroundColor: isSam ? accentColor + "15" : "transparent",
                                    }}>
                                    {b}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      <Label>Time Signature</Label>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {WESTERN_TS.map(ts => (
                          <button key={ts} onClick={() => setSelectedWesternTS(ts)}
                            className="px-3 py-2 rounded-lg border text-sm font-mono transition"
                            style={{
                              borderColor:     selectedWesternTS === ts ? accentColor : "var(--border)",
                              backgroundColor: selectedWesternTS === ts ? accentColor + "15" : "transparent",
                              color:           selectedWesternTS === ts ? accentColor : "var(--text)",
                            }}>
                            {ts}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3">
                        <Label>Custom</Label>
                        <input type="text" placeholder="e.g. 13/8" value={customTS}
                          onChange={e => { setCustomTS(e.target.value); setSelectedWesternTS("Custom"); }}
                          className="rounded-lg px-3 py-2 text-sm border focus:outline-none w-32"
                          style={{ backgroundColor: inputBg, borderColor: "var(--border)", color: "var(--text)" }}
                          onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
                          onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}/>
                      </div>
                    </>
                  )}
                </SectionCard>

                {/* Tempo */}
                <SectionCard className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <Label>Tempo</Label>
                    <span className="text-lg font-bold font-mono" style={{ color: accentColor }}>{tempo} BPM</span>
                  </div>
                  <input type="range" min={40} max={240} step={1} value={tempo}
                    onChange={e => setTempo(+e.target.value)}
                    className="w-full cursor-pointer"
                    style={{ accentColor: accentColor }}/>
                  <div className="flex justify-between mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                    <span>40</span><span>Slow · 60</span><span>Medium · 120</span><span>Fast · 180</span><span>240</span>
                  </div>
                </SectionCard>

                {/* Elements + Instrument */}
                <SectionCard className="mb-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label>Elements</Label>
                      <div className="flex flex-col gap-2">
                        {(["bass","treble","all"] as const).map(el => (
                          <button key={el} onClick={() => setRhythmElements(el)}
                            className="px-4 py-2.5 rounded-xl border text-left text-sm capitalize transition"
                            style={{
                              borderColor:     rhythmElements === el ? accentColor : "var(--border)",
                              backgroundColor: rhythmElements === el ? accentColor + "15" : "transparent",
                              color:           rhythmElements === el ? accentColor : "var(--text)",
                            }}>
                            {el === "bass" ? "🔉 Bass elements" : el === "treble" ? "🔊 Treble elements" : "⚡ All elements"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>Instrument</Label>
                      <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                        {RHYTHM_INSTRUMENTS.map(inst => (
                          <button key={inst} onClick={() => setRhythmInstrument(inst)}
                            className="px-2 py-2 rounded-lg border text-xs text-left transition"
                            style={{
                              borderColor:     rhythmInstrument === inst ? accentColor : "var(--border)",
                              backgroundColor: rhythmInstrument === inst ? accentColor + "15" : "transparent",
                              color:           rhythmInstrument === inst ? accentColor : "var(--text-muted)",
                            }}>
                            {inst}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── MELODY PATH ── */}
            {type === "melody" && (
              <>
                {/* Root key */}
                <SectionCard className="mb-5">
                  <Label>Root Key</Label>
                  <div className="flex flex-wrap gap-2">
                    {ROOTS.map(r => (
                      <button key={r} onClick={() => setSelectedRoot(r)}
                        className="w-12 h-10 rounded-lg border text-sm font-semibold font-mono transition"
                        style={{
                          borderColor:     selectedRoot === r ? accentColor : "var(--border)",
                          backgroundColor: selectedRoot === r ? accentColor + "15" : "transparent",
                          color:           selectedRoot === r ? accentColor : "var(--text)",
                        }}>
                        {r}
                      </button>
                    ))}
                  </div>
                </SectionCard>

                {/* Scale browser */}
                <SectionCard className="mb-5">
                  <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                    <Label>Scale / Raga</Label>
                    <div className="flex items-center gap-2">
                      <input type="text" placeholder="Search..." value={scaleSearch} onChange={e => setScaleSearch(e.target.value)}
                        className="rounded-lg px-3 py-1.5 text-xs border focus:outline-none w-32"
                        style={{ backgroundColor: inputBg, borderColor: "var(--border)", color: "var(--text)" }}
                        onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
                        onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}/>
                      {(["all","western","indian"] as const).map(f => (
                        <button key={f} onClick={() => setScaleFilter(f)}
                          className="px-2 py-1 rounded text-[10px] font-semibold capitalize border transition"
                          style={{
                            borderColor:     scaleFilter === f ? accentColor : "var(--border)",
                            backgroundColor: scaleFilter === f ? accentColor + "15" : "transparent",
                            color:           scaleFilter === f ? accentColor : "var(--text-muted)",
                          }}>
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                    {filteredScales.map(s => {
                      const isRaga = s.category === "indian";
                      const raga = isRaga ? INDIAN_RAGAS.find(r => r.id === s.id) : null;
                      return (
                        <button key={s.id} onClick={() => setSelectedScaleId(s.id)}
                          className="flex items-start justify-between px-3 py-2.5 rounded-xl border text-left transition"
                          style={{
                            borderColor:     selectedScaleId === s.id ? accentColor : "var(--border)",
                            backgroundColor: selectedScaleId === s.id ? accentColor + "10" : "transparent",
                          }}>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold" style={{ color: selectedScaleId === s.id ? accentColor : "var(--text)" }}>{s.name}</p>
                            {raga && <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{raga.mood} · {raga.thaatOrigin} Thaat</p>}
                          </div>
                          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded border flex-shrink-0 ml-2 mt-0.5"
                            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                            {isRaga ? "Raga" : "Scale"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Note display — universal + user key, always both rows */}
                  {selectedScale && (
                    <div className="mt-5 pt-5" style={{ borderTop: "1px solid var(--border)" }}>
                      <p className="text-[11px] uppercase tracking-wide mb-3 font-semibold" style={{ color: "var(--text-muted)" }}>
                        Notes — tap to deselect (deselected notes will not be used in generation)
                      </p>

                      {/* Universal row — always C# root */}
                      <div className="mb-3">
                        <p className="text-[10px] mb-1.5" style={{ color: "var(--text-muted)" }}>
                          Universal (C root) — scale structure reference
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {universalNotes.map((note, i) => {
                            const swara = selectedScale.category === "indian"
                              ? (selectedScale as any).swaras?.[i] ?? ""
                              : (selectedScale as any).degrees?.[i] ?? "";
                            return (
                              <div key={i} className="flex flex-col items-center gap-0.5">
                                <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{swara}</span>
                                <span className="text-xs px-2.5 py-1.5 rounded-lg border font-mono"
                                  style={{ borderColor: "var(--border)", color: "var(--text)", backgroundColor: "var(--background)" }}>
                                  {note}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* User key row — selectable/deselectable */}
                      <div>
                        <p className="text-[10px] mb-1.5" style={{ color: "var(--text-muted)" }}>
                          Your key ({selectedRoot}) — click to toggle notes
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {userKeyNotes.map((note, i) => {
                            const active = activeNotes.includes(note);
                            const swara = selectedScale.category === "indian"
                              ? (selectedScale as any).swaras?.[i] ?? ""
                              : (selectedScale as any).degrees?.[i] ?? "";
                            return (
                              <div key={i} className="flex flex-col items-center gap-0.5">
                                <span className="text-[9px]" style={{ color: active ? accentColor : "var(--text-muted)" }}>{swara}</span>
                                <button onClick={() => toggleNote(note)}
                                  className="text-xs px-2.5 py-1.5 rounded-lg border font-mono transition"
                                  style={{
                                    borderColor:     active ? accentColor : "var(--border)",
                                    backgroundColor: active ? accentColor + "20" : "var(--background)",
                                    color:           active ? accentColor : "var(--text-muted)",
                                    opacity:         active ? 1 : 0.4,
                                  }}>
                                  {note}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        {activeNotes.length === 0 && (
                          <p className="text-xs mt-2" style={{ color: "#FF6B4A" }}>All notes deselected — select at least one note to generate.</p>
                        )}
                      </div>
                    </div>
                  )}
                </SectionCard>

                {/* Instrument + settings */}
                <SectionCard className="mb-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label>Instrument</Label>
                      <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                        {MELODIC_INSTRUMENTS.map(inst => (
                          <button key={inst} onClick={() => setMelodyInstrument(inst)}
                            className="px-2 py-2 rounded-lg border text-xs text-left transition"
                            style={{
                              borderColor:     melodyInstrument === inst ? accentColor : "var(--border)",
                              backgroundColor: melodyInstrument === inst ? accentColor + "15" : "transparent",
                              color:           melodyInstrument === inst ? accentColor : "var(--text-muted)",
                            }}>
                            {inst}
                          </button>
                        ))}
                      </div>

                      {/* Piano sub-type — only shown when Piano selected */}
                      {melodyInstrument === "Piano" && (
                        <div className="mt-4">
                          <Label>Piano Type</Label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {([
                              { id: "grand",     label: "🎹 Grand" },
                              { id: "rhodes",    label: "🎸 Rhodes" },
                              { id: "honkytonk", label: "🎡 Honky Tonk" },
                              { id: "upright",   label: "🪵 Upright" },
                            ] as const).map(p => (
                              <button key={p.id} onClick={() => setPianoType(p.id)}
                                className="px-2 py-2 rounded-lg border text-xs text-left transition"
                                style={{
                                  borderColor:     pianoType === p.id ? accentColor : "var(--border)",
                                  backgroundColor: pianoType === p.id ? accentColor + "15" : "transparent",
                                  color:           pianoType === p.id ? accentColor : "var(--text-muted)",
                                }}>
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Playing Style */}
                      <div className="mt-4">
                        <Label>Playing Style</Label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {([
                            { id: "melody",      label: "Single Melody" },
                            { id: "chords",      label: "Block Chords" },
                            { id: "arpeggiated", label: "Arpeggiated" },
                            { id: "two-hand",    label: "Two Hand" },
                          ] as const).map(s => (
                            <button key={s.id} onClick={() => setPlayingStyle(s.id)}
                              className="px-2 py-2 rounded-lg border text-xs text-left transition"
                              style={{
                                borderColor:     playingStyle === s.id ? accentColor : "var(--border)",
                                backgroundColor: playingStyle === s.id ? accentColor + "15" : "transparent",
                                color:           playingStyle === s.id ? accentColor : "var(--text-muted)",
                              }}>
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-5">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Phrase Length</Label>
                          <span className="text-sm font-bold" style={{ color: accentColor }}>{phraseLength} bars</span>
                        </div>
                        <input type="range" min={1} max={16} step={1} value={phraseLength}
                          onChange={e => setPhraseLength(+e.target.value)}
                          className="w-full appearance-none cursor-pointer h-1.5 rounded-full"
                          style={{ background: `linear-gradient(to right,${accentColor} 0%,${accentColor} ${((phraseLength-1)/15)*100}%,var(--border) ${((phraseLength-1)/15)*100}%,var(--border) 100%)` }}/>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Octave Range</Label>
                          <span className="text-sm font-bold" style={{ color: accentColor }}>Oct {octaveRange[0]} – {octaveRange[1]}</span>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Low</p>
                            <input type="range" min={1} max={6} step={1} value={octaveRange[0]}
                              onChange={e => setOctaveRange([Math.min(+e.target.value, octaveRange[1]-1), octaveRange[1]])}
                              className="w-full appearance-none cursor-pointer h-1.5 rounded-full"
                              style={{ background: `linear-gradient(to right,${accentColor} 0%,${accentColor} ${((octaveRange[0]-1)/5)*100}%,var(--border) ${((octaveRange[0]-1)/5)*100}%,var(--border) 100%)` }}/>
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>High</p>
                            <input type="range" min={2} max={7} step={1} value={octaveRange[1]}
                              onChange={e => setOctaveRange([octaveRange[0], Math.max(+e.target.value, octaveRange[0]+1)])}
                              className="w-full appearance-none cursor-pointer h-1.5 rounded-full"
                              style={{ background: `linear-gradient(to right,${accentColor} 0%,${accentColor} ${((octaveRange[1]-2)/5)*100}%,var(--border) ${((octaveRange[1]-2)/5)*100}%,var(--border) 100%)` }}/>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </SectionCard>
              </>
            )}

            {/* Output format */}
            <SectionCard className="mb-6">
              <Label>Output Format</Label>
              <div className="flex gap-3">
                <button onClick={() => setOutputFormat("wav")}
                  className="flex-1 py-3 rounded-xl border text-sm font-semibold transition"
                  style={{
                    borderColor:     outputFormat === "wav" ? accentColor : "var(--border)",
                    backgroundColor: outputFormat === "wav" ? accentColor + "15" : "transparent",
                    color:           outputFormat === "wav" ? accentColor : "var(--text-muted)",
                  }}>
                  WAV
                </button>
                <button onClick={() => canMidi ? setOutputFormat("midi") : null}
                  className="flex-1 py-3 rounded-xl border text-sm font-semibold transition relative"
                  style={{
                    borderColor:     outputFormat === "midi" ? accentColor : !canMidi ? "var(--border)" : "var(--border)",
                    backgroundColor: outputFormat === "midi" ? accentColor + "15" : "transparent",
                    color:           !canMidi ? "var(--text-muted)" : outputFormat === "midi" ? accentColor : "var(--text-muted)",
                    opacity:         !canMidi ? 0.5 : 1,
                  }}>
                  MIDI {!canMidi && <span className="text-[9px] ml-1">Pro+</span>}
                </button>
                <button onClick={() => canMidi ? setOutputFormat("both") : null}
                  className="flex-1 py-3 rounded-xl border text-sm font-semibold transition"
                  style={{
                    borderColor:     outputFormat === "both" ? accentColor : "var(--border)",
                    backgroundColor: outputFormat === "both" ? accentColor + "15" : "transparent",
                    color:           !canMidi ? "var(--text-muted)" : outputFormat === "both" ? accentColor : "var(--text-muted)",
                    opacity:         !canMidi ? 0.5 : 1,
                  }}>
                  Both {!canMidi && <span className="text-[9px] ml-1">Pro+</span>}
                </button>
              </div>
            </SectionCard>

            {/* Generate button */}
            {generated ? (
              <div className="rounded-2xl border p-6" style={{ backgroundColor: "var(--surface)", borderColor: "#14D8C440" }}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">✅</span>
                  <div>
                    <p className="font-semibold" style={{ color: "#14D8C4" }}>Pattern generated</p>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      {type === "rhythm" ? rhythmInstrument : melodyInstrument} ·{" "}
                      {style === "indian" ? (selectedTaal || selectedScaleId) : selectedScaleId} ·{" "}
                      {tempo} BPM
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mb-4">
                  {wavBlob && (
                    <button onClick={downloadWav}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm"
                      style={{ backgroundColor: accentColor, color: "#000" }}>
                      ⬇ Download WAV
                    </button>
                  )}
                  {midiBlob && (
                    <button onClick={downloadMidi}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm border"
                      style={{ borderColor: accentColor, color: accentColor }}>
                      ⬇ Download MIDI
                    </button>
                  )}
                </div>
                {generateError && <p className="text-sm mb-3" style={{ color: "#FF6B4A" }}>{generateError}</p>}
                <button onClick={() => { setGenerated(false); setType(null); setWavBlob(null); setMidiBlob(null); }}
                  className="px-5 py-2.5 rounded-lg border text-sm transition"
                  style={{ borderColor: "var(--border)", color: "var(--text)" }}>
                  Generate Another
                </button>
              </div>
            ) : (
              <>
                {generateError && <p className="text-sm mb-3 px-1" style={{ color: "#FF6B4A" }}>{generateError}</p>}
                <button
                  onClick={handleGenerate}
                  disabled={generating ||
                    (type === "rhythm" && style === "indian" && !selectedTaal) ||
                    (type === "melody" && !selectedScaleId) ||
                    (type === "melody" && activeNotes.length === 0)}
                  className="w-full py-4 rounded-2xl font-bold text-lg transition disabled:opacity-40"
                  style={{ backgroundColor: accentColor, color: "#000" }}>
                  {generating ? "Generating..." : `Generate ${type === "rhythm" ? "Rhythm" : "Melody"} Pattern`}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}