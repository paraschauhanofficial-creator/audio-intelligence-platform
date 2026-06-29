"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "@/lib/auth";
import AudioBackground from "@/components/AudioBackground";

export default function LoginPage() {
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [rememberMe, setRememberMe] = useState(true);

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

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4 relative">
      <AudioBackground />

      <div className="relative z-10 w-full max-w-md bg-[#111827]/80 backdrop-blur-sm border border-[#1F2937] rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
        <p className="text-zinc-400 mb-8">Sign in to continue creating.</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" placeholder="Email Address"
            className="w-full bg-[#0A0A0A] border border-[#1F2937] rounded-lg p-3 text-white focus:outline-none focus:border-[#00B7FF] transition"
            value={email} onChange={e => setEmail(e.target.value)}/>

          <input type="password" placeholder="Password"
            className="w-full bg-[#0A0A0A] border border-[#1F2937] rounded-lg p-3 text-white focus:outline-none focus:border-[#00B7FF] transition"
            value={password} onChange={e => setPassword(e.target.value)}/>

          <label className="flex items-center gap-3 cursor-pointer group">
            <div onClick={() => setRememberMe(v => !v)}
              className="w-5 h-5 rounded border-2 flex items-center justify-center transition flex-shrink-0"
              style={{ borderColor: rememberMe ? "#00B7FF" : "#374151", backgroundColor: rememberMe ? "#00B7FF" : "transparent" }}>
              {rememberMe && <span className="text-black text-xs font-bold">✓</span>}
            </div>
            <span className="text-sm text-zinc-400 group-hover:text-zinc-300 transition">Remember me</span>
          </label>

          <button type="submit"
            className="w-full bg-[#00B7FF] text-black font-semibold py-3 rounded-lg hover:opacity-90 transition">
            Sign In
          </button>
        </form>

        <p className="text-zinc-400 text-center mt-6">
          Don't have an account?{" "}
          <Link href="/signup" className="text-[#00B7FF] hover:underline">Create Account</Link>
        </p>
      </div>
    </div>
  );
}