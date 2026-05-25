/**
 * Canonical Team response shape for API endpoints.
 *
 * Background: prior to this helper, each team-returning endpoint
 * (GET /teams, GET /teams/:id, GET /teams/managed, etc.) hand-rolled
 * its own response shape. Fields drifted across endpoints — list included
 * `city`/`state`/`venue_*`; detail included `organization`/`season_*`;
 * managed included `my_role` — so navigating between screens silently
 * lost or gained fields. Client code had to reconcile multiple shapes.
 *
 * This helper fixes that by centralizing the Team → wire shape in one
 * function, modeled on `serializeEvent`. Every endpoint that returns a
 * team must use it, and the baseline fields are ALWAYS present so
 * clients can rely on a stable contract.
 *
 * Optional blocks (counts, viewer state, organization embed) are
 * gated behind explicit opts flags. A caller that doesn't fetch the
 * Prisma relation data for a block should not request it — the
 * serializer is strict about this: if you pass `includeOrganization:
 * true` and `team.organization` is undefined, you get `organization: null`
 * in the response, which tells the client the endpoint doesn't carry
 * org data rather than silently succeeding.
 */

import { MembershipStatus } from '@prisma/client';

export interface SerializeTeamOptions {
  /**
   * Include the organization embed. Requires Prisma
   * `include: { organization: { select: {...} } }` on the query.
   */
  includeOrganization?: boolean;

  /**
   * Include `members` and `followers_count` (only surfaces the
   * relations that were actually fetched). Requires Prisma
   * `include: { _count: { select: { memberships: true, followers: true } } }`.
   * If only `memberships` was included, `followers_count` is omitted.
   */
  includeCounts?: boolean;

  /**
   * Include `my_role` and `is_following`. Caller must pre-resolve
   * these (usually from a separate membership/follow lookup) and pass
   * them via `viewerRole` / `isFollowing`.
   */
  includeViewerState?: boolean;

  /** Viewer's team role (pre-resolved). null when not a member. */
  viewerRole?: string | null;

  /** Whether the viewer follows this team (pre-resolved). */
  isFollowing?: boolean | null;

  /** Whether the viewer can manage the team. */
  canManageTeam?: boolean;

  /** Whether the viewer is an org admin for the team's org. */
  isOrgAdmin?: boolean;

  /** The viewer's pending join request status, if any. null = no request. */
  viewerJoinRequestStatus?: string | null;
}

export const TEAM_SERIALIZE_SAFE_SELECT = {
  id: true,
  name: true,
  description: true,
  sport: true,
  club_type: true,
  extracurricular_category: true,
  season: true,
  season_start: true,
  season_end: true,
  logo_url: true,
  avatar_url: true,
  primary_color: true,
  is_private: true,
  city: true,
  state: true,
  league: true,
  venue_place_id: true,
  venue_lat: true,
  venue_lng: true,
  venue_address: true,
  organization_id: true,
  created_at: true,
} as const;

type BuildTeamSerializeSelectOptions = {
  includeCounts?: boolean;
  includeOrganization?: boolean;
  includeMembershipsForUserId?: string | null;
};

export function buildTeamSerializeSelect(opts: BuildTeamSerializeSelectOptions = {}) {
  return {
    ...TEAM_SERIALIZE_SAFE_SELECT,
    ...(opts.includeCounts ? { _count: { select: { memberships: true, followers: true } } } : {}),
    ...(opts.includeOrganization
      ? {
          organization: {
            select: {
              id: true,
              name: true,
              description: true,
              sport: true,
            },
          },
        }
      : {}),
    ...(opts.includeMembershipsForUserId
      ? {
          memberships: {
            where: { user_id: opts.includeMembershipsForUserId, status: MembershipStatus.active },
            select: { role: true },
          },
        }
      : {}),
  };
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function serializeTeam(team: any, opts: SerializeTeamOptions = {}) {
  if (!team) return null;

  const base: Record<string, unknown> = {
    // Identity + display
    id: team.id,
    name: team.name,
    description: team.description ?? null,
    status: team.status,

    // Classification
    sport: team.sport ?? null,
    club_type: team.club_type ?? 'sport',
    extracurricular_category: team.extracurricular_category ?? null,
    season: team.season ?? null,
    season_start: toIso(team.season_start),
    season_end: toIso(team.season_end),

    // Branding / media
    logo_url: team.logo_url || null,
    avatar_url: team.avatar_url || null,
    primary_color: team.primary_color ?? null,

    // Privacy
    is_private: team.is_private ?? false,

    // Location / directory metadata
    city: team.city ?? null,
    state: team.state ?? null,
    league: team.league ?? null,

    // Venue for home games
    venue_place_id: team.venue_place_id ?? null,
    venue_lat: team.venue_lat ?? null,
    venue_lng: team.venue_lng ?? null,
    venue_address: team.venue_address ?? null,

    // Org FK (the full org embed is opt-in)
    organization_id: team.organization_id ?? null,

    // Lifecycle
    created_at: toIso(team.created_at),
  };

  if (opts.includeCounts) {
    if (team._count?.memberships !== undefined) {
      base.members = team._count.memberships;
    }
    if (team._count?.followers !== undefined) {
      base.followers_count = team._count.followers;
    }
  }

  if (opts.includeOrganization) {
    base.organization = team.organization
      ? {
          id: team.organization.id,
          name: team.organization.name,
          description: team.organization.description ?? null,
          sport: team.organization.sport ?? null,
        }
      : null;
  }

  if (opts.includeViewerState) {
    base.viewer_role = opts.viewerRole ?? null;
    base.my_role = opts.viewerRole ?? null;
    base.is_following = opts.isFollowing ?? null;
    base.can_manage_team = opts.canManageTeam === true;
    base.is_org_admin = opts.isOrgAdmin === true;
    base.viewer_join_request_status = opts.viewerJoinRequestStatus ?? null;
  }

  return base;
}

/** Test-only: the set of fields the baseline always includes. */
export const SERIALIZE_TEAM_BASELINE_FIELDS = [
  'id',
  'name',
  'description',
  'status',
  'sport',
  'club_type',
  'extracurricular_category',
  'season',
  'season_start',
  'season_end',
  'logo_url',
  'avatar_url',
  'primary_color',
  'is_private',
  'city',
  'state',
  'league',
  'venue_place_id',
  'venue_lat',
  'venue_lng',
  'venue_address',
  'organization_id',
  'created_at',
] as const;
