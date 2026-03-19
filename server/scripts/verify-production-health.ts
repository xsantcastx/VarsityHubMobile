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
    stripe_publishable_key?: string;
    available_plans?: Record<string, unknown>;
    payments_enabled?: boolean;
  };
};

async function main() {
  const healthSecret = (process.env.HEALTH_CHECK_SECRET || process.env.X_HEALTH_CHECK_SECRET || '').trim();
  const headers: Record<string, string> = {};
  if (healthSecret) headers['x-health-check-secret'] = healthSecret;

  const url = `${BASE_URL}/health?include=payments`;
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) {
    throw new Error(`Health endpoint failed: ${res.status}`);
  }

  const body = (await res.json()) as HealthResponse;
  const hasDetailedHealth = !!body.integrations && typeof body.ready === 'boolean';

  if (hasDetailedHealth) {
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
    console.log('Production health verification passed (full integration mode).');
    return;
  }

  if (healthSecret) {
    // eslint-disable-next-line no-console
    console.error('Production health verification failed: detailed health data unavailable. Check HEALTH_CHECK_SECRET or server health-route auth settings.');
    process.exit(1);
  }

  // Public-mode fallback for environments that intentionally lock detailed /health output.
  // Verify public health and payment config readiness without exposing secrets.
  if (body.status !== 'ok') {
    // eslint-disable-next-line no-console
    console.error(`Production health verification failed: status=${body.status}`);
    process.exit(1);
  }

  const paymentsRes = await fetch(`${BASE_URL}/payments/config`, { method: 'GET' });
  if (!paymentsRes.ok) {
    // eslint-disable-next-line no-console
    console.error(`Production health verification failed: /payments/config returned ${paymentsRes.status}`);
    process.exit(1);
  }
  const payments = (await paymentsRes.json()) as {
    stripe_publishable_key?: string;
    available_plans?: Record<string, unknown>;
    payments_enabled?: boolean;
  };

  const failures: string[] = [];
  if (!payments.payments_enabled) failures.push('payments_enabled=false');
  if (!payments.stripe_publishable_key || !payments.stripe_publishable_key.startsWith('pk_')) {
    failures.push('stripe_publishable_key missing/invalid');
  }

  const plans = payments.available_plans || {};
  for (const requiredPlan of ['rookie', 'veteran', 'legend']) {
    if (!Object.prototype.hasOwnProperty.call(plans, requiredPlan)) {
      failures.push(`available_plans.${requiredPlan}=missing`);
    }
  }

  if (failures.length > 0) {
    // eslint-disable-next-line no-console
    console.error('Production health verification failed (public mode):');
    for (const failure of failures) {
      // eslint-disable-next-line no-console
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log('Production health verification passed (public mode; detailed integrations require HEALTH_CHECK_SECRET).');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('verify-production-health failed:', err);
  process.exit(1);
});
