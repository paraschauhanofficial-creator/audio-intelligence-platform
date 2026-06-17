"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    const { error } = await signIn(
      email,
      password
    );

    if (error) {
      alert(error.message);
      return;
    }
    window.location.href = "/projects";

    alert("Login successful");
  };

  return (
    <div className="p-10">
      <h1 className="text-2xl mb-4">
        Login
      </h1>

      <form
        onSubmit={handleLogin}
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
          Login
        </button>
      </form>
    </div>
  );
}