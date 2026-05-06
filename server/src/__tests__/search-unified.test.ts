import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describe('Unified search', () => {
  let userId: string;
  let token: string;
  let organizationId: string;
  let teamId: string;
  let gameId: string;
  let eventId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        email: `search-unified-${ts}@example.com`,
        password_hash: passwordHash,
        display_name: 'Search Tester',
        username: `sut${String(ts).slice(-8)}`,
        email_verified: true,
        onboarding_completed: true,
        role: 'fan',
        approval_status: 'APPROVED',
        preferences: {
          role: 'fan',
          onboarding_completed: true,
        },
      },
    });
    userId = user.id;
    token = signJwt({ id: userId });

    const org = await prisma.organization.create({
      data: {
        name: `Search Org ${ts}`,
        admin_approved: true,
        status: 'active',
        league_owner_id: userId,
      },
      select: { id: true },
    });
    organizationId = org.id;

    const team = await prisma.team.create({
      data: {
        name: `Search Team ${ts}`,
        organization_id: organizationId,
        status: 'active',
        sport: 'Basketball',
      },
      select: { id: true },
    });
    teamId = team.id;

    const game = await prisma.game.create({
      data: {
        title: `Search Showcase ${ts}`,
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        location: 'Search Arena',
        approval_status: 'approved',
        created_by_id: userId,
        event_type: 'game',
        home_team_id: teamId,
      },
    });
    gameId = game.id;

    const event = await prisma.event.create({
      data: {
        title: `Search Pep Rally ${ts}`,
        date: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        location: 'Search Commons',
        status: 'approved',
        approval_status: 'approved',
        creator_id: userId,
        creator_role: 'coach',
      },
    });
    eventId = event.id;
  });

  afterAll(async () => {
    await prisma.event.deleteMany({ where: { id: eventId } }).catch(() => {});
    await prisma.game.deleteMany({ where: { id: gameId } }).catch(() => {});
    await prisma.team.deleteMany({ where: { id: teamId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: organizationId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
  });

  it('returns people, teams, organizations, games, and events from one query', async () => {
    const res = await request(app)
      .get('/search?q=Search')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body?.users?.some((row: any) => row.id === userId)).toBe(true);
    expect(res.body?.teams?.some((row: any) => row.id === teamId)).toBe(true);
    expect(res.body?.organizations?.some((row: any) => row.id === organizationId)).toBe(true);
    expect(res.body?.games?.some((row: any) => row.id === gameId)).toBe(true);
    expect(res.body?.events?.some((row: any) => row.id === eventId)).toBe(true);
  });
});
