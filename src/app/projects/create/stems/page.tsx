"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { notifyStorageBlocked } from "@/lib/usageTracking";
import { quickFingerprint } from "@/intelligence/stems/stemsAnalyzer";
import {
  identifyStems, createSlotIndexTracker,
  type StemFileInput, type IdentificationResult,
  SECTION_LABELS, SLOT_LABELS, SLOT_OPTIONS, type StemSection,
} from "@/intelligence/stems/stemsIdentifier";

interface StemEntry {
  id: string;
  file: File;
  identification: IdentificationResult;
  overrideSection: StemSection | null;
  overrideSlot: string | null;
  mixRole: "main" | "supporting";
}

type Phase = "upload" | "fingerprinting" | "popup" | "saving";

// Semantic category colors — NOT theme colors. Stay fixed in light and dark mode.
const sectionColors: Record<StemSection, string> = {
  drums: "#F0A500", instruments: "#14D8C4", vocals: "#A78BFA", other: "#FF6B4A",
};

export default function CreateStemsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-fill from URL params (passed from create/ai or create/producer)
  const sourceWorkflow = searchParams.get("workflow") ?? "ai_assisted"; // "ai_assisted" | "producer_mode"
  const [projectName, setProjectName] = useState(searchParams.get("name") ?? "");
  const [genre,       setGenre]       = useState(searchParams.get("genre") ?? "");

  // Plan gate — Stems is Pro/Studio only. Checked here too because this page
  // is reachable directly by URL, bypassing the radio-button gate on
  // create/ai and create/producer.
  const [planChecked, setPlanChecked] = useState(false);
  const [planAllowed, setPlanAllowed] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, role")
        .eq("id", user.id)
        .single();

      const isUnrestricted = profile?.role === "admin" || profile?.role === "super_user";
      const isFree = !isUnrestricted && (profile?.plan ?? "free") === "free";

      if (isFree) {
        router.push("/projects/upgrade");
        return;
      }

      setPlanAllowed(true);
      setPlanChecked(true);
    })();
  }, [router]);

  const [phase,          setPhase]          = useState<Phase>("upload");
  const [fingerprintMsg, setFingerprintMsg] = useState("");
  const [fingerprintPct, setFingerprintPct] = useState(0);
  const [stems,          setStems]          = useState<StemEntry[]>([]);
  const [saving,         setSaving]         = useState(false);
  const [saveMsg,        setSaveMsg]        = useState("");
  const [hasRefMix,      setHasRefMix]      = useState(false);
  const [refMixFile,     setRefMixFile]     = useState<File | null>(null);

  const fileInputRef   = useRef<HTMLInputElement>(null);
  const refMixInputRef = useRef<HTMLInputElement>(null);

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

  const inputBg = isDarkMode ? "#0A0A0A" : "rgba(255,255,255,0.6)";
  const hoverBorder = isDarkMode ? "#52525b" : "#a1a1aa";

  // Workflow-aware accent — UNCHANGED logic. Do not hardcode either color.
  const isProducer   = sourceWorkflow === "producer_mode";
  const accentColor  = isProducer ? "#14D8C4" : "#00B7FF";
  const workflowLabel = isProducer ? "Producer Mode — Stems" : "AI Assisted — Stems";

  // Supabase workflow value:
  // ai_assisted_stems or producer_mode_stems
  const supabaseWorkflow = isProducer ? "producer_mode_stems" : "ai_assisted_stems";

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files).filter(f =>
      f.type.startsWith("audio/") || f.name.match(/\.(wav|mp3|flac|aiff|aac|ogg|m4a)$/i)
    );
    if (fileArr.length === 0) return;
    setPhase("fingerprinting");

    const inputs: StemFileInput[] = [];
    for (let i = 0; i < fileArr.length; i++) {
      setFingerprintMsg(`Analysing ${fileArr[i].name} (${i + 1}/${fileArr.length})...`);
      setFingerprintPct(Math.round((i / fileArr.length) * 100));
      try {
        const fp = await quickFingerprint(fileArr[i]);
        inputs.push({ fileName: fileArr[i].name, fingerprint: fp });
      } catch {
        inputs.push({ fileName: fileArr[i].name, fingerprint: null });
      }
    }
    setFingerprintPct(100);
    setFingerprintMsg("Identification complete — review below");

    const results = identifyStems(inputs);
    const entries: StemEntry[] = fileArr.map((file, i) => ({
      id: crypto.randomUUID(), file, identification: results[i],
      overrideSection: null, overrideSlot: null,
      mixRole: "supporting",
    }));
    setStems(entries);
    setPhase("popup");
  };

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); handleFiles(e.dataTransfer.files); };

  const setSection = (id: string, section: StemSection) =>
    setStems(prev => prev.map(s => s.id === id ? { ...s, overrideSection: section, overrideSlot: SLOT_OPTIONS[section][0] } : s));

  const setSlot = (id: string, slot: string) =>
    setStems(prev => prev.map(s => s.id === id ? { ...s, overrideSlot: slot } : s));

  const setMixRole = (id: string, role: "main" | "supporting") =>
    setStems(prev => prev.map(s => s.id === id ? { ...s, mixRole: role } : s));

  const removeEntry = (id: string) => setStems(prev => prev.filter(s => s.id !== id));

  const effectiveSection = (s: StemEntry): StemSection => s.overrideSection ?? s.identification.section;
  const effectiveSlot    = (s: StemEntry): string       => s.overrideSlot    ?? s.identification.slot;

  const handleConfirm = async () => {
    if (!projectName.trim()) { setSaveMsg("Please enter a project name."); return; }
    if (stems.length === 0)  { setSaveMsg("No stems to save."); return; }

    setSaving(true); setPhase("saving"); setSaveMsg("Creating project...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaveMsg("Not logged in."); return; }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data: project, error: projErr } = await supabase.from("projects").insert({
        user_id:           user.id,
        name:              projectName.trim(),
        genre:             genre.trim() || null,
        workflow:          supabaseWorkflow,   // "ai_assisted_stems" | "producer_mode_stems"
        status:            "processing",
        progress:          0,
        current_task:      "Uploading stems...",
        processing_stage:  "uploaded",
        stem_count:        stems.length,
        has_reference_mix: hasRefMix && !!refMixFile,
        expires_at:        expiresAt.toISOString(),
      }).select().single();

      if (projErr || !project) {
        console.error("Project insert error:", projErr);
        setSaveMsg("Failed to create project.");
        return;
      }

      // Upload reference mix if provided
      if (hasRefMix && refMixFile) {
        setSaveMsg("Uploading reference mix...");
        const refPath = `${user.id}/stems/${project.id}/ref_mix-${Date.now()}-${refMixFile.name}`;
        const { error: refErr } = await supabase.storage.from("project-files").upload(refPath, refMixFile, { contentType: refMixFile.type });
        if (!refErr) await supabase.from("projects").update({ reference_mix_path: refPath }).eq("id", project.id);
      }

      // Re-run slot indexing on confirmed assignments
      const tracker = createSlotIndexTracker();
      const sorted = [...stems].sort((a, b) => {
        const secA = effectiveSection(a); const secB = effectiveSection(b);
        if (secA !== secB) return secA.localeCompare(secB);
        return effectiveSlot(a).localeCompare(effectiveSlot(b));
      });

      for (let i = 0; i < sorted.length; i++) {
        const entry   = sorted[i];
        const section = effectiveSection(entry);
        const slotBase = effectiveSlot(entry).replace(/_\d+$/, "");
        const { slot, slotIndex } = tracker.assign(slotBase);

        setSaveMsg(`Uploading ${entry.file.name} (${i + 1}/${sorted.length})...`);

        const filePath = `${user.id}/stems/${project.id}/${slot}-${Date.now()}-${entry.file.name}`;
        const { error: uploadErr } = await supabase.storage.from("project-files").upload(filePath, entry.file, { contentType: entry.file.type });
        if (uploadErr) { console.error("Upload failed for", entry.file.name, uploadErr); continue; }

        const { error: stemInsertErr } = await supabase.from("project_stems").insert({
          project_id: project.id, user_id: user.id,
          file_name: slot, original_name: entry.file.name,
          file_path: filePath, file_type: entry.file.type, file_size: entry.file.size,
          section, slot, slot_index: slotIndex,
          confidence: entry.identification.confidence,
          identification_method: entry.identification.method,
          needs_review: entry.identification.needsReview,
          processing_stage: "uploaded", progress: 0,
          current_task: "Waiting for analysis...", order_index: i,
          mix_role: entry.mixRole,
        });

        if (stemInsertErr) {
          console.error("Stem insert failed for", entry.file.name, stemInsertErr);
          await supabase.storage.from("project-files").remove([filePath]);
          if (stemInsertErr.message?.includes("row-level security")) {
            setSaveMsg("Blocked: your plan's storage limit was reached, or Stems isn't available on your current plan. Upgrade to continue.");
            notifyStorageBlocked(); // closest match — Postgres doesn't distinguish which restrictive policy fired
            break; // stop the loop entirely rather than silently skipping remaining stems
          }
          continue;
        }
      }

      setSaveMsg("Stems uploaded ✓ — starting analysis...");
      setTimeout(() => { router.push(`/projects/${project.id}/stems`); }, 800);

    } catch (err) {
      console.error(err);
      setSaveMsg("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── PLAN-CHECK GATE ───────────────────────────────────────────────────────
  // Blocks the page entirely until we've confirmed the user is allowed here.
  // Free-plan users are redirected to /projects/upgrade inside the effect
  // above, so by the time planChecked is true and planAllowed is false,
  // a redirect is already in flight — render nothing to avoid a UI flash.
  if (!planChecked) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)", color: "var(--text)" }}>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>
    </div>
  );
  if (!planAllowed) return null;

  // ── UPLOAD PHASE ──────────────────────────────────────────────────────────
  if (phase === "upload") return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--background)", color: "var(--text)" }}>
      <div className="h-[72px] border-b px-8 flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>New Stems Project</h1>
          <p className="text-xs mt-0.5" style={{ color: accentColor }}>{workflowLabel}</p>
        </div>
        <button onClick={() => router.back()} className="px-4 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--border)", color: "var(--text)" }}>Cancel</button>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl space-y-6">

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Project Name *</label>
              <input type="text" placeholder="My Stems Session" value={projectName} onChange={e => setProjectName(e.target.value)}
                className="rounded-xl px-4 py-3 text-sm focus:outline-none transition border"
                style={{ backgroundColor: inputBg, borderColor: "var(--border)", color: "var(--text)" }}
                onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}/>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Genre</label>
              <input type="text" placeholder="Hip-Hop, Pop, Rock..." value={genre} onChange={e => setGenre(e.target.value)}
                className="rounded-xl px-4 py-3 text-sm focus:outline-none transition border"
                style={{ backgroundColor: inputBg, borderColor: "var(--border)", color: "var(--text)" }}
                onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}/>
            </div>
          </div>

          {/* Reference mix toggle */}
          <div className="rounded-xl p-4 flex items-center justify-between border" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Reference Mix <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span></p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Loaded muted in the DAW as a reference only. Not part of the signal chain.</p>
            </div>
            <button onClick={() => setHasRefMix(v => !v)}
              className="w-11 h-6 rounded-full border transition relative"
              style={{ borderColor: hasRefMix ? accentColor : "var(--border)", backgroundColor: hasRefMix ? accentColor + "30" : inputBg }}>
              <div className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                style={{ left: hasRefMix ? "20px" : "2px", backgroundColor: hasRefMix ? accentColor : "#52525b" }}/>
            </button>
          </div>

          {hasRefMix && (
            <div onClick={() => refMixInputRef.current?.click()}
              className="border border-dashed rounded-xl p-4 flex items-center gap-3 cursor-pointer transition"
              style={{ borderColor: "var(--border)" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = hoverBorder)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
              <span className="text-2xl">🎵</span>
              <div>
                <p className="text-sm" style={{ color: "var(--text)" }}>{refMixFile ? refMixFile.name : "Click to upload reference mix"}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>WAV, MP3, FLAC</p>
              </div>
              <input ref={refMixInputRef} type="file" accept="audio/*" className="hidden" onChange={e => setRefMixFile(e.target.files?.[0] ?? null)}/>
            </div>
          )}

          {/* Drop zone */}
          <div onDrop={onDrop} onDragOver={e => e.preventDefault()} onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-2xl p-16 flex flex-col items-center gap-4 cursor-pointer transition group"
            style={{ borderColor: "var(--border)" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = hoverBorder)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
            <div className="text-5xl group-hover:scale-110 transition">🎚️</div>
            <div className="text-center">
              <p className="text-lg font-semibold" style={{ color: "var(--text)" }}>Drop your stems here</p>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>WAV, MP3, FLAC, AIFF — multiple files supported</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Kick, Snare, Guitar, Vocals… all get auto-identified</p>
            </div>
            <div className="px-6 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: accentColor, color: "#000" }}>
              Browse Files
            </div>
            <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)}/>
          </div>
        </div>
      </div>
    </div>
  );

  // ── FINGERPRINTING PHASE ──────────────────────────────────────────────────
  if (phase === "fingerprinting") return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6" style={{ backgroundColor: "var(--background)", color: "var(--text)" }}>
      <div className="text-4xl">🔬</div>
      <div className="text-center">
        <p className="text-xl font-semibold" style={{ color: accentColor }}>Identifying Stems</p>
        <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>{fingerprintMsg}</p>
      </div>
      <div className="w-80 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${fingerprintPct}%`, backgroundColor: accentColor }}/>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{fingerprintPct}%</p>
    </div>
  );

  // ── SAVING PHASE ──────────────────────────────────────────────────────────
  if (phase === "saving") return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6" style={{ backgroundColor: "var(--background)", color: "var(--text)" }}>
      <div className="text-4xl">⬆️</div>
      <div className="text-center">
        <p className="text-xl font-semibold" style={{ color: accentColor }}>Saving Stems</p>
        <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>{saveMsg}</p>
      </div>
      <div className="w-80 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
        <div className="h-full rounded-full animate-pulse" style={{ width: "60%", backgroundColor: accentColor }}/>
      </div>
    </div>
  );

  // ── IDENTIFICATION POPUP PHASE ────────────────────────────────────────────
  const needsReviewCount = stems.filter(s => s.identification.needsReview && !s.overrideSection).length;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--background)", color: "var(--text)" }}>
      <div className="h-[72px] border-b px-8 flex items-center justify-between flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Stem Identification</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {stems.length} stems detected ·{" "}
            {needsReviewCount > 0
              ? <span style={{ color: "#FF6B4A" }}>{needsReviewCount} need review</span>
              : <span style={{ color: accentColor }}>All identified</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveMsg && <span className="text-sm" style={{ color: "#FF6B4A" }}>{saveMsg}</span>}
          <button onClick={() => { setPhase("upload"); setStems([]); }} className="px-4 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--border)", color: "var(--text)" }}>Start Over</button>
          <button onClick={handleConfirm} disabled={saving || !projectName.trim()}
            className="px-6 py-2 rounded-lg font-semibold text-sm disabled:opacity-40 transition"
            style={{ backgroundColor: accentColor, color: "#000" }}>
            {saving ? "Saving..." : "Confirm & Upload"}
          </button>
        </div>
      </div>

      {!projectName.trim() && (
        <div className="mx-8 mt-4 px-4 py-3 rounded-xl text-sm"
          style={{ backgroundColor: "#FF6B4A15", border: "1px solid #FF6B4A40", color: "#FF6B4A" }}>
          ⚠️ Enter a project name before confirming.
          <input type="text" placeholder="Project name..." value={projectName} onChange={e => setProjectName(e.target.value)}
            className="ml-4 bg-transparent border-b focus:outline-none text-sm"
            style={{ borderColor: "#FF6B4A", color: "var(--text)" }}/>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 gap-3 max-w-5xl mx-auto">
          {(["drums","instruments","vocals","other"] as StemSection[]).map(section => {
            const sectionStems = stems.filter(s => effectiveSection(s) === section);
            if (sectionStems.length === 0) return null;
            const color = sectionColors[section];
            return (
              <div key={section}>
                <div className="flex items-center gap-2 mb-2 mt-4">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}/>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{SECTION_LABELS[section]}</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>({sectionStems.length} stems)</span>
                </div>
                <div className="space-y-2">
                  {sectionStems.map(entry => {
                    const sec = effectiveSection(entry);
                    const slot = effectiveSlot(entry);
                    const col = sectionColors[sec];
                    const needsReview = entry.identification.needsReview && !entry.overrideSection;
                    return (
                      <div key={entry.id}
                        className="rounded-xl border p-4 flex items-center gap-4 transition"
                        style={{ backgroundColor: "var(--surface)", borderColor: needsReview ? "#FF6B4A60" : "var(--border)" }}>
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: needsReview ? "#FF6B4A" : accentColor }}/>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{entry.file.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: col + "20", color: col }}>
                              {SECTION_LABELS[sec]}
                            </span>
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {SLOT_LABELS[slot.replace(/_\d+$/, "")] ?? slot}
                              {entry.identification.slotIndex > 1 ? ` ${entry.identification.slotIndex}` : ""}
                            </span>
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>via {entry.identification.method}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0 w-20">
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {entry.identification.method === "unidentified" ? "Unknown" : `${Math.round(entry.identification.confidence * 100)}%`}
                          </span>
                          <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                            <div className="h-full rounded-full" style={{
                              width: `${entry.identification.confidence * 100}%`,
                              backgroundColor: entry.identification.confidence > 0.75 ? "#14D8C4" : entry.identification.confidence > 0.50 ? "#F0A500" : "#FF6B4A",
                            }}/>
                          </div>
                        </div>
                        <select value={sec} onChange={e => setSection(entry.id, e.target.value as StemSection)}
                          className="rounded-lg px-2 py-1.5 text-xs focus:outline-none flex-shrink-0 border"
                          style={{ backgroundColor: inputBg, borderColor: "var(--border)", color: "var(--text-muted)" }}>
                          {(["drums","instruments","vocals","other"] as StemSection[]).map(s => <option key={s} value={s}>{SECTION_LABELS[s]}</option>)}
                        </select>
                        <select value={slot.replace(/_\d+$/, "")} onChange={e => setSlot(entry.id, e.target.value)}
                          className="rounded-lg px-2 py-1.5 text-xs focus:outline-none flex-shrink-0 border"
                          style={{ backgroundColor: inputBg, borderColor: "var(--border)", color: "var(--text-muted)" }}>
                          {SLOT_OPTIONS[sec].map(s => <option key={s} value={s}>{SLOT_LABELS[s] ?? s}</option>)}
                          <option value="misc">Other</option>
                        </select>
                        <select
                          value={entry.mixRole}
                          onChange={e => setMixRole(entry.id, e.target.value as "main" | "supporting")}
                          className="rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none flex-shrink-0 transition border"
                          style={{
                            backgroundColor: inputBg,
                            borderColor: entry.mixRole === "main" ? accentColor : "var(--border)",
                            color: entry.mixRole === "main" ? accentColor : "var(--text-muted)",
                          }}
                        >
                          <option value="supporting">Supporting</option>
                          <option value="main">Main</option>
                        </select>
                        {entry.identification.runKeyDetection && (
                          <span className="text-[9px] border px-1.5 py-0.5 rounded flex-shrink-0" style={{ borderColor: "#14D8C440", color: "#14D8C4" }}>Key ✓</span>
                        )}
                        <button onClick={() => removeEntry(entry.id)} className="transition text-sm flex-shrink-0"
                          style={{ color: "var(--text-muted)" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#FF6B4A")}
                          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}>✕</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div onClick={() => fileInputRef.current?.click()}
            className="mt-6 border border-dashed rounded-xl p-6 flex items-center justify-center gap-3 cursor-pointer transition"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = hoverBorder; e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}>
            <span className="text-xl">+</span>
            <span className="text-sm">Add more stems</span>
            <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)}/>
          </div>
        </div>
      </div>
    </div>
  );
}