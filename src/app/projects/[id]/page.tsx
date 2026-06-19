"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ProjectPage() {
  const params = useParams();

  const [project, setProject] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [daysRemaining, setDaysRemaining] = useState(0);

  useEffect(() => {
    loadProject();
  }, []);

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
        <h1 className="heading-brand text-xl font-bold">
          <span className="text-white">NOKASHI</span>
          <span className="text-[#00B7FF]"> STUDIOS</span>
        </h1>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-12">

        {/* Project Header */}

        <div className="mb-10">
          <h2 className="text-4xl font-bold">
            {project.name}
          </h2>

          <p className="text-[#00B7FF] mt-2">
            AI Assisted
          </p>
        </div>

        {/* Stats */}

        <div className="grid md:grid-cols-3 gap-6 mb-8">

          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6">
            <p className="text-zinc-400 text-sm">
              Files Uploaded
            </p>

            <h3 className="text-3xl font-bold mt-2">
              {files.length}
            </h3>
          </div>

          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6">
            <p className="text-zinc-400 text-sm">
              Days Remaining
            </p>

            <h3 className="text-3xl font-bold mt-2">
              {daysRemaining}
            </h3>
          </div>

          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6">
            <p className="text-zinc-400 text-sm">
              Workflow
            </p>

            <h3 className="text-xl font-bold mt-2 text-[#00B7FF]">
              AI Assisted
            </h3>
          </div>

        </div>

        {/* Progress */}

        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 mb-6">

          <div className="flex justify-between items-center mb-4">

            <h3 className="text-xl font-semibold">
              Processing Status
            </h3>

            <span className="px-3 py-1 rounded-full bg-[#00B7FF]/20 text-[#00B7FF] text-sm">
              {project.status}
            </span>

          </div>

          <div className="w-full bg-[#1F2937] rounded-full h-4">
            <div
              className="bg-[#00B7FF] h-4 rounded-full"
              style={{ width: "15%" }}
            />
          </div>

          <div className="mt-3 text-sm text-zinc-400">
            15% Complete
          </div>

          <div className="mt-6">
            <p className="text-zinc-400">
              Current Task
            </p>

            <p className="mt-1 font-medium">
              Waiting For AI Processing
            </p>
          </div>

        </div>

        {/* Timeline */}

        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 mb-6">

          <h3 className="text-xl font-semibold mb-6">
            Processing Timeline
          </h3>

          <div className="space-y-4">

            <div className="flex items-center gap-3">
              <span className="text-green-400">✓</span>
              <span>Project Created</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-green-400">✓</span>
              <span>Files Uploaded</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-zinc-500">○</span>
              <span>Audio Analysis</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-zinc-500">○</span>
              <span>AI Mixing</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-zinc-500">○</span>
              <span>AI Mastering</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-zinc-500">○</span>
              <span>Export Complete</span>
            </div>

          </div>

        </div>

        {/* Uploaded Files */}

        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 mb-6">

          <h3 className="text-xl font-semibold mb-4">
            Uploaded Files
          </h3>

          {files.length === 0 ? (
            <p className="text-zinc-400">
              No files uploaded.
            </p>
          ) : (
            <div className="space-y-3">

              {files.map((file) => (
                <div
                  key={file.id}
                  className="border border-[#1F2937] rounded-xl px-4 py-3"
                >
                  <p className="font-medium">
                    {file.file_name}
                  </p>

                  <p className="text-xs text-zinc-500">
                    {file.file_type}
                  </p>
                </div>
              ))}

            </div>
          )}

        </div>

        {/* Downloads */}

        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6">

          <h3 className="text-xl font-semibold mb-4">
            Downloads
          </h3>

          <p className="text-zinc-400">
            No downloadable files available yet.
          </p>

        </div>

      </div>
    </div>
  );
}