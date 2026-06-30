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

const EGRESS_BUDGET: Record<string, number> = {
  free:   200 * 1024 * 1024,       // 200MB/mo
  pro:    3 * 1024 * 1024 * 1024,  // 3GB/mo
  studio: 10 * 1024 * 1024 * 1024, // 10GB/mo
};

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

  // admin/super_user are unrestricted — no budget applies
  if (profile?.role === "admin" || profile?.role === "super_user") {
    return { allowed: true, usedBytes: 0, budgetBytes: Infinity, plan: "unlimited" };
  }

  const plan = profile?.plan ?? "free";
  const budgetBytes = EGRESS_BUDGET[plan];

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: events } = await supabase
    .from("usage_events")
    .select("bytes_actual")
    .eq("user_id", user.id)
    .gte("created_at", startOfMonth.toISOString());

  const usedBytes = (events ?? []).reduce((sum, e: any) => sum + (e.bytes_actual ?? 0), 0);

  return { allowed: usedBytes < budgetBytes, usedBytes, budgetBytes, plan };
}