import { Router } from 'express';
import { isCloudinaryConfigured } from '../lib/cloudinary.js';
import { getMissingEmailTemplates, isSendGridConfigured } from '../lib/email.js';
import { isPushTicketStorageReady } from '../lib/notifications.js';
import { getAllPlanDefinitions } from '../lib/planLimits.js';
import { captureException } from '../lib/sentry.js';
import { getEmailService } from '../services/email/service.js';
import { isTwilioConfigured } from '../lib/twilio.js';

export const healthRouter = Router();

/**
 * Health check endpoint with integration status
 * GET /health
 * GET /health?include=payments - also returns payments config (fallback when /payments/config 404s)
 */
healthRouter.get('/', async (req, res) => {
  const missingEmailTemplates = getMissingEmailTemplates();
  const emailService = getEmailService();
  const emailServiceReady = emailService.isConfigured() && emailService.validateConfig().valid;
  const sendgridReady =
    isSendGridConfigured() && missingEmailTemplates.length === 0 && emailServiceReady;

  // Check Redis/Queue connectivity
  let redisConnected = false;
  try {
    const { initializeQueues } = await import('../jobs/queues.js');
    const queuesReady = await initializeQueues();
    redisConnected = queuesReady;
  } catch (error) {
    // Redis not available is not a critical error
    redisConnected = false;
  }

  // Prove required migrations have been applied. Without `PushTicket`, push
  // delivery still works, but receipt verification and dead-token cleanup are
  // degraded until `prisma migrate deploy` runs.
  const pushTicketTableReady = await isPushTicketStorageReady();

  const integrations = {
    database: !!process.env.DATABASE_URL,
    pushTicketMigration: pushTicketTableReady,
    jwt: !!process.env.JWT_SECRET,
    cloudinary: isCloudinaryConfigured(),
    twilio: isTwilioConfigured(),
    stripe: !!process.env.STRIPE_SECRET_KEY,
    sendgrid: sendgridReady,
    googleOAuth: !!process.env.GOOGLE_OAUTH_CLIENT_IDS,
    googleMaps: !!process.env.GOOGLE_MAPS_API_KEY,
    sentry: !!process.env.SENTRY_DSN,
    redis: redisConnected,
  };

  const allConfigured = Object.entries(integrations)
    .filter(([key]) => !['twilio', 'sentry', 'redis'].includes(key)) // Optional services
    .every(([, value]) => value);

  const stripePublishableKey =
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || '';
  const includePayments = req.query.include === 'payments';
  const body: Record<string, unknown> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    integrations,
    ready: allConfigured,
    warnings: [
      ...(!integrations.twilio ? ['Twilio not configured - SMS disabled'] : []),
      ...(!sendgridReady
        ? [
            missingEmailTemplates.length
              ? `SendGrid templates missing: ${missingEmailTemplates.join(', ')}`
              : 'SendGrid API key missing - transactional email disabled',
          ]
        : []),
      ...(!integrations.sentry ? ['Sentry not configured - error tracking disabled'] : []),
      ...(!integrations.redis
        ? ['Redis not configured - background jobs will use fallback mode']
        : []),
      ...(!integrations.pushTicketMigration
        ? [
            'PushTicket migration missing - push receipt verification and dead-token cleanup are disabled; run `npx prisma migrate deploy`',
          ]
        : []),
    ],
    metadata: {
      missingEmailTemplates,
    },
  };
  if (includePayments) {
    body.payments_config = {
      stripe_publishable_key: stripePublishableKey,
      available_plans: getAllPlanDefinitions(),
      payments_enabled: true,
      stripe_configured: !!(stripePublishableKey && process.env.STRIPE_SECRET_KEY),
      has_webhook_secret: !!process.env.STRIPE_WEBHOOK_SECRET,
    };
  }
  res.json(body);
});

/**
 * Sentry canary. Deliberately captures an exception so operators can confirm
 * the deployed DSN is wired correctly end-to-end. Protected by a shared token
 * in `SENTRY_CANARY_TOKEN` (set it in Railway env). Returns 404 when the
 * token is absent so the endpoint is invisible to unprivileged scanners.
 *
 * Usage:
 *   curl -s -H "X-Canary-Token: $SENTRY_CANARY_TOKEN" https://<api>/health/sentry-canary
 *
 * The response includes the event id echoed from Sentry so you can match it
 * in the Sentry issue detail URL — proves the right project received it.
 */
healthRouter.post('/sentry-canary', async (req, res) => {
  const expected = process.env.SENTRY_CANARY_TOKEN;
  if (!expected) return res.status(404).json({ error: 'Not found' });
  const supplied = req.header('X-Canary-Token');
  if (!supplied || supplied !== expected) {
    return res.status(404).json({ error: 'Not found' });
  }
  const marker = `release-pass-canary-${new Date().toISOString()}-${Math.random().toString(36).slice(2, 8)}`;
  const error = new Error(`Sentry canary fired: ${marker}`);
  (error as any).canary = true;
  captureException(error, { context: 'health_sentry_canary', marker });
  return res.json({
    ok: true,
    marker,
    message: 'Captured. Check Sentry for an event tagged `health_sentry_canary` with this marker in its context.',
  });
});
