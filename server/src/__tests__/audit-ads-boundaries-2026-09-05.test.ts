/**
 * Audit reproduction harness, 2026-09-05.
 * Executes the live Express ads router with mocked Prisma/providers. These are
 * HTTP contract scenarios, not PostgreSQL/payment-provider end-to-end tests.
 * Acceptance cases preserve the original audit threat boundaries.
 */
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const adId = 'caaaaaaaaaaaaaaaaaaaaaaaa';
const ownerId = 'cbbbbbbbbbbbbbbbbbbbbbbbb';
let actor: string | undefined;
let currentAd: Record<string, unknown>;
const passthrough = (_req: unknown, _res: unknown, next: () => void) => next();
const db: any = {
  $transaction: jest.fn(async (work: any) => work(db)),
  $queryRaw: jest.fn(async () => [{ date: new Date('2026-09-10T00:00:00Z'), count: BigInt(2) }]),
  adSlotHold: {
    findMany: jest.fn(async () => []),
    createMany: jest.fn(async () => ({ count: 1 })),
  },
  ad: {
    findUniqueOrThrow: jest.fn(async () => ({ ...currentAd })),
    findUnique: jest.fn(async () => ({ ...currentAd })),
    findMany: jest.fn(async () => []),
    create: jest.fn(async ({ data }: any) => ({ id: adId, ...data })),
    update: jest.fn(async ({ data }: any) => {
      currentAd = { ...currentAd, ...data };
      return { ...currentAd };
    }),
  },
  adReservation: {
    findMany: jest.fn(async () => [{ ad_id: adId, date: new Date('2026-09-10T00:00:00Z') }]),
    groupBy: jest.fn(async () => [{ date: new Date('2026-09-10T00:00:00Z'), _count: { date: 2 } }]),
    createMany: jest.fn(async () => ({ count: 1 })),
  },
  user: {
    findUnique: jest.fn(async () => ({ email: 'fan@example.test', email_verified: true })),
  },
};

jest.unstable_mockModule('../lib/prisma.js', () => ({ prisma: db }));
jest.unstable_mockModule('../lib/approvalService.js', () => ({
  approveAd: jest.fn(),
  rejectAd: jest.fn(),
}));
jest.unstable_mockModule('../lib/email.js', () => ({
  sendAdPendingReviewEmail: jest.fn(async () => true),
}));
jest.unstable_mockModule('../lib/geocoding.js', () => ({
  geocodeLocation: jest.fn(async () => null),
}));
jest.unstable_mockModule('../lib/sentry.js', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));
jest.unstable_mockModule('../lib/adminActivityLogger.js', () => ({ logAdminActivity: jest.fn() }));
jest.unstable_mockModule('../lib/reviewTokens.js', () => ({
  consumeReviewToken: jest.fn(),
  getReviewTokenReplayState: jest.fn(),
  verifyReviewToken: jest.fn(),
}));
jest.unstable_mockModule('../middleware/rateLimiters.js', () => ({
  adCreationLimiter: passthrough,
  adEngagementLimiter: passthrough,
  adModerationLimiter: passthrough,
  alternativeZipsLimiter: passthrough,
}));

let app: express.Express;
let reserveAdSlots: any;
beforeAll(async () => {
  await import('../lib/adInventory.js');
  await import('../lib/paymentInternals.js');
  const { adsRouter } = await import('../routes/ads.js');
  ({ reserveAdSlots } = await import('../lib/paymentInternals.js'));
  app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    if (actor) req.user = { id: actor };
    next();
  });
  app.use('/ads', adsRouter);
  app.use((err: any, _req: unknown, res: express.Response, _next: unknown) => {
    res.status(500).json({ error: String(err.message) });
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  actor = ownerId;
  currentAd = {
    id: adId,
    user_id: ownerId,
    status: 'active',
    payment_status: 'paid',
    business_name: 'Audited Shop',
    description: 'Approved copy',
    banner_url: 'https://res.cloudinary.com/demo/image/upload/banner.jpg',
    target_url: 'https://example.test',
    target_zip_code: '10001',
  };
});

describe('audit: ad owner boundaries through live HTTP router', () => {
  it('unauthenticated ad edit is rejected', async () => {
    actor = undefined;
    expect((await request(app).put(`/ads/${adId}`).send({ description: 'edit' })).status).toBe(401);
    expect(db.ad.update).not.toHaveBeenCalled();
  });

  it.each(['get', 'put', 'delete'] as const)('another fan cannot %s the owner ad', async method => {
    actor = 'ccccccccccccccccccccccccc';
    const response = await request(app)[method](`/ads/${adId}`).send({ description: 'edit' });
    expect(response.status).toBe(403);
    expect(db.ad.update).not.toHaveBeenCalled();
  });

  it('another fan cannot view the owner reservations', async () => {
    actor = 'ccccccccccccccccccccccccc';
    expect((await request(app).get(`/ads/reservations?ad_id=${adId}`)).status).toBe(403);
    expect(db.adReservation.findMany).not.toHaveBeenCalled();
  });

  it('owner cannot forge payment/approval/ownership through ad edit', async () => {
    currentAd.status = 'draft';
    currentAd.payment_status = 'unpaid';
    const response = await request(app).put(`/ads/${adId}`).send({
      status: 'active',
      payment_status: 'paid',
      user_id: 'another-user',
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'draft',
      payment_status: 'unpaid',
      user_id: ownerId,
    });
  });

  it('user-visible copy edit removes a paid ad from active serving pending review', async () => {
    const response = await request(app)
      .put(`/ads/${adId}`)
      .send({ business_name: 'Unreviewed new copy' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'pending', payment_status: 'paid' });
  });

  it('paid retarget rejects full inventory before writing targeting', async () => {
    const response = await request(app).put(`/ads/${adId}`).send({ target_zip_code: '10002' });
    expect(response.status).toBe(409);
    expect(currentAd.target_zip_code).toBe('10001');
    expect(db.ad.update).not.toHaveBeenCalled();
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('new checkout holds never overwrite paid campaign state or paid dates', async () => {
    db.$queryRaw.mockResolvedValueOnce([]);
    // Existing paid date is Sep 10; the new date-filtered overlap query asks for Sep 12.
    db.adReservation.findMany.mockResolvedValueOnce([]);
    await reserveAdSlots(db, {
      adId,
      targetZipCode: '10001',
      isoDates: ['2026-09-12'],
      paymentStatus: 'hold',
      purchaseReference: 'pi_additional',
    });
    expect(currentAd).toMatchObject({ status: 'active', payment_status: 'paid' });
    expect(db.adReservation.createMany).not.toHaveBeenCalled();
    expect(db.adSlotHold.createMany).toHaveBeenCalled();
  });
});
