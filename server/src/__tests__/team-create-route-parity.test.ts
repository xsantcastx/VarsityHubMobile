/**
 * POST /teams and POST /teams/create must accept the same team payload.
 *
 * Both routes funnel into `createTeamWithGuardrails`, but they parsed with
 * different Zod schemas. The `POST /teams` schema omitted `sport`, `club_type`,
 * `city`, `state`, `league`, `logo_url`, `season`, `primary_color` and the
 * venue fields — Zod strips unknown keys, so those arrived as `undefined` and
 * the route answered 201 while silently discarding them. The most visible
 * symptom: `sport` was dropped, so every team created here was filed under the
 * organization's `other` program instead of its real sport.
 *
 * Invariant: the two create routes share one schema. `POST /teams` keeps its
 * stricter contract (organization_id is required there); everything else is
 * accepted and persisted identically.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const suffix = String(ts).slice(-8);

describe('team create route parity', () => {
  let coachId: string;
  let coachToken: string;
  let orgId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const coach = await prisma.user.create({
      data: {
        email: `tcrp-${ts}@example.com`,
        username: `tcrp${suffix}`,
        password_hash: 'x',
        display_name: 'TCRP Coach',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        coach_agreement_accepted_at: new Date(),
        coach_agreement_version: Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1),
        plan: 'rookie',
        preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
      },
    });
    coachId = coach.id;
    coachToken = signJwt({ id: coachId });

    const org = await prisma.organization.create({
      data: {
        name: `TCRP League ${ts}`,
        league_owner_id: coachId,
        admin_approved: true,
        approved_at: new Date(),
        supporting_document_url: 'https://example.com/doc.pdf',
        updated_at: new Date(),
      },
    });
    orgId = org.id;
    await prisma.organizationMembership.create({
      data: { organization_id: orgId, user_id: coachId, role: 'owner', status: 'active' },
    });
  });

  afterAll(async () => {
    const teams = await prisma.team.findMany({
      where: { organization_id: orgId },
      select: { id: true },
    });
    const teamIds = teams.map((t: any) => t.id);
    await prisma.groupChatMember.deleteMany({ where: { chat: { team_id: { in: teamIds } } } });
    await prisma.groupChat.deleteMany({ where: { team_id: { in: teamIds } } });
    await prisma.teamInvite.deleteMany({ where: { team_id: { in: teamIds } } });
    await prisma.teamMembership.deleteMany({ where: { team_id: { in: teamIds } } });
    await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
    await prisma.sportProgram.deleteMany({ where: { organization_id: orgId } });
    await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: coachId } });
  });

  it('persists sport (and files the team under the real sport program) via POST /teams', async () => {
    const res = await request(app)
      .post('/teams')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        name: `TCRP Legacy ${suffix}`,
        sport: 'basketball',
        organization_id: orgId,
        city: 'Brooklyn',
        state: 'NY',
      });

    expect(res.status).toBe(201);

    const team = await prisma.team.findUnique({
      where: { id: res.body.id },
      select: { sport: true, city: true, state: true, program: { select: { sport: true } } },
    });
    expect(team.sport).toBe('basketball');
    expect(team.city).toBe('Brooklyn');
    expect(team.state).toBe('NY');
    expect(team.program.sport).toBe('basketball');
  });

  it('keeps organization_id required on POST /teams', async () => {
    const res = await request(app)
      .post('/teams')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: `TCRP No Org ${suffix}`, sport: 'soccer' });

    expect(res.status).toBe(400);
  });
});
