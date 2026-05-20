import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { updateTransactionStatus } from '../lib/transactionLogger.js';
import { describeDb } from './dbTestGuard.js';

let prisma: any;
let dbReady = false;
describeDb('updateTransactionStatus transaction reference coverage', () => {
  const createdIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    try {
      await prisma.$queryRawUnsafe('SELECT 1');
      dbReady = true;
    } catch {
      dbReady = false;
    }
  });

  afterAll(async () => {
    if (!prisma || !dbReady || !createdIds.length) return;
    await prisma.transactionLog.deleteMany({
      where: { id: { in: createdIds } },
    }).catch(() => {});
  });

  it('updates by stripe_session_id', async () => {
    if (!dbReady) return;

    const tx = await prisma.transactionLog.create({
      data: {
        transaction_type: 'AD_PURCHASE',
        status: 'PENDING',
        stripe_session_id: `sess_update_${Date.now()}`,
        total_cents: 500,
      },
    });
    createdIds.push(tx.id);

    const updated = await updateTransactionStatus(tx.stripe_session_id, 'COMPLETED', {
      metadata: { source: 'test_session' },
    });

    expect(updated?.id).toBe(tx.id);
    expect(updated?.status).toBe('COMPLETED');
  });

  it('updates by stripe_payment_intent_id', async () => {
    if (!dbReady) return;

    const piRef = `pi_update_${Date.now()}`;
    const tx = await prisma.transactionLog.create({
      data: {
        transaction_type: 'AD_PURCHASE',
        status: 'PENDING',
        stripe_payment_intent_id: piRef,
        total_cents: 800,
      },
    });
    createdIds.push(tx.id);

    const updated = await updateTransactionStatus(piRef, 'COMPLETED', {
      metadata: { source: 'test_pi' },
    });

    expect(updated?.id).toBe(tx.id);
    expect(updated?.status).toBe('COMPLETED');
  });

  it('updates by stripe_subscription_id', async () => {
    if (!dbReady) return;

    const subRef = `sub_update_${Date.now()}`;
    const tx = await prisma.transactionLog.create({
      data: {
        transaction_type: 'SUBSCRIPTION_PURCHASE',
        status: 'PENDING',
        stripe_subscription_id: subRef,
        total_cents: 2000,
      },
    });
    createdIds.push(tx.id);

    const updated = await updateTransactionStatus(subRef, 'COMPLETED', {
      metadata: { source: 'test_subscription' },
    });

    expect(updated?.id).toBe(tx.id);
    expect(updated?.status).toBe('COMPLETED');
  });
});
