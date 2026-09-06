#!/usr/bin/env node

const { execFileSync } = require('node:child_process');

const PROJECT = process.env.VERCEL_PROJECT || 'varsityhub-web';
const ENVIRONMENT = process.env.VERCEL_ENVIRONMENT || 'production';

const REQUIRED_PUBLIC_KEYS = [
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_WEB_BASE_URL',
  'EXPO_PUBLIC_SENTRY_DSN',
  'EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE',
  'EXPO_PUBLIC_POSTHOG_API_KEY',
  'EXPO_PUBLIC_POSTHOG_HOST',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
  'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_EXPO_PROJECT_FULL_NAME',
];

const FORBIDDEN_PATTERNS = [
  /^APPLE_/,
  /^CLOUDINARY_/,
  /^DATABASE_/,
  /^EMAIL_/,
  /^HEALTH_CHECK_SECRET$/,
  /^JWT_/,
  /^POSTGRES_/,
  /^R2_/,
  /^REDIS_/,
  /^SENDGRID_/,
  /^SMTP_/,
  /^STRIPE_SECRET/,
  /^STRIPE_WEBHOOK/,
  /^GOOGLE_PLAY_/,
];

const STALE_PATTERNS = [/^YOUR_/, /^PLACEHOLDER/, /^EXAMPLE/, /^DUMMY/];

function loadVercelEnvList() {
  try {
    const output = execFileSync(
      'npx',
      ['vercel', 'env', 'ls', ENVIRONMENT, '--project', PROJECT, '--json'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    const jsonStart = output.indexOf('{');
    if (jsonStart === -1) throw new Error('Vercel CLI did not return JSON');
    return JSON.parse(output.slice(jsonStart));
  } catch (error) {
    const message = error.stderr?.toString()?.trim() || error.message;
    console.error(
      `Failed to read Vercel ${ENVIRONMENT} env metadata for project "${PROJECT}": ${message}`
    );
    process.exit(2);
  }
}

function main() {
  const data = loadVercelEnvList();
  const variables = Array.isArray(data.envs) ? data.envs : [];
  const counts = new Map();
  const failures = [];
  const warnings = [];

  for (const variable of variables) {
    counts.set(variable.key, (counts.get(variable.key) || 0) + 1);
  }

  for (const key of REQUIRED_PUBLIC_KEYS) {
    if (!counts.has(key)) failures.push(`missing required Vercel env key: ${key}`);
  }

  for (const variable of variables) {
    if (REQUIRED_PUBLIC_KEYS.includes(variable.key) && variable.type === 'sensitive') {
      failures.push(
        `public web key must be Vercel config/encrypted so env pull can read it: ${variable.key}`
      );
    }
  }

  for (const key of [...counts.keys()].sort()) {
    if (FORBIDDEN_PATTERNS.some(pattern => pattern.test(key))) {
      failures.push(`server-only key must not be present in Vercel: ${key}`);
    }
    if (STALE_PATTERNS.some(pattern => pattern.test(key))) {
      warnings.push(`stale-looking key present in Vercel: ${key}`);
    }
  }

  for (const [key, count] of counts.entries()) {
    if (count > 1) warnings.push(`duplicate Vercel env key: ${key} (${count} entries)`);
  }

  console.log(`Vercel env drift check for ${PROJECT}/${ENVIRONMENT}`);
  console.log(`Checked ${variables.length} variable entries. Values were not printed.`);

  if (warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of warnings) console.log(`- ${warning}`);
  }

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const failure of failures) console.log(`- ${failure}`);
    process.exit(1);
  }

  console.log('\nVercel env drift check passed.');
}

main();
