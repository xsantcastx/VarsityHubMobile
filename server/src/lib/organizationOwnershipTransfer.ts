import { prisma } from './prisma.js';
import { isOrgOwner } from './teamAuthorization.js';

/**
 * Accept-based org ownership transfer (owner rule 2026-07-16).
 *
 * The current owner INITIATES a pending transfer; the recipient must ACCEPT
 * before ownership actually moves. Until acceptance the initiator stays owner
 * — so the sole-owner account-deletion guard keeps blocking them. Mirrors the
 * OrganizationInvite -> accept pattern. At most one pending transfer per org
 * (a new initiate cancels any prior pending row, inside a transaction).
 */

type Fail = { error: string; code: string };

export async function getPendingTransfer(orgId: string) {
  return prisma.organizationOwnershipTransfer.findFirst({
    where: { organization_id: orgId, status: 'pending' },
    select: { id: true, from_user_id: true, to_user_id: true },
    orderBy: { created_at: 'desc' },
  });
}

export async function initiateOwnershipTransfer(
  orgId: string,
  fromUserId: string,
  toUserId: string
): Promise<{ id: string } | Fail> {
  if (!(await isOrgOwner(fromUserId, orgId)))
    return { error: 'Only the current owner can transfer ownership', code: 'NOT_OWNER' };
  if (toUserId === fromUserId)
    return { error: 'Cannot transfer ownership to yourself', code: 'SELF_TRANSFER' };

  const targetMembership = await prisma.organizationMembership.findFirst({
    where: { organization_id: orgId, user_id: toUserId, status: 'active' },
    select: { id: true },
  });
  if (!targetMembership)
    return {
      error: 'New owner must be an active member of the organization',
      code: 'NOT_A_MEMBER',
    };

  return prisma.$transaction(async tx => {
    // One pending transfer per org: cancel any prior pending before creating.
    await tx.organizationOwnershipTransfer.updateMany({
      where: { organization_id: orgId, status: 'pending' },
      data: { status: 'cancelled', responded_at: new Date() },
    });
    const row = await tx.organizationOwnershipTransfer.create({
      data: { organization_id: orgId, from_user_id: fromUserId, to_user_id: toUserId },
      select: { id: true },
    });
    return { id: row.id };
  });
}

export async function acceptOwnershipTransfer(
  orgId: string,
  actingUserId: string
): Promise<{ ok: true; fromUserId: string } | Fail> {
  const pending = await prisma.organizationOwnershipTransfer.findFirst({
    where: { organization_id: orgId, status: 'pending', to_user_id: actingUserId },
    select: { id: true, from_user_id: true },
  });
  if (!pending)
    return { error: 'No pending transfer for you on this organization', code: 'NO_PENDING_TRANSFER' };

  // Recipient must still be an active member at accept time.
  const stillMember = await prisma.organizationMembership.findFirst({
    where: { organization_id: orgId, user_id: actingUserId, status: 'active' },
    select: { id: true },
  });
  if (!stillMember)
    return { error: 'You are no longer a member of this organization', code: 'NOT_A_MEMBER' };

  const currentOwner = await prisma.organizationMembership.findFirst({
    where: {
      organization_id: orgId,
      user_id: pending.from_user_id,
      role: 'owner',
      status: 'active',
    },
    select: { id: true },
  });

  try {
    await prisma.$transaction(async tx => {
      // Claim the pending row first — a concurrent accept/cancel loses the race.
      const claimed = await tx.organizationOwnershipTransfer.updateMany({
        where: { id: pending.id, status: 'pending' },
        data: { status: 'accepted', responded_at: new Date() },
      });
      if (claimed.count === 0) throw new Error('TRANSFER_ALREADY_PROCESSED');

      // Move the canonical owner pointer AND the membership roles together
      // (mirrors the pre-existing atomic transfer so no old-owner authority
      // leaks through billing / owner-only screens).
      await tx.organization.update({
        where: { id: orgId },
        data: { league_owner_id: actingUserId },
        select: { id: true },
      });
      if (currentOwner) {
        await tx.organizationMembership.update({
          where: { id: currentOwner.id },
          data: { role: 'manager' },
          select: { id: true },
        });
      }
      await tx.organizationMembership.update({
        where: { id: stillMember.id },
        data: { role: 'owner' },
        select: { id: true },
      });
    });
  } catch (err) {
    if ((err as Error)?.message === 'TRANSFER_ALREADY_PROCESSED')
      return { error: 'Transfer already processed', code: 'TRANSFER_ALREADY_PROCESSED' };
    throw err;
  }

  return { ok: true, fromUserId: pending.from_user_id };
}

export async function respondCancelOrDecline(
  orgId: string,
  actingUserId: string,
  action: 'decline' | 'cancel'
): Promise<{ ok: true; toUserId: string; fromUserId: string } | Fail> {
  const pending = await prisma.organizationOwnershipTransfer.findFirst({
    where: { organization_id: orgId, status: 'pending' },
    select: { id: true, from_user_id: true, to_user_id: true },
    orderBy: { created_at: 'desc' },
  });
  if (!pending) return { error: 'No pending transfer', code: 'NO_PENDING_TRANSFER' };

  const allowed =
    action === 'cancel'
      ? pending.from_user_id === actingUserId
      : pending.to_user_id === actingUserId;
  if (!allowed) return { error: 'Not allowed to respond to this transfer', code: 'FORBIDDEN' };

  await prisma.organizationOwnershipTransfer.update({
    where: { id: pending.id },
    data: { status: action === 'cancel' ? 'cancelled' : 'declined', responded_at: new Date() },
  });
  return { ok: true, toUserId: pending.to_user_id, fromUserId: pending.from_user_id };
}
