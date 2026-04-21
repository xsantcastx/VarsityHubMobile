import { Router } from 'express';
import { isCloudinaryConfigured } from '../lib/cloudinary.js';
import { getMissingEmailTemplates, getMissingRecommendedTemplates, isSendGridConfigured, sendVerificationEmail } from '../lib/email.js';
import { getAllPlanDefinitions } from '../lib/planLimits.js';
import { getEmailService } from '../services/email/service.js';
import { isTwilioConfigured } from '../lib/twilio.js';
import { prisma } from '../lib/prisma.js';
import { getObjectStorageAdapter } from '../lib/objectStorage.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const healthRouter = Router();

/**
 * Health check endpoint
 * GET /health
 *
 * Returns full integration status (booleans only, no secrets).
 * GET /health?include=payments - also returns payments config (fallback when /payments/config 404s)
 */
healthRouter.get('/', asyncHandler(async (req: AuthedRequest, res) => {
  // Only return detailed status if the caller provides the correct secret
  const secret = process.env.HEALTH_CHECK_SECRET;
  const provided = req.headers['x-health-check-secret'] as string | undefined;
  if (!secret || !provided || provided !== secret) {
    // Basic health: verify DB connectivity with a real query
    try {
      await prisma.$queryRaw`SELECT 1`;
      return res.json({ status: 'ok' });
    } catch {
      return res.status(503).json({ status: 'error', message: 'Database unreachable' });
    }
  }

  const missingEmailTemplates = getMissingEmailTemplates();
  const missingRecommendedTemplates = getMissingRecommendedTemplates();
  const emailService = getEmailService();
  const emailServiceReady = emailService.isConfigured() && emailService.validateConfig().valid;
  const sendgridReady = isSendGridConfigured() && missingEmailTemplates.length === 0 && emailServiceReady;

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

  // Data export storage adapter (R2 / S3-compatible). Surfaces whether the
  // four required env vars are present so ops can verify before smoke-testing
  // the GDPR export flow. Matches the `isConfigured()` contract on the adapter.
  const dataExportStorageReady = (() => {
    try {
      return getObjectStorageAdapter().isConfigured();
    } catch {
      return false;
    }
  })();

  const integrations = {
    database: await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    jwt: !!process.env.JWT_SECRET,
    cloudinary: isCloudinaryConfigured(),
    twilio: isTwilioConfigured(),
    stripe: !!process.env.STRIPE_SECRET_KEY,
    sendgrid: sendgridReady,
    googleOAuth: !!process.env.GOOGLE_OAUTH_CLIENT_IDS,
    googleMaps: !!process.env.GOOGLE_MAPS_API_KEY,
    appleIAP: !!process.env.APPLE_IAP_SHARED_SECRET,
    sentry: !!process.env.SENTRY_DSN,
    redis: redisConnected,
    dataExportStorage: dataExportStorageReady,
  };

  const allConfigured = Object.entries(integrations)
    .filter(([key]) => !['twilio', 'sentry', 'redis', 'dataExportStorage'].includes(key)) // Optional services
    .every(([, value]) => value);

  const stripePublishableKey =
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
    process.env.STRIPE_PUBLISHABLE_KEY ||
    '';
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
              ? `SendGrid critical templates missing: ${missingEmailTemplates.join(', ')}`
              : 'SendGrid API key missing - transactional email disabled',
          ]
        : []),
      ...(missingRecommendedTemplates.length
        ? [`SendGrid recommended templates missing (non-blocking): ${missingRecommendedTemplates.join(', ')}`]
        : []),
      ...(!integrations.appleIAP ? ['Apple IAP shared secret missing - receipt validation disabled'] : []),
      ...(!integrations.sentry ? ['Sentry not configured - error tracking disabled'] : []),
      ...(!integrations.redis ? ['Redis not configured - background jobs will use fallback mode'] : []),
      ...(!integrations.dataExportStorage
        ? ['Data export storage not configured - POST /me/data-export will return 503 (set DATA_EXPORT_S3_BUCKET, DATA_EXPORT_S3_REGION, DATA_EXPORT_S3_ACCESS_KEY_ID, DATA_EXPORT_S3_SECRET_ACCESS_KEY)']
        : []),
    ],
    metadata: {
      missingEmailTemplates,
      missingRecommendedTemplates,
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
}));

/**
 * v1.0.2 audit addition: /health/email
 * Focused email-system smoke test. Requires HEALTH_CHECK_SECRET to avoid exposing template IDs.
 * Returns 200 if SendGrid is wired up + critical templates present; 503 otherwise.
 * Use for external monitoring (UptimeRobot, etc.) and quick CI checks post-deploy.
 */
healthRouter.get('/email', asyncHandler(async (req: AuthedRequest, res) => {
  const secret = process.env.HEALTH_CHECK_SECRET;
  const provided = req.headers['x-health-check-secret'] as string | undefined;
  if (!secret || !provided || provided !== secret) {
    return res.status(401).json({ status: 'unauthorized' });
  }
  const missingEmailTemplates = getMissingEmailTemplates();
  const missingRecommended = getMissingRecommendedTemplates();
  const emailService = getEmailService();
  const serviceReady = emailService.isConfigured() && emailService.validateConfig().valid;
  const sendgridOk = isSendGridConfigured();
  const ready = sendgridOk && serviceReady && missingEmailTemplates.length === 0;
  // If ?probe=<email> is provided, send a real verification-style email
  // to test end-to-end deliverability (not just config).
  const probeAddress = req.query.probe as string | undefined;
  if (probeAddress) {
    if (!ready) {
      return res.status(503).json({
        status: 'not_ready',
        message: 'Email service not configured — cannot send probe',
        sendgrid_configured: sendgridOk,
        service_ready: serviceReady,
        missing_critical_templates: missingEmailTemplates,
      });
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(probeAddress)) {
      return res.status(400).json({ status: 'invalid_email', probe: probeAddress });
    }

    const probeCode = '000000';
    const startMs = Date.now();
    try {
      const sent = await sendVerificationEmail(probeAddress, probeCode, 'VarsityHub Probe');
      const durationMs = Date.now() - startMs;
      return res.status(sent ? 200 : 502).json({
        status: sent ? 'delivered' : 'rejected',
        probe: probeAddress,
        duration_ms: durationMs,
        message: sent
          ? 'SendGrid accepted the email — check inbox/spam for delivery confirmation'
          : 'sendVerificationEmail returned false — check Railway logs for EMAIL_AUDIT and SendGridProvider errors',
      });
    } catch (error: any) {
      const durationMs = Date.now() - startMs;
      return res.status(502).json({
        status: 'error',
        probe: probeAddress,
        duration_ms: durationMs,
        error: error.message || 'Unknown error',
      });
    }
  }

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'degraded',
    sendgrid_configured: sendgridOk,
    service_ready: serviceReady,
    missing_critical_templates: missingEmailTemplates,
    missing_recommended_templates: missingRecommended,
    timestamp: new Date().toISOString(),
  });
}));

