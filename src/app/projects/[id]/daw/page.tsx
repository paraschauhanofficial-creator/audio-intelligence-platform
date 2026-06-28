"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import WaveSurfer from "wavesurfer.js";
import { auraMaster } from "@/intelligence/master/auraMaster";

export default function DAWPage() {
  const router = useRouter();
  const params = useParams();

  const [project, setProject] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [audioUrls, setAudioUrls] = useState<{ [filePath: string]: string }>({});
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");

  // Plugin chain state — master
  const [inputGain, setInputGain] = useState(0);
  const [lowShelfGain, setLowShelfGain] = useState(-1.5);
  const [lowShelfFreq, setLowShelfFreq] = useState(100);
  const [highShelfGain, setHighShelfGain] = useState(1.5);
  const [highShelfFreq, setHighShelfFreq] = useState(10000);
  const [saturationDrive, setSaturationDrive] = useState(0.95);
  const [limiterCeiling, setLimiterCeiling] = useState(-1);
  const [targetLUFS, setTargetLUFS] = useState(-14);

  // Per-track state
  const [trackVolumes, setTrackVolumes] = useState<{ [track: string]: number }>({});
  const [trackPans, setTrackPans] = useState<{ [track: string]: number }>({});
  const [reverbSends, setReverbSends] = useState<{ [track: string]: number }>({});
  const [delaySends, setDelaySends] = useState<{ [track: string]: number }>({});

  // Inspector context
  const [inspectorContext, setInspectorContext] = useState<"master" | "track">("master");
  const [inspectorView, setInspectorView] = useState<"main" | "sends">("main");
  const [selectedPlugin, setSelectedPlugin] = useState<"gain" | "eq" | "saturation" | "limiter">("gain");

  const [selectedTrack, setSelectedTrack] = useState("");
  const [expandedView, setExpandedView] = useState<"none" | "timeline" | "mixer">("none");
  const [trackHeaderWidth, setTrackHeaderWidth] = useState(180);
  const [trackHeight, setTrackHeight] = useState(64);
  const [mutedTracks, setMutedTracks] = useState<string[]>([]);
  const [soloTrack, setSoloTrack] = useState<string | null>(null);

  // Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [duration, setDuration] = useState("0:00");
  const [playheadPct, setPlayheadPct] = useState(0);
  const durationSeconds = useRef(0);
  const [vuLevel, setVuLevel] = useState(0);

  // Web Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const lowShelfNodeRef = useRef<BiquadFilterNode | null>(null);
  const highShelfNodeRef = useRef<BiquadFilterNode | null>(null);
  const waveShaperNodeRef = useRef<WaveShaperNode | null>(null);
  const limiterNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const startTimeRef = useRef(0);
  const pauseOffsetRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const isDragging = useRef(false);
  const isResizingHeight = useRef(false);

  const waveformRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const wavesurferRefs = useRef<{ [key: string]: any }>({});

  const TRACKS = files.map(f => f.file_name.replace(/\.[^/.]+$/, ""));

  // Colors
  const trackColor = "#14D8C4";
  const sendColor = "#FF6B4A";
  const masterColor = "#F0A500";

  // Inspector accent — changes based on context
  const inspectorAccent =
    inspectorContext === "master" ? masterColor :
    inspectorView === "sends" ? sendColor :
    trackColor;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => { loadProject(); }, []);

  const loadProject = async () => {
    const { data, error } = await supabase
      .from("projects").select("*").eq("id", params.id).single();
    if (error) { console.error(error); return; }
    setProject(data);

    if (data.master_input_gain != null) setInputGain(data.master_input_gain);
    if (data.master_low_shelf_gain != null) setLowShelfGain(data.master_low_shelf_gain);
    if (data.master_low_shelf_freq != null) setLowShelfFreq(data.master_low_shelf_freq);
    if (data.master_high_shelf_gain != null) setHighShelfGain(data.master_high_shelf_gain);
    if (data.master_high_shelf_freq != null) setHighShelfFreq(data.master_high_shelf_freq);
    if (data.master_saturation_drive != null) setSaturationDrive(data.master_saturation_drive);
    if (data.master_limiter_ceiling != null) setLimiterCeiling(data.master_limiter_ceiling);
    if (data.master_target_lufs != null) setTargetLUFS(data.master_target_lufs);

    const { data: projectFiles } = await supabase
      .from("project_files").select("*").eq("project_id", params.id);

    if (projectFiles && projectFiles.length > 0) {
      setFiles(projectFiles);
      const firstName = projectFiles[0].file_name.replace(/\.[^/.]+$/, "");
      setSelectedTrack(firstName);

      // Init per-track state
      const vols: { [t: string]: number } = {};
      const pans: { [t: string]: number } = {};
      const revs: { [t: string]: number } = {};
      const dels: { [t: string]: number } = {};
      projectFiles.forEach(f => {
        const n = f.file_name.replace(/\.[^/.]+$/, "");
        vols[n] = 0; pans[n] = 0; revs[n] = 0; dels[n] = 0;
      });
      setTrackVolumes(vols);
      setTrackPans(pans);
      setReverbSends(revs);
      setDelaySends(dels);

      const urls: { [p: string]: string } = {};
      for (const file of projectFiles) {
        const { data: urlData } = await supabase.storage
          .from("project-files").createSignedUrl(file.file_path, 3600);
        if (urlData) urls[file.file_path] = urlData.signedUrl;
      }
      setAudioUrls(urls);
    }
  };

  useEffect(() => {
    if (Object.keys(audioUrls).length === 0 || files.length === 0) return;
    loadAudio(); loadWaveforms();
  }, [audioUrls, files]);

  useEffect(() => {
    if (Object.keys(audioUrls).length === 0 || files.length === 0) return;
    const t = setTimeout(() => loadWaveforms(), 150);
    return () => clearTimeout(t);
  }, [trackHeight]);

  const buildAudioGraph = useCallback((buffer: AudioBuffer) => {
    if (audioCtxRef.current) audioCtxRef.current.close();
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    audioBufferRef.current = buffer;
    durationSeconds.current = buffer.duration;
    setDuration(formatTime(buffer.duration));

    const gainNode = ctx.createGain();
    gainNode.gain.value = Math.pow(10, inputGain / 20);
    gainNodeRef.current = gainNode;

    const lowShelf = ctx.createBiquadFilter();
    lowShelf.type = "lowshelf";
    lowShelf.frequency.value = lowShelfFreq;
    lowShelf.gain.value = lowShelfGain;
    lowShelfNodeRef.current = lowShelf;

    const highShelf = ctx.createBiquadFilter();
    highShelf.type = "highshelf";
    highShelf.frequency.value = highShelfFreq;
    highShelf.gain.value = highShelfGain;
    highShelfNodeRef.current = highShelf;

    const waveShaper = ctx.createWaveShaper();
    waveShaper.curve = makeSoftClipCurve(saturationDrive);
    waveShaper.oversample = "4x";
    waveShaperNodeRef.current = waveShaper;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = limiterCeiling;
    limiter.knee.value = 0; limiter.ratio.value = 20;
    limiter.attack.value = 0.001; limiter.release.value = 0.1;
    limiterNodeRef.current = limiter;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserNodeRef.current = analyser;

    gainNode.connect(lowShelf);
    lowShelf.connect(highShelf);
    highShelf.connect(waveShaper);
    waveShaper.connect(limiter);
    limiter.connect(analyser);
    analyser.connect(ctx.destination);
  }, [inputGain, lowShelfFreq, lowShelfGain, highShelfFreq, highShelfGain, saturationDrive, limiterCeiling]);

  const loadAudio = async () => {
    const firstFile = files[0];
    const url = audioUrls[firstFile.file_path];
    if (!url) return;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const ctx = new AudioContext();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    ctx.close();
    buildAudioGraph(buffer);
  };

  const makeSoftClipCurve = (threshold: number): Float32Array => {
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      const abs = Math.abs(x);
      if (abs <= threshold) { curve[i] = x; }
      else {
        const sign = x > 0 ? 1 : -1;
        curve[i] = sign * (threshold + (1 - threshold) * Math.tanh((abs - threshold) / (1 - threshold)));
      }
    }
    return curve;
  };

  const loadWaveforms = async () => {
    Object.values(wavesurferRefs.current).forEach(ws => ws?.destroy());
    wavesurferRefs.current = {};
    for (const file of files) {
      const trackName = file.file_name.replace(/\.[^/.]+$/, "");
      const url = audioUrls[file.file_path];
      if (!url) continue;
      const container = waveformRefs.current[trackName];
      if (!container) continue;
      const ws = WaveSurfer.create({
        container, waveColor: "#14D8C430", progressColor: "#14D8C4",
        cursorWidth: 0, height: trackHeight, barWidth: 2, barGap: 1,
        interact: false, normalize: true,
      });
      try { await ws.load(url); } catch (err: any) { if (err?.name !== "AbortError") console.error(err); }
      wavesurferRefs.current[trackName] = ws;
    }
  };

  const startVUMeter = () => {
    const analyser = analyserNodeRef.current;
    if (!analyser) return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((s, v) => s + v, 0) / dataArray.length;
      setVuLevel(Math.min(100, (avg / 128) * 100));
      if (audioCtxRef.current && sourceNodeRef.current) {
        const elapsed = audioCtxRef.current.currentTime - startTimeRef.current + pauseOffsetRef.current;
        const pct = Math.min(1, elapsed / durationSeconds.current);
        setPlayheadPct(pct * 100);
        setCurrentTime(formatTime(elapsed));
        // Sync WaveSurfer progress
        Object.values(wavesurferRefs.current).forEach(ws => { try { ws?.seekTo(pct); } catch(e){} });
        if (elapsed >= durationSeconds.current) { stopPlayback(); return; }
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  };

  const startPlayback = () => {
    const ctx = audioCtxRef.current;
    const buffer = audioBufferRef.current;
    const gainNode = gainNodeRef.current;
    if (!ctx || !buffer || !gainNode) return;
    if (sourceNodeRef.current) { try { sourceNodeRef.current.stop(); } catch (e) {} }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);
    source.start(0, pauseOffsetRef.current);
    sourceNodeRef.current = source;
    startTimeRef.current = ctx.currentTime;
    setIsPlaying(true);
    startVUMeter();
  };

  const pausePlayback = () => {
    const ctx = audioCtxRef.current;
    if (!ctx || !sourceNodeRef.current) return;
    pauseOffsetRef.current += ctx.currentTime - startTimeRef.current;
    try { sourceNodeRef.current.stop(); } catch (e) {}
    sourceNodeRef.current = null;
    setIsPlaying(false);
    cancelAnimationFrame(animFrameRef.current);
    setVuLevel(0);
  };

  const stopPlayback = () => {
    if (sourceNodeRef.current) { try { sourceNodeRef.current.stop(); } catch (e) {} sourceNodeRef.current = null; }
    pauseOffsetRef.current = 0;
    setIsPlaying(false); setPlayheadPct(0); setCurrentTime("0:00");
    cancelAnimationFrame(animFrameRef.current); setVuLevel(0);
    Object.values(wavesurferRefs.current).forEach(ws => { try { ws?.seekTo(0); } catch(e){} });
  };

  const seekTo = (pct: number) => {
    const wasPlaying = isPlaying;
    if (wasPlaying) pausePlayback();
    pauseOffsetRef.current = pct * durationSeconds.current;
    setPlayheadPct(pct * 100);
    setCurrentTime(formatTime(pct * durationSeconds.current));
    Object.values(wavesurferRefs.current).forEach(ws => { try { ws?.seekTo(pct); } catch(e){} });
    if (wasPlaying) startPlayback();
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const waveAreaWidth = rect.width - trackHeaderWidth;
    const clickX = e.clientX - rect.left - trackHeaderWidth;
    if (clickX < 0) return;
    seekTo(Math.max(0, Math.min(1, clickX / waveAreaWidth)));
  };

  // Live param updates
  useEffect(() => {
    if (gainNodeRef.current)
      gainNodeRef.current.gain.setTargetAtTime(Math.pow(10, inputGain / 20), audioCtxRef.current?.currentTime || 0, 0.01);
  }, [inputGain]);
  useEffect(() => {
    if (lowShelfNodeRef.current) {
      lowShelfNodeRef.current.frequency.setTargetAtTime(lowShelfFreq, audioCtxRef.current?.currentTime || 0, 0.01);
      lowShelfNodeRef.current.gain.setTargetAtTime(lowShelfGain, audioCtxRef.current?.currentTime || 0, 0.01);
    }
  }, [lowShelfFreq, lowShelfGain]);
  useEffect(() => {
    if (highShelfNodeRef.current) {
      highShelfNodeRef.current.frequency.setTargetAtTime(highShelfFreq, audioCtxRef.current?.currentTime || 0, 0.01);
      highShelfNodeRef.current.gain.setTargetAtTime(highShelfGain, audioCtxRef.current?.currentTime || 0, 0.01);
    }
  }, [highShelfFreq, highShelfGain]);
  useEffect(() => {
    if (waveShaperNodeRef.current) waveShaperNodeRef.current.curve = makeSoftClipCurve(saturationDrive);
  }, [saturationDrive]);
  useEffect(() => {
    if (limiterNodeRef.current)
      limiterNodeRef.current.threshold.setTargetAtTime(limiterCeiling, audioCtxRef.current?.currentTime || 0, 0.01);
  }, [limiterCeiling]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (sourceNodeRef.current) try { sourceNodeRef.current.stop(); } catch (e) {}
      audioCtxRef.current?.close();
    };
  }, []);

  const startResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    isDragging.current = true;
    const startX = e.clientX; const startWidth = trackHeaderWidth;
    const onMove = (e: MouseEvent) => { if (!isDragging.current) return; setTrackHeaderWidth(Math.max(120, Math.min(300, startWidth + (e.clientX - startX)))); };
    const onUp = () => { isDragging.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  const startHeightResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    isResizingHeight.current = true;
    const startY = e.clientY; const startHeight = trackHeight;
    const onMove = (e: MouseEvent) => { if (!isResizingHeight.current) return; setTrackHeight(Math.max(40, Math.min(160, startHeight + (e.clientY - startY)))); };
    const onUp = () => { isResizingHeight.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  const handleExport = async () => {
    if (!files[0]) return;
    setIsExporting(true); setExportStatus("Fetching source...");
    try {
      const url = audioUrls[files[0].file_path];
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], files[0].file_name, { type: files[0].file_type });
      setExportStatus("Processing master chain...");
      const result = await auraMaster(file, { inputGain, lowShelfGain, lowShelfFreq, highShelfGain, highShelfFreq, saturationDrive, limiterCeiling, targetLUFS });
      setExportStatus("Uploading...");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (project.master_file_path) await supabase.storage.from("project-files").remove([project.master_file_path]);
      const masterPath = `${user.id}/masters/${params.id}-${Date.now()}-master.wav`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("project-files").upload(masterPath, result.masterBlob, { contentType: "audio/wav" });
      if (uploadError) { setExportStatus("Upload failed."); return; }
      await supabase.from("projects").update({
        master_file_path: uploadData.path, master_lufs: result.lufs, master_true_peak: result.truePeak,
        master_dynamic_range: result.dynamicRange, master_rms: result.rms,
        master_input_gain: result.inputGain, master_low_shelf_gain: result.lowShelfGain,
        master_low_shelf_freq: result.lowShelfFreq, master_high_shelf_gain: result.highShelfGain,
        master_high_shelf_freq: result.highShelfFreq, master_saturation_drive: result.saturationDrive,
        master_limiter_ceiling: result.limiterCeiling, master_target_lufs: result.targetLUFS,
        master_freq_sub: result.freqSub, master_freq_bass: result.freqBass,
        master_freq_low_mid: result.freqLowMid, master_freq_mid: result.freqMid,
        master_freq_high_mid: result.freqHighMid, master_freq_air: result.freqAir,
        master_stereo_correlation: result.stereoCorrelation, master_stereo_width: result.stereoWidth,
      }).eq("id", params.id);
      setExportStatus("Master updated ✓");
      setTimeout(() => { setExportStatus(""); setProject((p: any) => ({ ...p, master_file_path: uploadData.path, master_lufs: result.lufs })); }, 2000);
    } catch (err) { console.error(err); setExportStatus("Export failed."); }
    finally { setIsExporting(false); }
  };

  // Reusable Knob/slider
  const Knob = ({ label, value, min, max, step = 0.01, unit = "", accent, onChange }: {
    label: string; value: number; min: number; max: number;
    step?: number; unit?: string; accent?: string; onChange: (v: number) => void;
  }) => {
    const color = accent || inspectorAccent;
    const pct = ((value - min) / (max - min)) * 100;
    return (
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-zinc-500 uppercase">{label}</span>
          <span className="text-[11px] font-mono" style={{ color }}>
            {value > 0 && !unit.includes("Hz") && unit !== "%" ? "+" : ""}{value.toFixed(unit.includes("Hz") ? 0 : 2)}{unit}
          </span>
        </div>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="w-full h-1 rounded-full appearance-none cursor-pointer"
          style={{ background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #1F2937 ${pct}%, #1F2937 100%)` }} />
      </div>
    );
  };

  // Click track — sets inspector to track context
  const selectTrack = (track: string) => {
    setSelectedTrack(track);
    setInspectorContext("track");
    setInspectorView("main");
  };

  // Click master — sets inspector to master context
  const selectMaster = () => {
    setSelectedTrack("MASTER");
    setInspectorContext("master");
  };

  if (!project) return <div className="h-screen bg-[#0A0A0A] text-white flex items-center justify-center">Loading DAW...</div>;

  return (
    <div className="h-screen overflow-hidden bg-[#0A0A0A] text-white flex flex-col">

      {/* Header */}
      <div className="h-[72px] border-b border-[#1F2937] px-8 flex items-center">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-2xl font-bold">Producer Workspace</h1>
          <div className="flex items-center gap-3">
            {exportStatus && (
              <span className="text-sm" style={{ color: exportStatus.includes("✓") ? trackColor : masterColor }}>
                {exportStatus}
              </span>
            )}
            <button onClick={handleExport} disabled={isExporting}
              className="px-4 py-2 rounded-lg font-semibold transition disabled:opacity-50"
              style={{ backgroundColor: masterColor, color: "#000" }}>
              {isExporting ? "Processing..." : "Export Master"}
            </button>
            <button onClick={() => router.back()} className="px-4 py-2 rounded-lg border border-[#1F2937]">
              Back To Project
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-hidden flex flex-col">

        {/* Session Bar */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr] gap-4 mb-4 flex-shrink-0">
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-3">
            <p className="text-xs text-zinc-500">Project</p>
            <p className="text-xl font-semibold truncate">{project.name}</p>
          </div>
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-3">
            <p className="text-xs text-zinc-500">Tempo</p>
            <p className="text-xl font-semibold" style={{ color: trackColor }}>{project.tempo || "--"}</p>
          </div>
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-3">
            <p className="text-xs text-zinc-500">Key</p>
            <p className="text-xl font-semibold" style={{ color: trackColor }}>
              {project.musical_key ? `${project.musical_key} ${project.scale || ""}` : "--"}
            </p>
          </div>
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-3">
            <p className="text-xs text-zinc-500">Signature</p>
            <p className="text-xl font-semibold" style={{ color: trackColor }}>{project.time_signature || "--"}</p>
          </div>
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-3">
            <p className="text-xs text-zinc-500 mb-2">Transport</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => seekTo(0)} className="hover:text-[#14D8C4] transition font-bold text-sm">|◀</button>
                <button onClick={isPlaying ? pausePlayback : startPlayback} className="hover:text-[#14D8C4] transition font-bold text-lg">
                  {isPlaying ? "❚❚" : "▶"}
                </button>
                <button onClick={stopPlayback} className="hover:text-[#14D8C4] transition font-bold text-sm">■</button>
                <button onClick={() => seekTo(1)} className="hover:text-[#14D8C4] transition font-bold text-sm">▶|</button>
              </div>
              <span className="text-sm font-mono" style={{ color: trackColor }}>{currentTime} / {duration}</span>
            </div>
          </div>
        </div>

        {/* Workspace */}
        <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-[160px_1fr_220px_80px_60px] gap-4">

          {/* Tracks list — stems + permanent Master */}
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4 overflow-y-auto min-h-0 flex flex-col">
            <h3 className="text-xs font-semibold mb-4 text-zinc-400 uppercase tracking-wide">Tracks</h3>
            <div className="space-y-2 flex-1">
              {TRACKS.map((track, index) => (
                <button key={track} onClick={() => selectTrack(track)}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition text-sm ${
                    selectedTrack === track && inspectorContext === "track"
                      ? "border-[#14D8C4] bg-[#14D8C415] text-[#14D8C4]"
                      : "border-[#1F2937] text-zinc-300"
                  }`}>
                  {index + 1}. {track}
                </button>
              ))}
            </div>
            {/* Permanent Master channel */}
            <div className="mt-3 pt-3 border-t border-[#1F2937]">
              <button onClick={selectMaster}
                className={`w-full text-left px-3 py-2 rounded-lg border transition text-sm font-semibold ${
                  inspectorContext === "master"
                    ? "border-[#F0A500] bg-[#F0A50015] text-[#F0A500]"
                    : "border-[#F0A50050] text-[#F0A50080]"
                }`}>
                ⬡ MASTER
              </button>
            </div>
          </div>

          {/* Timeline + Mixer */}
          <div className="h-full flex flex-col gap-4 overflow-hidden">

            {/* Timeline */}
            <div className={`bg-[#111827] border border-[#1F2937] rounded-2xl p-4 flex flex-col min-h-0 ${
              expandedView === "timeline" ? "flex-1" : expandedView === "mixer" ? "hidden" : "h-[60%]"
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Timeline</h3>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono" style={{ color: trackColor }}>{currentTime} / {duration}</span>
                  <button onClick={() => setExpandedView(expandedView === "timeline" ? "none" : "timeline")}
                    className="text-xs text-zinc-500 hover:text-zinc-300">
                    {expandedView === "timeline" ? "Restore" : "Expand"}
                  </button>
                </div>
              </div>

              {/* Ruler */}
              <div className="flex mb-1 flex-shrink-0">
                <div className="flex-shrink-0" style={{ width: trackHeaderWidth }} />
                <div className="flex-1 grid grid-cols-12 text-[10px] text-zinc-600">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="border-l border-[#1F2937] pl-1">{i + 1}</div>
                  ))}
                </div>
              </div>

              {/* Track lanes */}
              <div className="flex-1 min-h-0 overflow-y-auto relative cursor-pointer" onClick={handleTimelineClick}>
                <div className="absolute top-0 bottom-0 w-[2px] z-50 pointer-events-none"
                  style={{
                    left: `calc(${trackHeaderWidth}px + (100% - ${trackHeaderWidth}px) * ${playheadPct / 100})`,
                    backgroundColor: trackColor, boxShadow: `0 0 8px ${trackColor}`,
                  }} />

                <div className="space-y-1">
                  {TRACKS.map((track) => {
                    const isMuted = mutedTracks.includes(track);
                    const isSolo = soloTrack === track;
                    const isActive = selectedTrack === track && inspectorContext === "track";
                    return (
                      <div key={track}
                        className={`flex items-center rounded-lg relative ${isActive ? "bg-[#14D8C408]" : ""}`}
                        style={{ height: trackHeight }}>
                        <div className="h-full flex items-center gap-2 px-2 border-r border-[#1F2937] bg-[#0A0A0A] flex-shrink-0 relative z-10"
                          style={{ width: trackHeaderWidth }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => setMutedTracks(m => m.includes(track) ? m.filter(t => t !== track) : [...m, track])}
                            className={`w-6 h-6 rounded border text-[10px] flex-shrink-0 ${isMuted ? "border-[#FF6B4A] bg-[#FF6B4A20] text-[#FF6B4A]" : "border-[#1F2937]"}`}>M</button>
                          <button onClick={() => setSoloTrack(s => s === track ? null : track)}
                            className={`w-6 h-6 rounded border text-[10px] flex-shrink-0 ${isSolo ? "border-[#14D8C4] bg-[#14D8C420] text-[#14D8C4]" : "border-[#1F2937]"}`}>S</button>
                          <span onClick={() => selectTrack(track)}
                            className={`text-xs truncate cursor-pointer ${isActive ? "text-[#14D8C4]" : "text-zinc-400"}`}>
                            {track}
                          </span>
                          <div onMouseDown={startResize}
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#14D8C4] opacity-0 hover:opacity-100 transition" />
                        </div>
                        <div className={`flex-1 h-full relative overflow-hidden bg-[#0A0A0A] border-b border-[#1F2937] ${isMuted ? "opacity-25" : ""}`}>
                          <div className="absolute inset-0 grid grid-cols-12 pointer-events-none z-10">
                            {Array.from({ length: 12 }).map((_, i) => <div key={i} className="border-l border-[#1F2937]" />)}
                          </div>
                          <div ref={(el) => { waveformRefs.current[track] = el; }} className="absolute inset-0" />
                          {isMuted && (
                            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                              <span className="text-[10px] text-[#FF6B4A] font-bold tracking-widest">MUTED</span>
                            </div>
                          )}
                        </div>
                        <div onMouseDown={startHeightResize}
                          className="absolute bottom-0 left-0 right-0 h-1 cursor-row-resize hover:bg-[#14D8C4] opacity-0 hover:opacity-60 transition z-20" />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Mixer */}
            <div className={`bg-[#111827] border border-[#1F2937] rounded-2xl p-4 flex flex-col min-h-0 ${
              expandedView === "timeline" ? "hidden" : expandedView === "mixer" ? "flex-1" : "h-[40%]"
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Mixer</h3>
                <button onClick={() => setExpandedView(expandedView === "mixer" ? "none" : "mixer")}
                  className="text-xs text-zinc-500 hover:text-zinc-300">
                  {expandedView === "mixer" ? "Restore" : "Expand"}
                </button>
              </div>
              <div className="flex gap-3 flex-1 min-h-0 overflow-hidden">

                {/* Track channels + Master — together */}
                <div className="w-[65%] min-w-0 border border-[#1F2937] rounded-xl p-3">
                  <h4 className="text-xs text-zinc-500 mb-3 uppercase">Tracks</h4>
                  <div className="flex gap-2 items-end overflow-x-auto">
                    {TRACKS.map((track) => {
                      const isActive = selectedTrack === track && inspectorContext === "track";
                      return (
                        <button key={track} onClick={() => selectTrack(track)}
                          className={`w-12 rounded-lg border flex flex-col items-center justify-end pb-2 flex-shrink-0 transition ${
                            isActive ? "bg-[#14D8C410] border-[#14D8C4]" : "border-[#1F2937]"
                          }`}>
                          <div className="w-2 h-[60px] bg-[#1F2937] rounded-full relative mb-2">
                            <div className="absolute bottom-0 left-0 right-0 rounded-full bg-[#14D8C4]"
                              style={{ height: `${isPlaying ? vuLevel : 60}%`, transition: "height 0.05s" }} />
                          </div>
                          <span className="text-[10px] truncate w-full text-center">{track.slice(0, 6)}</span>
                        </button>
                      );
                    })}

                    {/* Divider */}
                    <div className="w-px h-[80px] bg-[#1F2937] flex-shrink-0 self-end mb-2" />

                    {/* Permanent Master channel in mixer */}
                    <button onClick={selectMaster}
                      className={`w-12 rounded-lg border flex flex-col items-center justify-end pb-2 flex-shrink-0 transition ${
                        inspectorContext === "master" ? "bg-[#F0A50015] border-[#F0A500]" : "border-[#F0A50050]"
                      }`}>
                      <div className="w-2 h-[60px] bg-[#1F2937] rounded-full relative mb-2">
                        <div className="absolute bottom-0 left-0 right-0 rounded-full"
                          style={{
                            height: `${isPlaying ? Math.min(100, vuLevel * 0.9) : 60}%`,
                            backgroundColor: masterColor,
                            transition: "height 0.05s"
                          }} />
                      </div>
                      <span className="text-[10px]" style={{ color: masterColor }}>MST</span>
                    </button>
                  </div>
                </div>

                {/* Sends */}
                <div className="w-[35%] flex-shrink-0 border border-[#1F2937] rounded-xl p-3">
                  <h4 className="text-xs text-zinc-500 mb-3 uppercase">Sends</h4>
                  <div className="flex gap-2 items-end justify-center">
                    {["Verb", "Delay"].map((bus) => (
                      <div key={bus} className="w-12 rounded-lg border border-[#1F2937] flex flex-col items-center justify-end pb-2">
                        <div className="w-2 h-[60px] bg-[#1F2937] rounded-full relative mb-2">
                          <div className="absolute bottom-0 left-0 right-0 rounded-full bg-[#FF6B4A]" style={{ height: "50%" }} />
                        </div>
                        <span className="text-[10px]">{bus}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Inspector — context aware */}
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl overflow-hidden min-h-0 flex flex-col"
            style={{ borderColor: inspectorAccent + "40" }}>

            {/* Inspector header */}
            <div className="px-4 py-3 border-b border-[#1F2937] flex items-center justify-between"
              style={{ borderBottomColor: inspectorAccent + "30" }}>
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: inspectorAccent }}>
                {inspectorContext === "master" ? "⬡ Master Chain" : `${selectedTrack}`}
              </span>
              {inspectorContext === "track" && (
                <div className="flex gap-1">
                  <button onClick={() => setInspectorView("main")}
                    className={`px-2 py-1 rounded text-[10px] border transition ${
                      inspectorView === "main" ? "border-[#14D8C4] text-[#14D8C4] bg-[#14D8C410]" : "border-[#1F2937] text-zinc-500"
                    }`}>Main</button>
                  <button onClick={() => setInspectorView("sends")}
                    className={`px-2 py-1 rounded text-[10px] border transition ${
                      inspectorView === "sends" ? "border-[#FF6B4A] text-[#FF6B4A] bg-[#FF6B4A10]" : "border-[#1F2937] text-zinc-500"
                    }`}>Sends</button>
                </div>
              )}
            </div>

            {/* Master plugin tabs */}
            {inspectorContext === "master" && (
              <div className="grid grid-cols-4 border-b border-[#1F2937]">
                {(["gain", "eq", "saturation", "limiter"] as const).map(plugin => (
                  <button key={plugin} onClick={() => setSelectedPlugin(plugin)}
                    className={`py-2 text-[9px] uppercase font-semibold transition border-b-2 ${
                      selectedPlugin === plugin
                        ? "border-[#F0A500] text-[#F0A500]"
                        : "border-transparent text-zinc-500 hover:text-zinc-300"
                    }`}>
                    {plugin === "gain" ? "Gain" : plugin === "eq" ? "EQ" : plugin === "saturation" ? "Sat" : "Limit"}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* MASTER CHAIN */}
              {inspectorContext === "master" && (
                <>
                  {selectedPlugin === "gain" && (
                    <>
                      <div className="text-center mb-2">
                        <p className="text-xs text-zinc-500 uppercase mb-1">Input Gain</p>
                        <p className="text-2xl font-bold" style={{ color: masterColor }}>
                          {inputGain > 0 ? "+" : ""}{inputGain.toFixed(1)} dB
                        </p>
                      </div>
                      <Knob label="Input Gain" value={inputGain} min={-20} max={20} step={0.1} unit=" dB" accent={masterColor} onChange={setInputGain} />
                      <div className="border-t border-[#1F2937] pt-4">
                        <Knob label="Target LUFS" value={targetLUFS} min={-24} max={-6} step={0.5} unit=" LU" accent={masterColor} onChange={setTargetLUFS} />
                      </div>
                      <div className="bg-[#0A0A0A] rounded-lg p-3 text-xs text-zinc-500 space-y-1">
                        <p>Original: <span style={{ color: trackColor }}>{project.integrated_lufs?.toFixed(1)} LUFS</span></p>
                        <p>Master: <span style={{ color: masterColor }}>{project.master_lufs?.toFixed(1)} LUFS</span></p>
                        <p>Target: <span style={{ color: masterColor }}>{targetLUFS} LUFS</span></p>
                      </div>
                    </>
                  )}
                  {selectedPlugin === "eq" && (
                    <>
                      <p className="text-xs text-zinc-500 uppercase font-semibold">Low Shelf</p>
                      <Knob label="Frequency" value={lowShelfFreq} min={40} max={400} step={1} unit=" Hz" accent={masterColor} onChange={setLowShelfFreq} />
                      <Knob label="Gain" value={lowShelfGain} min={-12} max={6} step={0.1} unit=" dB" accent={masterColor} onChange={setLowShelfGain} />
                      <div className="border-t border-[#1F2937] pt-4">
                        <p className="text-xs text-zinc-500 uppercase font-semibold mb-3">High Shelf</p>
                        <Knob label="Frequency" value={highShelfFreq} min={2000} max={18000} step={100} unit=" Hz" accent={masterColor} onChange={setHighShelfFreq} />
                        <Knob label="Gain" value={highShelfGain} min={-6} max={12} step={0.1} unit=" dB" accent={masterColor} onChange={setHighShelfGain} />
                      </div>
                      <div className="bg-[#0A0A0A] rounded-lg p-3 text-xs text-zinc-500">
                        <p>Low shelf reduces mud. High shelf adds air and crispness.</p>
                      </div>
                    </>
                  )}
                  {selectedPlugin === "saturation" && (
                    <>
                      <div className="text-center mb-2">
                        <p className="text-xs text-zinc-500 uppercase mb-1">Soft Clipper</p>
                        <p className="text-2xl font-bold" style={{ color: masterColor }}>
                          {(saturationDrive * 100).toFixed(0)}%
                        </p>
                      </div>
                      <Knob label="Drive Threshold" value={saturationDrive} min={0.5} max={1.0} step={0.01} unit="%" accent={masterColor} onChange={setSaturationDrive} />
                      <div className="bg-[#0A0A0A] rounded-lg p-3 text-xs text-zinc-500">
                        <p>Lower threshold = more saturation and warmth before the limiter.</p>
                      </div>
                    </>
                  )}
                  {selectedPlugin === "limiter" && (
                    <>
                      <div className="text-center mb-2">
                        <p className="text-xs text-zinc-500 uppercase mb-1">True Peak Ceiling</p>
                        <p className="text-2xl font-bold" style={{ color: masterColor }}>
                          {limiterCeiling.toFixed(1)} dBTP
                        </p>
                      </div>
                      <Knob label="Ceiling" value={limiterCeiling} min={-6} max={0} step={0.1} unit=" dBTP" accent={masterColor} onChange={setLimiterCeiling} />
                      <div className="bg-[#0A0A0A] rounded-lg p-3 text-xs text-zinc-500 space-y-1">
                        <p>Current: <span style={{ color: masterColor }}>{project.master_true_peak?.toFixed(1)} dBTP</span></p>
                        <p>Streaming safe: <span style={{ color: trackColor }}>-1.0 dBTP</span></p>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* TRACK — MAIN */}
              {inspectorContext === "track" && inspectorView === "main" && (
                <>
                  <div className="text-center mb-2">
                    <p className="text-xs text-zinc-500 uppercase mb-1">Track</p>
                    <p className="text-lg font-bold truncate" style={{ color: trackColor }}>{selectedTrack}</p>
                  </div>
                  <Knob label="Volume" value={trackVolumes[selectedTrack] ?? 0} min={-40} max={6} step={0.1} unit=" dB" accent={trackColor}
                    onChange={v => setTrackVolumes(prev => ({ ...prev, [selectedTrack]: v }))} />
                  <Knob label="Pan" value={trackPans[selectedTrack] ?? 0} min={-100} max={100} step={1} unit="%" accent={trackColor}
                    onChange={v => setTrackPans(prev => ({ ...prev, [selectedTrack]: v }))} />
                  <div className="border-t border-[#1F2937] pt-4 space-y-3">
                    <p className="text-[10px] text-zinc-500 uppercase font-semibold">EQ</p>
                    <div className="bg-[#0A0A0A] rounded-lg p-3 text-xs text-zinc-500 text-center">
                      Per-track EQ coming soon
                    </div>
                  </div>
                </>
              )}

              {/* TRACK — SENDS */}
              {inspectorContext === "track" && inspectorView === "sends" && (
                <>
                  <div className="text-center mb-2">
                    <p className="text-xs text-zinc-500 uppercase mb-1">Sends</p>
                    <p className="text-lg font-bold truncate" style={{ color: sendColor }}>{selectedTrack}</p>
                  </div>
                  <Knob label="Reverb Send" value={reverbSends[selectedTrack] ?? 0} min={0} max={100} step={1} unit="%" accent={sendColor}
                    onChange={v => setReverbSends(prev => ({ ...prev, [selectedTrack]: v }))} />
                  <Knob label="Delay Send" value={delaySends[selectedTrack] ?? 0} min={0} max={100} step={1} unit="%" accent={sendColor}
                    onChange={v => setDelaySends(prev => ({ ...prev, [selectedTrack]: v }))} />
                  <div className="bg-[#0A0A0A] rounded-lg p-3 text-xs text-zinc-500">
                    <p>Send level controls how much of this track feeds the bus. Reverb and Delay buses are shared across all tracks.</p>
                  </div>
                </>
              )}

            </div>

            {/* Export button — only show for master context */}
            {inspectorContext === "master" && (
              <div className="p-4 border-t border-[#1F2937]">
                <button onClick={handleExport} disabled={isExporting}
                  className="w-full py-2 rounded-lg font-semibold text-sm disabled:opacity-50"
                  style={{ backgroundColor: masterColor, color: "#000" }}>
                  {isExporting ? exportStatus || "Processing..." : "Export Master"}
                </button>
              </div>
            )}
          </div>

          {/* Channel Strip — track VU */}
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-3 overflow-hidden min-h-0 flex flex-col"
            style={{ borderColor: inspectorContext === "track" ? trackColor + "40" : "#1F2937" }}>
            <h3 className="text-center text-[11px] font-semibold mb-2" style={{ color: trackColor }}>
              {inspectorContext === "track" ? selectedTrack?.slice(0, 8) || "Track" : "Track"}
            </h3>
            <p className="text-center text-[9px] text-zinc-500 mb-3">TRACK</p>
            <div className="flex-1 min-h-0 flex items-center justify-center gap-1">
              <div className="text-[7px] text-zinc-600 flex flex-col justify-between h-full">
                <span>0</span><span>-6</span><span>-12</span><span>-18</span><span>-24</span><span>-30</span>
              </div>
              <div className="w-3 h-full bg-[#1F2937] rounded-full relative overflow-hidden">
                <div className="absolute bottom-0 left-0 right-0 rounded-full transition-all"
                  style={{
                    height: `${isPlaying ? vuLevel : 0}%`,
                    backgroundColor: vuLevel > 85 ? "#EF4444" : vuLevel > 60 ? masterColor : trackColor,
                    transition: "height 0.05s, background-color 0.1s"
                  }} />
              </div>
            </div>
          </div>

          {/* Master Strip — live VU, clickable */}
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-3 overflow-hidden min-h-0 flex flex-col cursor-pointer"
            style={{ borderColor: inspectorContext === "master" ? masterColor + "80" : "#1F2937" }}
            onClick={selectMaster}>
            <h3 className="text-center text-[11px] font-semibold mb-2" style={{ color: masterColor }}>MASTER</h3>
            <p className="text-center text-[9px] text-zinc-500 mb-1">
              {project.master_lufs?.toFixed(1)} LU
            </p>
            <div className="flex-1 min-h-0 flex items-center justify-center gap-1">
              <div className="text-[7px] text-zinc-600 flex flex-col justify-between h-full">
                <span>0</span><span>-6</span><span>-12</span><span>-18</span><span>-24</span><span>-30</span>
              </div>
              <div className="w-3 h-full bg-[#1F2937] rounded-full relative overflow-hidden">
                <div className="absolute bottom-0 left-0 right-0 rounded-full"
                  style={{
                    height: `${isPlaying ? Math.min(100, vuLevel * 0.9) : 0}%`,
                    backgroundColor: masterColor,
                    transition: "height 0.05s"
                  }} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}