"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import AudioBackground from "@/components/AudioBackground";
import { Shield, Crown, User as UserIcon, Music2, Mic2, Sparkles, HardDrive, Waves } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "super_user" | "user";
  plan: "free" | "pro" | "studio";
  created_at: string;
}

interface ProjectStats {
  total: number;
  mixProjects: number;
  stemsProjects: number;
  completed: number;
}

const PLAN_DISPLAY: Record<string, { projects: string; color: string }> = {
  free:   { projects: "2 total",   color: "#6B7280" },
  pro:    { projects: "5 / month", color: "#00B7FF" },
  studio: { projects: "Unlimited", color: "#F0A500" },
};

import { EGRESS_BUDGET, STORAGE_BUDGET, checkUsageSlabsAndNotify } from "@/lib/usageTracking";

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function Meter({
  label, used, total, color, icon: Icon, note, isDarkMode,
}: { label: string; used: number; total: number; color: string; icon: any; note?: string; isDarkMode: boolean }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const isHot  = pct >= 90;
  const isWarm = pct >= 70 && pct < 90;
  const barColor = isHot ? "#FF6B4A" : isWarm ? "#F0A500" : color;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          <Icon size={13} style={{ color: "var(--text-muted)" }} />
          {label}
        </span>
        <span className="text-xs" style={{ color: "var(--text)" }}>
          {formatBytes(used)} <span style={{ color: "var(--text-muted)" }}>/ {formatBytes(total)}</span>
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      {isHot && (
        <p className="text-[11px] mt-1" style={{ color: "#FF6B4A" }}>
          You're close to your {label.toLowerCase()} limit — consider upgrading or freeing up space.
        </p>
      )}
      {note && !isHot && <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{note}</p>}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile]               = useState<Profile | null>(null);
  const [stats, setStats]                   = useState<ProjectStats>({ total: 0, mixProjects: 0, stemsProjects: 0, completed: 0 });
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [editingName, setEditingName]       = useState(false);
  const [nameInput, setNameInput]           = useState("");
  const [storageUsedBytes, setStorageUsedBytes]           = useState(0);
  const [egressUsedBytes, setEgressUsedBytes]             = useState(0);
  const [egressTrackingAvailable, setEgressTrackingAvailable] = useState(true);

  // Theme — identical pattern to every other migrated page (see projects/page.tsx)
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [parallax, setParallax]     = useState({ x: 0, y: 0 });

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

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: profileData, error } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();

    if (error || !profileData) { console.error(error); setLoading(false); return; }

    setProfile(profileData);
    setNameInput(profileData.full_name || "");

    const { data: projects } = await supabase
      .from("projects").select("workflow, status, created_at, name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (projects) {
      const mixProjects   = projects.filter(p => p.workflow === "ai_assisted" || p.workflow === "producer_mode").length;
      const stemsProjects = projects.filter(p => p.workflow === "ai_assisted_stems" || p.workflow === "producer_mode_stems").length;
      const completed     = projects.filter(p => p.status === "completed").length;
      setStats({ total: projects.length, mixProjects, stemsProjects, completed });
      setRecentProjects(projects.slice(0, 5));
    }

    const [{ data: mixFiles }, { data: stemFiles }] = await Promise.all([
      supabase.from("project_files").select("file_size").eq("user_id", user.id),
      supabase.from("project_stems").select("file_size").eq("user_id", user.id),
    ]);
    const mixBytes  = (mixFiles  ?? []).reduce((sum, f: any) => sum + (f.file_size ?? 0), 0);
    const stemBytes = (stemFiles ?? []).reduce((sum, f: any) => sum + (f.file_size ?? 0), 0);
    setStorageUsedBytes(mixBytes + stemBytes);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: events, error: eventsErr } = await supabase
      .from("usage_events")
      .select("bytes_actual")
      .eq("user_id", user.id)
      .gte("created_at", startOfMonth.toISOString());

    if (eventsErr) {
      setEgressTrackingAvailable(false);
    } else {
      setEgressUsedBytes((events ?? []).reduce((sum, e: any) => sum + (e.bytes_actual ?? 0), 0));
    }

    checkUsageSlabsAndNotify();
    setLoading(false);
  };

  const saveName = async () => {
    if (!profile) return;
    const { error } = await supabase.from("profiles").update({ full_name: nameInput.trim() || null }).eq("id", profile.id);
    if (!error) {
      setProfile({ ...profile, full_name: nameInput.trim() || null });
      setEditingName(false);
    }
  };

  const accentColor = "#00B7FF";

  const roleBadge = (role: string) => {
    switch (role) {
      case "admin":      return { label: "Admin",      color: "#FF6B4A", icon: Shield };
      case "super_user": return { label: "Super User", color: "#F0A500", icon: Crown  };
      default:           return null;
    }
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen relative" style={{ backgroundColor: "var(--background)", color: "var(--text)" }}>
        <AudioBackground parallax={parallax} lightMode={!isDarkMode} />
        <Navbar accentColor={accentColor} />
        <div className="relative z-10 flex items-center justify-center h-[60vh]" style={{ color: "var(--text-muted)" }}>
          Loading profile...
        </div>
      </div>
    );
  }

  const badge            = roleBadge(profile.role);
  const planDisplay      = PLAN_DISPLAY[profile.plan];
  const planStorageBytes = STORAGE_BUDGET[profile.plan];
  const egressBudget     = EGRESS_BUDGET[profile.plan];
  const initials         = (profile.full_name || profile.email).slice(0, 2).toUpperCase();
  const isUnlimited      = profile.role === "admin" || profile.role === "super_user";
  const inputBg          = isDarkMode ? "#0A0A0A" : "rgba(255,255,255,0.6)";

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: "var(--background)", color: "var(--text)" }}>
      <AudioBackground parallax={parallax} lightMode={!isDarkMode} />
      <div className="relative z-20">
        <Navbar accentColor={accentColor} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-8 py-12">

        {/* Identity card */}
        <div className="backdrop-blur-sm rounded-2xl p-8 mb-6 flex items-center gap-6 border"
          style={{ backgroundColor: isDarkMode ? "rgba(17,24,39,0.8)" : "rgba(234,228,216,0.85)", borderColor: "var(--border)" }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0"
            style={{ backgroundColor: accentColor + "20", color: accentColor }}>
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text" value={nameInput} onChange={e => setNameInput(e.target.value)}
                    placeholder="Your name"
                    className="rounded-lg px-3 py-1.5 text-xl font-bold focus:outline-none border transition"
                    style={{ backgroundColor: inputBg, borderColor: "var(--border)", color: "var(--text)" }}
                    onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
                    onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}
                    autoFocus
                  />
                  <button onClick={saveName} className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: accentColor, color: "#000" }}>Save</button>
                  <button onClick={() => { setEditingName(false); setNameInput(profile.full_name || ""); }}
                    className="px-3 py-1.5 rounded-lg border text-sm transition"
                    style={{ borderColor: "var(--border)", color: "var(--text)" }}>Cancel</button>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold" style={{ color: "var(--text)" }}>{profile.full_name || "Add your name"}</h2>
                  <button onClick={() => setEditingName(true)} className="text-xs transition" style={{ color: "var(--text-muted)" }}>Edit</button>
                </>
              )}

              {badge && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-full"
                  style={{ backgroundColor: badge.color + "20", color: badge.color }}>
                  <badge.icon size={11} />
                  {badge.label}
                </span>
              )}
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{profile.email}</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Member since {new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-6 mb-6">

          {/* Plan card */}
          <div className="backdrop-blur-sm rounded-2xl p-6 border"
            style={{ backgroundColor: isDarkMode ? "rgba(17,24,39,0.8)" : "rgba(234,228,216,0.85)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Current Plan</h3>
              {isUnlimited ? (
                <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full"
                  style={{ backgroundColor: "#F0A50020", color: "#F0A500" }}>
                  Unlimited Access
                </span>
              ) : (
                <button onClick={() => router.push("/projects/upgrade")}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                  style={{ backgroundColor: "#F0A50020", color: "#F0A500" }}>
                  <Sparkles size={12} />
                  Upgrade
                </button>
              )}
            </div>

            {isUnlimited ? (
              <>
                <div className="text-center py-4">
                  <Crown size={32} className="mx-auto mb-2" style={{ color: "#F0A500" }} />
                  <p className="text-lg font-bold" style={{ color: "#F0A500" }}>
                    {profile.role === "admin" ? "Administrator" : "Super User"}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Unlimited feature access — generous resource ceiling still applies</p>
                </div>
                <div className="space-y-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <Meter label="Project storage" used={storageUsedBytes} total={25 * 1024 * 1024 * 1024} color="#F0A500" icon={HardDrive} isDarkMode={isDarkMode} />
                  {egressTrackingAvailable ? (
                    <Meter label="Preview & playback (this month)" used={egressUsedBytes} total={20 * 1024 * 1024 * 1024} color="#F0A500" icon={Waves} isDarkMode={isDarkMode}
                      note="Real bytes transferred this month — admin/super_user are capped at the same ceiling as Studio, not literal infinity." />
                  ) : (
                    <div>
                      <span className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
                        <Waves size={13} style={{ color: "var(--text-muted)" }} />
                        Preview & playback
                      </span>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Usage tracking not set up yet for this account.</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-3xl font-bold capitalize mb-4" style={{ color: planDisplay.color }}>{profile.plan}</p>
                <div className="space-y-3 mb-5">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--text-muted)" }}>Storage limit</span>
                    <span style={{ color: "var(--text)" }}>{formatBytes(planStorageBytes)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--text-muted)" }}>Projects</span>
                    <span style={{ color: "var(--text)" }}>{planDisplay.projects}</span>
                  </div>
                </div>
                <div className="space-y-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <Meter label="Project storage" used={storageUsedBytes} total={planStorageBytes} color={planDisplay.color} icon={HardDrive} isDarkMode={isDarkMode} />
                  {egressTrackingAvailable ? (
                    <Meter label="Preview & playback (this month)" used={egressUsedBytes} total={egressBudget} color={planDisplay.color} icon={Waves} isDarkMode={isDarkMode}
                      note="Real bytes transferred this month — not your exact Supabase bill (cached egress is billed cheaper by Supabase but counted at full size here)." />
                  ) : (
                    <div>
                      <span className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
                        <Waves size={13} style={{ color: "var(--text-muted)" }} />
                        Preview & playback
                      </span>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Usage tracking not set up yet for this account.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Stats grid */}
          <div className="backdrop-blur-sm rounded-2xl p-6 border"
            style={{ backgroundColor: isDarkMode ? "rgba(17,24,39,0.8)" : "rgba(234,228,216,0.85)", borderColor: "var(--border)" }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text)" }}>Your Activity</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl p-4" style={{ backgroundColor: "var(--background)" }}>
                <p className="text-3xl font-bold" style={{ color: accentColor }}>{stats.total}</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Total Projects</p>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: "var(--background)" }}>
                <p className="text-3xl font-bold" style={{ color: "#14D8C4" }}>{stats.completed}</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Completed</p>
              </div>
              <div className="rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: "var(--background)" }}>
                <Music2 size={20} style={{ color: "var(--text-muted)" }} />
                <div>
                  <p className="text-xl font-bold" style={{ color: "var(--text)" }}>{stats.mixProjects}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Mix Projects</p>
                </div>
              </div>
              <div className="rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: "var(--background)" }}>
                <Mic2 size={20} style={{ color: "var(--text-muted)" }} />
                <div>
                  <p className="text-xl font-bold" style={{ color: "var(--text)" }}>{stats.stemsProjects}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Stems Projects</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent projects */}
        <div className="backdrop-blur-sm rounded-2xl p-6 border"
          style={{ backgroundColor: isDarkMode ? "rgba(17,24,39,0.8)" : "rgba(234,228,216,0.85)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Recent Projects</h3>
            <button onClick={() => router.push("/projects/list")} className="text-xs transition"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}>
              View all
            </button>
          </div>

          {recentProjects.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>No projects yet. Start creating!</p>
          ) : (
            <div className="space-y-2">
              {recentProjects.map((p, i) => {
                const isProducer = p.workflow?.includes("producer");
                const color = isProducer ? "#14D8C4" : "#00B7FF";
                const isStems = p.workflow?.includes("stems");
                return (
                  <div key={i} className="flex items-center justify-between px-4 py-3 rounded-lg border transition"
                    style={{ borderColor: "var(--border)" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = isDarkMode ? "#374151" : "#a1a1aa")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
                    <div className="flex items-center gap-3">
                      {isStems ? <Mic2 size={16} style={{ color }} /> : <Music2 size={16} style={{ color }} />}
                      <span className="text-sm" style={{ color: "var(--text)" }}>{p.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: p.status === "completed" ? "#14D8C420" : "#F0A50020", color: p.status === "completed" ? "#14D8C4" : "#F0A500" }}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}