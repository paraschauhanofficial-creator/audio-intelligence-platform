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
import { analyzeAudio } from "@/intelligence/ears/audioAnalyzer";
import { auraMaster, encodeMp3 } from "@/intelligence/master/auraMaster";
import Navbar from "@/components/Navbar";

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const ENABLE_WAVEFORMS = false; // set to true after July 11th billing reset

  const [project, setProject] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [editing, setEditing] =
  useState(false);

  const [editName, setEditName] =
  useState("");

  const [editGenre, setEditGenre] =
  useState("");

  const [editPrompt, setEditPrompt] =
  useState("");
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

const analysisRunning = useRef(false);

const masterWaveformRef = useRef<HTMLDivElement>(null);
const masterWavesurferRef = useRef<any>(null);
const [masterPlaying, setMasterPlaying] = useState(false);
const [masterCurrentTime, setMasterCurrentTime] = useState("0:00");
const [masterDuration, setMasterDuration] = useState("0:00");

  const fileInputRef =
  useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProject();
  }, []);

  useEffect(() => {
    // Auto-trigger analysis if project was just uploaded
    // and analysis hasn't been run yet (no integrated_lufs means not analysed)
    if (
      project &&
      files.length > 0 &&
      project.processing_stage === "uploaded" &&
      project.integrated_lufs === null &&
      project.audio_type === "mix" &&
      !analysisRunning.current
    ) {
      analysisRunning.current = true;
      // Download the file from Supabase storage and run analysis
      const triggerAnalysis = async () => {
        const { data, error } = await supabase.storage
          .from("project-files")
          .createSignedUrl(files[0].file_path, 3600);

        if (error || !data) {
          console.error("[Aura Ears] Could not get file URL", error);
          return;
        }

        // Fetch the file as a File object
        const response = await fetch(data.signedUrl);
        const blob = await response.blob();
        const file = new File([blob], files[0].file_name, {
          type: files[0].file_type,
        });

        await runAudioAnalysis(file, project.id);
      };

      triggerAnalysis();
    }
  }, [project, files]);

  


  useEffect(() => {
  if (
    !ENABLE_WAVEFORMS ||
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

  useEffect(() => {
    if (
      !ENABLE_WAVEFORMS ||
      !project?.master_file_path ||
      !masterWaveformRef.current
    ) {
      return;
    }
    loadMasterWaveform();

    return () => {
      if (masterWavesurferRef.current) {
        masterWavesurferRef.current.destroy();
      }
    };
  }, [project?.master_file_path]);




  const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${secs
    .toString()
    .padStart(2, "0")}`;
};




const runMastering = async (
  file: File,
  projectId: string
) => {
  try {
    // Update progress — mastering started
    await supabase
      .from("projects")
      .update({
        progress: 50,
        current_task: "Mastering Audio...",
        processing_stage: "mastering",
      })
      .eq("id", projectId);

    await loadProject();

    console.log("[Aura Master] Starting...");
    const result = await auraMaster(file);
    console.log("[Aura Master] Complete", result);

    // Upload master WAV to Supabase Storage
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const masterPath = `${user.id}/masters/${projectId}-${Date.now()}-master.wav`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("project-files")
      .upload(masterPath, result.masterBlob, {
        contentType: "audio/wav",
        upsert: false,
      });

    if (uploadError) {
      console.error("[Aura Master] Upload failed", uploadError);
      return;
    }

    console.log("[Aura Master] Master uploaded to", uploadData.path);

    // Save master metrics and file path
    const { error } = await supabase
      .from("projects")
      .update({
        progress: 100,
        current_task: "Export Ready",
        processing_stage: "completed",
        status: "completed",
        master_file_path: uploadData.path,
        master_lufs: result.lufs,
        master_true_peak: result.truePeak,
        master_dynamic_range: result.dynamicRange,
        master_rms: result.rms,
        master_freq_sub: result.freqSub,
        master_freq_bass: result.freqBass,
        master_freq_low_mid: result.freqLowMid,
        master_freq_mid: result.freqMid,
        master_freq_high_mid: result.freqHighMid,
        master_freq_air: result.freqAir,
        master_stereo_correlation: result.stereoCorrelation,
        master_stereo_width: result.stereoWidth,
        master_input_gain: result.inputGain,
        master_low_shelf_gain: result.lowShelfGain,
        master_low_shelf_freq: result.lowShelfFreq,
        master_high_shelf_gain: result.highShelfGain,
        master_high_shelf_freq: result.highShelfFreq,
        master_saturation_drive: result.saturationDrive,
        master_limiter_ceiling: result.limiterCeiling,
        master_target_lufs: result.targetLUFS,
      })
      .eq("id", projectId);

    if (error) throw error;

    console.log("[Aura Master] Project updated with master data");

    await loadProject();

  } catch (error) {
    console.error("[Aura Master] Mastering Failed", error);
  }
};




const runAudioAnalysis = async (
  file: File,
  projectId: string
) => {
  try {
    // Step 1 — Mark analysis started
    await supabase
      .from("projects")
      .update({
        progress: 25,
        current_task: "Analysing Audio...",
        processing_stage: "analysing",
      })
      .eq("id", projectId);

    console.log("[Aura Ears] Running Analysis");
    const analysis = await analyzeAudio(file);
    console.log("[Aura Ears] Analysis Result", analysis);

    // Step 2 — Save all analysis results
    const { error } = await supabase
      .from("projects")
      .update({
        progress: 40,
        current_task: "Analysis Complete",
        processing_stage: "analysed",
        status: "processing",

        tempo: analysis.tempo,
        time_signature: analysis.timeSignature,
        musical_key: analysis.key,
        scale: analysis.scale,
        sample_rate: analysis.sampleRate,
        bitrate: analysis.bitrate,
        integrated_lufs: analysis.integratedLUFS,
        short_term_lufs: analysis.shortTermLUFS,
        momentary_lufs: analysis.momentaryLUFS,
        loudness_range: analysis.loudnessRange,
        true_peak: analysis.truePeak,
        sample_peak: analysis.samplePeak,
        average_peak: analysis.averagePeak,
        rms: analysis.rms,
        crest_factor: analysis.crestFactor,
        dynamic_range: analysis.dynamicRange,

        // Frequency analysis
        freq_sub: analysis.sub,
        freq_bass: analysis.bass,
        freq_low_mid: analysis.lowMid,
        freq_mid: analysis.mid,
        freq_high_mid: analysis.highMid,
        freq_air: analysis.air,

        // Stereo analysis
        stereo_correlation: analysis.correlation,
        stereo_width: analysis.stereoWidth,
      })
      .eq("id", projectId);

    if (error) throw error;

    console.log("[Aura Ears] Project Updated");

    // Step 3 — Run mastering engine
    await runMastering(file, projectId);

  } catch (error) {
    console.error("[Aura Ears] Analysis Failed", error);
  }
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







  const loadMasterWaveform = async () => {
  if (!project?.master_file_path) return;

  try {
    const { data, error } = await supabase.storage
      .from("project-files")
      .createSignedUrl(project.master_file_path, 3600);

    if (error) {
      console.error(error);
      return;
    }

    if (masterWavesurferRef.current) {
      masterWavesurferRef.current.destroy();
    }

    masterWavesurferRef.current = WaveSurfer.create({
      container: masterWaveformRef.current!,
      waveColor: "#3a2a00",
      progressColor: "#F0A500",
      cursorColor: "#F0A500",
      height: 80,
      barWidth: 2,
      barGap: 1,
    });

    masterWavesurferRef.current.on("ready", () => {
      setMasterDuration(
        formatTime(masterWavesurferRef.current.getDuration())
      );
    });

    masterWavesurferRef.current.on("timeupdate", () => {
      setMasterCurrentTime(
        formatTime(masterWavesurferRef.current.getCurrentTime())
      );
    });

    masterWavesurferRef.current.on("play", () => setMasterPlaying(true));
    masterWavesurferRef.current.on("pause", () => setMasterPlaying(false));

    try {
      await masterWavesurferRef.current.load(data.signedUrl);
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

    if (data.workflow === "ai_assisted_stems" || data.workflow === "producer_mode_stems") {
      if (!data.master_file_path) {
        router.push(`/projects/${params.id}/stems`);
        return;
      }
      // Master exists — show this page with results
    }
    setProject(data);

    setEditName(
  data.name || ""
);

setEditGenre(
  data.genre || ""
);

setEditPrompt(
  data.project_prompt || ""
);

    const expiryDate = new Date(data.expires_at);
    const today = new Date();

    const diffTime =
      expiryDate.getTime() - today.getTime();

    const diffDays = Math.max(
      0,
      Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    );

    setDaysRemaining(diffDays);

    // For stems projects load from project_stems, for mix load from project_files
    if (data.workflow === "ai_assisted_stems" || data.workflow === "producer_mode_stems") {
      const { data: stemFiles } = await supabase
        .from("project_stems")
        .select("id, original_name as file_name, file_path, file_type")
        .eq("project_id", params.id);
      setFiles(stemFiles || []);
    } else {
      const { data: projectFiles, error: filesError } = await supabase
        .from("project_files")
        .select("*")
        .eq("project_id", params.id);
      if (filesError) { console.error(filesError); return; }
      setFiles(projectFiles || []);
      console.log(projectFiles);
    }
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


setUploadedPreviewUrl("");
setUploadedPreviewName("");
setUploadedProgress(0);
setUploadedPlaying(false);

// Delete old master WAV from storage if exists
if (project.master_file_path) {
  await supabase.storage
    .from("project-files")
    .remove([project.master_file_path]);
}

// Reset master data so fresh analysis + mastering runs cleanly
await supabase
  .from("projects")
  .update({
    progress: 20,
    current_task: "Upload Complete — Starting Analysis",
    processing_stage: "uploaded",
    status: "processing",
    integrated_lufs: null,
    master_file_path: null,
    master_lufs: null,
    master_true_peak: null,
    master_dynamic_range: null,
    master_rms: null,
    master_freq_sub: null,
    master_freq_bass: null,
    master_freq_low_mid: null,
    master_freq_mid: null,
    master_freq_high_mid: null,
    master_freq_air: null,
    master_stereo_correlation: null,
    master_stereo_width: null,
    freq_sub: null,
    freq_bass: null,
    freq_low_mid: null,
    freq_mid: null,
    freq_high_mid: null,
    freq_air: null,
    stereo_correlation: null,
    stereo_width: null,
  })
  .eq("id", project.id);

// Reset analysisRunning so it can trigger again
analysisRunning.current = false;

// Reload immediately so UI shows reset state before analysis starts
await loadProject();

await runAudioAnalysis(newFile, project.id);
await loadProject();
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

setUploadedPreviewUrl("");
setUploadedPreviewName("");
setUploadedProgress(0);
setUploadedPlaying(false);
  
  loadProject();
};



const saveProjectDetails = async () => {

  const { error } =
    await supabase
      .from("projects")
      .update({
        name: editName,
        genre: editGenre,
        project_prompt: editPrompt,
      })
      .eq(
        "id",
        project.id
      );

  if (error) {
    alert(error.message);
    return;
  }

  setEditing(false);

  loadProject();
};








const accentColor =
  (project?.workflow === "producer_mode" || project?.workflow === "producer_mode_stems")
    ? "#14D8C4"
    : "#00B7FF";

const accentGlow =
  (project?.workflow === "producer_mode" || project?.workflow === "producer_mode_stems")
    ? "#14D8C4"
    : "#00B7FF";

const workflowLabel =
  (project?.workflow === "producer_mode" || project?.workflow === "producer_mode_stems")
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

      <Navbar accentColor={accentColor} />

      <div className="max-w-7xl mx-auto px-8 py-12">

        {/* Project Header */}

        <div className="flex flex-col lg:flex-row justify-between items-start gap-6 mb-8">

  <div>

  {editing ? (

    <input
      value={editName}
      onChange={(e) =>
        setEditName(
          e.target.value
        )
      }
      className="
        bg-[#111827]
        border border-[#1F2937]
        rounded-lg
        px-3 py-2
        text-3xl
        font-bold
        w-full
      "
    />

  ) : (

    <h2 className="text-4xl font-bold">
      {project.name}
    </h2>

  )}

  <p
    className="mt-2"
    style={{
      color: accentColor,
    }}
  >
    {workflowLabel}
  </p>

</div>


<div className="flex gap-2">



{(project.workflow === "producer_mode" || project.workflow === "producer_mode_stems") && (
  <button
    onClick={() =>
      router.push(
        `/projects/${project.id}/daw`
      )
    }
    className="
      px-4 py-2
      rounded-lg
      text-black
      font-semibold
    "
    style={{
      backgroundColor:
        accentColor,
    }}
  >
    Open DAW
  </button>
)}



  {editing ? (

    <button
      onClick={
        saveProjectDetails
      }
      className="
        px-4 py-2
        rounded-lg
        text-black
        font-semibold
      "
      style={{
        backgroundColor:
          accentColor,
      }}
    >
      Save
    </button>

  ) : (

    <button
      onClick={() =>
        setEditing(true)
      }
      className="
        px-4 py-2
        rounded-lg
        border
        border-[#1F2937]
      "
    >
      Edit
    </button>

  )}

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

        


<div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 mb-6">

  <h3 className="text-xl font-semibold mb-4">
    Project Details
  </h3>

  <div className="space-y-4">

    <div>
      <p className="text-xs text-zinc-500 mb-1">
        Genre
      </p>

      {editing ? (
        <select
          value={editGenre}
          onChange={(e) =>
            setEditGenre(
              e.target.value
            )
          }
          className="
            w-full
            bg-[#0A0A0A]
            border border-[#1F2937]
            rounded-lg
            px-3 py-2
          "
        >
          <option value="">Select Genre</option>
          <option>Pop</option>
          <option>Rock</option>
          <option>Hip Hop</option>
          <option>EDM</option>
          <option>Jazz</option>
          <option>Classical</option>
          <option>Devotional</option>
          <option>Film Score</option>
          <option>Other</option>
        </select>
      ) : (
        <p>{project.genre || "--"}</p>
      )}
    </div>

    <div>
      <p className="text-xs text-zinc-500 mb-1">
        Creative Direction
      </p>

      {editing ? (
        <textarea
          rows={5}
          value={editPrompt}
          onChange={(e) =>
            setEditPrompt(
              e.target.value
            )
          }
          className="
            w-full
            bg-[#0A0A0A]
            border border-[#1F2937]
            rounded-lg
            px-3 py-2
          "
        />
      ) : (
        <p className="text-zinc-400 whitespace-pre-wrap">
          {project.project_prompt ||
            "No creative direction provided"}
        </p>
      )}
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
  preload="none"
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

{/* Frequency & Stereo Analysis Cards */}
<div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-6 mb-6">

  {/* Frequency Spectrum Analysis */}
  <div className="bg-[#111827] border border-[#1F2937] rounded-2xl overflow-hidden">
    <div className="flex items-center justify-between mb-4 px-6 pt-6">
      <h3 className="text-xl font-semibold">Frequency Spectrum</h3>
      <div className="flex items-center gap-4 pr-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5 rounded-full" style={{ backgroundColor: accentColor }} />
              <span className="text-[10px] text-zinc-500">Original Mix</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5 rounded-full" style={{ backgroundColor: "#F0A500" }} />
              <span className="text-[10px] text-zinc-500">AI Master</span>
            </div>
          </div>
    </div>

    {(() => {
      const bands = [
        { label: "Sub",     freq: "40Hz",   mixKey: "freq_sub",      masterKey: "master_freq_sub"      },
        { label: "Bass",    freq: "130Hz",  mixKey: "freq_bass",     masterKey: "master_freq_bass"     },
        { label: "Low Mid", freq: "350Hz",  mixKey: "freq_low_mid",  masterKey: "master_freq_low_mid"  },
        { label: "Mid",     freq: "1kHz",   mixKey: "freq_mid",      masterKey: "master_freq_mid"      },
        { label: "High Mid",freq: "4kHz",   mixKey: "freq_high_mid", masterKey: "master_freq_high_mid" },
        { label: "Air",     freq: "13kHz",  mixKey: "freq_air",      masterKey: "master_freq_air"      },
      ];

      const W = 600;
      const H = 260;
      const PAD = { top: 16, right: 16, bottom: 32, left: 40 };
      const innerW = W - PAD.left - PAD.right;
      const innerH = H - PAD.top - PAD.bottom;

      const mixVals = bands.map(b => project[b.mixKey] as number | null);
      const masterVals = bands.map(b => project[b.masterKey] as number | null);
      const allVals = [...mixVals, ...masterVals].filter(v => v != null) as number[];

      const hasData = allVals.length > 0;
      const minDb = hasData ? Math.floor(Math.min(...allVals) - 5) : -80;
      const maxDb = hasData ? Math.ceil(Math.max(...allVals) + 5) : 0;
      const dbRange = maxDb - minDb || 1;

      // Map band index to X position (evenly spaced on log-like scale)
      const xPos = (i: number) => PAD.left + (i / (bands.length - 1)) * innerW;
      // Map dB value to Y position
      const yPos = (db: number) => PAD.top + ((maxDb - db) / dbRange) * innerH;

      // Build smooth SVG path using cubic bezier
      const buildPath = (vals: (number | null)[]) => {
        const points = vals
          .map((v, i) => v != null ? { x: xPos(i), y: yPos(v) } : null)
          .filter(Boolean) as { x: number; y: number }[];

        if (points.length < 2) return "";

        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[i];
          const p1 = points[i + 1];
          const cpx = (p0.x + p1.x) / 2;
          d += ` C ${cpx} ${p0.y}, ${cpx} ${p1.y}, ${p1.x} ${p1.y}`;
        }
        return d;
      };

      // Build filled area path (close to bottom)
      const buildArea = (vals: (number | null)[]) => {
        const points = vals
          .map((v, i) => v != null ? { x: xPos(i), y: yPos(v) } : null)
          .filter(Boolean) as { x: number; y: number }[];

        if (points.length < 2) return "";

        let d = `M ${points[0].x} ${PAD.top + innerH}`;
        d += ` L ${points[0].x} ${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[i];
          const p1 = points[i + 1];
          const cpx = (p0.x + p1.x) / 2;
          d += ` C ${cpx} ${p0.y}, ${cpx} ${p1.y}, ${p1.x} ${p1.y}`;
        }
        d += ` L ${points[points.length - 1].x} ${PAD.top + innerH} Z`;
        return d;
      };

      const mixPath = buildPath(mixVals);
      const masterPath = buildPath(masterVals);
      const mixArea = buildArea(mixVals);
      const masterArea = buildArea(masterVals);

      // dB grid lines
      const dbSteps = [];
      const step = Math.ceil(dbRange / 4);
      for (let db = Math.ceil(minDb / step) * step; db <= maxDb; db += step) {
        dbSteps.push(db);
      }

      return (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ background: "#0A0A0A", borderRadius: "12px" }}
        >
          {/* dB grid lines */}
          {dbSteps.map(db => (
            <g key={db}>
              <line
                x1={PAD.left} y1={yPos(db)}
                x2={PAD.left + innerW} y2={yPos(db)}
                stroke="#1F2937" strokeWidth="0.5"
              />
              <text
                x={PAD.left - 4} y={yPos(db) + 3}
                textAnchor="end" fontSize="9" fill="#4B5563"
              >
                {db}
              </text>
            </g>
          ))}

          {/* Frequency labels on X axis */}
          {bands.map((b, i) => (
            <text
              key={b.label}
              x={xPos(i)} y={H - 6}
              textAnchor="middle" fontSize="9" fill="#4B5563"
            >
              {b.freq}
            </text>
          ))}

          {/* Vertical band dividers */}
          {bands.map((_, i) => (
            <line
              key={i}
              x1={xPos(i)} y1={PAD.top}
              x2={xPos(i)} y2={PAD.top + innerH}
              stroke="#1F2937" strokeWidth="0.5"
            />
          ))}

          {/* Mix area fill */}
          {mixArea && (
            <path
              d={mixArea}
              fill={accentColor}
              fillOpacity="0.08"
            />
          )}

          {/* Master area fill */}
          {masterArea && (
            <path
              d={masterArea}
              fill="#F0A500"
              fillOpacity="0.08"
            />
          )}

          {/* Mix curve */}
          {mixPath && (
            <path
              d={mixPath}
              fill="none"
              stroke={accentColor}
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}

          {/* Master curve */}
          {masterPath && (
            <path
              d={masterPath}
              fill="none"
              stroke="#F0A500"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}

          {/* Data points — mix */}
          {mixVals.map((v, i) => v != null && (
            <circle
              key={i}
              cx={xPos(i)} cy={yPos(v)}
              r="3" fill={accentColor}
            />
          ))}

          {/* Data points — master */}
          {masterVals.map((v, i) => v != null && (
            <circle
              key={i}
              cx={xPos(i)} cy={yPos(v)}
              r="3" fill="#F0A500"
            />
          ))}

          {/* No data placeholder */}
          {!hasData && (
            <text
              x={W / 2} y={H / 2}
              textAnchor="middle" fontSize="12" fill="#4B5563"
            >
              Analysing...
            </text>
          )}
        </svg>
      );
    })()}
  </div>

  {/* Stereo Analysis — square card with Lissajous */}
  <div
    className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6"
    style={{ aspectRatio: "1 / 1" }}
  >
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-xl font-semibold">Stereo</h3>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-[10px] text-zinc-500 uppercase">Mix Width</p>
          <p className="text-sm font-semibold" style={{ color: accentColor }}>
            {project.stereo_width != null ? `${project.stereo_width.toFixed(1)}%` : "--"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-zinc-500 uppercase">Master Width</p>
          <p className="text-sm font-semibold" style={{ color: "#F0A500" }}>
            {project.master_stereo_width != null ? `${project.master_stereo_width.toFixed(1)}%` : "--"}
          </p>
        </div>
      </div>
    </div>

    {/* Lissajous Goniometer */}
    <div className="relative flex-1 flex flex-col items-center">
      <svg
        viewBox="-1.2 -1.2 2.4 2.4"
        className="w-full"
        style={{ maxHeight: "200px" }}
      >
        {/* Background grid */}
        <circle cx="0" cy="0" r="1" fill="none" stroke="#1F2937" strokeWidth="0.02" />
        <circle cx="0" cy="0" r="0.5" fill="none" stroke="#1F2937" strokeWidth="0.01" strokeDasharray="0.05 0.05" />
        {/* Axis lines */}
        <line x1="-1" y1="0" x2="1" y2="0" stroke="#1F2937" strokeWidth="0.02" />
        <line x1="0" y1="-1" x2="0" y2="1" stroke="#1F2937" strokeWidth="0.02" />
        {/* Diagonal guides */}
        <line x1="-0.7" y1="-0.7" x2="0.7" y2="0.7" stroke="#1F2937" strokeWidth="0.01" strokeDasharray="0.04 0.04" />
        <line x1="-0.7" y1="0.7" x2="0.7" y2="-0.7" stroke="#1F2937" strokeWidth="0.01" strokeDasharray="0.04 0.04" />

        {/* Labels */}
        <text x="0" y="-1.05" textAnchor="middle" fontSize="0.12" fill="#4B5563">L+R</text>
        <text x="0" y="1.18" textAnchor="middle" fontSize="0.12" fill="#4B5563">L+R</text>
        <text x="-1.1" y="0.04" textAnchor="middle" fontSize="0.12" fill="#4B5563">L</text>
        <text x="1.1" y="0.04" textAnchor="middle" fontSize="0.12" fill="#4B5563">R</text>

        {/* Correlation indicator — drawn as a dynamic ellipse */}
        {project.stereo_correlation != null && (() => {
          const mixCorr = Math.max(-1, Math.min(1, project.stereo_correlation));
          const mixWidth = Math.min(100, project.stereo_width ?? 0) / 100;
          const mixRx = Math.max(0.05, mixWidth * 0.8);
          const mixRy = Math.max(0.05, (1 - mixWidth * 0.5) * 0.8);

          const hasMaster = project.master_stereo_correlation != null;
          const masterCorr = hasMaster
            ? Math.max(-1, Math.min(1, project.master_stereo_correlation))
            : null;
          const masterWidth = hasMaster
            ? Math.min(100, project.master_stereo_width ?? 0) / 100
            : null;
          const masterRx = masterWidth != null ? Math.max(0.05, masterWidth * 0.8) : null;
          const masterRy = masterWidth != null ? Math.max(0.05, (1 - masterWidth * 0.5) * 0.8) : null;

          const phaseColor = (corr: number) =>
            corr > 0.3 ? accentColor : corr > 0 ? "#F0A500" : "#EF4444";

          return (
            <>
              {/* Original Mix ellipse — cyan */}
              <ellipse
                cx="0" cy="0"
                rx={mixRx} ry={mixRy}
                transform="rotate(-45)"
                fill={accentColor}
                fillOpacity="0.08"
                stroke={accentColor}
                strokeWidth="0.02"
                strokeOpacity="0.5"
              />

              {/* AI Master ellipse — amber gold */}
              {masterRx != null && masterRy != null && masterCorr != null && (
                <ellipse
                  cx="0" cy="0"
                  rx={masterRx} ry={masterRy}
                  transform="rotate(-45)"
                  fill="#F0A500"
                  fillOpacity="0.1"
                  stroke="#F0A500"
                  strokeWidth="0.025"
                  strokeOpacity="0.7"
                />
              )}

              {/* Center dot — master color if available */}
              <circle
                cx="0" cy="0" r="0.04"
                fill={masterCorr != null ? phaseColor(masterCorr) : phaseColor(mixCorr)}
              />
            </>
          );
        })()}

        {/* No data state */}
        {project.stereo_correlation == null && (
          <text x="0" y="0.05" textAnchor="middle" fontSize="0.15" fill="#4B5563">
            No Data
          </text>
        )}
      </svg>

      {/* Correlation meter below goniometer */}
      <div className="w-full mt-3">
        <div className="flex justify-between text-[9px] text-zinc-600 mb-1">
          <span>-1 Phase</span>
          <span>Correlation</span>
          <span>+1 Mono</span>
        </div>
        <div className="relative h-2 bg-[#0A0A0A] rounded-full overflow-hidden">
          <div
            className="absolute h-full rounded-full"
            style={{
              width: "50%",
              left: "50%",
              transform: "translateX(-50%)",
              backgroundColor: "#1F2937",
            }}
          />
          {project.stereo_correlation != null && (() => {
            const corr = Math.max(-1, Math.min(1, project.stereo_correlation));
            const pct = ((corr + 1) / 2) * 100;
            const color = corr > 0.3 ? accentColor : corr > 0 ? "#F0A500" : "#EF4444";
            return (
              <div
                className="absolute top-0 h-full w-1 rounded-full"
                style={{
                  left: `${pct}%`,
                  transform: "translateX(-50%)",
                  backgroundColor: color,
                  boxShadow: `0 0 6px ${color}`,
                }}
              />
            );
          })()}
        </div>
        {(() => {
          const corrVal = project.master_stereo_correlation ?? project.stereo_correlation;
          const corrColor = corrVal != null
            ? corrVal > 0.3 ? accentColor
            : corrVal > 0 ? "#F0A500"
            : "#EF4444"
            : "#6B7280";
          const label = project.master_stereo_correlation != null
            ? "Master" : "Mix";

          return (
            <div className="flex justify-between mt-2">
              <div>
                <p className="text-[9px] text-zinc-500">Correlation ({label})</p>
                <p className="text-xs font-semibold" style={{ color: corrColor }}>
                  {corrVal != null ? corrVal.toFixed(2) : "--"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-zinc-500">Phase</p>
                <p className="text-xs font-semibold" style={{ color: corrColor }}>
                  {corrVal != null
                    ? corrVal > 0.3 ? "Healthy"
                    : corrVal > 0 ? "Caution"
                    : "Phase Issue"
                    : "--"}
                </p>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  </div>

</div>

<div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 mb-6">

  <h3 className="text-xl font-semibold mb-6">
    Audio Preview
  </h3>

  {/* Original Mix */}
  {project.audio_type === "mix" && (
    <div className="mb-6">

      {/* Header row with metrics */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium">Original Mix</h4>

        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-[9px] text-zinc-500 uppercase mb-0.5">LUFS</p>
            <p className="text-sm font-semibold" style={{ color: accentColor }}>
              {project.integrated_lufs != null
                ? `${project.integrated_lufs.toFixed(1)}`
                : "--"}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-zinc-500 uppercase mb-0.5">True Peak</p>
            <p className="text-sm font-semibold" style={{ color: accentColor }}>
              {project.true_peak != null
                ? `${project.true_peak.toFixed(1)} dB`
                : "--"}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-zinc-500 uppercase mb-0.5">DR</p>
            <p className="text-sm font-semibold" style={{ color: accentColor }}>
              {project.dynamic_range != null
                ? `${project.dynamic_range.toFixed(1)}`
                : "--"}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-zinc-500 uppercase mb-0.5">RMS</p>
            <p className="text-sm font-semibold" style={{ color: accentColor }}>
              {project.rms != null
                ? `${project.rms.toFixed(1)}`
                : "--"}
            </p>
          </div>
        </div>
      </div>

      <div className="border border-[#1F2937] rounded-xl p-6">
        <div ref={waveformRef} className="w-full min-h-[140px]" />

        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => wavesurferRef.current?.playPause()}
            className="h-10 w-10 rounded-full flex items-center justify-center text-black font-bold hover:scale-105 transition"
            style={{
              backgroundColor: accentColor,
              boxShadow: `0 0 12px ${accentColor}`,
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

  {/* AI Assisted Master */}
  <div>
    <div className="flex items-center justify-between mb-3">
      <h4 className="font-medium">AI Assisted Master</h4>

      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="text-[9px] text-zinc-500 uppercase mb-0.5">LUFS</p>
          <p className="text-sm font-semibold" style={{ color: "#F0A500" }}>
            {project.master_lufs != null
              ? `${project.master_lufs.toFixed(1)}`
              : "--"}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-zinc-500 uppercase mb-0.5">True Peak</p>
          <p className="text-sm font-semibold" style={{ color: "#F0A500" }}>
            {project.master_true_peak != null
              ? `${project.master_true_peak.toFixed(1)} dB`
              : "--"}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-zinc-500 uppercase mb-0.5">DR</p>
          <p className="text-sm font-semibold" style={{ color: "#F0A500" }}>
            {project.master_dynamic_range != null
              ? `${project.master_dynamic_range.toFixed(1)}`
              : "--"}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-zinc-500 uppercase mb-0.5">RMS</p>
          <p className="text-sm font-semibold" style={{ color: "#F0A500" }}>
            {project.master_rms != null
              ? `${project.master_rms.toFixed(1)}`
              : "--"}
          </p>
        </div>
      </div>
    </div>

    {project.master_file_path ? (
      <div className="border border-[#1F2937] rounded-xl p-6">
        <div
          ref={masterWaveformRef}
          className="w-full min-h-[140px]"
        />

        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() =>
              masterWavesurferRef.current?.playPause()
            }
            className="h-10 w-10 rounded-full flex items-center justify-center text-black font-bold hover:scale-105 transition"
            style={{
              backgroundColor: "#F0A500",
              boxShadow: `0 0 12px #F0A500`,
            }}
          >
            {masterPlaying ? "❚❚" : "▶"}
          </button>

          <span className="text-sm text-zinc-400">
            {masterCurrentTime} / {masterDuration}
          </span>
        </div>
      </div>
    ) : (
      <div className="h-24 rounded-xl border border-[#1F2937] flex items-center justify-center text-zinc-500">
        Processing Not Complete
      </div>
    )}
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
      {project.master_file_path ? "Ready" : "Processing"}
    </span>

  </div>

  <p className="text-zinc-400 mb-6">
    {project.master_file_path
      ? "Your AI mastered files are ready to download."
      : "AI-generated files will appear here when processing is complete."}
  </p>

  <div className="space-y-3">

    {/* Master WAV */}
    <div className={`border border-[#1F2937] rounded-xl px-4 py-3 flex items-center justify-between ${!project.master_file_path ? "opacity-50" : ""}`}>
      <div>
        <p className="font-medium">Master WAV</p>
        <p className="text-xs text-zinc-500">High Quality Export</p>
      </div>

      <button
        disabled={!project.master_file_path}
        onClick={async () => {
          if (!project.master_file_path) return;
          const { data, error } = await supabase.storage
            .from("project-files")
            .createSignedUrl(project.master_file_path, 60);
          if (error || !data) return;

          // Fetch as blob to force download instead of browser open
          const response = await fetch(data.signedUrl);
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${project.name}-master.wav`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }}
        className="px-3 py-1 rounded-lg text-sm font-semibold"
        style={project.master_file_path ? {
          backgroundColor: accentColor,
          color: "#000",
        } : {
          backgroundColor: "#1F2937",
          color: "#6b7280",
        }}
      >
        Download
      </button>
    </div>

    {/* Master MP3 — coming soon */}
    <div className={`border border-[#1F2937] rounded-xl px-4 py-3 flex items-center justify-between ${!project.master_file_path ? "opacity-50" : ""}`}>
      <div>
        <p className="font-medium">Master MP3</p>
        <p className="text-xs text-zinc-500">Streaming Ready — 320kbps</p>
      </div>
      <button
        disabled={!project.master_file_path}
        onClick={async () => {
          if (!project.master_file_path) return;
          const { data, error } = await supabase.storage
            .from("project-files")
            .createSignedUrl(project.master_file_path, 60);
          if (error || !data) return;

          // Fetch the master WAV and re-encode as MP3
          const response = await fetch(data.signedUrl);
          const arrayBuffer = await response.arrayBuffer();
          const audioContext = new AudioContext();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const mp3Blob = await encodeMp3(audioBuffer);

          const url = URL.createObjectURL(mp3Blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${project.name}-master.mp3`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }}
        className="px-3 py-1 rounded-lg text-sm font-semibold"
        style={project.master_file_path ? {
          backgroundColor: accentColor,
          color: "#000",
        } : {
          backgroundColor: "#1F2937",
          color: "#6b7280",
        }}
      >
        Download
      </button>
    </div>

    {/* Instrumental WAV — coming soon */}
    <div className="border border-[#1F2937] rounded-xl px-4 py-3 flex items-center justify-between opacity-50">
      <div>
        <p className="font-medium">Instrumental WAV</p>
        <p className="text-xs text-zinc-500">Optional Export — Coming Soon</p>
      </div>
      <button disabled className="px-3 py-1 rounded-lg bg-[#1F2937] text-zinc-500 text-sm">
        Download
      </button>
    </div>

  </div>

</div>
</div>
      </div>
    
  );
  }