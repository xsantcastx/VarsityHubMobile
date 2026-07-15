import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Client-side mirror of the server's EventPostingUnlock ledger (owner rule,
 * 2026-07-15 Fanatics Fest punch list): once a user's geofenced post/story to
 * an event page succeeds, they may keep uploading to that page for 7 days
 * without re-passing the geofence. The SERVER is authoritative — this local
 * record exists only so the client's preflight UX (location prompts, distance
 * warnings) doesn't block a user the server would allow. Missing local state
 * (new device, pre-update posts) just means the preflight stays strict; the
 * server still admits unlocked users.
 */
const KEY_PREFIX = 'vh:event-posting-unlock:v1:';
const UNLOCK_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

type PageId = string | null | undefined;

/**
 * Record a successful upload to an event page. Pass every id the page is
 * known by (game id and/or event id) — first write wins per id so the 7-day
 * window never slides forward.
 */
export async function recordEventPostingUnlock(ids: PageId[]): Promise<void> {
  const now = Date.now();
  await Promise.all(
    ids
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
      .map(async id => {
        const key = KEY_PREFIX + id;
        try {
          const existing = await AsyncStorage.getItem(key);
          if (!existing) await AsyncStorage.setItem(key, String(now));
        } catch {
          // Non-critical UX bookkeeping — never surface storage failures.
        }
      })
  );
}

/** True when any of the given page ids has an unlock from the last 7 days. */
export async function hasLocalEventPostingUnlock(ids: PageId[]): Promise<boolean> {
  const now = Date.now();
  for (const id of ids) {
    if (typeof id !== 'string' || !id.length) continue;
    try {
      const raw = await AsyncStorage.getItem(KEY_PREFIX + id);
      const ts = raw ? Number(raw) : NaN;
      if (Number.isFinite(ts) && now - ts <= UNLOCK_DURATION_MS) return true;
    } catch {
      // Treat unreadable storage as "no unlock" — preflight stays strict.
    }
  }
  return false;
}
