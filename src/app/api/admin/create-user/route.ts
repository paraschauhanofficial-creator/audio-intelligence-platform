// src/app/api/admin/create-user/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return null;
  return user;
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { email, password, fullName, role, plan } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  // Create the auth user
  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // auto-confirm so admin-created accounts can log in immediately
  });

  if (createError || !newUser.user) {
    return NextResponse.json({ error: createError?.message ?? "Failed to create user" }, { status: 500 });
  }

  // The trigger auto-creates a profiles row — update it with the chosen role/plan/name
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name: fullName || null,
      role: role || "user",
      plan: plan || "free",
    })
    .eq("id", newUser.user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, userId: newUser.user.id });
}