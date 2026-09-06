/** Expected-safe HTTP + PostgreSQL privacy regressions. Dedicated local DB only. */
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { makeListMediaHandler } from '../../src/routes/games.js';
import { app } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { signJwt } from '../../src/lib/jwt.js';

const destination = new URL(process.env.DATABASE_URL || '');
if (
  process.env.NODE_ENV !== 'test' ||
  !['127.0.0.1', 'localhost'].includes(destination.hostname) ||
  destination.pathname !== '/varsityhub_audit_20260905_fans'
)
  throw new Error('Exclusive loopback audit DB and test mode required');
const run = Date.now();
const users: string[] = [],
  games: string[] = [],
  events: string[] = [],
  teams: string[] = [];
let orgId: string | undefined;
let passed = 0;
const check = (name: string, condition: unknown) => {
  assert.ok(condition, name);
  passed++;
  console.log(JSON.stringify({ scenario: name, pass: true }));
};
const get = (url: string, userId?: string) => {
  const req = request(app).get(url);
  return userId ? req.set('Authorization', `Bearer ${signJwt({ id: userId })}`) : req;
};
const image = (name: string) =>
  `https://res.cloudinary.com/dxb5oq4fs/image/upload/${name}_${run}.jpg`;
async function user(name: string, privateProfile = false) {
  const row = await prisma.user.create({
    data: {
      email: `privacy-${name}-${run}@test.local`,
      role: 'fan',
      email_verified: true,
      onboarding_completed: true,
      date_of_birth: new Date('1990-01-01'),
      preferences: { profile_private: privateProfile },
    },
  });
  users.push(row.id);
  return row.id;
}
async function game(name: string, data: object = {}) {
  const row = await prisma.game.create({
    data: {
      title: `${name}_${run}`,
      date: new Date(Date.now() + 3600000),
      approval_status: 'approved',
      ...data,
    },
  });
  games.push(row.id);
  return row;
}
async function event(name: string, data: object = {}) {
  const row = await prisma.event.create({
    data: {
      title: `${name}_${run}`,
      date: new Date(Date.now() + 3600000),
      approval_status: 'approved',
      status: 'approved',
      creator_role: 'coach',
      ...data,
    },
  });
  events.push(row.id);
  return row;
}
try {
  const author = await user('private', true),
    viewer = await user('viewer'),
    publicAuthor = await user('public'),
    owner = await user('owner'),
    staff = await user('staff'),
    follower = await user('follower'),
    contributor = await user('contributor');
  const publicGame = await game('PUBLIC_GAME'),
    publicEvent = await event('PUBLIC_EVENT');
  for (const [kind, entity] of [
    ['games', publicGame],
    ['events', publicEvent],
  ] as const) {
    const privatePost = await prisma.post.create({
      data: {
        author_id: author,
        media_url: image('PRIVATE'),
        upvotes_count: 100,
        ...(kind === 'games' ? { game_id: entity.id } : { event_id: entity.id }),
      },
    });
    check(
      `${kind} private post denied`,
      (await get(`/posts/${privatePost.id}`, viewer)).status === 404
    );
    const generic = await get(`/og/${kind}/${entity.id}`);
    check(
      `${kind} private OG image denied with branded fallback`,
      generic.status === 200 &&
        !generic.text.includes(image('PRIVATE')) &&
        generic.text.includes('og:image')
    );
    await prisma.post.create({
      data: {
        author_id: publicAuthor,
        media_url: image('PUBLIC'),
        ...(kind === 'games' ? { game_id: entity.id } : { event_id: entity.id }),
      },
    });
    const visible = await get(`/og/${kind}/${entity.id}`);
    check(
      `${kind} visible OG candidate chosen before ranking`,
      visible.text.includes(image('PUBLIC')) &&
        !visible.text.includes(image('PRIVATE')) &&
        visible.headers['cache-control'] === 'no-store'
    );
  }
  const transitionPost = await prisma.post.create({
    data: {
      author_id: publicAuthor,
      game_id: publicGame.id,
      media_url: image('PRIVACY_TRANSITION'),
    },
  });
  check(
    'public author post visible before settings change',
    (await get(`/posts/${transitionPost.id}`, viewer)).status === 200
  );
  const savedPrivate = await request(app)
    .patch('/me/preferences')
    .set('Authorization', `Bearer ${signJwt({ id: publicAuthor })}`)
    .send({ profile_private: true });
  check(
    'privacy setting is confirmed by actual preference endpoint',
    savedPrivate.status === 200 && savedPrivate.body.preferences.profile_private === true
  );
  check(
    'independent viewer observes privacy change immediately',
    (await get(`/posts/${transitionPost.id}`, viewer)).status === 404
  );
  const restoredPublic = await request(app)
    .patch('/me/preferences')
    .set('Authorization', `Bearer ${signJwt({ id: publicAuthor })}`)
    .send({ profile_private: false });
  check(
    'public setting restores independent viewer access',
    restoredPublic.status === 200 &&
      (await get(`/posts/${transitionPost.id}`, viewer)).status === 200
  );

  const privateStory = await prisma.story.create({
    data: {
      game_id: publicGame.id,
      user_id: author,
      media_url: image('STORY'),
      expires_at: new Date(Date.now() + 3600000),
    },
  });
  for (const persona of [undefined, viewer])
    for (const path of ['stories', 'media']) {
      const read = await get(`/games/${publicGame.id}/${path}`, persona);
      check(
        `${path} private story hidden for ${persona ? 'stranger' : 'anonymous'}`,
        read.status === 200 && !JSON.stringify(read.body).includes(privateStory.id)
      );
    }
  await prisma.follows.create({
    data: { follower_id: viewer, following_id: author, status: 'pending' },
  });
  check(
    'pending follow cannot view story',
    !JSON.stringify((await get(`/games/${publicGame.id}/stories`, viewer)).body).includes(
      privateStory.id
    )
  );
  await prisma.follows.updateMany({
    where: { follower_id: viewer, following_id: author },
    data: { status: 'accepted' },
  });
  check(
    'accepted follow sees story',
    JSON.stringify((await get(`/games/${publicGame.id}/stories`, viewer)).body).includes(
      privateStory.id
    )
  );
  check(
    'author sees own story',
    JSON.stringify((await get(`/games/${publicGame.id}/stories`, author)).body).includes(
      privateStory.id
    )
  );
  for (const [blocker_id, blocked_id] of [
    [viewer, author],
    [author, viewer],
  ]) {
    await prisma.blockedUser.create({ data: { blocker_id, blocked_id } });
    check(
      `block ${blocker_id === viewer ? 'outbound' : 'inbound'} overrides accepted follow`,
      !JSON.stringify((await get(`/games/${publicGame.id}/stories`, viewer)).body).includes(
        privateStory.id
      )
    );
    await prisma.blockedUser.deleteMany({ where: { blocker_id, blocked_id } });
  }
  const oldVisible = await prisma.story.create({
    data: {
      game_id: publicGame.id,
      user_id: publicAuthor,
      media_url: image('OLD_VISIBLE'),
      created_at: new Date(Date.now() - 3600000),
      expires_at: null,
    },
  });
  await prisma.story.createMany({
    data: Array.from({ length: 55 }, (_, index) => ({
      game_id: publicGame.id,
      user_id: author,
      media_url: image(`HIDDEN_${index}`),
      expires_at: new Date(Date.now() + 3600000),
    })),
  });
  await prisma.story.create({
    data: {
      game_id: publicGame.id,
      user_id: publicAuthor,
      media_url: 'local-expired-fixture',
      expires_at: new Date(Date.now() - 1000),
    },
  });
  const page = await get(`/games/${publicGame.id}/stories`);
  check(
    'story privacy and expiry filter before newest50 limit',
    page.status === 200 && page.body.length === 1 && page.body[0].id === oldVisible.id
  );

  // Exercise the actual parameterized legacy SQL against PostgreSQL; only
  // inject the historical missing-location error at the Prisma page query.
  const legacyDb = new Proxy(prisma, {
    get(target, key) {
      if (key === 'story')
        return {
          ...target.story,
          findMany: async (args: any) => {
            if (args.orderBy)
              throw { code: 'P2022', meta: { modelName: 'Story', column: 'Story.lat' } };
            return target.story.findMany(args);
          },
        };
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const legacyApp = express();
  legacyApp.get('/:id', makeListMediaHandler({ prisma: legacyDb }));
  const legacyPage = await request(legacyApp).get(`/${publicGame.id}`);
  check(
    'legacy SQL hides private authors before limit with real PostgreSQL',
    legacyPage.status === 200 &&
      legacyPage.body.length === 1 &&
      legacyPage.body[0].id === oldVisible.id
  );
  const videoGame = await game('VIDEO_WITHOUT_POSTER');
  const videoUrl = `https://res.cloudinary.com/dxb5oq4fs/video/upload/video_${run}.mp4`;
  await prisma.post.create({
    data: { author_id: publicAuthor, game_id: videoGame.id, media_url: videoUrl },
  });
  const videoOg = await get(`/og/games/${videoGame.id}`);
  check(
    'video without poster uses branded image',
    videoOg.status === 200 && videoOg.text.includes('og:image') && !videoOg.text.includes(videoUrl)
  );

  const org = await prisma.organization.create({
    data: {
      name: `PRIVATE_ORG_${run}`,
      org_type: 'club',
      admin_approved: true,
      updated_at: new Date(),
      league_owner_id: owner,
    },
  });
  orgId = org.id;
  const team = await prisma.team.create({
    data: { name: `PRIVATE_TEAM_${run}`, organization_id: org.id, is_private: true },
  });
  teams.push(team.id);
  await prisma.teamMembership.create({
    data: { user_id: staff, team_id: team.id, role: 'assistant_coach', status: 'active' },
  });
  await prisma.teamFollow.create({ data: { user_id: follower, team_id: team.id } });
  const homeGame = await game('SECRET_HOME', { home_team_id: team.id, created_by_id: owner }),
    awayGame = await game('SECRET_AWAY', { away_team_id: team.id, created_by_id: owner });
  const directEvent = await event('SECRET_EVENT', { team_id: team.id, creator_id: owner }),
    linkedEvent = await event('SECRET_LINKED', { game_id: awayGame.id, creator_id: owner });
  await prisma.post.create({
    data: { author_id: contributor, game_id: homeGame.id, media_url: image('CONTRIBUTOR') },
  });
  await prisma.post.create({
    data: { author_id: contributor, event_id: directEvent.id, media_url: image('CONTRIBUTOR') },
  });
  for (const entity of [homeGame, awayGame])
    for (const persona of [undefined, viewer])
      for (const suffix of ['', '/summary', '/stories', '/media', '/posts', '/votes/summary']) {
        const read = await get(`/games/${entity.id}${suffix}`, persona);
        check(
          `private ${entity.id === homeGame.id ? 'home' : 'away'} game ${suffix || 'detail'} ${persona ? 'stranger' : 'anonymous'}`,
          read.status === 404
        );
      }
  for (const entity of [directEvent, linkedEvent])
    for (const persona of [undefined, viewer])
      for (const suffix of ['', '/rsvp', '/votes/summary'])
        check(
          `private ${entity.id === directEvent.id ? 'direct' : 'linked'} event ${suffix || 'detail'} ${persona ? 'stranger' : 'anonymous'}`,
          (await get(`/events/${entity.id}${suffix}`, persona)).status === 404
        );
  for (const [kind, entity] of [
    ['games', homeGame],
    ['games', awayGame],
    ['events', directEvent],
    ['events', linkedEvent],
  ] as const)
    for (const landing of ['og', 'share']) {
      const path = landing === 'og' ? `/og/${kind}/${entity.id}` : `/${kind}/${entity.id}`;
      const read = await get(path).set('Accept', 'text/html');
      check(
        `${landing} private ${entity.title} generic`,
        read.status === 200 && !read.text.includes(entity.title)
      );
    }
  for (const [name, persona] of [
    ['owner', owner],
    ['assistant', staff],
    ['team follower', follower],
  ] as const)
    for (const [kind, entity] of [
      ['games', homeGame],
      ['events', directEvent],
      ['events', linkedEvent],
    ] as const)
      check(
        `${name} can view ${entity.title}`,
        (await get(`/${kind}/${entity.id}`, persona)).status === 200
      );
  check(
    'permanent contributor game access',
    (await get(`/games/${homeGame.id}`, contributor)).status === 200
  );
  check(
    'permanent contributor media access',
    (await get(`/games/${homeGame.id}/stories`, contributor)).status === 200
  );
  check(
    'permanent contributor event access',
    (await get(`/events/${directEvent.id}`, contributor)).status === 200
  );
  check(
    'private game absent from vote batch',
    !JSON.stringify((await get(`/games/votes-summary?ids=${homeGame.id}`, viewer)).body).includes(
      homeGame.id
    )
  );
  check(
    'private event absent from RSVP batch',
    !JSON.stringify(
      (await get(`/events/rsvp-summary?ids=${directEvent.id}`, viewer)).body
    ).includes(directEvent.id)
  );
  check(
    'private game vote rejected',
    (
      await request(app)
        .post(`/games/${homeGame.id}/votes`)
        .set('Authorization', `Bearer ${signJwt({ id: viewer })}`)
        .send({ team: 'A' })
    ).status === 404
  );
  check(
    'private event RSVP rejected',
    (
      await request(app)
        .post(`/events/${directEvent.id}/rsvp`)
        .set('Authorization', `Bearer ${signJwt({ id: viewer })}`)
        .send({ going: true })
    ).status === 404
  );
  const pending = await game('OPPONENT_PENDING', { opponent_approval_status: 'pending' }),
    linkedPending = await event('LINKED_PENDING', { game_id: pending.id });
  check(
    'linked event enforces opponent consent',
    (await get(`/events/${linkedPending.id}`, viewer)).status === 404
  );
  check('public game remains visible', (await get(`/games/${publicGame.id}`)).status === 200);
  console.log(JSON.stringify({ total: passed, result: 'PASS' }));
} finally {
  await prisma.post.deleteMany({ where: { author_id: { in: users } } });
  await prisma.event.deleteMany({ where: { id: { in: events } } });
  await prisma.game.deleteMany({ where: { id: { in: games } } });
  await prisma.team.deleteMany({ where: { id: { in: teams } } });
  if (orgId) await prisma.organization.delete({ where: { id: orgId } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
}
process.exit(0);
