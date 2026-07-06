// src/app/api/account/delete/route.ts
// A logged-in user permanently deletes THEIR OWN account.
// The id comes from the verified token — users can never delete anyone else.

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

  try {
    await deleteUserCompletely(userData.user.id);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}