"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import AudioBackground from "@/components/AudioBackground";

export default function HomePage() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const saved = localStorage.getItem("nokashi-theme");
    setIsDarkMode(saved !== "light");
    const observer = new MutationObserver(() => {
      setIsDarkMode(!document.documentElement.classList.contains("theme-light"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * -20;
      const y = (e.clientY / window.innerHeight - 0.5) * -14;
      setParallax({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.remove("theme-light");
      localStorage.setItem("nokashi-theme", "dark");
    } else {
      document.documentElement.classList.add("theme-light");
      localStorage.setItem("nokashi-theme", "light");
    }
  };

  const textColor = isDarkMode ? "#ffffff" : "#1A1714";
  const mutedColor = isDarkMode ? "#71717a" : "#6B6560";
  const borderColor = isDarkMode ? "#1F2937" : "var(--border)";

  return (
    <main className="min-h-screen relative overflow-hidden"
      style={{ backgroundColor: "var(--background)", color: "var(--text)" }}>

      <AudioBackground parallax={parallax} lightMode={!isDarkMode} />

      {/* Scribble SVG layer */}
      <div className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          transform: `translate(${parallax.x * 1.8}px, ${parallax.y * 1.8}px)`,
          transition: "transform 0.18s ease-out",
        }}>
        <svg width="100%" height="100%" viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <path d="M -40 480 C 80 460, 160 520, 240 480 C 320 440, 360 560, 460 520 C 560 480, 600 600, 720 580 C 840 560, 880 700, 980 660 C 1040 640, 1060 720, 1060 780 C 1060 840, 1100 880, 1160 880 C 1220 880, 1260 840, 1260 780 C 1260 740, 1240 720, 1200 700 C 1200 620, 1200 580, 1260 520 C 1380 480, 1440 460, 1480 440"
            fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M -40 200 C 100 160, 200 220, 320 180 C 440 140, 480 240, 600 200 C 720 160, 780 260, 900 220 C 980 200, 1020 160, 1100 140 C 1180 120, 1280 160, 1440 120"
            fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
            strokeWidth="1" strokeLinecap="round" />
          {/* Headphones */}
          <path d="M 1100 780 C 1100 700, 1160 660, 1220 660 C 1280 660, 1340 700, 1340 780"
            fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}
            strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="1100" cy="795" r="18" fill="none"
            stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />
          <circle cx="1340" cy="795" r="18" fill="none"
            stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />
          {/* Guitar top left */}
          <ellipse cx="80" cy="180" rx="36" ry="44" fill="none"
            stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1.5" />
          <ellipse cx="80" cy="240" rx="28" ry="32" fill="none"
            stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1.5" />
          <line x1="80" y1="136" x2="80" y2="50"
            stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
            strokeWidth="1.5" strokeLinecap="round" />
          {/* Bansuri top right */}
          <line x1="820" y1="40" x2="1060" y2="80"
            stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
            strokeWidth="2" strokeLinecap="round" />
          {[0,1,2,3,4,5].map(i => (
            <circle key={i} cx={860+i*32} cy={47+i*6} r="4" fill="none"
              stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1.2" />
          ))}
          {/* Piano bottom left */}
          {[0,1,2,3,4,5,6].map(i => (
            <rect key={i} x={40+i*28} y={820} width="24" height="60" rx="3" fill="none"
              stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1.5" />
          ))}
          {/* Waveform center */}
          <path d="M 580 450 L 600 450 L 610 420 L 620 480 L 630 430 L 640 470 L 650 440 L 660 460 L 670 450 L 690 450"
            fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Microphone top right */}
          <path d="M 1340 60 C 1340 20, 1400 20, 1400 60 L 1400 120 C 1400 160, 1340 160, 1340 120 Z"
            fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1.5" />
          <line x1="1370" y1="160" x2="1370" y2="220"
            stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
            strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      {/* Navbar */}
      <nav className="relative z-10 px-4 md:px-8 py-5 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${borderColor}` }}>
        <h1 className="text-xs md:text-sm font-semibold tracking-[0.25em]"
          style={{ color: isDarkMode ? "#E8E4DC" : "#1A1714" }}>
          NOKASHI STUDIOS
        </h1>
        <button onClick={toggleTheme}
          className="flex items-center justify-center w-8 h-8 rounded-lg border transition-colors"
          style={{ borderColor, color: mutedColor }}>
          {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-24 md:py-32"
        style={{
          transform: `translate(${parallax.x * 0.3}px, ${parallax.y * 0.3}px)`,
          transition: "transform 0.2s ease-out",
        }}>
        <p className="text-xs uppercase tracking-[4px] mb-6" style={{ color: mutedColor }}>
          AI Audio Production Platform
        </p>
        <h1 className="text-3xl md:text-5xl font-semibold max-w-4xl leading-tight mb-10"
          style={{ color: textColor }}>
          AI Powered
          <span className="text-[#00B7FF]"> Mixing </span>
          &
          <span className="text-[#14D8C4]"> Mastering </span>
          For Modern Creators
        </h1>
        <div className="flex gap-4 mb-10 flex-wrap justify-center">
          <Link href="/signup"
            className="px-8 py-4 rounded-xl bg-[#00B7FF] text-black font-bold text-lg hover:opacity-90 transition shadow-[0_0_40px_rgba(0,183,255,0.35)]">
            Start Creating
          </Link>
          <Link href="/login"
            className="px-8 py-4 rounded-xl font-bold text-lg transition"
            style={{
              border: `2px solid ${borderColor}`,
              color: textColor,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "#00B7FF";
              (e.currentTarget as HTMLElement).style.color = "#00B7FF";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = borderColor;
              (e.currentTarget as HTMLElement).style.color = textColor;
            }}>
            Sign In
          </Link>
        </div>
        <p className="max-w-xl text-sm md:text-base leading-relaxed" style={{ color: mutedColor }}>
          Upload stems or a full mix. Let AI analyse, mix, and master your track —
          or open the DAW and take full control.
        </p>
      </section>

      {/* Feature cards */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 md:px-8 pb-24">
        <div className="grid md:grid-cols-3 gap-5 opacity-70">
          {[
            { title: "You Handle It", color: "#00B7FF", desc: "Upload stems or a mix and let AI create a polished mix and master for you." },
            { title: "Take Control", color: "#14D8C4", desc: "Start with an AI-generated mix and customize every aspect of the production." },
            { title: "Generate Instruments", color: "#A78BFA", desc: "Coming Soon — AI-generated acoustic melodies that fit perfectly in your track." },
          ].map(card => (
            <div key={card.title}
              className="backdrop-blur-sm rounded-2xl p-6"
              style={{
                backgroundColor: isDarkMode ? "rgba(17,24,39,0.6)" : "rgba(234,228,216,0.6)",
                border: `1px solid ${borderColor}`,
              }}>
              <h2 className="text-lg font-semibold mb-2" style={{ color: card.color }}>
                {card.title}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: mutedColor }}>
                {card.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

    </main>
  );
}