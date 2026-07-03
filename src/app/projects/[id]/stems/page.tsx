"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchAndLogAudio, checkEgressBudget, notifyEgressBlocked } from "@/lib/usageTracking";
import { getCachedAudio, setCachedAudio } from "@/lib/audioCache";
import { analyzeStem, type StemAnalysisProgress } from "@/intelligence/stems/stemsAnalyzer";
import { SECTION_LABELS, SLOT_LABELS, type StemSection } from "@/intelligence/stems/stemsIdentifier";
import { auraMaster } from "@/intelligence/master/auraMaster";
import { mixStems, type MixerStemRecord } from "@/intelligence/mixer";

interface StemRecord {
  id:                    string;
  file_name:             string;
  original_name:         string;
  file_path:             string;
  section:               StemSection;
  slot:                  string;
  slot_index:            number;
  confidence:            number;
  identification_method: string;
  processing_stage:      string;
  progress:              number;
  current_task:          string;
  run_key_detection:     boolean;
  tempo:                 number | null;
  time_signature:        string | null;
  musical_key:           string | null;
  scale:                 string | null;
  integrated_lufs:       number | null;
  true_peak:             number | null;
  dynamic_range:         number | null;
  stereo_width:          number | null;
  freq_sub:              number | null;
  freq_bass:             number | null;
  freq_mid:              number | null;
  freq_high_mid:         number | null;
  freq_air:              number | null;
}

interface StemProgress {
  [stemId: string]: { stage: string; message: string; percent: number; };
}

// Semantic category colors — NOT theme colors, NOT workflow colors. Fixed in light and dark mode.
const sectionColors: Record<string, string> = {
  drums: "#F0A500", instruments: "#14D8C4", vocals: "#A78BFA", other: "#FF6B4A",
};

// masterColor is semantic (matches "AI Master = gold" everywhere else) — fixed.
const masterColor = "#F0A500";

function displaySlot(stem: StemRecord): string {
  const base = SLOT_LABELS[stem.slot.replace(/_\d+$/, "")] ?? stem.slot;
  return stem.slot_index > 1 ? `${base} ${stem.slot_index}` : base;
}

function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    uploaded: "Waiting", analysing: "Analysing", analysed: "Done", error: "Error",
  };
  return map[stage] ?? stage;
}

export default function StemsProjectPage() {
  const router    = useRouter();
  const params    = useParams();
  // ── Fix: safely extract projectId ──────────────────────────────────────
  const projectId = (Array.isArray(params.id) ? params.id[0] : params.id) as string;

  const [project,          setProject]          = useState<any>(null);
  const [stems,            setStems]            = useState<StemRecord[]>([]);
  const [audioUrls,        setAudioUrls]        = useState<Record<string, string>>({});
  const [stemProgress,     setStemProgress]     = useState<StemProgress>({});
  const [analysisRunning,  setAnalysisRunning]  = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [mixingRunning,    setMixingRunning]    = useState(false);
  const [totalProgress,    setTotalProgress]    = useState(0);
  const [currentStemIdx,   setCurrentStemIdx]   = useState(0);
  const [error,            setError]            = useState("");

  const analysisRef = useRef(false);

  // Theme — identical pattern to every other migrated page (see projects/page.tsx)
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("nokashi-theme");
    setIsDarkMode(saved !== "light");
    const observer = new MutationObserver(() => {
      setIsDarkMode(!document.documentElement.classList.contains("theme-light"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Workflow-aware accent — same pattern as accentColor on every other page.
  // FIX: this was previously a hardcoded "#14D8C4" regardless of workflow,
  // so AI-Assisted stems projects (cyan everywhere else) showed teal here.
  const trackColor = (project?.workflow === "producer_mode_stems") ? "#14D8C4" : "#00B7FF";

  useEffect(() => { loadProject(); }, []);

  const loadProject = async () => {
    if (!projectId) { setError("Invalid project ID."); return; }

    const { data: proj, error: projErr } = await supabase
      .from("projects").select("*").eq("id", projectId).single();
    if (projErr || !proj) { setError("Project not found."); return; }
    setProject(proj);

    const { data: stemRows } = await supabase
      .from("project_stems").select("*").eq("project_id", projectId)
      .order("order_index", { ascending: true });

    if (!stemRows || stemRows.length === 0) { setError("No stems found for this project."); return; }

    const stemsWithKey: StemRecord[] = stemRows.map(s => ({
      ...s,
      run_key_detection: shouldRunKeyDetection(s.section, s.slot),
    }));

    setStems(stemsWithKey);

    const allDone = stemsWithKey.every(s => s.processing_stage === "analysed");
    if (allDone) {
      setAnalysisComplete(true);
      setTotalProgress(100);
      // If master already exists, nothing to do
      if (proj.master_file_path) return;
      // Otherwise run auto-mix
      runAutoMix(stemsWithKey, proj);
      return;
    }

    const urls: Record<string, string> = {};
    for (const stem of stemsWithKey) {
      const { data: urlData } = await supabase.storage
        .from("project-files").createSignedUrl(stem.file_path, 3600);
      if (urlData) urls[stem.id] = urlData.signedUrl;
    }
    setAudioUrls(urls);
  };

  function shouldRunKeyDetection(section: string, slot: string): boolean {
    if (section === "drums" || section === "other") return false;
    const base = slot.replace(/_\d+$/, "");
    return new Set(["lead_vocal","backing","harmony","adlibs","guitar","piano","synth","bass","strings","brass"]).has(base);
  }

  useEffect(() => {
    if (Object.keys(audioUrls).length === 0) return;
    if (analysisRef.current) return;
    if (analysisComplete) return;
    const unanalysed = stems.filter(s => s.processing_stage !== "analysed");
    if (unanalysed.length === 0) return;
    analysisRef.current = true;
    runBatchAnalysis(unanalysed);
  }, [audioUrls]);

  // ── BATCH ANALYSIS ────────────────────────────────────────────────────────
  const runBatchAnalysis = async (toAnalyse: StemRecord[]) => {
    const budgetCheck = await checkEgressBudget();
    if (!budgetCheck.allowed) {
      setError("Your monthly preview/playback limit has been reached. Upgrade your plan or wait until it resets to continue analysing stems.");
      notifyEgressBlocked();
      return;
    }

    setAnalysisRunning(true);

    await supabase.from("project_stems")
      .update({ processing_stage: "analysing", current_task: "Queued..." })
      .in("id", toAnalyse.map(s => s.id));

    for (let i = 0; i < toAnalyse.length; i++) {
      const stem = toAnalyse[i];
      setCurrentStemIdx(i);

      await supabase.from("project_stems").update({
        processing_stage: "analysing", progress: 0, current_task: "Starting analysis...",
      }).eq("id", stem.id);

      updateStemLocal(stem.id, { processing_stage: "analysing", progress: 0 });

      try {
        const url = audioUrls[stem.id];
        if (!url) throw new Error("No signed URL available");

        // Check cache first — zero egress if hit
        let blob = await getCachedAudio(stem.file_path);
        if (blob) {
          console.log("[AudioCache] Analysis hit:", stem.file_path);
        } else {
          blob = await fetchAndLogAudio(url, "daw_stem_load", projectId);
          setCachedAudio(stem.file_path, blob);
        }
        const file = new File([blob], stem.original_name, { type: blob.type });

        const result = await analyzeStem(
          file, stem.run_key_detection,
          (p: StemAnalysisProgress) => {
            setStemProgress(prev => ({ ...prev, [stem.id]: { stage: p.stage, message: p.message, percent: p.percent } }));
            supabase.from("project_stems").update({ progress: p.percent, current_task: p.message }).eq("id", stem.id).then(() => {});
          }
        );

        await supabase.from("project_stems").update({
          processing_stage: "analysed", progress: 100, current_task: "Analysis complete",
          duration: result.duration, sample_rate: result.sampleRate,
          bitrate: result.bitrate, codec: result.codec,
          tempo: result.tempo, time_signature: result.timeSignature,
          musical_key: result.musicalKey, scale: result.scale, key_confidence: result.keyConfidence,
          integrated_lufs: result.integratedLufs, short_term_lufs: result.shortTermLufs,
          momentary_lufs: result.momentaryLufs, loudness_range: result.loudnessRange,
          true_peak: result.truePeak, sample_peak: result.samplePeak, average_peak: result.averagePeak,
          rms: result.rms, crest_factor: result.crestFactor, dynamic_range: result.dynamicRange,
          freq_sub: result.freqSub, freq_bass: result.freqBass, freq_low_mid: result.freqLowMid,
          freq_mid: result.freqMid, freq_high_mid: result.freqHighMid, freq_air: result.freqAir,
          stereo_correlation: result.stereoCorrelation, stereo_width: result.stereoWidth,
        }).eq("id", stem.id);

        updateStemLocal(stem.id, {
          processing_stage: "analysed", progress: 100,
          tempo: result.tempo, musical_key: result.musicalKey, scale: result.scale,
          integrated_lufs: result.integratedLufs, true_peak: result.truePeak,
          dynamic_range: result.dynamicRange, stereo_width: result.stereoWidth,
          freq_sub: result.freqSub, freq_bass: result.freqBass,
          freq_mid: result.freqMid, freq_high_mid: result.freqHighMid, freq_air: result.freqAir,
        });

      } catch (err: any) {
        console.error("Analysis failed for stem:", stem.id, err);
        await supabase.from("project_stems").update({
          processing_stage: "error", current_task: err?.message ?? "Analysis failed",
        }).eq("id", stem.id);
        updateStemLocal(stem.id, { processing_stage: "error" });
      }

      setTotalProgress(Math.round(((i + 1) / toAnalyse.length) * 100));
    }

    // Update project stems_analysed count
    const { data: allStems } = await supabase
      .from("project_stems").select("processing_stage").eq("project_id", projectId);
    const doneCount = allStems?.filter(s => s.processing_stage === "analysed").length ?? 0;

    // Pick tempo from drums, key from melodic stem
    const drumStem    = stems.find(s => s.section === "drums" && s.tempo);
    const melodicStem = stems.find(s => s.musical_key);

    await supabase.from("projects").update({
      stems_analysed: doneCount,
      status:         "processing",
      progress:       50,
      current_task:   "All stems analysed — starting auto-mix...",
      tempo:          drumStem?.tempo          ?? null,
      time_signature: drumStem?.time_signature ?? null,
      musical_key:    melodicStem?.musical_key ?? null,
      scale:          melodicStem?.scale       ?? null,
    }).eq("id", projectId);

    setAnalysisRunning(false);
    setAnalysisComplete(true);

    // ── AUTO-MIX after analysis ───────────────────────────────────────────
    const { data: freshStems } = await supabase
      .from("project_stems").select("*").eq("project_id", projectId).order("order_index", { ascending: true });
    const { data: freshProj } = await supabase.from("projects").select("*").eq("id", projectId).single();

    if (freshStems && freshProj) {
      await runAutoMix(freshStems as StemRecord[], freshProj);
    }
  };

  // ── AUTO-MIX: sum all stems → auraMaster → save → redirect to [id] page ──
  const runAutoMix = async (stemList: StemRecord[], proj: any) => {
    const budgetCheck = await checkEgressBudget();
    if (!budgetCheck.allowed) {
      await supabase.from("projects").update({
        current_task: "Paused — monthly preview/playback limit reached. Upgrade your plan or wait until it resets.",
      }).eq("id", projectId);
      notifyEgressBlocked();
      return;
    }

    setMixingRunning(true);

    await supabase.from("projects").update({
      status: "processing", progress: 60, current_task: "Mixing stems...",
    }).eq("id", projectId);

    try {
      // Get signed URLs for all analysed stems
      const stemUrls: Record<string, string> = {};
      for (const stem of stemList) {
        if (stem.processing_stage !== "analysed") continue;
        const { data } = await supabase.storage.from("project-files").createSignedUrl(stem.file_path, 3600);
        if (data) stemUrls[stem.id] = data.signedUrl;
      }

      // Decode all stems
      const audioCtx = new AudioContext();
      const buffers: AudioBuffer[] = [];

      for (const stem of stemList) {
        const url = stemUrls[stem.id];
        if (!url) continue;
        try {
          // Check cache first — stems were already fetched during analysis
          // so this should almost always be a cache hit, zero additional egress
          let blob = await getCachedAudio(stem.file_path);
          if (blob) {
            console.log("[AudioCache] AutoMix hit:", stem.file_path);
          } else {
            blob = await fetchAndLogAudio(url, "daw_stem_load", projectId);
            setCachedAudio(stem.file_path, blob);
          }
          const arrayBuffer  = await blob.arrayBuffer();
          const buffer       = await audioCtx.decodeAudioData(arrayBuffer);
          buffers.push(buffer);
        } catch (e) {
          console.error("Failed to decode stem:", stem.original_name, e);
        }
      }

      if (buffers.length === 0) throw new Error("No stem buffers decoded");

      

      audioCtx.close();

      // Route through Aura Mixer — intelligent gain staging, panning, HPF
      const mixedBuffer = await mixStems(
        buffers,
        stemList.filter(s => s.processing_stage === "analysed") as unknown as MixerStemRecord[],
        buffers[0].sampleRate
      );

      // Convert mix buffer to WAV blob for auraMaster
      const wavBlob = bufferToWavBlob(mixedBuffer);
      const mixFile = new File([wavBlob], `${proj.name}-stems-mix.wav`, { type: "audio/wav" });

      await supabase.from("projects").update({
        progress: 75, current_task: "Mastering stems mix...",
      }).eq("id", projectId);

      // Run Aura Master on the summed mix
      const result = await auraMaster(mixFile);

      // Upload master WAV
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const masterPath = `${user.id}/masters/${projectId}-${Date.now()}-master.wav`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("project-files").upload(masterPath, result.masterBlob, { contentType: "audio/wav" });
      if (uploadErr) throw uploadErr;

      // Save all master metrics to projects table
      await supabase.from("projects").update({
        status:                   "completed",
        progress:                 100,
        current_task:             "Export Ready",
        processing_stage:         "completed",
        master_file_path:         uploadData.path,
        master_lufs:              result.lufs,
        master_true_peak:         result.truePeak,
        master_dynamic_range:     result.dynamicRange,
        master_rms:               result.rms,
        master_input_gain:        result.inputGain,
        master_low_shelf_gain:    result.lowShelfGain,
        master_low_shelf_freq:    result.lowShelfFreq,
        master_high_shelf_gain:   result.highShelfGain,
        master_high_shelf_freq:   result.highShelfFreq,
        master_saturation_drive:  result.saturationDrive,
        master_limiter_ceiling:   result.limiterCeiling,
        master_target_lufs:       result.targetLUFS,
        master_freq_sub:          result.freqSub,
        master_freq_bass:         result.freqBass,
        master_freq_low_mid:      result.freqLowMid,
        master_freq_mid:          result.freqMid,
        master_freq_high_mid:     result.freqHighMid,
        master_freq_air:          result.freqAir,
        master_stereo_correlation: result.stereoCorrelation,
        master_stereo_width:      result.stereoWidth,
      }).eq("id", projectId);

      setMixingRunning(false);

      // ── Redirect to project [id] page — same as mix workflow ──
      router.push(`/projects/${projectId}`);

    } catch (err: any) {
      console.error("Auto-mix failed:", err);
      setMixingRunning(false);
      await supabase.from("projects").update({
        current_task: `Auto-mix failed: ${err?.message ?? "Unknown error"}`,
      }).eq("id", projectId);
    }
  };

  // ── WAV encoder helper ────────────────────────────────────────────────────
  function bufferToWavBlob(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate  = buffer.sampleRate;
    const length      = buffer.length;
    const arrayBuffer = new ArrayBuffer(44 + length * numChannels * 2);
    const view        = new DataView(arrayBuffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(0, "RIFF");
    view.setUint32(4,  36 + length * numChannels * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, length * numChannels * 2, true);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
  }

  const updateStemLocal = (stemId: string, patch: Partial<StemRecord>) => {
    setStems(prev => prev.map(s => s.id === stemId ? { ...s, ...patch } : s));
  };

  const stemsBySection = (["drums","instruments","vocals","other"] as StemSection[]).map(section => ({
    section, stems: stems.filter(s => s.section === section),
  })).filter(g => g.stems.length > 0);

  const analysedCount = stems.filter(s => s.processing_stage === "analysed").length;
  const errorCount    = stems.filter(s => s.processing_stage === "error").length;

  const FreqBar = ({ value, label, color }: { value: number | null; label: string; color: string }) => {
    if (value == null) return null;
    const pct = Math.max(0, Math.min(100, ((value + 60) / 60) * 100));
    return (
      <div className="flex flex-col items-center gap-1" style={{ width: 20 }}>
        <div className="w-2 rounded-full relative overflow-hidden" style={{ height: 32, backgroundColor: "var(--border)" }}>
          <div className="absolute bottom-0 left-0 right-0 rounded-full"
            style={{ height: `${pct}%`, backgroundColor: color, transition: "height 0.3s" }}/>
        </div>
        <span className="text-[7px]" style={{ color: "var(--text-muted)" }}>{label}</span>
      </div>
    );
  };

  if (!project) return (
    <div className="h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)", color: "var(--text)" }}>
      <div className="text-center">
        <div className="text-4xl mb-4">🎚️</div>
        <p style={{ color: "var(--text-muted)" }}>{error || "Loading project..."}</p>
      </div>
    </div>
  );

  // Mixing/mastering overlay
  if (mixingRunning) return (
    <div className="h-screen flex flex-col items-center justify-center gap-6" style={{ backgroundColor: "var(--background)", color: "var(--text)" }}>
      <div className="text-5xl">🎛️</div>
      <div className="text-center">
        <p className="text-2xl font-bold" style={{ color: masterColor }}>AI Mixing & Mastering</p>
        <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>Summing stems and running Aura Master...</p>
      </div>
      <div className="w-80 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
        <div className="h-full rounded-full animate-pulse" style={{ width: "70%", backgroundColor: masterColor }}/>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>This may take a minute for large sessions</p>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--background)", color: "var(--text)" }}>

      {/* Header */}
      <div className="h-[72px] border-b px-8 flex items-center justify-between flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold truncate max-w-md" style={{ color: "var(--text)" }}>{project.name}</h1>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border"
              style={{ color: trackColor, borderColor: trackColor + "40", backgroundColor: trackColor + "15" }}>
              Stems
            </span>
            {project.genre && (
              <span className="text-[10px] border px-2 py-0.5 rounded" style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}>
                {project.genre}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {stems.length} stems · {analysedCount} analysed
            {errorCount > 0 && <span style={{ color: "#FF6B4A" }} className="ml-2">· {errorCount} errors</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {analysisComplete && (
            <button onClick={() => router.push(`/projects/${projectId}/daw`)}
              className="px-6 py-2 rounded-lg font-semibold text-sm transition"
              style={{ backgroundColor: masterColor, color: "#000" }}>
              Open in DAW →
            </button>
          )}
          <button onClick={() => router.push("/projects/list")}
            className="px-4 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--border)", color: "var(--text)" }}>
            My Projects
          </button>
        </div>
      </div>

      {/* Overall progress */}
      {!analysisComplete && (
        <div className="px-8 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: trackColor }}/>
              <span className="text-sm font-semibold" style={{ color: trackColor }}>
                {analysisRunning
                  ? `Analysing stem ${currentStemIdx + 1} of ${stems.filter(s => s.processing_stage !== "analysed").length}...`
                  : "Preparing analysis..."}
              </span>
            </div>
            <span className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>{totalProgress}%</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${totalProgress}%`, backgroundColor: trackColor }}/>
          </div>
        </div>
      )}

      {analysisComplete && (
        <div className="px-8 py-3 border-b flex-shrink-0 flex items-center gap-3"
          style={{ borderColor: "var(--border)", backgroundColor: trackColor + "08" }}>
          <span className="text-lg">✅</span>
          <span className="text-sm font-semibold" style={{ color: trackColor }}>
            All stems analysed — mixing & mastering in progress...
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{analysedCount}/{stems.length} stems</span>
        </div>
      )}

      {/* Stem cards */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {stemsBySection.map(({ section, stems: sectionStems }) => {
            const color = sectionColors[section] ?? trackColor;
            return (
              <div key={section}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}/>
                  <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color }}>
                    {SECTION_LABELS[section as StemSection]}
                  </h2>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {sectionStems.filter(s => s.processing_stage === "analysed").length}/{sectionStems.length} done
                  </span>
                  <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }}/>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {sectionStems.map(stem => {
                    const prog      = stemProgress[stem.id];
                    const isDone    = stem.processing_stage === "analysed";
                    const isError   = stem.processing_stage === "error";
                    const isActive  = stem.processing_stage === "analysing";
                    const stemColor = isDone ? color : isError ? "#FF6B4A" : isActive ? trackColor : "var(--border)";

                    return (
                      <div key={stem.id}
                        className="rounded-2xl border p-5 transition"
                        style={{ backgroundColor: "var(--surface)", borderColor: isDone || isError || isActive ? stemColor + (isDone ? "60" : "80") : "var(--border)" }}>
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                            style={{ backgroundColor: stemColor + "20" }}>
                            {isDone ? "✅" : isError ? "❌" : isActive ? "🔬" : "⏳"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{displaySlot(stem)}</span>
                              <span className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{stem.original_name}</span>
                              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-semibold"
                                style={{ backgroundColor: color + "20", color }}>
                                {stageLabel(stem.processing_stage)}
                              </span>
                            </div>
                            {isActive && (
                              <div className="mb-2">
                                <div className="flex justify-between text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>
                                  <span>{prog?.message ?? "Starting..."}</span>
                                  <span>{prog?.percent ?? 0}%</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                                  <div className="h-full rounded-full transition-all"
                                    style={{ width: `${prog?.percent ?? 0}%`, backgroundColor: trackColor }}/>
                                </div>
                              </div>
                            )}
                            {isDone && (
                              <div className="flex flex-wrap gap-4 mt-2">
                                {stem.tempo && (
                                  <div className="flex flex-col">
                                    <span className="text-[9px] uppercase" style={{ color: "var(--text-muted)" }}>BPM</span>
                                    <span className="text-sm font-bold font-mono" style={{ color }}>{stem.tempo}</span>
                                  </div>
                                )}
                                {stem.musical_key && (
                                  <div className="flex flex-col">
                                    <span className="text-[9px] uppercase" style={{ color: "var(--text-muted)" }}>Key</span>
                                    <span className="text-sm font-bold" style={{ color }}>{stem.musical_key} {stem.scale}</span>
                                  </div>
                                )}
                                {stem.integrated_lufs != null && (
                                  <div className="flex flex-col">
                                    <span className="text-[9px] uppercase" style={{ color: "var(--text-muted)" }}>LUFS</span>
                                    <span className="text-sm font-bold font-mono" style={{ color }}>{stem.integrated_lufs.toFixed(1)}</span>
                                  </div>
                                )}
                                {stem.true_peak != null && (
                                  <div className="flex flex-col">
                                    <span className="text-[9px] uppercase" style={{ color: "var(--text-muted)" }}>Peak</span>
                                    <span className="text-sm font-bold font-mono" style={{ color }}>{stem.true_peak.toFixed(1)} dBTP</span>
                                  </div>
                                )}
                                {stem.dynamic_range != null && (
                                  <div className="flex flex-col">
                                    <span className="text-[9px] uppercase" style={{ color: "var(--text-muted)" }}>DR</span>
                                    <span className="text-sm font-bold font-mono" style={{ color }}>{stem.dynamic_range.toFixed(1)} dB</span>
                                  </div>
                                )}
                                {stem.stereo_width != null && (
                                  <div className="flex flex-col">
                                    <span className="text-[9px] uppercase" style={{ color: "var(--text-muted)" }}>Width</span>
                                    <span className="text-sm font-bold font-mono" style={{ color }}>{stem.stereo_width.toFixed(0)}%</span>
                                  </div>
                                )}
                                <div className="flex items-end gap-1 ml-2">
                                  <FreqBar value={stem.freq_sub}      label="SUB" color={color}/>
                                  <FreqBar value={stem.freq_bass}     label="BSS" color={color}/>
                                  <FreqBar value={stem.freq_mid}      label="MID" color={color}/>
                                  <FreqBar value={stem.freq_high_mid} label="HMD" color={color}/>
                                  <FreqBar value={stem.freq_air}      label="AIR" color={color}/>
                                </div>
                              </div>
                            )}
                            {isError && <p className="text-xs mt-1" style={{ color: "#FF6B4A" }}>{stem.current_task}</p>}
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <div className="text-[9px] mb-1" style={{ color: "var(--text-muted)" }}>ID Confidence</div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-16 h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                                <div className="h-full rounded-full" style={{
                                  width: `${(stem.confidence ?? 0) * 100}%`,
                                  backgroundColor: (stem.confidence ?? 0) > 0.75 ? "#14D8C4" : (stem.confidence ?? 0) > 0.50 ? "#F0A500" : "#FF6B4A",
                                }}/>
                              </div>
                              <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{Math.round((stem.confidence ?? 0) * 100)}%</span>
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

          {project.has_reference_mix && (
            <div className="rounded-2xl border p-5 flex items-center gap-4" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: "var(--border)" }}>🎵</div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Reference Mix</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Loaded muted in the DAW as reference. Not part of the signal chain.</p>
              </div>
              <div className="ml-auto">
                <span className="text-[10px] border px-2 py-1 rounded" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>MUTED</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}