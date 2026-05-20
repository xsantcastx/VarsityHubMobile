import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { describeDb } from './dbTestGuard.js';

let prisma: any;
let signJwt: any;
let app: import('express').Express;
const PASSWORD = 'TestPassword123!';
const ts = Date.now();

describeDb('Ad engagement metrics', () => {
  let viewerId = '';
  let viewerToken = '';
  let ownerId = '';
  let adId = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));
    ({ app } = await import('../adApprovalTestApp.js'));

    const hash = await bcrypt.hash(PASSWORD, 10);

    const viewer = await prisma.user.create({
      data: {
        email: `ad-metrics-viewer-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Ad Metrics Viewer',
        email_verified: true,
        approval_status: 'APPROVED',
        date_of_birth: new Date('1992-01-01T00:00:00.000Z'),
        preferences: { role: 'fan', onboarding_completed: true, dob: '1992-01-01' },
      },
    });
    viewerId = viewer.id;
    viewerToken = signJwt({ id: viewer.id });

    const owner = await prisma.user.create({
      data: {
        email: `ad-metrics-owner-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Ad Metrics Owner',
        email_verified: true,
        approval_status: 'APPROVED',
        date_of_birth: new Date('1991-01-01T00:00:00.000Z'),
        preferences: { role: 'fan', onboarding_completed: true, dob: '1991-01-01' },
      },
    });
    ownerId = owner.id;

    const ad = await prisma.ad.create({
      data: {
        user_id: owner.id,
        contact_name: 'Metrics Owner',
        contact_email: `ad-metrics-contact-${ts}@example.com`,
        business_name: 'Metrics Hardware',
        banner_url: 'https://example.com/banner-metrics.jpg',
        target_url: 'https://example.com/store',
        target_zip_code: '10001',
        target_lat: 40.7506,
        target_lng: -73.9972,
        radius: 9,
        description: 'Engagement counter test',
        status: 'active',
        payment_status: 'paid',
      },
    });
    adId = ad.id;
  });

  afterAll(async () => {
    if (adId) {
      await prisma.ad.deleteMany({ where: { id: adId } }).catch(() => {});
    }
    await prisma.user.deleteMany({ where: { id: { in: [viewerId, ownerId].filter(Boolean) } } }).catch(() => {});
  });

  it('records impressions and clicks on active paid ads', async () => {
    const impressionRes = await request(app)
      .post(`/ads/${adId}/impression`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(impressionRes.status).toBe(200);
    expect(impressionRes.body).toEqual(
      expect.objectContaining({
        ok: true,
        type: 'impression',
        id: adId,
        impression_count: 1,
        click_count: 0,
      })
    );

    const clickRes = await request(app)
      .post(`/ads/${adId}/click`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(clickRes.status).toBe(200);
    expect(clickRes.body).toEqual(
      expect.objectContaining({
        ok: true,
        type: 'click',
        id: adId,
        impression_count: 1,
        click_count: 1,
      })
    );

    const ad = await prisma.ad.findUnique({
      where: { id: adId },
      select: {
        impression_count: true,
        click_count: true,
        last_impression_at: true,
        last_click_at: true,
      },
    });

    expect(ad?.impression_count).toBe(1);
    expect(ad?.click_count).toBe(1);
    expect(ad?.last_impression_at).toBeTruthy();
    expect(ad?.last_click_at).toBeTruthy();
  });

  it('does not record engagement for inactive or unpaid ads', async () => {
    const paused = await prisma.ad.create({
      data: {
        user_id: ownerId,
        contact_name: 'Paused Owner',
        contact_email: `ad-metrics-paused-${ts}@example.com`,
        business_name: 'Paused Campaign',
        target_url: 'https://example.com/paused',
        target_zip_code: '10001',
        radius: 9,
        status: 'pending',
        payment_status: 'pending_approval',
      },
    });

    const res = await request(app)
      .post(`/ads/${paused.id}/impression`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(404);

    await prisma.ad.deleteMany({ where: { id: paused.id } }).catch(() => {});
  });
});
