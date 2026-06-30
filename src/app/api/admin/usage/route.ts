import { createClient } from "@supabase/supabase-js";
import { EGRESS_BUDGET, STORAGE_BUDGET, planKeyForExport as planKeyFor } from "@/lib/usageTracking";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role === "admin" ? user : null;
}



export async function GET(req: Request) {
  const caller = await verifyAdmin(req);
  if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, role, plan");

  if (!profiles) return Response.json({ users: [] });

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const results = await Promise.all(
    profiles.map(async (p) => {
      const planKey = planKeyFor(p.role, p.plan);

      const [{ data: mixFiles }, { data: stemFiles }, { data: events }] = await Promise.all([
        supabaseAdmin.from("project_files").select("file_size").eq("user_id", p.id),
        supabaseAdmin.from("project_stems").select("file_size").eq("user_id", p.id),
        supabaseAdmin.from("usage_events").select("bytes_actual").eq("user_id", p.id).gte("created_at", startOfMonth.toISOString()),
      ]);

      const storageUsed = (mixFiles ?? []).reduce((s, f: any) => s + (f.file_size ?? 0), 0)
        + (stemFiles ?? []).reduce((s, f: any) => s + (f.file_size ?? 0), 0);
      const egressUsed = (events ?? []).reduce((s, e: any) => s + (e.bytes_actual ?? 0), 0);

      return {
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: p.role,
        plan: p.plan,
        storageUsedBytes: storageUsed,
        storageBudgetBytes: STORAGE_BUDGET[planKey],
        egressUsedBytes: egressUsed,
        egressBudgetBytes: EGRESS_BUDGET[planKey],
      };
    })
  );

  return Response.json({ users: results });
}