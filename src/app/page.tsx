import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Navbar */}
      <nav className="px-8 py-6 border-b border-[#1F2937]">
       <h1 className="heading-brand text-2xl font-bold">
        <span className="text-white">NOKASHI</span>
        <span className="text-[#00B7FF]"> STUDIOS</span>
       </h1>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-32">
        <h1 className="text-6xl font-bold max-w-5xl leading-tight">
          AI Powered
          <span className="text-[#00B7FF]"> Mixing </span>
          &
          <span className="text-[#14D8C4]"> Mastering </span>
          For Modern Creators
        </h1>

        <p className="mt-8 max-w-3xl text-xl text-zinc-400">
          Upload stems, generate professional mixes, master tracks,
          enhance audio, create AI instruments, and take full control
          when you need it.
        </p>

        <div className="mt-10 flex gap-4">
          <Link
            href="/signup"
            className="px-8 py-4 rounded-xl bg-[#00B7FF] text-black font-bold"
          >
            Start Creating
          </Link>

          <Link
            href="/login"
            className="px-8 py-4 rounded-xl border border-[#1F2937]"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-8 pb-24">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-8">
            <h2 className="text-2xl font-semibold text-[#00B7FF] mb-3">
              You Handle It
            </h2>

            <p className="text-zinc-400">
              Upload stems or a mix and let AI create a polished
              mix and master for you.
            </p>
          </div>

          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-8">
            <h2 className="text-2xl font-semibold text-[#14D8C4] mb-3">
              Take Control
            </h2>

            <p className="text-zinc-400">
              Start with an AI-generated mix and customize every
              aspect of the production.
            </p>
          </div>

          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-8 opacity-50">
            <h2 className="text-2xl font-semibold text-[#0EA5A4] mb-3">
              Story & Podcast Studio
            </h2>

            <p className="text-zinc-400">
              Coming Soon
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}