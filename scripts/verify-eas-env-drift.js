#!/usr/bin/env node

const { execFileSync } = require('node:child_process');

const ENVIRONMENT = process.env.EAS_ENVIRONMENT || 'production';

const REQUIRED_KEYS = [
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_EXPO_PROJECT_FULL_NAME',
  'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  'EXPO_PUBLIC_POSTHOG_API_KEY',
  'EXPO_PUBLIC_SENTRY_DSN',
  'EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE',
  'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'SENTRY_AUTH_TOKEN',
];

const SENSITIVE_KEYS = new Set(['SENTRY_AUTH_TOKEN']);

function loadEasEnvList() {
  try {
    return execFileSync('eas', ['env:list', ENVIRONMENT, '--format', 'long'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const message = error.stderr?.toString()?.trim() || error.message;
    console.error(`Failed to read EAS ${ENVIRONMENT} env metadata: ${message}`);
    process.exit(2);
  }
}

function parseLongFormat(output) {
  return output
    .split(/———/)
    .map(block => {
      const variable = {};
      for (const rawLine of block.split(/\r?\n/)) {
        const match = rawLine.match(/^\s*(Name|Visibility|Scope|Environments)\s+(.+?)\s*$/);
        if (!match) continue;
        variable[match[1].toLowerCase()] = match[2].trim();
      }
      return variable.name ? variable : null;
    })
    .filter(Boolean);
}

function main() {
  const variables = parseLongFormat(loadEasEnvList());
  const byName = new Map();
  const failures = [];
  const warnings = [];

  for (const variable of variables) {
    const list = byName.get(variable.name) || [];
    list.push(variable);
    byName.set(variable.name, list);
  }

  for (const key of REQUIRED_KEYS) {
    if (!byName.has(key)) failures.push(`missing required EAS env key: ${key}`);
  }

  for (const key of SENSITIVE_KEYS) {
    const entries = byName.get(key) || [];
    for (const entry of entries) {
      if (!/SENSITIVE|SECRET/i.test(entry.visibility || '')) {
        failures.push(`${key} must not be ${entry.visibility || 'unknown'} visibility`);
      }
    }
  }

  for (const [name, entries] of byName.entries()) {
    if (entries.length > 1) {
      warnings.push(`duplicate EAS env key: ${name} (${entries.length} entries)`);
    }
  }

  console.log(`EAS env drift check for ${ENVIRONMENT}`);
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

  console.log('\nEAS env drift check passed.');
}

main();
