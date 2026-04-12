import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

describe('API Tournament Endpoints', () => {
  let ownerId: string;
  let ownerToken: string;
  let intruderId: string;
  let intruderToken: string;
  let tournamentId: string;
  let teamId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const passwordHash = await bcrypt.hash('TestPassword123!', 10);
    const owner = await prisma.user.create({
      data: {
        email: `tournament-owner-${Date.now()}@example.com`,
        password_hash: passwordHash,
        email_verified: true,
        preferences: {},
      },
    });
    ownerId = owner.id;
    ownerToken = signJwt({ id: ownerId });

    const intruder = await prisma.user.create({
      data: {
        email: `tournament-intruder-${Date.now()}@example.com`,
        password_hash: passwordHash,
        email_verified: true,
        preferences: {},
      },
    });
    intruderId = intruder.id;
    intruderToken = signJwt({ id: intruderId });

    const createResponse = await request(app)
      .post('/tournaments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Spring Classic ${Date.now()}`,
        sport: 'basketball',
        season: '2026',
        location: 'Atlanta',
      })
      .expect(201);

    tournamentId = createResponse.body.id;

    const membership = await prisma.organizationMembership.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: tournamentId,
          user_id: ownerId,
        },
      } as any,
    });
    expect(membership).toMatchObject({
      organization_id: tournamentId,
      user_id: ownerId,
      role: 'owner',
    });

    const team = await prisma.team.create({
      data: {
        name: `Tournament Team ${Date.now()}`,
        memberships: {
          create: {
            user_id: ownerId,
            role: 'owner',
            status: 'active',
          },
        },
      },
    });
    teamId = team.id;
  });

  afterAll(async () => {
    await prisma.game.deleteMany({
      where: {
        OR: [{ home_team: 'Home Team' }, { away_team: 'Away Team' }],
      },
    });
    await prisma.team.deleteMany({
      where: { id: teamId },
    });
    await prisma.organization.deleteMany({
      where: { id: tournamentId },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [ownerId, intruderId] },
      },
    });
  });

  it('rejects non-owners from mutating tournaments', async () => {
    await request(app)
      .patch(`/tournaments/${tournamentId}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({ name: 'Hacked Tournament' })
      .expect(403);

    await request(app)
      .post(`/tournaments/${tournamentId}/teams`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({ team_id: teamId })
      .expect(403);

    await request(app)
      .post(`/tournaments/${tournamentId}/games`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({
        home_team: 'Home Team',
        away_team: 'Away Team',
        date: new Date().toISOString(),
      })
      .expect(403);
  });

  it('allows the tournament owner to update tournament details', async () => {
    const response = await request(app)
      .patch(`/tournaments/${tournamentId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Updated Tournament Name' })
      .expect(200);

    expect(response.body.name).toBe('Updated Tournament Name');
  });
});
