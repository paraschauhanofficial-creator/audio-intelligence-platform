"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Search, LifeBuoy } from "lucide-react";

const ACCENT = "#00B7FF";

type Faq = { q: string; a: string };
type FaqGroup = { category: string; items: Faq[] };

// ── Edit freely: this content array is the only thing you need to maintain ──
const FAQ_GROUPS: FaqGroup[] = [
  {
    category: "Getting started",
    items: [
      {
        q: "What are the two ways to create a project?",
        a: "Take Control gives you the full producer experience — upload your stems and shape the mix yourself in the DAW. You Handle It (AI mode) does the heavy lifting: upload your audio and the Aura engine analyzes, mixes, and masters it for you automatically.",
      },
      {
        q: "What's the difference between a Mix project and a Stems project?",
        a: "A Mix project works on a single audio file — great for mastering a finished track. A Stems project takes your individual multi-track stems (vocals, drums, bass, and so on), identifies each one, and mixes them together intelligently. Stems projects are available on Pro and Studio plans.",
      },
      {
        q: "Do I need any plugins or software installed?",
        a: "No. Everything — analysis, mixing, mastering — runs directly in your browser using the Web Audio engine. There's nothing to download or install, and no external processing service involved.",
      },
      {
        q: "What audio formats can I upload?",
        a: "We support the common formats your browser can decode, including WAV, MP3, FLAC, and OGG. For the best results, upload uncompressed WAV files.",
      },
    ],
  },
  {
    category: "Plans and billing",
    items: [
      {
        q: "What do the plans cost and what's included?",
        a: "Free is ₹0 and includes limited storage with the Mix workflow. Pro (₹1,799) and Studio (₹4,599) unlock the Stems workflow and the DAW, more storage, and a larger monthly data allowance. You can compare everything on the Upgrade page.",
      },
      {
        q: "Which features need Pro or Studio?",
        a: "Stems projects — uploading multi-track stems, stem analysis, auto-mixing, and the DAW workflow — require a Pro or Studio plan. Mix projects are available on every plan, including Free.",
      },
      {
        q: "How do I upgrade my plan?",
        a: "Open the avatar menu in the top right and choose Upgrade plan, or head to the Upgrade page from your dashboard. Your existing projects carry over instantly.",
      },
      {
        q: "What is the monthly data allowance?",
        a: "Streaming and downloading your audio uses data, and each plan includes a monthly data budget. You'll get a notification when you reach 70% and 90%, and your Profile page shows a live meter so you're never surprised.",
      },
    ],
  },
  {
    category: "Projects and playback",
    items: [
      {
        q: "Why does audio sometimes load instantly and sometimes take a moment?",
        a: "The first time you play a file, it's fetched from secure storage and cached in your browser. After that, playback comes straight from the cache — instant, and it doesn't count against your monthly data allowance. Replaying your projects is effectively free.",
      },
      {
        q: "What happens if I hit 100% of my data allowance?",
        a: "Audio streaming pauses until your allowance resets at the start of the next month (or you upgrade). Your projects and files stay completely safe — nothing is deleted, and anything already cached in your browser keeps playing.",
      },
      {
        q: "What happens if I run out of storage?",
        a: "Existing projects stay safe and playable — you just can't upload new audio until you free up space by deleting old files or upgrade to a bigger plan.",
      },
      {
        q: "Can I export my finished track?",
        a: "Yes. Open your project and use Export to download your processed audio, including MP3 export straight from the DAW.",
      },
    ],
  },
  {
    category: "Account and privacy",
    items: [
      {
        q: "Is my audio private? Is it used to train AI?",
        a: "Your audio is private and is never used for training. All AI analysis, mixing, and mastering happens locally in your own browser — your audio is never sent to any external AI service. Files are stored in private storage that only your account can access, using expiring signed links.",
      },
      {
        q: "How do I check my storage and data usage?",
        a: "Your Profile page shows live meters for both storage and monthly data usage, along with your current plan.",
      },
      {
        q: "How do I delete my account?",
        a: "Go to Profile and choose Delete account. This permanently removes your projects and files, so download anything you want to keep first.",
      },
    ],
  },
];

function FaqItem({ faq, open, onToggle }: { faq: Faq; open: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-xl overflow-hidden transition-colors"
      style={{ border: "1px solid var(--border)", backgroundColor: open ? "var(--card)" : "transparent" }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-4 md:px-5 py-4 text-left text-sm font-medium"
        style={{ color: "var(--text)" }}
        aria-expanded={open}
      >
        {faq.q}
        <ChevronDown
          size={16}
          className="flex-shrink-0 transition-transform"
          style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {open && (
        <p className="px-4 md:px-5 pb-4 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {faq.a}
        </p>
      )}
    </div>
  );
}

export default function FaqsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const groups = FAQ_GROUPS.map(g => ({
    ...g,
    items: q
      ? g.items.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q))
      : g.items,
  })).filter(g => g.items.length > 0);

  return (
    <div>
      {/* Search */}
      <div className="relative mb-8">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2"
          style={{ color: "var(--text-muted)" }} />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search FAQs"
          className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-colors"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--text)",
          }}
          onFocus={e => (e.currentTarget.style.borderColor = ACCENT)}
          onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}
        />
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            No results for &ldquo;{query}&rdquo;. Try different words, or ask us directly.
          </p>
          <button
            onClick={() => router.push("/projects/help/contact")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: ACCENT }}
          >
            <LifeBuoy size={15} />
            Contact support
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(group => (
            <section key={group.category}>
              <h2 className="text-sm font-semibold uppercase tracking-wide mb-3"
                style={{ color: "var(--text-muted)" }}>
                {group.category}
              </h2>
              <div className="space-y-2">
                {group.items.map(faq => {
                  const id = `${group.category}-${faq.q}`;
                  return (
                    <FaqItem
                      key={id}
                      faq={faq}
                      open={openId === id}
                      onToggle={() => setOpenId(openId === id ? null : id)}
                    />
                  );
                })}
              </div>
            </section>
          ))}

          <div className="rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Didn&rsquo;t find what you were looking for?
            </p>
            <button
              onClick={() => router.push("/projects/help/contact")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
              style={{ color: ACCENT, border: `1px solid ${ACCENT}55` }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${ACCENT}14`)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <LifeBuoy size={15} />
              Contact support
            </button>
          </div>
        </div>
      )}
    </div>
  );
}