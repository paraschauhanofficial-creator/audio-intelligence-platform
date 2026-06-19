"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProducerProjectPage() {
  const router = useRouter();

  const [projectName, setProjectName] = useState("");
  const [genre, setGenre] = useState("");
  const [creativeDirection, setCreativeDirection] = useState("");

  const handleCreateProject = async () => {
    alert("Producer project creation coming next step");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <div className="border-b border-[#1F2937] px-8 py-6">
        <h1 className="heading-brand text-xl font-bold">
          <span className="text-white">NOKASHI</span>
          <span className="text-[#00B7FF]"> STUDIOS</span>
        </h1>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-12">
        <h2 className="text-4xl font-bold mb-3">
          Create Producer Project
        </h2>

        <p className="text-zinc-400 mb-10">
          Start with an AI-generated mix and take full control of every
          aspect of the production process.
        </p>

        <div className="space-y-6">
          {/* Project Name */}
          <div>
            <label className="block mb-2 text-sm text-zinc-400">
              Project Name
            </label>

            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="My New Song"
              className="w-full bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3 outline-none focus:border-[#14D8C4]"
            />
          </div>

          {/* Genre */}
          <div>
            <label className="block mb-2 text-sm text-zinc-400">
              Genre
            </label>

            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3 outline-none focus:border-[#14D8C4]"
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
          </div>

          {/* Creative Direction */}
          <div>
            <label className="block mb-2 text-sm text-zinc-400">
              Creative Direction
            </label>

            <textarea
              rows={6}
              value={creativeDirection}
              onChange={(e) => setCreativeDirection(e.target.value)}
              placeholder="Describe your vision, preferred sound, instruments, vocal style, mixing approach, mastering goals, stereo image, effects, and production direction."
              className="w-full bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3 outline-none focus:border-[#14D8C4]"
            />
          </div>

          {/* Producer Features Preview */}
          <div className="border border-dashed border-[#1F2937] rounded-xl p-4 text-zinc-500">
            AI Assisted Mix • DAW Workspace • Advanced Mixing Tools
            <br />
            <span className="text-sm">
              Available after project creation
            </span>
          </div>

          {/* Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => router.push("/projects")}
              className="px-6 py-3 border border-[#1F2937] rounded-xl"
            >
              Cancel
            </button>

            <button
              onClick={handleCreateProject}
              className="px-6 py-3 bg-[#14D8C4] text-black font-semibold rounded-xl"
            >
              Create Project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}