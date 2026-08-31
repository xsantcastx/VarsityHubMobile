import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * "Seen the posting-rules notice" ledger, per (user, event page).
 *
 * Owner rule (2026-07-16): the first time someone posts to an event they
 * attended, remind them to keep it to photos/videos from the game. FIRST post
 * per event only — a fan who posts thirteen times must not read the same notice
 * thirteen times.
 *
 * AsyncStorage, versioned key prefix, failures swallowed. The key includes the
 * user id because this local record is the only source of truth for "have you
 * seen this?", so a second account on a shared device should still see it once.
 *
 * Purely local by design: this is a UX nicety, not a gate. Losing it (new
 * device, reinstall, cleared storage) re-shows the notice once, which is the
 * harmless failure direction.
 */
const KEY_PREFIX = 'vh:event-posting-notice:v1:';

type PageId = string | null | undefined;

const keyFor = (userId: string, pageId: string) => `${KEY_PREFIX}${userId}:${pageId}`;

const validIds = (ids: PageId[]): string[] =>
  ids.filter((id): id is string => typeof id === 'string' && id.length > 0);

/**
 * True when this user has NOT yet seen the posting-rules notice for any of the
 * given page ids (an event page is known by its game id and/or event id — a
 * notice seen under either counts, so linking a game to an event later doesn't
 * re-show it).
 *
 * Unreadable storage returns false: better to skip a reminder than to nag on
 * every post.
 */
export async function shouldShowEventPostingNotice(
  userId: PageId,
  ids: PageId[]
): Promise<boolean> {
  if (typeof userId !== 'string' || !userId) return false;
  const pageIds = validIds(ids);
  if (!pageIds.length) return false;
  try {
    for (const pageId of pageIds) {
      if (await AsyncStorage.getItem(keyFor(userId, pageId))) return false;
    }
    return true;
  } catch (err) {
    if (__DEV__) {
      console.warn('[event-posting-notice] failed to read notice state:', err);
    }
    return false;
  }
}

/** Record that this user has now seen the notice for these page ids. */
export async function markEventPostingNoticeSeen(userId: PageId, ids: PageId[]): Promise<void> {
  if (typeof userId !== 'string' || !userId) return;
  const now = String(Date.now());
  await Promise.all(
    validIds(ids).map(async pageId => {
      try {
        await AsyncStorage.setItem(keyFor(userId, pageId), now);
      } catch (err) {
        if (__DEV__) {
          console.warn('[event-posting-notice] failed to write notice state:', err);
        }
        // Non-critical UX bookkeeping — never surface storage failures.
      }
    })
  );
}
