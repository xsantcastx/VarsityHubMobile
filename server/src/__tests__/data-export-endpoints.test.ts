/**
 * GDPR data export — HTTP endpoint coverage.
 *
 * Covers:
 *   - Happy path: POST creates a pending row and enqueues
 *   - Rate limits: 409 EXPORT_IN_FLIGHT + 429 EXPORT_RATE_LIMITED with Retry-After
 *   - Ownership isolation: user B gets 404 (not 403) on user A's export
 *   - State matrix on download: 200/409/410/503 per export status
 *
 * The worker is not run in these tests — we seed DataExport rows directly
 * to the status we want and hit the endpoints. Worker behavior is covered
 * in data-export-worker-and-cron.test.ts.
 */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { prisma } from '../lib/prisma.js';
import { signJwt } from '../lib/jwt.js';
import { describeDb } from './dbTestGuard.js';

const mockQueueDataExport = jest.fn(async () => `test-job-${Date.now()}`);

jest.unstable_mockModule('../jobs/queues.js', () => ({
  queueDataExport: mockQueueDataExport,
}));

const { app } = await import('../testApp.js');

const ts = Date.now();
const PASSWORD = 'TestPassword123!';
describeDb('GDPR data export — HTTP endpoints', () => {
  let userAId: string;
  let userAToken: string;
  let userBId: string;
  let userBToken: string;

  beforeAll(async () => {
    mockQueueDataExport.mockClear();
    mockQueueDataExport.mockImplementation(async () => `test-job-${Date.now()}`);

    const hash = await bcrypt.hash(PASSWORD, 10);

    const userA = await prisma.user.create({
      data: {
        email: `export-a-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Export A',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    userAId = userA.id;
    userAToken = signJwt({ id: userAId });

    const userB = await prisma.user.create({
      data: {
        email: `export-b-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Export B',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    userBId = userB.id;
    userBToken = signJwt({ id: userBId });
  });

  afterAll(async () => {
    // Exports cascade on user delete.
    await prisma.user.delete({ where: { id: userAId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userBId } }).catch(() => {});
  });

  /** Clean user A's exports between tests that assert specific states. */
  async function wipeExports(userId: string) {
    await (prisma as any).dataExport.deleteMany({ where: { user_id: userId } });
  }

  // ── Happy path ─────────────────────────────────────────────────────────

  describe('POST /me/data-export (happy path)', () => {
    it('creates a pending row and returns 202 when no prior exports', async () => {
      await wipeExports(userAId);

      const res = await request(app)
        .post('/me/data-export')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({});

      expect(res.status).toBe(202);
      expect(res.body).toMatchObject({
        status: 'pending',
        download_count: 0,
      });
      expect(res.body.id).toBeTruthy();

      // Row is actually in the DB
      const row = await (prisma as any).dataExport.findUnique({
        where: { id: res.body.id },
      });
      expect(row).not.toBeNull();
      expect(row.user_id).toBe(userAId);
      expect(row.status).toBe('pending');
    });
  });

  // ── Rate limits ────────────────────────────────────────────────────────

  describe('POST /me/data-export (rate limits)', () => {
    it('returns 409 EXPORT_IN_FLIGHT when a pending row already exists', async () => {
      await wipeExports(userAId);
      await (prisma as any).dataExport.create({
        data: { user_id: userAId, status: 'pending' },
      });

      const res = await request(app)
        .post('/me/data-export')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('EXPORT_IN_FLIGHT');
      expect(res.body.status).toBe('pending');
    });

    it('returns 409 EXPORT_IN_FLIGHT when a building row already exists', async () => {
      await wipeExports(userAId);
      await (prisma as any).dataExport.create({
        data: { user_id: userAId, status: 'building', started_at: new Date() },
      });

      const res = await request(app)
        .post('/me/data-export')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('EXPORT_IN_FLIGHT');
      expect(res.body.status).toBe('building');
    });

    it('returns 429 EXPORT_RATE_LIMITED with Retry-After when a ready row is within 24h', async () => {
      await wipeExports(userAId);
      const requestedAt = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3h ago
      await (prisma as any).dataExport.create({
        data: {
          user_id: userAId,
          status: 'ready',
          requested_at: requestedAt,
          completed_at: new Date(),
          storage_key: 'exports/aa/userA/recent.zip',
          size_bytes: 1234,
          expires_at: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        },
      });

      const res = await request(app)
        .post('/me/data-export')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({});

      expect(res.status).toBe(429);
      expect(res.body.error).toBe('EXPORT_RATE_LIMITED');
      expect(res.body.retry_after_seconds).toBeGreaterThan(0);
      expect(res.headers['retry-after']).toBeTruthy();
    });

    it('allows a new export when the last ready row is older than 24h', async () => {
      await wipeExports(userAId);
      const requestedAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h ago
      await (prisma as any).dataExport.create({
        data: {
          user_id: userAId,
          status: 'ready',
          requested_at: requestedAt,
          completed_at: new Date(requestedAt.getTime() + 60 * 1000),
          storage_key: 'exports/aa/userA/old.zip',
          size_bytes: 1234,
          expires_at: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        },
      });

      const res = await request(app)
        .post('/me/data-export')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({});

      expect(res.status).toBe(202);
      expect(res.body.status).toBe('pending');
    });

    it('allows a new export when the prior row is failed (retries not rate-limited)', async () => {
      await wipeExports(userAId);
      await (prisma as any).dataExport.create({
        data: {
          user_id: userAId,
          status: 'failed',
          error_category: 'build_failed',
          requested_at: new Date(Date.now() - 30 * 60 * 1000),
        },
      });

      const res = await request(app)
        .post('/me/data-export')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({});

      expect(res.status).toBe(202);
    });
  });

  // ── Ownership isolation ────────────────────────────────────────────────

  describe('Ownership isolation (404 not 403 to prevent enumeration)', () => {
    let aExportId: string;

    beforeAll(async () => {
      await wipeExports(userAId);
      const row = await (prisma as any).dataExport.create({
        data: { user_id: userAId, status: 'pending' },
      });
      aExportId = row.id;
    });

    it('user B gets 404 on GET /me/data-export/:id belonging to user A', async () => {
      const res = await request(app)
        .get(`/me/data-export/${aExportId}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(res.status).toBe(404);
    });

    it('user B gets 404 on download endpoint for user A export', async () => {
      const res = await request(app)
        .get(`/me/data-export/${aExportId}/download`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(res.status).toBe(404);
    });

    it('user B gets 404 on DELETE for user A export', async () => {
      const res = await request(app)
        .delete(`/me/data-export/${aExportId}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(res.status).toBe(404);

      // Confirm row is untouched
      const stillThere = await (prisma as any).dataExport.findUnique({
        where: { id: aExportId },
      });
      expect(stillThere).not.toBeNull();
      expect(stillThere.status).toBe('pending');
    });

    it("GET /me/data-exports returns only the requester's rows", async () => {
      await (prisma as any).dataExport.create({
        data: { user_id: userBId, status: 'pending' },
      });

      const resA = await request(app)
        .get('/me/data-exports')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(resA.status).toBe(200);
      expect(Array.isArray(resA.body)).toBe(true);
      for (const row of resA.body) {
        // Response payload doesn't expose user_id, but ownership is
        // enforced at the query. The best we can do here is confirm A sees
        // its own export id and nothing else.
        expect(typeof row.id).toBe('string');
      }

      const idsSeenByA = resA.body.map((r: any) => r.id);
      expect(idsSeenByA).toContain(aExportId);

      const resB = await request(app)
        .get('/me/data-exports')
        .set('Authorization', `Bearer ${userBToken}`);
      const idsSeenByB = resB.body.map((r: any) => r.id);
      expect(idsSeenByB).not.toContain(aExportId);
    });
  });

  // ── Download state matrix ──────────────────────────────────────────────

  describe('GET /me/data-export/:id/download state-code mapping', () => {
    it('409 EXPORT_NOT_READY when status is pending', async () => {
      await wipeExports(userAId);
      const row = await (prisma as any).dataExport.create({
        data: { user_id: userAId, status: 'pending' },
      });
      const res = await request(app)
        .get(`/me/data-export/${row.id}/download`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('EXPORT_NOT_READY');
      expect(res.body.status).toBe('pending');
    });

    it('409 EXPORT_NOT_READY when status is building', async () => {
      await wipeExports(userAId);
      const row = await (prisma as any).dataExport.create({
        data: { user_id: userAId, status: 'building', started_at: new Date() },
      });
      const res = await request(app)
        .get(`/me/data-export/${row.id}/download`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('EXPORT_NOT_READY');
    });

    it('410 EXPORT_EXPIRED when status is expired', async () => {
      await wipeExports(userAId);
      const row = await (prisma as any).dataExport.create({
        data: {
          user_id: userAId,
          status: 'expired',
          completed_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          expires_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
      });
      const res = await request(app)
        .get(`/me/data-export/${row.id}/download`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(res.status).toBe(410);
      expect(res.body.error).toBe('EXPORT_EXPIRED');
    });

    it('503 EXPORT_FAILED when status is failed, surfaces error_category', async () => {
      await wipeExports(userAId);
      const row = await (prisma as any).dataExport.create({
        data: {
          user_id: userAId,
          status: 'failed',
          error_category: 'storage_not_configured',
        },
      });
      const res = await request(app)
        .get(`/me/data-export/${row.id}/download`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(res.status).toBe(503);
      expect(res.body.error).toBe('EXPORT_FAILED');
      expect(res.body.error_category).toBe('storage_not_configured');
    });
  });

  // ── DELETE ─────────────────────────────────────────────────────────────

  describe('DELETE /me/data-export/:id', () => {
    it('flips ready export to expired and clears storage_key', async () => {
      await wipeExports(userAId);
      const row = await (prisma as any).dataExport.create({
        data: {
          user_id: userAId,
          status: 'ready',
          completed_at: new Date(),
          storage_key: 'exports/aa/userA/delete-me.zip',
          size_bytes: 5000,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const res = await request(app)
        .delete(`/me/data-export/${row.id}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(res.status).toBe(204);

      const after = await (prisma as any).dataExport.findUnique({
        where: { id: row.id },
      });
      expect(after).not.toBeNull(); // Row preserved as audit record
      expect(after.status).toBe('expired');
      expect(after.storage_key).toBeNull();
      expect(after.size_bytes).toBeNull();
    });
  });
});
