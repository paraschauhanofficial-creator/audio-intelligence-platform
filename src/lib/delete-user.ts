// src/lib/delete-user.ts
// Server-only helper: completely removes a user — storage files,
// then the auth account (DB rows vanish via CASCADE, see Step 3 SQL).
// NEVER import this in a client component.

import { createClient } from "@supabase/supabase-js";

const BUCKETS = ["project-files", "audio-files"];

export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function deleteUserCompletely(userId: string) {
  const admin = adminClient();

  // 1. Collect every file path this user owns, straight from the DB
  const [{ data: files }, { data: stems }] = await Promise.all([
    admin.from("project_files").select("file_path").eq("user_id", userId),
    admin.from("project_stems").select("file_path").eq("user_id", userId),
  ]);

  const paths = [...(files ?? []), ...(stems ?? [])]
    .map(r => r.file_path)
    .filter((p): p is string => typeof p === "string" && p.length > 0);

  // 2. Remove those paths from both buckets.
  //    (Removing a path that doesn't exist in a bucket is harmless,
  //    so we don't need to know which table maps to which bucket.)
  if (paths.length > 0) {
    for (const bucket of BUCKETS) {
      // remove() accepts max ~1000 paths per call — chunk to be safe
      for (let i = 0; i < paths.length; i += 500) {
        await admin.storage.from(bucket).remove(paths.slice(i, i + 500));
      }
    }
  }

  // 3. Delete the auth user. ON DELETE CASCADE wipes their rows in
  //    profiles, projects, project_files, project_stems, notifications,
  //    usage_events, admin_audit_log.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}