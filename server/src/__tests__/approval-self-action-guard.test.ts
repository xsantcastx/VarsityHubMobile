import { describe, expect, it } from '@jest/globals';
import { approveAd, rejectAd } from '../lib/approvalService.js';

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
