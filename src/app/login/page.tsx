"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sun, Moon } from "lucide-react";
import { signIn } from "@/lib/auth";
import AudioBackground from "@/components/AudioBackground";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
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
      setParallax({
        x: (e.clientX / window.innerWidth - 0.5) * -20,
        y: (e.clientY / window.innerHeight - 0.5) * -14,
      });
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await signIn(email, password);
    if (error) { alert(error.message); return; }
    if (!rememberMe) {
      sessionStorage.setItem("sessionOnly", "true");
    } else {
      localStorage.removeItem("sessionOnly");
    }
    window.location.href = "/projects";
  };

  const textColor = isDarkMode ? "#ffffff" : "#1A1714";
  const mutedColor = isDarkMode ? "#a1a1aa" : "#6B6560";
  const borderColor = isDarkMode ? "#1F2937" : "var(--border)";
  const inputBg = isDarkMode ? "#0A0A0A" : "rgba(255,255,255,0.6)";
  const cardBg = isDarkMode ? "rgba(17,24,39,0.85)" : "rgba(234,228,216,0.90)";

  return (
    <div className="min-h-screen relative flex flex-col"
      style={{ backgroundColor: "var(--background)" }}>

      <AudioBackground parallax={parallax} lightMode={!isDarkMode} />

      {/* Navbar */}
      <nav className="relative z-10 px-6 py-5 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${borderColor}` }}>
        <Link href="/" className="text-xs md:text-sm font-semibold tracking-[0.25em]"
          style={{ color: isDarkMode ? "#E8E4DC" : "#1A1714" }}>
          NOKASHI STUDIOS
        </Link>
        <button onClick={toggleTheme}
          className="flex items-center justify-center w-8 h-8 rounded-lg border transition-colors"
          style={{ borderColor, color: mutedColor }}>
          {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </nav>

      {/* Form */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl p-8 backdrop-blur-sm"
          style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>

          <h1 className="text-3xl font-bold mb-2" style={{ color: textColor }}>
            Welcome Back
          </h1>
          <p className="mb-8" style={{ color: mutedColor }}>
            Sign in to continue creating.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="Email Address"
              className="w-full rounded-lg p-3 focus:outline-none transition"
              style={{
                backgroundColor: inputBg,
                border: `1px solid ${borderColor}`,
                color: textColor,
              }}
              onFocus={e => e.currentTarget.style.borderColor = "#00B7FF"}
              onBlur={e => e.currentTarget.style.borderColor = borderColor}
              value={email} onChange={e => setEmail(e.target.value)} />

            <input type="password" placeholder="Password"
              className="w-full rounded-lg p-3 focus:outline-none transition"
              style={{
                backgroundColor: inputBg,
                border: `1px solid ${borderColor}`,
                color: textColor,
              }}
              onFocus={e => e.currentTarget.style.borderColor = "#00B7FF"}
              onBlur={e => e.currentTarget.style.borderColor = borderColor}
              value={password} onChange={e => setPassword(e.target.value)} />

            <label className="flex items-center gap-3 cursor-pointer group">
              <div onClick={() => setRememberMe(v => !v)}
                className="w-5 h-5 rounded border-2 flex items-center justify-center transition flex-shrink-0"
                style={{
                  borderColor: rememberMe ? "#00B7FF" : borderColor,
                  backgroundColor: rememberMe ? "#00B7FF" : "transparent",
                }}>
                {rememberMe && <span className="text-black text-xs font-bold">✓</span>}
              </div>
              <span className="text-sm transition" style={{ color: mutedColor }}>Remember me</span>
            </label>

            <button type="submit"
              className="w-full bg-[#00B7FF] text-black font-semibold py-3 rounded-lg hover:opacity-90 transition">
              Sign In
            </button>
          </form>

          <p className="text-center mt-6 text-sm" style={{ color: mutedColor }}>
            Don't have an account?{" "}
            <Link href="/signup" className="text-[#00B7FF] hover:underline">Create Account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}