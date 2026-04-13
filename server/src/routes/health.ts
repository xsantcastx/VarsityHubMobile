import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { getQueueStats } from '../jobs/queues.js';
import { isCloudinaryConfigured } from '../lib/cloudinary.js';
import { getMissingEmailTemplates, getMissingRecommendedTemplates, isSendGridConfigured } from '../lib/email.js';
import { getAllPlanDefinitions } from '../lib/planLimits.js';
import { getEmailService } from '../services/email/service.js';
import { getBuildMetadata } from '../lib/release.js';
import { isTwilioConfigured } from '../lib/twilio.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const healthRouter = Router();

type MigrationRow = {
  migration_name: string;
  started_at: Date | null;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  applied_steps_count: number;
};

const getMigrationsDirCandidates = () => [
  path.resolve(process.cwd(), 'prisma', 'migrations'),
  path.resolve(process.cwd(), 'server', 'prisma', 'migrations'),
];

async function getExpectedMigrationNames(): Promise<string[]> {
  for (const candidate of getMigrationsDirCandidates()) {
    try {
      const entries = await readdir(candidate, { withFileTypes: true });
      const names = entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => entry.name)
        .sort();
      if (names.length > 0) {
        return names;
      }
    } catch {
      // Try the next candidate path.
    }
  }
  return [];
}

async function getDatabaseStatus() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      reachable: true,
      ping_ms: Date.now() - startedAt,
    };
  } catch {
    return {
      reachable: false,
      ping_ms: Date.now() - startedAt,
    };
  }
}

async function getMigrationState() {
  try {
    const [rows, expectedMigrations] = await Promise.all([
      prisma.$queryRaw<MigrationRow[]>`
        SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count
        FROM "_prisma_migrations"
        ORDER BY COALESCE(finished_at, started_at) DESC
      `,
      getExpectedMigrationNames(),
    ]);

    const applied = rows.filter((row) => row.finished_at && !row.rolled_back_at);
    const inFlight = rows.filter((row) => row.started_at && !row.finished_at && !row.rolled_back_at);
    const rolledBack = rows.filter((row) => row.rolled_back_at);
    const appliedNames = new Set(applied.map((row) => row.migration_name));
    const pending = expectedMigrations.filter((name) => !appliedNames.has(name));

    return {
      ready: pending.length === 0 && inFlight.length === 0 && rolledBack.length === 0,
      expected_count: expectedMigrations.length || null,
      applied_count: applied.length,
      pending_count: pending.length,
      pending,
      in_flight: inFlight.map((row) => row.migration_name),
      rolled_back: rolledBack.map((row) => row.migration_name),
      last_applied: applied[0]
        ? {
            name: applied[0].migration_name,
            finished_at: applied[0].finished_at?.toISOString() ?? null,
            applied_steps_count: applied[0].applied_steps_count,
          }
        : null,
    };
  } catch (error) {
    return {
      ready: false,
      expected_count: null,
      applied_count: null,
      pending_count: null,
      pending: [],
      in_flight: [],
      rolled_back: [],
      last_applied: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

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
  const databaseStatus = await getDatabaseStatus();
  if (!secret || !provided || provided !== secret) {
    if (databaseStatus.reachable) {
      return res.json({ status: 'ok' });
    }
    return res.status(503).json({ status: 'error', message: 'Database unreachable' });
  }

  const missingEmailTemplates = getMissingEmailTemplates();
  const missingRecommendedTemplates = getMissingRecommendedTemplates();
  const emailService = getEmailService();
  const emailServiceReady = emailService.isConfigured() && emailService.validateConfig().valid;
  const sendgridReady = isSendGridConfigured() && missingEmailTemplates.length === 0 && emailServiceReady;
  const [migrationState, queueStats] = await Promise.all([
    getMigrationState(),
    getQueueStats().catch((error) => ({
      redis: false,
      queues: {},
      error: error instanceof Error ? error.message : String(error),
    })),
  ]);

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
    database: databaseStatus.reachable,
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
    migrations: migrationState.ready,
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
      ...(!integrations.appleIAP ? ['Apple IAP shared secret missing - receipt validation disabled'] : []),
      ...(!integrations.sentry ? ['Sentry not configured - error tracking disabled'] : []),
      ...(!integrations.redis ? ['Redis not configured - background jobs will use fallback mode'] : []),
      ...(!integrations.migrations ? ['Database migrations are not fully applied'] : []),
    ],
    metadata: {
      requestId: req.id != null ? String(req.id) : null,
      build: getBuildMetadata(process.env, 'varsityhub-server'),
      database: {
        ping_ms: databaseStatus.ping_ms,
      },
      queue_depth: queueStats,
      migration_state: migrationState,
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
