/**
 * Regression: private-profile posts must be invisible to viewers who don't
 * follow the author, AND blocked-author posts must be invisible to the
 * blocker. Previously enforced in JS after fetching everything; now pushed
 * into the SQL where clause by `buildPostVisibilityWhere`.
 *
 * This suite exercises the real route: if the filter regresses (wrong
 * path, missing JSON field, accidental removal of the AND clause), a
 * private post leaks and the test fails.
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { app } from '../testApp.js';
import bcrypt from 'bcrypt';

let prisma: any;
let signJwt: any;

const shouldSkipDbTests = process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = shouldSkipDbTests ? describe.skip : describe;
const RUN_ID = `${Date.now()}-${randomUUID().slice(0, 6)}`;

describeDb('GET /posts visibility', () => {
  let privateAuthor: any;
  let publicAuthor: any;
  let follower: any;
  let stranger: any;
  let blocker: any;
  let privatePostId: string;
  let publicPostId: string;
  let followerToken: string;
  let strangerToken: string;
  let blockerToken: string;

  const makeUser = async (labelSuffix: string, extra: Record<string, any> = {}) => {
    const email = `posts-vis-${labelSuffix}-${RUN_ID}@example.com`;
    return prisma.user.create({
      data: {
        email,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: `Vis ${labelSuffix}`,
        email_verified: true,
        preferences: { role: 'fan', ...extra },
      },
    });
  };

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    privateAuthor = await makeUser('private-author', { profile_private: true });
    publicAuthor = await makeUser('public-author');
    follower = await makeUser('follower');
    stranger = await makeUser('stranger');
    blocker = await makeUser('blocker');

    followerToken = signJwt({ id: follower.id });
    strangerToken = signJwt({ id: stranger.id });
    blockerToken = signJwt({ id: blocker.id });

    const privatePost = await prisma.post.create({
      data: {
        author_id: privateAuthor.id,
        title: `Private post ${RUN_ID}`,
        content: 'private content',
      },
    });
    privatePostId = privatePost.id;

    const publicPost = await prisma.post.create({
      data: {
        author_id: publicAuthor.id,
        title: `Public post ${RUN_ID}`,
        content: 'public content',
      },
    });
    publicPostId = publicPost.id;

    // follower has an accepted follow on privateAuthor
    await prisma.follows.create({
      data: {
        follower_id: follower.id,
        following_id: privateAuthor.id,
        status: 'accepted',
      },
    });

    // blocker has blocked publicAuthor
    await prisma.blockedUser.create({
      data: { blocker_id: blocker.id, blocked_id: publicAuthor.id },
    });
  });

  afterAll(async () => {
    const userIds = [
      privateAuthor?.id,
      publicAuthor?.id,
      follower?.id,
      stranger?.id,
      blocker?.id,
    ].filter(Boolean);
    try {
      await prisma.blockedUser.deleteMany({
        where: { OR: [{ blocker_id: { in: userIds } }, { blocked_id: { in: userIds } }] },
      });
      await prisma.follows.deleteMany({
        where: { OR: [{ follower_id: { in: userIds } }, { following_id: { in: userIds } }] },
      });
      await prisma.post.deleteMany({
        where: { id: { in: [privatePostId, publicPostId].filter(Boolean) } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } catch (error) {
      console.warn('visibility cleanup warn:', error);
    }
  });

  const fetchIds = async (token?: string): Promise<string[]> => {
    const req = request(app).get('/posts').query({ limit: 50 });
    if (token) req.set('Authorization', `Bearer ${token}`);
    const res = await req.expect(200);
    const items: Array<{ id: string }> = res.body?.items ?? [];
    return items.map(p => p.id);
  };

  it('hides private-profile posts from anonymous viewers', async () => {
    const ids = await fetchIds();
    expect(ids).toContain(publicPostId);
    expect(ids).not.toContain(privatePostId);
  });

  it('hides private-profile posts from non-followers', async () => {
    const ids = await fetchIds(strangerToken);
    expect(ids).toContain(publicPostId);
    expect(ids).not.toContain(privatePostId);
  });

  it('shows private-profile posts to accepted followers', async () => {
    const ids = await fetchIds(followerToken);
    expect(ids).toContain(publicPostId);
    expect(ids).toContain(privatePostId);
  });

  it('hides posts from authors the viewer has blocked', async () => {
    const ids = await fetchIds(blockerToken);
    expect(ids).not.toContain(publicPostId);
    // The private author's post is hidden because blocker doesn't follow them.
    expect(ids).not.toContain(privatePostId);
  });
});
