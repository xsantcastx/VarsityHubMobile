import { isGamePubliclyVisible } from './gameApproval.js';
import { viewerHasPostedOnEntity } from './geofencing.js';
import { isOrganizationOwner } from './organizationAuthorization.js';
import { prisma } from './prisma.js';
import * as privacy from './privacyUtils.js';
import { canManageAnyTeam } from './teamAuthorization.js';
import { isVerifiedAdminUser } from '../middleware/requireAdmin.js';

export const GAME_VISIBILITY_SELECT = {
  id: true,
  date: true,
  approval_status: true,
  opponent_approval_status: true,
  home_team_id: true,
  away_team_id: true,
  created_by_id: true,
} as const;
export const EVENT_VISIBILITY_SELECT = {
  id: true,
  approval_status: true,
  status: true,
  team_id: true,
  creator_id: true,
  game_id: true,
  game: { select: GAME_VISIBILITY_SELECT },
} as const;

export type GameVisibilityRecord = {
  id?: string | null;
  date?: Date | string | null;
  approval_status?: string | null;
  opponent_approval_status?: string | null;
  home_team_id?: string | null;
  away_team_id?: string | null;
  created_by_id?: string | null;
};
type EventVisibilityRecord = {
  id?: string | null;
  approval_status?: string | null;
  status?: string | null;
  creator_id?: string | null;
  team_id?: string | null;
  game_id?: string | null;
  game?: GameVisibilityRecord | null;
};

async function teamsVisible(ids: Array<string | null | undefined>, viewerId: string | null) {
  for (const id of new Set(ids.filter((id): id is string => Boolean(id)))) {
    if (await privacy.isTeamHiddenFromViewer(id, viewerId)) return false;
  }
  return true;
}

async function privilegedViewer(viewerId: string, ids: Array<string | null | undefined>) {
  if (await isVerifiedAdminUser(viewerId)) return true;
  if (await canManageAnyTeam(viewerId, ids)) return true;
  const teamIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!teamIds.length) return false;
  const teams = await prisma.team.findMany({
    where: { id: { in: teamIds } },
    select: { organization_id: true },
    take: teamIds.length,
  });
  for (const id of new Set(teams.map(team => team.organization_id))) {
    if (await isOrganizationOwner(viewerId, id)) return true;
  }
  return false;
}

/** Public approval never bypasses team privacy. These exceptions grant reads only. */
export async function canViewGameRecord(
  record: GameVisibilityRecord,
  viewerId: string | null = null
): Promise<boolean> {
  const ids = [record.home_team_id, record.away_team_id];
  if (isGamePubliclyVisible(record) && (await teamsVisible(ids, viewerId))) return true;
  if (!viewerId) return false;
  if (record.created_by_id === viewerId || (await privilegedViewer(viewerId, ids))) return true;
  return Boolean(
    record.id && (await viewerHasPostedOnEntity({ userId: viewerId, gameId: record.id }))
  );
}

export async function canViewEventRecord(
  record: EventVisibilityRecord,
  viewerId: string | null = null
): Promise<boolean> {
  const ids = [record.team_id, record.game?.home_team_id, record.game?.away_team_id];
  if (
    record.approval_status === 'approved' &&
    (!record.game || isGamePubliclyVisible(record.game)) &&
    (await teamsVisible(ids, viewerId))
  )
    return true;
  if (!viewerId) return false;
  if (record.creator_id === viewerId || (await privilegedViewer(viewerId, ids))) return true;
  return Boolean(
    record.id &&
    (await viewerHasPostedOnEntity({
      userId: viewerId,
      eventId: record.id,
      gameId: record.game_id ?? record.game?.id ?? null,
    }))
  );
}
