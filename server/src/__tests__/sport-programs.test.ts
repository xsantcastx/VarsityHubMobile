import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../app.js';

let prisma: any;
let signJwt: any;
const ts = Date.now();

describe('sport program endpoints', () => {
  let ownerId = '',
    memberCoachId = '',
    outsiderId = '';
  let ownerToken = '',
    memberCoachToken = '',
    outsiderToken = '';
  let orgId = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));
    const passwordHash = await bcrypt.hash('TestPassword123!', 10);
    const mkUser = async (label: string) => {
      const u = await prisma.user.create({
        data: {
          email: `programs-${label}-${ts}@example.com`,
          password_hash: passwordHash,
          display_name: `Programs ${label}`,
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
      return { id: u.id, token: signJwt({ id: u.id }) };
    };
    const owner = await mkUser('owner');
    ownerId = owner.id;
    ownerToken = owner.token;
    const member = await mkUser('member');
    memberCoachId = member.id;
    memberCoachToken = member.token;
    const outsider = await mkUser('outsider');
    outsiderId = outsider.id;
    outsiderToken = outsider.token;

    const org = await prisma.organization.create({
      data: {
        name: `Programs Org ${ts}`,
        org_type: 'school',
        admin_approved: true,
        updated_at: new Date(),
        league_owner_id: ownerId,
      },
    });
    orgId = org.id;
    await prisma.organizationMembership.createMany({
      data: [
        { organization_id: orgId, user_id: ownerId, role: 'owner', status: 'active' },
        { organization_id: orgId, user_id: memberCoachId, role: 'member', status: 'active' },
      ],
    });
  });

  afterAll(async () => {
    await prisma.team.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.sportProgram.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.organizationMembership
      .deleteMany({ where: { organization_id: orgId } })
      .catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    await prisma.user
      .deleteMany({ where: { id: { in: [ownerId, memberCoachId, outsiderId] } } })
      .catch(() => {});
  });

  it('org owner creates a program', async () => {
    const res = await request(app)
      .post(`/organizations/${orgId}/programs`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ sport: 'basketball', gender: 'girls' });
    expect(res.status).toBe(201);
    expect(res.body.program.sport).toBe('basketball');
    expect(res.body.program.gender).toBe('girls');
  });

  it('member coach of the org can create a program', async () => {
    const res = await request(app)
      .post(`/organizations/${orgId}/programs`)
      .set('Authorization', `Bearer ${memberCoachToken}`)
      .send({ sport: 'soccer', gender: 'boys' });
    expect(res.status).toBe(201);
  });

  it('duplicate (org, sport, gender) → 409 PROGRAM_EXISTS', async () => {
    const res = await request(app)
      .post(`/organizations/${orgId}/programs`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ sport: 'basketball', gender: 'girls' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('PROGRAM_EXISTS');
  });

  it('non-canonical sport → 400 INVALID_SPORT', async () => {
    const res = await request(app)
      .post(`/organizations/${orgId}/programs`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ sport: 'Basketball', gender: 'girls' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_SPORT');
  });

  it('outsider (no org membership) → 403', async () => {
    const res = await request(app)
      .post(`/organizations/${orgId}/programs`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ sport: 'tennis', gender: 'coed' });
    expect(res.status).toBe(403);
  });

  it('lists programs with their level teams', async () => {
    const prog = await prisma.sportProgram.findFirst({
      where: { organization_id: orgId, sport: 'basketball' },
    });
    await prisma.team.create({
      data: {
        name: `Programs Varsity ${ts}`,
        organization_id: orgId,
        program_id: prog.id,
        level: 'varsity',
      },
    });
    const res = await request(app)
      .get(`/organizations/${orgId}/programs`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    const basketball = res.body.programs.find((p: any) => p.sport === 'basketball');
    expect(basketball.teams.map((t: any) => t.level)).toContain('varsity');
  });

  it('team create accepts level + program_id and validates org match', async () => {
    const prog = await prisma.sportProgram.findFirst({
      where: { organization_id: orgId, sport: 'soccer' },
    });
    const ok = await request(app)
      .post('/teams/create')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Programs JV Soccer ${ts}`,
        organization_id: orgId,
        sport: 'Soccer',
        level: 'jv',
        program_id: prog.id,
      });
    expect(ok.status).toBe(201);
    expect(ok.body.team?.level ?? ok.body.level).toBe('jv');

    const otherOrg = await prisma.organization.create({
      data: {
        name: `Programs Other Org ${ts}`,
        org_type: 'school',
        admin_approved: true,
        updated_at: new Date(),
        league_owner_id: outsiderId,
      },
    });
    // createTeamWithGuardrails requires active org membership (league_owner_id
    // alone doesn't grant it) — outsider must be an active member of their own
    // org to reach the program_id validation this test exercises.
    await prisma.organizationMembership.create({
      data: { organization_id: otherOrg.id, user_id: outsiderId, role: 'owner', status: 'active' },
    });
    const mismatch = await request(app)
      .post('/teams/create')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({
        name: `Mismatch ${ts}`,
        organization_id: otherOrg.id,
        level: 'varsity',
        program_id: prog.id,
      });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error).toBe('PROGRAM_ORG_MISMATCH');
    await prisma.team.deleteMany({ where: { organization_id: otherOrg.id } }).catch(() => {});
    await prisma.organization.delete({ where: { id: otherOrg.id } }).catch(() => {});
  });
});
