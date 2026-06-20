"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AIProjectPage() {
  const router = useRouter();

  const [projectName, setProjectName] = useState("");
  const [genre, setGenre] = useState("");
  const [creativeDirection, setCreativeDirection] = useState("");


  const [audioType, setAudioType] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false); 






  const uploadFiles = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    alert("Please login first");
    return [];
  }

  setUploading(true);

  const uploadedFiles = [];

  for (const file of files) {
    const filePath = `${user.id}/${Date.now()}-${file.name}`;

    const { data, error } = await supabase.storage
      .from("project-files")
      .upload(filePath, file);

    if (error) {
      alert(error.message);
      setUploading(false);
      return [];
    }

    uploadedFiles.push({
      file_name: file.name,
      file_path: data.path,
      file_type: file.type,
    });
  }

  setUploading(false);
  setUploadComplete(true);

  return uploadedFiles;
};





  const handleCreateProject = async () => {


if (!audioType) {
  alert("Please select Mix or Stems");
  return;
}

if (files.length === 0) {
  alert("Please select files");
  return;
}



  try {
    

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    

    

    if (!user) {
      alert("No user found");
      return;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    


    const uploadedFiles = await uploadFiles();

if (uploadedFiles.length === 0) {
  return;
}



    const { data, error } = await supabase
      .from("projects")
      .insert({
  user_id: user.id,
  name: projectName,
  workflow: "ai_assisted",
  genre,
  audio_type: audioType,
  project_prompt: creativeDirection,
  status: "processing",
  progress: 15,
  current_task: "Waiting For AI Processing",
  processing_stage: "uploaded",
  expires_at: expiresAt.toISOString(),
})
      .select();

    

    if (error) {
  alert(error.message);
  return;
}

const projectId = data[0].id;

const fileRows = uploadedFiles.map((file) => ({
  project_id: projectId,
  user_id: user.id,
  file_name: file.file_name,
  file_path: file.file_path,
  file_type: file.file_type,
}));

const { error: fileError } = await supabase
  .from("project_files")
  .insert(fileRows);

if (fileError) {
  console.error(fileError);
  alert(fileError.message);
  return;
}

alert("PROJECT CREATED");

router.push(`/projects/${projectId}`);
  } catch (err) {
    console.error(err);
    alert("CHECK CONSOLE");
  }
};






  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <div className="border-b border-[#1F2937] px-8 py-6">
        <h1 className="heading-brand text-xl font-bold">
          <span className="text-white">NOKASHI</span>
          <span className="text-[#00B7FF]"> STUDIOS</span>
        </h1>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-12">
        <h2 className="text-4xl font-bold mb-3">
          Create AI Assisted Project
        </h2>

        <p className="text-zinc-400 mb-10">
          Tell us about your project and let AI handle the production.
        </p>

        <div className="space-y-6">
          {/* Project Name */}
          <div>
            <label className="block mb-2 text-sm text-zinc-400">
              Project Name
            </label>

            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="My New Song"
              className="w-full bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3 outline-none focus:border-[#00B7FF]"
            />
          </div>

          {/* Genre */}
          <div>
            <label className="block mb-2 text-sm text-zinc-400">
              Genre
            </label>

            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3 outline-none focus:border-[#00B7FF]"
            >
              <option value="">Select Genre</option>
              <option>Pop</option>
              <option>Rock</option>
              <option>Hip Hop</option>
              <option>EDM</option>
              <option>Jazz</option>
              <option>Classical</option>
              <option>Podcast</option>
              <option>Devotional</option>
              <option>Film Score</option>
              <option>Other</option>
            </select>
          </div>

          {/* Creative Direction */}
          <div>
            <label className="block mb-2 text-sm text-zinc-400">
              Creative Direction
            </label>

            <textarea
              rows={6}
              value={creativeDirection}
              onChange={(e) => setCreativeDirection(e.target.value)}
              placeholder="Describe the sound, mood, instruments, references, vocal style, mix preferences, mastering target, etc."
              className="w-full bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3 outline-none focus:border-[#00B7FF]"
            />
          </div>

        




          <div>
  <label className="block mb-3 text-sm text-zinc-400">
    Audio Upload
  </label>

  <div className="flex gap-6 mb-4">
    <label className="flex items-center gap-2">
      <input
        type="radio"
        value="mix"
        checked={audioType === "mix"}
        onChange={(e) => setAudioType(e.target.value)}
      />
      Final Mix
    </label>

    <label className="flex items-center gap-2">
      <input
        type="radio"
        value="stems"
        checked={audioType === "stems"}
        onChange={(e) => setAudioType(e.target.value)}
      />
      Stems
    </label>
  </div>

  <input
    type="file"
    multiple
    accept=".wav,.mp3,.flac,.aiff,.zip"
    onChange={(e) =>
      setFiles(
        e.target.files
          ? Array.from(e.target.files)
          : []
      )
    }
    className="w-full bg-[#111827] border border-[#1F2937] rounded-xl p-4"
  />

  {files.length > 0 && (
    <div className="mt-3 text-green-400">
      ✓ {files.length} file(s) selected
    </div>
  )}

  {uploading && (
  <div className="mt-2 text-[#00B7FF]">
    Uploading files...
  </div>
)}

{uploadComplete && (
  <div className="mt-2 text-green-400">
    ✓ Upload Complete
  </div>
)}


</div>





          {/* Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => router.push("/projects")}
              className="px-6 py-3 border border-[#1F2937] rounded-xl"
            >
              Cancel
            </button>

            <button
              onClick={handleCreateProject}
              className="px-6 py-3 bg-[#00B7FF] text-black font-semibold rounded-xl"
            >
              Create Project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}