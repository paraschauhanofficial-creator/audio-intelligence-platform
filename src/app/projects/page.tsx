export default function ProjectsPage() {
  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl font-bold mb-8">
        Audio Intelligence Platform
      </h1>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="border border-zinc-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-2">
            AI Assisted
          </h2>
          <p className="text-zinc-400">
            Upload stems or a mix and let AI handle the process.
          </p>
        </div>

        <div className="border border-zinc-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-2">
            Producer Mode
          </h2>
          <p className="text-zinc-400">
            AI-assisted mix with full control over every parameter.
          </p>
        </div>

        <div className="border border-zinc-800 rounded-xl p-6 opacity-50">
          <h2 className="text-xl font-semibold mb-2">
            Story & Podcast Studio
          </h2>
          <p className="text-zinc-400">
            Coming Soon
          </p>
        </div>
      </div>
    </div>
  );
}