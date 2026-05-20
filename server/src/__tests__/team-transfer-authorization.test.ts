import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../teamGateTestApp.js';
import { describeDb } from './dbTestGuard.js';
let prisma: any;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describeDb('Team transfer authorization boundaries', () => {
  let moverId = '';
  let moverToken = '';
  let sourceOrgId = '';
  let targetOrgId = '';
  let teamId = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    const mover = await prisma.user.create({
      data: {
        email: `team-transfer-mover-${ts}@example.com`,
        password_hash: passwordHash,
        display_name: 'Team Transfer Mover',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        date_of_birth: new Date('1990-01-01'),
        preferences: {
          role: 'coach',
          plan: 'rookie',
          onboarding_completed: true,
          coach_agreement_accepted_at: new Date().toISOString(),
        },
      },
    });
    moverId = mover.id;
    moverToken = signJwt({ id: mover.id });

    const sourceOrg = await prisma.organization.create({
      data: {
        name: `Team Transfer Source Org ${ts}`,
        org_type: 'club',
        admin_approved: true,
        league_owner_id: mover.id,
        updated_at: new Date(),
      },
    });
    sourceOrgId = sourceOrg.id;

    const targetOrg = await prisma.organization.create({
      data: {
        name: `Team Transfer Target Org ${ts}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
      },
    });
    targetOrgId = targetOrg.id;

    await prisma.organizationMembership.createMany({
      data: [
        { organization_id: sourceOrg.id, user_id: mover.id, role: 'owner', status: 'active' },
        { organization_id: targetOrg.id, user_id: mover.id, role: 'coach', status: 'active' },
      ],
    });

    const team = await prisma.team.create({
      data: {
        name: `Team Transfer Team ${ts}`,
        organization_id: sourceOrg.id,
      },
    });
    teamId = team.id;

    await prisma.teamMembership.create({
      data: {
        team_id: team.id,
        user_id: mover.id,
        role: 'owner',
        status: 'active',
      },
    });
  });

  afterAll(async () => {
    await prisma.teamMembership.deleteMany({ where: { team_id: teamId } }).catch(() => {});
    await prisma.team.deleteMany({ where: { id: teamId } }).catch(() => {});
    await prisma.organizationMembership.deleteMany({
      where: { organization_id: { in: [sourceOrgId, targetOrgId].filter(Boolean) } },
    }).catch(() => {});
    await prisma.organization.deleteMany({
      where: { id: { in: [sourceOrgId, targetOrgId].filter(Boolean) } },
    }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [moverId].filter(Boolean) } } }).catch(() => {});
  });

  it('blocks moving a team into a target org when requester is only a non-admin member there', async () => {
    const res = await request(app)
      .put(`/teams/${teamId}`)
      .set('Authorization', `Bearer ${moverToken}`)
      .send({ organization_id: targetOrgId });

    expect(res.status).toBe(403);
    expect(res.body?.error).toBe('ORGANIZATION_ADMIN_REQUIRED');

    const refreshed = await prisma.team.findUnique({
      where: { id: teamId },
      select: { organization_id: true },
    });
    expect(refreshed?.organization_id).toBe(sourceOrgId);
  });
});
