/**
 * Regression: POST /teams/create org-approval/membership gate
 *
 * Guards the auto-create branch in teamsRouter.post('/create'). Before the fix,
 * an approved coach could omit organization_id, the server would silently mint a
 * fresh unapproved org + owner membership, and immediately attach a team under
 * it — bypassing the league-approval workflow. The fix:
 *   1. Refuses to mint a new org when the requester is fully onboarded (only
 *      onboarding flows are allowed to auto-create).
 *   2. Runs the same approval + membership validation regardless of how the
 *      organization_id was sourced (client-provided, name-match reuse, or
 *      auto-create), so the by-name-reuse path can no longer hijack an org.
 */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';
import { describeDb } from './dbTestGuard.js';
let prisma: any;
let signJwt: any;

const TEST_PASSWORD = 'TestPassword123!';

describeDb('POST /teams/create org gate', () => {
  let coachUserId: string;
  let coachToken: string;
  let approvedOwnedOrgId: string;
  let approvedForeignOrgId: string;
  let createdTeamIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const coach = await prisma.user.create({
      data: {
        email: `team-create-gate-coach-${Date.now()}@example.com`,
        password_hash: await bcrypt.hash(TEST_PASSWORD, 10),
        display_name: 'Gate Coach',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'coach',
          plan: 'rookie',
          onboarding_completed: true,
          coach_agreement_accepted_at: new Date().toISOString(),
        },
      },
    });
    coachUserId = coach.id;
    coachToken = signJwt({ id: coachUserId });

    // Org the coach owns and is approved for — happy path
    const owned = await prisma.organization.create({
      data: {
        name: `Gate Owned Org ${Date.now()}`,
        org_type: 'club',
        admin_approved: true,
        league_owner_id: coachUserId,
        updated_at: new Date(),
      },
    });
    approvedOwnedOrgId = owned.id;
    await prisma.organizationMembership.create({
      data: { organization_id: approvedOwnedOrgId, user_id: coachUserId, role: 'owner' },
    });

    // Org the coach is NOT a member of — used to prove the by-name-reuse hijack
    // is closed and that providing a foreign org_id is rejected.
    const foreign = await prisma.organization.create({
      data: {
        name: `Gate Foreign Org ${Date.now()}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
      },
    });
    approvedForeignOrgId = foreign.id;
  });

  afterAll(async () => {
    try {
      if (createdTeamIds.length > 0) {
        await prisma.teamMembership.deleteMany({ where: { team_id: { in: createdTeamIds } } });
        await prisma.team.deleteMany({ where: { id: { in: createdTeamIds } } });
      }
      await prisma.teamMembership.deleteMany({ where: { user_id: coachUserId } });
      await prisma.team.deleteMany({
        where: { organization_id: { in: [approvedOwnedOrgId, approvedForeignOrgId] } },
      });
      await prisma.organizationMembership.deleteMany({
        where: { organization_id: { in: [approvedOwnedOrgId, approvedForeignOrgId] } },
      });
      // Catch any leaked orgs the bug used to create — the fix should mean none exist.
      await prisma.organization.deleteMany({
        where: {
          OR: [
            { id: { in: [approvedOwnedOrgId, approvedForeignOrgId] } },
            { league_owner_id: coachUserId },
          ],
        },
      });
      await prisma.user.deleteMany({ where: { id: coachUserId } });
    } catch (err) {
      console.warn('cleanup error (non-critical):', err);
    }
  });

  it('rejects auto-create without organization_id for a fully-onboarded coach', async () => {
    const teamName = `Gate Auto Create ${Date.now()}`;
    const response = await request(app)
      .post('/teams/create')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: teamName })
      .expect(400);

    expect(response.body.code).toBe('ORGANIZATION_REQUIRED');

    // No org should have been created as a side effect.
    const leakedOrg = await prisma.organization.findFirst({
      where: { name: { equals: teamName, mode: 'insensitive' } },
      select: { id: true },
    });
    expect(leakedOrg).toBeNull();
  });

  it('rejects creating a team under an org the coach is not a member of', async () => {
    const response = await request(app)
      .post('/teams/create')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        name: `Gate Foreign Attach ${Date.now()}`,
        organization_id: approvedForeignOrgId,
      })
      .expect(403);

    expect(response.body.code).toBe('ORGANIZATION_MEMBERSHIP_REQUIRED');
  });

  it('rejects auto-create that would reuse an existing org by name when the coach is not a member', async () => {
    // Foreign org is "Gate Foreign Org <ts>" — passing organization_name triggers
    // the name-match reuse path inside the auto-create branch. Without the unified
    // membership gate, the coach would have hijacked the foreign org.
    const foreignOrg = await prisma.organization.findUnique({
      where: { id: approvedForeignOrgId },
      select: { name: true },
    });
    const response = await request(app)
      .post('/teams/create')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        name: `Gate Reuse Hijack ${Date.now()}`,
        organization_name: foreignOrg!.name,
      })
      .expect(403);

    expect(response.body.code).toBe('ORGANIZATION_MEMBERSHIP_REQUIRED');

    // No team should have been created under the foreign org.
    const leakedTeam = await prisma.team.findFirst({
      where: { organization_id: approvedForeignOrgId },
      select: { id: true },
    });
    expect(leakedTeam).toBeNull();
  });

  it('allows team creation with a valid org_id the coach owns (sanity)', async () => {
    const response = await request(app)
      .post('/teams/create')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        name: `Gate Happy Path ${Date.now()}`,
        organization_id: approvedOwnedOrgId,
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(response.body.team?.id).toBeDefined();
    expect(response.body.team.organization_id).toBe(approvedOwnedOrgId);
    createdTeamIds.push(response.body.team.id);
  });
});
