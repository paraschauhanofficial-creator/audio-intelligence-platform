"use client";

import { useRouter, usePathname } from "next/navigation";
import { Rocket, BookOpen, HelpCircle, Keyboard, LifeBuoy, Megaphone, ArrowLeft } from "lucide-react";

const ACCENT = "#00B7FF";

const helpNav = [
  { href: "/projects/help/getting-started", label: "Getting started", Icon: Rocket },
  { href: "/projects/help/guide", label: "User guide", Icon: BookOpen },
  { href: "/projects/help/faqs", label: "FAQs", Icon: HelpCircle },
  { href: "/projects/help/shortcuts", label: "Keyboard shortcuts", Icon: Keyboard },
  { href: "/projects/help/contact", label: "Contact support", Icon: LifeBuoy },
  { href: "/projects/help/whats-new", label: "What's new", Icon: Megaphone },
];

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <button
        onClick={() => {
          if (window.history.length > 1) router.back();
          else router.push("/projects");
        }}
        className="inline-flex items-center gap-2 text-sm font-medium mb-6 transition-colors"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
      >
        <ArrowLeft size={15} />
        Back
      </button>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-1"
        style={{ color: "var(--text-muted)" }}>
        Help &amp; support
      </p>
      <h1 className="text-2xl md:text-3xl font-semibold mb-8"
        style={{ color: "var(--text)", fontFamily: "var(--font-heading)" }}>
        How can we help?
      </h1>

      <div className="flex flex-col md:flex-row gap-8 md:gap-12">

        {/* Sidebar — horizontal scroll pills on mobile, vertical list on desktop */}
        <nav className="flex md:flex-col gap-1 md:w-56 flex-shrink-0 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
          {helpNav.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <button
                key={href}
                onClick={() => router.push(href)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors text-left"
                style={{
                  color: active ? ACCENT : "var(--text-muted)",
                  backgroundColor: active ? `${ACCENT}14` : "transparent",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = "rgba(128,128,128,0.1)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <Icon size={15} style={{ color: active ? ACCENT : "var(--text-muted)" }} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Page content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}