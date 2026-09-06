/** Real HTTP/PostgreSQL regressions; child Node avoids Jest's large ESM route-linker collisions. */
import { beforeAll, describe, expect, it } from '@jest/globals';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
let results: Map<string, Record<string, any>>;
beforeAll(async () => {
  const database = new URL(process.env.DATABASE_URL || '');
  if (!['127.0.0.1', 'localhost'].includes(database.hostname)) {
    throw new Error('Session recovery regressions require an isolated local test database');
  }
  database.searchParams.set('connection_limit', '1');
  database.searchParams.set('pool_timeout', '1');
  const { stdout } = await run(
    process.execPath,
    [
      '--import',
      'tsx',
      fileURLToPath(new URL('./helpers/refresh-session-recovery-probe.mts', import.meta.url)),
    ],
    {
      cwd: fileURLToPath(new URL('../../', import.meta.url)),
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        VARSITYHUB_ENV_PATH: '/dev/null',
        DOTENV_CONFIG_PATH: '/dev/null',
        DATABASE_URL: database.toString(),
        JWT_SECRET: process.env.JWT_SECRET,
        NODE_ENV: 'test',
      },
      timeout: 30000,
      maxBuffer: 2 * 1024 * 1024,
    }
  );
  results = new Map(
    stdout
      .split('\n')
      .filter(line => line.startsWith('SESSION_AUDIT_RESULT '))
      .map(line => {
        const result = JSON.parse(line.slice('SESSION_AUDIT_RESULT '.length));
        return [result.scenario, result];
      })
  );
}, 35000);

describe('refresh session recovery without unintended logout', () => {
  it.each([
    'same_device_grace_control',
    'missing_device_grace_recovery',
    'legacy_ua_change_grace_recovery',
  ])('%s keeps the account and sibling sessions valid', scenario => {
    expect(results.get(scenario)).toMatchObject({
      firstRefreshStatus: 200,
      retryStatus: 200,
      retryCode: null,
      epochDelta: 0,
      siblingSurvives: true,
      previousAccessStatus: 200,
      bindingPreserved: true,
    });
  });
  it.each(['genuine_device_mismatch_control', 'past_grace_missing_header_still_rejected'])(
    '%s retains replay revocation',
    scenario => {
      expect(results.get(scenario)).toMatchObject({
        status: 401,
        code: 'TOKEN_REUSED',
        epochDelta: 1,
        siblingSurvives: false,
      });
    }
  );
  it('recovers concurrent refreshes even when the device header is missing', () => {
    expect(results.get('concurrent_missing_header_refreshes_recover')).toMatchObject({
      statuses: [200, 200],
      epochDelta: 0,
      siblingSurvives: true,
    });
  });
  it('preserves multi-device sessions until an explicit revoke-all action', () => {
    expect(results.get('multiple_sessions_and_explicit_revocation_control')).toMatchObject({
      secondLoginEpochDelta: 0,
      beforeRevoke: [200, 200],
      afterRevoke: [401, 401],
    });
  });
  it('recovers an expired access token through refresh', () => {
    expect(results.get('expired_access_refresh_control')).toMatchObject({
      expiredAccess: 401,
      refresh: 200,
      renewedAccess: 200,
      epochDelta: 0,
    });
  });
  it('still rejects invalid, expired and revoked refresh tokens', () => {
    expect(results.get('invalid_expired_revoked_refresh_controls')).toMatchObject({
      invalidStatus: 401,
      invalidRowPreserved: true,
      expiredStatus: 401,
      revokedStatus: 401,
    });
  });
  it('returns a retryable envelope on a real DB pool timeout and recovers with the same token', () => {
    expect(results.get('real_pool_timeout_returns_retryable_503')).toMatchObject({
      duringPoolExhaustionStatus: 503,
      protectedRequestDuringPoolExhaustionStatus: 503,
      errorCode: 'AUTH_REFRESH_UNAVAILABLE',
      aliasCode: 'AUTH_REFRESH_UNAVAILABLE',
      originalTokenStillPresent: true,
      originalTokenStillUnrotated: true,
      retryAfterPoolRecoveryStatus: 200,
      epochDelta: 0,
    });
  });
  it('issues 15-minute access and sliding 365-day refresh tokens, including after eight idle days', () => {
    const result = results.get('login_and_eight_day_idle_refresh_lifetimes');
    expect(result).toMatchObject({
      loginStatus: 200,
      configuredRefreshDays: 365,
      accessTtlSeconds: 900,
      eightDayIdleRefreshStatus: 200,
    });
    expect(result?.loginRefreshLifetimeDays).toBeCloseTo(365, 3);
    expect(result?.newRefreshLifetimeDays).toBeCloseTo(365, 3);
    expect(result?.expiryExtendedDays).toBeCloseTo(8, 3);
  });
});
