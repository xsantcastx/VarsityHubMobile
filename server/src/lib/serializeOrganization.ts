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
