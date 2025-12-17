import { Router } from 'express';
import { isCloudinaryConfigured } from '../lib/cloudinary.js';
import { getMissingEmailTemplates, isSendGridConfigured } from '../lib/email.js';
import { isTwilioConfigured } from '../lib/twilio.js';

export const healthRouter = Router();

/**
 * Health check endpoint with integration status
 * GET /health
 */
healthRouter.get('/', (req, res) => {
  const missingEmailTemplates = getMissingEmailTemplates();
  const sendgridReady = isSendGridConfigured() && missingEmailTemplates.length === 0;
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

  res.json({
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
    ],
    metadata: {
      missingEmailTemplates,
      debug: { sgKeyLen, nodeEnv: process.env.NODE_ENV },
    },
  });
});
