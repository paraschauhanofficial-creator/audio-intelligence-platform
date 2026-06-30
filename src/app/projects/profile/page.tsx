"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import AudioBackground from "@/components/AudioBackground";
import { Shield, Crown, User as UserIcon, Music2, Mic2, Sparkles } from "lucide-react";

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

const PLAN_LIMITS: Record<string, { storage: string; projects: string; color: string }> = {
  free:   { storage: "1 GB",   projects: "3 / month",     color: "#6B7280" },
  pro:    { storage: "25 GB",  projects: "Unlimited",     color: "#00B7FF" },
  studio: { storage: "100 GB", projects: "Unlimited",     color: "#F0A500" },
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<ProjectStats>({ total: 0, mixProjects: 0, stemsProjects: 0, completed: 0 });
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

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
      case "admin":
        return { label: "Admin", color: "#FF6B4A", icon: Shield };
      case "super_user":
        return { label: "Super User", color: "#F0A500", icon: Crown };
      default:
        return null;
    }
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white relative">
        <AudioBackground />
        <Navbar accentColor={accentColor} />
        <div className="relative z-10 flex items-center justify-center h-[60vh] text-zinc-500">Loading profile...</div>
      </div>
    );
  }

  const badge = roleBadge(profile.role);
  const planInfo = PLAN_LIMITS[profile.plan];
  const initials = (profile.full_name || profile.email).slice(0, 2).toUpperCase();
  const isUnlimited = profile.role === "admin" || profile.role === "super_user";

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white relative">
      <AudioBackground />
      <Navbar accentColor={accentColor} />

      <div className="relative z-10 max-w-5xl mx-auto px-8 py-12">

        {/* Identity card */}
        <div className="bg-[#111827]/80 backdrop-blur-sm border border-[#1F2937] rounded-2xl p-8 mb-6 flex items-center gap-6">
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
                    className="bg-[#0A0A0A] border border-[#1F2937] rounded-lg px-3 py-1.5 text-xl font-bold focus:outline-none focus:border-[#00B7FF]"
                    autoFocus
                  />
                  <button onClick={saveName} className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: accentColor, color: "#000" }}>Save</button>
                  <button onClick={() => { setEditingName(false); setNameInput(profile.full_name || ""); }} className="px-3 py-1.5 rounded-lg border border-[#1F2937] text-sm">Cancel</button>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold">{profile.full_name || "Add your name"}</h2>
                  <button onClick={() => setEditingName(true)} className="text-xs text-zinc-500 hover:text-zinc-300 transition">Edit</button>
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
            <p className="text-zinc-400 text-sm">{profile.email}</p>
            <p className="text-zinc-600 text-xs mt-1">
              Member since {new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-6 mb-6">

          {/* Plan card */}
          <div className="bg-[#111827]/80 backdrop-blur-sm border border-[#1F2937] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Current Plan</h3>
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
              <div className="text-center py-6">
                <Crown size={40} className="mx-auto mb-3" style={{ color: "#F0A500" }} />
                <p className="text-xl font-bold" style={{ color: "#F0A500" }}>
                  {profile.role === "admin" ? "Administrator" : "Super User"}
                </p>
                <p className="text-sm text-zinc-500 mt-1">Full unlimited access — no restrictions</p>
              </div>
            ) : (
              <>
                <p className="text-3xl font-bold capitalize mb-4" style={{ color: planInfo.color }}>{profile.plan}</p>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Storage</span>
                    <span className="text-zinc-200">{planInfo.storage}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Projects</span>
                    <span className="text-zinc-200">{planInfo.projects}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Stats grid */}
          <div className="bg-[#111827]/80 backdrop-blur-sm border border-[#1F2937] rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">Your Activity</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0A0A0A] rounded-xl p-4">
                <p className="text-3xl font-bold" style={{ color: accentColor }}>{stats.total}</p>
                <p className="text-xs text-zinc-500 mt-1">Total Projects</p>
              </div>
              <div className="bg-[#0A0A0A] rounded-xl p-4">
                <p className="text-3xl font-bold" style={{ color: "#14D8C4" }}>{stats.completed}</p>
                <p className="text-xs text-zinc-500 mt-1">Completed</p>
              </div>
              <div className="bg-[#0A0A0A] rounded-xl p-4 flex items-center gap-3">
                <Music2 size={20} className="text-zinc-600" />
                <div>
                  <p className="text-xl font-bold text-zinc-200">{stats.mixProjects}</p>
                  <p className="text-xs text-zinc-500">Mix Projects</p>
                </div>
              </div>
              <div className="bg-[#0A0A0A] rounded-xl p-4 flex items-center gap-3">
                <Mic2 size={20} className="text-zinc-600" />
                <div>
                  <p className="text-xl font-bold text-zinc-200">{stats.stemsProjects}</p>
                  <p className="text-xs text-zinc-500">Stems Projects</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent projects */}
        <div className="bg-[#111827]/80 backdrop-blur-sm border border-[#1F2937] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent Projects</h3>
            <button onClick={() => router.push("/projects/list")} className="text-xs text-zinc-500 hover:text-zinc-300 transition">View all</button>
          </div>

          {recentProjects.length === 0 ? (
            <p className="text-sm text-zinc-600 text-center py-8">No projects yet. Start creating!</p>
          ) : (
            <div className="space-y-2">
              {recentProjects.map((p, i) => {
                const isStems = p.workflow?.includes("stems");
                const isProducer = p.workflow?.includes("producer");
                const color = isProducer ? "#14D8C4" : "#00B7FF";
                return (
                  <div key={i} className="flex items-center justify-between px-4 py-3 rounded-lg border border-[#1F2937] hover:border-[#374151] transition">
                    <div className="flex items-center gap-3">
                      {isStems ? <Mic2 size={16} style={{ color }} /> : <Music2 size={16} style={{ color }} />}
                      <span className="text-sm text-zinc-200">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-600">
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