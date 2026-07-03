"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { notifyStorageBlocked } from "@/lib/usageTracking";
import AudioBackground from "@/components/AudioBackground";
import Navbar from "@/components/Navbar";

export default function ProducerProjectPage() {
  const router = useRouter();

  const [projectName, setProjectName] = useState("");
  const [genre, setGenre] = useState("");
  const [creativeDirection, setCreativeDirection] = useState("");
  const [audioType, setAudioType] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);

  // Plan gating — Stems workflow is Pro/Studio only.
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [planLoaded, setPlanLoaded] = useState(false);
  const stemsLocked = planLoaded && userPlan === "free";

  // Theme — identical pattern to every other migrated page (see projects/page.tsx)
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const saved = localStorage.getItem("nokashi-theme");
    setIsDarkMode(saved !== "light");
    const observer = new MutationObserver(() => {
      setIsDarkMode(!document.documentElement.classList.contains("theme-light"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * -20;
      const y = (e.clientY / window.innerHeight - 0.5) * -14;
      setParallax({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPlanLoaded(true); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, role")
        .eq("id", user.id)
        .single();
      // admin/super_user bypass the Free-plan restriction entirely
      const effectivePlan =
        profile?.role === "admin" || profile?.role === "super_user"
          ? "unlimited"
          : profile?.plan ?? "free";
      setUserPlan(effectivePlan);
      setPlanLoaded(true);
    })();
  }, []);

  const goToStemsFlow = () => {
    const params = new URLSearchParams();
    if (projectName) params.set("name", projectName);
    if (genre) params.set("genre", genre);
    params.set("workflow", "producer_mode");
    router.push(`/projects/create/stems?${params.toString()}`);
  };

  const handleStemsRadioChange = () => {
    if (stemsLocked) {
      // Don't navigate — keep their typed name/genre, just surface the upgrade prompt.
      setAudioType("stems_locked");
      return;
    }
    setAudioType("stems");
    goToStemsFlow();
  };

  const uploadFiles = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert("Please login first"); return []; }
    setUploading(true);
    const uploadedFiles = [];
    for (const file of files) {
      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from("project-files").upload(filePath, file);
      if (error) { alert(error.message); setUploading(false); return []; }
      uploadedFiles.push({ file_name: file.name, file_path: data.path, file_type: file.type, file_size: file.size });
    }
    setUploading(false);
    setUploadComplete(true);
    return uploadedFiles;
  };

  const handleCreateProject = async () => {
    if (!audioType || audioType === "stems_locked") { alert("Please select Mix or Stems"); return; }

    // Stems → redirect to dedicated stems upload flow, passing workflow + name + genre
    if (audioType === "stems") {
      if (stemsLocked) { setAudioType("stems_locked"); return; } // re-check before navigating
      goToStemsFlow();
      return;
    }

    if (files.length === 0) { alert("Please select files"); return; }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { alert("No user found"); return; }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const uploadedFiles = await uploadFiles();
      if (uploadedFiles.length === 0) return;

      const { data, error } = await supabase.from("projects").insert({
        user_id: user.id,
        name: projectName,
        workflow: "producer_mode",
        genre,
        audio_type: audioType,
        project_prompt: creativeDirection,
        status: "processing",
        progress: 20,
        current_task: "Upload Complete — Starting Analysis",
        processing_stage: "uploaded",
        expires_at: expiresAt.toISOString(),
      }).select();

      if (error) { alert(error.message); return; }

      const projectId = data[0].id;
      const fileRows = uploadedFiles.map(file => ({
        project_id: projectId, user_id: user.id,
        file_name: file.file_name, file_path: file.file_path, file_type: file.file_type,
        file_size: (file as any).file_size,
      }));

      const { error: fileError } = await supabase.from("project_files").insert(fileRows);
      if (fileError) {
        console.error(fileError);
        if (fileError.message?.includes("row-level security")) {
          alert("You've reached your plan's storage limit. Delete older projects or upgrade your plan to keep uploading.");
          notifyStorageBlocked();
        } else {
          alert(fileError.message);
        }
        await supabase.storage.from("project-files").remove(fileRows.map((r: any) => r.file_path));
        return;
      }

      router.push(`/projects/${projectId}`);
    } catch (err) { console.error(err); alert("CHECK CONSOLE"); }
  };

  const inputBg = isDarkMode ? "#0A0A0A" : "rgba(255,255,255,0.6)";
  const ACCENT = "#14D8C4"; // producer page accent — distinct from AI page's #00B7FF

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: "var(--background)", color: "var(--text)" }}>
      <AudioBackground parallax={parallax} lightMode={!isDarkMode} />

      <div className="relative z-20">
        <Navbar accentColor={ACCENT} />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-8 py-12">
        <h2 className="text-4xl font-bold mb-3" style={{ color: "var(--text)" }}>Create Producer Project</h2>
        <p className="mb-10" style={{ color: "var(--text-muted)" }}>Start with an AI-generated mix and take full control of every aspect of the production process.</p>

        <div className="space-y-6">
          <div>
            <label className="block mb-2 text-sm" style={{ color: "var(--text-muted)" }}>Project Name</label>
            <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)}
              placeholder="My New Song"
              className="w-full rounded-xl px-4 py-3 outline-none border transition focus:border-[#14D8C4]"
              style={{ backgroundColor: inputBg, borderColor: "var(--border)", color: "var(--text)" }}/>
          </div>

          <div>
            <label className="block mb-2 text-sm" style={{ color: "var(--text-muted)" }}>Genre</label>
            <select value={genre} onChange={e => setGenre(e.target.value)}
              className="w-full rounded-xl px-4 py-3 outline-none border transition focus:border-[#14D8C4]"
              style={{ backgroundColor: inputBg, borderColor: "var(--border)", color: "var(--text)" }}>
              <option value="">Select Genre</option>
              {["Pop","Rock","Hip Hop","EDM","Jazz","Classical","Podcast","Devotional","Film Score","Other"].map(g => <option key={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label className="block mb-2 text-sm" style={{ color: "var(--text-muted)" }}>Creative Direction</label>
            <textarea rows={6} value={creativeDirection} onChange={e => setCreativeDirection(e.target.value)}
              placeholder="Describe the sound, mood, instruments, references, vocal style, mix preferences, mastering target, etc."
              className="w-full rounded-xl px-4 py-3 outline-none border transition focus:border-[#14D8C4]"
              style={{ backgroundColor: inputBg, borderColor: "var(--border)", color: "var(--text)" }}/>
          </div>

          <div>
            <label className="block mb-3 text-sm" style={{ color: "var(--text-muted)" }}>Audio Upload</label>
            <div className="flex gap-6 mb-4">
              <label className="flex items-center gap-2 cursor-pointer" style={{ color: "var(--text)" }}>
                <input type="radio" value="mix" checked={audioType === "mix"} onChange={e => setAudioType(e.target.value)}/>
                Final Mix
              </label>
              <label className={`flex items-center gap-2 ${stemsLocked ? "cursor-pointer opacity-60" : "cursor-pointer"}`} style={{ color: "var(--text)" }}>
                <input
                  type="radio"
                  value="stems"
                  checked={audioType === "stems" || audioType === "stems_locked"}
                  onChange={handleStemsRadioChange}
                />
                Stems
                {stemsLocked && <Lock size={13} style={{ color: "var(--text-muted)" }} />}
              </label>
            </div>

            {audioType === "stems_locked" && (
              <div className="mb-4 flex items-center justify-between gap-4 rounded-xl px-4 py-3 border backdrop-blur-sm"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Stems uploads are a <span style={{ color: "var(--text)" }}>Pro</span> feature. Upgrade to identify, analyse, and auto-mix individual stems.
                </p>
                <button
                  onClick={() => router.push("/projects/upgrade")}
                  className="shrink-0 px-4 py-2 text-sm font-semibold text-black rounded-lg"
                  style={{ backgroundColor: ACCENT }}
                >
                  Upgrade
                </button>
              </div>
            )}

            {audioType === "mix" && (
              <>
                <input type="file" multiple accept=".wav,.mp3,.flac,.aiff,.zip"
                  onChange={e => setFiles(e.target.files ? Array.from(e.target.files) : [])}
                  className="w-full rounded-xl p-4 border transition"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}/>
                {files.length > 0 && (
                  <div className="mt-3">
                    <div className="text-green-400 mb-3">✓ {files.length} file(s) selected</div>
                    <div className="space-y-2">
                      {files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between rounded-lg px-3 py-2 border"
                          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
                          <span className="text-sm" style={{ color: "var(--text)" }}>{file.name}</span>
                          <Trash2 size={16} onClick={() => setFiles(files.filter((_, i) => i !== index))}
                            className="cursor-pointer transition"
                            style={{ color: "var(--text-muted)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = ACCENT)}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}/>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {uploading && <div className="mt-2" style={{ color: ACCENT }}>Uploading files...</div>}
                {uploadComplete && <div className="mt-2 text-green-400">✓ Upload Complete</div>}
              </>
            )}
          </div>

          <div className="flex gap-4">
            <button onClick={() => router.push("/projects")} className="px-6 py-3 rounded-xl border transition"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}>Cancel</button>
            <button onClick={handleCreateProject} className="px-6 py-3 font-semibold rounded-xl text-black"
              style={{ backgroundColor: ACCENT }}>Create Project</button>
          </div>
        </div>
      </div>
    </div>
  );
}