"use client";

import { useRouter } from "next/navigation";
import { Upload, Wand2, Download, SlidersHorizontal, Layers, AudioWaveform, ArrowRight, Crown } from "lucide-react";

const CYAN = "#00B7FF";      // You handle it (AI path)
const TURQUOISE = "#2DD4BF"; // Take control (producer path)

type Step = { title: string; desc: string; Icon: React.ElementType };

// ── Edit copy here; the UI below renders whatever these arrays contain ──
const AI_STEPS: Step[] = [
  {
    title: "Create an AI project",
    desc: "From your dashboard, choose You Handle It and upload a single mix or your stems. We check your storage and get everything ready.",
    Icon: Upload,
  },
  {
    title: "Aura does the work",
    desc: "The Aura engine analyzes your audio right in your browser — loudness, key, tempo, frequency balance — then mixes and masters it automatically.",
    Icon: Wand2,
  },
  {
    title: "Preview and export",
    desc: "Listen to the result on the project page with a full waveform view, then export your finished track when you're happy.",
    Icon: Download,
  },
];

const PRODUCER_STEPS: Step[] = [
  {
    title: "Create a producer project",
    desc: "Choose Take Control to open the hands-on workflow. Upload your individual stems — vocals, drums, bass, instruments.",
    Icon: Layers,
  },
  {
    title: "Stems are identified",
    desc: "Each stem is analyzed and labeled automatically, and given a role in the mix. You can adjust any of it.",
    Icon: AudioWaveform,
  },
  {
    title: "Shape your mix in the DAW",
    desc: "Open the DAW to balance levels, pan, and refine the mix, with Aura's auto-mix as your starting point. Export straight from the DAW when it's done.",
    Icon: SlidersHorizontal,
  },
];

function PathCard({
  eyebrow,
  title,
  subtitle,
  steps,
  cta,
  href,
  badge,
  accent,
  onNavigate,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  steps: Step[];
  cta: string;
  href: string;
  badge?: string;
  accent: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <div className="rounded-2xl p-5 md:p-6 flex flex-col"
      style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>
          {eyebrow}
        </p>
        {badge && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full"
            style={{ color: "#F0A500", backgroundColor: "#F0A50018", border: "1px solid #F0A50040" }}>
            <Crown size={10} />
            {badge}
          </span>
        )}
      </div>
      <h2 className="text-lg font-semibold mb-1"
        style={{ color: "var(--text)", fontFamily: "var(--font-heading)" }}>
        {title}
      </h2>
      <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>{subtitle}</p>

      <ol className="space-y-4 flex-1">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ color: accent, border: `1px solid ${accent}55`, backgroundColor: `${accent}10` }}>
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className="w-px flex-1 mt-1" style={{ backgroundColor: "var(--border)" }} />
              )}
            </div>
            <div className="pb-1">
              <p className="text-sm font-medium flex items-center gap-2" style={{ color: "var(--text)" }}>
                <step.Icon size={14} style={{ color: "var(--text-muted)" }} />
                {step.title}
              </p>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {step.desc}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <button
        onClick={() => onNavigate(href)}
        className="mt-5 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        style={{ color: accent, border: `1px solid ${accent}55` }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${accent}14`)}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        {cta}
        <ArrowRight size={15} />
      </button>
    </div>
  );
}

export default function GettingStartedPage() {
  const router = useRouter();

  return (
    <div>
      <p className="text-sm leading-relaxed mb-8 max-w-2xl" style={{ color: "var(--text-muted)" }}>
        There are two ways to work in Nokashi. Let the Aura engine handle everything,
        or take the producer&rsquo;s seat and shape the mix yourself. Both start from your dashboard.
      </p>

      <div className="grid md:grid-cols-2 gap-4 md:gap-6">
        <PathCard
          eyebrow="You handle it"
          title="Let Aura mix and master"
          subtitle="Fastest path from upload to finished track."
          steps={AI_STEPS}
          cta="Start an AI project"
          href="/projects/create/ai"
          accent={CYAN}
          onNavigate={router.push}
        />
        <PathCard
          eyebrow="Take control"
          title="Produce it yourself in the DAW"
          subtitle="Full hands-on control over every stem."
          steps={PRODUCER_STEPS}
          cta="Start a producer project"
          href="/projects/create/producer"
          badge="Pro / Studio"
          accent={TURQUOISE}
          onNavigate={router.push}
        />
      </div>

      <div className="mt-6 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{ border: "1px solid var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Not sure which plan you need? Compare what each one unlocks.
        </p>
        <button
          onClick={() => router.push("/projects/upgrade")}
          className="text-sm font-medium whitespace-nowrap"
          style={{ color: CYAN }}
        >
          View plans →
        </button>
      </div>
    </div>
  );
}