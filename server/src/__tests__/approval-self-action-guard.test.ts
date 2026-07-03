import { describe, expect, it } from '@jest/globals';
import { approveAd, approveEvent, rejectAd, rejectEvent } from '../lib/approvalService.js';

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

// Same IDOR guard for events: a reviewer must not approve/reject an event they
// created/pitched. Stub prisma — updateMany throws so a passing guard is the
// only thing that could let a write through.
const stubEventPrisma = (event: Record<string, unknown>) =>
  ({
    event: {
      findUnique: async () => event,
      updateMany: async () => {
        throw new Error('guard must reject before any write runs');
      },
    },
  }) as any;

describe('approval self-action guard (events)', () => {
  const ownEvent = { id: 'e1', creator_id: 'coach-1', approval_status: 'pending' };

  it('blocks a reviewer from approving their own event', async () => {
    const result = await approveEvent('e1', 'coach-1', stubEventPrisma(ownEvent));
    expect(result.error).toBeTruthy();
    expect(result.status).toBe(403);
  });

  it('blocks a reviewer from rejecting their own event', async () => {
    const result = await rejectEvent('e1', 'coach-1', stubEventPrisma(ownEvent));
    expect(result.error).toBeTruthy();
    expect(result.status).toBe(403);
  });

  it('does not block a different reviewer', async () => {
    await expect(approveEvent('e1', 'coach-2', stubEventPrisma(ownEvent))).rejects.toThrow(
      'guard must reject before any write runs'
    );
  });
});
