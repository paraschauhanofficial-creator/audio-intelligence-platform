"use client";

import { useRouter } from "next/navigation";

export default function MyProjectsPage() {
  const router = useRouter();

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
        <h2 className="text-4xl font-bold mb-3">
          My Projects
        </h2>

        <p className="text-zinc-400 mb-10">
          Manage and track all your projects.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Sample Card */}
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 hover:border-[#00B7FF] transition cursor-pointer">
            <h3 className="text-xl font-bold mb-3">
              Sample Project
            </h3>

            <div className="space-y-2 text-sm text-zinc-400">
              <p>Workflow: AI Assisted</p>
              <p>Status: Ready For Upload</p>
              <p>Genre: Devotional</p>
            </div>

            <button
              className="mt-6 w-full bg-[#00B7FF] text-black py-2 rounded-lg font-semibold"
            >
              Open Project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}