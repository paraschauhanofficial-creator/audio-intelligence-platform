"use client";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AudioBackground from "@/components/AudioBackground";
import Navbar from "@/components/Navbar";


export default function ProjectsPage() {
  const router = useRouter();
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("nokashi-theme");
    setIsDarkMode(saved !== "light");
    // Listen for theme changes from Navbar
    const observer = new MutationObserver(() => {
      setIsDarkMode(!document.documentElement.classList.contains("theme-light"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth  - 0.5) * -20;
      const y = (e.clientY / window.innerHeight - 0.5) * -14;
      setParallax({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: "var(--background)", color: "var(--text)" }}>
      <AudioBackground parallax={parallax} lightMode={!isDarkMode} />

      {/* Header */}
      // inside return:
<Navbar accentColor="#00B7FF" />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-8 pt-12">
        <h2 className="text-4xl font-bold mb-3">Welcome Back</h2>
        <p className="mb-12" style={{ color: "var(--text-muted)" }}>Choose how you want to create today.</p>

        <div className="grid md:grid-cols-3 gap-6">
          <div onClick={() => router.push("/projects/create/ai")}
            className="backdrop-blur-sm rounded-2xl p-8 hover:shadow-[0_0_30px_rgba(0,183,255,0.15)] transition cursor-pointer"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#00B7FF"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
            <h3 className="text-2xl font-bold text-[#00B7FF] mb-4">You Handle It</h3>
            <p style={{ color: "var(--text-muted)" }}>Upload stems or a mix and let AI create a polished mix and master for you.</p>
          </div>

          <div onClick={() => router.push("/projects/create/producer")}
            className="backdrop-blur-sm rounded-2xl p-8 hover:shadow-[0_0_30px_rgba(20,216,196,0.15)] transition cursor-pointer"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#14D8C4"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
            <h3 className="text-2xl font-bold text-[#14D8C4] mb-4">Take Control</h3>
            <p style={{ color: "var(--text-muted)" }}>Start with an AI-generated mix and customize every aspect of the production.</p>
          </div>

          <div className="backdrop-blur-sm rounded-2xl p-8 opacity-50"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            <h3 className="text-2xl font-bold text-[#A78BFA] mb-4">Generate Instruments</h3>
            <p style={{ color: "var(--text-muted)" }}>Create AI-generated acoustic instrument melodies — piano, guitar, tabla and more — that fit perfectly in your track.</p>
            <p className="text-xs text-[#A78BFA] mt-4">Coming Soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}