// src/lib/auth.ts

import { supabase } from "./supabase";

export async function signUp(
  email: string,
  password: string
) {
  return await supabase.auth.signUp({
    email,
    password,
  });
}

export async function signIn(
  email: string,
  password: string
) {
  return await supabase.auth.signInWithPassword({
    email,
    password,
  });
}

export async function signInWithGoogle() {
  return await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/projects`,
      queryParams: {
        access_type: "offline",
        prompt: "select_account", // always show the account picker
      },
    },
  });
}

export async function signOut() {
  return await supabase.auth.signOut();
}