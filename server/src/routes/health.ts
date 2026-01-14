import { Router } from 'express';
<<<<<<< HEAD
import { isCloudinaryConfigured } from '../lib/cloudinary.js';
import { getMissingEmailTemplates, isSendGridConfigured } from '../lib/email.js';
import { isTwilioConfigured } from '../lib/twilio.js';
=======
import { validateConfig } from '../lib/config-validator.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
>>>>>>> 19009a9 (fix: add runtimeVersion to align with Expo.plist for EAS build)

export const healthRouter = Router();

/**
 * Health check endpoint with integration status
 * GET /health
 */
healthRouter.get('/', (req, res) => {
<<<<<<< HEAD
  const missingEmailTemplates = getMissingEmailTemplates();
  // Consider SendGrid "ready" when the API key is configured; missing templates degrade functionality
  // but should not mark the integration as entirely down.
  const sendgridReady = isSendGridConfigured();
  const sgKeyLen = (process.env.SENDGRID_API_KEY || '').length;
  console.log(`[HEALTH CHECK] SENDGRID_API_KEY length=${sgKeyLen}, NODE_ENV=${process.env.NODE_ENV}`);

  const integrations = {
    database: !!process.env.DATABASE_URL,
    jwt: !!process.env.JWT_SECRET,
    cloudinary: isCloudinaryConfigured(),
    twilio: isTwilioConfigured(),
    stripe: !!process.env.STRIPE_SECRET_KEY,
    sendgrid: sendgridReady,
    googleOAuth: !!process.env.GOOGLE_OAUTH_CLIENT_IDS,
    googleMaps: !!process.env.GOOGLE_MAPS_API_KEY,
    sentry: !!process.env.SENTRY_DSN,
  };

  const allConfigured = Object.entries(integrations)
    .filter(([key]) => !['twilio', 'sentry', 'sendgrid'].includes(key)) // Optional services
    .every(([, value]) => value);
=======
  const configStatus = validateConfig();
  const integrations = Object.fromEntries(configStatus.services.map((service) => [service.key, service.ok])) as Record<
    string,
    boolean
  >;
  const allConfigured = configStatus.services.filter((service) => service.required).every((service) => service.ok);
>>>>>>> 19009a9 (fix: add runtimeVersion to align with Expo.plist for EAS build)

  res.json({
    status: 'ok',
    version: 'v2024.12.17-sendgrid-fix',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    integrations,
    ready: allConfigured,
<<<<<<< HEAD
    warnings: [
      ...(!integrations.twilio ? ['Twilio not configured - SMS disabled'] : []),
      ...(
        !isSendGridConfigured()
          ? ['SendGrid API key missing - transactional email disabled']
          : []
      ),
      ...(isSendGridConfigured() && missingEmailTemplates.length
        ? [`SendGrid templates missing: ${missingEmailTemplates.join(', ')}`]
        : []),
      ...(!integrations.sentry ? ['Sentry not configured - error tracking disabled'] : []),
    ],
    metadata: {
      missingEmailTemplates,
      debug: { sgKeyLen, nodeEnv: process.env.NODE_ENV },
    },
=======
    warnings: configStatus.warnings,
    errors: configStatus.errors,
  });
});

/**
 * GET /health/ready - Kubernetes-style readiness probe
 * Returns 503 if database unreachable or critical config missing
 */
healthRouter.get('/ready', async (_req, res) => {
  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    database: { ok: false, latency_ms: null },
    config: { ok: false },
  };

  // Database connectivity check
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true, latency_ms: Date.now() - start };
  } catch (err: any) {
    checks.database = { ok: false, error: err.message };
  }

  // Config validation
  const configStatus = validateConfig();
  checks.config = {
    ok: configStatus.valid,
    errors: configStatus.errors,
    warnings: configStatus.warnings,
  };

  const ready = checks.database.ok && checks.config.ok;
  res.status(ready ? 200 : 503).json({ ready, checks });
});

/**
 * GET /health/services - Detailed service status for debugging
 */
healthRouter.get('/services', (_req, res) => {
  const configStatus = validateConfig();
  res.json({
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    services: configStatus.services,
    warnings: configStatus.warnings,
    errors: configStatus.errors,
>>>>>>> 19009a9 (fix: add runtimeVersion to align with Expo.plist for EAS build)
  });
});
