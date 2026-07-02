/**
 * audioCache.ts — browser-side audio file cache
 *
 * Uses the browser Cache API to persist fetched audio blobs across
 * page navigations and browser restarts. One egress hit per file per
 * device, then zero until the file is replaced (new path = cache miss).
 *
 * Cache key: the Supabase file path (e.g. "user_id/masters/project_id-timestamp-master.wav")
 * Cache name: "nokashi-audio-v1" — bump the version string to invalidate all entries globally
 */

const CACHE_NAME = "nokashi-audio-v1";

/**
 * Retrieve a cached audio blob by its Supabase file path.
 * Returns null if not cached or Cache API is unavailable.
 */
export async function getCachedAudio(filePath: string): Promise<Blob | null> {
  if (typeof caches === "undefined") return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(filePath);
    if (!response) return null;
    return await response.blob();
  } catch (err) {
    console.warn("[AudioCache] Read failed:", err);
    return null;
  }
}

/**
 * Store an audio blob in the cache under its Supabase file path.
 * Fire-and-forget safe — errors are logged but never thrown.
 */
export async function setCachedAudio(filePath: string, blob: Blob): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(filePath, new Response(blob, {
      headers: { "Content-Type": blob.type || "audio/wav" }
    }));
    console.log(`[AudioCache] Stored: ${filePath} (${(blob.size / 1024 / 1024).toFixed(1)}MB)`);
  } catch (err) {
    console.warn("[AudioCache] Write failed:", err);
  }
}

/**
 * Delete a specific file from the cache — call this when a file is
 * replaced or deleted so stale blobs don't linger unnecessarily.
 * Optional: even without calling this, stale entries are never served
 * since the new file has a different path.
 */
export async function deleteCachedAudio(filePath: string): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(filePath);
    console.log(`[AudioCache] Deleted: ${filePath}`);
  } catch (err) {
    console.warn("[AudioCache] Delete failed:", err);
  }
}

/**
 * Get a cached blob and immediately create a blob URL from it.
 * Returns null if not cached.
 * Remember to revoke the returned URL when done (URL.revokeObjectURL).
 */
export async function getCachedAudioUrl(filePath: string): Promise<string | null> {
  const blob = await getCachedAudio(filePath);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}