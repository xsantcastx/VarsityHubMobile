#!/usr/bin/env node

const { execFileSync } = require('node:child_process');

const SERVICE = process.env.RAILWAY_SERVICE || 'api';

const REQUIRED_KEYS = [
  'API_BASE_URL',
  'APP_BASE_URL',
  'DATABASE_BACKUP_URL',
  'DATABASE_URL',
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_SENTRY_DSN',
  'HEALTH_CHECK_SECRET',
  'JWT_SECRET',
  'REDIS_URL',
  'SENDGRID_API_KEY',
  'SENTRY_AUTH_TOKEN',
  'SENTRY_DSN',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
];

const OPTIONAL_BUT_RELEASE_RELEVANT_KEYS = [
  'DATA_EXPORT_S3_ACCESS_KEY_ID',
  'DATA_EXPORT_S3_BUCKET',
  'DATA_EXPORT_S3_REGION',
  'DATA_EXPORT_S3_SECRET_ACCESS_KEY',
  'EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE',
];

const FORBIDDEN_KEYS = [
  {
    key: 'HEALTH_CHECK_SECRET ',
    reason: 'trailing-space duplicate; rotate and keep only HEALTH_CHECK_SECRET',
  },
  {
    key: 'EXPO_PUBLIC_SENTRY_TRACES_SAMPL',
    reason: 'misspelled; client reads EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE',
  },
  {
    key: 'SENTRY_ENVIROMENT',
    reason: 'misspelled; use SENTRY_ENVIRONMENT only if needed',
  },
  {
    key: 'SENDGIRD_API_KEY',
    reason: 'misspelled; use SENDGRID_API_KEY',
  },
];

function loadRailwayVariables() {
  try {
    const output = execFileSync('railway', ['variables', '--service', SERVICE, '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(output);
  } catch (error) {
    const message = error.stderr?.toString()?.trim() || error.message;
    console.error(`Failed to read Railway variables for service "${SERVICE}": ${message}`);
    process.exit(2);
  }
}

function isSet(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function main() {
  const vars = loadRailwayVariables();
  const keys = Object.keys(vars).sort();
  const failures = [];
  const warnings = [];

  for (const key of REQUIRED_KEYS) {
    if (!isSet(vars[key])) {
      failures.push(`missing required key: ${key}`);
    }
  }

  for (const { key, reason } of FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      failures.push(`forbidden key present: "${key}" (${reason})`);
    }
  }

  for (const key of keys) {
    if (key !== key.trim()) {
      failures.push(`key has leading/trailing whitespace: "${key}"`);
    }
    if (/Run this command:/i.test(key)) {
      failures.push(`pasted command stored as env key: "${key}"`);
    }
  }

  for (const key of OPTIONAL_BUT_RELEASE_RELEVANT_KEYS) {
    if (!isSet(vars[key])) {
      warnings.push(`release-relevant key is not set: ${key}`);
    }
  }

  console.log(`Railway env drift check for service "${SERVICE}"`);
  console.log(`Checked ${keys.length} keys. Values were not printed.`);

  if (warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of warnings) console.log(`- ${warning}`);
  }

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const failure of failures) console.log(`- ${failure}`);
    process.exit(1);
  }

  console.log('\nRailway env drift check passed.');
}

main();
