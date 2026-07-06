// src/app/api/admin/delete-user/route.ts
// Admin permanently deletes a user: storage files + DB rows + auth account.
// Body: { "userId": "<uuid>" }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// !! CHECK THESE against your project — see notes in chat !!
const STORAGE_BUCKETS = ["project-files", "audio-files"];

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function deleteUserStorage(admin: ReturnType<typeof adminClient>, userId: string) {
  // Assumes files are stored under a folder named after the user id
  // (the common Supabase pattern: bucket/userId/filename).
  for (const bucket of STORAGE_BUCKETS) {
    const { data: files } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
    if (files && files.length > 0) {
      const paths = files.map(f => `${userId}/${f.name}`);
      await admin.storage.from(bucket).remove(paths);
    }
  }
}

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = adminClient();

  // Who is calling?
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  // Is the caller an admin? (same check your admin page uses)
  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { userId } = await request.json();
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // Guard: admins must not delete themselves from the admin panel
  if (userId === userData.user.id) {
    return NextResponse.json(
      { error: "You can't remove your own account from here" },
      { status: 400 }
    );
  }

  // 1. Wipe their storage files (DB cascade won't touch storage)
  await deleteUserStorage(admin, userId);

  // 2. Delete the auth user — CASCADE removes profiles, projects,
  //    project_files, project_stems rows automatically (Step 3 SQL)
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}