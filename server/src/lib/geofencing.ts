/**
 * Geofencing utilities for location-based event posting
 *
 * BUSINESS RULES:
 * - The geofence is strict for every normal upload to an event page: the user
 *   must be within 3km of the venue with device-origin coordinates.
 * - Posts and stories use the same live event posting window.
 * - The standard window opens 2 hours before event start and closes 4 hours
 *   after start (3h expected event time + 1h after). Coaches may choose an
 *   all-day 12-hour window.
 * - A user who posts while physically at the event gets 7 days of regular
 *   event-page post access. Stories still require the live window + geofence.
 * - Sample events/games (IDs starting with "sample-") bypass all geofencing checks
 *
 * This maintains authenticity and prevents users from different states from trolling games.
 */

import { prisma } from './prisma.js';

const EARTH_RADIUS_KM = 6371;
const EARTH_RADIUS_MILES = 3959;
const REGULAR_POST_OPEN_BEFORE_MS = 2 * 60 * 60 * 1000;
export const DEFAULT_LIVE_WINDOW_HOURS_AFTER_START = 4;
export const ALL_DAY_LIVE_WINDOW_HOURS_AFTER_START = 12;
export const ALLOWED_LIVE_WINDOW_HOURS_AFTER_START = [
  DEFAULT_LIVE_WINDOW_HOURS_AFTER_START,
  ALL_DAY_LIVE_WINDOW_HOURS_AFTER_START,
] as const;
export const EVENT_POSTING_UNLOCK_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export type PostingPermissionErrorCode =
  | 'EVENT_NOT_FOUND'
  | 'NO_EVENT_LOCATION'
  | 'POSTING_WINDOW_CLOSED'
  | 'TOO_FAR_FROM_VENUE'
  | 'LOCATION_REQUIRED'
  | 'LOCATION_SPOOF_SUSPECTED'
  | 'EXCLUSIVE_POSTER_ONLY';

/**
 * Legacy rejection string kept for routes/tests that still check historical
 * posting-unlock read behavior. Normal upload gates now use the strict event
 * window reason returned below.
 */
export const EVENT_ENDED_NOT_PRESENT_REASON =
  "Sorry — you didn't post to this event while you were there, so you don't have access to post to it afterwards.";

export type PostingPermissionResult = {
  allowed: boolean;
  code?: PostingPermissionErrorCode;
  reason?: string;
  distance?: number;
};

export type PostPostingWindowState = 'before_open' | 'live' | 'closed';

const postingEventSelect = {
  id: true,
  title: true,
  date: true,
  latitude: true,
  longitude: true,
  location: true,
  game_id: true,
  exclusive_poster_id: true,
  live_window_hours_after_start: true,
} as const;

type PostingEvent = Awaited<ReturnType<typeof loadPostingEvent>>;

const formatWindowDateTime = (date: Date) =>
  date.toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @param unit 'km' or 'miles'
 * @returns Distance in specified unit
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  unit: 'km' | 'miles' = 'miles'
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const radius = unit === 'km' ? EARTH_RADIUS_KM : EARTH_RADIUS_MILES;
  return radius * c;
}

/**
 * Check if a user is within the geofence of an event location
 * @param radiusKm Radius in kilometers (default: 0.5 miles for legacy compatibility)
 */
export function isWithinGeofence(
  userLat: number,
  userLon: number,
  eventLat: number,
  eventLon: number,
  radiusKm: number = 0.8 // Default: 0.8km (roughly 0.5 miles) for backwards compatibility
): boolean {
  const distance = calculateDistance(userLat, userLon, eventLat, eventLon, 'km');
  return distance <= radiusKm;
}

/**
 * Check if the first-upload posting window is open for stories.
 *
 * Stories use the same event posting window as regular posts.
 */
export function isStoryPostingWindowOpen(
  eventDate: Date,
  liveWindowHoursAfterStart?: number | null,
  now: Date = new Date()
): boolean {
  return getPostPostingWindowState(eventDate, now, liveWindowHoursAfterStart) === 'live';
}

/**
 * Check if posting window is open for regular posts
 * Posts: the live window opens 2 hours before event start and closes
 * `liveWindowHoursAfterStart` hours after (standard 4; all-day 12).
 */
export function isPostPostingWindowOpen(
  eventDate: Date,
  liveWindowHoursAfterStart?: number | null
): boolean {
  const now = new Date();
  const state = getPostPostingWindowState(eventDate, now, liveWindowHoursAfterStart);
  return state !== 'before_open' && state !== 'closed';
}

export function getPostPostingWindowBounds(
  eventDate: Date,
  liveWindowHoursAfterStart?: number | null
) {
  const eventTime = new Date(eventDate);
  const windowStart = new Date(eventTime.getTime() - REGULAR_POST_OPEN_BEFORE_MS);
  const afterStartHours =
    typeof liveWindowHoursAfterStart === 'number' &&
    ALLOWED_LIVE_WINDOW_HOURS_AFTER_START.includes(liveWindowHoursAfterStart as any)
      ? liveWindowHoursAfterStart
      : DEFAULT_LIVE_WINDOW_HOURS_AFTER_START;
  const liveCutoff = new Date(eventTime.getTime() + afterStartHours * 60 * 60 * 1000);

  return {
    eventTime,
    windowStart,
    liveCutoff,
  };
}

export function getPostPostingWindowState(
  eventDate: Date,
  now: Date = new Date(),
  liveWindowHoursAfterStart?: number | null
): PostPostingWindowState {
  const { windowStart, liveCutoff } = getPostPostingWindowBounds(
    eventDate,
    liveWindowHoursAfterStart
  );
  if (now < windowStart) return 'before_open';
  // 'live' = geofenced posting allowed: anyone at the venue can post.
  if (now <= liveCutoff) return 'live';
  return 'closed';
}

/**
 * Serialize a game/event's live posting window for the client.
 *
 * The client used to re-derive this from the game's own date with hardcoded
 * fallbacks, so a server-side live-window override could disagree with the app.
 * The window is a server rule; ship the computed bounds instead of the inputs
 * so there is exactly one implementation.
 *
 * `eventDate` must be the EVENT's date when a linked event exists: that is what
 * the posting checks in this file enforce against, and a game row's own date
 * can disagree with it.
 */
export type SerializedLiveWindow = {
  /** Authoritative event start — a linked game row's own `date` can disagree. */
  starts_at: string | null;
  /** Geofenced posting opens (start - 2h). */
  live_from: string | null;
  /** Geofenced posting closes (start + the per-event window, default 4h). */
  live_until: string | null;
};

const EMPTY_LIVE_WINDOW: SerializedLiveWindow = {
  starts_at: null,
  live_from: null,
  live_until: null,
};

export function serializeLiveWindow(
  eventDate: Date | string | null | undefined,
  liveWindowHoursAfterStart?: number | null
): SerializedLiveWindow {
  if (!eventDate) return EMPTY_LIVE_WINDOW;
  const parsed = eventDate instanceof Date ? eventDate : new Date(eventDate);
  if (Number.isNaN(parsed.getTime())) return EMPTY_LIVE_WINDOW;
  const { eventTime, windowStart, liveCutoff } = getPostPostingWindowBounds(
    parsed,
    liveWindowHoursAfterStart
  );
  return {
    starts_at: eventTime.toISOString(),
    live_from: windowStart.toISOString(),
    live_until: liveCutoff.toISOString(),
  };
}

/**
 * Read-access helper: has this viewer posted to this game/event? Viewing is
 * PERMANENT and never expires (owner rule, 2026-07-14: "any user can view any
 * past game at any time; it'll lock posting but viewing is always on"). This
 * is the additive contributor fallback for the niche case of a not-yet-public
 * entity (e.g. a future game still awaiting opponent consent) — a contributor
 * who posted there can always see it. Read-only; grants no approval power.
 */
export async function viewerHasPostedOnEntity({
  userId,
  gameId,
  eventId,
}: {
  userId?: string | null;
  gameId?: string | null;
  eventId?: string | null;
}): Promise<boolean> {
  if (!userId) return false;
  if (!gameId && !eventId) return false;

  const orClauses: Array<{ game_id: string } | { event_id: string }> = [];
  if (gameId) orClauses.push({ game_id: gameId });
  if (eventId) orClauses.push({ event_id: eventId });

  const priorPost = await prisma.post.findFirst({
    where: {
      author_id: userId,
      deleted_at: null,
      OR: orClauses,
    },
    select: { id: true },
  });

  return !!priorPost;
}

/**
 * Legacy manual unlock ledger. The normal upload gate no longer honors this;
 * it remains for historical rows and one-off scripts until the schema is
 * cleaned up in a separate migration.
 */
export async function grantEventPostingUnlock(
  userId: string,
  eventId: string,
  unlockedAt?: Date
): Promise<void> {
  try {
    // createMany + skipDuplicates: first write wins, so the original anchor is
    // never refreshed by later uploads (the window must not slide).
    await prisma.eventPostingUnlock.createMany({
      data: [
        { user_id: userId, event_id: eventId, ...(unlockedAt ? { unlocked_at: unlockedAt } : {}) },
      ],
      skipDuplicates: true,
    });
  } catch (error) {
    // Never block a geofence-passed upload on ledger bookkeeping.
    console.warn('[geofencing] Failed to persist posting unlock:', error);
  }
}

async function getEventPostingUnlockAnchor(
  userId: string,
  event: { id: string; game_id: string | null }
): Promise<Date | null> {
  const row = await prisma.eventPostingUnlock.findUnique({
    where: { user_id_event_id: { user_id: userId, event_id: event.id } },
    select: { unlocked_at: true },
  });
  if (row) return row.unlocked_at;

  // Legacy fallback: uploads made before the unlock ledger shipped. Any
  // surviving post/story on this page passed the geofence when it was created
  // (or was an admin/demo bypass, which needs no unlock anyway).
  const orClauses: Array<{ event_id: string } | { game_id: string }> = [{ event_id: event.id }];
  if (event.game_id) orClauses.push({ game_id: event.game_id });

  const earliestPost = await prisma.post.findFirst({
    where: { author_id: userId, deleted_at: null, OR: orClauses },
    orderBy: { created_at: 'asc' },
    select: { created_at: true },
  });
  const earliestStory = event.game_id
    ? await prisma.story.findFirst({
        where: { user_id: userId, game_id: event.game_id },
        orderBy: { created_at: 'asc' },
        select: { created_at: true },
      })
    : null;

  const candidates = [earliestPost?.created_at, earliestStory?.created_at].filter(
    (d): d is Date => d instanceof Date
  );
  if (!candidates.length) return null;

  const anchor = new Date(Math.min(...candidates.map(d => d.getTime())));
  await grantEventPostingUnlock(userId, event.id, anchor);
  return anchor;
}

export async function hasActiveEventPostingUnlock(
  userId: string,
  event: { id: string; game_id: string | null },
  now: Date = new Date()
): Promise<boolean> {
  const anchor = await getEventPostingUnlockAnchor(userId, event);
  if (!anchor) return false;
  return now.getTime() - anchor.getTime() <= EVENT_POSTING_UNLOCK_DURATION_MS;
}

/**
 * Check if posting window is open for an event (legacy - kept for backwards compatibility)
 * @deprecated Use isStoryPostingWindowOpen or isPostPostingWindowOpen instead
 */
export function isPostingWindowOpen(
  eventDate: Date,
  liveWindowHoursAfterStart?: number | null
): boolean {
  return getPostPostingWindowState(eventDate, new Date(), liveWindowHoursAfterStart) === 'live';
}

async function loadPostingEvent(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    select: postingEventSelect,
  });
}

/**
 * Additive designated-poster allowlist (owner rule, 2026-07-19 Fanatics Fest):
 * a user granted here may post AND upload stories to the event page at any
 * time, from anywhere — bypassing the live window and the venue geofence —
 * WITHOUT blocking any other user (normal attendees keep the standard rules).
 * This is the post-event "give a specific person continued access for
 * marketing/continuity" grant. Contrast `exclusive_poster_id`, which is
 * single-user and blocks everyone else. Grant/revoke via
 * `server/scripts/set-event-designated-poster.ts`.
 */
export async function isDesignatedEventPoster(userId: string, eventId: string): Promise<boolean> {
  const row = await prisma.eventDesignatedPoster.findUnique({
    where: { event_id_user_id: { event_id: eventId, user_id: userId } },
    select: { user_id: true },
  });
  return !!row;
}

async function resolveVenueCoordinates(event: PostingEvent) {
  let venueLat = typeof event?.latitude === 'number' ? event.latitude : null;
  let venueLon = typeof event?.longitude === 'number' ? event.longitude : null;
  if (venueLat == null || venueLon == null) {
    const game = event?.game_id
      ? await prisma.game.findUnique({
          where: { id: event.game_id },
          select: { latitude: true, longitude: true, venue_lat: true, venue_lng: true },
        })
      : null;
    venueLat = venueLat ?? game?.latitude ?? game?.venue_lat ?? null;
    venueLon = venueLon ?? game?.longitude ?? game?.venue_lng ?? null;
  }
  return { venueLat, venueLon };
}

/**
 * Verify user can post a story to an event based on location and time.
 * Stories require the event posting window + 3km radius.
 * @returns { allowed: boolean; reason?: string; distance?: number }
 */
// v1.0.2 pass 9: server-side anti-spoof for client-supplied geofence coords. We can't fully
// trust GPS from the client (rooted device, mock locations, modified app binary), so we add
// a coarse IP-geo cross-check. If client coords differ from IP region by >250 miles, reject.
// Won't stop a determined attacker with VPN at the venue's region, but raises the bar for
// trivial spoofing.
async function verifyClientCoordsVsIp(
  userLat: number,
  userLon: number,
  ipAddress: string | null
): Promise<{ ok: boolean; reason?: string }> {
  // v1.0.2 pass 10: ops escape hatch. If ipapi.co rate-limits or has an outage, set
  // DISABLE_GEOFENCE_IP_CHECK=1 in Railway env to skip the cross-check and let stories through.
  if (
    process.env.DISABLE_GEOFENCE_IP_CHECK === '1' ||
    process.env.DISABLE_GEOFENCE_IP_CHECK === 'true'
  ) {
    console.warn('[geofencing] IP coordinate cross-check skipped', {
      reason: 'disabled_by_env',
      ip_present: Boolean(ipAddress),
    });
    return { ok: true };
  }
  if (!ipAddress) {
    console.warn('[geofencing] IP coordinate cross-check skipped', { reason: 'missing_ip' });
    return { ok: true };
  }
  if (
    ipAddress === '::1' ||
    ipAddress === '127.0.0.1' ||
    ipAddress.startsWith('10.') ||
    ipAddress.startsWith('192.168.')
  ) {
    // Local/private IP — skip check (dev / VPN through corporate net are common false positives)
    console.warn('[geofencing] IP coordinate cross-check skipped', {
      reason: 'private_or_loopback_ip',
      ipAddress,
    });
    return { ok: true };
  }
  try {
    // ipapi.co is free for ~1k req/day; fail open but log so provider trouble is visible.
    const resp = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!resp.ok) {
      console.warn('[geofencing] IP coordinate cross-check skipped', {
        reason: 'provider_http_error',
        status: resp.status,
      });
      return { ok: true };
    }
    const data: any = await resp.json();
    if (typeof data?.latitude !== 'number' || typeof data?.longitude !== 'number') {
      console.warn('[geofencing] IP coordinate cross-check skipped', {
        reason: 'provider_missing_coordinates',
      });
      return { ok: true };
    }
    const distMi = calculateDistance(userLat, userLon, data.latitude, data.longitude, 'miles');
    if (distMi > 250) {
      return {
        ok: false,
        reason: `Reported location is ${Math.round(distMi)}mi from your network location. If you're using a VPN, please disable it.`,
      };
    }
    return { ok: true };
  } catch (err) {
    // Network failure or rate limit — don't block legitimate users; let geofence proceed
    console.warn('[geofencing] IP coordinate cross-check skipped', {
      reason: 'provider_exception',
      error: (err as Error)?.message || String(err),
    });
    return { ok: true };
  }
}

export async function verifyStoryPostingPermission(
  eventId: string,
  userId: string,
  userLat: number | null,
  userLon: number | null,
  ipAddress?: string | null
): Promise<PostingPermissionResult> {
  const event = await loadPostingEvent(eventId);

  if (!event) {
    return { allowed: false, code: 'EVENT_NOT_FOUND', reason: 'Event not found' };
  }

  // Additive designated-poster grant covers stories at any time.
  if (await isDesignatedEventPoster(userId, event.id)) {
    return { allowed: true };
  }

  const { windowStart, liveCutoff } = getPostPostingWindowBounds(
    event.date,
    event.live_window_hours_after_start
  );
  const postingWindowState = getPostPostingWindowState(
    event.date,
    new Date(),
    event.live_window_hours_after_start
  );

  if (postingWindowState === 'before_open') {
    return {
      allowed: false,
      code: 'POSTING_WINDOW_CLOSED',
      reason: `Stories open at ${formatWindowDateTime(windowStart)}, 2 hours before the event starts.`,
    };
  }

  if (postingWindowState === 'closed') {
    return {
      allowed: false,
      code: 'POSTING_WINDOW_CLOSED',
      reason: `Stories could be posted from the venue until ${formatWindowDateTime(liveCutoff)}. That window has closed.`,
    };
  }

  const { venueLat, venueLon } = await resolveVenueCoordinates(event);

  // Device coords within 3km of the venue, plus the IP anti-spoof cross-check.
  let strictFailure: PostingPermissionResult;
  if (venueLat == null || venueLon == null) {
    console.warn(`Event ${eventId} and game missing coordinates - blocking story upload`);
    strictFailure = {
      allowed: false,
      code: 'NO_EVENT_LOCATION',
      reason:
        'This event has no venue coordinates, so story uploads are disabled until the location is configured.',
    };
  } else if (userLat === null || userLon === null) {
    strictFailure = {
      allowed: false,
      code: 'LOCATION_REQUIRED',
      reason: 'Stories require current device location within 3 km of the venue.',
    };
  } else {
    const distance = calculateDistance(userLat, userLon, venueLat, venueLon, 'km');
    const isWithin = isWithinGeofence(userLat, userLon, venueLat, venueLon, 3.0); // 3km for stories

    if (!isWithin) {
      strictFailure = {
        allowed: false,
        code: 'TOO_FAR_FROM_VENUE',
        reason: 'You must be within 3 km of the venue to post a story.',
        distance,
      };
    } else {
      // v1.0.2 pass 9: anti-spoof — IP cross-check. If client says "I'm at venue X" but their
      // network IP is in a different region, reject. Best-effort; never blocks on API failure.
      const ipCheck = ipAddress
        ? await verifyClientCoordsVsIp(userLat, userLon, ipAddress)
        : { ok: true as const };
      if (!ipCheck.ok) {
        strictFailure = {
          allowed: false,
          code: 'LOCATION_SPOOF_SUSPECTED',
          reason: ipCheck.reason || 'Reported location does not match your network location.',
        };
      } else {
        return { allowed: true, distance };
      }
    }
  }

  return strictFailure;
}

/**
 * Verify user can post to an event based on location and time
 * Posts: the geofenced live window runs -2h → +Nh around event start (N =
 * live_window_hours_after_start, standard 4; all-day events use 12).
 * @returns { allowed: boolean; reason?: string; distance?: number }
 */
export async function verifyEventPostingPermission(
  eventId: string,
  userId: string,
  userLat: number | null,
  userLon: number | null
): Promise<PostingPermissionResult> {
  const event = await loadPostingEvent(eventId);

  if (!event) {
    return { allowed: false, code: 'EVENT_NOT_FOUND', reason: 'Event not found' };
  }

  // Additive designated-poster grant (see isDesignatedEventPoster): allowlisted
  // users post from anywhere at any time. Checked before the exclusive lock so
  // a grant always admits, and before the window/geofence so it survives event
  // close — all without affecting any other user.
  if (await isDesignatedEventPoster(userId, event.id)) {
    return { allowed: true };
  }

  // Exclusive-poster lock (owner one-off feature, 2026-07-14): when an event
  // designates a single poster, ONLY that user may post — bypassing the window
  // and geofence for them, and blocking everyone else outright (even attendees
  // who were there). Null = normal multi-fan posting (falls through below).
  if (event.exclusive_poster_id) {
    if (event.exclusive_poster_id === userId) {
      return { allowed: true };
    }
    return {
      allowed: false,
      code: 'EXCLUSIVE_POSTER_ONLY',
      reason: 'Only the designated poster can post to this event.',
    };
  }

  const { windowStart, liveCutoff } = getPostPostingWindowBounds(
    event.date,
    event.live_window_hours_after_start
  );
  const postingWindowState = getPostPostingWindowState(
    event.date,
    new Date(),
    event.live_window_hours_after_start
  );

  if (postingWindowState === 'before_open') {
    return {
      allowed: false,
      code: 'POSTING_WINDOW_CLOSED',
      reason: `Posting opens ${formatWindowDateTime(windowStart)}.`,
    };
  }

  if (postingWindowState === 'closed') {
    if (await hasActiveEventPostingUnlock(userId, event)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      code: 'POSTING_WINDOW_CLOSED',
      reason: `Posting closed ${formatWindowDateTime(liveCutoff)}.`,
    };
  }

  // Live window: strict geofence for every normal upload.
  const { venueLat, venueLon } = await resolveVenueCoordinates(event);
  let strictFailure: PostingPermissionResult;
  if (venueLat == null || venueLon == null) {
    console.warn(`Event ${eventId} and game missing coordinates - blocking post upload`);
    strictFailure = {
      allowed: false,
      code: 'NO_EVENT_LOCATION',
      reason:
        'This event has no venue coordinates, so posting is disabled until the location is configured.',
    };
  } else if (userLat === null || userLon === null) {
    strictFailure = {
      allowed: false,
      code: 'LOCATION_REQUIRED',
      reason: 'Live event posts require current device location within 3 km of the venue.',
    };
  } else {
    const distance = calculateDistance(userLat, userLon, venueLat, venueLon, 'km');
    const isWithin = isWithinGeofence(userLat, userLon, venueLat, venueLon, 3.0); // 3km for posts

    if (!isWithin) {
      strictFailure = {
        allowed: false,
        code: 'TOO_FAR_FROM_VENUE',
        reason: 'You must be within 3 km of the venue to post.',
        distance,
      };
    } else {
      return { allowed: true, distance };
    }
  }

  return strictFailure;
}
