import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';

let prisma: any;
let signJwt: any;
let app: import('express').Express;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describe('Ad Approval Security', () => {
  let originalAdminEmails = '';
  let ownerId = '';
  let ownerToken = '';
  let verifiedAdminId = '';
  let verifiedAdminToken = '';
  let unverifiedAdminId = '';
  let unverifiedAdminToken = '';
  let verifiedNonAdminId = '';
  let verifiedNonAdminToken = '';
  // Dedicated burner admin for the rate-limit test so the shared verifiedAdmin
  // bucket (used by the happy-path approve test) is never near its cap.
  let limiterAdminId = '';
  let limiterAdminToken = '';

  beforeAll(async () => {
    ({ app } = await import('../adApprovalTestApp.js'));
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const hash = await bcrypt.hash(PASSWORD, 10);

    const owner = await prisma.user.create({
      data: {
        email: `ad-owner-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Ad Owner',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'fan',
          onboarding_completed: true,
        },
      },
    });
    ownerId = owner.id;
    ownerToken = signJwt({ id: ownerId });

    const verifiedAdmin = await prisma.user.create({
      data: {
        email: `ad-admin-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Verified Admin',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'fan',
          onboarding_completed: true,
        },
      },
    });
    verifiedAdminId = verifiedAdmin.id;
    verifiedAdminToken = signJwt({ id: verifiedAdminId });

    const unverifiedAdmin = await prisma.user.create({
      data: {
        email: `ad-unverified-admin-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Unverified Admin',
        email_verified: false,
        role: 'fan',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'fan',
          onboarding_completed: true,
        },
      },
    });
    unverifiedAdminId = unverifiedAdmin.id;
    unverifiedAdminToken = signJwt({ id: unverifiedAdminId });

    const verifiedNonAdmin = await prisma.user.create({
      data: {
        email: `ad-non-admin-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Verified Non Admin',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'fan',
          onboarding_completed: true,
        },
      },
    });
    verifiedNonAdminId = verifiedNonAdmin.id;
    verifiedNonAdminToken = signJwt({ id: verifiedNonAdminId });

    const limiterAdmin = await prisma.user.create({
      data: {
        email: `ad-limiter-admin-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Limiter Admin',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'fan',
          onboarding_completed: true,
        },
      },
    });
    limiterAdminId = limiterAdmin.id;
    limiterAdminToken = signJwt({ id: limiterAdminId });

    originalAdminEmails = process.env.ADMIN_EMAILS || '';
    process.env.ADMIN_EMAILS = [
      verifiedAdmin.email,
      unverifiedAdmin.email,
      limiterAdmin.email,
      originalAdminEmails,
    ]
      .filter(Boolean)
      .join(',');
  });

  afterAll(async () => {
    process.env.ADMIN_EMAILS = originalAdminEmails;

    try {
      const userIds = [
        ownerId,
        verifiedAdminId,
        unverifiedAdminId,
        verifiedNonAdminId,
        limiterAdminId,
      ].filter(Boolean);

      await prisma.notification.deleteMany({
        where: { user_id: { in: userIds } },
      }).catch(() => {});

      await prisma.ad.deleteMany({
        where: { user_id: { in: userIds } },
      }).catch(() => {});

      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      }).catch(() => {});
    } catch (e) {
      console.warn('Cleanup error (non-critical):', e);
    }
  });

  async function createAd(status: 'pending' | 'approved' | 'active', description = 'Clean copy') {
    return prisma.ad.create({
      data: {
        user_id: ownerId,
        contact_name: 'Ad Owner',
        contact_email: `ad-contact-${ts}@example.com`,
        business_name: `Test Biz ${ts}`,
        banner_url: 'https://example.com/banner.jpg',
        target_url: 'https://example.com',
        target_zip_code: '10001',
        radius: 25,
        description,
        status,
        payment_status: status === 'active' ? 'paid' : status === 'pending' ? 'pending_approval' : 'unpaid',
      },
    });
  }

  it('blocks unauthenticated token-based approval', async () => {
    const ad = await createAd('pending');
    const token = signJwt({ adId: ad.id, action: 'approve_ad' }, '7d');

    const res = await request(app)
      .post(`/ads/${ad.id}/approve`)
      .query({ token })
      .send({});

    expect(res.status).toBe(401);
    expect(String(res.body?.error || '')).toMatch(/unauthorized/i);
  });

  it('blocks verified non-admins from using approval tokens', async () => {
    const ad = await createAd('pending');
    const token = signJwt({ adId: ad.id, action: 'approve_ad' }, '7d');

    const res = await request(app)
      .post(`/ads/${ad.id}/approve`)
      .query({ token })
      .set('Authorization', `Bearer ${verifiedNonAdminToken}`)
      .send({});

    expect(res.status).toBe(403);
    expect(String(res.body?.error || '')).toMatch(/admin only/i);
  });

  it('blocks unverified admins from using approval tokens', async () => {
    const ad = await createAd('pending');
    const token = signJwt({ adId: ad.id, action: 'approve_ad' }, '7d');

    const res = await request(app)
      .post(`/ads/${ad.id}/approve`)
      .query({ token })
      .set('Authorization', `Bearer ${unverifiedAdminToken}`)
      .send({});

    expect(res.status).toBe(403);
    expect(String(res.body?.error || '')).toMatch(/email verification required/i);
  });

  it('allows verified admins to approve with a valid token', async () => {
    const ad = await createAd('pending');
    const token = signJwt({ adId: ad.id, action: 'approve_ad' }, '7d');

    const res = await request(app)
      .post(`/ads/${ad.id}/approve`)
      .query({ token })
      .set('Authorization', `Bearer ${verifiedAdminToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Ad Approved/i);

    const updated = await prisma.ad.findUnique({ where: { id: ad.id } });
    expect(updated?.status).toBe('approved');
  });

  it('blocks unverified admins from reviewing through the dashboard endpoint', async () => {
    const ad = await createAd('pending');

    const res = await request(app)
      .post(`/ads/${ad.id}/review`)
      .set('Authorization', `Bearer ${unverifiedAdminToken}`)
      .send({ action: 'approve' });

    expect(res.status).toBe(403);
    expect(String(res.body?.error || '')).toMatch(/email verification required/i);
  });

  it('allows verified admins to review through the dashboard endpoint', async () => {
    const ad = await createAd('pending');

    const res = await request(app)
      .post(`/ads/${ad.id}/review`)
      .set('Authorization', `Bearer ${verifiedAdminToken}`)
      .send({ action: 'approve' });

    expect(res.status).toBe(200);
    expect(res.body?.status).toBe('approved');
  });

  // Per f1a7dd5c (product directive): all automated content filters removed.
  // Profane copy now goes through; reactive moderation via user reports
  // handles inappropriate content. Copy edits still flip ads to pending
  // review (covered by the next test) so admins see the new wording.
  it('does not pre-emptively reject profane description updates', async () => {
    const ad = await createAd('approved');

    const res = await request(app)
      .put(`/ads/${ad.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ description: 'This ad is fucking terrible.' });

    expect(res.status).toBe(200);
    expect(res.body?.code).not.toBe('PROFANITY');
  });

  it('returns approved ads to pending review when business copy changes', async () => {
    const ad = await createAd('approved', 'Original approved copy');

    const res = await request(app)
      .put(`/ads/${ad.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ description: 'Updated clean copy for the same business.' });

    expect(res.status).toBe(200);
    expect(res.body?.status).toBe('pending');
    expect(String(res.body?.admin_note || '')).toMatch(/content changed/i);
  });

  it('blocks unauthenticated /review requests', async () => {
    const ad = await createAd('pending');

    const res = await request(app)
      .post(`/ads/${ad.id}/review`)
      .send({ action: 'approve' });

    expect(res.status).toBe(401);
  });

  it('blocks verified non-admins from /review', async () => {
    const ad = await createAd('pending');

    const res = await request(app)
      .post(`/ads/${ad.id}/review`)
      .set('Authorization', `Bearer ${verifiedNonAdminToken}`)
      .send({ action: 'approve' });

    expect(res.status).toBe(403);
    expect(String(res.body?.error || '')).toMatch(/admin only/i);
  });

  // ── Banner moderation override tests ──
  // The moderation flow sets `banner_moderation_status` on the ad. When it's
  // 'flagged', approval requires a typed override reason. 'error' lets the
  // approval through but annotates admin_note. 'clean' / null is normal flow.

  async function createFlaggedAd() {
    return prisma.ad.create({
      data: {
        user_id: ownerId,
        contact_name: 'Ad Owner',
        contact_email: `ad-contact-${ts}@example.com`,
        business_name: `Flagged Biz ${ts}`,
        banner_url: 'https://example.com/flagged.jpg',
        target_url: 'https://example.com',
        target_zip_code: '10001',
        radius: 25,
        description: 'Clean copy',
        status: 'pending',
        payment_status: 'pending_approval',
        banner_moderation_status: 'flagged',
        banner_moderation_labels: [
          { name: 'Suggestive', parent_name: null, confidence: 88.2 },
          { name: 'Violence', parent_name: null, confidence: 72.1 },
        ],
        banner_moderation_score: 88.2,
        banner_moderation_provider: 'aws_rekognition',
        banner_moderation_error: null,
        banner_moderated_at: new Date(),
      } as any,
    });
  }

  async function createScanErrorAd() {
    return prisma.ad.create({
      data: {
        user_id: ownerId,
        contact_name: 'Ad Owner',
        contact_email: `ad-contact-${ts}@example.com`,
        business_name: `Scan Error Biz ${ts}`,
        banner_url: 'https://example.com/scan-error.jpg',
        target_url: 'https://example.com',
        target_zip_code: '10001',
        radius: 25,
        description: 'Clean copy',
        status: 'pending',
        payment_status: 'pending_approval',
        banner_moderation_status: 'error',
        banner_moderation_labels: null,
        banner_moderation_score: null,
        banner_moderation_provider: 'aws_rekognition',
        banner_moderation_error: 'Banner fetch failed with HTTP 500',
        banner_moderated_at: new Date(),
      } as any,
    });
  }

  it('blocks approval of a flagged banner when no override is provided (/review)', async () => {
    const ad = await createFlaggedAd();

    const res = await request(app)
      .post(`/ads/${ad.id}/review`)
      .set('Authorization', `Bearer ${verifiedAdminToken}`)
      .send({ action: 'approve' });

    expect(res.status).toBe(409);
    expect(String(res.body?.error || '')).toMatch(/banner_moderation_flag_requires_override/);
    expect(res.body?.moderation?.status).toBe('flagged');
    expect(Array.isArray(res.body?.moderation?.labels)).toBe(true);
    expect(res.body?.moderation?.labels?.[0]?.name).toBe('Suggestive');

    const fresh = await prisma.ad.findUnique({ where: { id: ad.id } });
    expect(fresh?.status).toBe('pending');
  });

  it('rejects a flagged-banner approval with a too-short override reason (/review)', async () => {
    const ad = await createFlaggedAd();

    const res = await request(app)
      .post(`/ads/${ad.id}/review`)
      .set('Authorization', `Bearer ${verifiedAdminToken}`)
      .send({ action: 'approve', override_banner_flag: true, override_reason: 'ok' });

    expect(res.status).toBe(409);
    expect(String(res.body?.error || '')).toMatch(/banner_moderation_flag_requires_override/);

    const fresh = await prisma.ad.findUnique({ where: { id: ad.id } });
    expect(fresh?.status).toBe('pending');
  });

  it('approves a flagged banner with a valid override reason and records it in admin_note (/review)', async () => {
    const ad = await createFlaggedAd();
    const reason = 'Reviewed by trust & safety team — banner is a sports action shot, not suggestive content.';

    const res = await request(app)
      .post(`/ads/${ad.id}/review`)
      .set('Authorization', `Bearer ${verifiedAdminToken}`)
      .send({ action: 'approve', override_banner_flag: true, override_reason: reason });

    expect(res.status).toBe(200);
    expect(res.body?.status).toBe('approved');

    const fresh = await prisma.ad.findUnique({ where: { id: ad.id } });
    expect(fresh?.status).toBe('approved');
    expect(fresh?.admin_note || '').toContain('moderation override');
    expect(fresh?.admin_note || '').toContain('Suggestive');
    expect(fresh?.admin_note || '').toContain(verifiedAdminId);
  });

  it('allows approval of an error-status banner and annotates admin_note (/review)', async () => {
    const ad = await createScanErrorAd();

    const res = await request(app)
      .post(`/ads/${ad.id}/review`)
      .set('Authorization', `Bearer ${verifiedAdminToken}`)
      .send({ action: 'approve' });

    expect(res.status).toBe(200);
    expect(res.body?.status).toBe('approved');

    const fresh = await prisma.ad.findUnique({ where: { id: ad.id } });
    expect(fresh?.status).toBe('approved');
    expect(fresh?.admin_note || '').toMatch(/Approved without successful scan/i);
    expect(fresh?.admin_note || '').toContain('Banner fetch failed');
  });

  it('allows rejection of a flagged banner without any override', async () => {
    const ad = await createFlaggedAd();

    const res = await request(app)
      .post(`/ads/${ad.id}/review`)
      .set('Authorization', `Bearer ${verifiedAdminToken}`)
      .send({ action: 'reject' });

    expect(res.status).toBe(200);
    expect(res.body?.status).toBe('draft');

    const fresh = await prisma.ad.findUnique({ where: { id: ad.id } });
    expect(fresh?.status).toBe('draft');
  });

  it('blocks flagged-banner approval on the token-POST path and re-renders the override form (HTML)', async () => {
    const ad = await createFlaggedAd();
    const token = signJwt({ adId: ad.id, action: 'approve_ad' }, '7d');

    const res = await request(app)
      .post(`/ads/${ad.id}/approve`)
      .query({ token })
      .set('Authorization', `Bearer ${verifiedAdminToken}`)
      .send({});

    expect(res.status).toBe(409);
    // The form should come back with the flag warning and override textarea.
    expect(res.text).toMatch(/Banner flagged by automated review/i);
    expect(res.text).toMatch(/override_reason/i);
    expect(res.text).toContain('Suggestive');

    const fresh = await prisma.ad.findUnique({ where: { id: ad.id } });
    expect(fresh?.status).toBe('pending');
  });

  it('approves a flagged banner via token-POST when a valid override is supplied', async () => {
    const ad = await createFlaggedAd();
    const token = signJwt({ adId: ad.id, action: 'approve_ad' }, '7d');
    const reason = 'Banner is a legitimate soccer photo; the flagged label is a false positive.';

    const res = await request(app)
      .post(`/ads/${ad.id}/approve`)
      .query({ token })
      .set('Authorization', `Bearer ${verifiedAdminToken}`)
      .send({ override_banner_flag: true, override_reason: reason });

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Ad Approved/i);

    const fresh = await prisma.ad.findUnique({ where: { id: ad.id } });
    expect(fresh?.status).toBe('approved');
    expect(fresh?.admin_note || '').toContain('moderation override');
  });

  it('rate-limits ad moderation after 30 calls in the window', async () => {
    // Hit the approve endpoint with a valid-format but non-existent ad ID using
    // the dedicated limiter admin. The limiter runs AFTER requireAdmin, so each
    // 404 still consumes the bucket. The 31st call should 429.
    const fakeId = 'c' + 'a'.repeat(24); // valid CUID shape for registerIdValidation

    let sawRateLimit = false;
    for (let i = 0; i < 31; i++) {
      const res = await request(app)
        .post(`/ads/${fakeId}/approve`)
        .set('Authorization', `Bearer ${limiterAdminToken}`)
        .send({});
      if (res.status === 429) {
        sawRateLimit = true;
        expect(String(res.body?.error || res.body?.message || '')).toMatch(/too many|slow down/i);
        break;
      }
      // Before the limit is hit, the handler should 404 on the missing ad —
      // anything other than 404 or 429 means the middleware chain is wrong.
      expect(res.status).toBe(404);
    }

    expect(sawRateLimit).toBe(true);
  }, 20000);
});
