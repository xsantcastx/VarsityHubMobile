import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';

const __skipDbIntegrationSuites =
  String(process.env.CI ?? '').toLowerCase() === 'true' || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = __skipDbIntegrationSuites ? describe.skip : describe;



let prisma: any;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describeDb('Ad alternative zip availability', () => {
  let userId = '';
  let userToken = '';
  const createdAdIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const user = await prisma.user.create({
      data: {
        email: `ad-alt-zip-${ts}@example.com`,
        password_hash: await bcrypt.hash(PASSWORD, 10),
        display_name: 'Ad Alt Zip User',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: { role: 'coach', plan: 'veteran', onboarding_completed: true },
      },
    });

    userId = user.id;
    userToken = signJwt({ id: user.id });

    const [fullZipAdA, fullZipAdB, availableZipAd] = await Promise.all([
      prisma.ad.create({
        data: {
          user_id: user.id,
          business_name: `Full Zip A ${ts}`,
          contact_email: user.email,
          target_zip_code: '10101',
          status: 'approved',
          payment_status: 'hold',
        },
      }),
      prisma.ad.create({
        data: {
          user_id: user.id,
          business_name: `Full Zip B ${ts}`,
          contact_email: user.email,
          target_zip_code: '10101',
          status: 'active',
          payment_status: 'paid',
        },
      }),
      prisma.ad.create({
        data: {
          user_id: user.id,
          business_name: `Available Zip ${ts}`,
          contact_email: user.email,
          target_zip_code: '10280',
          status: 'pending',
          payment_status: 'pending_approval',
        },
      }),
    ]);

    createdAdIds.push(fullZipAdA.id, fullZipAdB.id, availableZipAd.id);

    await prisma.adReservation.createMany({
      data: [
        { ad_id: fullZipAdA.id, date: new Date('2035-05-01T00:00:00.000Z') },
        { ad_id: fullZipAdA.id, date: new Date('2035-05-02T00:00:00.000Z') },
        { ad_id: fullZipAdB.id, date: new Date('2035-05-01T00:00:00.000Z') },
        { ad_id: fullZipAdB.id, date: new Date('2035-05-02T00:00:00.000Z') },
        { ad_id: availableZipAd.id, date: new Date('2035-05-01T00:00:00.000Z') },
      ],
      skipDuplicates: true,
    });
  });

  afterAll(async () => {
    if (!prisma) return;

    await prisma.adReservation.deleteMany({
      where: { ad_id: { in: createdAdIds } },
    }).catch(() => {});

    await prisma.ad.deleteMany({
      where: { id: { in: createdAdIds } },
    }).catch(() => {});

    if (userId) {
      await prisma.user.deleteMany({
        where: { id: userId },
      }).catch(() => {});
    }
  });

  it('only suggests nearby zips that still have capacity across every requested date', async () => {
    const res = await request(app)
      .get('/ads/alternative-zips')
      .set('Authorization', `Bearer ${userToken}`)
      .query({
        zip: '10001',
        dates: '2035-05-01,2035-05-02',
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.alternatives)).toBe(true);

    const byZip = new Map(
      (res.body.alternatives as Array<{ zip: string; available: boolean }>).map((entry) => [entry.zip, entry.available])
    );

    expect(byZip.has('10101')).toBe(false);
    expect(byZip.get('10280')).toBe(true);
  });
});
