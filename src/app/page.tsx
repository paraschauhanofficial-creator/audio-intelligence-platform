"use client";

import Link from "next/link";
import AudioBackground from "@/components/AudioBackground";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white relative">
      <AudioBackground />

      {/* Navbar */}
      <nav className="relative z-10 px-8 py-6 border-b border-[#1F2937]">
        <h1 className="heading-brand text-2xl font-bold">
          <span className="text-white">NOKASHI</span>
          <span className="text-[#00B7FF]"> STUDIOS</span>
        </h1>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-32">

        {/* Subtitle first — small, muted */}
        <p className="text-sm uppercase tracking-[4px] text-zinc-500 mb-6">
          AI Audio Production Platform
        </p>

        {/* Main headline — smaller, secondary */}
        <h1 className="text-4xl font-semibold max-w-4xl leading-tight text-zinc-300 mb-12">
          AI Powered
          <span className="text-[#00B7FF]"> Mixing </span>
          &
          <span className="text-[#14D8C4]"> Mastering </span>
          For Modern Creators
        </h1>

        {/* CTAs — the loudest elements */}
        <div className="flex gap-4 mb-12">
          <Link href="/signup"
            className="px-10 py-5 rounded-xl bg-[#00B7FF] text-black font-bold text-xl hover:opacity-90 transition shadow-[0_0_40px_rgba(0,183,255,0.35)]">
            Start Creating
          </Link>
          <Link href="/login"
            className="px-10 py-5 rounded-xl border-2 border-[#1F2937] text-white font-bold text-xl hover:border-[#00B7FF] hover:text-[#00B7FF] transition">
            Sign In
          </Link>
        </div>

        {/* Description — smallest, below CTAs */}
        <p className="max-w-xl text-base text-zinc-600 leading-relaxed">
          Upload stems or a full mix. Let AI analyse, mix, and master your track —
          or open the DAW and take full control.
        </p>
      </section>

      {/* Feature cards — faded, secondary */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 pb-24">
        <div className="grid md:grid-cols-3 gap-6 opacity-60">
          <div className="bg-[#111827]/60 backdrop-blur-sm border border-[#1F2937] rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-[#00B7FF] mb-3">You Handle It</h2>
            <p className="text-zinc-500 text-sm">Upload stems or a mix and let AI create a polished mix and master for you.</p>
          </div>
          <div className="bg-[#111827]/60 backdrop-blur-sm border border-[#1F2937] rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-[#14D8C4] mb-3">Take Control</h2>
            <p className="text-zinc-500 text-sm">Start with an AI-generated mix and customize every aspect of the production.</p>
          </div>
          <div className="bg-[#111827]/60 backdrop-blur-sm border border-[#1F2937] rounded-2xl p-8 opacity-50">
            <h2 className="text-xl font-semibold text-[#0EA5A4] mb-3">Story & Podcast Studio</h2>
            <p className="text-zinc-500 text-sm">Coming Soon</p>
          </div>
        </div>
      </section>
    </main>
  );
}