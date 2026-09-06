/** Two-process privacy revocation regression using dedicated local PostgreSQL + Redis. */
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { signJwt } from '../../src/lib/jwt.js';
import { cacheDel, cacheGet, cacheSet } from '../../src/lib/cache.js';

const destination = new URL(process.env.DATABASE_URL || '');
const redisUrl = new URL(process.env.REDIS_URL || '');
if (
  process.env.NODE_ENV !== 'test' ||
  !['127.0.0.1', 'localhost'].includes(destination.hostname) ||
  destination.pathname !== '/varsityhub_audit_20260905_fans' ||
  redisUrl.hostname !== '127.0.0.1' ||
  redisUrl.port !== '6398'
)
  throw new Error('Exclusive loopback audit DB and dedicated Redis port6398 required');
const policy = await import(
  process.env.AUDIT_LEGACY_PRIVACY_MODULE || '../../src/lib/privacyUtils.js'
);
let queries = 0;
prisma.$use(async (params, next) => {
  queries++;
  return next(params);
});
if (process.argv.includes('worker')) {
  process.on('message', async (message: any) => {
    try {
      queries = 0;
      const start = performance.now();
      let result: unknown;
      if (message.action === 'read') {
        result = await Promise.all([
          policy.getExcludedPrivateAuthorIds(message.viewer),
          policy.getExcludedPrivateTeamIds(message.viewer),
          policy.getBlockedUserIds(message.viewer),
        ]);
      } else if (message.action === 'mutate') {
        await prisma.user.update({
          where: { id: message.author },
          data: { preferences: { profile_private: true } },
        });
        await prisma.team.update({ where: { id: message.team }, data: { is_private: true } });
        await prisma.blockedUser.create({
          data: { blocker_id: message.author, blocked_id: message.viewer },
        });
        policy.invalidatePrivateIdsCache();
        policy.invalidatePrivateTeamIdsCache();
        policy.invalidateBlockedIdsCache(message.viewer);
        result = true;
      } else if (message.action === 'http') {
        let call = request(app).get(message.path);
        if (message.viewer)
          call = call.set('Authorization', `Bearer ${signJwt({ id: message.viewer })}`);
        const response = await call;
        result = { status: response.status, body: response.body };
      }
      process.send?.({
        nonce: message.nonce,
        result,
        queries,
        elapsedMs: performance.now() - start,
      });
    } catch (error) {
      process.send?.({ nonce: message.nonce, error: String(error) });
    }
  });
  process.send?.({ ready: true });
} else {
  const children: ReturnType<typeof fork>[] = [];
  let org: string | undefined;
  let author: string | undefined,
    viewer: string | undefined,
    team: string | undefined,
    game: string | undefined;
  let nonce = 0,
    passed = 0;
  const check = (name: string, value: unknown) => {
    assert.ok(value, name);
    passed++;
    console.log(JSON.stringify({ scenario: name, pass: true }));
  };
  const makeWorker = async () => {
    const child = fork(fileURLToPath(import.meta.url), ['worker'], {
      execArgv: process.execArgv,
      env: process.env,
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    });
    children.push(child);
    await new Promise<void>((resolve, reject) => {
      child.once('message', () => resolve());
      child.once('error', reject);
    });
    return child;
  };
  const call = (child: ReturnType<typeof fork>, message: object): Promise<any> =>
    new Promise((resolve, reject) => {
      const id = ++nonce;
      const timeout = setTimeout(() => reject(new Error('Worker timeout')), 20000);
      const listener = (response: any) => {
        if (response.nonce !== id) return;
        clearTimeout(timeout);
        child.off('message', listener);
        response.error ? reject(new Error(response.error)) : resolve(response);
      };
      child.on('message', listener);
      child.send({ ...message, nonce: id });
    });
  try {
    const run = Date.now();
    author = (
      await prisma.user.create({
        data: {
          email: `redis-author-${run}@test.local`,
          role: 'fan',
          email_verified: true,
          onboarding_completed: true,
          preferences: { profile_private: false },
        },
      })
    ).id;
    viewer = (
      await prisma.user.create({
        data: {
          email: `redis-viewer-${run}@test.local`,
          role: 'fan',
          email_verified: true,
          onboarding_completed: true,
        },
      })
    ).id;
    org = (
      await prisma.organization.create({
        data: { name: `REDIS_ORG_${run}`, org_type: 'club', updated_at: new Date() },
      })
    ).id;
    team = (
      await prisma.team.create({
        data: { name: `REDIS_TEAM_${run}`, organization_id: org, is_private: false },
      })
    ).id;
    game = (
      await prisma.game.create({
        data: {
          title: `REDIS_GAME_${run}`,
          date: new Date(Date.now() + 3600000),
          home_team_id: team,
          approval_status: 'approved',
        },
      })
    ).id;
    const reader = await makeWorker(),
      writer = await makeWorker();
    await cacheSet(`privacy:audit:${run}`, { ready: true }, 60);
    check('real Redis roundtrip', (await cacheGet<any>(`privacy:audit:${run}`))?.ready === true);
    await cacheDel('privacy:private_ids');
    await cacheDel('privacy:private_team_ids');
    const first = await call(reader, { action: 'read', viewer });
    check(
      'initial public and unblocked controls',
      !first.result[0].includes(author) &&
        !first.result[1].includes(team) &&
        !first.result[2].includes(author)
    );
    const warm = await call(reader, { action: 'read', viewer });
    console.log(
      JSON.stringify({
        benchmark: 'privacy warm read before mutation',
        prismaOperations: warm.queries,
        elapsedMs: warm.elapsedMs,
      })
    );
    const path = `/games?show_all=true&limit=100&team_id=${team}`;
    const gameWarm = await call(reader, { action: 'http', path });
    check(
      'public game visible before restriction',
      gameWarm.result.status === 200 && JSON.stringify(gameWarm.result.body).includes(game)
    );
    const cached = await call(reader, { action: 'http', path });
    console.log(
      JSON.stringify({
        benchmark: 'cached anonymous games list before mutation',
        prismaOperations: cached.queries,
        elapsedMs: cached.elapsedMs,
      })
    );
    await call(writer, { action: 'mutate', author, viewer, team });
    const restricted = await call(reader, { action: 'read', viewer });
    console.log(
      JSON.stringify({
        observation: 'post-mutation reader',
        privateAuthorHidden: restricted.result[0].includes(author),
        privateTeamHidden: restricted.result[1].includes(team),
        blockedAuthorHidden: restricted.result[2].includes(author),
        prismaOperations: restricted.queries,
        elapsedMs: restricted.elapsedMs,
      })
    );
    if (process.env.AUDIT_LEGACY_PRIVACY_MODULE) {
      check(
        'legacy helper reproduces cross-process stale privacy leakage',
        !restricted.result[0].includes(author) &&
          !restricted.result[1].includes(team) &&
          !restricted.result[2].includes(author)
      );
    } else {
      check(
        'private author immediately hidden across processes',
        restricted.result[0].includes(author)
      );
      check(
        'private team immediately hidden across processes',
        restricted.result[1].includes(team)
      );
      check('block immediately applied across processes', restricted.result[2].includes(author));
      const refreshed = await call(reader, { action: 'http', path });
      check(
        'cached game payload revalidates new team privacy',
        refreshed.result.status === 200 && !JSON.stringify(refreshed.result.body).includes(game)
      );
      console.log(
        JSON.stringify({
          benchmark: 'cached game list after team restriction',
          prismaOperations: refreshed.queries,
          elapsedMs: refreshed.elapsedMs,
        })
      );
      check(
        'direct game denied after restriction',
        (await call(reader, { action: 'http', path: `/games/${game}` })).result.status === 404
      );
    }
    // Simulate stale Redis repopulation from an overlapping old request.
    await cacheSet('privacy:private_ids', [], 60);
    await cacheSet('privacy:private_team_ids', [], 60);
    await cacheSet(`privacy:blocked:${viewer}`, [], 30);
    if (!process.env.AUDIT_LEGACY_PRIVACY_MODULE) {
      const repopulated = await call(reader, { action: 'read', viewer });
      check(
        'stale Redis repopulation cannot restore author/team/block visibility',
        repopulated.result[0].includes(author) &&
          repopulated.result[1].includes(team) &&
          repopulated.result[2].includes(author)
      );
    }
    console.log(
      JSON.stringify({
        result: 'PASS',
        total: passed,
        mode: process.env.AUDIT_LEGACY_PRIVACY_MODULE ? 'before-reproduction' : 'after-regression',
      })
    );
  } finally {
    for (const child of children) {
      child.kill('SIGTERM');
    }
    if (game) await prisma.game.delete({ where: { id: game } });
    if (team) await prisma.team.delete({ where: { id: team } });
    if (org) await prisma.organization.delete({ where: { id: org } });
    await prisma.user.deleteMany({
      where: { id: { in: [author, viewer].filter((id): id is string => Boolean(id)) } },
    });
    await prisma.$disconnect();
  }
  process.exit(0);
}
