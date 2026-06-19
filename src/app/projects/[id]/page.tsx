"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ProjectPage() {
  const params = useParams();

  const [project, setProject] = useState<any>(null);

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

      <div className="border-b border-[#1F2937] px-8 py-6">
        <h1 className="heading-brand text-xl font-bold">
          <span className="text-white">NOKASHI</span>
          <span className="text-[#00B7FF]"> STUDIOS</span>
        </h1>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-12">

        <div className="mb-10">
          <h2 className="text-4xl font-bold">
            {project.name}
          </h2>

          <p className="text-[#00B7FF] mt-2">
            AI Assisted
          </p>
        </div>

        {/* Progress Card */}

        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 mb-6">

          <div className="flex justify-between mb-4">
            <span>Status</span>
            <span>{project.status}</span>
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

            <p className="mt-1">
              Waiting for AI Processing
            </p>
          </div>

        </div>

        {/* Uploaded Files */}

        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 mb-6">

          <h3 className="text-xl font-semibold mb-4">
            Uploaded Files
          </h3>

          <p className="text-zinc-400">
            File linking will be connected next.
          </p>

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