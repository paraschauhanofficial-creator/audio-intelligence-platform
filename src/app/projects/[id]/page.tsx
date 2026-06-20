"use client";

import { useEffect, useState, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import { Music2 } from "lucide-react";

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
  const [uploadedPreviewUrl, setUploadedPreviewUrl] =
  useState("");

  const [uploadedPreviewName, setUploadedPreviewName] =
  useState("");

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
      progressColor: "#00B7FF",
      cursorColor: "#00B7FF",
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



    wavesurferRef.current.load(
      data.signedUrl
    );

  } catch (err) {
    console.error(err);
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

        <div className="flex flex-col lg:flex-row justify-between gap-6 mb-8">

  <div>
    <h2 className="text-4xl font-bold">
      {project.name}
    </h2>

    <p className="text-[#00B7FF] mt-2">
      AI Assisted
    </p>
  </div>

  <div className="grid grid-cols-3 gap-3 w-full lg:w-auto lg:w-[420px]">

    <div className="bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-2">
      <p className="text-xs text-zinc-400">
        Files
      </p>

      <p className="text-lg font-semibold">
        {files.length}
      </p>
    </div>

    <div className="bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-2">
      <p className="text-xs text-zinc-400">
        Days Left
      </p>

      <p className="text-lg font-semibold">
        {daysRemaining}
      </p>
    </div>

    <div className="bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-2">
      <p className="text-xs text-zinc-400">
        Workflow
      </p>

      <p className="text-sm font-semibold text-[#00B7FF]">
        AI Assisted
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

      <span className="px-3 py-1 rounded-full bg-[#00B7FF]/20 text-[#00B7FF] text-sm">
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
        className="bg-[#00B7FF] h-4 rounded-full"
        style={{
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

  <p className="text-2xl font-bold text-[#00B7FF]">
    {project.progress}%
  </p>

</div>

  </div>

  {/* Uploaded Files */}

  <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6">

    <h3 className="text-xl font-semibold mb-4">
      Uploaded Files
    </h3>

    <div className="max-h-[350px] overflow-y-auto space-y-3">

      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center justify-between border border-[#1F2937] rounded-lg px-3 py-3"
        >
          <p className="text-sm truncate">
            {file.file_name}
          </p>

          <button
            onClick={() =>
            previewUploadedFile(
            file.file_path,
            file.file_name
              )
           }
             className="text-xs text-[#00B7FF] hover:underline"
           >
             Preview
          </button>
        </div>
      ))}

    </div>


{uploadedPreviewUrl && (

  <div className="mt-5 pt-5 border-t border-[#1F2937]">

    <div className="flex items-center gap-2 mb-3">

    <span className="text-xs text-zinc-500">
      Now Playing
    </span>

    <span className="text-sm text-[#00B7FF] truncate">
      {uploadedPreviewName}
    </span>

  </div>

  <audio
    controls
    className="w-full"
  >
    <source src={uploadedPreviewUrl} />
  </audio>

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
      onClick={() =>
        wavesurferRef.current?.playPause()
      }
      className="px-4 py-2 rounded-lg bg-[#00B7FF] text-black font-medium hover:opacity-90"
    >
      Play / Pause
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

    <span className="text-xs px-3 py-1 rounded-full bg-[#00B7FF]/20 text-[#00B7FF]">
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