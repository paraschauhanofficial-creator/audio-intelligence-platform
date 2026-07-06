"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sun, Moon } from "lucide-react";
import { signUp, signInWithGoogle } from "@/lib/auth";
import AudioBackground from "@/components/AudioBackground";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [googleLoading, setGoogleLoading] = useState(false);

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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await signUp(email, password);
    if (error) { alert(error.message); return; }
    alert("Account created successfully");
  };

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      alert(error.message);
      setGoogleLoading(false);
    }
    // On success the browser redirects to Google — with OAuth,
    // sign up and sign in are the same flow.
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
            Create Account
          </h1>
          <p className="mb-8" style={{ color: mutedColor }}>
            Start your audio production journey.
          </p>

          {/* Google signup */}
          <button type="button" onClick={handleGoogleSignup} disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 font-medium py-3 rounded-lg transition hover:opacity-85 disabled:opacity-50"
            style={{
              backgroundColor: inputBg,
              border: `1px solid ${borderColor}`,
              color: textColor,
            }}>
            <GoogleIcon />
            {googleLoading ? "Redirecting..." : "Continue with Google"}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px" style={{ backgroundColor: borderColor }} />
            <span className="text-xs uppercase tracking-widest" style={{ color: mutedColor }}>or</span>
            <div className="flex-1 h-px" style={{ backgroundColor: borderColor }} />
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
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

            <input type="password" placeholder="Password (min 6 characters)"
              className="w-full rounded-lg p-3 focus:outline-none transition"
              style={{
                backgroundColor: inputBg,
                border: `1px solid ${borderColor}`,
                color: textColor,
              }}
              onFocus={e => e.currentTarget.style.borderColor = "#00B7FF"}
              onBlur={e => e.currentTarget.style.borderColor = borderColor}
              value={password} onChange={e => setPassword(e.target.value)} />

            <button type="submit"
              className="w-full bg-[#00B7FF] text-black font-semibold py-3 rounded-lg hover:opacity-90 transition">
              Create Account
            </button>
          </form>

          <p className="text-center mt-6 text-sm" style={{ color: mutedColor }}>
            Already have an account?{" "}
            <Link href="/login" className="text-[#00B7FF] hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}