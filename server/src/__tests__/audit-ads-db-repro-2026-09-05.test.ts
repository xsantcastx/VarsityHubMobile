/** Live Express + isolated PostgreSQL audit repro; no payment-provider calls. */
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

let prisma: any;
let app: import('express').Express;
let token: string;
let userId: string;
let getFullAdSlotDates: any;
let reserveAdSlots: any;
let quoteAdId: string;
let runAdLifecycle: () => Promise<void>;
jest.unstable_mockModule('node-cron', () => ({
  default: {
    schedule: (_expression: string, callback: () => Promise<void>) => {
      runAdLifecycle = callback;
      return { stop() {} };
    },
  },
}));
const adIds: string[] = [];
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const nextDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

beforeAll(async () => {
  // Fail closed: this reproduction writes fixtures only to the dedicated local DB.
  const dbUrl = new URL(process.env.DATABASE_URL || '');
  if (
    !['127.0.0.1', 'localhost'].includes(dbUrl.hostname) ||
    !dbUrl.pathname.startsWith('/varsityhub_audit_')
  ) {
    throw new Error('Audit DB repro requires an explicitly isolated local audit database');
  }
  ({ prisma } = await import('../lib/prisma.js'));
  await import('../lib/adInventory.js');
  await import('../lib/paymentInternals.js');
  ({ app } = await import('../adApprovalTestApp.js'));
  const { paymentsRouter } = await import('../routes/payments.js');
  app.use('/payments', paymentsRouter);
  ({ getFullAdSlotDates, reserveAdSlots } = await import('../lib/paymentInternals.js'));
  const { startAdGoLiveCheck } = await import('../cron/overnightTasks.js');
  startAdGoLiveCheck();
  const { signJwt } = await import('../lib/jwt.js');
  const user = await prisma.user.create({
    data: {
      email: `audit-ads-${Date.now()}@example.test`,
      password_hash: 'not-a-real-login-hash',
      display_name: 'Audit Ad Owner',
      email_verified: true,
      role: 'fan',
      onboarding_completed: true,
      preferences: { role: 'fan', onboarding_completed: true },
    },
  });
  userId = user.id;
  token = signJwt({ id: userId });
  quoteAdId = (await createPaidAd('10001')).id;
});

beforeEach(async () => {
  const { paymentLimiter } = await import('../middleware/rateLimiters.js');
  paymentLimiter.resetKey(`user:${userId}`);
});

afterAll(async () => {
  if (!prisma || !userId) return;
  await prisma.ad.deleteMany({ where: { id: { in: adIds } } });
  await prisma.user.delete({ where: { id: userId } });
});

async function createPaidAd(zip: string) {
  const ad = await prisma.ad.create({
    data: {
      user_id: userId,
      contact_name: 'Audit Owner',
      contact_email: 'audit@example.test',
      business_name: 'Audit paid campaign',
      target_zip_code: zip,
      status: 'active',
      payment_status: 'paid',
      reservations: { create: { date: new Date(tomorrow + 'T00:00:00Z') } },
    },
  });
  adIds.push(ad.id);
  return ad;
}

describe('ad inventory acceptance against real local PostgreSQL', () => {
  it('paid retarget rejects full destination inventory', async () => {
    const ad = await createPaidAd('10001');
    await createPaidAd('10002');
    await createPaidAd('10002');
    expect(
      await getFullAdSlotDates(prisma, {
        adId: ad.id,
        targetZipCode: '10002',
        isoDates: [tomorrow],
      })
    ).toEqual([tomorrow]);

    const response = await request(app)
      .put(`/ads/${ad.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ target_zip_code: '10002' });
    expect(response.status).toBe(409);
    expect(await prisma.ad.findUnique({ where: { id: ad.id } })).toMatchObject({
      target_zip_code: '10001',
      status: 'active',
      payment_status: 'paid',
    });
    expect(
      await prisma.adReservation.count({
        where: {
          date: new Date(tomorrow + 'T00:00:00Z'),
          ad: { target_zip_code: '10002', payment_status: 'paid' },
        },
      })
    ).toBe(2);
  });

  it('a competing booking and paid ZIP retarget cannot sell a third slot', async () => {
    const { PrismaClient } = await import('@prisma/client');
    const otherDb = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
    const moving = await createPaidAd('60601');
    await createPaidAd('60602');
    const incoming = await prisma.ad.create({
      data: {
        user_id: userId,
        target_zip_code: '60602',
        status: 'approved',
        payment_status: 'unpaid',
      },
    });
    adIds.push(incoming.id);
    let ready!: () => void;
    let proceed!: () => void;
    const readDone = new Promise<void>(resolve => {
      ready = resolve;
    });
    const continueBooking = new Promise<void>(resolve => {
      proceed = resolve;
    });
    const booking = otherDb
      .$transaction(
        async tx => {
          const wrapped = new Proxy(tx, {
            get(target, key) {
              if (key === '$queryRaw')
                return async (...args: any[]) => {
                  const result = await (target.$queryRaw as any)(...args);
                  ready();
                  await continueBooking;
                  return result;
                };
              return Reflect.get(target, key);
            },
          });
          await reserveAdSlots(wrapped, {
            adId: incoming.id,
            isoDates: [tomorrow],
            paymentStatus: 'hold',
            purchaseReference: 'pi_race',
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
      const retarget = await request(app)
        .put(`/ads/${moving.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ target_zip_code: '60602' });
      expect(retarget.status).toBe(200);
      proceed();
      expect(await booking).toMatchObject({ ok: false, error: { code: 'P2034' } });
      const { getAdSlotCounts } = await import('../lib/adInventory.js');
      const counts = await getAdSlotCounts(prisma, {
        targetZipCode: '60602',
        isoDates: [tomorrow],
      });
      expect(Number(counts[0].count)).toBe(2);
    } finally {
      proceed();
      await booking;
      await otherDb.$disconnect();
    }
  });

  it('counts historical overlapping holds once per campaign and releases only the matching attempt', async () => {
    const { getAdSlotCounts, releaseAdPurchaseHolds } = await import('../lib/adInventory.js');
    const ads = await Promise.all(
      [0, 1].map(() =>
        prisma.ad.create({
          data: {
            user_id: userId,
            target_zip_code: '77001',
            status: 'approved',
            payment_status: 'unpaid',
          },
        })
      )
    );
    adIds.push(...ads.map((ad: any) => ad.id));
    for (const ad of ads) {
      await prisma.$transaction(
        (tx: any) =>
          reserveAdSlots(tx, {
            adId: ad.id,
            isoDates: [tomorrow],
            paymentStatus: 'hold',
            purchaseReference: `pi_${ad.id}_a`,
          }),
        { isolationLevel: 'Serializable' }
      );
      // Old writers allowed overlapping holds. Retain this historical fixture
      // to verify cancellation compatibility; new checkout rejects it.
      await prisma.adSlotHold.create({
        data: {
          ad_id: ad.id,
          date: new Date(`${tomorrow}T00:00:00Z`),
          purchase_reference: `pi_${ad.id}_b`,
          expires_at: new Date(Date.now() + 3600000),
        },
      });
    }
    const counts = () => getAdSlotCounts(prisma, { targetZipCode: '77001', isoDates: [tomorrow] });
    expect(Number((await counts())[0].count)).toBe(2);
    const response = await request(app).get(
      `/ads/availability?zip=77001&from=${tomorrow}&to=${tomorrow}`
    );
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).toContain('"slotsUsed":2');
    await releaseAdPurchaseHolds(ads[0].id, `pi_${ads[0].id}_a`);
    expect(Number((await counts())[0].count)).toBe(2);
    await prisma.adSlotHold.updateMany({
      where: { ad_id: ads[0].id },
      data: { expires_at: new Date(Date.now() - 1000) },
    });
    expect(Number((await counts())[0].count)).toBe(1);
  });

  it('Run Again holds preserve paid serving and expire without deleting earlier purchases', async () => {
    const ad = await createPaidAd('90210');
    await prisma.$transaction(
      async (tx: any) =>
        reserveAdSlots(tx, {
          adId: ad.id,
          targetZipCode: '90210',
          isoDates: [nextDate],
          paymentStatus: 'hold',
          purchaseReference: 'pi_expiring_additional',
        }),
      { isolationLevel: 'Serializable' }
    );
    const stored = await prisma.ad.findUnique({
      where: { id: ad.id },
      include: { reservations: true },
    });
    expect(stored.payment_status).toBe('paid');
    expect(stored.reservations).toHaveLength(1);
    expect(
      await prisma.ad.count({
        where: {
          id: ad.id,
          status: 'active',
          payment_status: 'paid',
          reservations: { some: { date: new Date(tomorrow + 'T00:00:00Z') } },
        },
      })
    ).toBe(1);
    await prisma.adSlotHold.updateMany({
      where: { ad_id: ad.id },
      data: { expires_at: new Date(Date.now() - 1000) },
    });
    await runAdLifecycle();
    const expired = await prisma.ad.findUnique({
      where: { id: ad.id },
      include: { reservations: true },
    });
    expect(expired.payment_status).toBe('paid');
    expect(expired.reservations).toHaveLength(1);
    expect(await prisma.adSlotHold.count({ where: { ad_id: ad.id } })).toBe(0);
  });
});

describe('audit: authenticated fan quote scenarios with real PostgreSQL', () => {
  function quote(dates: string[], extra: Record<string, unknown> = {}) {
    return request(app)
      .post('/payments/ad-quote')
      .set('Authorization', `Bearer ${token}`)
      .send({ ad_id: quoteAdId, dates, ...extra });
  }

  it('Rookie fan receives server-calculated price and forged amount is ignored', async () => {
    const response = await quote([tomorrow], { total_cents: 0, payment_status: 'paid' });
    expect(response.status).toBe(200);
    expect(response.body.total_cents).toBeGreaterThan(0);
  });

  it('the 56-day boundary is bookable', async () => {
    const date = new Date(Date.now() + 56 * 86400000).toISOString().slice(0, 10);
    expect((await quote([date])).status).toBe(200);
  });

  it.each([-1, 57])('rejects day offset %s outside the booking window', async days => {
    const date = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    expect((await quote([date])).status).toBe(400);
  });

  it.each(['not-a-date', '2026-02-30', '2025-02-29', '2026-13-01', '2026-09-10T00:00:00Z'])(
    'rejects malformed or impossible date %s',
    async date => {
      expect((await quote([date])).status).toBe(400);
      for (const route of ['checkout', 'create-payment-sheet', 'apple/verify-ad-receipt']) {
        const response = await request(app)
          .post(`/payments/${route}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ ad_id: quoteAdId, dates: [date] });
        expect(response.status).toBe(400);
      }
    }
  );

  it('deduplicates repeated dates before pricing', async () => {
    const once = await quote([tomorrow]);
    const twice = await quote([tomorrow, tomorrow]);
    expect(twice.status).toBe(200);
    expect(twice.body.total_cents).toBe(once.body.total_cents);
    expect(twice.body.dates).toEqual([tomorrow]);
  });

  it('does not price an ad that belongs to someone else', async () => {
    const foreign = await createPaidAd('10001');
    await prisma.ad.update({ where: { id: foreign.id }, data: { user_id: null } });
    expect((await quote([tomorrow], { ad_id: foreign.id })).status).toBe(403);
  });
});
