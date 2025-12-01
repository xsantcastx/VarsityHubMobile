import { Router } from 'express';
import { isCloudinaryConfigured } from '../lib/cloudinary.js';
import { isTwilioConfigured } from '../lib/twilio.js';
import { prisma } from '../lib/prisma.js';

export const healthRouter = Router();

/**
 * Health check endpoint with integration status
 * GET /health
 */
healthRouter.get('/', async (_req, res) => {
  // Fast DB readiness probe (SELECT 1) with timeout
  const dbProbe = async () => {
    try {
      const timeoutMs = Number(process.env.HEALTH_DB_TIMEOUT_MS || 1500);
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('db-timeout')), timeoutMs));
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        timeout,
      ]);
      return true;
    } catch {
      return false;
    }
  };

  const databaseReady = await dbProbe();

  const integrations = {
    database: databaseReady,
    jwt: !!process.env.JWT_SECRET,
    cloudinary: isCloudinaryConfigured(),
    twilio: isTwilioConfigured(),
    stripe: !!process.env.STRIPE_SECRET_KEY,
    smtp: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    googleOAuth: !!process.env.GOOGLE_OAUTH_CLIENT_IDS,
    googleMaps: !!process.env.GOOGLE_MAPS_API_KEY,
    sentry: !!process.env.SENTRY_DSN,
  } as const;

  const allConfigured = Object.entries(integrations)
    .filter(([key]) => !['twilio', 'sentry'].includes(key)) // Optional services
    .every(([, value]) => Boolean(value));

  const status = allConfigured ? 'ok' : 'degraded';
  const code = databaseReady ? 200 : 503;

  res.status(code).json({
    status,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    integrations,
    ready: allConfigured && databaseReady,
    warnings: [
      ...(!databaseReady ? ['Database not reachable'] : []),
      ...(!integrations.twilio ? ['Twilio not configured - SMS disabled'] : []),
      ...(!integrations.sentry ? ['Sentry not configured - error tracking disabled'] : []),
    ],
  });
});
