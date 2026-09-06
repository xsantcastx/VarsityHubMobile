/** Valid locally signed Stripe webhook + isolated PostgreSQL; no provider calls. */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { createHmac } from 'node:crypto';
import express from 'express';
import request from 'supertest';

const webhookSecret = 'whsec_local_audit_refund_only';
const runId = String(Date.now());
const eventIds: string[] = [];
const userIds: string[] = [];
let prisma: any;
let app: express.Express;

beforeAll(async () => {
  const dbUrl = new URL(process.env.DATABASE_URL || '');
  if (
    !['127.0.0.1', 'localhost'].includes(dbUrl.hostname) ||
    !dbUrl.pathname.startsWith('/varsityhub_audit_')
  ) {
    throw new Error('Audit DB repro requires an explicitly isolated local audit database');
  }
  process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
  ({ prisma } = await import('../lib/prisma.js'));
  await import('../lib/adInventory.js');
  await import('../lib/paymentInternals.js');
  const { paymentsRouter } = await import('../routes/payments.js');
  app = express();
  app.use('/payments/webhook', express.raw({ type: 'application/json' }));
  app.use('/payments', paymentsRouter);
});

afterAll(async () => {
  jest.restoreAllMocks();
  if (!prisma) return;
  await prisma.processedStripeEvent.deleteMany({ where: { event_id: { in: eventIds } } });
  await prisma.transactionLog.deleteMany({ where: { user_id: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

async function createFixture(suffix: string) {
  const user = await prisma.user.create({
    data: {
      email: `audit-refund-${runId}-${suffix}@example.test`,
      password_hash: 'no-login',
      email_verified: true,
      role: 'coach',
      plan: 'legend',
      subscription_tier: 'pro',
      subscription_status: 'active',
      preferences: {
        role: 'coach',
        plan: 'legend',
        subscription_id: 'sub_new_current',
        apple_original_transaction_id: 'apple_current',
        apple_product_id: 'TOPTIER',
        apple_expires_date: new Date(Date.now() + 30 * 86400000).toISOString(),
      },
    },
  });
  userIds.push(user.id);
  const pi = `pi_audit_old_${runId}_${suffix}`;
  const tx = await prisma.transactionLog.create({
    data: {
      user_id: user.id,
      transaction_type: 'SUBSCRIPTION_PURCHASE',
      status: 'COMPLETED',
      stripe_payment_intent_id: pi,
      total_cents: 1000,
      metadata: { subscription_id: 'sub_old_retired', plan: 'veteran' },
    },
  });
  return { user, tx, pi };
}

async function sendRefund(pi: string, suffix: string, type = 'charge.refunded') {
  return sendProviderEvent(suffix, type, {
    id: `ch_audit_${suffix}`,
    object: 'charge',
    payment_intent: pi,
    amount: 1000,
    amount_refunded: 1000,
    refunded: true,
  });
}
async function sendProviderEvent(suffix: string, type: string, object: Record<string, unknown>) {
  const id = `evt_audit_refund_${runId}_${suffix}`;
  eventIds.push(id);
  const payload = JSON.stringify({ id, type, data: { object } });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  return {
    id,
    response: await request(app)
      .post('/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', `t=${timestamp},v1=${signature}`)
      .send(payload),
  };
}

describe('Stripe refund acceptance', () => {
  it('refund for retired Stripe purchase preserves newer paid entitlement', async () => {
    const fixture = await createFixture('old');
    const { response } = await sendRefund(fixture.pi, 'old');
    expect(response.status).toBe(200);
    const updated = await prisma.user.findUnique({ where: { id: fixture.user.id } });
    expect(updated.plan).toBe('legend');
    expect(updated.subscription_status).toBe('active');
    expect(updated.preferences.apple_original_transaction_id).toBe('apple_current');
  });

  it('transaction failure remains retryable; retry and duplicate commit once', async () => {
    const fixture = await createFixture('failure');
    const fault = jest
      .spyOn(prisma, '$transaction')
      .mockRejectedValueOnce(new Error('audit simulated database outage'));
    const { id, response } = await sendRefund(fixture.pi, 'failure');
    fault.mockRestore();
    expect(response.status).toBe(500);
    expect(await prisma.processedStripeEvent.findUnique({ where: { event_id: id } })).toMatchObject(
      { processed: false }
    );
    expect(await prisma.transactionLog.findUnique({ where: { id: fixture.tx.id } })).toMatchObject({
      status: 'COMPLETED',
    });
    const retried = await sendRefund(fixture.pi, 'failure');
    expect(retried.response.status).toBe(200);
    expect(await prisma.transactionLog.findUnique({ where: { id: fixture.tx.id } })).toMatchObject({
      status: 'REFUNDED',
    });
    const before = await prisma.transactionLog.findUnique({ where: { id: fixture.tx.id } });
    expect((await sendRefund(fixture.pi, 'failure')).response.status).toBe(200);
    expect(await prisma.transactionLog.findUnique({ where: { id: fixture.tx.id } })).toEqual(
      before
    );
  });
  it.each(['stripe', 'apple', 'google'])(
    'stale refund and dispute preserve current %s entitlement',
    async platform => {
      const fixture = await createFixture(platform);
      const preferences = {
        plan: 'legend',
        subscription_id: 'sub_new_current',
        subscription_platform: platform,
        ...(platform === 'apple' ? { apple_original_transaction_id: 'current_apple' } : {}),
        ...(platform === 'google' ? { google_purchase_token: 'current_google' } : {}),
      };
      await prisma.user.update({ where: { id: fixture.user.id }, data: { preferences } });
      for (const type of ['charge.refunded', 'charge.dispute.created']) {
        expect((await sendRefund(fixture.pi, `${platform}_${type}`, type)).response.status).toBe(
          200
        );
        expect(await prisma.user.findUnique({ where: { id: fixture.user.id } })).toMatchObject({
          plan: 'legend',
          subscription_status: 'active',
          preferences,
        });
      }
      expect(
        await prisma.transactionLog.findUnique({ where: { id: fixture.tx.id } })
      ).toMatchObject({ status: 'REFUNDED' });
    }
  );
  it('matching current subscription refund revokes only its entitlement', async () => {
    const fixture = await createFixture('matching');
    await prisma.user.update({
      where: { id: fixture.user.id },
      data: {
        preferences: {
          plan: 'legend',
          subscription_id: 'sub_old_retired',
          subscription_platform: 'stripe',
        },
      },
    });
    expect((await sendRefund(fixture.pi, 'matching')).response.status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: fixture.user.id } })).toMatchObject({
      plan: 'rookie',
      subscription_status: 'canceled',
    });
  });
  it('crash after refund commit leaves event retryable and replay does not repeat business effects', async () => {
    const fixture = await createFixture('postcommit');
    const original = prisma.processedStripeEvent.update.bind(prisma.processedStripeEvent);
    let failed = false;
    const fault = jest
      .spyOn(prisma.processedStripeEvent, 'update')
      .mockImplementation(async (args: any) => {
        if (args.data.processed === true && !failed) {
          failed = true;
          throw new Error('simulated crash before marking event processed');
        }
        return original(args);
      });
    const { id, response } = await sendRefund(fixture.pi, 'postcommit');
    fault.mockRestore();
    expect(response.status).toBeGreaterThanOrEqual(500);
    const committed = await prisma.transactionLog.findUnique({ where: { id: fixture.tx.id } });
    expect(committed.status).toBe('REFUNDED');
    expect(await prisma.processedStripeEvent.findUnique({ where: { event_id: id } })).toMatchObject(
      { processed: false }
    );
    expect((await sendRefund(fixture.pi, 'postcommit')).response.status).toBe(200);
    expect(await prisma.transactionLog.findUnique({ where: { id: fixture.tx.id } })).toEqual(
      committed
    );
  });
  it('refund of one ad run retains the other run and late cancellation does not erase paid dates', async () => {
    const fixture = await createFixture('ad');
    const ad = await prisma.ad.create({
      data: {
        user_id: fixture.user.id,
        status: 'active',
        payment_status: 'paid',
        reservations: {
          create: [
            { date: new Date('2035-01-01T00:00:00Z'), purchase_reference: fixture.pi },
            { date: new Date('2035-01-02T00:00:00Z'), purchase_reference: 'pi_new_run' },
          ],
        },
      },
    });
    try {
      await prisma.transactionLog.update({
        where: { id: fixture.tx.id },
        data: { transaction_type: 'AD_PURCHASE', order_id: ad.id },
      });
      expect((await sendRefund(fixture.pi, 'ad')).response.status).toBe(200);
      const state = await prisma.ad.findUnique({
        where: { id: ad.id },
        include: { reservations: true },
      });
      expect(state).toMatchObject({ status: 'active', payment_status: 'paid' });
      expect(state.reservations.map((row: any) => row.purchase_reference)).toEqual(['pi_new_run']);
    } finally {
      await prisma.ad.delete({ where: { id: ad.id } });
    }
  });
  it('actual PaymentIntent success adds new dates; an unapproved ad cannot activate', async () => {
    const fixture = await createFixture('pi_success');
    const { reserveAdSlots } = await import('../lib/adInventory.js');
    const ad = await prisma.ad.create({
      data: {
        user_id: fixture.user.id,
        status: 'active',
        payment_status: 'paid',
        reservations: {
          create: { date: new Date('2035-04-01T00:00:00Z'), purchase_reference: 'pi_original' },
        },
      },
    });
    try {
      await prisma.transactionLog.update({
        where: { id: fixture.tx.id },
        data: { transaction_type: 'AD_PURCHASE', order_id: ad.id, status: 'PENDING' },
      });
      await prisma.$transaction(
        (tx: any) =>
          reserveAdSlots(tx, {
            adId: ad.id,
            isoDates: ['2035-04-02'],
            paymentStatus: 'hold',
            purchaseReference: fixture.pi,
          }),
        { isolationLevel: 'Serializable' }
      );
      const pi = {
        id: fixture.pi,
        object: 'payment_intent',
        amount: 499,
        metadata: { ad_id: ad.id, user_id: fixture.user.id, dates: '350402' },
      };
      expect(
        (await sendProviderEvent('pi_success', 'payment_intent.succeeded', pi)).response.status
      ).toBe(200);
      expect(
        (await sendProviderEvent('pi_success', 'payment_intent.succeeded', pi)).response.status
      ).toBe(200);
      expect(await prisma.adReservation.count({ where: { ad_id: ad.id } })).toBe(2);
      expect(await prisma.adSlotHold.count({ where: { ad_id: ad.id } })).toBe(0);
      await prisma.ad.update({ where: { id: ad.id }, data: { status: 'pending' } });
      const denied = await sendProviderEvent('pi_unapproved', 'payment_intent.succeeded', {
        ...pi,
        id: `${fixture.pi}_denied`,
        metadata: { ...pi.metadata, dates: '350403' },
      });
      expect(denied.response.status).toBeGreaterThanOrEqual(500);
      expect(await prisma.adReservation.count({ where: { ad_id: ad.id } })).toBe(2);
    } finally {
      await prisma.ad.delete({ where: { id: ad.id } });
    }
  });
  it('replaying a refunded Checkout Session or PaymentIntent cannot resurrect its dates', async () => {
    const fixture = await createFixture('resurrection');
    const { runFinalizeFromSession } = await import('../lib/paymentInternals.js');
    const ad = await prisma.ad.create({
      data: {
        user_id: fixture.user.id,
        status: 'active',
        payment_status: 'paid',
        reservations: {
          create: [
            { date: new Date('2035-05-01T00:00:00Z'), purchase_reference: fixture.pi },
            { date: new Date('2035-05-02T00:00:00Z'), purchase_reference: 'pi_other_run' },
          ],
        },
      },
    });
    const sessionId = `cs_${fixture.pi}`;
    try {
      await prisma.transactionLog.update({
        where: { id: fixture.tx.id },
        data: { transaction_type: 'AD_PURCHASE', order_id: ad.id, stripe_session_id: sessionId },
      });
      expect((await sendRefund(fixture.pi, 'resurrection')).response.status).toBe(200);
      expect(
        (
          await sendProviderEvent('resurrection_expired', 'checkout.session.expired', {
            id: sessionId,
            metadata: { ad_id: ad.id },
          })
        ).response.status
      ).toBe(200);
      expect(
        (
          await sendProviderEvent('resurrection_canceled', 'payment_intent.canceled', {
            id: fixture.pi,
            amount: 1000,
            metadata: { ad_id: ad.id, user_id: fixture.user.id },
          })
        ).response.status
      ).toBe(200);
      await runFinalizeFromSession({
        id: sessionId,
        mode: 'payment',
        payment_status: 'paid',
        metadata: { ad_id: ad.id, user_id: fixture.user.id, dates: '350501' },
      } as any);
      const response = await sendProviderEvent('resurrection_pi', 'payment_intent.succeeded', {
        id: fixture.pi,
        object: 'payment_intent',
        amount: 1000,
        metadata: { ad_id: ad.id, user_id: fixture.user.id, dates: '350501' },
      });
      expect(response.response.status).toBe(200);
      expect(
        await prisma.transactionLog.findUnique({ where: { id: fixture.tx.id } })
      ).toMatchObject({ status: 'REFUNDED' });
      expect(
        (await prisma.adReservation.findMany({ where: { ad_id: ad.id } })).map(
          (row: any) => row.purchase_reference
        )
      ).toEqual(['pi_other_run']);
    } finally {
      await prisma.ad.delete({ where: { id: ad.id } });
    }
  });
  it('refunding the earlier run preserves approval for another pending purchase', async () => {
    const fixture = await createFixture('surviving_hold');
    const { reserveAdSlots } = await import('../lib/adInventory.js');
    const ad = await prisma.ad.create({
      data: {
        user_id: fixture.user.id,
        status: 'active',
        payment_status: 'paid',
        reservations: {
          create: { date: new Date('2035-06-01T00:00:00Z'), purchase_reference: fixture.pi },
        },
      },
    });
    const newPi = `pi_new_${ad.id}`;
    try {
      await prisma.transactionLog.update({
        where: { id: fixture.tx.id },
        data: { transaction_type: 'AD_PURCHASE', order_id: ad.id },
      });
      await prisma.transactionLog.create({
        data: {
          user_id: fixture.user.id,
          transaction_type: 'AD_PURCHASE',
          status: 'PENDING',
          order_id: ad.id,
          stripe_payment_intent_id: newPi,
        },
      });
      await prisma.$transaction(
        (tx: any) =>
          reserveAdSlots(tx, {
            adId: ad.id,
            isoDates: ['2035-06-02'],
            paymentStatus: 'hold',
            purchaseReference: newPi,
          }),
        { isolationLevel: 'Serializable' }
      );
      expect((await sendRefund(fixture.pi, 'surviving_hold')).response.status).toBe(200);
      expect(await prisma.ad.findUnique({ where: { id: ad.id } })).toMatchObject({
        status: 'approved',
        payment_status: 'hold',
      });
      expect(
        (
          await sendProviderEvent('surviving_hold_paid', 'payment_intent.succeeded', {
            id: newPi,
            object: 'payment_intent',
            amount: 499,
            metadata: { ad_id: ad.id, user_id: fixture.user.id, dates: '350602' },
          })
        ).response.status
      ).toBe(200);
      expect(await prisma.ad.findUnique({ where: { id: ad.id } })).toMatchObject({
        status: 'active',
        payment_status: 'paid',
      });
      expect(
        (await prisma.adReservation.findMany({ where: { ad_id: ad.id } })).map(
          (row: any) => row.purchase_reference
        )
      ).toEqual([newPi]);
    } finally {
      await prisma.ad.delete({ where: { id: ad.id } });
    }
  });
  it('refund racing settlement wins without a completed ledger or resurrected inventory', async () => {
    const fixture = await createFixture('race_refund');
    const { PrismaClient } = await import('@prisma/client');
    const { reserveAdSlots } = await import('../lib/adInventory.js');
    const otherDb = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
    const ad = await prisma.ad.create({
      data: {
        user_id: fixture.user.id,
        target_zip_code: '75201',
        status: 'active',
        payment_status: 'paid',
        reservations: {
          create: { date: new Date('2035-08-02T00:00:00Z'), purchase_reference: 'pi_other' },
        },
      },
    });
    await prisma.transactionLog.update({
      where: { id: fixture.tx.id },
      data: { transaction_type: 'AD_PURCHASE', order_id: ad.id, status: 'PENDING' },
    });
    let ready!: () => void;
    let proceed!: () => void;
    const readDone = new Promise<void>(resolve => {
      ready = resolve;
    });
    const continueSettlement = new Promise<void>(resolve => {
      proceed = resolve;
    });
    const settle = otherDb
      .$transaction(
        async tx => {
          const wrapped = new Proxy(tx, {
            get(target, key) {
              if (key === '$queryRaw')
                return async (...args: any[]) => {
                  const result = await (target.$queryRaw as any)(...args);
                  ready();
                  await continueSettlement;
                  return result;
                };
              return Reflect.get(target, key);
            },
          });
          await reserveAdSlots(wrapped, {
            adId: ad.id,
            isoDates: ['2035-08-01'],
            paymentStatus: 'paid',
            status: 'active',
            purchaseReference: fixture.pi,
          });
        },
        { isolationLevel: 'Serializable' }
      )
      .then(
        () => ({ ok: true }),
        error => ({ ok: false, error })
      );
    try {
      await readDone;
      expect((await sendRefund(fixture.pi, 'race_refund')).response.status).toBe(200);
      proceed();
      expect(await settle).toMatchObject({ ok: false, error: { code: 'P2034' } });
      expect(
        await prisma.transactionLog.findUnique({ where: { id: fixture.tx.id } })
      ).toMatchObject({ status: 'REFUNDED' });
      expect(
        (await prisma.adReservation.findMany({ where: { ad_id: ad.id } })).map(
          (row: any) => row.purchase_reference
        )
      ).toEqual(['pi_other']);
    } finally {
      proceed();
      await settle;
      await otherDb.$disconnect();
      await prisma.ad.delete({ where: { id: ad.id } });
    }
  });
});
