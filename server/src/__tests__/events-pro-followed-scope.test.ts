/**
 * GET /events?pro_followed=true scopes to the PRO teams the authenticated
 * viewer follows (ProTeamFollow), surfacing those franchises' upcoming games in
 * the feed. Mirrors the ?following=true scope (which reads TeamFollow) but on
 * the separate pro-follow ledger. Invariant: a follower sees their followed pro
 * team's approved game; a non-follower and a guest see none of them (never a
 * global scan).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const suffix = String(ts).slice(-8);
const userIds: string[] = [];
const proTeamIds: string[] = [];
const eventIds: string[] = [];

async function makeUser(tag: string) {
  const u = await prisma.user.create({
    data: {
      email: `epf-${tag}-${ts}@example.com`,
      username: `epf${tag}${suffix}`,
      password_hash: 'x',
      display_name: `EPF ${tag}`,
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

describe('GET /events pro_followed scope', () => {
  let followerToken: string;
  let strangerToken: string;
  let followedEventTitle: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const follower = await makeUser('follower');
    const stranger = await makeUser('stranger');
    followerToken = signJwt({ id: follower.id });
    strangerToken = signJwt({ id: stranger.id });

    const proTeam = await prisma.proTeam.create({
      data: {
        external_ref: `nfl:epf-test-${suffix}`,
        league: 'nfl',
        name: `EPF Test Franchise ${suffix}`,
        short_name: 'EPFs',
        venue_lat: 40.8135,
        venue_lng: -74.0745,
      },
    });
    proTeamIds.push(proTeam.id);

    // The follower follows the pro team; the stranger does not.
    await prisma.proTeamFollow.create({
      data: { pro_team_id: proTeam.id, user_id: follower.id },
    });

    // An approved, upcoming, teamless (no game) pro Event — the exact shape the
    // schedule ingester writes: creator_id null, pro_home_team_id set.
    followedEventTitle = `EPF at EPFs ${suffix}`;
    const event = await prisma.event.create({
      data: {
        title: followedEventTitle,
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        location: 'MetLife Stadium',
        latitude: 40.8135,
        longitude: -74.0745,
        event_type: 'game',
        pro_home_team_id: proTeam.id,
        status: 'approved',
        approval_status: 'approved',
      },
    });
    eventIds.push(event.id);
  });

  afterAll(async () => {
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.proTeamFollow.deleteMany({ where: { pro_team_id: { in: proTeamIds } } });
    await prisma.proTeam.deleteMany({ where: { id: { in: proTeamIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  const titles = (body: any): string[] => {
    const rows = Array.isArray(body) ? body : (body?.events ?? body?.items ?? []);
    return rows.map((e: any) => String(e.title));
  };

  it('returns the followed pro team’s game to a follower', async () => {
    const res = await request(app)
      .get('/events?pro_followed=true&pro_only=true&event_only=true')
      .set('Authorization', `Bearer ${followerToken}`);
    expect(res.status).toBe(200);
    expect(titles(res.body)).toContain(followedEventTitle);
  });

  it('returns nothing to a viewer who follows no pro teams', async () => {
    const res = await request(app)
      .get('/events?pro_followed=true&pro_only=true&event_only=true')
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(res.status).toBe(200);
    expect(titles(res.body)).not.toContain(followedEventTitle);
  });

  it('returns an empty list to a guest (no token)', async () => {
    const res = await request(app).get('/events?pro_followed=true&pro_only=true&event_only=true');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body) ? res.body : (res.body?.events ?? [])).toEqual([]);
  });
});
