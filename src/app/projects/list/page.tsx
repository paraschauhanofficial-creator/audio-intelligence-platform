"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Trash2 } from "lucide-react";

export default function MyProjectsPage() {
const router = useRouter();

const [projects, setProjects] = useState<any[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
loadProjects();
}, []);

const loadProjects = async () => {
const {
data: { user },
} = await supabase.auth.getUser();


if (!user) {
  router.push("/login");
  return;
}

const { data, error } = await supabase
  .from("projects")
  .select("*")
  .eq("user_id", user.id)
  .order("created_at", { ascending: false });

if (error) {
  console.error(error);
  return;
}

setProjects(data || []);
setLoading(false);


};




const deleteProject = async (
  id: string,
  name: string
) => {
  const confirmed = window.confirm(
    `Are you sure you want to delete "${name}"?`
  );

  if (!confirmed) return;

  try {
    // Get all files belonging to project

    const { data: files, error: filesError } =
      await supabase
        .from("project_files")
        .select("*")
        .eq("project_id", id);

    if (filesError) {
      alert(filesError.message);
      return;
    }

    // Delete files from storage

    if (files && files.length > 0) {
      const filePaths = files.map(
        (file) => file.file_path
      );

      const { error: storageError } =
        await supabase.storage
          .from("project-files")
          .remove(filePaths);

      if (storageError) {
        alert(storageError.message);
        return;
      }
    }

    // Delete file references

    const { error: projectFilesError } =
      await supabase
        .from("project_files")
        .delete()
        .eq("project_id", id);

    if (projectFilesError) {
      alert(projectFilesError.message);
      return;
    }

    // Delete project

    const { error: projectError } =
      await supabase
        .from("projects")
        .delete()
        .eq("id", id);

    if (projectError) {
      alert(projectError.message);
      return;
    }

    loadProjects();

  } catch (err) {
    console.error(err);
    alert("Delete failed");
  }
};





return ( <div className="min-h-screen bg-[#0A0A0A] text-white"> 
<div className="border-b border-[#1F2937] px-8 py-6">

  <div className="flex items-center justify-between">

    <h1 className="heading-brand text-xl font-bold">
      <span className="text-white">NOKASHI</span>
      <span className="text-[#00B7FF]"> STUDIOS</span>
    </h1>

    <div className="flex items-center gap-3">

      <button
        onClick={() => router.push("/projects")}
        className="px-4 py-2 rounded-lg border border-[#1F2937] hover:border-[#00B7FF] hover:text-[#00B7FF] transition"
      >
        Home
      </button>

      <button
        className="px-4 py-2 rounded-lg border border-[#00B7FF] text-[#00B7FF]"
      >
        My Projects
      </button>

      <button
        onClick={async () => {
          await supabase.auth.signOut();
          router.push("/login");
        }}
        className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
      >
        Logout
      </button>

    </div>

  </div>

</div>


  <div className="max-w-7xl mx-auto px-8 py-12">
    <h2 className="text-4xl font-bold mb-3">
      My Projects
    </h2>

    <p className="text-zinc-400 mb-10">
      Manage and track all your projects.
    </p>

    {loading ? (
      <p className="text-zinc-500">
        Loading projects...
      </p>
    ) : projects.length === 0 ? (
      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-8 text-center">
        <h3 className="text-xl font-semibold mb-2">
          No Projects Yet
        </h3>

        <p className="text-zinc-400">
          Create your first project from the dashboard.
        </p>
      </div>
    ) : (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => {
          const isAI =
            project.workflow === "ai_assisted";

          return (
            <div
              key={project.id}
              className={`rounded-2xl p-6 border transition ${
                isAI
                  ? "bg-[#111827] border-[#00B7FF]"
                  : "bg-[#111827] border-[#14D8C4]"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-xl font-bold">
                  {project.name}
                </h3>

                <button
                  onClick={() =>
                    deleteProject(
                      project.id,
                      project.name
                    )
                  }
                  className="text-red-400 hover:text-red-300 transition"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="space-y-2 text-sm text-zinc-400">
                <p>
                  Workflow:{" "}
                  {isAI
                    ? "AI Assisted"
                    : "Producer Mode"}
                </p>

                <p>
                  Status: {project.status}
                </p>

                <p>
                  Genre: {project.genre}
                </p>
              </div>

              <button
                onClick={() =>
                router.push(`/projects/${project.id}`)
                 }
                 className={`mt-6 w-full py-2 rounded-lg font-semibold ${
                  isAI
                 ? "bg-[#00B7FF] text-black"
                  : "bg-[#14D8C4] text-black"
                    }`}
                >
                Open Project
              </button>
            </div>
          );
        })}
      </div>
    )}
  </div>
</div>
);
}
