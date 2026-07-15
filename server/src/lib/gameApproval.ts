import { canManageTeam } from './teamAuthorization.js';

/**
 * The team ids on the CREATOR'S side of a game — i.e. NOT the opponent whose
 * staff must approve it. Destructive/core edits (delete, score) are restricted
 * to this set so the OPPOSING team's staff can't unilaterally delete a shared
 * game or overwrite the other team's reported score; the opponent uses the
 * decline / opponent-approval flow instead. When there's no distinct opponent
 * (intra-org or free-text), both referenced teams are on the creator side.
 */
export function creatorSideTeamIds(
  homeTeamId: string | null | undefined,
  awayTeamId: string | null | undefined,
  opponentApprovalTeamId: string | null | undefined
): string[] {
  const both = [homeTeamId, awayTeamId].filter((t): t is string => Boolean(t));
  if (!opponentApprovalTeamId) return both;
  return both.filter(t => t !== opponentApprovalTeamId);
}

export interface GameApprovalDecision {
  /** Did the caller act as a coach/admin for this game (auto-approve)? */
  isCoach: boolean;
  /** The specific team the caller manages for this game, if any. */
  managedTeamId: string | null;
  /** Final moderation state for the game row. */
  approvalStatus: 'approved' | 'pending';
  /** Whether the opposing team's staff must still consent. */
  opponentApprovalStatus: 'not_required' | 'pending';
  /** The team whose staff must consent, if any. */
  opponentApprovalTeamId: string | null;
}

type CanManage = (userId: string, teamId: string) => Promise<boolean>;

/**
 * Single source of truth for a game's approval_status + opponent-approval
 * fields. Every game-write path (POST /games, POST /games/bulk, PUT /games/:id)
 * MUST call this — see game-write-approval-parity.test.ts. Do not re-derive the
 * decision inline; that is the exact drift the 2026-07-14 audit closed.
 *
 * `canManage` is injectable for testing; defaults to the real authorization
 * helper. The logic mirrors the original inline POST /games decision.
 */
export async function deriveGameApproval(
  userId: string,
  homeTeamId: string | null | undefined,
  awayTeamId: string | null | undefined,
  isAdmin: boolean,
  canManage: CanManage = canManageTeam as CanManage
): Promise<GameApprovalDecision> {
  const home = homeTeamId || null;
  const away = awayTeamId || null;

  if (isAdmin) {
    // Admin can create for any team; no distinct opponent to consult.
    return {
      isCoach: true,
      managedTeamId: home || away || null,
      approvalStatus: 'approved',
      opponentApprovalStatus: 'not_required',
      opponentApprovalTeamId: null,
    };
  }

  const [canManageHome, canManageAway] = await Promise.all([
    home ? canManage(userId, home) : Promise.resolve(false),
    away && away !== home ? canManage(userId, away) : Promise.resolve(false),
  ]);

  const managedTeamId = canManageHome ? home : canManageAway ? away : null;
  const isCoach = !!managedTeamId;

  // Opponent-approval: only when the caller manages exactly one side and the
  // other side is a REAL team they do not manage.
  let opponentApprovalTeamId: string | null = null;
  if (isCoach) {
    const otherTeamId = managedTeamId === home ? away : managedTeamId === away ? home : null;
    if (otherTeamId && otherTeamId !== managedTeamId) {
      const opponentManaged = await canManage(userId, otherTeamId);
      if (!opponentManaged) {
        opponentApprovalTeamId = otherTeamId;
      }
    }
  }

  return {
    isCoach,
    managedTeamId,
    approvalStatus: isCoach ? 'approved' : 'pending',
    opponentApprovalStatus: opponentApprovalTeamId ? 'pending' : 'not_required',
    opponentApprovalTeamId,
  };
}
