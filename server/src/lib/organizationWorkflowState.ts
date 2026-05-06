import { prisma } from './prisma.js';

type DbClientLike = {
  $queryRaw: typeof prisma.$queryRaw;
};

export type OrganizationJoinRequestStateRow = {
  id: string;
  organization_id: string;
  user_id: string;
  status: string | null;
  message: string | null;
  rejection_reason: string | null;
  created_at: Date;
  reviewed_at: Date | null;
  reviewed_by: string | null;
};

type OrganizationJoinRequestWithUserRow = OrganizationJoinRequestStateRow & {
  user_display_name: string | null;
  user_username: string | null;
  user_avatar_url: string | null;
  user_email: string | null;
};

type OrganizationJoinRequestWithOrganizationRow = OrganizationJoinRequestStateRow & {
  organization_name: string | null;
  organization_description: string | null;
  organization_sport: string | null;
  organization_location: string | null;
};

export type OrganizationInviteStateRow = {
  id: string;
  organization_id: string;
  email: string;
  role: string | null;
  status: string | null;
  created_at: Date;
};

type OrganizationInviteWithOrganizationRow = OrganizationInviteStateRow & {
  organization_name: string | null;
  organization_description: string | null;
  organization_logo_url: string | null;
  organization_profile_picture_url: string | null;
  organization_background_url: string | null;
  organization_sport: string | null;
  organization_org_type: string | null;
  organization_location: string | null;
  organization_zip_code: string | null;
  organization_season_start: Date | null;
  organization_season_end: Date | null;
  organization_created_at: Date;
  organization_admin_approved: boolean;
  organization_contact_info: string | null;
};

export async function getOrganizationJoinRequestState(
  requestId: string | null | undefined,
  db: DbClientLike = prisma,
): Promise<OrganizationJoinRequestStateRow | null> {
  if (!requestId) return null;

  const rows = await db.$queryRaw<OrganizationJoinRequestStateRow[]>`
    SELECT
      id,
      organization_id,
      user_id,
      status::text AS status,
      message,
      rejection_reason,
      created_at,
      reviewed_at,
      reviewed_by
    FROM "OrganizationJoinRequest"
    WHERE id = ${requestId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function getOrganizationJoinRequestStateForUser(
  organizationId: string | null | undefined,
  userId: string | null | undefined,
  db: DbClientLike = prisma,
): Promise<OrganizationJoinRequestStateRow | null> {
  if (!organizationId || !userId) return null;

  const rows = await db.$queryRaw<OrganizationJoinRequestStateRow[]>`
    SELECT
      id,
      organization_id,
      user_id,
      status::text AS status,
      message,
      rejection_reason,
      created_at,
      reviewed_at,
      reviewed_by
    FROM "OrganizationJoinRequest"
    WHERE organization_id = ${organizationId}
      AND user_id = ${userId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function listOrganizationJoinRequestsForOrganization(
  organizationId: string,
  status?: string | null,
  db: DbClientLike = prisma,
) {
  const normalizedStatus =
    !status || status === 'all' ? null : status === 'rejected' ? 'denied' : status;

  const rows = normalizedStatus
    ? await db.$queryRaw<OrganizationJoinRequestWithUserRow[]>`
        SELECT
          jr.id,
          jr.organization_id,
          jr.user_id,
          jr.status::text AS status,
          jr.message,
          jr.rejection_reason,
          jr.created_at,
          jr.reviewed_at,
          jr.reviewed_by,
          u.display_name AS user_display_name,
          u.username AS user_username,
          u.avatar_url AS user_avatar_url,
          u.email AS user_email
        FROM "OrganizationJoinRequest" jr
        JOIN "User" u ON u.id = jr.user_id
        WHERE jr.organization_id = ${organizationId}
          AND jr.status = ${normalizedStatus}
        ORDER BY jr.created_at DESC
        LIMIT 200
      `
    : await db.$queryRaw<OrganizationJoinRequestWithUserRow[]>`
        SELECT
          jr.id,
          jr.organization_id,
          jr.user_id,
          jr.status::text AS status,
          jr.message,
          jr.rejection_reason,
          jr.created_at,
          jr.reviewed_at,
          jr.reviewed_by,
          u.display_name AS user_display_name,
          u.username AS user_username,
          u.avatar_url AS user_avatar_url,
          u.email AS user_email
        FROM "OrganizationJoinRequest" jr
        JOIN "User" u ON u.id = jr.user_id
        WHERE jr.organization_id = ${organizationId}
        ORDER BY jr.created_at DESC
        LIMIT 200
      `;

  return rows.map((row) => ({
    id: row.id,
    organization_id: row.organization_id,
    user_id: row.user_id,
    status: row.status,
    message: row.message,
    rejection_reason: row.rejection_reason,
    created_at: row.created_at,
    reviewed_at: row.reviewed_at,
    reviewed_by: row.reviewed_by,
    user: {
      id: row.user_id,
      display_name: row.user_display_name,
      username: row.user_username,
      avatar_url: row.user_avatar_url,
      email: row.user_email,
    },
  }));
}

export async function listOrganizationJoinRequestsForUser(
  userId: string,
  db: DbClientLike = prisma,
) {
  const rows = await db.$queryRaw<OrganizationJoinRequestWithOrganizationRow[]>`
    SELECT
      jr.id,
      jr.organization_id,
      jr.user_id,
      jr.status::text AS status,
      jr.message,
      jr.rejection_reason,
      jr.created_at,
      jr.reviewed_at,
      jr.reviewed_by,
      o.name AS organization_name,
      o.description AS organization_description,
      o.sport AS organization_sport,
      o.location AS organization_location
    FROM "OrganizationJoinRequest" jr
    JOIN "Organization" o ON o.id = jr.organization_id
    WHERE jr.user_id = ${userId}
    ORDER BY jr.created_at DESC
    LIMIT 100
  `;

  return rows.map((row) => ({
    id: row.id,
    organization_id: row.organization_id,
    user_id: row.user_id,
    status: row.status,
    message: row.message,
    rejection_reason: row.rejection_reason,
    created_at: row.created_at,
    reviewed_at: row.reviewed_at,
    reviewed_by: row.reviewed_by,
    organization: {
      id: row.organization_id,
      name: row.organization_name,
      description: row.organization_description,
      sport: row.organization_sport,
      location: row.organization_location,
    },
  }));
}

export async function getOrganizationInviteState(
  inviteId: string | null | undefined,
  db: DbClientLike = prisma,
): Promise<OrganizationInviteStateRow | null> {
  if (!inviteId) return null;

  const rows = await db.$queryRaw<OrganizationInviteStateRow[]>`
    SELECT
      id,
      organization_id,
      email,
      role::text AS role,
      status::text AS status,
      created_at
    FROM "OrganizationInvite"
    WHERE id = ${inviteId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function listOrganizationInvitesForEmail(
  email: string | null | undefined,
  db: DbClientLike = prisma,
) {
  if (!email) return [];

  const rows = await db.$queryRaw<OrganizationInviteWithOrganizationRow[]>`
    SELECT
      i.id,
      i.organization_id,
      i.email,
      i.role::text AS role,
      i.status::text AS status,
      i.created_at,
      o.name AS organization_name,
      o.description AS organization_description,
      o.logo_url AS organization_logo_url,
      o.profile_picture_url AS organization_profile_picture_url,
      o.background_url AS organization_background_url,
      o.sport AS organization_sport,
      o.org_type AS organization_org_type,
      o.location AS organization_location,
      o.zip_code AS organization_zip_code,
      o.season_start AS organization_season_start,
      o.season_end AS organization_season_end,
      o.created_at AS organization_created_at,
      o.admin_approved AS organization_admin_approved,
      o.contact_info AS organization_contact_info
    FROM "OrganizationInvite" i
    JOIN "Organization" o ON o.id = i.organization_id
    WHERE LOWER(i.email) = LOWER(${email})
      AND i.status = 'pending'
    ORDER BY i.created_at DESC
    LIMIT 100
  `;

  return rows.map((row) => ({
    id: row.id,
    organization_id: row.organization_id,
    email: row.email,
    role: row.role,
    status: row.status,
    created_at: row.created_at,
    organization: {
      id: row.organization_id,
      name: row.organization_name,
      description: row.organization_description,
      logo_url: row.organization_logo_url,
      profile_picture_url: row.organization_profile_picture_url,
      background_url: row.organization_background_url,
      sport: row.organization_sport,
      org_type: row.organization_org_type,
      location: row.organization_location,
      zip_code: row.organization_zip_code,
      season_start: row.organization_season_start,
      season_end: row.organization_season_end,
      created_at: row.organization_created_at,
      admin_approved: row.organization_admin_approved,
      contact_info: row.organization_contact_info,
    },
  }));
}
