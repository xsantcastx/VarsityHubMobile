import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describe('Game poll eligibility', () => {
  let userId: string;
  let token: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        email: `game-poll-eligibility-${ts}@example.com`,
        password_hash: passwordHash,
        display_name: 'Poll Tester',
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
  });

  afterAll(async () => {
    try {
      await prisma.gameVote.deleteMany({
        where: {
          OR: [{ user_id: userId }, { game: { created_by_id: userId } }],
        },
      });
      await prisma.event.deleteMany({ where: { creator_id: userId } }).catch(() => {});
      await prisma.game.deleteMany({ where: { created_by_id: userId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
    } catch (error) {
      console.warn('Cleanup error (non-critical):', error);
    }
  });

  it('rejects poll voting endpoints for non-competitive event types', async () => {
    const fundraiser = await prisma.game.create({
      data: {
        title: `Fundraiser ${ts}`,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        location: 'Test Gym',
        event_type: 'fundraiser',
        approval_status: 'approved',
        created_by_id: userId,
      },
    });

    await request(app)
      .get(`/games/${fundraiser.id}/votes/summary`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409)
      .expect(res => {
        expect(res.body?.code).toBe('POLL_NOT_AVAILABLE');
      });

    await request(app)
      .post(`/games/${fundraiser.id}/votes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ team: 'A' })
      .expect(409)
      .expect(res => {
        expect(res.body?.code).toBe('POLL_NOT_AVAILABLE');
      });

    await request(app)
      .delete(`/games/${fundraiser.id}/votes`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409)
      .expect(res => {
        expect(res.body?.code).toBe('POLL_NOT_AVAILABLE');
      });
  });

  it('omits non-competitive games from batch poll summaries', async () => {
    const competitive = await prisma.game.create({
      data: {
        title: `Competitive ${ts}`,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        location: 'Home Court',
        event_type: 'game',
        approval_status: 'approved',
        created_by_id: userId,
      },
    });
    const fundraiser = await prisma.game.create({
      data: {
        title: `Fundraiser Batch ${ts}`,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        location: 'Booster Club',
        event_type: 'fundraiser',
        approval_status: 'approved',
        created_by_id: userId,
      },
    });

    await prisma.gameVote.create({
      data: {
        game_id: competitive.id,
        user_id: userId,
        team: 'A',
      },
    });

    const res = await request(app)
      .get(`/games/votes-summary?ids=${competitive.id},${fundraiser.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body?.[competitive.id]?.teamA).toBe(1);
    expect(res.body?.[competitive.id]?.userVote).toBe('A');
    expect(res.body?.[fundraiser.id]).toBeUndefined();
  });

  it('rejects post polls outside competitive game contexts', async () => {
    const standalonePost = await prisma.post.create({
      data: {
        author_id: userId,
        content: `Standalone poll ${ts}`,
        type: 'post',
      },
    });

    await request(app)
      .post(`/posts/${standalonePost.id}/poll`)
      .set('Authorization', `Bearer ${token}`)
      .send({ options: ['One', 'Two'] })
      .expect(409)
      .expect(res => {
        expect(res.body?.code).toBe('POLL_NOT_AVAILABLE');
      });

    const fundraiser = await prisma.game.create({
      data: {
        title: `Fundraiser Poll ${ts}`,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        location: 'Booster Hall',
        event_type: 'fundraiser',
        approval_status: 'approved',
        created_by_id: userId,
      },
    });

    const fundraiserPost = await prisma.post.create({
      data: {
        author_id: userId,
        content: `Fundraiser post ${ts}`,
        type: 'post',
        game_id: fundraiser.id,
      },
    });

    const legacyPoll = await prisma.poll.create({
      data: {
        post_id: fundraiserPost.id,
        options: {
          create: [{ text: 'Option A' }, { text: 'Option B' }],
        },
      },
      include: { options: true },
    });

    await request(app)
      .post(`/posts/${fundraiserPost.id}/poll/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ option_id: legacyPoll.options[0].id })
      .expect(409)
      .expect(res => {
        expect(res.body?.code).toBe('POLL_NOT_AVAILABLE');
      });
  });
});
