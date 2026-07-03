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

async function notificationExistsToday(userId: string, type: string): Promise<boolean> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .gte("created_at", startOfDay.toISOString())
    .limit(1);

  return (data?.length ?? 0) > 0;
}

async function maybeNotify(userId: string, type: string, title: string, message: string) {
  const alreadySent = await notificationExistsToday(userId, type);
  if (alreadySent) return;

  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    message,
    read: false, // explicit — don't rely on the DB column default
  });
  if (error) console.error("notifications insert failed:", error);
}

/**
 * Checks both egress and storage usage against 70%/90% slabs and fires a
 * notification (max once per day per slab) when crossed. Safe to call
 * alongside checkEgressBudget()/checkStorageBudget() — it's read-mostly and
 * never blocks anything itself.
 */
export async function checkUsageSlabsAndNotify(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const egress = await checkEgressBudget();
  const storage = await checkStorageBudget();

  const egressPct = egress.budgetBytes > 0 ? (egress.usedBytes / egress.budgetBytes) * 100 : 0;
  const storagePct = storage.budgetBytes > 0 ? (storage.usedBytes / storage.budgetBytes) * 100 : 0;

  if (egressPct >= 90) {
    await maybeNotify(
      user.id, "egress_limit_90",
      "Preview & playback limit almost reached",
      "You're at 90% or more of this month's preview and playback allowance. Once it's hit, waveforms and downloads will pause until next month."
    );
  } else if (egressPct >= 70) {
    await maybeNotify(
      user.id, "egress_warning_70",
      "Heavy preview & playback usage",
      "You've used 70% or more of this month's preview and playback allowance. Pausing previews can help you stay under your plan's limit."
    );
  }

  if (storagePct >= 90) {
    await maybeNotify(
      user.id, "storage_limit_90",
      "Storage almost full",
      "You're using 90% or more of your plan's storage. Remove old projects or upgrade to keep uploading."
    );
  } else if (storagePct >= 70) {
    await maybeNotify(
      user.id, "storage_warning_70",
      "Storage filling up",
      "You're using 70% or more of your plan's storage."
    );
  }
}

/**
 * Fires the 'egress_blocked' notification — separate from the 70%/90%
 * warnings, this fires at the actual moment an action gets refused.
 * Still capped to once per day per user, same as the warning slabs, so a
 * user clicking a blocked button repeatedly doesn't spam their own bell.
 */
export async function notifyEgressBlocked(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await maybeNotify(
    user.id, "egress_blocked",
    "Action blocked — monthly limit reached",
    "You've used your full preview & playback allowance for this month. Upgrade your plan or wait until it resets to continue."
  );
}

/**
 * Fires the 'storage_limit_90' notification — at the moment an upload gets
 * refused for being over the storage cap (now enforced at the RLS level).
 * Once per day per user, same pattern as notifyEgressBlocked().
 */
export async function notifyStorageBlocked(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await maybeNotify(
    user.id, "storage_limit_90",
    "Upload blocked — storage full",
    "You've used your full storage allowance. Delete older projects or upgrade your plan to keep uploading."
  );
}

function formatBytesShort(bytes: number): string {
  if (bytes <= 0) return "0MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)}MB`;
  return `${(mb / 1024).toFixed(1)}GB`;
}

/**
 * Fires once per day, on login — a quick "here's where you stand" summary
 * showing storage and preview/playback remaining. Reuses checkStorageBudget
 * and checkEgressBudget so the numbers always match the real meters, no
 * separate calculation.
 */
export async function notifyLoginSummary(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const alreadySentToday = await notificationExistsToday(user.id, "login_summary");
  if (alreadySentToday) return;

  const storage = await checkStorageBudget();
  const egress = await checkEgressBudget();

  const storageLeft = Math.max(0, storage.budgetBytes - storage.usedBytes);
  const egressLeft = Math.max(0, egress.budgetBytes - egress.usedBytes);

  await maybeNotify(
    user.id, "login_summary",
    "Welcome back",
    `You have ${formatBytesShort(storageLeft)} of storage and ${formatBytesShort(egressLeft)} of preview & playback left this month.`
  );
}