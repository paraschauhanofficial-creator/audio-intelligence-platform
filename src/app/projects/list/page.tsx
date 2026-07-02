"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AudioBackground from "@/components/AudioBackground";
import Navbar from "@/components/Navbar";

interface Project {
  id: string;
  name: string;
  workflow: string;
  processing_stage: string;
  current_task: string;
  progress: number;
  created_at: string;
  master_file_path: string | null;
}

const STAGE_COLORS: Record<string, string> = {
  completed:  "#00C9A7",
  processing: "#F0A500",
  uploaded:   "#00B7FF",
  analysed:   "#A78BFA",
  error:      "#FF6B4A",
};

const STAGE_LABEL: Record<string, string> = {
  completed:  "Completed",
  processing: "Processing",
  uploaded:   "Uploaded",
  analysed:   "Analysed",
  error:      "Error",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function ProjectCard({
  project, accentColor, isDarkMode,
}: {
  project: Project;
  accentColor: string;
  isDarkMode: boolean;
}) {
  const router = useRouter();
  const stage = (project.processing_stage ?? "uploaded").toLowerCase();
  const stageColor = STAGE_COLORS[stage] ?? "#71717A";
  const textColor = isDarkMode ? "#ffffff" : "#1A1714";
  const mutedColor = isDarkMode ? "#a1a1aa" : "#6B6560";

  const isStems = project.workflow === "ai_assisted_stems" || project.workflow === "producer_mode_stems";
  const isProducer = project.workflow === "producer_mode" || project.workflow === "producer_mode_stems";

  return (
    <div
      className="flex-shrink-0 rounded-2xl p-5 select-none transition-all duration-200"
      style={{
        width: 280,
        backgroundColor: isDarkMode ? "rgba(17,24,39,0.88)" : "rgba(234,228,216,0.92)",
        border: `1px solid ${isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
        backdropFilter: "blur(12px)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.border = `1px solid ${accentColor}50`;
        e.currentTarget.style.boxShadow = `0 0 24px ${accentColor}18`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.border = `1px solid ${isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`;
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Accent bar */}
      <div className="w-6 h-[2px] rounded-full mb-4" style={{ backgroundColor: accentColor }} />

      {/* Name */}
      <h3 className="text-base font-bold mb-1 truncate" style={{ color: textColor }}>
        {project.name}
      </h3>

      {/* Date */}
      <p className="text-xs mb-3" style={{ color: mutedColor }}>
        {formatDate(project.created_at)}
      </p>

      {/* Tags */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Workflow type tag */}
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: (isStems ? "#A78BFA" : "#71717A") + "20",
            color: isStems ? "#A78BFA" : "#71717A",
            border: `1px solid ${isStems ? "#A78BFA" : "#71717A"}40`,
          }}
        >
          {isStems ? "Stems" : "Mix"}
        </span>

        {/* Stage badge */}
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: stageColor + "20",
            color: stageColor,
            border: `1px solid ${stageColor}40`,
          }}
        >
          {STAGE_LABEL[stage] ?? stage}
        </span>
      </div>

      {/* Progress bar — only when processing */}
      {stage === "processing" && (
        <div className="mb-4">
          <div className="w-full h-1 rounded-full mb-1"
            style={{ backgroundColor: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${project.progress ?? 0}%`, backgroundColor: accentColor }}
            />
          </div>
          <p className="text-[10px] truncate" style={{ color: mutedColor }}>
            {project.current_task}
          </p>
        </div>
      )}

      {/* Action buttons — routing matches original list page logic exactly */}
      <div className="flex flex-col gap-2 mt-2">

        {/* Open Project — goes to /projects/[id] for all workflows */}
        <button
          onClick={() => router.push(`/projects/${project.id}`)}
          className="w-full py-2 rounded-xl text-xs font-semibold transition-all duration-200"
          style={{
            backgroundColor: accentColor + "15",
            color: accentColor,
            border: `1px solid ${accentColor}30`,
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = accentColor + "30"}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = accentColor + "15"}
        >
          Open Project →
        </button>

        {/* Open Stems — only for stems projects */}
        {isStems && (
          <button
            onClick={() => router.push(`/projects/${project.id}/stems`)}
            className="w-full py-2 rounded-xl text-xs font-semibold transition-all duration-200"
            style={{
              backgroundColor: "#A78BFA15",
              color: "#A78BFA",
              border: "1px solid #A78BFA30",
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = "#A78BFA30"}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = "#A78BFA15"}
          >
            Open Stems →
          </button>
        )}

        {/* Open DAW — only for producer_mode and producer_mode_stems */}
        {isProducer && (
          <button
            onClick={() => router.push(`/projects/${project.id}/daw`)}
            className="w-full py-2 rounded-xl text-xs font-semibold transition-all duration-200"
            style={{
              backgroundColor: "#14D8C415",
              color: "#14D8C4",
              border: "1px solid #14D8C430",
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = "#14D8C430"}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = "#14D8C415"}
          >
            Open DAW →
          </button>
        )}

      </div>
    </div>
  );
}

function ProjectRow({
  title, subtitle, accentColor, projects, isDarkMode,
}: {
  title: string;
  subtitle: string;
  accentColor: string;
  projects: Project[];
  isDarkMode: boolean;
}) {
  const router = useRouter();
  const textColor = isDarkMode ? "#ffffff" : "#1A1714";
  const mutedColor = isDarkMode ? "#a1a1aa" : "#6B6560";

  return (
    <div className="mb-14">
      {/* Section header */}
      <div className="flex items-end gap-4 mb-5 px-8">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1"
            style={{ color: accentColor }}>
            {subtitle}
          </p>
          <h2 className="text-2xl font-bold" style={{ color: textColor }}>
            {title}
          </h2>
        </div>
        <span className="text-sm mb-0.5" style={{ color: mutedColor }}>
          {projects.length} project{projects.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Empty state */}
      {projects.length === 0 ? (
        <div
          className="mx-8 rounded-2xl flex flex-col items-center justify-center py-12 cursor-pointer transition-all duration-200"
          style={{
            backgroundColor: isDarkMode ? "rgba(17,24,39,0.5)" : "rgba(234,228,216,0.5)",
            border: `1px dashed ${accentColor}40`,
          }}
          onClick={() => router.push("/projects")}
          onMouseEnter={e => e.currentTarget.style.borderColor = accentColor + "80"}
          onMouseLeave={e => e.currentTarget.style.borderColor = accentColor + "40"}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: accentColor + "20" }}
          >
            <span style={{ color: accentColor, fontSize: 20 }}>+</span>
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: textColor }}>
            No projects yet
          </p>
          <p className="text-xs" style={{ color: mutedColor }}>
            Create your first {title} project
          </p>
        </div>
      ) : (
        /* Horizontal scroll row */
        <div
          className="flex gap-4 overflow-x-auto pb-3"
          style={{
            paddingLeft: 32,
            paddingRight: 32,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {projects.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              accentColor={accentColor}
              isDarkMode={isDarkMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectsListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("nokashi-theme");
    setIsDarkMode(saved !== "light");
    const observer = new MutationObserver(() => {
      setIsDarkMode(!document.documentElement.classList.contains("theme-light"));
    });
    observer.observe(document.documentElement, {
      attributes: true, attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * -14;
      const y = (e.clientY / window.innerHeight - 0.5) * -10;
      setParallax({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, workflow, processing_stage, current_task, progress, created_at, master_file_path")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (!error) setProjects(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const aiProjects = projects.filter(
    p => p.workflow === "ai_assisted" || p.workflow === "ai_assisted_stems"
  );
  const producerProjects = projects.filter(
    p => p.workflow === "producer_mode" || p.workflow === "producer_mode_stems"
  );

  const textColor = isDarkMode ? "#ffffff" : "#1A1714";
  const mutedColor = isDarkMode ? "#a1a1aa" : "#6B6560";

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ backgroundColor: "var(--background)", color: "var(--text)" }}
    >
      <AudioBackground parallax={parallax} lightMode={!isDarkMode} />

      {/* Scribble SVG layer */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          transform: `translate(${parallax.x * 1.8}px, ${parallax.y * 1.8}px)`,
          transition: "transform 0.18s ease-out",
          willChange: "transform",
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">

          {/* Flowing lines */}
          <path
            d="M -40 480 C 80 460, 160 520, 240 480 C 320 440, 360 560, 460 520 C 560 480, 600 600, 720 580 C 840 560, 880 700, 980 660 C 1040 640, 1060 720, 1060 780 C 1060 840, 1100 880, 1160 880 C 1220 880, 1260 840, 1260 780 C 1260 740, 1240 720, 1200 700 C 1200 620, 1200 580, 1260 520 C 1380 480, 1440 460, 1480 440"
            fill="none"
            stroke={isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          />
          <path
            d="M -40 200 C 120 180, 240 240, 400 200 C 560 160, 620 260, 800 220 C 960 180, 1060 240, 1200 200 C 1320 170, 1400 200, 1480 180"
            fill="none"
            stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
            strokeWidth="1" strokeLinecap="round"
          />

          {/* Headphones — bottom right */}
          <path d="M 1100 780 C 1100 700, 1160 660, 1220 660 C 1280 660, 1340 700, 1340 780"
            fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}
            strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="1100" cy="795" r="18" fill="none"
            stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />
          <circle cx="1340" cy="795" r="18" fill="none"
            stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />

          {/* Sitar — top left */}
          <ellipse cx="80" cy="200" rx="40" ry="50" fill="none"
            stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1.5" />
          <ellipse cx="80" cy="135" rx="20" ry="24" fill="none"
            stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1.5" />
          <line x1="80" y1="111" x2="80" y2="20"
            stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
            strokeWidth="2" strokeLinecap="round" />
          {[75,78,80,82,85].map((x,i) => (
            <line key={i} x1={x} y1="20" x2={x} y2="240"
              stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} strokeWidth="0.8" />
          ))}

          {/* Bansuri — top center */}
          <line x1="500" y1="30" x2="780" y2="60"
            stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
            strokeWidth="2" strokeLinecap="round" />
          {[0,1,2,3,4,5].map(i => (
            <circle key={i} cx={530+i*36} cy={35+i*5} r="4" fill="none"
              stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1.2" />
          ))}

          {/* Microphone — top right */}
          <path d="M 1340 60 C 1340 20, 1400 20, 1400 60 L 1400 120 C 1400 160, 1340 160, 1340 120 Z"
            fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1.5" />
          <line x1="1370" y1="160" x2="1370" y2="220"
            stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
            strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 1340 220 C 1340 240, 1400 240, 1400 220" fill="none"
            stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
            strokeWidth="1.5" strokeLinecap="round" />

          {/* Tabla — right middle */}
          <ellipse cx="1340" cy="500" rx="32" ry="13" fill="none"
            stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1.5" />
          <path d="M 1308 500 L 1304 560 C 1304 576, 1372 576, 1372 560 L 1372 500"
            fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
            strokeWidth="1.5" strokeLinecap="round" />

          {/* Piano — bottom left */}
          {[0,1,2,3,4,5,6].map(i => (
            <rect key={i} x={40+i*28} y={820} width="24" height="60" rx="3" fill="none"
              stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1.5" />
          ))}
          {[0,1,3,4,5].map(i => (
            <rect key={i} x={57+i*28} y={820} width="14" height="38" rx="2" fill="none"
              stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1.5" />
          ))}

          {/* Waveform — center */}
          <path d="M 620 440 L 640 440 L 650 410 L 660 470 L 670 425 L 680 460 L 690 435 L 700 455 L 710 440 L 730 440"
            fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* EQ bars — bottom center */}
          {[28,45,36,60,48,40,55,30].map((h,i) => (
            <rect key={i} x={680+i*20} y={800-h} width="14" height={h} rx="3" fill="none"
              stroke={isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"} strokeWidth="1" />
          ))}

          {/* Tanpura — far right */}
          <ellipse cx="1420" cy="580" rx="36" ry="46" fill="none"
            stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1.5" />
          <ellipse cx="1420" cy="518" rx="18" ry="22" fill="none"
            stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1.5" />
          <line x1="1420" y1="496" x2="1420" y2="380"
            stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
            strokeWidth="2" strokeLinecap="round" />
          {[1415,1418,1422,1425].map((x,i) => (
            <line key={i} x1={x} y1="380" x2={x} y2="620"
              stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} strokeWidth="0.8" />
          ))}

        </svg>
      </div>

      <div className="relative z-20">
        <Navbar accentColor="#00B7FF" />
      </div>

      <div className="relative z-10 pt-10 pb-20">

        {/* Page header */}
        <div
          className="px-8 mb-10"
          style={{
            transform: `translate(${parallax.x * 0.3}px, ${parallax.y * 0.3}px)`,
            transition: "transform 0.2s ease-out",
          }}
        >
          <h1 className="text-4xl font-bold mb-2" style={{ color: textColor }}>
            My Projects
          </h1>
          <p className="text-sm" style={{ color: mutedColor }}>
            {loading
              ? "Loading..."
              : `${projects.length} project${projects.length !== 1 ? "s" : ""} total`}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 rounded-full border-2 border-[#00B7FF] border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            <ProjectRow
              title="You Handle It"
              subtitle="AI Automated"
              accentColor="#00B7FF"
              projects={aiProjects}
              isDarkMode={isDarkMode}
            />
            <ProjectRow
              title="Take Control"
              subtitle="AI + DAW"
              accentColor="#14D8C4"
              projects={producerProjects}
              isDarkMode={isDarkMode}
            />
          </>
        )}

      </div>
    </div>
  );
}