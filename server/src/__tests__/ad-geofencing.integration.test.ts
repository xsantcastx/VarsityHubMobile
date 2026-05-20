import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';
import { describeDb } from './dbTestGuard.js';

let prisma: any;
let signJwt: any;

const PASSWORD = 'TestPassword123!';
const ts = Date.now();
describeDb('Ad geofencing integration', () => {
  const userIds: string[] = [];
  const adIds: string[] = [];

  let viewerToken = '';
  let viewerId = '';

  const origin = { lat: 40.7506, lng: -73.9972 };
  const todayIso = new Date().toISOString().slice(0, 10);
  const futureIso = '2035-05-10';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const viewer = await prisma.user.create({
      data: {
        email: `ad-geofence-viewer-${ts}@example.com`,
        password_hash: passwordHash,
        display_name: 'Ad Geofence Viewer',
        email_verified: true,
        approval_status: 'APPROVED',
        date_of_birth: new Date('1992-01-01T00:00:00.000Z'),
        dob_set_at: new Date('2024-01-01T00:00:00.000Z'),
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    viewerId = viewer.id;
    viewerToken = signJwt({ id: viewer.id });
    userIds.push(viewer.id);

    const insideRadiusAd = await prisma.ad.create({
      data: {
        user_id: viewer.id,
        contact_name: 'Inside Radius',
        contact_email: viewer.email,
        business_name: `Inside Radius ${ts}`,
        banner_url: 'https://example.com/inside-radius.jpg',
        target_url: 'https://example.com/inside-radius',
        target_zip_code: '10001',
        target_lat: origin.lat + 0.08,
        target_lng: origin.lng,
        radius: 9,
        description: 'Inside the 9 mile radius',
        status: 'active',
        payment_status: 'paid',
        reservations: {
          create: {
            date: new Date(`${todayIso}T00:00:00.000Z`),
          },
        },
      },
    });

    const outsideRadiusAd = await prisma.ad.create({
      data: {
        user_id: viewer.id,
        contact_name: 'Outside Radius',
        contact_email: viewer.email,
        business_name: `Outside Radius ${ts}`,
        banner_url: 'https://example.com/outside-radius.jpg',
        target_url: 'https://example.com/outside-radius',
        target_zip_code: '10002',
        target_lat: origin.lat + 0.15,
        target_lng: origin.lng,
        radius: 9,
        description: 'Outside the 9 mile radius',
        status: 'active',
        payment_status: 'paid',
        reservations: {
          create: {
            date: new Date(`${todayIso}T00:00:00.000Z`),
          },
        },
      },
    });

    const fullZipAdA = await prisma.ad.create({
      data: {
        user_id: viewer.id,
        contact_name: 'Full Zip A',
        contact_email: viewer.email,
        business_name: `Full Zip A ${ts}`,
        target_zip_code: '10002',
        radius: 9,
        status: 'active',
        payment_status: 'paid',
      },
    });

    const fullZipAdB = await prisma.ad.create({
      data: {
        user_id: viewer.id,
        contact_name: 'Full Zip B',
        contact_email: viewer.email,
        business_name: `Full Zip B ${ts}`,
        target_zip_code: '10002',
        radius: 9,
        status: 'pending',
        payment_status: 'pending_approval',
      },
    });

    adIds.push(
      insideRadiusAd.id,
      outsideRadiusAd.id,
      fullZipAdA.id,
      fullZipAdB.id
    );

    await prisma.adReservation.createMany({
      data: [
        { ad_id: fullZipAdA.id, date: new Date(`${futureIso}T00:00:00.000Z`) },
        { ad_id: fullZipAdB.id, date: new Date(`${futureIso}T00:00:00.000Z`) },
      ],
      skipDuplicates: true,
    });
  });

  afterAll(async () => {
    if (!prisma) return;

    await prisma.adReservation.deleteMany({
      where: { ad_id: { in: adIds } },
    }).catch(() => {});

    await prisma.ad.deleteMany({
      where: { id: { in: adIds } },
    }).catch(() => {});

    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    }).catch(() => {});
  });

  it('returns only ads within the 9 mile radius from the viewer in /ads/for-feed', async () => {
    const res = await request(app)
      .get('/ads/for-feed')
      .set('Authorization', `Bearer ${viewerToken}`)
      .query({
        date: todayIso,
        lat: origin.lat,
        lng: origin.lng,
        limit: 10,
      });

    expect(res.status).toBe(200);
    const businessNames = (res.body?.ads ?? []).map((ad: any) => ad.business_name);
    expect(businessNames).toContain(`Inside Radius ${ts}`);
    expect(businessNames).not.toContain(`Outside Radius ${ts}`);
  });

  it('returns only ads within the 9 mile radius from the viewer in /feed/bundle', async () => {
    const res = await request(app)
      .get('/feed/bundle')
      .set('Authorization', `Bearer ${viewerToken}`)
      .query({
        country: 'US',
        date: todayIso,
        lat: origin.lat,
        lng: origin.lng,
      });

    expect(res.status).toBe(200);
    const businessNames = (res.body?.ads?.ads ?? []).map((ad: any) => ad.business_name);
    expect(businessNames).toContain(`Inside Radius ${ts}`);
    expect(businessNames).not.toContain(`Outside Radius ${ts}`);
  });

  it('counts booking capacity only against the exact requested zip code', async () => {
    const nearbyZipRes = await request(app)
      .get('/ads/availability')
      .query({
        zip: '10001',
        from: futureIso,
        to: futureIso,
      });

    expect(nearbyZipRes.status).toBe(200);
    expect(nearbyZipRes.body?.availability?.[futureIso]).toEqual({
      available: true,
      slotsUsed: 0,
      slotsRemaining: 2,
    });

    const fullZipRes = await request(app)
      .get('/ads/availability')
      .query({
        zip: '10002',
        from: futureIso,
        to: futureIso,
      });

    expect(fullZipRes.status).toBe(200);
    expect(fullZipRes.body?.availability?.[futureIso]).toEqual({
      available: false,
      slotsUsed: 2,
      slotsRemaining: 0,
    });
  });
});
