/**
 * Canonical Organization response shape for API endpoints.
 *
 * Background: organization-returning endpoints hand-rolled different
 * shapes. List endpoints omitted fields detail screens expect
 * (`avatar_url`, `formatted_address`, `org_type`), while detail added
 * viewer/count/team data not surfaced elsewhere. This helper
 * centralizes the Organization -> wire shape so callers get one stable
 * baseline and explicitly opt into heavier blocks.
 */

export interface SerializeOrganizationOptions {
  /**
   * Include counts when Prisma `_count` was selected.
   * Surfaces both the nested `_count` object used by some screens and
   * the top-level `members_count` / `followers_count` aliases used by
   * detail views.
   */
  includeCounts?: boolean;

  /**
   * Include the teams embed. Requires Prisma
   * `include: { teams: { ... } }` on the query.
   */
  includeTeams?: boolean;

  /**
   * Include viewer-dependent fields pre-resolved by the caller.
   */
  includeViewerState?: boolean;

  /** Whether the current viewer follows this organization. */
  isFollowing?: boolean | null;

  /** Viewer's org role (pre-resolved). */
  viewerRole?: string | null;

  /** Whether the viewer is an active member of the org. */
  isMember?: boolean;

  /** Whether the viewer owns the org. */
  isOwner?: boolean;

  /** Whether the viewer can edit the org. */
  canEdit?: boolean;

  /** Whether the viewer can access org-admin management surfaces. */
  canManage?: boolean;

  /** Whether the viewer can review coach requests for this org. */
  canReviewCoaches?: boolean;
}

// `Organization.status` is still used as a write/filter field in some legacy
// flows, but returning it from Prisma-backed organization payloads is unsafe in
// the current database shape. Keep organization API responses on an explicit
// projection so routes don't accidentally decode the legacy column.
export const ORGANIZATION_SERIALIZE_SAFE_SELECT = {
  id: true,
  name: true,
  description: true,
  logo_url: true,
  profile_picture_url: true,
  background_url: true,
  sport: true,
  org_type: true,
  location: true,
  zip_code: true,
  season_start: true,
  season_end: true,
  created_at: true,
  admin_approved: true,
  contact_info: true,
} as const;

type BuildOrganizationSerializeSelectOptions = {
  includeCounts?: boolean;
  includeFollowersCount?: boolean;
  includeTeams?: boolean;
};

export function buildOrganizationSerializeSelect(
  opts: BuildOrganizationSerializeSelectOptions = {}
) {
  const countSelect: Record<string, true> = {};
  if (opts.includeCounts) {
    countSelect.memberships = true;
    countSelect.teams = true;
    if (opts.includeFollowersCount) countSelect.followers = true;
  }

  return {
    ...ORGANIZATION_SERIALIZE_SAFE_SELECT,
    ...(opts.includeCounts ? { _count: { select: countSelect } } : {}),
    ...(opts.includeTeams
      ? {
          teams: {
            orderBy: { name: 'asc' as const },
            select: {
              id: true,
              name: true,
              description: true,
              sport: true,
              season_start: true,
              season_end: true,
              status: true,
              logo_url: true,
              avatar_url: true,
              created_at: true,
              _count: {
                select: {
                  memberships: true,
                },
              },
            },
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

function serializeOrganizationTeam(team: any) {
  if (!team) return null;

  const payload: Record<string, unknown> = {
    id: team.id,
    name: team.name,
    description: team.description ?? null,
    sport: team.sport ?? null,
    season_start: toIso(team.season_start),
    season_end: toIso(team.season_end),
    status: team.status ?? null,
    logo_url: team.logo_url || null,
    avatar_url: team.avatar_url || null,
    created_at: toIso(team.created_at),
  };

  if (team._count?.memberships !== undefined) {
    payload._count = { memberships: team._count.memberships };
  }

  return payload;
}

export function serializeOrganization(organization: any, opts: SerializeOrganizationOptions = {}) {
  if (!organization) return null;

  const base: Record<string, unknown> = {
    id: organization.id,
    name: organization.name,
    description: organization.description ?? null,
    logo_url: organization.logo_url || null,
    profile_picture_url: organization.profile_picture_url || null,
    // Client screens still read avatar_url; alias it here so detail/list
    // stay in sync with the persisted profile_picture_url column.
    avatar_url: organization.profile_picture_url || organization.logo_url || null,
    background_url: organization.background_url || null,
    sport: organization.sport ?? null,
    org_type: organization.org_type ?? null,
    location: organization.location ?? null,
    // Some screens use formatted_address; the model stores only location.
    formatted_address: organization.location ?? null,
    zip_code: organization.zip_code ?? null,
    season_start: toIso(organization.season_start),
    season_end: toIso(organization.season_end),
    status: organization.status ?? null,
    created_at: toIso(organization.created_at),
    admin_approved: organization.admin_approved ?? false,
    contact_info: organization.contact_info ?? null,
  };

  if (opts.includeCounts) {
    const countPayload: Record<string, number> = {};
    if (organization._count?.teams !== undefined) {
      countPayload.teams = organization._count.teams;
      base.teams_count = organization._count.teams;
    }
    if (organization._count?.memberships !== undefined) {
      countPayload.memberships = organization._count.memberships;
      base.members_count = organization._count.memberships;
    }
    if (organization._count?.followers !== undefined) {
      countPayload.followers = organization._count.followers;
      base.followers_count = organization._count.followers;
    }
    if (Object.keys(countPayload).length > 0) {
      base._count = countPayload;
    }
  }

  if (opts.includeTeams) {
    base.teams = Array.isArray(organization.teams)
      ? organization.teams.map(serializeOrganizationTeam)
      : null;
  }

  if (opts.includeViewerState) {
    base.is_following = opts.isFollowing ?? null;
    base.viewer_role = opts.viewerRole ?? null;
    base.is_member = opts.isMember === true;
    base.is_owner = opts.isOwner === true;
    base.can_edit = opts.canEdit === true;
    base.can_manage = opts.canManage === true;
    base.can_review_coaches = opts.canReviewCoaches === true;
  }

  return base;
}

export const SERIALIZE_ORGANIZATION_BASELINE_FIELDS = [
  'id',
  'name',
  'description',
  'logo_url',
  'profile_picture_url',
  'avatar_url',
  'background_url',
  'sport',
  'org_type',
  'location',
  'formatted_address',
  'zip_code',
  'season_start',
  'season_end',
  'status',
  'created_at',
  'admin_approved',
  'contact_info',
] as const;
