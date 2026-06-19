"use client";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ProjectsPage() {
const router = useRouter();

const handleLogout = async () => {
await supabase.auth.signOut();
router.push("/");
};

return ( <div className="min-h-screen bg-[#0A0A0A] text-white">
{/* Header */} <div className="flex items-center justify-between px-8 py-6 border-b border-[#1F2937]"> <h1 className="heading-brand text-xl font-bold"> <span className="text-white">NOKASHI</span> <span className="text-[#00B7FF]"> STUDIOS</span> </h1>

    <div className="flex items-center gap-4">
      <button
        className="px-5 py-2 rounded-lg bg-[#00B7FF] text-black font-semibold hover:opacity-90 transition"
      >
        My Projects
      </button>

      <button
        onClick={handleLogout}
        className="px-5 py-2 rounded-lg border border-[#1F2937] hover:border-[#00B7FF] transition"
      >
        Logout
      </button>
    </div>
  </div>

  {/* Welcome */}
  <div className="max-w-7xl mx-auto px-8 pt-12">
    <h2 className="text-4xl font-bold mb-3">
      Welcome Back
    </h2>

    <p className="text-zinc-400 mb-12">
      Choose how you want to create today.
    </p>

    <div className="grid md:grid-cols-3 gap-6">
      <div
        onClick={() => router.push("/projects/create/ai")}
        className="bg-[#111827] border border-[#1F2937] rounded-2xl p-8 hover:border-[#00B7FF] hover:shadow-[0_0_30px_rgba(0,183,255,0.15)] transition cursor-pointer"
      >
        <h3 className="text-2xl font-bold text-[#00B7FF] mb-4">
          You Handle It
        </h3>

        <p className="text-zinc-400">
          Upload stems or a mix and let AI create a polished mix and
          master for you.
        </p>
      </div>

      <div
        onClick={() => router.push("/projects/create/producer")}
        className="bg-[#111827] border border-[#1F2937] rounded-2xl p-8 hover:border-[#14D8C4] hover:shadow-[0_0_30px_rgba(20,216,196,0.15)] transition cursor-pointer"
      >
        <h3 className="text-2xl font-bold text-[#14D8C4] mb-4">
          Take Control
        </h3>

        <p className="text-zinc-400">
          Start with an AI-generated mix and customize every aspect
          of the production.
        </p>
      </div>

      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-8 opacity-50">
        <h3 className="text-2xl font-bold text-[#0EA5A4] mb-4">
          Story & Podcast Studio
        </h3>

        <p className="text-zinc-400">
          Coming Soon
        </p>
      </div>
    </div>
  </div>
</div>


);
}
