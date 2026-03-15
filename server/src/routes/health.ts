import { Router } from 'express';
import { isCloudinaryConfigured } from '../lib/cloudinary.js';
import { getMissingEmailTemplates, getMissingRecommendedTemplates, isSendGridConfigured } from '../lib/email.js';
import { getAllPlanDefinitions } from '../lib/planLimits.js';
import { prisma } from '../lib/prisma.js';
import { getEmailService } from '../services/email/service.js';
import { isTwilioConfigured } from '../lib/twilio.js';
import type { AuthedRequest } from '../middleware/auth.js';

export const healthRouter = Router();

/**
 * Health check endpoint
 * GET /health
 *
 * SECURITY: Only returns minimal info publicly.
 * Detailed integration status requires admin authentication.
 * GET /health?include=payments - also returns payments config (fallback when /payments/config 404s)
 */
healthRouter.get('/', async (req: AuthedRequest, res) => {
  let isAdmin = false;
  if (req.user?.id) {
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (adminEmails.length > 0) {
      const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true } });
      isAdmin = !!user?.email && adminEmails.includes(user.email.toLowerCase());
    }
  }

  // Public health check - minimal info for load balancers / monitoring
  if (!isAdmin) {
    return res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  }

  // Admin-only detailed health check
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
    redis: redisConnected,
  };

  const allConfigured = Object.entries(integrations)
    .filter(([key]) => !['twilio', 'sentry', 'redis'].includes(key)) // Optional services
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
      ...(!integrations.sentry ? ['Sentry not configured - error tracking disabled'] : []),
      ...(!integrations.redis ? ['Redis not configured - background jobs will use fallback mode'] : []),
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
});

