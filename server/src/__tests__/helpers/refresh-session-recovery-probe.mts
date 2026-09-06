import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import bcrypt from 'bcrypt';
import request from 'supertest';
const db = new URL(process.env.DATABASE_URL || '');
assert.ok(['127.0.0.1', 'localhost'].includes(db.hostname));
assert.ok(db.pathname.startsWith('/varsityhub_audit_') || db.pathname.endsWith('_test'));
assert.equal(db.searchParams.get('connection_limit'), '1');
assert.equal(db.searchParams.get('pool_timeout'), '1');
assert.equal(process.env.NODE_ENV, 'test');
const { prisma } = await import('../../lib/prisma.js');
const {
  generateRefreshTokenV2,
  hashRefreshTokenSecret,
  REFRESH_ROTATION_GRACE_MS,
  signAccessTokenForSession,
  signJwt,
  parseRefreshToken,
  verifyJwt,
  REFRESH_TOKEN_EXPIRY_DAYS,
} = await import('../../lib/jwt.js');
const { startNewSession, revokeAllSessions } = await import('../../lib/session.js');
const { authMiddleware } = await import('../../middleware/auth.js');
const { authRouter } = await import('../../routes/auth.js');
const app = express();
app.use(express.json());
app.use(authMiddleware);
app.use('/auth', authRouter);
app.get('/probe', (req: any, res: any) =>
  res.status(req.user ? 200 : 401).json({ authenticated: Boolean(req.user) })
);
const ids: string[] = [];
const results: any[] = [];
const device = 'session-audit-device-aaaaaaaa';
async function user() {
  const u = await prisma.user.create({
    data: {
      email: `session-audit-${randomUUID()}@example.test`,
      role: 'fan',
      email_verified: true,
      onboarding_completed: true,
      approval_status: 'APPROVED',
      preferences: { role: 'fan', onboarding_completed: true },
    },
  });
  ids.push(u.id);
  return u;
}
async function token(userId: string, fingerprint: string) {
  const t = generateRefreshTokenV2();
  await prisma.refreshToken.create({
    data: {
      user_id: userId,
      token_hash: await hashRefreshTokenSecret(t.secret),
      key_id: t.keyId,
      hash_version: 2,
      expires_at: new Date(Date.now() + 86400000),
      device_info: fingerprint,
    },
  });
  return t;
}
async function refresh(raw: string, headers: Record<string, string>) {
  let q = request(app).post('/auth/refresh');
  for (const [key, value] of Object.entries(headers)) q = q.set(key, value);
  return q.send({ refresh_token: raw });
}
async function epoch(userId: string) {
  return (
    await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { session_epoch: true } })
  ).session_epoch;
}
function record(r: any) {
  results.push(r);
  console.log('SESSION_AUDIT_RESULT ' + JSON.stringify(r));
}
try {
  for (const scenario of [
    {
      name: 'same_device_grace_control',
      stored: `vh1:${device}`,
      headers: { 'x-varsityhub-device-id': device },
      expectedRetry: 200,
    },
    {
      name: 'missing_device_grace_recovery',
      stored: `vh1:${device}`,
      headers: { 'user-agent': 'VarsityHub audit fixture' },
      expectedRetry: 200,
    },
    {
      name: 'legacy_ua_change_grace_recovery',
      stored: 'ua:VarsityHub/old',
      headers: { 'user-agent': 'VarsityHub/new' },
      expectedRetry: 200,
    },
  ]) {
    const u = await user();
    const original = await token(u.id, scenario.stored);
    const sibling = await token(u.id, `vh1:${device}`);
    const access = signAccessTokenForSession(u.id, u.session_epoch);
    const first = await refresh(original.raw, scenario.headers);
    assert.equal(first.status, 200);
    const retry = await refresh(original.raw, scenario.headers);
    assert.equal(retry.status, scenario.expectedRetry);
    const siblingAlive = Boolean(
      await prisma.refreshToken.findUnique({ where: { key_id: sibling.keyId } })
    );
    const issued = parseRefreshToken(retry.body.refresh_token);
    const issuedRow =
      issued.version === 2
        ? await prisma.refreshToken.findUnique({ where: { key_id: issued.keyId } })
        : null;
    const after = await epoch(u.id);
    const protectedRead = await request(app).get('/probe').set('Authorization', `Bearer ${access}`);
    record({
      scenario: scenario.name,
      firstRefreshStatus: first.status,
      retryStatus: retry.status,
      retryCode: retry.body.code || null,
      epochDelta: after - u.session_epoch,
      siblingSurvives: siblingAlive,
      bindingPreserved: scenario.stored.startsWith('vh1:')
        ? issuedRow?.device_info === scenario.stored
        : true,
      previousAccessStatus: protectedRead.status,
      graceMs: REFRESH_ROTATION_GRACE_MS,
    });
  }
  {
    const u = await user();
    const original = await token(u.id, `vh1:${device}`);
    const sibling = await token(u.id, `vh1:${device}`);
    const first = await refresh(original.raw, { 'x-varsityhub-device-id': device });
    assert.equal(first.status, 200);
    const retry = await refresh(original.raw, {
      'x-varsityhub-device-id': 'session-audit-device-bbbbbbbb',
    });
    record({
      scenario: 'genuine_device_mismatch_control',
      status: retry.status,
      code: retry.body.code,
      epochDelta: (await epoch(u.id)) - u.session_epoch,
      siblingSurvives: Boolean(
        await prisma.refreshToken.findUnique({ where: { key_id: sibling.keyId } })
      ),
    });
  }
  {
    const u = await user();
    const a = await startNewSession(u.id, `vh1:${device}`);
    const b = await startNewSession(u.id, 'vh1:session-audit-second-device');
    const readA = await request(app).get('/probe').set('Authorization', `Bearer ${a.access_token}`);
    const readB = await request(app).get('/probe').set('Authorization', `Bearer ${b.access_token}`);
    await revokeAllSessions(u.id);
    const revokedA = await request(app)
      .get('/probe')
      .set('Authorization', `Bearer ${a.access_token}`);
    const revokedB = await request(app)
      .get('/probe')
      .set('Authorization', `Bearer ${b.access_token}`);
    record({
      scenario: 'multiple_sessions_and_explicit_revocation_control',
      secondLoginEpochDelta: b.session_epoch - a.session_epoch,
      beforeRevoke: [readA.status, readB.status],
      afterRevoke: [revokedA.status, revokedB.status],
    });
  }
  {
    const u = await user();
    const t = await token(u.id, `vh1:${device}`);
    const expired = signJwt({ id: u.id, se: u.session_epoch }, '-1s');
    const before = await request(app).get('/probe').set('Authorization', `Bearer ${expired}`);
    const renewed = await refresh(t.raw, { 'x-varsityhub-device-id': device });
    const after = await request(app)
      .get('/probe')
      .set('Authorization', `Bearer ${renewed.body.access_token}`);
    record({
      scenario: 'expired_access_refresh_control',
      expiredAccess: before.status,
      refresh: renewed.status,
      renewedAccess: after.status,
      epochDelta: (await epoch(u.id)) - u.session_epoch,
    });
  }
  {
    const u = await user();
    const bad = await token(u.id, `vh1:${device}`);
    const invalid = await refresh(`${bad.keyId}.${'a'.repeat(64)}`, {
      'x-varsityhub-device-id': device,
    });
    assert.equal(invalid.status, 401);
    const invalidRowPreserved = Boolean(
      await prisma.refreshToken.findUnique({ where: { key_id: bad.keyId } })
    );
    const expired = await token(u.id, `vh1:${device}`);
    await prisma.refreshToken.update({
      where: { key_id: expired.keyId },
      data: { expires_at: new Date(Date.now() - 1000) },
    });
    const expiredResponse = await refresh(expired.raw, { 'x-varsityhub-device-id': device });
    assert.equal(expiredResponse.status, 401);
    await revokeAllSessions(u.id);
    const revoked = await refresh(bad.raw, { 'x-varsityhub-device-id': device });
    assert.equal(revoked.status, 401);
    record({
      scenario: 'invalid_expired_revoked_refresh_controls',
      invalidStatus: invalid.status,
      invalidRowPreserved,
      expiredStatus: expiredResponse.status,
      revokedStatus: revoked.status,
    });
  }
  {
    const u = await user();
    const t = await token(u.id, `vh1:${device}`);
    await prisma.refreshToken.update({
      where: { key_id: t.keyId },
      data: {
        rotated_at: new Date(Date.now() - REFRESH_ROTATION_GRACE_MS - 1000),
        expires_at: new Date(Date.now() - 1000),
      },
    });
    const sibling = await token(u.id, `vh1:${device}`);
    const replay = await refresh(t.raw, { 'user-agent': 'VarsityHub fixture' });
    record({
      scenario: 'past_grace_missing_header_still_rejected',
      status: replay.status,
      code: replay.body.code,
      epochDelta: (await epoch(u.id)) - u.session_epoch,
      siblingSurvives: Boolean(
        await prisma.refreshToken.findUnique({ where: { key_id: sibling.keyId } })
      ),
    });
  }
  {
    const u = await user();
    const t = await token(u.id, `vh1:${device}`);
    const sibling = await token(u.id, `vh1:${device}`);
    const pair = await Promise.all([refresh(t.raw, {}), refresh(t.raw, {})]);
    record({
      scenario: 'concurrent_missing_header_refreshes_recover',
      statuses: pair.map(r => r.status),
      epochDelta: (await epoch(u.id)) - u.session_epoch,
      siblingSurvives: Boolean(
        await prisma.refreshToken.findUnique({ where: { key_id: sibling.keyId } })
      ),
    });
  }
  {
    const u = await user();
    const password = 'LocalFixturePassword123!';
    await prisma.user.update({
      where: { id: u.id },
      data: {
        password_hash: await bcrypt.hash(password, 10),
        // Age the account/password boundary too: an eight-day-old token must
        // not predate a password change performed when this fixture was made.
        created_at: new Date(Date.now() - 9 * 86400000),
        password_changed_at: new Date(Date.now() - 9 * 86400000),
      },
    });
    const login = await request(app)
      .post('/auth/login')
      .set('x-varsityhub-device-id', device)
      .send({ email: u.email, password });
    assert.equal(login.status, 200);
    const parsed = parseRefreshToken(login.body.refresh_token);
    assert.equal(parsed.version, 2);
    const row = await prisma.refreshToken.findUniqueOrThrow({
      where: { key_id: (parsed as any).keyId },
    });
    const issued = verifyJwt(login.body.access_token) as any;
    const day = 86400000;
    const agedExpiry = new Date(Date.now() + (REFRESH_TOKEN_EXPIRY_DAYS - 8) * day);
    await prisma.refreshToken.update({
      where: { id: row.id },
      data: { created_at: new Date(Date.now() - 8 * day), expires_at: agedExpiry },
    });
    const refreshed = await refresh(login.body.refresh_token, { 'x-varsityhub-device-id': device });
    assert.equal(refreshed.status, 200);
    const replacement = parseRefreshToken(refreshed.body.refresh_token);
    assert.equal(replacement.version, 2);
    const rotated = await prisma.refreshToken.findUniqueOrThrow({
      where: { key_id: (replacement as any).keyId },
    });
    record({
      scenario: 'login_and_eight_day_idle_refresh_lifetimes',
      loginStatus: login.status,
      configuredRefreshDays: REFRESH_TOKEN_EXPIRY_DAYS,
      accessTtlSeconds: issued.exp - issued.iat,
      loginRefreshLifetimeDays: (row.expires_at.getTime() - row.created_at.getTime()) / day,
      eightDayIdleRefreshStatus: refreshed.status,
      newRefreshLifetimeDays: (rotated.expires_at.getTime() - Date.now()) / day,
      expiryExtendedDays: (rotated.expires_at.getTime() - agedExpiry.getTime()) / day,
    });
  }
  {
    const u = await user();
    const t = await token(u.id, `vh1:${device}`);
    let begin!: () => void;
    const started = new Promise<void>(r => (begin = r));
    let finish!: () => void;
    const hold = new Promise<void>(r => (finish = r));
    const blocker = prisma.$transaction(
      async tx => {
        await tx.$queryRaw`SELECT 1`;
        begin();
        await hold;
      },
      { timeout: 10000 }
    );
    await started;
    let during: any;
    let accessDuring: any;
    const access = signAccessTokenForSession(u.id, u.session_epoch);
    try {
      [during, accessDuring] = await Promise.all([
        refresh(t.raw, { 'x-varsityhub-device-id': device }),
        request(app).get('/probe').set('Authorization', `Bearer ${access}`),
      ]);
    } finally {
      finish();
      await blocker;
    }
    const row = await prisma.refreshToken.findUnique({ where: { key_id: t.keyId } });
    const recovered = await refresh(t.raw, { 'x-varsityhub-device-id': device });
    assert.equal(during.status, 503);
    assert.equal(accessDuring.status, 503);
    assert.equal(recovered.status, 200);
    record({
      scenario: 'real_pool_timeout_returns_retryable_503',
      duringPoolExhaustionStatus: during.status,
      protectedRequestDuringPoolExhaustionStatus: accessDuring.status,
      duringError: during.body.error,
      errorCode: during.body.code,
      aliasCode: during.body.errorCode,
      originalTokenStillPresent: Boolean(row),
      originalTokenStillUnrotated: row?.rotated_at === null,
      retryAfterPoolRecoveryStatus: recovered.status,
      epochDelta: (await epoch(u.id)) - u.session_epoch,
    });
  }
} finally {
  await prisma.refreshToken.deleteMany({ where: { user_id: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
}

process.exit(0);
