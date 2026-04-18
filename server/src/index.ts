import { app } from './app.js';
import { captureException, captureMessage } from './lib/sentry.js';
import { debugLog } from './lib/debugLog.js';
import { initEmailService } from './lib/email.js';
import { initializeQueues, shutdownQueues } from './jobs/queues.js';
import { setupScheduler, startSchedulerWorker } from './jobs/scheduler.js';
import { env } from './lib/env.js';

// Initialize SendGrid email service
await initEmailService();

// v1.0.2: surface admin-email config issues at startup so silent-failures are obvious in logs
{
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (adminEmails.length === 0) {
    const msg =
      '[startup] ⚠️  ADMIN_EMAILS env var is empty — coach, ad, and league approval notifications will NOT be delivered';
    console.warn(msg);
    captureMessage(msg, 'warning');
  } else {
    console.log(
      `[startup] ADMIN_EMAILS configured: ${adminEmails.length} recipient(s) — first: ${adminEmails[0]}`
    );
  }
  if (!env.SENDGRID_API_KEY) {
    const msg =
      '[startup] ⚠️  SENDGRID_API_KEY is missing — all outbound email (verification, invites, admin notifications) will fail silently';
    console.warn(msg);
    captureMessage(msg, 'warning');
  }
}

// Initialize job queues (async, non-blocking)
initializeQueues().catch(error => {
  console.error('[startup] Failed to initialize queues:', error);
  captureException(error, { context: 'queue_initialization' });
});

// Start scheduler (BullMQ with Redis, falls back to setInterval without it)
setupScheduler()
  .then(() => startSchedulerWorker())
  .catch(error => {
    console.error('[startup] Scheduler failed to start:', error);
    captureException(error, { context: 'scheduler_startup' });
  });

const PORT = Number(env.PORT || 4000);
// Bind to 0.0.0.0 so the API is reachable from other devices on the LAN (useful for Expo on a phone/emulator)
const HOST: string = env.HOST || '0.0.0.0';

// Graceful shutdown handlers
const shutdown = async (signal: string) => {
  debugLog(`\n[shutdown] Received ${signal}, shutting down gracefully...`);
  try {
    await shutdownQueues();
    debugLog('[shutdown] Queues closed');
    // Disconnect Prisma to release DB connection pool slots
    const { prisma } = await import('./lib/prisma.js');
    await prisma.$disconnect();
    debugLog('[shutdown] Database disconnected');
    process.exit(0);
  } catch (error) {
    console.error('[shutdown] Error during shutdown:', error);
    captureException(error as Error, { context: 'graceful_shutdown' });
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', error => {
  console.error('[uncaughtException]', error);
  captureException(error, { context: 'uncaught_exception' });
  shutdown('uncaughtException').finally(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection]', reason);
  captureException(reason as Error, { context: 'unhandled_rejection', promise: String(promise) });
});

// Subscription expiry check is handled by the BullMQ scheduler (scheduler.ts line 277)
// — no duplicate node-cron job needed here.

async function runStartupChecks(): Promise<void> {
  const criticalVars: Array<{ key: string; label: string }> = [
    { key: 'REDIS_URL', label: 'REDIS_URL' },
    { key: 'SENDGRID_API_KEY', label: 'SENDGRID_API_KEY' },
    { key: 'STRIPE_WEBHOOK_SECRET', label: 'STRIPE_WEBHOOK_SECRET' },
    { key: 'DATABASE_URL', label: 'DATABASE_URL' },
  ];
  for (const { key, label } of criticalVars) {
    if (!process.env[key]) {
      console.error(`[startup] STARTUP: ${label} not configured`);
      captureMessage(`STARTUP: ${label} not configured`, 'error');
    }
  }
  if (!process.env.SENTRY_DSN) {
    console.error('[startup] STARTUP: SENTRY_DSN not configured — error tracking disabled');
  }

  // Ping the database
  try {
    const { prisma } = await import('./lib/prisma.js');
    await prisma.$queryRaw`SELECT 1`;
    debugLog('[startup] Database ping OK');
  } catch (dbErr) {
    console.error('[startup] STARTUP: Database ping failed:', dbErr);
    captureException(dbErr instanceof Error ? dbErr : new Error(String(dbErr)), {
      context: 'startup_db_ping_failed',
    });
  }

  // Ping Redis if configured (uses the BullMQ queue connection)
  if (process.env.REDIS_URL) {
    try {
      const { default: Redis } = await import('ioredis');
      const RedisCtor = Redis as unknown as new (url: string) => import('ioredis').default;
      const testConn = new RedisCtor(process.env.REDIS_URL);
      await testConn.ping();
      await testConn.quit();
      debugLog('[startup] Redis ping OK');
    } catch (redisErr) {
      console.error('[startup] STARTUP: Redis ping failed:', redisErr);
      captureException(redisErr instanceof Error ? redisErr : new Error(String(redisErr)), {
        context: 'startup_redis_ping_failed',
      });
    }
  }
}

runStartupChecks().catch(err => {
  console.error('[startup] runStartupChecks threw unexpectedly:', err);
});

// ONE-TIME: Ensure Apple Review demo account is verified & onboarded
// Safe to re-run (upsert). Remove after Apple approves build 90.
(async () => {
  if (!env.DEMO_ACCOUNT_PASSWORD) {
    debugLog(
      '[startup] DEMO_ACCOUNT_PASSWORD not set — skipping Apple Review demo account bootstrap'
    );
    return;
  }
  try {
    const { prisma } = await import('./lib/prisma.js');
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash(env.DEMO_ACCOUNT_PASSWORD, 10);
    await prisma.user.upsert({
      where: { email: 'demo@varsityhub.app' },
      update: {
        password_hash: hash,
        display_name: 'Demo User',
        username: 'appledemo',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: {
          onboarding_completed: true,
          role: 'fan',
          plan: 'rookie',
          affiliation: 'none',
          dob: '2000-01-15',
          notifications: {
            game_event_reminders: false,
            team_updates: false,
            comments_upvotes: false,
            follows_notifications: true,
            messages_notifications: true,
          },
        },
      },
      create: {
        email: 'demo@varsityhub.app',
        password_hash: hash,
        display_name: 'Demo User',
        username: 'appledemo',
        email_verified: true,
        approval_status: 'APPROVED',
        subscription_tier: 'free',
        subscription_status: 'active',
        max_teams: 3,
        preferences: {
          onboarding_completed: true,
          role: 'fan',
          plan: 'rookie',
          affiliation: 'none',
          dob: '2000-01-15',
          notifications: {
            game_event_reminders: false,
            team_updates: false,
            comments_upvotes: false,
            follows_notifications: true,
            messages_notifications: true,
          },
        },
      },
    });
    debugLog('[startup] Demo account (demo@varsityhub.app) ready for Apple Review');
  } catch (e) {
    console.error('[startup] Demo account setup failed:', e);
  }
})();

// Export app for testing or external usage
export { app };

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, HOST, () => {
    debugLog(`API listening on http://${HOST}:${PORT}`);
  });
}
