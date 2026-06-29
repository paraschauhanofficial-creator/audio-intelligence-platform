"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import WaveSurfer from "wavesurfer.js";
import { auraMaster } from "@/intelligence/master/auraMaster";
import { SLOT_LABELS, type StemSection } from "@/intelligence/stems/stemsIdentifier";

// ─────────────────────────────────────────────────────────────────────────────
// STEM SECTION DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
const STEM_SECTIONS = [
  { id: "drums",       label: "Drums",       slots: ["Kick", "Snare", "Hi-Hats", "Percussion", "Overhead", "Room"] },
  { id: "instruments", label: "Instruments", slots: ["Guitar 1", "Guitar 2", "Guitar 3", "Piano 1", "Piano 2", "Bass", "Synth 1", "Synth 2"] },
  { id: "vocals",      label: "Vocals",      slots: ["Lead Vocal", "Backing 1", "Backing 2", "Harmony 1", "Harmony 2", "Ad-libs"] },
  { id: "other",       label: "Other",       slots: ["FX 1", "FX 2", "Foley", "Ambience", "Misc 1", "Misc 2"] },
];

const MIX_PLUGINS    = ["EQ", "Comp", "Pan", "Stereo", "Dbl", "Post EQ"] as const;
const MASTER_PLUGINS = ["Gain", "EQ", "Sat", "Limit"]                     as const;

const VU_HEIGHT   = 100;
const FADER_HEIGHT = 120;
const FX_HEIGHT   = 160;
const CH_WIDTH    = 76;
const CH_WIDTH_SM = 56;

// ─────────────────────────────────────────────────────────────────────────────
// TRACK RECORD — unified for both mix and stems workflow
// ─────────────────────────────────────────────────────────────────────────────
interface TrackRecord {
  id:          string;  // project_files.id or project_stems.id
  name:        string;  // display name
  filePath:    string;
  section:     string;  // "mix" | "drums" | "instruments" | "vocals" | "other"
  slot:        string;
  isStem:      boolean;
  runKeyDetection: boolean;
}

export default function DAWPage() {
  const router = useRouter();
  const params = useParams();

  const [project,        setProject]        = useState<any>(null);
  const [tracks,         setTracks]         = useState<TrackRecord[]>([]);
  const [audioUrls,      setAudioUrls]      = useState<Record<string, string>>({});
  const [isExporting,    setIsExporting]    = useState(false);
  const [exportStatus,   setExportStatus]   = useState("");
  const [isStemsProject, setIsStemsProject] = useState(false);

  // Master chain params
  const [inputGain,       setInputGain]       = useState(0);
  const [lowShelfGain,    setLowShelfGain]    = useState(-1.5);
  const [lowShelfFreq,    setLowShelfFreq]    = useState(100);
  const [highShelfGain,   setHighShelfGain]   = useState(1.5);
  const [highShelfFreq,   setHighShelfFreq]   = useState(10000);
  const [saturationDrive, setSaturationDrive] = useState(0.95);
  const [limiterCeiling,  setLimiterCeiling]  = useState(-1);
  const [targetLUFS,      setTargetLUFS]      = useState(-14);

  // Per-track state
  const [trackVolumes, setTrackVolumes] = useState<Record<string, number>>({});
  const [trackPans,    setTrackPans]    = useState<Record<string, number>>({});
  const [reverbSends,  setReverbSends]  = useState<Record<string, number>>({});
  const [delaySends,   setDelaySends]   = useState<Record<string, number>>({});
  const [trackPlugins, setTrackPlugins] = useState<Record<string, string[]>>({});
  const [mutedTracks,  setMutedTracks]  = useState<string[]>([]);
  const [soloTrack,    setSoloTrack]    = useState<string | null>(null);

  // Inspector / layout
  const [inspectorContext, setInspectorContext] = useState<"master"|"track">("master");
  const [inspectorView,    setInspectorView]    = useState<"main"|"sends">("main");
  const [selectedPlugin,   setSelectedPlugin]   = useState<"gain"|"eq"|"saturation"|"limiter">("gain");
  const [selectedTrack,    setSelectedTrack]    = useState("");
  const [expandedView,     setExpandedView]     = useState<"none"|"timeline"|"mixer">("none");
  const [trackHeaderWidth, setTrackHeaderWidth] = useState(180);
  const [trackHeight,      setTrackHeight]      = useState(96);

  // Playback
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [duration,    setDuration]    = useState("0:00");
  const [playheadPct, setPlayheadPct] = useState(0);
  const [vuLevel,     setVuLevel]     = useState(0);
  const durationSeconds = useRef(0);

  // ── Web Audio refs ────────────────────────────────────────────────────────
  const audioCtxRef        = useRef<AudioContext | null>(null);
  // Per-stem: source nodes and gain nodes
  const stemSourcesRef     = useRef<Record<string, AudioBufferSourceNode>>({});
  const stemBuffersRef     = useRef<Record<string, AudioBuffer>>({});
  const stemGainNodesRef   = useRef<Record<string, GainNode>>({});
  // Master chain nodes
  const masterInputGainRef = useRef<GainNode | null>(null);
  const lowShelfNodeRef    = useRef<BiquadFilterNode | null>(null);
  const highShelfNodeRef   = useRef<BiquadFilterNode | null>(null);
  const waveShaperNodeRef  = useRef<WaveShaperNode | null>(null);
  const limiterNodeRef     = useRef<DynamicsCompressorNode | null>(null);
  const analyserNodeRef    = useRef<AnalyserNode | null>(null);
  // Legacy single-track refs (mix workflow)
  const sourceNodeRef      = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef     = useRef<AudioBuffer | null>(null);
  const gainNodeRef        = useRef<GainNode | null>(null);

  const startTimeRef      = useRef(0);
  const pauseOffsetRef    = useRef(0);
  const animFrameRef      = useRef<number>(0);
  const isDragging        = useRef(false);
  const isResizingHeight  = useRef(false);
  const waveformRefs      = useRef<Record<string, HTMLDivElement | null>>({});
  const wavesurferRefs    = useRef<Record<string, any>>({});

  const TRACKS = tracks.map(t => t.name);
  const trackColor  = "#14D8C4";
  const sendColor   = "#FF6B4A";
  const masterColor = "#F0A500";
  const isExpandedMixer = expandedView === "mixer";
  const inspectorAccent = inspectorContext === "master" ? masterColor
                        : inspectorView    === "sends"  ? sendColor
                        : trackColor;

  const sectionColors: Record<string, string> = {
    mix:         trackColor,
    drums:       "#F0A500",
    instruments: "#14D8C4",
    vocals:      "#A78BFA",
    other:       "#FF6B4A",
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  // ── Load project ──────────────────────────────────────────────────────────
  useEffect(() => { loadProject(); }, []);

  const loadProject = async () => {
    const { data: proj, error } = await supabase
      .from("projects").select("*").eq("id", params.id).single();
    if (error || !proj) return;
    setProject(proj);

    const isStems = proj.workflow === "stems";
    setIsStemsProject(isStems);

    // Load master chain params
    if (proj.master_input_gain      != null) setInputGain(proj.master_input_gain);
    if (proj.master_low_shelf_gain  != null) setLowShelfGain(proj.master_low_shelf_gain);
    if (proj.master_low_shelf_freq  != null) setLowShelfFreq(proj.master_low_shelf_freq);
    if (proj.master_high_shelf_gain != null) setHighShelfGain(proj.master_high_shelf_gain);
    if (proj.master_high_shelf_freq != null) setHighShelfFreq(proj.master_high_shelf_freq);
    if (proj.master_saturation_drive!= null) setSaturationDrive(proj.master_saturation_drive);
    if (proj.master_limiter_ceiling != null) setLimiterCeiling(proj.master_limiter_ceiling);
    if (proj.master_target_lufs     != null) setTargetLUFS(proj.master_target_lufs);

    let trackList: TrackRecord[] = [];

    if (isStems) {
      // ── STEMS WORKFLOW ───────────────────────────────────────────────────
      const { data: stemRows } = await supabase
        .from("project_stems")
        .select("*")
        .eq("project_id", params.id)
        .order("order_index", { ascending: true });

      if (stemRows) {
        trackList = stemRows.map(s => ({
          id:              s.id,
          name:            formatStemName(s.slot, s.slot_index),
          filePath:        s.file_path,
          section:         s.section,
          slot:            s.slot,
          isStem:          true,
          runKeyDetection: false,
        }));
      }
    } else {
      // ── MIX WORKFLOW ─────────────────────────────────────────────────────
      const { data: projectFiles } = await supabase
        .from("project_files").select("*").eq("project_id", params.id);

      if (projectFiles) {
        trackList = projectFiles.map(f => ({
          id:              f.id,
          name:            f.file_name.replace(/\.[^/.]+$/, ""),
          filePath:        f.file_path,
          section:         "mix",
          slot:            "mix",
          isStem:          false,
          runKeyDetection: false,
        }));
      }
    }

    setTracks(trackList);

    // Init per-track state
    const vols: Record<string, number> = {};
    const pans: Record<string, number> = {};
    const revs: Record<string, number> = {};
    const dels: Record<string, number> = {};
    const plgs: Record<string, string[]> = {};
    trackList.forEach(t => {
      vols[t.name] = 0; pans[t.name] = 0;
      revs[t.name] = 0; dels[t.name] = 0; plgs[t.name] = [];
    });
    setTrackVolumes(vols); setTrackPans(pans);
    setReverbSends(revs);  setDelaySends(dels);
    setTrackPlugins(plgs);
    if (trackList.length > 0) setSelectedTrack(trackList[0].name);

    // Restore saved stem mixer volumes from project_stems
    if (isStems && trackList.length > 0) {
      const { data: stemMixer } = await supabase
        .from("project_stems").select("id,file_name,mixer_volume,mixer_pan,mixer_muted,reverb_send,delay_send,active_plugins")
        .eq("project_id", params.id);
      if (stemMixer) {
        const savedVols = { ...vols };
        const savedPans = { ...pans };
        const savedRevs = { ...revs };
        const savedDels = { ...dels };
        const savedPlgs = { ...plgs };
        stemMixer.forEach(s => {
          const name = formatStemName(s.file_name, 0);
          if (s.mixer_volume != null) savedVols[name] = s.mixer_volume;
          if (s.mixer_pan    != null) savedPans[name] = s.mixer_pan;
          if (s.reverb_send  != null) savedRevs[name] = s.reverb_send;
          if (s.delay_send   != null) savedDels[name] = s.delay_send;
          if (s.active_plugins)       savedPlgs[name] = s.active_plugins;
        });
        setTrackVolumes(savedVols); setTrackPans(savedPans);
        setReverbSends(savedRevs);  setDelaySends(savedDels);
        setTrackPlugins(savedPlgs);
      }
    }

    // Get signed URLs
    const bucket = "project-files";
    const urls: Record<string, string> = {};
    for (const track of trackList) {
      const { data: urlData } = await supabase.storage
        .from(bucket).createSignedUrl(track.filePath, 3600);
      if (urlData) urls[track.name] = urlData.signedUrl;
    }
    setAudioUrls(urls);
  };

  const formatStemName = (slot: string, index: number): string => {
    const base = SLOT_LABELS[slot.replace(/_\d+$/, "")] ?? slot;
    return index > 1 ? `${base} ${index}` : base;
  };

  // ── Load audio + waveforms when URLs ready ────────────────────────────────
  useEffect(() => {
    if (!Object.keys(audioUrls).length || !tracks.length) return;
    if (isStemsProject) {
      buildStemsAudioGraph().then(() => setTimeout(() => loadWaveforms(), 100));
    } else {
      loadMixAudio();
      setTimeout(() => loadWaveforms(), 100);
    }
  }, [audioUrls, tracks]);

  useEffect(() => {
    if (!Object.keys(audioUrls).length || !tracks.length) return;
    if (Object.keys(wavesurferRefs.current).length === 0) return; // don't fire on first mount
    const t = setTimeout(() => loadWaveforms(), 150);
    return () => clearTimeout(t);
  }, [trackHeight]);

  // ─────────────────────────────────────────────────────────────────────────
  // MASTER CHAIN BUILDER — shared by both mix and stems
  // Returns the masterInputGainNode that stems/mix connect into
  // ─────────────────────────────────────────────────────────────────────────
  const buildMasterChain = (ctx: AudioContext): GainNode => {
    const masterIn = ctx.createGain();
    masterIn.gain.value = Math.pow(10, inputGain / 20);
    masterInputGainRef.current = masterIn;

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

    // Master chain: masterIn → lowShelf → highShelf → waveShaper → limiter → analyser → output
    masterIn.connect(lowShelf);
    lowShelf.connect(highShelf);
    highShelf.connect(waveShaper);
    waveShaper.connect(limiter);
    limiter.connect(analyser);
    analyser.connect(ctx.destination);

    return masterIn;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STEMS AUDIO GRAPH
  // Each stem: fetch → decode → create GainNode → connect to master chain
  // ─────────────────────────────────────────────────────────────────────────
  const buildStemsAudioGraph = async () => {
    if (audioCtxRef.current) audioCtxRef.current.close();
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const masterIn = buildMasterChain(ctx);

    // Track longest duration for playhead
    let maxDuration = 0;

    for (const track of tracks) {
      const url = audioUrls[track.name];
      if (!url) continue;

      try {
        const response    = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer      = await ctx.decodeAudioData(arrayBuffer);

        stemBuffersRef.current[track.name] = buffer;
        if (buffer.duration > maxDuration) maxDuration = buffer.duration;

        // Per-stem GainNode — fader control
        const stemGain = ctx.createGain();
        stemGain.gain.value = Math.pow(10, (trackVolumes[track.name] ?? 0) / 20);
        stemGainNodesRef.current[track.name] = stemGain;

        // Stem GainNode → Master chain input
        stemGain.connect(masterIn);

      } catch (err) {
        console.error(`Failed to load stem: ${track.name}`, err);
      }
    }

    durationSeconds.current = maxDuration;
    setDuration(formatTime(maxDuration));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MIX AUDIO GRAPH (single file, legacy)
  // ─────────────────────────────────────────────────────────────────────────
  const buildMixAudioGraph = useCallback((buffer: AudioBuffer) => {
    if (audioCtxRef.current) audioCtxRef.current.close();
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    audioBufferRef.current = buffer;
    durationSeconds.current = buffer.duration;
    setDuration(formatTime(buffer.duration));

    const masterIn = buildMasterChain(ctx);
    // For mix, the single track GainNode connects to master
    const gainNode = ctx.createGain();
    gainNode.gain.value = Math.pow(10, inputGain / 20);
    gainNodeRef.current = gainNode;
    gainNode.connect(masterIn);
  }, [inputGain, lowShelfFreq, lowShelfGain, highShelfFreq, highShelfGain, saturationDrive, limiterCeiling]);

  const loadMixAudio = async () => {
    const firstTrack = tracks[0];
    if (!firstTrack) return;
    const url = audioUrls[firstTrack.name];
    if (!url) return;
    const response    = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const ctx         = new AudioContext();
    const buffer      = await ctx.decodeAudioData(arrayBuffer);
    ctx.close();
    buildMixAudioGraph(buffer);
  };

  const makeSoftClipCurve = (threshold: number): Float32Array<ArrayBuffer> => {
    const n = 256;
    const curve = new Float32Array(n) as Float32Array<ArrayBuffer>;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1; const abs = Math.abs(x);
      if (abs <= threshold) { curve[i] = x; }
      else {
        const sign = x > 0 ? 1 : -1;
        curve[i] = sign * (threshold + (1 - threshold) * Math.tanh((abs - threshold) / (1 - threshold)));
      }
    }
    return curve;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // WAVEFORMS
  // ─────────────────────────────────────────────────────────────────────────
  const loadWaveforms = async () => {
    Object.values(wavesurferRefs.current).forEach(ws => ws?.destroy());
    wavesurferRefs.current = {};
    for (const track of tracks) {
      const url = audioUrls[track.name];
      if (!url) continue;
      const container = waveformRefs.current[track.name];
      if (!container) continue;
      const color = sectionColors[track.section] ?? trackColor;
      const ws = WaveSurfer.create({
        container,
        waveColor:     color + "30",
        progressColor: color,
        cursorWidth: 0, height: trackHeight, barWidth: 2, barGap: 1,
        interact: false, normalize: true,
      });
      try { await ws.load(url); } catch (e: any) { if (e?.name !== "AbortError") console.error(e); }
      wavesurferRefs.current[track.name] = ws;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PLAYBACK — stems play all at once
  // ─────────────────────────────────────────────────────────────────────────
  const startVUMeter = () => {
    const analyser = analyserNodeRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      setVuLevel(Math.min(100, (data.reduce((s, v) => s + v, 0) / data.length / 128) * 100));
      if (audioCtxRef.current) {
        const elapsed = audioCtxRef.current.currentTime - startTimeRef.current + pauseOffsetRef.current;
        const pct = Math.min(1, elapsed / durationSeconds.current);
        setPlayheadPct(pct * 100);
        setCurrentTime(formatTime(elapsed));
        Object.values(wavesurferRefs.current).forEach(ws => { try { ws?.seekTo(pct); } catch(e){} });
        if (elapsed >= durationSeconds.current) { stopPlayback(); return; }
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  };

  const startPlayback = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    if (isStemsProject) {
      // Start all stem sources simultaneously
      for (const track of tracks) {
        const buffer   = stemBuffersRef.current[track.name];
        const gainNode = stemGainNodesRef.current[track.name];
        if (!buffer || !gainNode) continue;

        // Stop existing source if any
        if (stemSourcesRef.current[track.name]) {
          try { stemSourcesRef.current[track.name].stop(); } catch(e) {}
        }

        const isMuted = mutedTracks.includes(track.name);
        const hasSolo = soloTrack !== null;
        const isSolo  = soloTrack === track.name;

        // Apply mute/solo to gain
        const faderGain = Math.pow(10, (trackVolumes[track.name] ?? 0) / 20);
        gainNode.gain.value = (isMuted || (hasSolo && !isSolo)) ? 0 : faderGain;

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(gainNode);
        source.start(0, pauseOffsetRef.current);
        stemSourcesRef.current[track.name] = source;
      }
    } else {
      // Mix workflow — single source
      const buffer   = audioBufferRef.current;
      const gainNode = gainNodeRef.current;
      if (!buffer || !gainNode) return;
      if (sourceNodeRef.current) { try { sourceNodeRef.current.stop(); } catch(e) {} }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNode);
      source.start(0, pauseOffsetRef.current);
      sourceNodeRef.current = source;
    }

    startTimeRef.current = ctx.currentTime;
    setIsPlaying(true);
    startVUMeter();
  };

  const pausePlayback = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    pauseOffsetRef.current += ctx.currentTime - startTimeRef.current;

    if (isStemsProject) {
      Object.values(stemSourcesRef.current).forEach(src => { try { src.stop(); } catch(e) {} });
      stemSourcesRef.current = {};
    } else {
      if (sourceNodeRef.current) { try { sourceNodeRef.current.stop(); } catch(e) {} sourceNodeRef.current = null; }
    }

    setIsPlaying(false);
    cancelAnimationFrame(animFrameRef.current);
    setVuLevel(0);
  };

  const stopPlayback = () => {
    if (isStemsProject) {
      Object.values(stemSourcesRef.current).forEach(src => { try { src.stop(); } catch(e) {} });
      stemSourcesRef.current = {};
    } else {
      if (sourceNodeRef.current) { try { sourceNodeRef.current.stop(); } catch(e) {} sourceNodeRef.current = null; }
    }
    pauseOffsetRef.current = 0;
    setIsPlaying(false); setPlayheadPct(0); setCurrentTime("0:00");
    cancelAnimationFrame(animFrameRef.current); setVuLevel(0);
    Object.values(wavesurferRefs.current).forEach(ws => { try { ws?.seekTo(0); } catch(e){} });
  };

  const seekTo = (pct: number) => {
    const was = isPlaying;
    if (was) pausePlayback();
    pauseOffsetRef.current = pct * durationSeconds.current;
    setPlayheadPct(pct * 100);
    setCurrentTime(formatTime(pct * durationSeconds.current));
    Object.values(wavesurferRefs.current).forEach(ws => { try { ws?.seekTo(pct); } catch(e){} });
    if (was) startPlayback();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // LIVE FADER UPDATE — stems: update GainNode directly
  // ─────────────────────────────────────────────────────────────────────────
  const updateStemGain = (trackName: string, volumeDb: number) => {
    const gainNode = stemGainNodesRef.current[trackName];
    if (!gainNode) return;
    const isMuted = mutedTracks.includes(trackName);
    const hasSolo = soloTrack !== null;
    const isSolo  = soloTrack === trackName;
    const linear  = Math.pow(10, volumeDb / 20);
    gainNode.gain.setTargetAtTime(
      (isMuted || (hasSolo && !isSolo)) ? 0 : linear,
      audioCtxRef.current?.currentTime ?? 0,
      0.01
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MUTE / SOLO — wire to stem gain nodes
  // ─────────────────────────────────────────────────────────────────────────
  const toggleMute = (trackName: string) => {
    setMutedTracks(prev => {
      const next = prev.includes(trackName) ? prev.filter(t => t !== trackName) : [...prev, trackName];
      // Update gain nodes
      tracks.forEach(t => {
        const gn = stemGainNodesRef.current[t.name];
        if (!gn) return;
        const muted = next.includes(t.name);
        const hasSolo = soloTrack !== null;
        const isSolo  = soloTrack === t.name;
        const linear  = Math.pow(10, (trackVolumes[t.name] ?? 0) / 20);
        gn.gain.setTargetAtTime(
          (muted || (hasSolo && !isSolo)) ? 0 : linear,
          audioCtxRef.current?.currentTime ?? 0, 0.01
        );
      });
      return next;
    });
  };

  const toggleSolo = (trackName: string) => {
    setSoloTrack(prev => {
      const next = prev === trackName ? null : trackName;
      tracks.forEach(t => {
        const gn = stemGainNodesRef.current[t.name];
        if (!gn) return;
        const muted  = mutedTracks.includes(t.name);
        const isSolo = t.name === next;
        const linear = Math.pow(10, (trackVolumes[t.name] ?? 0) / 20);
        gn.gain.setTargetAtTime(
          (muted || (next !== null && !isSolo)) ? 0 : linear,
          audioCtxRef.current?.currentTime ?? 0, 0.01
        );
      });
      return next;
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // LIVE MASTER CHAIN UPDATES
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const node = masterInputGainRef.current ?? gainNodeRef.current;
    if (node) node.gain.setTargetAtTime(Math.pow(10, inputGain / 20), audioCtxRef.current?.currentTime ?? 0, 0.01);
  }, [inputGain]);
  useEffect(() => {
    if (lowShelfNodeRef.current) {
      lowShelfNodeRef.current.frequency.setTargetAtTime(lowShelfFreq, audioCtxRef.current?.currentTime ?? 0, 0.01);
      lowShelfNodeRef.current.gain.setTargetAtTime(lowShelfGain, audioCtxRef.current?.currentTime ?? 0, 0.01);
    }
  }, [lowShelfFreq, lowShelfGain]);
  useEffect(() => {
    if (highShelfNodeRef.current) {
      highShelfNodeRef.current.frequency.setTargetAtTime(highShelfFreq, audioCtxRef.current?.currentTime ?? 0, 0.01);
      highShelfNodeRef.current.gain.setTargetAtTime(highShelfGain, audioCtxRef.current?.currentTime ?? 0, 0.01);
    }
  }, [highShelfFreq, highShelfGain]);
  useEffect(() => {
    if (waveShaperNodeRef.current) waveShaperNodeRef.current.curve = makeSoftClipCurve(saturationDrive);
  }, [saturationDrive]);
  useEffect(() => {
    if (limiterNodeRef.current)
      limiterNodeRef.current.threshold.setTargetAtTime(limiterCeiling, audioCtxRef.current?.currentTime ?? 0, 0.01);
  }, [limiterCeiling]);

  useEffect(() => () => {
    cancelAnimationFrame(animFrameRef.current);
    Object.values(stemSourcesRef.current).forEach(s => { try { s.stop(); } catch(e){} });
    if (sourceNodeRef.current) try { sourceNodeRef.current.stop(); } catch(e){}
    audioCtxRef.current?.close();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // TIMELINE CLICK
  // ─────────────────────────────────────────────────────────────────────────
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const w = rect.width - trackHeaderWidth;
    const x = e.clientX - rect.left - trackHeaderWidth;
    if (x < 0) return;
    seekTo(Math.max(0, Math.min(1, x / w)));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RESIZE HANDLERS
  // ─────────────────────────────────────────────────────────────────────────
  const startResize = (e: React.MouseEvent) => {
    e.stopPropagation(); isDragging.current = true;
    const sx = e.clientX; const sw = trackHeaderWidth;
    const onMove = (e: MouseEvent) => { if (!isDragging.current) return; setTrackHeaderWidth(Math.max(120, Math.min(300, sw + (e.clientX - sx)))); };
    const onUp   = () => { isDragging.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };
  const startHeightResize = (e: React.MouseEvent) => {
    e.stopPropagation(); isResizingHeight.current = true;
    const sy = e.clientY; const sh = trackHeight;
    const onMove = (e: MouseEvent) => { if (!isResizingHeight.current) return; setTrackHeight(Math.max(40, Math.min(160, sh + (e.clientY - sy)))); };
    const onUp   = () => { isResizingHeight.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!tracks[0]) return;
    setIsExporting(true); setExportStatus("Fetching source...");
    try {
      // For stems, export uses the first track as reference file for auraMaster
      // Future: offline render all stems summed
      const url      = audioUrls[tracks[0].name];
      const blob     = await (await fetch(url)).blob();
      const file     = new File([blob], tracks[0].name, { type: blob.type });
      setExportStatus("Processing master chain...");
      const result   = await auraMaster(file, { inputGain, lowShelfGain, lowShelfFreq, highShelfGain, highShelfFreq, saturationDrive, limiterCeiling, targetLUFS });
      setExportStatus("Uploading...");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (project.master_file_path) await supabase.storage.from("project-files").remove([project.master_file_path]);
      const masterPath = `${user.id}/masters/${params.id}-${Date.now()}-master.wav`;
      const { data: up, error: ue } = await supabase.storage.from("project-files").upload(masterPath, result.masterBlob, { contentType: "audio/wav" });
      if (ue) { setExportStatus("Upload failed."); return; }
      await supabase.from("projects").update({
        master_file_path: up.path, master_lufs: result.lufs, master_true_peak: result.truePeak,
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
      setTimeout(() => { setExportStatus(""); setProject((p: any) => ({ ...p, master_file_path: up.path, master_lufs: result.lufs })); }, 2000);
    } catch (err) { console.error(err); setExportStatus("Export failed."); }
    finally { setIsExporting(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // INSPECTOR NAVIGATION
  // ─────────────────────────────────────────────────────────────────────────
  const selectTrack  = (name: string) => { setSelectedTrack(name); setInspectorContext("track"); setInspectorView("main"); };
  const selectMaster = ()             => { setSelectedTrack("MASTER"); setInspectorContext("master"); };

  // ─────────────────────────────────────────────────────────────────────────
  // SHARED UI COMPONENTS
  // ─────────────────────────────────────────────────────────────────────────
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
          style={{ background: `linear-gradient(to right,${color} 0%,${color} ${pct}%,#1F2937 ${pct}%,#1F2937 100%)` }}/>
      </div>
    );
  };

  const VUBar = ({ level, color }: { level: number; color: string }) => {
    const markers = ["0", "-6", "-12", "-18", "-24", "-30"];
    return (
      <div className="flex gap-1 items-stretch flex-shrink-0" style={{ height: VU_HEIGHT }}>
        <div className="flex flex-col justify-between text-[7px] text-zinc-600 text-right">
          {markers.map(m => <span key={m}>{m}</span>)}
        </div>
        <div className="w-3 bg-[#0A0A0A] rounded-full relative overflow-hidden border border-[#1F2937]">
          <div className="absolute bottom-0 left-0 right-0 rounded-full"
            style={{ height: `${level}%`, backgroundColor: color, transition: "height 0.05s,background-color 0.1s" }}/>
        </div>
      </div>
    );
  };

  const VerticalFader = ({ value, color, onChange, onClick }: {
    value: number; color: string;
    onChange: (v: number) => void; onClick?: (e: React.MouseEvent) => void;
  }) => {
    const pct = ((value + 40) / 46) * 100;
    return (
      <div className="flex flex-col items-center gap-1 w-full" style={{ height: FADER_HEIGHT }} onClick={onClick}>
        <div className="flex-1 flex items-center justify-center w-full">
          <input type="range" min={-40} max={6} step={0.1} value={value}
            onChange={e => onChange(parseFloat(e.target.value))}
            className="appearance-none cursor-pointer"
            style={{
              writingMode: "vertical-lr" as any, direction: "rtl" as any,
              width: 4, height: FADER_HEIGHT - 28,
              background: `linear-gradient(to top,${color} 0%,${color} ${pct}%,#1F2937 ${pct}%,#1F2937 100%)`,
              borderRadius: 4,
            }}/>
        </div>
        <span className="text-[9px] font-mono flex-shrink-0" style={{ color }}>
          {value > 0 ? "+" : ""}{value.toFixed(1)} dB
        </span>
      </div>
    );
  };

  const MixFXChain = ({ track }: { track: string }) => {
    const active = trackPlugins[track] ?? [];
    const toggle = (plugin: string) => setTrackPlugins(prev => {
      const cur = prev[track] ?? [];
      return { ...prev, [track]: cur.includes(plugin) ? cur.filter(p => p !== plugin) : [...cur, plugin] };
    });
    return (
      <div className="flex flex-col gap-1 w-full" style={{ height: FX_HEIGHT, paddingTop: 4 }}>
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider text-center mb-1">FX</span>
        {MIX_PLUGINS.map(plugin => {
          const on = active.includes(plugin);
          const trackObj = tracks.find(t => t.name === track);
          const col = sectionColors[trackObj?.section ?? "mix"] ?? trackColor;
          return (
            <button key={plugin} onClick={e => { e.stopPropagation(); toggle(plugin); }}
              className={`w-full rounded text-[8px] font-semibold py-[3px] border transition ${
                on ? `border-current bg-current/10` : "border-[#1F2937] text-zinc-600 hover:border-[#14D8C440] hover:text-zinc-400"
              }`}
              style={on ? { color: col, borderColor: col, backgroundColor: col + "20" } : {}}>
              {plugin}
            </button>
          );
        })}
      </div>
    );
  };

  const MasterFXChain = () => {
    const pluginMap: Record<string, typeof selectedPlugin> = { "Gain":"gain","EQ":"eq","Sat":"saturation","Limit":"limiter" };
    return (
      <div className="flex flex-col gap-1 w-full" style={{ height: FX_HEIGHT, paddingTop: 4 }}>
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider text-center mb-1">Chain</span>
        {MASTER_PLUGINS.map(plugin => {
          const key = pluginMap[plugin];
          const sel = selectedPlugin === key && inspectorContext === "master";
          return (
            <button key={plugin} onClick={e => { e.stopPropagation(); selectMaster(); setSelectedPlugin(key); }}
              className={`w-full rounded text-[8px] font-semibold py-[3px] border transition ${
                sel ? "border-[#F0A500] bg-[#F0A50025] text-[#F0A500]"
                    : "border-[#F0A50060] text-[#F0A50090] hover:border-[#F0A500] hover:text-[#F0A500]"
              }`}>
              {plugin}
            </button>
          );
        })}
      </div>
    );
  };

  const StemFXChain = () => (
    <div className="flex flex-col gap-1 w-full" style={{ height: FX_HEIGHT, paddingTop: 4 }}>
      <span className="text-[8px] text-zinc-700 uppercase tracking-wider text-center mb-1">FX</span>
      {MIX_PLUGINS.map(p => (
        <div key={p} className="w-full rounded text-[8px] font-semibold py-[3px] border border-[#1F2937] text-zinc-700 text-center">{p}</div>
      ))}
    </div>
  );

  // ── Mixer channel components ──────────────────────────────────────────────
  const MixerChannelCompact = ({ track }: { track: TrackRecord }) => {
    const isActive = selectedTrack === track.name && inspectorContext === "track";
    const col = sectionColors[track.section] ?? trackColor;
    return (
      <button onClick={() => selectTrack(track.name)}
        className="flex-shrink-0 rounded-lg border flex flex-col items-center justify-end pb-2 pt-2 transition self-stretch"
        style={{ width: CH_WIDTH_SM, borderColor: isActive ? col : "#1F2937", backgroundColor: isActive ? col + "08" : "transparent" }}>
        <div className="flex-1 w-2 bg-[#1F2937] rounded-full relative mb-2 min-h-0" style={{ minHeight: 60 }}>
          <div className="absolute bottom-0 left-0 right-0 rounded-full"
            style={{ height: `${isPlaying ? vuLevel : 60}%`, backgroundColor: col, transition: "height 0.05s" }}/>
        </div>
        <span className="text-[10px] truncate w-full text-center flex-shrink-0">{track.name.slice(0, 6)}</span>
      </button>
    );
  };

  const MixerChannelExpanded = ({ track }: { track: TrackRecord }) => {
    const isActive = selectedTrack === track.name && inspectorContext === "track";
    const isMuted  = mutedTracks.includes(track.name);
    const isSolo   = soloTrack === track.name;
    const vol      = trackVolumes[track.name] ?? 0;
    const col      = sectionColors[track.section] ?? trackColor;
    const vuColor  = vuLevel > 85 ? "#EF4444" : vuLevel > 60 ? masterColor : col;
    return (
      <div onClick={() => selectTrack(track.name)}
        className="flex-shrink-0 rounded-xl border flex flex-col items-center pt-2 pb-2 px-2 gap-0 cursor-pointer transition"
        style={{ width: CH_WIDTH, borderColor: isActive ? col : "#1F2937", backgroundColor: isActive ? col + "08" : "transparent" }}>
        <span className={`text-[10px] font-semibold truncate w-full text-center mb-1`} style={{ color: isActive ? col : "#a1a1aa" }}>
          {track.name.slice(0, 8)}
        </span>
        <div className="flex gap-1 mb-2">
          <button onClick={e => { e.stopPropagation(); toggleMute(track.name); }}
            className={`w-6 h-5 rounded text-[9px] font-bold border transition ${isMuted ? "border-[#FF6B4A] bg-[#FF6B4A20] text-[#FF6B4A]" : "border-[#1F2937] text-zinc-500"}`}>M</button>
          <button onClick={e => { e.stopPropagation(); toggleSolo(track.name); }}
            className={`w-6 h-5 rounded text-[9px] font-bold border transition ${isSolo ? "border-[#14D8C4] bg-[#14D8C420] text-[#14D8C4]" : "border-[#1F2937] text-zinc-500"}`}>S</button>
        </div>
        <VUBar level={isPlaying ? vuLevel : 0} color={vuColor}/>
        <div className="w-full border-t border-[#1F2937] my-2"/>
        <VerticalFader value={vol} color={col}
          onClick={e => e.stopPropagation()}
          onChange={v => {
            setTrackVolumes(prev => ({ ...prev, [track.name]: v }));
            updateStemGain(track.name, v);
          }}/>
        <div className="w-full border-t border-[#1F2937] my-2"/>
        <MixFXChain track={track.name}/>
      </div>
    );
  };

  const MasterChannelCompact = () => (
    <button onClick={selectMaster}
      className="flex-shrink-0 rounded-lg border flex flex-col items-center justify-end pb-2 pt-2 transition self-stretch"
      style={{ width: CH_WIDTH_SM, borderColor: inspectorContext === "master" ? masterColor : "#F0A50040", backgroundColor: inspectorContext === "master" ? "#F0A50015" : "transparent" }}>
      <div className="flex-1 w-2 bg-[#1F2937] rounded-full relative mb-2 min-h-0" style={{ minHeight: 60 }}>
        <div className="absolute bottom-0 left-0 right-0 rounded-full"
          style={{ height: `${isPlaying ? Math.min(100, vuLevel * 0.9) : 60}%`, backgroundColor: masterColor, transition: "height 0.05s" }}/>
      </div>
      <span className="text-[10px] flex-shrink-0" style={{ color: masterColor }}>MST</span>
    </button>
  );

  const MasterChannelExpanded = () => (
    <div onClick={selectMaster}
      className="flex-shrink-0 rounded-xl border flex flex-col items-center pt-2 pb-2 px-2 gap-0 cursor-pointer transition"
      style={{ width: CH_WIDTH, borderColor: inspectorContext === "master" ? masterColor : "#F0A50040", backgroundColor: inspectorContext === "master" ? "#F0A50010" : "transparent" }}>
      <span className="text-[10px] font-semibold mb-1" style={{ color: masterColor }}>MASTER</span>
      <div style={{ height: 28 }}/>
      <VUBar level={isPlaying ? Math.min(100, vuLevel * 0.9) : 0} color={masterColor}/>
      <div className="w-full border-t border-[#1F2937] my-2"/>
      <div className="flex flex-col items-center justify-center" style={{ height: FADER_HEIGHT }}>
        <span className="text-[8px] text-zinc-500 uppercase mb-1">Output</span>
        <span className="text-lg font-bold font-mono" style={{ color: masterColor }}>{project?.master_lufs?.toFixed(1) ?? "--"}</span>
        <span className="text-[8px] text-zinc-500">LUFS</span>
      </div>
      <div className="w-full border-t border-[#1F2937] my-2"/>
      <MasterFXChain/>
    </div>
  );

  const StemSlotCompact = ({ label }: { label: string }) => (
    <div className="flex-shrink-0 rounded-lg border border-[#1F2937] flex flex-col items-center justify-end pb-2 pt-2 cursor-not-allowed"
      style={{ width: CH_WIDTH_SM, height: "100%" }}>
      <div className="flex-1 w-2 bg-[#0A0A0A] rounded-full border border-[#1F2937] mb-2 min-h-0" style={{ minHeight: 60 }}/>
      <span className="text-[9px] text-zinc-700 truncate w-full text-center flex-shrink-0">{label.slice(0, 5)}</span>
    </div>
  );

  const StemSlotExpanded = ({ label }: { label: string }) => (
    <div className="flex-shrink-0 rounded-xl border border-[#1F2937] flex flex-col items-center pt-2 pb-2 px-2 gap-0 cursor-not-allowed"
      style={{ width: CH_WIDTH }}>
      <span className="text-[10px] text-zinc-600 truncate w-full text-center mb-1">{label}</span>
      <div style={{ height: 28 }}/>
      <div className="flex gap-1 items-stretch flex-shrink-0" style={{ height: VU_HEIGHT }}>
        <div className="w-3 bg-[#0A0A0A] rounded-full border border-[#1F2937]"/>
      </div>
      <div className="w-full border-t border-[#1F2937] my-2"/>
      <div className="flex items-center justify-center" style={{ height: FADER_HEIGHT }}>
        <div className="w-1 rounded-full bg-[#1F2937]" style={{ height: FADER_HEIGHT - 28 }}/>
      </div>
      <div className="w-full border-t border-[#1F2937] my-2"/>
      <StemFXChain/>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  if (!project) return (
    <div className="h-screen bg-[#0A0A0A] text-white flex items-center justify-center">Loading DAW...</div>
  );

  return (
    <div className="h-screen overflow-hidden bg-[#0A0A0A] text-white flex flex-col">

      {/* ── Header ── */}
      <div className="h-[72px] border-b border-[#1F2937] px-8 flex items-center">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Producer Workspace</h1>
            {isStemsProject && (
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border"
                style={{ color: trackColor, borderColor: trackColor + "40", backgroundColor: trackColor + "15" }}>
                Stems
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {exportStatus && <span className="text-sm" style={{ color: exportStatus.includes("✓") ? trackColor : masterColor }}>{exportStatus}</span>}
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

        {/* ── Session Bar ── */}
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
            <p className="text-xs text-zinc-500">Stems</p>
            <p className="text-xl font-semibold" style={{ color: trackColor }}>
              {isStemsProject ? `${tracks.length}` : project.time_signature || "--"}
            </p>
          </div>
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-3">
            <p className="text-xs text-zinc-500 mb-2">Transport</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => seekTo(0)} className="hover:text-[#14D8C4] transition font-bold text-sm">|◀</button>
                <button onClick={isPlaying ? pausePlayback : startPlayback} className="hover:text-[#14D8C4] transition font-bold text-lg">{isPlaying ? "❚❚" : "▶"}</button>
                <button onClick={stopPlayback} className="hover:text-[#14D8C4] transition font-bold text-sm">■</button>
                <button onClick={() => seekTo(1)} className="hover:text-[#14D8C4] transition font-bold text-sm">▶|</button>
              </div>
              <span className="text-sm font-mono" style={{ color: trackColor }}>{currentTime} / {duration}</span>
            </div>
          </div>
        </div>

        {/* ── Workspace ── */}
        <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-[160px_1fr_220px_80px_60px] gap-4">

          {/* Tracks list */}
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4 overflow-y-auto min-h-0 flex flex-col">
            <h3 className="text-xs font-semibold mb-4 text-zinc-400 uppercase tracking-wide">Tracks</h3>
            <div className="space-y-2 flex-1">
              {tracks.map((track, i) => {
                const col = sectionColors[track.section] ?? trackColor;
                const isActive = selectedTrack === track.name && inspectorContext === "track";
                return (
                  <button key={track.id} onClick={() => selectTrack(track.name)}
                    className="w-full text-left px-3 py-2 rounded-lg border transition text-sm"
                    style={{
                      borderColor:       isActive ? col : "#1F2937",
                      backgroundColor:   isActive ? col + "15" : "transparent",
                      color:             isActive ? col : "#d4d4d8",
                    }}>
                    <span className="truncate block">{i + 1}. {track.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-[#1F2937]">
              <button onClick={selectMaster}
                className={`w-full text-left px-3 py-2 rounded-lg border transition text-sm font-semibold ${inspectorContext === "master" ? "border-[#F0A500] bg-[#F0A50015] text-[#F0A500]" : "border-[#F0A50050] text-[#F0A50080]"}`}>
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
                  <button onClick={() => setExpandedView(expandedView === "timeline" ? "none" : "timeline")} className="text-xs text-zinc-500 hover:text-zinc-300">
                    {expandedView === "timeline" ? "Restore" : "Expand"}
                  </button>
                </div>
              </div>
              <div className="flex mb-1 flex-shrink-0">
                <div className="flex-shrink-0" style={{ width: trackHeaderWidth }}/>
                <div className="flex-1 grid grid-cols-12 text-[10px] text-zinc-600">
                  {Array.from({ length: 12 }).map((_, i) => <div key={i} className="border-l border-[#1F2937] pl-1">{i + 1}</div>)}
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto relative cursor-pointer" onClick={handleTimelineClick}>
                <div className="absolute top-0 bottom-0 w-[2px] z-50 pointer-events-none"
                  style={{ left: `calc(${trackHeaderWidth}px + (100% - ${trackHeaderWidth}px) * ${playheadPct / 100})`, backgroundColor: trackColor, boxShadow: `0 0 8px ${trackColor}` }}/>
                <div className="space-y-1">
                  {tracks.map(track => {
                    const isMuted  = mutedTracks.includes(track.name);
                    const isSolo   = soloTrack === track.name;
                    const isActive = selectedTrack === track.name && inspectorContext === "track";
                    const col      = sectionColors[track.section] ?? trackColor;
                    return (
                      <div key={track.id} className={`flex items-center rounded-lg relative ${isActive ? "bg-[#14D8C408]" : ""}`} style={{ height: trackHeight }}>
                        <div className="h-full flex items-center gap-2 px-2 border-r border-[#1F2937] bg-[#0A0A0A] flex-shrink-0 relative z-10"
                          style={{ width: trackHeaderWidth }} onClick={e => e.stopPropagation()}>
                          {/* Section color dot */}
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: col }}/>
                          <button onClick={() => toggleMute(track.name)}
                            className={`w-6 h-6 rounded border text-[10px] flex-shrink-0 ${isMuted ? "border-[#FF6B4A] bg-[#FF6B4A20] text-[#FF6B4A]" : "border-[#1F2937]"}`}>M</button>
                          <button onClick={() => toggleSolo(track.name)}
                            className={`w-6 h-6 rounded border text-[10px] flex-shrink-0 ${isSolo ? "border-current bg-current/10" : "border-[#1F2937]"}`}
                            style={isSolo ? { color: col, borderColor: col } : {}}>S</button>
                          <span onClick={() => selectTrack(track.name)} className="text-xs truncate cursor-pointer" style={{ color: isActive ? col : "#a1a1aa" }}>
                            {track.name}
                          </span>
                          <div onMouseDown={startResize} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#14D8C4] opacity-0 hover:opacity-100 transition"/>
                        </div>
                        <div className={`flex-1 h-full relative overflow-hidden bg-[#0A0A0A] border-b border-[#1F2937] ${isMuted ? "opacity-25" : ""}`}>
                          <div className="absolute inset-0 grid grid-cols-12 pointer-events-none z-10">
                            {Array.from({ length: 12 }).map((_, i) => <div key={i} className="border-l border-[#1F2937]"/>)}
                          </div>
                          <div ref={el => { waveformRefs.current[track.name] = el; }} className="absolute inset-0"/>
                          {isMuted && (
                            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                              <span className="text-[10px] text-[#FF6B4A] font-bold tracking-widest">MUTED</span>
                            </div>
                          )}
                        </div>
                        <div onMouseDown={startHeightResize} className="absolute bottom-0 left-0 right-0 h-1 cursor-row-resize hover:bg-[#14D8C4] opacity-0 hover:opacity-60 transition z-20"/>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── MIXER ── */}
            <div className={`bg-[#111827] border border-[#1F2937] rounded-2xl flex flex-col min-h-0 ${
              expandedView === "timeline" ? "hidden" : expandedView === "mixer" ? "flex-1" : "h-[40%]"
            }`}>
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#1F2937] flex-shrink-0">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Mixer</h3>
                <button onClick={() => setExpandedView(expandedView === "mixer" ? "none" : "mixer")} className="text-xs text-zinc-500 hover:text-zinc-300">
                  {expandedView === "mixer" ? "Restore" : "Expand"}
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto">
                <div className="flex h-full min-w-max">

                  {/* MIX / STEMS section — live tracks */}
                  <div className="flex flex-col border-r border-[#1F2937] flex-shrink-0">
                    <div className="px-3 py-1 border-b border-[#1F2937] flex-shrink-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: trackColor }}>
                        {isStemsProject ? "Stems" : "Mix"}
                      </span>
                    </div>
                    <div className="flex gap-2 px-3 py-2 items-stretch" style={{ height: 140 }}>
                      {tracks.map(track => isExpandedMixer
                        ? <MixerChannelExpanded key={track.id} track={track}/>
                        : <MixerChannelCompact  key={track.id} track={track}/>
                      )}
                      <div className="w-px self-stretch bg-[#1F2937] mx-1"/>
                      {isExpandedMixer ? <MasterChannelExpanded/> : <MasterChannelCompact/>}
                    </div>
                  </div>

                  {/* Placeholder stem sections — only shown for mix projects (stems already live above) */}
                  {!isStemsProject && STEM_SECTIONS.map(sec => (
                    <div key={sec.id} className="flex flex-col border-r border-[#1F2937] flex-shrink-0 opacity-30">
                      <div className="px-3 py-1 border-b border-[#1F2937] flex-shrink-0 flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{sec.label}</span>
                        <span className="text-[8px] border border-zinc-700 text-zinc-600 px-1 rounded">Stems required</span>
                      </div>
                      <div className="flex gap-2 px-3 py-2 items-stretch">
                        {sec.slots.map(slot => isExpandedMixer
                          ? <StemSlotExpanded key={slot} label={slot}/>
                          : <StemSlotCompact  key={slot} label={slot}/>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* SENDS */}
                  <div className="flex flex-col flex-shrink-0 border-l border-[#1F2937]">
                    <div className="px-3 py-1 border-b border-[#1F2937] flex-shrink-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: sendColor }}>Sends</span>
                    </div>
                    <div className="flex gap-2 px-3 py-2 items-stretch">
                      {["Verb", "Delay"].map(bus => (
                        <div key={bus} className="flex-shrink-0 rounded-xl border border-[#1F2937] flex flex-col items-center pt-2 pb-2 px-2 self-stretch"
                          style={{ width: isExpandedMixer ? CH_WIDTH : CH_WIDTH_SM }}>
                          <span className="text-[10px] text-zinc-400 mb-1">{bus}</span>
                          {isExpandedMixer
                            ? <>
                                <div style={{ height: 28 }}/>
                                <div className="flex gap-1 items-stretch flex-shrink-0" style={{ height: VU_HEIGHT }}>
                                  <div className="w-3 bg-[#0A0A0A] rounded-full relative overflow-hidden border border-[#1F2937]">
                                    <div className="absolute bottom-0 left-0 right-0 rounded-full bg-[#FF6B4A]" style={{ height: "50%" }}/>
                                  </div>
                                </div>
                                <div className="w-full border-t border-[#1F2937] my-2"/>
                                <div className="flex flex-col items-center justify-center gap-1" style={{ height: FADER_HEIGHT }}>
                                  <span className="text-[8px] text-zinc-500 uppercase">Send</span>
                                  <div className="relative flex items-center justify-center" style={{ height: FADER_HEIGHT - 28, width: CH_WIDTH - 16 }}>
                                    <input type="range" min={0} max={100} step={1} defaultValue={50}
                                      className="appearance-none cursor-pointer"
                                      style={{ writingMode: "vertical-lr" as any, direction: "rtl" as any, width: 4, height: FADER_HEIGHT - 32, background: `linear-gradient(to top,${sendColor} 0%,${sendColor} 50%,#1F2937 50%,#1F2937 100%)`, borderRadius: 4 }}/>
                                  </div>
                                  <span className="text-[9px] font-mono" style={{ color: sendColor }}>50%</span>
                                </div>
                                <div className="w-full border-t border-[#1F2937] my-2"/>
                                <div className="flex flex-col gap-1 w-full" style={{ height: FX_HEIGHT, paddingTop: 4 }}>
                                  <span className="text-[8px] text-zinc-600 uppercase tracking-wider text-center mb-1">Bus</span>
                                  {["Pre", "Post", "Return"].map(l => (
                                    <div key={l} className="w-full rounded text-[8px] py-[3px] border border-[#1F2937] text-zinc-600 text-center">{l}</div>
                                  ))}
                                </div>
                              </>
                            : <div className="flex-1 w-2 bg-[#1F2937] rounded-full relative mt-1 min-h-0" style={{ minHeight: 60 }}>
                                <div className="absolute bottom-0 left-0 right-0 rounded-full bg-[#FF6B4A]" style={{ height: "50%" }}/>
                              </div>
                          }
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* Inspector */}
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl overflow-hidden min-h-0 flex flex-col" style={{ borderColor: inspectorAccent + "40" }}>
            <div className="px-4 py-3 border-b border-[#1F2937] flex items-center justify-between" style={{ borderBottomColor: inspectorAccent + "30" }}>
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: inspectorAccent }}>
                {inspectorContext === "master" ? "⬡ Master Chain" : selectedTrack}
              </span>
              {inspectorContext === "track" && (
                <div className="flex gap-1">
                  <button onClick={() => setInspectorView("main")} className={`px-2 py-1 rounded text-[10px] border transition ${inspectorView === "main" ? "border-[#14D8C4] text-[#14D8C4] bg-[#14D8C410]" : "border-[#1F2937] text-zinc-500"}`}>Main</button>
                  <button onClick={() => setInspectorView("sends")} className={`px-2 py-1 rounded text-[10px] border transition ${inspectorView === "sends" ? "border-[#FF6B4A] text-[#FF6B4A] bg-[#FF6B4A10]" : "border-[#1F2937] text-zinc-500"}`}>Sends</button>
                </div>
              )}
            </div>
            {inspectorContext === "master" && (
              <div className="grid grid-cols-4 border-b border-[#1F2937]">
                {(["gain","eq","saturation","limiter"] as const).map(p => (
                  <button key={p} onClick={() => setSelectedPlugin(p)}
                    className={`py-2 text-[9px] uppercase font-semibold transition border-b-2 ${selectedPlugin === p ? "border-[#F0A500] text-[#F0A500]" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
                    {p === "gain" ? "Gain" : p === "eq" ? "EQ" : p === "saturation" ? "Sat" : "Limit"}
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {inspectorContext === "master" && <>
                {selectedPlugin === "gain" && <>
                  <div className="text-center mb-2">
                    <p className="text-xs text-zinc-500 uppercase mb-1">Input Gain</p>
                    <p className="text-2xl font-bold" style={{ color: masterColor }}>{inputGain > 0 ? "+" : ""}{inputGain.toFixed(1)} dB</p>
                  </div>
                  <Knob label="Input Gain" value={inputGain} min={-20} max={20} step={0.1} unit=" dB" accent={masterColor} onChange={setInputGain}/>
                  <div className="border-t border-[#1F2937] pt-4">
                    <Knob label="Target LUFS" value={targetLUFS} min={-24} max={-6} step={0.5} unit=" LU" accent={masterColor} onChange={setTargetLUFS}/>
                  </div>
                  <div className="bg-[#0A0A0A] rounded-lg p-3 text-xs text-zinc-500 space-y-1">
                    <p>Master: <span style={{ color: masterColor }}>{project.master_lufs?.toFixed(1)} LUFS</span></p>
                    <p>Target: <span style={{ color: masterColor }}>{targetLUFS} LUFS</span></p>
                  </div>
                </>}
                {selectedPlugin === "eq" && <>
                  <p className="text-xs text-zinc-500 uppercase font-semibold">Low Shelf</p>
                  <Knob label="Frequency" value={lowShelfFreq} min={40} max={400} step={1} unit=" Hz" accent={masterColor} onChange={setLowShelfFreq}/>
                  <Knob label="Gain" value={lowShelfGain} min={-12} max={6} step={0.1} unit=" dB" accent={masterColor} onChange={setLowShelfGain}/>
                  <div className="border-t border-[#1F2937] pt-4">
                    <p className="text-xs text-zinc-500 uppercase font-semibold mb-3">High Shelf</p>
                    <Knob label="Frequency" value={highShelfFreq} min={2000} max={18000} step={100} unit=" Hz" accent={masterColor} onChange={setHighShelfFreq}/>
                    <Knob label="Gain" value={highShelfGain} min={-6} max={12} step={0.1} unit=" dB" accent={masterColor} onChange={setHighShelfGain}/>
                  </div>
                </>}
                {selectedPlugin === "saturation" && <>
                  <div className="text-center mb-2">
                    <p className="text-xs text-zinc-500 uppercase mb-1">Soft Clipper</p>
                    <p className="text-2xl font-bold" style={{ color: masterColor }}>{(saturationDrive * 100).toFixed(0)}%</p>
                  </div>
                  <Knob label="Drive Threshold" value={saturationDrive} min={0.5} max={1.0} step={0.01} unit="%" accent={masterColor} onChange={setSaturationDrive}/>
                </>}
                {selectedPlugin === "limiter" && <>
                  <div className="text-center mb-2">
                    <p className="text-xs text-zinc-500 uppercase mb-1">True Peak Ceiling</p>
                    <p className="text-2xl font-bold" style={{ color: masterColor }}>{limiterCeiling.toFixed(1)} dBTP</p>
                  </div>
                  <Knob label="Ceiling" value={limiterCeiling} min={-6} max={0} step={0.1} unit=" dBTP" accent={masterColor} onChange={setLimiterCeiling}/>
                  <div className="bg-[#0A0A0A] rounded-lg p-3 text-xs text-zinc-500 space-y-1">
                    <p>Current: <span style={{ color: masterColor }}>{project.master_true_peak?.toFixed(1)} dBTP</span></p>
                    <p>Streaming safe: <span style={{ color: trackColor }}>-1.0 dBTP</span></p>
                  </div>
                </>}
              </>}
              {inspectorContext === "track" && inspectorView === "main" && <>
                <div className="text-center mb-2">
                  <p className="text-xs text-zinc-500 uppercase mb-1">Track</p>
                  <p className="text-lg font-bold truncate" style={{ color: inspectorAccent }}>{selectedTrack}</p>
                </div>
                <Knob label="Volume" value={trackVolumes[selectedTrack] ?? 0} min={-40} max={6} step={0.1} unit=" dB" accent={inspectorAccent}
                  onChange={v => { setTrackVolumes(p => ({ ...p, [selectedTrack]: v })); if (isStemsProject) updateStemGain(selectedTrack, v); }}/>
                <Knob label="Pan" value={trackPans[selectedTrack] ?? 0} min={-100} max={100} step={1} unit="%" accent={inspectorAccent}
                  onChange={v => setTrackPans(p => ({ ...p, [selectedTrack]: v }))}/>
                <div className="border-t border-[#1F2937] pt-4 space-y-3">
                  <p className="text-[10px] text-zinc-500 uppercase font-semibold">EQ</p>
                  <div className="bg-[#0A0A0A] rounded-lg p-3 text-xs text-zinc-500 text-center">Per-track EQ coming soon</div>
                </div>
              </>}
              {inspectorContext === "track" && inspectorView === "sends" && <>
                <div className="text-center mb-2">
                  <p className="text-xs text-zinc-500 uppercase mb-1">Sends</p>
                  <p className="text-lg font-bold truncate" style={{ color: sendColor }}>{selectedTrack}</p>
                </div>
                <Knob label="Reverb Send" value={reverbSends[selectedTrack] ?? 0} min={0} max={100} step={1} unit="%" accent={sendColor}
                  onChange={v => setReverbSends(p => ({ ...p, [selectedTrack]: v }))}/>
                <Knob label="Delay Send" value={delaySends[selectedTrack] ?? 0} min={0} max={100} step={1} unit="%" accent={sendColor}
                  onChange={v => setDelaySends(p => ({ ...p, [selectedTrack]: v }))}/>
              </>}
            </div>
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

          {/* Channel Strip */}
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-3 overflow-hidden min-h-0 flex flex-col"
            style={{ borderColor: inspectorContext === "track" ? inspectorAccent + "40" : "#1F2937" }}>
            <h3 className="text-center text-[11px] font-semibold mb-2" style={{ color: inspectorAccent }}>
              {inspectorContext === "track" ? selectedTrack?.slice(0, 8) || "Track" : "Track"}
            </h3>
            <p className="text-center text-[9px] text-zinc-500 mb-3">TRACK</p>
            <div className="flex-1 min-h-0 flex items-center justify-center gap-1">
              <div className="text-[7px] text-zinc-600 flex flex-col justify-between h-full">
                {["0","-6","-12","-18","-24","-30"].map(m => <span key={m}>{m}</span>)}
              </div>
              <div className="w-3 h-full bg-[#1F2937] rounded-full relative overflow-hidden">
                <div className="absolute bottom-0 left-0 right-0 rounded-full"
                  style={{ height: `${isPlaying ? vuLevel : 0}%`, backgroundColor: vuLevel > 85 ? "#EF4444" : vuLevel > 60 ? masterColor : inspectorAccent, transition: "height 0.05s,background-color 0.1s" }}/>
              </div>
            </div>
          </div>

          {/* Master Strip */}
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-3 overflow-hidden min-h-0 flex flex-col cursor-pointer"
            style={{ borderColor: inspectorContext === "master" ? masterColor + "80" : "#1F2937" }}
            onClick={selectMaster}>
            <h3 className="text-center text-[11px] font-semibold mb-2" style={{ color: masterColor }}>MASTER</h3>
            <p className="text-center text-[9px] text-zinc-500 mb-1">{project.master_lufs?.toFixed(1)} LU</p>
            <div className="flex-1 min-h-0 flex items-center justify-center gap-1">
              <div className="text-[7px] text-zinc-600 flex flex-col justify-between h-full">
                {["0","-6","-12","-18","-24","-30"].map(m => <span key={m}>{m}</span>)}
              </div>
              <div className="w-3 h-full bg-[#1F2937] rounded-full relative overflow-hidden">
                <div className="absolute bottom-0 left-0 right-0 rounded-full"
                  style={{ height: `${isPlaying ? Math.min(100, vuLevel * 0.9) : 0}%`, backgroundColor: masterColor, transition: "height 0.05s" }}/>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}