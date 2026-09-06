import type { Prisma } from '@prisma/client';
import type { GameApprovalDecision } from './gameApproval.js';

/** Shared creation gate: bulk and single writes must check the same organization. */
export async function assertGameCreationOrganizationApproved(
  db: Pick<Prisma.TransactionClient, 'team' | 'organization'>,
  decisions: GameApprovalDecision[],
  isAdmin: boolean
) {
  if (isAdmin) return;
  const ids = [...new Set(decisions.filter(d => d.isCoach).map(d => d.managedTeamId))];
  for (const id of ids) {
    if (!id) continue;
    const team = await db.team.findUnique({ where: { id }, select: { organization_id: true } });
    if (!team?.organization_id) continue;
    const org = await db.organization.findUnique({
      where: { id: team.organization_id },
      select: { admin_approved: true },
    });
    if (!org?.admin_approved) {
      throw Object.assign(new Error('Your organization must be approved before creating games.'), {
        code: 'ORG_NOT_APPROVED',
        statusCode: 403,
      });
    }
  }
}

/** Moderation pending is represented by a draft lifecycle, never EventStatus.pending. */
export function gameEventStatus(approval: string | null | undefined): 'approved' | 'draft' {
  return approval === 'approved' ? 'approved' : 'draft';
}

/** Run with the inserts in a SERIALIZABLE transaction, for single and bulk creation. */
export async function assertPendingGameCapacity(
  db: Pick<Prisma.TransactionClient, 'game'>,
  userId: string,
  decisions: GameApprovalDecision[]
) {
  const added = decisions.filter(d => d.approvalStatus === 'pending').length;
  if (!added) return;
  const current = await db.game.count({
    where: { created_by_id: userId, approval_status: 'pending' },
  });
  if (current + added > 3)
    throw Object.assign(
      new Error(
        "You've reached your limit of 3 pending events. Wait for one to be approved or rejected before submitting another."
      ),
      { code: 'EVENT_LIMIT_EXCEEDED', statusCode: 403 }
    );
}
