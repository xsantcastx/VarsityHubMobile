import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';

let prisma: any;
let signJwt: any;
let app: any;

const isCi = `${process.env.CI ?? ''}`.toLowerCase() === 'true';
const shouldSkipDbTests = isCi || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = shouldSkipDbTests ? describe.skip : describe;

const PASSWORD = 'TestPassword123!';
const ts = Date.now();

describe('Minors Foundation Helpers', () => {
  it('rejects DOB changes after the 24-hour grace window', async () => {
    const { DOB_GRACE_WINDOW_MS, evaluateDobUpdate } = await import('../lib/userAge.js');
    const result = evaluateDobUpdate({
      currentDob: new Date('2000-01-01'),
      currentSetAt: new Date(Date.now() - DOB_GRACE_WINDOW_MS - 60_000),
      incomingDob: '2001-02-02',
      now: new Date(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('dob_locked');
    }
  });

  it('treats unchanged DOB strings as a no-op regardless of local timezone', async () => {
    const { evaluateDobUpdate, parseDobLocal } = await import('../lib/userAge.js');
    const currentDob = parseDobLocal('2000-01-01');
    expect(currentDob).not.toBeNull();

    const result = evaluateDobUpdate({
      currentDob,
      currentSetAt: new Date('2024-01-01T00:00:00.000Z'),
      incomingDob: '2000-01-01',
      now: new Date('2026-04-20T12:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.changed).toBe(false);
      expect(result.newSetAt).toBeNull();
    }
  });
});

describeDb('Minors Foundation Integration', () => {
  let originalAdminEmails = '';
  const userIds: string[] = [];
  const adIds: string[] = [];

  let adminId = '';
  let adminToken = '';
  let adultId = '';
  let adultToken = '';
  let minorId = '';
  let minorToken = '';
  let dmRecipientId = '';
  let dmMinorSenderId = '';
  let dmMinorSenderToken = '';
  let deleteUserId = '';
  let deleteUserToken = '';
  let deleteUserPostId = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));
    ({ app } = await import('../minorsFoundationTestApp.js'));

    const hash = await bcrypt.hash(PASSWORD, 10);

    const adminEmail = `minors-admin-${ts}@example.com`;
    originalAdminEmails = process.env.ADMIN_EMAILS || '';
    process.env.ADMIN_EMAILS = [adminEmail, originalAdminEmails].filter(Boolean).join(',');

    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password_hash: hash,
        display_name: 'Minors Admin',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    adminId = admin.id;
    adminToken = signJwt({ id: admin.id });
    userIds.push(admin.id);

    const adult = await prisma.user.create({
      data: {
        email: `minors-adult-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Adult Viewer',
        email_verified: true,
        approval_status: 'APPROVED',
        date_of_birth: new Date('1990-01-01'),
        dob_set_at: new Date('2024-01-01T00:00:00.000Z'),
        preferences: { role: 'fan', onboarding_completed: true, dob: '1990-01-01' },
      },
    });
    adultId = adult.id;
    adultToken = signJwt({ id: adult.id });
    userIds.push(adult.id);

    const minor = await prisma.user.create({
      data: {
        email: `minors-viewer-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Minor Viewer',
        email_verified: true,
        approval_status: 'APPROVED',
        date_of_birth: new Date('2010-01-01'),
        dob_set_at: new Date('2024-01-01T00:00:00.000Z'),
        parental_consent_status: 'pending',
        preferences: { role: 'fan', onboarding_completed: true, dob: '2010-01-01' },
      },
    });
    minorId = minor.id;
    minorToken = signJwt({ id: minor.id });
    userIds.push(minor.id);

    const dmRecipient = await prisma.user.create({
      data: {
        email: `minors-dm-recipient-${ts}@example.com`,
        password_hash: hash,
        display_name: 'DM Recipient',
        email_verified: true,
        approval_status: 'APPROVED',
        date_of_birth: new Date('1992-06-01'),
        dob_set_at: new Date('2024-01-01T00:00:00.000Z'),
        preferences: { role: 'fan', onboarding_completed: true, dm_policy: 'everyone' },
      },
    });
    dmRecipientId = dmRecipient.id;
    userIds.push(dmRecipient.id);

    const dmMinorSender = await prisma.user.create({
      data: {
        email: `minors-dm-minor-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Minor Sender',
        email_verified: true,
        approval_status: 'APPROVED',
        date_of_birth: new Date('2011-04-01'),
        dob_set_at: new Date('2024-01-01T00:00:00.000Z'),
        parental_consent_status: 'pending',
        preferences: {
          role: 'fan',
          onboarding_completed: true,
          // Deliberately stale/incorrect legacy DOB to prove the route now
          // trusts the canonical column instead of preferences JSON.
          dob: '1990-01-01',
        },
      },
    });
    dmMinorSenderId = dmMinorSender.id;
    dmMinorSenderToken = signJwt({ id: dmMinorSender.id });
    userIds.push(dmMinorSender.id);

    const deleteUser = await prisma.user.create({
      data: {
        email: `minors-delete-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Delete Me',
        email_verified: true,
        approval_status: 'APPROVED',
        date_of_birth: new Date('1995-02-02'),
        dob_set_at: new Date('2024-01-01T00:00:00.000Z'),
        preferences: {
          role: 'fan',
          onboarding_completed: true,
          dob: '1995-02-02',
          push_token: 'ExponentPushToken[DeleteMe]',
        },
      },
    });
    deleteUserId = deleteUser.id;
    deleteUserToken = signJwt({ id: deleteUser.id });
    userIds.push(deleteUser.id);

    const deletePost = await prisma.post.create({
      data: {
        author_id: deleteUser.id,
        title: 'Keep me',
        content: 'This post should survive user anonymization.',
        type: 'post',
      },
    });
    deleteUserPostId = deletePost.id;

    const adOwner = await prisma.user.create({
      data: {
        email: `minors-ad-owner-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Ad Owner',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    userIds.push(adOwner.id);

    const ad = await prisma.ad.create({
      data: {
        user_id: adOwner.id,
        contact_name: 'Ad Owner',
        contact_email: `minors-ad-contact-${ts}@example.com`,
        business_name: 'Minors Test Ad',
        banner_url: 'https://example.com/banner.jpg',
        target_url: 'https://example.com',
        target_zip_code: '10001',
        target_lat: 40.7506,
        target_lng: -73.9972,
        radius: 25,
        description: 'Visible to adults only',
        status: 'active',
        payment_status: 'paid',
        reservations: {
          create: {
            date: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`),
          },
        },
      },
    });
    adIds.push(ad.id);
  });

  afterAll(async () => {
    process.env.ADMIN_EMAILS = originalAdminEmails;

    try {
      await prisma.message.deleteMany({
        where: {
          OR: [
            { sender_id: { in: userIds } },
            { recipient_id: { in: userIds } },
          ],
        },
      }).catch(() => {});
      if (deleteUserPostId) {
        await prisma.post.deleteMany({ where: { id: deleteUserPostId } }).catch(() => {});
      }
      await prisma.notification.deleteMany({
        where: {
          OR: [
            { user_id: { in: userIds } },
            { actor_id: { in: userIds } },
          ],
        },
      }).catch(() => {});
      await prisma.refreshToken.deleteMany({ where: { user_id: { in: userIds } } }).catch(() => {});
      await prisma.ad.deleteMany({ where: { id: { in: adIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
    } catch (e) {
      console.warn('Cleanup error (non-critical):', e);
    }
  });

  it('blocks DOB changes after the grace window on PATCH /auth/me/preferences', async () => {
    const res = await request(app)
      .patch('/auth/me/preferences')
      .set('Authorization', `Bearer ${adultToken}`)
      .send({ dob: '1991-01-01' });

    expect(res.status).toBe(403);
    expect(res.body?.error).toBe('DOB_LOCKED');
  });

  it('lets admins correct DOB after the grace window and syncs canonical fields', async () => {
    const res = await request(app)
      .patch(`/users/${adultId}/date-of-birth`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dob: '1991-03-04' });

    expect(res.status).toBe(200);
    expect(res.body?.date_of_birth).toBe('1991-03-04');

    const updated = await prisma.user.findUnique({
      where: { id: adultId },
      select: { date_of_birth: true, preferences: true },
    });
    expect(updated?.date_of_birth?.toISOString().slice(0, 10)).toBe('1991-03-04');
    expect((updated?.preferences as any)?.dob).toBe('1991-03-04');
  });

  it('hides ads from authenticated minors while adults still receive eligible ads', async () => {
    const adultRes = await request(app)
      .get('/ads/for-feed')
      .set('Authorization', `Bearer ${adultToken}`)
      .query({ lat: 40.7506, lng: -73.9972, limit: 5 });

    expect(adultRes.status).toBe(200);
    expect(Array.isArray(adultRes.body?.ads)).toBe(true);
    expect(adultRes.body.ads.length).toBeGreaterThan(0);
    expect(adultRes.body.ads[0]).not.toHaveProperty('reservations');

    const minorRes = await request(app)
      .get('/ads/for-feed')
      .set('Authorization', `Bearer ${minorToken}`)
      .query({ lat: 40.7506, lng: -73.9972, limit: 5 });

    expect(minorRes.status).toBe(200);
    expect(minorRes.body?.ads).toEqual([]);
  });

  it('enforces DM age policy from canonical DOB even when preferences.dob is stale', async () => {
    const res = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${dmMinorSenderToken}`)
      .send({
        recipient_id: dmRecipientId,
        content: 'Hello from a minor account',
      });

    expect(res.status).toBe(403);
    expect(res.body?.code).toBe('AGE_POLICY_BLOCKED');
  });

  it('soft-deletes and anonymizes the user via DELETE /users/me without deleting authored posts', async () => {
    const res = await request(app)
      .delete('/users/me')
      .set('Authorization', `Bearer ${deleteUserToken}`)
      .send({ password: PASSWORD });

    expect(res.status).toBe(202);
    expect(res.body?.deleted).toBe(true);

    const deletedUser = await prisma.user.findUnique({
      where: { id: deleteUserId },
      select: {
        id: true,
        email: true,
        display_name: true,
        username: true,
        deleted_at: true,
        deletion_anonymized: true,
        password_hash: true,
        preferences: true,
      },
    });
    expect(deletedUser).toBeTruthy();
    expect(deletedUser?.email).toMatch(/^deleted\+/);
    expect(deletedUser?.display_name).toBe('Deleted User');
    expect(deletedUser?.deletion_anonymized).toBe(true);
    expect(deletedUser?.deleted_at).toBeTruthy();
    expect(deletedUser?.password_hash).toBeNull();
    expect((deletedUser?.preferences as any)?.deleted).toBe(true);

    const post = await prisma.post.findUnique({ where: { id: deleteUserPostId } });
    expect(post?.author_id).toBe(deleteUserId);

    const afterDelete = await request(app)
      .get('/users/me/export')
      .set('Authorization', `Bearer ${deleteUserToken}`);
    expect(afterDelete.status).toBe(401);
  });
});
