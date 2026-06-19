"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AIProjectPage() {
  const router = useRouter();

  const [projectName, setProjectName] = useState("");
  const [genre, setGenre] = useState("");
  const [creativeDirection, setCreativeDirection] = useState("");

  const handleCreateProject = async () => {
    alert("Project creation coming next step");
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
          Create AI Assisted Project
        </h2>

        <p className="text-zinc-400 mb-10">
          Tell us about your project and let AI handle the production.
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
              className="w-full bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3 outline-none focus:border-[#00B7FF]"
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
              className="w-full bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3 outline-none focus:border-[#00B7FF]"
            >
              <option value="">Select Genre</option>
              <option>Pop</option>
              <option>Rock</option>
              <option>Hip Hop</option>
              <option>EDM</option>
              <option>Jazz</option>
              <option>Classical</option>
              <option>Podcast</option>
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
              placeholder="Describe the sound, mood, instruments, references, vocal style, mix preferences, mastering target, etc."
              className="w-full bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3 outline-none focus:border-[#00B7FF]"
            />
          </div>

          {/* Future Feature */}
          <div className="border border-dashed border-[#1F2937] rounded-xl p-4 text-zinc-500">
            Reference Track Upload
            <br />
            <span className="text-sm">
              Coming Soon
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
              className="px-6 py-3 bg-[#00B7FF] text-black font-semibold rounded-xl"
            >
              Create Project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}