// src/app/api/admin/delete-user/route.ts
// Admin permanently removes any user. Body: { "userId": "<uuid>" }

import { NextResponse } from "next/server";
import { adminClient, deleteUserCompletely } from "@/lib/delete-user";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = adminClient();

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

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

  if (userId === userData.user.id) {
    return NextResponse.json(
      { error: "You can't remove your own account from the admin panel" },
      { status: 400 }
    );
  }

  try {
    await deleteUserCompletely(userId);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}