import { supabase } from "@/lib/supabase";

/**
 * Fetches a signed URL's audio and logs the REAL transferred byte count to
 * usage_events. Returns the blob so callers can still use it (decode, play,
 * download) without fetching twice.
 */
export async function fetchAndLogAudio(
  signedUrl: string,
  eventType: "waveform_load" | "master_waveform_load" | "preview_play" | "download" | "daw_stem_load",
  projectId?: string
): Promise<Blob> {
  const res = await fetch(signedUrl);
  const blob = await res.blob();

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // Fire-and-forget — don't block playback/decode on logging.
    supabase.from("usage_events").insert({
      user_id: user.id,
      project_id: projectId ?? null,
      event_type: eventType,
      bytes_actual: blob.size, // real bytes received for THIS request
    }).then(({ error }) => {
      if (error) console.error("usage_events insert failed:", error);
    });
  }

  return blob;
}

// Single source of truth for resource tiers — imported by the admin API
// route and the Profile page instead of being copy-pasted. Change numbers
// here only.
export const EGRESS_BUDGET: Record<string, number> = {
  free:      500 * 1024 * 1024,        // 500MB/mo
  pro:       5 * 1024 * 1024 * 1024,   // 5GB/mo
  studio:    20 * 1024 * 1024 * 1024,  // 20GB/mo
  unlimited: 20 * 1024 * 1024 * 1024,  // 20GB/mo — admin/super_user, capped same as Studio
};

export const STORAGE_BUDGET: Record<string, number> = {
  free:      500 * 1024 * 1024,        // 500MB
  pro:       5 * 1024 * 1024 * 1024,   // 5GB
  studio:    25 * 1024 * 1024 * 1024,  // 25GB
  unlimited: 25 * 1024 * 1024 * 1024,  // 25GB — admin/super_user, capped same as Studio
};

export function planKeyForExport(role?: string, plan?: string): string {
  return planKeyFor(role, plan);
}

// "unlimited" here means unrestricted feature access (Stems, DAW, project
// count) — NOT unlimited Supabase resources. Admin/super_user get a real,
// generous resource ceiling like everyone else, computed from their actual
// usage_events, not bypassed.
function planKeyFor(role?: string, plan?: string): string {
  if (role === "admin" || role === "super_user") return "unlimited";
  return plan ?? "free";
}

export async function checkEgressBudget(): Promise<{
  allowed: boolean;
  usedBytes: number;
  budgetBytes: number;
  plan: string;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { allowed: false, usedBytes: 0, budgetBytes: 0, plan: "free" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, role")
    .eq("id", user.id)
    .single();

  const planKey = planKeyFor(profile?.role, profile?.plan);
  const budgetBytes = EGRESS_BUDGET[planKey];

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: events } = await supabase
    .from("usage_events")
    .select("bytes_actual")
    .eq("user_id", user.id)
    .gte("created_at", startOfMonth.toISOString());

  const usedBytes = (events ?? []).reduce((sum, e: any) => sum + (e.bytes_actual ?? 0), 0);

  return { allowed: usedBytes < budgetBytes, usedBytes, budgetBytes, plan: planKey };
}

export async function checkStorageBudget(): Promise<{
  allowed: boolean;
  usedBytes: number;
  budgetBytes: number;
  plan: string;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { allowed: false, usedBytes: 0, budgetBytes: 0, plan: "free" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, role")
    .eq("id", user.id)
    .single();

  const planKey = planKeyFor(profile?.role, profile?.plan);
  const budgetBytes = STORAGE_BUDGET[planKey];

  const [{ data: mixFiles }, { data: stemFiles }] = await Promise.all([
    supabase.from("project_files").select("file_size").eq("user_id", user.id),
    supabase.from("project_stems").select("file_size").eq("user_id", user.id),
  ]);

  const mixBytes  = (mixFiles  ?? []).reduce((sum, f: any) => sum + (f.file_size ?? 0), 0);
  const stemBytes = (stemFiles ?? []).reduce((sum, f: any) => sum + (f.file_size ?? 0), 0);
  const usedBytes = mixBytes + stemBytes;

  return { allowed: usedBytes < budgetBytes, usedBytes, budgetBytes, plan: planKey };
}