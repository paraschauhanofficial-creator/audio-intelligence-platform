"use client";

import { useState } from "react";
import { signUp } from "@/lib/auth";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    const { error } = await signUp(
      email,
      password
    );

    if (error) {
      alert(error.message);
      return;
    }

    alert("Account created successfully");
  };

  return (
    <div className="p-10">
      <h1 className="text-2xl mb-4">
        Sign Up
      </h1>

      <form
        onSubmit={handleSignup}
        className="flex flex-col gap-4 max-w-sm"
      >
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
          className="border p-2"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          className="border p-2"
        />

        <button
          type="submit"
          className="border p-2"
        >
          Create Account
        </button>
      </form>
    </div>
  );
}