// src/app/api/admin/update-role/route.ts
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

  const { userId, role, plan } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const ALLOWED_ROLES = ["user", "super_user", "admin"];
  const ALLOWED_PLANS = ["free", "pro", "studio"];
  if (role && !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 });
  }
  if (plan && !ALLOWED_PLANS.includes(plan)) {
    return NextResponse.json({ error: `Invalid plan: ${plan}` }, { status: 400 });
  }

  // Prevent an admin from accidentally demoting themselves — would cause a
  // self-lockout with no UI path to recover (only manual SQL).
  if (userId === admin.id && role && role !== "admin") {
    return NextResponse.json({ error: "You can't change your own role away from admin. Ask another admin to do this." }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  if (role) updates.role = role;
  if (plan) updates.plan = plan;

  // Capture old values before overwriting, for the audit log
  const { data: before } = await supabaseAdmin
    .from("profiles").select("role, plan").eq("id", userId).single();

  const { error } = await supabaseAdmin.from("profiles").update(updates).eq("id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (role) {
    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: admin.id,
      action: "update_role",
      target_user_id: userId,
      old_value: before?.role ?? null,
      new_value: role,
    });
  }
  if (plan) {
    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: admin.id,
      action: "update_plan",
      target_user_id: userId,
      old_value: before?.plan ?? null,
      new_value: plan,
    });
  }

  return NextResponse.json({ success: true });
}