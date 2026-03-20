#!/usr/bin/env npx tsx
/**
 * Verifies production health integrations and payment config readiness.
 *
 * Usage:
 *   BASE_URL=https://api-production-8ac3.up.railway.app npm --prefix server run verify:production-health
 *
 * With full integration details (requires HEALTH_CHECK_SECRET):
 *   BASE_URL=https://... HEALTH_CHECK_SECRET=... npm --prefix server run verify:production-health
 */

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const HEALTH_SECRET = process.env.HEALTH_CHECK_SECRET || '';

type HealthResponse = {
  status?: string;
  ready?: boolean;
  integrations?: Record<string, boolean>;
  payments_config?: {
    stripe_configured?: boolean;
    has_webhook_secret?: boolean;
    stripe_publishable_key?: string;
  };
};

async function main() {
  const failures: string[] = [];
  const headers: Record<string, string> = {};
  if (HEALTH_SECRET) {
    headers['x-health-check-secret'] = HEALTH_SECRET;
  }

  // 1. Health endpoint
  const healthRes = await fetch(`${BASE_URL}/health?include=payments`, { method: 'GET', headers });
  if (!healthRes.ok) {
    throw new Error(`Health endpoint failed: ${healthRes.status}`);
  }
  const body = (await healthRes.json()) as HealthResponse;

  if (body.status !== 'ok') failures.push(`status=${body.status}`);

  if (HEALTH_SECRET && body.integrations) {
    // Full integration mode — secret provided, detailed checks available
    if (!body.ready) failures.push('ready=false');

    const requiredIntegrations = [
      'database', 'jwt', 'cloudinary', 'stripe', 'sendgrid',
      'googleOAuth', 'googleMaps', 'appleIAP', 'sentry', 'redis',
    ];
    for (const key of requiredIntegrations) {
      if (!body.integrations[key]) {
        failures.push(`integration:${key}=false`);
      }
    }

    if (!body.payments_config?.stripe_configured) {
      failures.push('payments_config.stripe_configured=false');
    }
    if (!body.payments_config?.has_webhook_secret) {
      failures.push('payments_config.has_webhook_secret=false');
    }
  } else {
    // Public mode — no secret, verify via separate endpoints
    // eslint-disable-next-line no-console
    console.log('No HEALTH_CHECK_SECRET provided — running public verification checks.');

    // Check /payments/config is reachable and returns Stripe key
    try {
      const configRes = await fetch(`${BASE_URL}/payments/config`);
      if (!configRes.ok) {
        failures.push(`payments/config returned ${configRes.status}`);
      } else {
        const configBody = (await configRes.json()) as any;
        if (!configBody.stripe_publishable_key) {
          failures.push('payments/config missing stripe_publishable_key');
        }
      }
    } catch (err) {
      failures.push(`payments/config unreachable: ${(err as Error).message}`);
    }
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
