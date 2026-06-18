import { describe, expect, it } from '@jest/globals';
import {
  approveAd,
  rejectAd,
  approveOrganization,
  approveCoach,
  approveEvent,
} from '../lib/approvalService.js';

// IDOR guard: an admin must not approve/reject an ad they personally own.
// Uses a stub prisma — the guard must fire before any write occurs.
const stubPrisma = (ad: Record<string, unknown>) =>
  ({
    ad: {
      findUnique: async () => ad,
    },
    $transaction: async () => {
      throw new Error('guard must reject before any transaction runs');
    },
  }) as any;

describe('approval self-action guard (ads)', () => {
  const ownAd = { id: 'ad1', user_id: 'admin-1', status: 'pending' };

  it('blocks an admin from approving their own ad', async () => {
    const result = await approveAd('ad1', 'admin-1', stubPrisma(ownAd));
    expect(result.error).toBeTruthy();
    expect(result.status).toBe(403);
  });

  it('blocks an admin from rejecting their own ad', async () => {
    const result = await rejectAd('ad1', 'admin-1', stubPrisma(ownAd));
    expect(result.error).toBeTruthy();
    expect(result.status).toBe(403);
  });

  it('does not block a different admin', async () => {
    // Different admin: guard passes; stub then throws at the transaction,
    // proving the guard was the only thing standing between them.
    await expect(rejectAd('ad1', 'admin-2', stubPrisma(ownAd))).rejects.toThrow(
      'guard must reject before any transaction runs'
    );
  });
});

// A prisma stub whose only write paths throw — proves the self-approval guard
// fires before any state change.
const guardOnlyPrisma = (model: string, row: Record<string, unknown>) =>
  ({
    [model]: {
      findUnique: async () => row,
      updateMany: async () => {
        throw new Error('guard must reject before any write runs');
      },
    },
    $transaction: async () => {
      throw new Error('guard must reject before any write runs');
    },
  }) as any;

describe('approval self-action guard (organization)', () => {
  it('blocks an admin from approving their own organization', async () => {
    const ownOrg = {
      id: 'org1',
      name: 'My League',
      status: 'pending',
      admin_approved: false,
      league_owner_id: 'admin-1',
      leagueOwner: { id: 'admin-1' },
    };
    const result: any = await approveOrganization('org1', 'admin-1', guardOnlyPrisma('organization', ownOrg));
    expect(result.error).toBeTruthy();
    expect(result.status).toBe(403);
  });
});

describe('approval self-action guard (coach)', () => {
  it('blocks an admin from approving their own coach application', async () => {
    const ownUser = { id: 'user-1', email: 'c@x.com', approval_status: 'PENDING', preferences: {} };
    const result: any = await approveCoach('user-1', 'user-1', guardOnlyPrisma('user', ownUser));
    expect(result.error).toBeTruthy();
    expect(result.status).toBe(403);
  });
});

describe('approval self-action guard (event)', () => {
  it('blocks an admin from approving their own event', async () => {
    const ownEvent = { id: 'ev1', approval_status: 'pending', creator_id: 'admin-1' };
    const result: any = await approveEvent('ev1', 'admin-1', guardOnlyPrisma('event', ownEvent));
    expect(result.error).toBeTruthy();
    expect(result.status).toBe(403);
  });
});
