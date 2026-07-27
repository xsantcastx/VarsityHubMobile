/**
 * GET /events?following=true scopes to the teams the authenticated viewer
 * follows — the Discover calendar surface (mirrors the same scope on
 * GET /games). Invariant: a follower sees their followed team's approved
 * events; a non-follower and a guest see none of them (never a global scan).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const suffix = String(ts).slice(-8);
const userIds: string[] = [];
const orgIds: string[] = [];
const teamIds: string[] = [];
const eventIds: string[] = [];

async function makeUser(tag: string) {
  const u = await prisma.user.create({
    data: {
      email: `efs-${tag}-${ts}@example.com`,
      username: `efs${tag}${suffix}`,
      password_hash: 'x',
      display_name: `EFS ${tag}`,
      email_verified: true,
      role: 'fan',
      onboarding_completed: true,
      approval_status: 'APPROVED',
      preferences: { role: 'fan', onboarding_completed: true },
    },
  });
  userIds.push(u.id);
  return u;
}

describe('GET /events following scope', () => {
  let followerToken: string;
  let strangerToken: string;
  let followedTeamId: string;
  let followedEventTitle: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const owner = await makeUser('owner');
    const follower = await makeUser('follower');
    const stranger = await makeUser('stranger');
    followerToken = signJwt({ id: follower.id });
    strangerToken = signJwt({ id: stranger.id });

    const org = await prisma.organization.create({
      data: {
        name: `EFS Org ${ts}`,
        league_owner_id: owner.id,
        admin_approved: true,
        approved_at: new Date(),
        supporting_document_url: 'https://example.com/d.pdf',
        updated_at: new Date(),
      },
    });
    orgIds.push(org.id);

    const team = await prisma.team.create({
      data: {
        name: `EFS Team ${suffix}`,
        organization_id: org.id,
        sport: 'soccer',
        status: 'active',
      },
    });
    teamIds.push(team.id);
    followedTeamId = team.id;

    // The follower follows the team; the stranger does not.
    await prisma.teamFollow.create({ data: { team_id: team.id, user_id: follower.id } });

    // An approved, upcoming, standalone (no game) event on the followed team.
    followedEventTitle = `EFS Practice ${suffix}`;
    const event = await prisma.event.create({
      data: {
        title: followedEventTitle,
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        location: 'Field 1',
        event_type: 'practice',
        team_id: team.id,
        creator_id: owner.id,
        status: 'approved',
        approval_status: 'approved',
      },
    });
    eventIds.push(event.id);
  });

  afterAll(async () => {
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.teamFollow.deleteMany({ where: { team_id: { in: teamIds } } });
    await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  const titles = (body: any): string[] => {
    const rows = Array.isArray(body) ? body : (body?.events ?? body?.items ?? []);
    return rows.map((e: any) => String(e.title));
  };

  it('returns the followed team’s event to a follower', async () => {
    const res = await request(app)
      .get('/events?following=true')
      .set('Authorization', `Bearer ${followerToken}`);
    expect(res.status).toBe(200);
    expect(titles(res.body)).toContain(followedEventTitle);
  });

  it('returns nothing to a viewer who follows no teams', async () => {
    const res = await request(app)
      .get('/events?following=true')
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(res.status).toBe(200);
    expect(titles(res.body)).not.toContain(followedEventTitle);
  });

  it('returns an empty list to a guest (no token)', async () => {
    const res = await request(app).get('/events?following=true');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body) ? res.body : (res.body?.events ?? [])).toEqual([]);
  });
});
