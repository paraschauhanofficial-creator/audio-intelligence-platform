"use client";

import { useEffect, useState, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import {
  Music2,
  Trash2,
  Plus,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();

  const [project, setProject] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<any>(null);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [duration, setDuration] = useState("0:00");
  const [isPlaying, setIsPlaying] =
  useState(false);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] =
  useState("");

  const [uploadedPreviewName, setUploadedPreviewName] =
  useState("");

  const uploadedAudioRef =
  useRef<HTMLAudioElement>(null);

const [uploadedPlaying, setUploadedPlaying] =
  useState(false);

const [uploadedProgress, setUploadedProgress] =
  useState(0);

  const fileInputRef =
  useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProject();
  }, []);

  


  useEffect(() => {
  if (
    project?.audio_type !== "mix" ||
    files.length === 0 ||
    !waveformRef.current
  ) {
    return;
  }





  loadWaveform();

 

  return () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }
  };
}, [files, project]);




  const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${secs
    .toString()
    .padStart(2, "0")}`;
};



const loadWaveform = async () => {
   if (!files[0]?.file_path) {
  return;
}
  try {
    const file = files[0];

    const { data, error } =
      await supabase.storage
        .from("project-files")
        .createSignedUrl(
          file.file_path,
          3600
        );

    if (error) {
      console.error(error);
      return;
    }

    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    wavesurferRef.current = WaveSurfer.create({
      container: waveformRef.current!,
      waveColor: "#1F2937",
      progressColor: accentColor,
      cursorColor: accentColor,
      height: 80,
      barWidth: 2,
      barGap: 1,
    });

    wavesurferRef.current.on("ready", () => {
  setDuration(
    formatTime(
      wavesurferRef.current.getDuration()
    )
  );
});

wavesurferRef.current.on("timeupdate", () => {
  setCurrentTime(
    formatTime(
      wavesurferRef.current.getCurrentTime()
    )
  );
});



wavesurferRef.current.on(
  "play",
  () => setIsPlaying(true)
);

wavesurferRef.current.on(
  "pause",
  () => setIsPlaying(false)
);



    try {
  await wavesurferRef.current.load(
    data.signedUrl
  );
} catch (err: any) {
  if (err?.name !== "AbortError") {
    console.error(err);
  }
}

} catch (err: any) {
  if (err?.name !== "AbortError") {
    console.error(err);
  }
}
};







  const loadProject = async () => {

    
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    setProject(data);

    const expiryDate = new Date(data.expires_at);
    const today = new Date();

    const diffTime =
      expiryDate.getTime() - today.getTime();

    const diffDays = Math.max(
      0,
      Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    );

    setDaysRemaining(diffDays);

    const {
      data: projectFiles,
      error: filesError,
    } = await supabase
      .from("project_files")
      .select("*")
      .eq("project_id", params.id);

    if (filesError) {
      console.error(filesError);
      return;
    }

    setFiles(projectFiles || []);
    console.log(projectFiles);
  };



  const previewUploadedFile = async (
  filePath: string,
  fileName: string
) => {
  const { data, error } =
    await supabase.storage
      .from("project-files")
      .createSignedUrl(
        filePath,
        3600
      );

  if (error) {
    console.error(error);
    return;
  }

  setUploadedPreviewUrl(
    data.signedUrl
  );

  setUploadedPreviewName(
    fileName
  );
};




const addFilesToProject = async (
  event: React.ChangeEvent<HTMLInputElement>
) => {

  const selectedFiles =
    event.target.files;

  if (
    !selectedFiles ||
    !project
  ) {
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  // MIX PROJECT
  if (
    project.audio_type === "mix"
  ) {

    const newFile =
      selectedFiles[0];

    if (!newFile) {
      return;
    }

    // delete existing files
    for (const oldFile of files) {

      await supabase.storage
        .from("project-files")
        .remove([
          oldFile.file_path,
        ]);

      await supabase
        .from("project_files")
        .delete()
        .eq(
          "id",
          oldFile.id
        );
    }

    const filePath =
      `${user.id}/${Date.now()}-${newFile.name}`;

    const {
      data,
      error,
    } = await supabase.storage
      .from("project-files")
      .upload(
        filePath,
        newFile
      );

    if (error) {
      alert(error.message);
      return;
    }

    const {
      error: insertError,
    } = await supabase
      .from("project_files")
      .insert({
        project_id:
          project.id,
        user_id:
          user.id,
        file_name:
          newFile.name,
        file_path:
          data.path,
        file_type:
          newFile.type,
      });

    if (insertError) {
      alert(
        insertError.message
      );
      return;
    }

    loadProject();
    return;
  }

  // STEMS PROJECT

  const uploadedRows = [];

  for (const file of Array.from(selectedFiles)) {

    const filePath =
      `${user.id}/${Date.now()}-${file.name}`;

    const {
      data,
      error,
    } = await supabase.storage
      .from("project-files")
      .upload(
        filePath,
        file
      );

    if (error) {
      alert(error.message);
      return;
    }

    uploadedRows.push({
      project_id:
        project.id,
      user_id:
        user.id,
      file_name:
        file.name,
      file_path:
        data.path,
      file_type:
        file.type,
    });
  }

  const { error } =
    await supabase
      .from("project_files")
      .insert(
        uploadedRows
      );

  if (error) {
    alert(error.message);
    return;
  }

  loadProject();
};






const deleteFile = async (
  fileId: string
) => {

  const confirmed =
    confirm(
      "Remove this file?"
    );

  if (!confirmed) {
    return;
  }

  const fileToDelete =
    files.find(
      (file) =>
        file.id === fileId
    );

  if (!fileToDelete) {
    return;
  }

  const {
    error: storageError,
  } = await supabase.storage
    .from("project-files")
    .remove([
      fileToDelete.file_path,
    ]);

  if (storageError) {
    console.error(
      storageError
    );
  }

  const { error } =
    await supabase
      .from("project_files")
      .delete()
      .eq(
        "id",
        fileId
      );

  if (error) {
    alert(
      error.message
    );
    return;
  }

  loadProject();
};


const accentColor =
  project?.workflow === "producer_mode"
    ? "#14D8C4"
    : "#00B7FF";

const accentGlow =
  project?.workflow === "producer_mode"
    ? "#14D8C4"
    : "#00B7FF";

const workflowLabel =
  project?.workflow === "producer_mode"
    ? "Producer Mode"
    : "AI Assisted";


  if (!project) {

    

    
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">

      {/* Header */}

      <div className="border-b border-[#1F2937] px-8 py-6">

  <div className="flex items-center justify-between">

    <h1 className="heading-brand text-xl font-bold">
      <span className="text-white">NOKASHI</span>
      <span className="text-[#00B7FF]"> STUDIOS</span>
    </h1>

    <div className="flex items-center gap-3">

  <button
    onClick={() => router.push("/projects")}
    className="px-4 py-2 rounded-lg border border-[#1F2937] hover:border-[#00B7FF]"
  >
    Home
  </button>

  <button
    onClick={() => router.push("/projects/list")}
    className="px-4 py-2 rounded-lg border border-[#1F2937] hover:border-[#00B7FF]"
  >
    My Projects
  </button>

  <button
    onClick={async () => {
      await supabase.auth.signOut();
      router.push("/login");
    }}
    className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400"
  >
    Logout
  </button>

</div>

  </div>

</div>

      <div className="max-w-7xl mx-auto px-8 py-12">

        {/* Project Header */}

        <div className="flex flex-col lg:flex-row justify-between items-start gap-6 mb-8">

  <div>
    <h2 className="text-4xl font-bold">
      {project.name}
    </h2>

    <p
  className="mt-2"
  style={{
    color: accentColor,
  }}
>
  {workflowLabel}
</p>
  </div>



<div className="
bg-[#111827]
border border-[#1F2937]
rounded-xl
px-5 py-2
w-full
max-w-[320px]
">

  <div className="grid grid-cols-3 gap-4 text-center">

  <div>
    <p className="text-[10px] text-zinc-500 uppercase">
      Tempo
    </p>

    <p
  className="text-xl font-semibold"
  style={{
    color: accentColor,
  }}
>
      {project.tempo || "--"}
    </p>
  </div>

  <div>
    <p className="text-[10px] text-zinc-500 uppercase">
      Signature
    </p>

    <p
  className="text-xl font-semibold"
  style={{
    color: accentColor,
  }}
>
      {project.time_signature || "--"}
    </p>
  </div>

  <div>
    <p className="text-[10px] text-zinc-500 uppercase">
      Key
    </p>

    <p
  className="text-xl font-semibold"
  style={{
    color: accentColor,
  }}
>
      {project.musical_key
        ? `${project.musical_key} ${project.scale || ""}`
        : "--"}
    </p>
  </div>

</div>



  <div className="mt-3 pt-2 border-t border-[#1F2937]">

    <div className="flex items-center justify-center gap-3 text-[9.5px] text-zinc-500">

  <span>
    {project.sample_rate
      ? `${project.sample_rate / 1000} kHz`
      : "--"}
  </span>

  <span>•</span>

  <span>
    {project.bitrate
      ? `${Math.round(project.bitrate / 1000)} kbps`
      : "--"}
  </span>

</div>

  </div>

</div>





  <div className="grid grid-cols-3 gap-3 w-full lg:w-[420px]">

    <div className="bg-[#111827] border border-[#1F2937] rounded-xl px-5 py-3">
      <p className="text-xs text-zinc-400">
        Files
      </p>

      <p className="text-lg font-semibold">
        {files.length}
      </p>
    </div>

    <div className="bg-[#111827] border border-[#1F2937] rounded-xl px-5 py-3">
      <p className="text-xs text-zinc-400">
        Days Left
      </p>

      <p className="text-lg font-semibold">
        {daysRemaining}
      </p>
    </div>

    <div className="bg-[#111827] border border-[#1F2937] rounded-xl px-5 py-3">
      <p className="text-xs text-zinc-400">
        Workflow
      </p>

      <p
  className="text-sm font-semibold"
  style={{
    color: accentColor,
  }}
>
  {workflowLabel}
</p>
    </div>

  </div>

</div>

        

        

        {/* Uploaded Files */}

        <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-6 mb-6">

  {/* Progress */}

  <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6">

    <div className="flex justify-between mb-4">

      <h3 className="text-xl font-semibold">
        Processing Status
      </h3>

      <span
  className="px-3 py-1 rounded-full text-sm"
  style={{
    backgroundColor: `${accentColor}20`,
    color: accentColor,
       }}
       >
  {project.status
    ?.split("_")
    .map(
      (word: string) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ")}
</span>

    </div>

    <div className="w-full bg-[#1F2937] rounded-full h-4">
      <div
  className="h-4 rounded-full"
  style={{
          backgroundColor: accentColor,
          width: `${project.progress || 0}%`,
        }}
      />
    </div>

    <div className="grid grid-cols-5 mt-4 text-center text-xs text-zinc-400">

      <span>Upload</span>
      <span>Analysis</span>
      <span>Mixing</span>
      <span>Mastering</span>
      <span>Export Ready</span>

    </div>

    <div className="mt-5 flex justify-between items-center">

  <p className="font-medium">
    {project.current_task}
  </p>

  <p
  className="text-2xl font-bold"
  style={{
    color: accentColor,
  }}
>
    {project.progress}%
  </p>

</div>

  </div>

  {/* Uploaded Files */}

  <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6">

    <div className="flex items-center justify-between mb-4">

  <h3 className="text-xl font-semibold">
    Uploaded Files
  </h3>

  <button
  onClick={() =>
    fileInputRef.current?.click()
  }
  className="
    flex items-center gap-2
    text-sm
    text-zinc-400
    hover:opacity-80
    transition
  "
>
  <Plus size={16} />

  {project.audio_type === "mix"
    ? "Replace"
    : "Files"}
</button>


<input
  ref={fileInputRef}
  type="file"
  multiple
  className="hidden"
  onChange={
    addFilesToProject
  }
/>


</div>

    <div className="max-h-[350px] overflow-y-auto space-y-3">

      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center justify-between border border-[#1F2937] rounded-lg px-3 py-3"
        >
          <p className="text-sm truncate">
            {file.file_name}
          </p>

          <div className="flex items-center gap-3">




  <div className="flex items-center gap-3">

  <button
    onClick={() =>
      previewUploadedFile(
        file.file_path,
        file.file_name
      )
    }
    className="text-xs hover:underline"
style={{
  color: accentColor,
}}
  >
    Preview
  </button>

  <Trash2
    size={16}
    onClick={() =>
      deleteFile(file.id)
    }
    className="
      text-zinc-400
      hover:opacity-80
      cursor-pointer
      transition
    "
  />

</div>

  

</div>




        </div>
      ))}

    </div>


{uploadedPreviewUrl && (

  <div className="mt-5 pt-5 border-t border-[#1F2937]">

    <div className="flex items-center gap-2 mb-3">

    <span className="text-xs text-zinc-500">
      Now Playing
    </span>

    <span className="text-sm" style={{ color: accentColor }}>
      {uploadedPreviewName}
    </span>

  </div>

  <audio
  ref={uploadedAudioRef}
  src={uploadedPreviewUrl}
  className="hidden"
  onTimeUpdate={() => {
    if (!uploadedAudioRef.current)
      return;

    const progress =
      (uploadedAudioRef.current.currentTime /
        uploadedAudioRef.current.duration) *
      100;

    setUploadedProgress(
      isNaN(progress)
        ? 0
        : progress
    );
  }}
  onPlay={() =>
    setUploadedPlaying(true)
  }
  onPause={() =>
    setUploadedPlaying(false)
  }
/>

<div className="flex items-center gap-3">

  <button
    onClick={() => {
  if (!uploadedAudioRef.current)
    return;

  if (
    uploadedAudioRef.current.paused
  ) {
    uploadedAudioRef.current.play();
  } else {
    uploadedAudioRef.current.pause();
  }
}}
  >
    {uploadedPlaying
  ? "❚❚"
  : "▶"}
  </button>

  <div
  className="flex-1 h-[4px] bg-[#1F2937] rounded-full relative cursor-pointer"
  onClick={(e) => {
    if (!uploadedAudioRef.current) return;

    const rect =
      e.currentTarget.getBoundingClientRect();

    const percent =
      (e.clientX - rect.left) /
      rect.width;

    uploadedAudioRef.current.currentTime =
      uploadedAudioRef.current.duration *
      percent;
  }}
>

  <div
    className="h-full rounded-full"
    style={{
      width: `${uploadedProgress}%`,
      backgroundColor: accentColor,
    }}
  />

  <div
    className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full"
    style={{
      left: `calc(${uploadedProgress}% - 6px)`,
      backgroundColor: accentColor,
      boxShadow: `0 0 8px ${accentColor}`,
    }}
  />

</div>

</div>

</div>

)}



  </div>

</div>

<div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 mb-6">

  <h3 className="text-xl font-semibold mb-6">
    Audio Preview
  </h3>

  {project.audio_type === "mix" && (

    <div className="mb-6">

      <div className="flex items-center justify-between mb-3">

        <h4 className="font-medium">
          Original Mix
        </h4>

        <span className="text-xs text-zinc-500">
          Source Audio
        </span>

      </div>

      <div className="border border-[#1F2937] rounded-xl p-6">

  <div
    ref={waveformRef}
    className="w-full min-h-[140px]"
  />

  <div className="flex items-center justify-between mt-4">

    <button
  onClick={() => {
    if (!uploadedAudioRef.current)
      return;

    if (
      uploadedAudioRef.current.paused
    ) {
      uploadedAudioRef.current.play();
    } else {
      uploadedAudioRef.current.pause();
    }
  }}
  className="
    h-8
    w-8
    rounded-full
    flex
    items-center
    justify-center
    text-black
    font-bold
    transition
    hover:scale-105
  "
  style={{
    backgroundColor: accentColor,
    boxShadow: `0 0 10px ${accentColor}`,
  }}
>
  {isPlaying ? "❚❚" : "▶"}
</button>

    <span className="text-sm text-zinc-400">
      {currentTime} / {duration}
    </span>

  </div>

</div>

    </div>

  )}

  <div>

    <div className="flex items-center justify-between mb-3">

      <h4 className="font-medium">
        AI Assisted Master
      </h4>

      <span className="text-xs text-zinc-500">
        Processed Output
      </span>

    </div>

    <div className="h-24 rounded-xl border border-[#1F2937] flex items-center justify-center text-zinc-500">
      Processing Not Complete
    </div>

  </div>

</div>


          

        

        {/* Downloads */}

        {/* Generated Output */}

<div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6">

  <div className="flex items-center justify-between mb-4">

    <h3 className="text-xl font-semibold">
      Generated Output
    </h3>

    <span className="text-xs px-3 py-1 rounded-full" style={{
          backgroundColor: `${accentColor}20`,
          color: accentColor,
     }}>
      Coming Soon
    </span>

  </div>

  <p className="text-zinc-400 mb-6">
    AI-generated files will appear here when processing is complete.
  </p>

  <div className="space-y-3">

    <div className="border border-[#1F2937] rounded-xl px-4 py-3 flex items-center justify-between opacity-50">

      <div>
        <p className="font-medium">
          Master WAV
        </p>

        <p className="text-xs text-zinc-500">
          High Quality Export
        </p>
      </div>

      <button
        disabled
        className="px-3 py-1 rounded-lg bg-[#1F2937] text-zinc-500 text-sm"
      >
        Download
      </button>

    </div>

    <div className="border border-[#1F2937] rounded-xl px-4 py-3 flex items-center justify-between opacity-50">

      <div>
        <p className="font-medium">
          Master MP3
        </p>

        <p className="text-xs text-zinc-500">
          Streaming Ready
        </p>
      </div>

      <button
        disabled
        className="px-3 py-1 rounded-lg bg-[#1F2937] text-zinc-500 text-sm"
      >
        Download
      </button>

    </div>

    <div className="border border-[#1F2937] rounded-xl px-4 py-3 flex items-center justify-between opacity-50">

      <div>
        <p className="font-medium">
          Instrumental WAV
        </p>

        <p className="text-xs text-zinc-500">
          Optional Export
        </p>
      </div>

      <button
        disabled
        className="px-3 py-1 rounded-lg bg-[#1F2937] text-zinc-500 text-sm"
      >
        Download
      </button>

    </div>

  </div>

</div>
</div>
      </div>
    
  );
  }