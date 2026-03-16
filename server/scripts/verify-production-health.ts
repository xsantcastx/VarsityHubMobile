#!/usr/bin/env npx tsx
/**
 * Verifies production health integrations and payment config readiness.
 *
 * Usage:
 *   BASE_URL=https://api-production-8ac3.up.railway.app npm --prefix server run verify:production-health
 */

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

type HealthResponse = {
  status?: string;
  ready?: boolean;
  integrations?: Record<string, boolean>;
  payments_config?: {
    stripe_configured?: boolean;
    has_webhook_secret?: boolean;
  };
};

async function main() {
  const url = `${BASE_URL}/health?include=payments`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Health endpoint failed: ${res.status}`);
  }

  const body = (await res.json()) as HealthResponse;
  const integrations = body.integrations || {};

  const requiredIntegrations = [
    'database',
    'jwt',
    'cloudinary',
    'stripe',
    'sendgrid',
    'googleOAuth',
    'googleMaps',
    'appleIAP',
    'sentry',
    'redis',
  ];

  const failures: string[] = [];

  if (body.status !== 'ok') failures.push(`status=${body.status}`);
  if (!body.ready) failures.push('ready=false');

  for (const key of requiredIntegrations) {
    if (!integrations[key]) {
      failures.push(`integration:${key}=false`);
    }
  }

  if (!body.payments_config?.stripe_configured) {
    failures.push('payments_config.stripe_configured=false');
  }
  if (!body.payments_config?.has_webhook_secret) {
    failures.push('payments_config.has_webhook_secret=false');
  }

  if (failures.length > 0) {
    // eslint-disable-next-line no-console
    console.error('Production health verification failed:');
    for (const failure of failures) {
      // eslint-disable-next-line no-console
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log('Production health verification passed.');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('verify-production-health failed:', err);
  process.exit(1);
});
