"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, AudioLines, Layers, SlidersHorizontal, Gauge, Lightbulb, ArrowRight } from "lucide-react";

const ACCENT = "#00B7FF";

type GuideSection = {
  id: string;
  title: string;
  Icon: React.ElementType;
  paragraphs: string[];
  bullets?: string[];
  link?: { label: string; href: string };
};

// ── All guide content lives here; edit copy without touching the UI ──
const SECTIONS: GuideSection[] = [
  {
    id: "dashboard",
    title: "Your dashboard",
    Icon: LayoutGrid,
    paragraphs: [
      "Your dashboard is home base. The featured carousel highlights your recent work, and My Projects lists everything you've made, organized into rows by how each project was created.",
      "Every new project starts with a choice: You Handle It, where the Aura engine mixes and masters for you, or Take Control, where you produce the mix yourself. You can have both kinds of projects side by side.",
    ],
    link: { label: "Open My Projects", href: "/projects/list" },
  },
  {
    id: "mix-projects",
    title: "Mix projects",
    Icon: AudioLines,
    paragraphs: [
      "A Mix project works on a single audio file — the fastest way to get a polished, mastered track. Upload your file and Aura listens to it right in your browser: loudness, musical key, tempo, and how the energy is spread across the frequency spectrum.",
      "Based on what it hears, Aura applies EQ, warm saturation, and limiting to bring your track to a competitive, streaming-ready loudness. When it's done, the project page shows the full waveform so you can scrub through, compare, and export.",
    ],
    bullets: [
      "Best input: an uncompressed WAV of your final mix",
      "Leave a little headroom — don't limit your mix before uploading",
      "Export is available right from the project page",
    ],
  },
  {
    id: "stems-projects",
    title: "Stems projects",
    Icon: Layers,
    paragraphs: [
      "Stems projects (Pro and Studio plans) work with your individual tracks — vocals, drums, bass, melodies — instead of a single file. Upload your stems and each one is analyzed and automatically identified, so the engine knows which stem is the lead vocal and which is the kick.",
      "Every stem gets a role in the mix. Roles decide priority: lead elements stay up front while supporting parts sit back. Aura's auto-mix uses these roles — with mixing sensibilities tuned for both Indian and Western productions — to set levels, panning, and filtering as a strong starting point.",
    ],
    bullets: [
      "Name your stem files clearly before uploading — it helps identification",
      "You can change any stem's role if the automatic pick isn't what you intended",
      "Auto-mix is a starting point, not a locked decision",
    ],
  },
  {
    id: "daw",
    title: "The DAW",
    Icon: SlidersHorizontal,
    paragraphs: [
      "The DAW is where a stems project becomes your mix. Each stem gets a channel with level and pan controls, and you can see how the stems relate to each other across the session. Start from Aura's auto-mix, then push things where you want them.",
      "When the balance feels right, export your finished mix straight from the DAW. The DAW is designed for desktop — a bigger screen gives every channel room to breathe.",
    ],
    link: { label: "See a project's DAW", href: "/projects/list" },
  },
  {
    id: "storage-data",
    title: "Storage and data",
    Icon: Gauge,
    paragraphs: [
      "Your plan includes storage for your uploads and a monthly data allowance for streaming and downloading audio. Both have live meters on your Profile page, so you always know where you stand.",
      "The first time you play a file it's fetched from secure storage and cached by your browser; after that, replays come straight from the cache and cost you nothing from your allowance. If you reach 70% or 90% of your monthly data, we'll notify you. At 100%, streaming pauses until the month resets — your files stay safe, and cached audio keeps playing.",
    ],
    link: { label: "Check your usage", href: "/projects/profile" },
  },
  {
    id: "tips",
    title: "Tips for best results",
    Icon: Lightbulb,
    paragraphs: [],
    bullets: [
      "Upload WAV or FLAC rather than MP3 whenever you can — the engine can only work with what's in the file",
      "For stems: export all stems from the same session start point so they line up perfectly",
      "Keep individual stems clean — no master-bus processing baked in",
      "Work through your projects in one sitting when possible; cached audio makes revisits instant and free",
      "On Free? You can try the full Mix workflow before deciding whether Pro's stems workflow is for you",
    ],
  },
];

export default function UserGuidePage() {
  const router = useRouter();
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex gap-10">
      {/* Content */}
      <div className="flex-1 min-w-0 space-y-12">
        {SECTIONS.map(({ id, title, Icon, paragraphs, bullets, link }) => (
          <section key={id} id={id} className="scroll-mt-24">
            <h2 className="flex items-center gap-2.5 text-lg font-semibold mb-3"
              style={{ color: "var(--text)", fontFamily: "var(--font-heading)" }}>
              <Icon size={18} style={{ color: ACCENT }} />
              {title}
            </h2>
            {paragraphs.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed mb-3" style={{ color: "var(--text-muted)" }}>
                {p}
              </p>
            ))}
            {bullets && (
              <ul className="space-y-2 mt-2">
                {bullets.map(b => (
                  <li key={b} className="flex gap-2.5 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    <span className="w-1 h-1 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: ACCENT }} />
                    {b}
                  </li>
                ))}
              </ul>
            )}
            {link && (
              <button
                onClick={() => router.push(link.href)}
                className="inline-flex items-center gap-1.5 text-sm font-medium mt-4"
                style={{ color: ACCENT }}
              >
                {link.label}
                <ArrowRight size={14} />
              </button>
            )}
          </section>
        ))}
      </div>

      {/* Sticky mini table of contents — desktop only */}
      <nav className="hidden lg:block w-44 flex-shrink-0">
        <div className="sticky top-24 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--text-muted)" }}>
            On this page
          </p>
          {SECTIONS.map(({ id, title }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className="block w-full text-left text-[13px] py-1.5 pl-3 transition-colors"
              style={{
                color: activeId === id ? ACCENT : "var(--text-muted)",
                borderLeft: `2px solid ${activeId === id ? ACCENT : "var(--border)"}`,
              }}
            >
              {title}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}