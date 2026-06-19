"use client";

import { useState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/auth";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await signUp(email, password);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Account created successfully");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#111827] border border-[#1F2937] rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Create Account
        </h1>

        <p className="text-zinc-400 mb-8">
          Start your audio production journey.
        </p>

        <form onSubmit={handleSignup} className="space-y-4">
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
            Create Account
          </button>
        </form>

        <p className="text-zinc-400 text-center mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-[#00B7FF]">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}