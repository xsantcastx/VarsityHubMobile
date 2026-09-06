/** Audit-only scenario evidence. Seeds/cleans dedicated local DB; no product fix. See docs audit report for isolated env command. */
import request from 'supertest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { signJwt } from '../../src/lib/jwt.js';
const auditDbUrl = new URL(process.env.DATABASE_URL || '');
if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost'].includes(auditDbUrl.hostname))
  throw new Error('Test mode and loopback PostgreSQL required');
if (new URL(process.env.DATABASE_URL || '').pathname !== '/vh_reaudit_fan_20260905_tabs')
  throw new Error('Exclusive audit DB required');
const ids: string[] = [];
let passed = 0;
async function persona(kind: string, dob: string | null, prefs = {}) {
  const u = await prisma.user.create({
    data: {
      email: `audit-${kind}-${Date.now()}@test.local`,
      email_verified: true,
      onboarding_completed: true,
      role: 'fan',
      date_of_birth: dob ? new Date(dob) : null,
      preferences: prefs,
    },
  });
  ids.push(u.id);
  return { id: u.id, token: signJwt({ id: u.id }) };
}
async function check(name: string, result: any, status: number, code?: string) {
  if (result.status !== status || (code && result.body.code !== code))
    throw new Error(
      `${name}: actual ${result.status} ${JSON.stringify(result.body)} expected ${status} ${code || ''}`
    );
  passed++;
  console.log(
    JSON.stringify({
      scenario: name,
      status: result.status,
      code: result.body.code || null,
      pass: true,
    })
  );
  return result.body;
}
const send = (from: any, to: any, extra = {}) =>
  request(app)
    .post('/messages')
    .set('Authorization', `Bearer ${from.token}`)
    .send({ recipient_id: to.id, content: 'Local audit message', ...extra });
try {
  const adult = await persona('adult', '1990-01-01'),
    adult2 = await persona('adult2', '1990-01-01'),
    minor = await persona('minor', '2010-01-01'),
    unknown = await persona('unknown', null);
  await check('adult to adult default policy', await send(adult, adult2), 201);
  await check('adult to minor without follow', await send(adult, minor), 403, 'AGE_POLICY_BLOCKED');
  await prisma.follows.create({
    data: { follower_id: adult.id, following_id: minor.id, status: 'pending' },
  });
  await check('adult to minor pending follow', await send(adult, minor), 403, 'AGE_POLICY_BLOCKED');
  await prisma.follows.updateMany({
    where: { follower_id: adult.id, following_id: minor.id },
    data: { status: 'accepted' },
  });
  await check('adult to minor accepted follow', await send(adult, minor), 201);
  await check('minor to adult no follow', await send(minor, adult2), 403, 'AGE_POLICY_BLOCKED');
  await check(
    'unknown DOB sender cannot bypass',
    await send(unknown, adult2),
    403,
    'AGE_POLICY_BLOCKED'
  );
  await check(
    'unknown DOB recipient cannot bypass',
    await send(adult, unknown),
    403,
    'AGE_POLICY_BLOCKED'
  );
  await prisma.user.update({
    where: { id: adult2.id },
    data: { preferences: { dm_policy: 'no_one' } },
  });
  await check('recipient no_one policy', await send(adult, adult2), 403, 'DM_RESTRICTED');
  await prisma.user.update({
    where: { id: adult2.id },
    data: { preferences: { dm_policy: 'following' } },
  });
  await check(
    'recipient following-only rejects stranger',
    await send(adult, adult2),
    403,
    'DM_RESTRICTED'
  );
  await prisma.follows.create({
    data: { follower_id: adult2.id, following_id: adult.id, status: 'accepted' },
  });
  await check('recipient following-only allows accepted relation', await send(adult, adult2), 201);
  const forged = await check(
    'client conversation id is replaced',
    await send(adult, adult2, { conversation_id: 'dm:foreign-one__foreign-two' }),
    201
  );
  if (forged.conversation_id !== `dm:${[adult.id, adult2.id].sort().join('__')}`)
    throw new Error('Conversation id spoof');
  await check(
    'unrelated fan cannot read conversation',
    await request(app)
      .get(`/messages?conversation_id=${encodeURIComponent(forged.conversation_id)}`)
      .set('Authorization', `Bearer ${unknown.token}`),
    403
  );
  await prisma.blockedUser.create({ data: { blocker_id: adult2.id, blocked_id: adult.id } });
  await check(
    'recipient block overrides accepted follow',
    await send(adult, adult2),
    403,
    'MESSAGE_BLOCKED'
  );
  await check(
    'sender block direction enforced too',
    await send(adult2, adult),
    403,
    'MESSAGE_BLOCKED'
  );
  await check(
    'message length 5001 rejected',
    await send(adult, minor, { content: 'a'.repeat(5001) }),
    400
  );
  console.log(
    JSON.stringify({
      passed,
      failed: 0,
      mode: 'real PostgreSQL + production Express app + HTTP; synthetic seeded identities, no device/provider',
    })
  );
} finally {
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
}
process.exit(0);
