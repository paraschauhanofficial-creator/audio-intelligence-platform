"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { notifyStorageBlocked } from "@/lib/usageTracking";

export default function AIProjectPage() {
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
    params.set("workflow", "ai_assisted");
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
      if (stemsLocked) { setAudioType("stems_locked"); return; } // server-side-equivalent re-check before navigating
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
        workflow: "ai_assisted",
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

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="border-b border-[#1F2937] px-8 py-6">
        <h1 className="heading-brand text-xl font-bold">
          <span className="text-white">NOKASHI</span>
          <span className="text-[#00B7FF]"> STUDIOS</span>
        </h1>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-12">
        <h2 className="text-4xl font-bold mb-3">Create AI Assisted Project</h2>
        <p className="text-zinc-400 mb-10">Tell us about your project and let AI handle the production.</p>

        <div className="space-y-6">
          <div>
            <label className="block mb-2 text-sm text-zinc-400">Project Name</label>
            <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)}
              placeholder="My New Song"
              className="w-full bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3 outline-none focus:border-[#00B7FF]"/>
          </div>

          <div>
            <label className="block mb-2 text-sm text-zinc-400">Genre</label>
            <select value={genre} onChange={e => setGenre(e.target.value)}
              className="w-full bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3 outline-none focus:border-[#00B7FF]">
              <option value="">Select Genre</option>
              {["Pop","Rock","Hip Hop","EDM","Jazz","Classical","Podcast","Devotional","Film Score","Other"].map(g => <option key={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label className="block mb-2 text-sm text-zinc-400">Creative Direction</label>
            <textarea rows={6} value={creativeDirection} onChange={e => setCreativeDirection(e.target.value)}
              placeholder="Describe the sound, mood, instruments, references, vocal style, mix preferences, mastering target, etc."
              className="w-full bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3 outline-none focus:border-[#00B7FF]"/>
          </div>

          <div>
            <label className="block mb-3 text-sm text-zinc-400">Audio Upload</label>
            <div className="flex gap-6 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value="mix" checked={audioType === "mix"} onChange={e => setAudioType(e.target.value)}/>
                Final Mix
              </label>
              <label className={`flex items-center gap-2 ${stemsLocked ? "cursor-pointer opacity-60" : "cursor-pointer"}`}>
                <input
                  type="radio"
                  value="stems"
                  checked={audioType === "stems" || audioType === "stems_locked"}
                  onChange={handleStemsRadioChange}
                />
                Stems
                {stemsLocked && <Lock size={13} className="text-zinc-500" />}
              </label>
            </div>

            {audioType === "stems_locked" && (
              <div className="mb-4 flex items-center justify-between gap-4 bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3">
                <p className="text-sm text-zinc-400">
                  Stems uploads are a <span className="text-white">Pro</span> feature. Upgrade to identify, analyse, and auto-mix individual stems.
                </p>
                <button
                  onClick={() => router.push("/projects/upgrade")}
                  className="shrink-0 px-4 py-2 text-sm font-semibold bg-[#00B7FF] text-black rounded-lg"
                >
                  Upgrade
                </button>
              </div>
            )}

            {audioType === "mix" && (
              <>
                <input type="file" multiple accept=".wav,.mp3,.flac,.aiff,.zip"
                  onChange={e => setFiles(e.target.files ? Array.from(e.target.files) : [])}
                  className="w-full bg-[#111827] border border-[#1F2937] rounded-xl p-4"/>
                {files.length > 0 && (
                  <div className="mt-3">
                    <div className="text-green-400 mb-3">✓ {files.length} file(s) selected</div>
                    <div className="space-y-2">
                      {files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-[#111827] border border-[#1F2937] rounded-lg px-3 py-2">
                          <span className="text-sm">{file.name}</span>
                          <Trash2 size={16} onClick={() => setFiles(files.filter((_, i) => i !== index))}
                            className="text-zinc-400 hover:text-[#00B7FF] cursor-pointer transition"/>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {uploading && <div className="mt-2 text-[#00B7FF]">Uploading files...</div>}
                {uploadComplete && <div className="mt-2 text-green-400">✓ Upload Complete</div>}
              </>
            )}
          </div>

          <div className="flex gap-4">
            <button onClick={() => router.push("/projects")} className="px-6 py-3 border border-[#1F2937] rounded-xl">Cancel</button>
            <button onClick={handleCreateProject} className="px-6 py-3 bg-[#00B7FF] text-black font-semibold rounded-xl">Create Project</button>
          </div>
        </div>
      </div>
    </div>
  );
}