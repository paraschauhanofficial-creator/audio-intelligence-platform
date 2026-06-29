"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { analyzeStem, type StemAnalysisProgress } from "@/intelligence/stems/stemsAnalyzer";
import { SECTION_LABELS, SLOT_LABELS, type StemSection } from "@/intelligence/stems/stemsIdentifier";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface StemRecord {
  id:                   string;
  file_name:            string;
  original_name:        string;
  file_path:            string;
  section:              StemSection;
  slot:                 string;
  slot_index:           number;
  confidence:           number;
  identification_method:string;
  processing_stage:     string;
  progress:             number;
  current_task:         string;
  run_key_detection:    boolean;
  // analysis results (populated after analysis)
  tempo:                number | null;
  time_signature:       string | null;
  musical_key:          string | null;
  scale:                string | null;
  integrated_lufs:      number | null;
  true_peak:            number | null;
  dynamic_range:        number | null;
  stereo_width:         number | null;
  freq_sub:             number | null;
  freq_bass:            number | null;
  freq_mid:             number | null;
  freq_high_mid:        number | null;
  freq_air:             number | null;
}

interface StemProgress {
  [stemId: string]: {
    stage:   string;
    message: string;
    percent: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────────────────────────────────────────
const sectionColors: Record<string, string> = {
  drums:       "#F0A500",
  instruments: "#14D8C4",
  vocals:      "#A78BFA",
  other:       "#FF6B4A",
};

const trackColor  = "#14D8C4";
const masterColor = "#F0A500";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function displaySlot(stem: StemRecord): string {
  const base  = SLOT_LABELS[stem.slot.replace(/_\d+$/, "")] ?? stem.slot;
  return stem.slot_index > 1 ? `${base} ${stem.slot_index}` : base;
}

function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    uploaded:  "Waiting",
    analysing: "Analysing",
    analysed:  "Done",
    error:     "Error",
  };
  return map[stage] ?? stage;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function StemsProjectPage() {
  const router = useRouter();
  const params = useParams();

  const [project,        setProject]        = useState<any>(null);
  const [stems,          setStems]          = useState<StemRecord[]>([]);
  const [audioUrls,      setAudioUrls]      = useState<Record<string, string>>({});
  const [stemProgress,   setStemProgress]   = useState<StemProgress>({});
  const [analysisRunning,setAnalysisRunning]= useState(false);
  const [analysisComplete,setAnalysisComplete]=useState(false);
  const [totalProgress,  setTotalProgress]  = useState(0);
  const [currentStemIdx, setCurrentStemIdx] = useState(0);
  const [error,          setError]          = useState("");

  const analysisRef = useRef(false); // prevent double-run

  // ── Load project + stems ──────────────────────────────────────────────────
  useEffect(() => { loadProject(); }, []);

  const loadProject = async () => {
    const { data: proj, error: projErr } = await supabase
      .from("projects").select("*").eq("id", params.id).single();
    if (projErr || !proj) { setError("Project not found."); return; }
    setProject(proj);

    const { data: stemRows } = await supabase
      .from("project_stems")
      .select("*")
      .eq("project_id", params.id)
      .order("order_index", { ascending: true });

    if (!stemRows || stemRows.length === 0) { setError("No stems found for this project."); return; }

    // Determine key detection per stem based on section/slot
    const stemsWithKey: StemRecord[] = stemRows.map(s => ({
      ...s,
      run_key_detection: shouldRunKeyDetection(s.section, s.slot),
    }));

    setStems(stemsWithKey);

    // Check if already all analysed
    const allDone = stemsWithKey.every(s => s.processing_stage === "analysed");
    if (allDone) { setAnalysisComplete(true); setTotalProgress(100); return; }

    // Get signed URLs for all stems
    const urls: Record<string, string> = {};
    for (const stem of stemsWithKey) {
      const { data: urlData } = await supabase.storage
        .from("project-files")
        .createSignedUrl(stem.file_path, 3600);
      if (urlData) urls[stem.id] = urlData.signedUrl;
    }
    setAudioUrls(urls);
  };

  // ── Key detection logic ───────────────────────────────────────────────────
  function shouldRunKeyDetection(section: string, slot: string): boolean {
    if (section === "drums" || section === "other") return false;
    const base = slot.replace(/_\d+$/, "");
    const melodicSlots = new Set(["lead_vocal","backing","harmony","adlibs","guitar","piano","synth","bass","strings","brass"]);
    return melodicSlots.has(base);
  }

  // ── Start analysis once URLs are ready ────────────────────────────────────
  useEffect(() => {
    if (Object.keys(audioUrls).length === 0) return;
    if (analysisRef.current) return;
    if (analysisComplete) return;
    const unanalysed = stems.filter(s => s.processing_stage !== "analysed");
    if (unanalysed.length === 0) return;
    analysisRef.current = true;
    runBatchAnalysis(unanalysed);
  }, [audioUrls]);

  // ── Batch analysis ────────────────────────────────────────────────────────
  const runBatchAnalysis = async (toAnalyse: StemRecord[]) => {
    setAnalysisRunning(true);

    // Update all to "analysing" in DB
    await supabase.from("project_stems")
      .update({ processing_stage: "analysing", current_task: "Queued..." })
      .in("id", toAnalyse.map(s => s.id));

    for (let i = 0; i < toAnalyse.length; i++) {
      const stem = toAnalyse[i];
      setCurrentStemIdx(i);

      // Mark as analysing
      await supabase.from("project_stems").update({
        processing_stage: "analysing",
        progress:         0,
        current_task:     "Starting analysis...",
      }).eq("id", stem.id);

      updateStemLocal(stem.id, { processing_stage: "analysing", progress: 0 });

      try {
        // Fetch the file from signed URL
        const url = audioUrls[stem.id];
        if (!url) throw new Error("No signed URL available");

        const response  = await fetch(url);
        const blob      = await response.blob();
        const file      = new File([blob], stem.original_name, { type: blob.type });

        // Run full Aura Ears analysis
        const result = await analyzeStem(
          file,
          stem.run_key_detection,
          (p: StemAnalysisProgress) => {
            // Update local progress state
            setStemProgress(prev => ({ ...prev, [stem.id]: { stage: p.stage, message: p.message, percent: p.percent } }));
            // Update DB progress
            supabase.from("project_stems").update({
              progress:     p.percent,
              current_task: p.message,
            }).eq("id", stem.id).then(() => {});
          }
        );

        // Save all metrics to Supabase
        await supabase.from("project_stems").update({
          processing_stage:  "analysed",
          progress:          100,
          current_task:      "Analysis complete",
          // Metadata
          duration:          result.duration,
          sample_rate:       result.sampleRate,
          bitrate:           result.bitrate,
          codec:             result.codec,
          // Tempo
          tempo:             result.tempo,
          time_signature:    result.timeSignature,
          // Key (null for drums/other)
          musical_key:       result.musicalKey,
          scale:             result.scale,
          key_confidence:    result.keyConfidence,
          // Loudness
          integrated_lufs:   result.integratedLufs,
          short_term_lufs:   result.shortTermLufs,
          momentary_lufs:    result.momentaryLufs,
          loudness_range:    result.loudnessRange,
          // Peaks
          true_peak:         result.truePeak,
          sample_peak:       result.samplePeak,
          average_peak:      result.averagePeak,
          // Dynamics
          rms:               result.rms,
          crest_factor:      result.crestFactor,
          dynamic_range:     result.dynamicRange,
          // Frequency
          freq_sub:          result.freqSub,
          freq_bass:         result.freqBass,
          freq_low_mid:      result.freqLowMid,
          freq_mid:          result.freqMid,
          freq_high_mid:     result.freqHighMid,
          freq_air:          result.freqAir,
          // Stereo
          stereo_correlation: result.stereoCorrelation,
          stereo_width:       result.stereoWidth,
        }).eq("id", stem.id);

        // Update local state
        updateStemLocal(stem.id, {
          processing_stage: "analysed",
          progress:         100,
          tempo:            result.tempo,
          musical_key:      result.musicalKey,
          scale:            result.scale,
          integrated_lufs:  result.integratedLufs,
          true_peak:        result.truePeak,
          dynamic_range:    result.dynamicRange,
          stereo_width:     result.stereoWidth,
          freq_sub:         result.freqSub,
          freq_bass:        result.freqBass,
          freq_mid:         result.freqMid,
          freq_high_mid:    result.freqHighMid,
          freq_air:         result.freqAir,
        });

      } catch (err: any) {
        console.error("Analysis failed for stem:", stem.id, err);
        await supabase.from("project_stems").update({
          processing_stage: "error",
          current_task:     err?.message ?? "Analysis failed",
        }).eq("id", stem.id);
        updateStemLocal(stem.id, { processing_stage: "error" });
      }

      // Update overall progress
      setTotalProgress(Math.round(((i + 1) / toAnalyse.length) * 100));
    }

    // Update project stems_analysed count
    const { data: allStems } = await supabase
      .from("project_stems").select("processing_stage").eq("project_id", params.id);
    const doneCount = allStems?.filter(s => s.processing_stage === "analysed").length ?? 0;
    await supabase.from("projects").update({
      stems_analysed: doneCount,
      status:         "completed",
      progress:       100,
      current_task:   "All stems analysed — ready for DAW",
    }).eq("id", params.id);

    setAnalysisRunning(false);
    setAnalysisComplete(true);
  };

  // ── Local stem state update helper ────────────────────────────────────────
  const updateStemLocal = (stemId: string, patch: Partial<StemRecord>) => {
    setStems(prev => prev.map(s => s.id === stemId ? { ...s, ...patch } : s));
  };

  // ── Group stems by section ────────────────────────────────────────────────
  const stemsBySection = (["drums","instruments","vocals","other"] as StemSection[]).map(section => ({
    section,
    stems: stems.filter(s => s.section === section),
  })).filter(g => g.stems.length > 0);

  // ── Overall stats ─────────────────────────────────────────────────────────
  const analysedCount = stems.filter(s => s.processing_stage === "analysed").length;
  const errorCount    = stems.filter(s => s.processing_stage === "error").length;

  // ── Frequency bar mini chart ──────────────────────────────────────────────
  const FreqBar = ({ value, label, color }: { value: number | null; label: string; color: string }) => {
    if (value == null) return null;
    // Convert dBFS (-60 to 0) to 0-100%
    const pct = Math.max(0, Math.min(100, ((value + 60) / 60) * 100));
    return (
      <div className="flex flex-col items-center gap-1" style={{ width: 20 }}>
        <div className="w-2 bg-[#1F2937] rounded-full relative overflow-hidden" style={{ height: 32 }}>
          <div className="absolute bottom-0 left-0 right-0 rounded-full"
            style={{ height: `${pct}%`, backgroundColor: color, transition: "height 0.3s" }}/>
        </div>
        <span className="text-[7px] text-zinc-600">{label}</span>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────────────────────────────────────
  if (!project) return (
    <div className="h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🎚️</div>
        <p className="text-zinc-400">{error || "Loading project..."}</p>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">

      {/* ── Header ── */}
      <div className="h-[72px] border-b border-[#1F2937] px-8 flex items-center justify-between flex-shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold truncate max-w-md">{project.name}</h1>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border"
              style={{ color: trackColor, borderColor: trackColor + "40", backgroundColor: trackColor + "15" }}>
              Stems
            </span>
            {project.genre && (
              <span className="text-[10px] text-zinc-500 border border-[#1F2937] px-2 py-0.5 rounded">
                {project.genre}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            {stems.length} stems · {analysedCount} analysed
            {errorCount > 0 && <span className="text-[#FF6B4A] ml-2">· {errorCount} errors</span>}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {analysisComplete && (
            <button
              onClick={() => router.push(`/projects/${params.id}/daw`)}
              className="px-6 py-2 rounded-lg font-semibold text-sm transition"
              style={{ backgroundColor: masterColor, color: "#000" }}>
              Open in DAW →
            </button>
          )}
          <button onClick={() => router.push("/projects/list")}
            className="px-4 py-2 rounded-lg border border-[#1F2937] text-sm">
            My Projects
          </button>
        </div>
      </div>

      {/* ── Overall progress bar ── */}
      {!analysisComplete && (
        <div className="px-8 py-4 border-b border-[#1F2937] flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: trackColor }}/>
              <span className="text-sm font-semibold" style={{ color: trackColor }}>
                {analysisRunning
                  ? `Analysing stem ${currentStemIdx + 1} of ${stems.filter(s => s.processing_stage !== "analysed").length}...`
                  : "Preparing analysis..."}
              </span>
            </div>
            <span className="text-sm font-mono text-zinc-400">{totalProgress}%</span>
          </div>
          <div className="w-full h-2 bg-[#1F2937] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${totalProgress}%`, backgroundColor: trackColor }}/>
          </div>
        </div>
      )}

      {analysisComplete && (
        <div className="px-8 py-3 border-b border-[#1F2937] flex-shrink-0 flex items-center gap-3"
          style={{ backgroundColor: trackColor + "08" }}>
          <span className="text-lg">✅</span>
          <span className="text-sm font-semibold" style={{ color: trackColor }}>
            All stems analysed — ready for DAW
          </span>
          <span className="text-xs text-zinc-500">
            {analysedCount}/{stems.length} completed
            {errorCount > 0 && ` · ${errorCount} failed`}
          </span>
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto space-y-8">

          {stemsBySection.map(({ section, stems: sectionStems }) => {
            const color = sectionColors[section] ?? trackColor;
            return (
              <div key={section}>

                {/* Section header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}/>
                  <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color }}>
                    {SECTION_LABELS[section as StemSection]}
                  </h2>
                  <span className="text-xs text-zinc-600">
                    {sectionStems.filter(s => s.processing_stage === "analysed").length}/{sectionStems.length} done
                  </span>
                  <div className="flex-1 h-px bg-[#1F2937]"/>
                </div>

                {/* Stem cards */}
                <div className="grid grid-cols-1 gap-3">
                  {sectionStems.map(stem => {
                    const prog    = stemProgress[stem.id];
                    const isDone  = stem.processing_stage === "analysed";
                    const isError = stem.processing_stage === "error";
                    const isActive= stem.processing_stage === "analysing";
                    const stemColor = isDone ? color : isError ? "#FF6B4A" : isActive ? trackColor : "#1F2937";

                    return (
                      <div key={stem.id}
                        className="bg-[#111827] rounded-2xl border p-5 transition"
                        style={{ borderColor: stemColor + (isDone ? "60" : isActive ? "80" : "30") }}>

                        <div className="flex items-start gap-4">

                          {/* Status icon */}
                          <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                            style={{ backgroundColor: stemColor + "20" }}>
                            {isDone  ? "✅" : isError ? "❌" : isActive ? "🔬" : "⏳"}
                          </div>

                          {/* Main info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm text-zinc-200">{displaySlot(stem)}</span>
                              <span className="text-[10px] text-zinc-500 truncate">{stem.original_name}</span>
                              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-semibold"
                                style={{ backgroundColor: color + "20", color }}>
                                {stageLabel(stem.processing_stage)}
                              </span>
                            </div>

                            {/* Progress bar — show while analysing */}
                            {isActive && (
                              <div className="mb-2">
                                <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                                  <span>{prog?.message ?? "Starting..."}</span>
                                  <span>{prog?.percent ?? 0}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-[#1F2937] rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all"
                                    style={{ width: `${prog?.percent ?? 0}%`, backgroundColor: trackColor }}/>
                                </div>
                              </div>
                            )}

                            {/* Analysis results — show when done */}
                            {isDone && (
                              <div className="flex flex-wrap gap-4 mt-2">

                                {/* Tempo */}
                                {stem.tempo && (
                                  <div className="flex flex-col">
                                    <span className="text-[9px] text-zinc-600 uppercase">BPM</span>
                                    <span className="text-sm font-bold font-mono" style={{ color }}>{stem.tempo}</span>
                                  </div>
                                )}

                                {/* Key — only melodic */}
                                {stem.musical_key && (
                                  <div className="flex flex-col">
                                    <span className="text-[9px] text-zinc-600 uppercase">Key</span>
                                    <span className="text-sm font-bold" style={{ color }}>
                                      {stem.musical_key} {stem.scale}
                                    </span>
                                  </div>
                                )}

                                {/* LUFS */}
                                {stem.integrated_lufs != null && (
                                  <div className="flex flex-col">
                                    <span className="text-[9px] text-zinc-600 uppercase">LUFS</span>
                                    <span className="text-sm font-bold font-mono" style={{ color }}>
                                      {stem.integrated_lufs.toFixed(1)}
                                    </span>
                                  </div>
                                )}

                                {/* True Peak */}
                                {stem.true_peak != null && (
                                  <div className="flex flex-col">
                                    <span className="text-[9px] text-zinc-600 uppercase">Peak</span>
                                    <span className="text-sm font-bold font-mono" style={{ color }}>
                                      {stem.true_peak.toFixed(1)} dBTP
                                    </span>
                                  </div>
                                )}

                                {/* Dynamic range */}
                                {stem.dynamic_range != null && (
                                  <div className="flex flex-col">
                                    <span className="text-[9px] text-zinc-600 uppercase">DR</span>
                                    <span className="text-sm font-bold font-mono" style={{ color }}>
                                      {stem.dynamic_range.toFixed(1)} dB
                                    </span>
                                  </div>
                                )}

                                {/* Stereo width */}
                                {stem.stereo_width != null && (
                                  <div className="flex flex-col">
                                    <span className="text-[9px] text-zinc-600 uppercase">Width</span>
                                    <span className="text-sm font-bold font-mono" style={{ color }}>
                                      {stem.stereo_width.toFixed(0)}%
                                    </span>
                                  </div>
                                )}

                                {/* Frequency mini bars */}
                                <div className="flex items-end gap-1 ml-2">
                                  <FreqBar value={stem.freq_sub}      label="SUB" color={color}/>
                                  <FreqBar value={stem.freq_bass}     label="BSS" color={color}/>
                                  <FreqBar value={stem.freq_mid}      label="MID" color={color}/>
                                  <FreqBar value={stem.freq_high_mid} label="HMD" color={color}/>
                                  <FreqBar value={stem.freq_air}      label="AIR" color={color}/>
                                </div>

                              </div>
                            )}

                            {/* Error message */}
                            {isError && (
                              <p className="text-xs text-[#FF6B4A] mt-1">{stem.current_task}</p>
                            )}
                          </div>

                          {/* Confidence badge */}
                          <div className="flex-shrink-0 text-right">
                            <div className="text-[9px] text-zinc-600 mb-1">ID Confidence</div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-16 h-1 bg-[#1F2937] rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{
                                  width: `${(stem.confidence ?? 0) * 100}%`,
                                  backgroundColor: (stem.confidence ?? 0) > 0.75 ? "#14D8C4"
                                    : (stem.confidence ?? 0) > 0.50 ? "#F0A500"
                                    : "#FF6B4A",
                                }}/>
                              </div>
                              <span className="text-[10px] font-mono text-zinc-500">
                                {Math.round((stem.confidence ?? 0) * 100)}%
                              </span>
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* ── Reference mix notice ── */}
          {project.has_reference_mix && (
            <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-[#1F2937]">🎵</div>
              <div>
                <p className="text-sm font-semibold text-zinc-300">Reference Mix</p>
                <p className="text-xs text-zinc-500 mt-0.5">Loaded muted in the DAW as reference. Not part of the signal chain.</p>
              </div>
              <div className="ml-auto">
                <span className="text-[10px] border border-[#1F2937] text-zinc-600 px-2 py-1 rounded">MUTED</span>
              </div>
            </div>
          )}

          {/* ── Open DAW CTA ── */}
          {analysisComplete && (
            <div className="bg-[#111827] border rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
              style={{ borderColor: masterColor + "40" }}>
              <div className="text-5xl">🎛️</div>
              <div>
                <p className="text-xl font-bold" style={{ color: masterColor }}>Ready for the DAW</p>
                <p className="text-sm text-zinc-400 mt-2">
                  All {analysedCount} stems analysed. Open the Producer Workspace to mix, apply FX chains, and master your project.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => router.push(`/projects/${params.id}/daw`)}
                  className="px-8 py-3 rounded-xl font-bold text-sm transition"
                  style={{ backgroundColor: masterColor, color: "#000" }}>
                  Open Producer Workspace →
                </button>
              </div>
              <div className="flex gap-6 mt-2 text-xs text-zinc-500">
                <span>🥁 {stems.filter(s=>s.section==="drums").length} Drum stems</span>
                <span>🎸 {stems.filter(s=>s.section==="instruments").length} Instrument stems</span>
                <span>🎤 {stems.filter(s=>s.section==="vocals").length} Vocal stems</span>
                {stems.filter(s=>s.section==="other").length > 0 &&
                  <span>✨ {stems.filter(s=>s.section==="other").length} Other stems</span>}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}