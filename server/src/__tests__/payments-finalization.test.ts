import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';

let prisma: any;
let runFinalizeFromSession: (session: any) => Promise<void>;

const isCi = `${process.env.CI ?? ''}`.toLowerCase() === 'true';
const shouldSkipDbTests = isCi || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = shouldSkipDbTests ? describe.skip : describe;

describeDb('Checkout session finalization', () => {
  const createdUserIds: string[] = [];
  const createdAdIds: string[] = [];
  const createdSessionIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    const paymentsModule = await import('../routes/payments.js');
    runFinalizeFromSession = paymentsModule.__paymentsInternal.runFinalizeFromSession;
  });

  afterAll(async () => {
    if (!prisma) return;

    if (createdSessionIds.length) {
      await prisma.transactionLog.deleteMany({
        where: { stripe_session_id: { in: createdSessionIds } },
      }).catch(() => {});
    }

    if (createdAdIds.length) {
      await prisma.adReservation.deleteMany({
        where: { ad_id: { in: createdAdIds } },
      }).catch(() => {});
      await prisma.ad.deleteMany({
        where: { id: { in: createdAdIds } },
      }).catch(() => {});
    }

    if (createdUserIds.length) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      }).catch(() => {});
    }
  });

  it('finalizes membership checkout and marks subscription transaction completed', async () => {
    const sessionId = `sess_membership_finalize_${Date.now()}`;
    createdSessionIds.push(sessionId);

    const user = await prisma.user.create({
      data: {
        email: `membership-finalize-${Date.now()}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'Membership Finalize User',
        email_verified: true,
        preferences: {
          role: 'coach',
          plan: 'rookie',
          pending_plan: 'veteran',
          payment_pending: true,
          payment_approved: true,
        },
      },
    });
    createdUserIds.push(user.id);

    await prisma.transactionLog.create({
      data: {
        transaction_type: 'SUBSCRIPTION_PURCHASE',
        status: 'PENDING',
        stripe_session_id: sessionId,
        user_id: user.id,
        user_email: user.email,
        subtotal_cents: 1000,
        total_cents: 1000,
        currency: 'usd',
      },
    });

    await runFinalizeFromSession({
      id: sessionId,
      payment_status: 'paid',
      status: 'complete',
      amount_total: 1000,
      payment_intent: 'pi_membership_finalize_test',
      metadata: {
        user_id: user.id,
        plan: 'veteran',
        membership: '1',
        total_cents: '1000',
      },
      customer_details: { email: user.email },
    });

    const refreshedUser = await prisma.user.findUnique({ where: { id: user.id } });
    const tx = await prisma.transactionLog.findUnique({
      where: { stripe_session_id: sessionId },
    });

    const prefs = (refreshedUser?.preferences && typeof refreshedUser.preferences === 'object')
      ? refreshedUser.preferences as any
      : {};

    expect(refreshedUser?.subscription_tier).toBe('premium');
    expect(refreshedUser?.subscription_status).toBe('active');
    expect(prefs.plan).toBe('veteran');
    expect(prefs.pending_plan).toBeNull();
    expect(prefs.payment_pending).toBe(false);
    expect(tx?.status).toBe('COMPLETED');
    expect(tx?.stripe_payment_intent_id).toBe('pi_membership_finalize_test');
  });

  it('finalizes ad checkout and marks ad transaction completed', async () => {
    const now = Date.now();
    const sessionId = `sess_ad_finalize_${now}`;
    createdSessionIds.push(sessionId);

    const user = await prisma.user.create({
      data: {
        email: `ad-finalize-${now}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'Ad Finalize User',
        email_verified: true,
        preferences: { role: 'coach', plan: 'veteran' },
      },
    });
    createdUserIds.push(user.id);

    const ad = await prisma.ad.create({
      data: {
        user_id: user.id,
        business_name: 'Finalize Test Ad',
        contact_email: user.email,
        target_zip_code: '10001',
        status: 'pending',
        payment_status: 'hold',
      },
    });
    createdAdIds.push(ad.id);

    const adDates = ['2035-01-02', '2035-01-03'];

    await prisma.transactionLog.create({
      data: {
        transaction_type: 'AD_PURCHASE',
        status: 'PENDING',
        stripe_session_id: sessionId,
        user_id: user.id,
        user_email: user.email,
        order_id: ad.id,
        subtotal_cents: 1300,
        total_cents: 1300,
        currency: 'usd',
      },
    });

    await runFinalizeFromSession({
      id: sessionId,
      payment_status: 'paid',
      status: 'complete',
      amount_total: 1300,
      payment_intent: 'pi_ad_finalize_test',
      metadata: {
        ad_id: ad.id,
        user_id: user.id,
        dates: JSON.stringify(adDates),
        total_cents: '1300',
      },
      customer_details: { email: user.email },
    });

    const refreshedAd = await prisma.ad.findUnique({ where: { id: ad.id } });
    const reservations = await prisma.adReservation.findMany({ where: { ad_id: ad.id } });
    const tx = await prisma.transactionLog.findUnique({
      where: { stripe_session_id: sessionId },
    });

    expect(refreshedAd?.payment_status).toBe('paid');
    expect(refreshedAd?.status).toBe('active');
    expect(reservations).toHaveLength(2);
    expect(tx?.status).toBe('COMPLETED');
    expect(tx?.stripe_payment_intent_id).toBe('pi_ad_finalize_test');
  });
});
