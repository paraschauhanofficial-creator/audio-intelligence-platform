"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Trash2 } from "lucide-react";
import AudioBackground from "@/components/AudioBackground";

export default function MyProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadProjects(); }, []);

  const loadProjects = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data, error } = await supabase
      .from("projects").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) { console.error(error); return; }
    setProjects(data || []);
    setLoading(false);
  };

  const deleteProject = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      const { data: project } = await supabase.from("projects").select("master_file_path").eq("id", id).single();
      const { data: files }     = await supabase.from("project_files").select("file_path").eq("project_id", id);
      const { data: stemFiles } = await supabase.from("project_stems").select("file_path").eq("project_id", id);

      const pathsToDelete: string[] = [];
      files?.forEach(f => pathsToDelete.push(f.file_path));
      stemFiles?.forEach(f => pathsToDelete.push(f.file_path));
      if (project?.master_file_path) pathsToDelete.push(project.master_file_path);
      if (pathsToDelete.length > 0) await supabase.storage.from("project-files").remove(pathsToDelete);

      await supabase.from("project_files").delete().eq("project_id", id);
      await supabase.from("project_stems").delete().eq("project_id", id);
      await supabase.from("projects").delete().eq("id", id);

      loadProjects();
    } catch (err) { console.error(err); alert("Delete failed"); }
  };

  // Per-workflow config
  const getConfig = (workflow: string) => {
    switch (workflow) {
      case "ai_assisted":
        return {
          label: "AI Assisted", badge: null,
          color: "#00B7FF",
          buttons: (id: string) => [
            { label: "Open Project", route: `/projects/${id}`, primary: true },
          ],
        };
      case "producer_mode":
        return {
          label: "Producer Mode", badge: null,
          color: "#14D8C4",
          buttons: (id: string) => [
            { label: "Open Project", route: `/projects/${id}`,      primary: false },
            { label: "Open DAW",     route: `/projects/${id}/daw`,  primary: true  },
          ],
        };
      case "ai_assisted_stems":
        return {
          label: "AI Assisted", badge: "Stems",
          color: "#00B7FF",
          buttons: (id: string) => [
            { label: "Open Project", route: `/projects/${id}`,       primary: true  },
            { label: "Stems",        route: `/projects/${id}/stems`, primary: false },
          ],
        };
      case "producer_mode_stems":
        return {
          label: "Producer Mode", badge: "Stems",
          color: "#14D8C4",
          buttons: (id: string) => [
            { label: "Open Project", route: `/projects/${id}`,       primary: false },
            { label: "Stems",        route: `/projects/${id}/stems`, primary: false },
            { label: "Open DAW",     route: `/projects/${id}/daw`,   primary: true  },
          ],
        };
      default:
        return {
          label: "Project", badge: null,
          color: "#14D8C4",
          buttons: (id: string) => [
            { label: "Open Project", route: `/projects/${id}`, primary: true },
          ],
        };
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white relative">
      <AudioBackground />

      {/* Header */}
      <div className="border-b border-[#1F2937] px-8 py-6 relative z-10">
        <div className="flex items-center justify-between">
          <h1 className="heading-brand text-xl font-bold">
            <span className="text-white">NOKASHI</span>
            <span className="text-[#00B7FF]"> STUDIOS</span>
          </h1>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/projects")}
              className="px-4 py-2 rounded-lg border border-[#1F2937] hover:border-[#00B7FF] hover:text-[#00B7FF] transition">
              Home
            </button>
            <button className="px-4 py-2 rounded-lg border border-[#00B7FF] text-[#00B7FF]">
              My Projects
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
              className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition">
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-12 relative z-10">
        <h2 className="text-4xl font-bold mb-3">My Projects</h2>
        <p className="text-zinc-400 mb-10">Manage and track all your projects.</p>

        {loading ? (
          <p className="text-zinc-500">Loading projects...</p>
        ) : projects.length === 0 ? (
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-8 text-center">
            <h3 className="text-xl font-semibold mb-2">No Projects Yet</h3>
            <p className="text-zinc-400">Create your first project from the dashboard.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => {
              const config = getConfig(project.workflow);
              const buttons = config.buttons(project.id);
              return (
                <div key={project.id}
                  className="rounded-2xl p-6 border bg-[#111827] flex flex-col transition"
                  style={{ borderColor: config.color + "80" }}>

                  {/* Card header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold truncate">{project.name}</h3>
                    </div>
                    <button onClick={() => deleteProject(project.id, project.name)}
                      className="text-red-400 hover:text-red-300 transition ml-2 flex-shrink-0 mt-1">
                      <Trash2 size={18}/>
                    </button>
                  </div>

                  {/* Meta */}
                  <div className="space-y-1 text-sm text-zinc-400 mb-4 flex-1">
                    <div className="flex items-center gap-2">
                      <span style={{ color: config.color }}>{config.label}</span>
                      {config.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                          style={{ backgroundColor: config.color + "20", color: config.color }}>
                          {config.badge}
                        </span>
                      )}
                    </div>
                    <p>Status: <span className="text-zinc-300">{project.status}</span></p>
                    {project.genre && <p>Genre: <span className="text-zinc-300">{project.genre}</span></p>}
                    {config.badge && project.stem_count > 0 && (
                      <p>{project.stem_count} stems · {project.stems_analysed ?? 0} analysed</p>
                    )}
                  </div>

                  {/* Buttons */}
                  <div className={`grid gap-2 ${buttons.length === 1 ? "grid-cols-1" : buttons.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                    {buttons.map(btn => (
                      <button key={btn.label}
                        onClick={() => router.push(btn.route)}
                        className="py-2 rounded-lg font-semibold text-sm transition"
                        style={btn.primary
                          ? { backgroundColor: config.color, color: "#000" }
                          : { backgroundColor: "transparent", color: config.color, border: `1px solid ${config.color}50` }
                        }>
                        {btn.label}
                      </button>
                    ))}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}