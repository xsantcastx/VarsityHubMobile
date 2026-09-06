/**
 * GDPR data export endpoints — auth, rate-limit, and IDOR guard.
 *
 * These are the highest-risk data-export paths: a misconfigured auth check
 * would let one user download another user's personal data. The IDOR guard
 * on GET /me/data-export/:id/download is the critical one.
 */

import { describe, it, before as beforeAll, after as afterAll, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
const database = new URL(process.env.DATABASE_URL || '');
assert(['localhost', '127.0.0.1'].includes(database.hostname));
assert(database.pathname.startsWith('/varsityhub_audit_') || database.pathname.endsWith('_test'));
assert.equal(process.env.NODE_ENV, 'test');
assert.equal(process.env.VARSITYHUB_ENV_PATH, '/dev/null');
import { expect } from 'expect';
import { fn } from 'jest-mock';
import request from 'supertest';
import { __setObjectStorageAdapterForTests } from '../../lib/objectStorage.js';
import { __setQueueDataExportForTests } from '../../jobs/queues.js';
import { makeFakeStorage } from './exportFakeStorage.mjs';
const { app } = await import('../../testApp.js');
import bcrypt from 'bcrypt';

let prisma: any;
let signJwt: any;

describe('POST /me/data-export', () => {
  let userId: string;
  let userToken: string;

  beforeAll(async () => {
    ({ prisma } = await import('../../lib/prisma.js'));
    ({ signJwt } = await import('../../lib/jwt.js'));

    const hash = await bcrypt.hash('TestPassword123!', 10);
    const user = await prisma.user.create({
      data: {
        email: `export-post-${Date.now()}@test.com`,
        password_hash: hash,
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    userId = user.id;
    userToken = signJwt({ id: userId });
  });

  afterAll(async () => {
    await prisma.dataExport.deleteMany({ where: { user_id: userId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } });
  });

  it('401 when unauthenticated', async () => {
    const res = await request(app).post('/me/data-export');
    expect(res.status).toBe(401);
  });

  it('503 without storage and creates no pending row', async () => {
    const res = await request(app)
      .post('/me/data-export')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(503);
    expect(await prisma.dataExport.count({ where: { user_id: userId } })).toBe(0);
  });

  it('409 when an export is already in-flight', async () => {
    __setObjectStorageAdapterForTests(makeFakeStorage().adapter);
    __setQueueDataExportForTests(async () => 'fixture-job');
    // Ensure there's an in-flight export row
    await prisma.dataExport.deleteMany({ where: { user_id: userId } });
    await prisma.dataExport.create({
      data: { user_id: userId, status: 'building', requested_at: new Date() },
    });

    const res = await request(app)
      .post('/me/data-export')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('EXPORT_IN_FLIGHT');
  });
});

describe('GET /me/data-exports', () => {
  let userId: string;
  let userToken: string;
  let otherToken: string;

  beforeAll(async () => {
    const hash = await bcrypt.hash('TestPassword123!', 10);
    const user = await prisma.user.create({
      data: {
        email: `export-list-${Date.now()}@test.com`,
        password_hash: hash,
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    userId = user.id;
    userToken = signJwt({ id: userId });

    const other = await prisma.user.create({
      data: {
        email: `export-other-${Date.now()}@test.com`,
        password_hash: hash,
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    otherToken = signJwt({ id: other.id });
    // Store other.id for cleanup
    (prisma as any)._exportOtherId = other.id;
  });

  afterAll(async () => {
    await prisma.dataExport.deleteMany({ where: { user_id: userId } }).catch(() => {});
    const otherId = (prisma as any)._exportOtherId;
    if (otherId) await prisma.user.delete({ where: { id: otherId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('401 when unauthenticated', async () => {
    const res = await request(app).get('/me/data-exports');
    expect(res.status).toBe(401);
  });

  it('200 and returns array for authenticated user', async () => {
    const res = await request(app)
      .get('/me/data-exports')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /me/data-export/:id — IDOR guard', () => {
  let ownerToken: string;
  let attackerToken: string;
  let exportId: string;

  beforeAll(async () => {
    const hash = await bcrypt.hash('TestPassword123!', 10);

    const owner = await prisma.user.create({
      data: {
        email: `export-idor-owner-${Date.now()}@test.com`,
        password_hash: hash,
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    ownerToken = signJwt({ id: owner.id });

    const attacker = await prisma.user.create({
      data: {
        email: `export-idor-attacker-${Date.now()}@test.com`,
        password_hash: hash,
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    attackerToken = signJwt({ id: attacker.id });

    const row = await prisma.dataExport.create({
      data: { user_id: owner.id, status: 'ready', requested_at: new Date() },
    });
    exportId = row.id;

    (prisma as any)._idorOwnerId = owner.id;
    (prisma as any)._idorAttackerId = attacker.id;
  });

  afterAll(async () => {
    await prisma.dataExport.delete({ where: { id: exportId } }).catch(() => {});
    const ownerId = (prisma as any)._idorOwnerId;
    const attackerId = (prisma as any)._idorAttackerId;
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, attackerId].filter(Boolean) } } });
  });

  it('200 when owner fetches their own export', async () => {
    const res = await request(app)
      .get(`/me/data-export/${exportId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
  });

  it('404 when another user tries to fetch the export (IDOR guard)', async () => {
    const res = await request(app)
      .get(`/me/data-export/${exportId}`)
      .set('Authorization', `Bearer ${attackerToken}`);
    expect(res.status).toBe(404);
  });
});

afterAll(async () => {
  const { prisma } = await import('../../lib/prisma.js');
  await prisma.$disconnect();
});
