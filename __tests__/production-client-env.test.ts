import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const liveKey = `pk_live_${'x'.repeat(24)}`;
let fixture: string;

beforeEach(() => {
  fixture = mkdtempSync(path.join(tmpdir(), 'production-client-env-'));
  mkdirSync(path.join(fixture, 'scripts'));
  for (const file of [
    'app.config.js',
    'app.json',
    'eas.json',
    'package.json',
    'scripts/with-production-client-env.js',
  ]) {
    copyFileSync(path.join(root, file), path.join(fixture, file));
  }
  const eas = JSON.parse(readFileSync(path.join(fixture, 'eas.json'), 'utf8'));
  eas.build.production.env.PRIVATE_BUILD_ONLY = 'must-not-be-imported';
  writeFileSync(path.join(fixture, 'eas.json'), JSON.stringify(eas));
  writeFileSync(
    path.join(fixture, 'fetch-stub.cjs'),
    `
    const fs = require('node:fs');
    const assert = require('node:assert/strict');
    AbortSignal.timeout = ms => { assert.equal(ms, 10000); return new AbortController().signal; };
    global.fetch = async (url, options) => {
      assert.equal(options.redirect, 'error');
      assert.equal(options.signal.aborted, false);
      fs.appendFileSync(process.env.FETCH_TRACE, url + '\\n');
      if (process.env.FETCH_CASE === 'failure') throw new Error('simulated provider outage');
      return { ok: process.env.FETCH_CASE !== 'http-error', json: async () => ({
        stripe_configured: process.env.FETCH_CASE !== 'disabled',
        payments_enabled: process.env.FETCH_CASE !== 'disabled',
        stripe_publishable_key: process.env.FETCH_CASE === 'test-key' ? 'pk_test_invalid' : ${JSON.stringify(liveKey)}
      }) };
    };
  `
  );
});

afterEach(() => rmSync(fixture, { recursive: true, force: true }));

function run(
  env: Partial<NodeJS.ProcessEnv> = {},
  childCode = 'process.stdout.write("child-ran")',
  args: string[] = []
) {
  return spawnSync(
    process.execPath,
    [
      '--require',
      path.join(fixture, 'fetch-stub.cjs'),
      path.join(fixture, 'scripts/with-production-client-env.js'),
      process.execPath,
      '-e',
      childCode,
      ...args,
    ],
    {
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: liveKey,
        FETCH_TRACE: path.join(fixture, 'fetch-trace'),
        ...env,
        NODE_ENV: env.NODE_ENV ?? 'test',
      },
      cwd: fixture,
      encoding: 'utf8',
      timeout: 5000,
    }
  );
}

it('loads production public defaults, forces production, and excludes build-only settings', () => {
  const result = run(
    { NODE_ENV: 'development', EXPO_PUBLIC_NODE_ENV: 'development', EXPO_NO_DOTENV: '0' },
    `
    const assert = require('node:assert/strict');
    const defaults = require('./eas.json').build.production.env;
    for (const key of Object.keys(defaults).filter(key => key.startsWith('EXPO_PUBLIC_'))) {
      assert.equal(process.env[key], defaults[key]);
    }
    assert.equal(process.env.NODE_ENV, 'production');
    assert.equal(process.env.EXPO_PUBLIC_NODE_ENV, 'production');
    assert.equal(process.env.EXPO_NO_DOTENV, '1');
    assert.equal(process.env.PRIVATE_BUILD_ONLY, undefined);
    assert.equal(process.env.EAS_SKIP_AUTO_FINGERPRINT, undefined);
  `
  );
  expect({ status: result.status, stderr: result.stderr, stdout: result.stdout }).toEqual({
    status: 0,
    stderr: '',
    stdout: '',
  });
});

it('preserves nonempty actual public overrides and existing private upload credentials', () => {
  const result = run(
    {
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'actual-client',
      SENTRY_AUTH_TOKEN: 'synthetic-upload-token',
    },
    `
    const assert = require('node:assert/strict');
    assert.equal(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, 'actual-client');
    assert.equal(process.env.SENTRY_AUTH_TOKEN, 'synthetic-upload-token');
  `
  );
  expect(result.status).toBe(0);
  expect(result.stdout + result.stderr).toBe('');
});

it('replaces empty actual defaults before resolving Expo config', () => {
  expect(run({ EXPO_PUBLIC_SENTRY_DSN: '  ' }).status).toBe(0);
});

it.each([
  ['malformed DSN', { EXPO_PUBLIC_SENTRY_DSN: 'not-a-dsn' }],
  ['placeholder DSN', { EXPO_PUBLIC_SENTRY_DSN: 'https://key@example.com/123' }],
  ['local API', { EXPO_PUBLIC_API_URL: 'https://127.0.0.1:4000' }],
  ['private API', { EXPO_PUBLIC_API_URL: 'https://192.168.1.2:4000' }],
  ['IPv6 API', { EXPO_PUBLIC_API_URL: 'https://[::1]:4000' }],
  ['internal API', { EXPO_PUBLIC_API_URL: 'https://api.railway.internal' }],
  ['insecure API', { EXPO_PUBLIC_API_URL: 'http://api.varsityhub.app' }],
  ['API with credentials', { EXPO_PUBLIC_API_URL: 'https://user:password@api.varsityhub.app' }],
  ['remote disabled', { EXPO_PUBLIC_FORCE_REMOTE_API: '0' }],
  ['local enabled', { EXPO_PUBLIC_USE_LOCAL_API: '1' }],
  ['invalid local flag', { EXPO_PUBLIC_USE_LOCAL_API: 'maybe' }],
  ['test Stripe key', { EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_invalid' }],
] as const)('rejects %s before starting the release command', (_name, env) => {
  const result = run(env);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('[production-client-env]');
});

it('obtains a missing live Stripe key once from the effective API without printing it', () => {
  const result = run(
    { EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: '', EXPO_PUBLIC_API_URL: 'https://api.varsityhub.app/' },
    `
    require('node:assert/strict').equal(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY, ${JSON.stringify(liveKey)});
  `
  );
  expect({ status: result.status, stdout: result.stdout, stderr: result.stderr }).toEqual({
    status: 0,
    stdout: '',
    stderr: '',
  });
  expect(readFileSync(path.join(fixture, 'fetch-trace'), 'utf8')).toBe(
    'https://api.varsityhub.app/payments/config\n'
  );
});

it.each(['disabled', 'test-key', 'failure', 'http-error'])(
  'refuses an unusable public payment configuration: %s',
  mode => {
    const result = run({ EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: '', FETCH_CASE: mode });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).not.toContain(liveKey);
    expect(readFileSync(path.join(fixture, 'fetch-trace'), 'utf8').trim().split('\n')).toHaveLength(
      1
    );
  }
);

it('passes literal argv without a shell and propagates the child exit code', () => {
  const literal = 'spaces; $(never-run) `never-run`';
  const result = run(
    {},
    `require('node:assert/strict').equal(process.argv[1], ${JSON.stringify(literal)}); process.exit(23)`,
    [literal]
  );
  expect(result.status).toBe(23);
  expect(result.stdout + result.stderr).toBe('');
});

it('propagates child termination signals', () => {
  const result = run({}, "process.kill(process.pid, 'SIGTERM')");
  expect(result.status).toBeNull();
  expect(result.signal).toBe('SIGTERM');
});
