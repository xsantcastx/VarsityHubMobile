import { Router } from 'express';
import { isCloudinaryConfigured } from '../lib/cloudinary.js';
import { isTwilioConfigured } from '../lib/twilio.js';

export const healthRouter = Router();

/**
 * Health check endpoint with integration status
 * GET /health
 */
healthRouter.get('/', (req, res) => {
  const integrations = {
    database: !!process.env.DATABASE_URL,
    jwt: !!process.env.JWT_SECRET,
    cloudinary: isCloudinaryConfigured(),
    twilio: isTwilioConfigured(),
    stripe: !!process.env.STRIPE_SECRET_KEY,
    sendgrid: !!(process.env.SENDGRID_API_KEY && process.env.SENDGRID_VERIFICATION_TEMPLATE_ID),
    googleOAuth: !!process.env.GOOGLE_OAUTH_CLIENT_IDS,
    googleMaps: !!process.env.GOOGLE_MAPS_API_KEY,
    sentry: !!process.env.SENTRY_DSN,
  };

  const allConfigured = Object.entries(integrations)
    .filter(([key]) => !['twilio', 'sentry'].includes(key)) // Optional services
    .every(([, value]) => value);

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    integrations,
    ready: allConfigured,
    warnings: [
      ...(!integrations.twilio ? ['Twilio not configured - SMS disabled'] : []),
      ...(!integrations.sentry ? ['Sentry not configured - error tracking disabled'] : []),
    ],
  });
});
