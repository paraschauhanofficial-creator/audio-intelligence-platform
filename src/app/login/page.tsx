"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await signIn(email, password);

    if (error) {
      alert(error.message);
      return;
    }

    window.location.href = "/projects";
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#111827] border border-[#1F2937] rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Welcome Back
        </h1>

        <p className="text-zinc-400 mb-8">
          Sign in to continue creating.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email Address"
            className="w-full bg-[#0A0A0A] border border-[#1F2937] rounded-lg p-3 text-white"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full bg-[#0A0A0A] border border-[#1F2937] rounded-lg p-3 text-white"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="submit"
            className="w-full bg-[#00B7FF] text-black font-semibold py-3 rounded-lg"
          >
            Sign In
          </button>
        </form>

        <p className="text-zinc-400 text-center mt-6">
          Don't have an account?{" "}
          <Link href="/signup" className="text-[#00B7FF]">
            Create Account
          </Link>
        </p>
      </div>
    </div>
  );
}