import type { PrismaClient } from '@prisma/client';
import {
  EVENT_POSTING_UNLOCK_DURATION_MS,
  getPostPostingWindowState,
  serializeLiveWindow,
} from './geofencing.js';
import { proLeagueToSport } from './proSchedule/leagueSport.js';
import { venuePhotoFor } from './proSchedule/venuePhotos.js';

type Db = PrismaClient;
type DiscoverySurface = 'feed' | 'map' | 'all';

export type EventDiscoveryParams = {
  surface?: DiscoverySurface;
  from?: Date | null;
  to?: Date | null;
  limit?: number;
  viewerId?: string | null;
  now?: Date;
};

const MAP_LOOKAHEAD_MS = 5 * 24 * 60 * 60 * 1000;
const FEED_PAST_LOOKBACK_MS = 12 * 60 * 60 * 1000;
const MAX_DISCOVERY_RANGE_MS = MAP_LOOKAHEAD_MS;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 300;
const GEOFENCE_RADIUS_KM = 3;

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function resolveCoords(item: any): { latitude: number | null; longitude: number | null } {
  return {
    latitude: item.latitude ?? item.venue_lat ?? item.watch_location_lat ?? null,
    longitude: item.longitude ?? item.venue_lng ?? item.watch_location_lng ?? null,
  };
}

function defaultWindow(surface: DiscoverySurface, now: Date) {
  if (surface === 'feed') {
    return {
      from: new Date(now.getTime() - FEED_PAST_LOOKBACK_MS),
      to: new Date(now.getTime() + MAP_LOOKAHEAD_MS),
    };
  }
  return { from: now, to: new Date(now.getTime() + MAP_LOOKAHEAD_MS) };
}

function clampWindow(surface: DiscoverySurface, requestedFrom: Date, requestedTo: Date, now: Date) {
  const earliest = surface === 'feed' ? new Date(now.getTime() - FEED_PAST_LOOKBACK_MS) : now;
  const latest = new Date(now.getTime() + MAP_LOOKAHEAD_MS);
  const from = new Date(Math.max(requestedFrom.getTime(), earliest.getTime()));
  const to = new Date(Math.min(requestedTo.getTime(), latest.getTime()));
  if (to.getTime() - from.getTime() > MAX_DISCOVERY_RANGE_MS) {
    return { from, to: new Date(from.getTime() + MAX_DISCOVERY_RANGE_MS) };
  }
  return { from, to };
}

function buildCapabilities(
  event: {
    id: string | null;
    game_id: string | null;
    date: Date | string | null;
    exclusive_poster_id?: string | null;
    live_window_hours_after_start?: number | null;
  },
  viewerState: {
    viewerId?: string | null;
    designatedEventIds: Set<string>;
    unlocks: Map<string, Date>;
    now: Date;
  }
) {
  const liveWindow = serializeLiveWindow(event.date, event.live_window_hours_after_start);
  const state = event.date
    ? getPostPostingWindowState(
        event.date instanceof Date ? event.date : new Date(event.date),
        viewerState.now,
        event.live_window_hours_after_start
      )
    : 'closed';
  const isDesignated = !!event.id && viewerState.designatedEventIds.has(event.id);
  const isExclusivePoster =
    !!event.exclusive_poster_id && event.exclusive_poster_id === viewerState.viewerId;
  const blockedByExclusive =
    !!event.exclusive_poster_id && event.exclusive_poster_id !== viewerState.viewerId;
  const unlockAnchor = event.id ? (viewerState.unlocks.get(event.id) ?? null) : null;
  const unlockExpiresAt = unlockAnchor
    ? new Date(unlockAnchor.getTime() + EVENT_POSTING_UNLOCK_DURATION_MS)
    : null;
  const hasActiveUnlock =
    !!unlockExpiresAt && unlockExpiresAt.getTime() >= viewerState.now.getTime();

  const activeDesignatedGrant = isDesignated && hasActiveUnlock;
  const overrideAllowed = activeDesignatedGrant || isExclusivePoster;
  const canPostWithoutFreshGeofence = overrideAllowed || hasActiveUnlock;
  const windowLive = state === 'live';
  const closedCode = 'POSTING_WINDOW_CLOSED';
  const liveNeedsLocationCode = 'LOCATION_REQUIRED';

  return {
    live_window: liveWindow,
    posting_capabilities: {
      window_state: state,
      requires_location: !canPostWithoutFreshGeofence,
      geofence_radius_km: GEOFENCE_RADIUS_KM,
      designated_poster: isDesignated,
      exclusive_poster: !!event.exclusive_poster_id,
      unlock_expires_at: iso(unlockExpiresAt),
      post: {
        allowed_now: canPostWithoutFreshGeofence,
        reason_code: canPostWithoutFreshGeofence
          ? null
          : blockedByExclusive
            ? 'EXCLUSIVE_POSTER_ONLY'
            : windowLive
              ? liveNeedsLocationCode
              : closedCode,
      },
      story: {
        allowed_now: overrideAllowed,
        reason_code: overrideAllowed
          ? null
          : blockedByExclusive
            ? 'EXCLUSIVE_POSTER_ONLY'
            : windowLive
              ? liveNeedsLocationCode
              : closedCode,
      },
    },
    upload_access: {
      can_upload_post: canPostWithoutFreshGeofence,
      can_upload_story: overrideAllowed,
      needs_live_geofence_check: !canPostWithoutFreshGeofence && windowLive,
    },
  };
}

async function loadViewerState(
  db: Db,
  viewerId: string | null | undefined,
  eventIds: string[],
  now: Date
) {
  if (!viewerId || eventIds.length === 0) {
    return {
      viewerId,
      designatedEventIds: new Set<string>(),
      unlocks: new Map<string, Date>(),
      now,
    };
  }
  const [designatedRows, unlockRows] = await Promise.all([
    db.eventDesignatedPoster.findMany({
      where: { user_id: viewerId, event_id: { in: eventIds } },
      select: { event_id: true },
      take: eventIds.length,
    }),
    db.eventPostingUnlock.findMany({
      where: { user_id: viewerId, event_id: { in: eventIds } },
      select: { event_id: true, unlocked_at: true },
      take: eventIds.length,
    }),
  ]);
  return {
    viewerId,
    designatedEventIds: new Set(designatedRows.map(row => row.event_id)),
    unlocks: new Map(unlockRows.map(row => [row.event_id, row.unlocked_at])),
    now,
  };
}

async function loadExcludedPrivateTeamIds(
  db: any,
  viewerId: string | null | undefined
): Promise<Set<string>> {
  if (!db.team?.findMany) return new Set();
  const privateTeams: Array<{ id: string; organization_id: string | null }> =
    await db.team.findMany({
      where: { is_private: true, status: 'active' },
      select: { id: true, organization_id: true },
      take: 50000,
    });
  if (privateTeams.length === 0) return new Set();
  const privateTeamIds = privateTeams.map(team => team.id);
  if (!viewerId) return new Set(privateTeamIds);

  const organizationIds = [
    ...new Set(privateTeams.map(team => team.organization_id).filter(Boolean)),
  ];
  const [follows, memberships, orgMemberships] = await Promise.all([
    db.teamFollow.findMany({
      where: { user_id: viewerId, team_id: { in: privateTeamIds } },
      select: { team_id: true },
      take: Math.min(privateTeamIds.length, 50000),
    }),
    db.teamMembership.findMany({
      where: {
        user_id: viewerId,
        team_id: { in: privateTeamIds },
        status: 'active',
      },
      select: { team_id: true },
      take: Math.min(privateTeamIds.length, 50000),
    }),
    organizationIds.length > 0
      ? db.organizationMembership.findMany({
          where: {
            user_id: viewerId,
            organization_id: { in: organizationIds },
            role: { in: ['owner', 'manager'] },
            status: 'active',
          },
          select: { organization_id: true },
          take: Math.min(organizationIds.length, 50000),
        })
      : Promise.resolve([]),
  ]);

  const allowedTeamIds = new Set<string>([
    ...follows.map((row: any) => row.team_id),
    ...memberships.map((row: any) => row.team_id),
  ]);
  const allowedOrgIds = new Set(orgMemberships.map((row: any) => row.organization_id));
  for (const team of privateTeams) {
    if (team.organization_id && allowedOrgIds.has(team.organization_id)) {
      allowedTeamIds.add(team.id);
    }
  }
  return new Set(privateTeamIds.filter(teamId => !allowedTeamIds.has(teamId)));
}

function feedPriority(dateValue: Date | string | null | undefined, now: Date): number {
  const parsed = dateValue ? new Date(dateValue) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return 90;
  const state = getPostPostingWindowState(parsed, now);
  if (state === 'live') return 0;
  if (parsed.getTime() > now.getTime()) return 10;
  return 20;
}

export async function listEventDiscoveryItems(db: Db, params: EventDiscoveryParams) {
  const now = params.now ?? new Date();
  const surface = params.surface ?? 'all';
  const defaults = defaultWindow(surface, now);
  const { from, to } = clampWindow(
    surface,
    params.from ?? defaults.from,
    params.to ?? defaults.to,
    now
  );
  const limit = Math.max(1, Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT));
  const dateWhere = { gte: from, lte: to };
  const queryLimit = Math.min(limit * 2, MAX_LIMIT);

  const [games, events] = await Promise.all([
    db.game.findMany({
      where: {
        approval_status: 'approved',
        opponent_approval_status: { in: ['not_required', 'approved'] },
        date: dateWhere,
      },
      orderBy: { date: 'asc' },
      take: queryLimit,
      include: {
        events: {
          orderBy: { date: 'asc' },
          take: 1,
          include: {
            proHomeTeam: { select: { league: true, primary_color: true } },
            proAwayTeam: { select: { league: true, primary_color: true } },
          },
        },
        homeTeam: { select: { sport: true } },
        awayTeam: { select: { sport: true } },
      },
    } as any),
    db.event.findMany({
      where: {
        approval_status: 'approved',
        status: { not: 'cancelled' },
        game_id: null,
        date: dateWhere,
      },
      orderBy: { date: 'asc' },
      take: queryLimit,
      include: {
        team: { select: { sport: true } },
        proHomeTeam: { select: { league: true, primary_color: true } },
        proAwayTeam: { select: { league: true, primary_color: true } },
      },
    } as any),
  ]);
  const excludedPrivateTeamIds = await loadExcludedPrivateTeamIds(db, params.viewerId);
  const teamIsHidden = (teamId: string | null | undefined) =>
    !!teamId && excludedPrivateTeamIds.has(teamId);
  const visibleGames = games.filter(
    (game: any) => !teamIsHidden(game.home_team_id) && !teamIsHidden(game.away_team_id)
  );
  const visibleEvents = events.filter((event: any) => !teamIsHidden(event.team_id));

  const eventIds = [
    ...visibleGames.map((game: any) => game.events?.[0]?.id).filter(Boolean),
    ...visibleEvents.map((event: any) => event.id),
  ] as string[];
  const viewerState = await loadViewerState(db, params.viewerId, eventIds, now);

  const gameItems = visibleGames.map((game: any) => {
    const linkedEvent = game.events?.[0] ?? null;
    const coords = resolveCoords(game);
    const eventDate = linkedEvent?.date ?? game.date;
    const eventId = linkedEvent?.id ?? null;
    const capabilityEvent = {
      id: eventId,
      game_id: game.id,
      date: eventDate,
      exclusive_poster_id: linkedEvent?.exclusive_poster_id ?? null,
      live_window_hours_after_start: linkedEvent?.live_window_hours_after_start ?? null,
    };
    return {
      id: game.id,
      source_type: 'game',
      event_id: eventId,
      game_id: game.id,
      title: game.title,
      date: iso(eventDate),
      location: linkedEvent?.location ?? game.location ?? game.venue_address ?? null,
      latitude: coords.latitude,
      longitude: coords.longitude,
      sport: game.homeTeam?.sport ?? game.awayTeam?.sport ?? null,
      status: null,
      banner_url: game.banner_url ?? game.cover_image_url ?? linkedEvent?.banner_url ?? null,
      pro_home_color: linkedEvent?.proHomeTeam?.primary_color ?? null,
      pro_away_color: linkedEvent?.proAwayTeam?.primary_color ?? null,
      pro_league: linkedEvent?.proHomeTeam?.league ?? linkedEvent?.proAwayTeam?.league ?? null,
      venue_photo: venuePhotoFor(linkedEvent?.location ?? game.location),
      map_visibility: {
        visible: coords.latitude != null && coords.longitude != null,
        reason_code: coords.latitude != null && coords.longitude != null ? null : 'NO_COORDINATES',
        surface_window: { from: from.toISOString(), to: to.toISOString() },
      },
      feed_priority: feedPriority(eventDate, now),
      ...buildCapabilities(capabilityEvent, viewerState),
    };
  });

  const eventItems = visibleEvents.map((event: any) => {
    const coords = resolveCoords(event);
    return {
      id: event.id,
      source_type: 'event',
      event_id: event.id,
      game_id: null,
      title: event.title,
      date: iso(event.date),
      location: event.location,
      latitude: coords.latitude,
      longitude: coords.longitude,
      sport:
        event.team?.sport ??
        proLeagueToSport(event.proHomeTeam?.league ?? event.proAwayTeam?.league) ??
        null,
      status: event.status,
      banner_url: event.banner_url ?? null,
      pro_home_color: event.proHomeTeam?.primary_color ?? null,
      pro_away_color: event.proAwayTeam?.primary_color ?? null,
      pro_league: event.proHomeTeam?.league ?? event.proAwayTeam?.league ?? null,
      venue_photo: venuePhotoFor(event.location),
      map_visibility: {
        visible: coords.latitude != null && coords.longitude != null,
        reason_code: coords.latitude != null && coords.longitude != null ? null : 'NO_COORDINATES',
        surface_window: { from: from.toISOString(), to: to.toISOString() },
      },
      feed_priority: feedPriority(event.date, now),
      ...buildCapabilities(
        {
          id: event.id,
          game_id: null,
          date: event.date,
          exclusive_poster_id: event.exclusive_poster_id ?? null,
          live_window_hours_after_start: event.live_window_hours_after_start ?? null,
        },
        viewerState
      ),
    };
  });

  const merged = [...gameItems, ...eventItems].sort((a, b) => {
    if (a.feed_priority !== b.feed_priority) return a.feed_priority - b.feed_priority;
    const at = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER;
    const bt = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER;
    return at - bt;
  });

  return {
    items:
      surface === 'map'
        ? merged.filter(item => item.map_visibility.visible).slice(0, limit)
        : merged.slice(0, limit),
    meta: {
      surface,
      from: from.toISOString(),
      to: to.toISOString(),
      limit,
      sources: { games: games.length, events: events.length },
      filtered: {
        private_team_items:
          games.length + events.length - visibleGames.length - visibleEvents.length,
      },
    },
  };
}
