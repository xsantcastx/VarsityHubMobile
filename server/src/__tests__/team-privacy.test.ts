/**
 * Team privacy (is_private) regression tests.
 *
 * Locks in:
 *   - PUT /teams/:id accepts is_private flag
 *   - GET /teams/:id returns 404 for private teams when viewer is not on the
 *     access list (member, follower, org admin, platform admin)
 *   - GET /teams/:id returns the team for any authorized viewer
 *   - GET /search hides private teams the viewer can't access
 *   - Public teams remain publicly visible end-to-end
 *
 * Mirrors the access-list shape used by canManageTeam / search so the same
 * boundary applies wherever a private team's existence could leak.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../testApp.js';

const __skipDbIntegrationSuites =
  String(process.env.CI ?? '').toLowerCase() === 'true' || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = __skipDbIntegrationSuites ? describe.skip : describe;



let prisma: any;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describeDb('Team Privacy (is_private)', () => {
  let orgId: string;
  let publicTeamId: string;
  let privateTeamId: string;
  let ownerId: string;
  let ownerToken: string;
  let memberId: string;
  let memberToken: string;
  let followerId: string;
  let followerToken: string;
  let orgManagerId: string;
  let orgManagerToken: string;
  let strangerId: string;
  let strangerToken: string;

  async function makeUser(prefix: string, prefs: Record<string, unknown> = {}) {
    const hash = await bcrypt.hash(PASSWORD, 10);
    const prefsRole = (prefs as any)?.role;
    const role = prefsRole === 'coach' || prefsRole === 'fan' ? prefsRole : undefined;
    return prisma.user.create({
      data: {
        email: `${prefix}-${ts}-${Math.random()}@example.com`,
        password_hash: hash,
        display_name: prefix,
        username: `${prefix}${Date.now()}`.slice(0, 20),
        email_verified: true,
        approval_status: 'APPROVED',
        date_of_birth: new Date('1990-01-01'),
        ...(role ? { role } : {}),
        onboarding_completed: true,
        preferences: { onboarding_completed: true, ...prefs },
      },
    });
  }

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const org = await prisma.organization.create({
      data: {
        name: `Privacy Test League ${ts}`,
        org_type: 'league',
        admin_approved: true,
        status: 'active',
        updated_at: new Date(),
      },
    });
    orgId = org.id;

    const publicTeam = await prisma.team.create({
      data: {
        name: `Public Team ${ts}`,
        organization_id: orgId,
        is_private: false,
      } as any,
    });
    publicTeamId = publicTeam.id;

    const privateTeam = await prisma.team.create({
      data: {
        name: `Private Team ${ts}`,
        organization_id: orgId,
        is_private: true,
      } as any,
    });
    privateTeamId = privateTeam.id;

    // Owner (team owner with full management role) — used to PATCH is_private.
    const owner = await makeUser('priv-owner', {
      role: 'coach',
      plan: 'rookie',
      coach_agreement_accepted_at: new Date().toISOString(),
    });
    ownerId = owner.id;
    ownerToken = signJwt({ id: ownerId });
    await prisma.teamMembership.create({
      data: { team_id: privateTeamId, user_id: ownerId, role: 'owner', status: 'active' },
    });
    await prisma.teamMembership.create({
      data: { team_id: publicTeamId, user_id: ownerId, role: 'owner', status: 'active' },
    });

    const member = await makeUser('priv-member', { role: 'fan' });
    memberId = member.id;
    memberToken = signJwt({ id: memberId });
    await prisma.teamMembership.create({
      data: { team_id: privateTeamId, user_id: memberId, role: 'player', status: 'active' },
    });

    const follower = await makeUser('priv-follower', { role: 'fan' });
    followerId = follower.id;
    followerToken = signJwt({ id: followerId });
    await prisma.teamFollow.create({
      data: { team_id: privateTeamId, user_id: followerId },
    });

    const orgManager = await makeUser('priv-orgmgr', {
      role: 'coach',
      plan: 'rookie',
      coach_agreement_accepted_at: new Date().toISOString(),
    });
    orgManagerId = orgManager.id;
    orgManagerToken = signJwt({ id: orgManagerId });
    await prisma.organizationMembership.create({
      data: { organization_id: orgId, user_id: orgManagerId, role: 'manager', status: 'active' },
    });

    const stranger = await makeUser('priv-stranger', { role: 'fan' });
    strangerId = stranger.id;
    strangerToken = signJwt({ id: strangerId });
  });

  afterAll(async () => {
    const userIds = [ownerId, memberId, followerId, orgManagerId, strangerId].filter(Boolean);
    await prisma.teamFollow.deleteMany({ where: { team_id: { in: [publicTeamId, privateTeamId] } } }).catch(() => {});
    await prisma.teamMembership.deleteMany({ where: { team_id: { in: [publicTeamId, privateTeamId] } } }).catch(() => {});
    await prisma.team.deleteMany({ where: { id: { in: [publicTeamId, privateTeamId] } } }).catch(() => {});
    await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
  });

  describeDb('GET /teams/:id', () => {
    it('public team is visible to a stranger', async () => {
      const res = await request(app)
        .get(`/teams/${publicTeamId}`)
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(publicTeamId);
      expect(res.body.is_private).toBe(false);
    });

    it('private team returns 404 to a stranger', async () => {
      const res = await request(app)
        .get(`/teams/${privateTeamId}`)
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(res.status).toBe(404);
    });

    it('private team returns 404 to unauthenticated viewers', async () => {
      const res = await request(app).get(`/teams/${privateTeamId}`);
      expect(res.status).toBe(404);
    });

    it('private team is visible to a team member', async () => {
      const res = await request(app)
        .get(`/teams/${privateTeamId}`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(privateTeamId);
      expect(res.body.is_private).toBe(true);
    });

    it('private team is visible to a team follower', async () => {
      const res = await request(app)
        .get(`/teams/${privateTeamId}`)
        .set('Authorization', `Bearer ${followerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(privateTeamId);
    });

    it('private team is visible to an org manager (no team membership)', async () => {
      const res = await request(app)
        .get(`/teams/${privateTeamId}`)
        .set('Authorization', `Bearer ${orgManagerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(privateTeamId);
    });
  });

  describeDb('GET /search', () => {
    it('public team appears in search for a stranger', async () => {
      const res = await request(app)
        .get(`/search?q=Public Team ${ts}`)
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.teams?.some((t: any) => t.id === publicTeamId)).toBe(true);
    });

    it('private team does NOT appear in search for a stranger', async () => {
      const res = await request(app)
        .get(`/search?q=Private Team ${ts}`)
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.teams?.some((t: any) => t.id === privateTeamId)).toBe(false);
    });

    it('private team DOES appear in search for a team member', async () => {
      const res = await request(app)
        .get(`/search?q=Private Team ${ts}`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(200);
      expect(res.body.teams?.some((t: any) => t.id === privateTeamId)).toBe(true);
    });

    it('private team DOES appear in search for an org manager', async () => {
      const res = await request(app)
        .get(`/search?q=Private Team ${ts}`)
        .set('Authorization', `Bearer ${orgManagerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.teams?.some((t: any) => t.id === privateTeamId)).toBe(true);
    });
  });

  describeDb('PUT /teams/:id is_private toggle', () => {
    it('team owner can flip is_private from true to false', async () => {
      const res = await request(app)
        .put(`/teams/${privateTeamId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ is_private: false });
      expect(res.status).toBe(200);
      const after = await prisma.team.findUnique({ where: { id: privateTeamId } });
      expect((after as any).is_private).toBe(false);
      // Restore so subsequent reads match other test expectations
      await prisma.team.update({ where: { id: privateTeamId }, data: { is_private: true } as any });
    });
  });
});
