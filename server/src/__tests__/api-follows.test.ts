/**
 * GET /follows/teams — auth and response shape
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';
import bcrypt from 'bcrypt';

let prisma: any;
let signJwt: any;

describe('GET /follows/teams', () => {
  let userId: string;
  let userToken: string;
  let otherUserId: string;
  let otherToken: string;
  let teamId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const hash = await bcrypt.hash('TestPassword123!', 10);

    const user = await prisma.user.create({
      data: {
        email: `follows-user-${Date.now()}@test.com`,
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
        email: `follows-other-${Date.now()}@test.com`,
        password_hash: hash,
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    otherUserId = other.id;
    otherToken = signJwt({ id: otherUserId });

    // Team requires an org
    const org = await prisma.organization.create({
      data: { name: `Follows Org ${Date.now()}`, admin_approved: true, league_owner_id: userId },
    });
    (prisma as any)._followsOrgId = org.id;

    const team = await prisma.team.create({
      data: { name: `Follows Test Team ${Date.now()}`, organization_id: org.id },
    });
    teamId = team.id;

    await prisma.teamFollow.create({
      data: { user_id: userId, team_id: teamId },
    });
  });

  afterAll(async () => {
    await prisma.teamFollow.deleteMany({ where: { user_id: userId } });
    await prisma.team.delete({ where: { id: teamId } }).catch(() => {});
    const orgId = (prisma as any)._followsOrgId;
    if (orgId) await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  });

  it('401 when unauthenticated', async () => {
    const res = await request(app).get('/follows/teams');
    expect(res.status).toBe(401);
  });

  it('returns followed teams for authenticated user', async () => {
    const res = await request(app)
      .get('/follows/teams')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const ids = res.body.map((t: any) => t.id);
    expect(ids).toContain(teamId);
  });

  it('403 when trying to view another user\'s follows', async () => {
    const res = await request(app)
      .get(`/follows/teams?user_id=${userId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });

  it('returns own follows when user_id=me', async () => {
    const res = await request(app)
      .get('/follows/teams?user_id=me')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
