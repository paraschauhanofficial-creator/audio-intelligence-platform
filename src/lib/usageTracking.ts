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