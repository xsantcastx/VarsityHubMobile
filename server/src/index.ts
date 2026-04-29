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
  const adminNotificationEmails = (
    process.env.ADMIN_NOTIFICATION_EMAILS || process.env.ADMIN_EMAILS || ''
  )
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (adminEmails.length === 0) {
    const msg =
      '[startup] ⚠️  ADMIN_EMAILS env var is empty — no one will have admin dashboard access';
    console.warn(msg);
    captureMessage(msg, 'warning');
  } else {
    console.log(`[startup] ADMIN_EMAILS configured: ${adminEmails.length} recipient(s)`);
  }
  if (adminNotificationEmails.length === 0) {
    const msg =
      '[startup] ⚠️  ADMIN_NOTIFICATION_EMAILS/ADMIN_EMAILS env vars are empty — coach, ad, and league approval notifications will NOT be delivered';
    console.warn(msg);
    captureMessage(msg, 'warning');
  } else {
    console.log(
      `[startup] ADMIN_NOTIFICATION_EMAILS configured: ${adminNotificationEmails.length} recipient(s)`
    );
  }
  if (!env.SENDGRID_API_KEY) {
    const msg =
      '[startup] ⚠️  SENDGRID_API_KEY is missing — all outbound email (verification, invites, admin notifications) will fail silently';
    console.warn(msg);
    captureMessage(msg, 'warning');
  }
}

// v1.0.3: validate SendGrid template ID formats on boot to catch bad GUIDs early.
{
  const templateVars = [
    'SENDGRID_VERIFICATION_TEMPLATE_ID',
    'SENDGRID_USER_CONFIRMATION_TEMPLATE_ID',
    'SENDGRID_PASSWORD_RESET_TEMPLATE_ID',
    'SENDGRID_TEAM_INVITE_TEMPLATE_ID',
    'SENDGRID_ORG_INVITE_TEMPLATE_ID',
    'SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID',
    'SENDGRID_LEAGUE_PENDING_APPROVAL_TEMPLATE_ID',
    'SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID',
    'SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID',
    'SENDGRID_EVENT_APPROVED_TEMPLATE_ID',
    'SENDGRID_EVENT_DENIED_TEMPLATE_ID',
    'SENDGRID_EVENT_CANCELED_TEMPLATE_ID',
    'SENDGRID_EVENT_CANCELLATION_TEMPLATE_ID',
    'SENDGRID_PAYMENT_FAILED_TEMPLATE_ID',
    'SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID',
    'SENDGRID_AD_PENDING_REVIEW_TEMPLATE_ID',
    'SENDGRID_AD_APPROVED_TEMPLATE_ID',
    'SENDGRID_AD_REJECTED_TEMPLATE_ID',
    'SENDGRID_AD_PAYMENT_CONFIRMED_TEMPLATE_ID',
    'SENDGRID_AD_TAKEN_DOWN_PENDING_REVIEW_TEMPLATE_ID',
    'SENDGRID_ORG_APPROVAL_TEMPLATE_ID',
    'SENDGRID_ORG_DENIAL_TEMPLATE_ID',
    'SENDGRID_ADMIN_ACTION_CONFIRMATION_TEMPLATE_ID',
    'SENDGRID_PARENTAL_CONSENT_REQUEST_TEMPLATE_ID',
  ];
  // SendGrid accepts both compact (d-{32 hex}) and hyphenated (d-{uuid}) forms.
  // The compact form is 34 chars total; hyphenated is 38. Earlier versions of
  // this validator only accepted the hyphenated form, which false-flagged
  // every correctly-configured env value in Railway.
  const compactFormat = /^d-[0-9a-f]{32}$/i;
  const hyphenatedFormat = /^d-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const templateIdPattern = {
    test: (v: string) => compactFormat.test(v) || hyphenatedFormat.test(v),
  };
  const invalid: Array<{
    key: string;
    length: number;
    prefix: string;
    startsWithD: boolean;
    hyphens: number;
    issue: string;
  }> = [];

  for (const key of templateVars) {
    const raw = process.env[key];
    if (!raw) continue;
    const value = raw.trim();
    if (templateIdPattern.test(value)) continue;

    // Diagnostic fingerprint — safe to log, doesn't expose the full secret.
    let issue = 'does not match d-{uuid} format (expected d-{32 hex} or d-{8-4-4-4-12 hex})';
    if (!value.startsWith('d-')) issue = 'missing d- prefix (legacy V2 template? regenerate as dynamic in SendGrid)';
    else if (value.length !== 34 && value.length !== 38) issue = `wrong length (${value.length}, expected 34 compact or 38 hyphenated)`;
    else if (value !== raw) issue = 'contains leading/trailing whitespace in the env value';
    else if (/[^0-9a-f-]/i.test(value.slice(2))) issue = 'contains non-hex characters';

    invalid.push({
      key,
      length: raw.length,
      prefix: raw.slice(0, 4),
      startsWithD: raw.trim().startsWith('d-'),
      hyphens: (raw.match(/-/g) || []).length,
      issue,
    });
  }

  // v1.0.3: log fingerprint of EVERY configured template, not just invalid
  // ones. Lets ops cross-reference each key's prefix with the Railway UI
  // without exposing secrets. Unset vars are listed explicitly so missing
  // config is visible too.
  console.log(`[startup] SendGrid template IDs from Railway env (${templateVars.length} total):`);
  for (const key of templateVars) {
    const raw = process.env[key];
    if (!raw) {
      console.log(`  ⚪ ${key}: not set`);
      continue;
    }
    const trimmed = raw.trim();
    const ok = templateIdPattern.test(trimmed);
    const hasWhitespace = trimmed !== raw;
    const icon = ok && !hasWhitespace ? '✅' : ok && hasWhitespace ? '🟡' : '⚠️';
    const wsNote = hasWhitespace ? ' (paste has whitespace — auto-trimmed by email.ts)' : '';
    console.log(`  ${icon} ${key}: prefix="${trimmed.slice(0, 4)}" len=${trimmed.length}${wsNote}`);
  }

    if (invalid.length > 0) {
    console.warn(`[startup] ⚠️  ${invalid.length} of ${templateVars.length} SendGrid template ID(s) failed format check:`);
    for (const entry of invalid) {
      console.warn(`    ${entry.key}: ${entry.issue}`);
    }
    captureMessage(
      `Invalid SendGrid template ID format: ${invalid.map(i => i.key).join(', ')}`,
      'warning',
      {
        context: 'sendgrid_template_validation',
        tags: {
          provider: 'sendgrid',
          job: 'startup',
        },
        invalidTemplateKeys: invalid.map(i => i.key),
      }
    );
  } else {
    console.log(`[startup] ✅ All configured SendGrid template IDs pass format check`);
  }
}

// v1.0.3: Cloudinary auth smoke test on boot. Runs a 1x1 PNG probe against
// Cloudinary signed upload, logs the exact outcome to Railway stdout so any
// signature/credential drift is visible within the first 10 seconds of a
// deploy (instead of surfacing only when a user tries an upload).
void (async () => {
  try {
    const { isCloudinaryConfigured, getCloudinaryCredentials, getCloudinaryFolder, uploadBufferToCloudinary, CloudinaryUpstreamError } = await import('./lib/cloudinary.js');
    if (!isCloudinaryConfigured()) {
      console.warn('[startup] Cloudinary not configured — uploads will fail');
      return;
    }
    const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials();
    const folder = getCloudinaryFolder();
    console.log(`[startup] Cloudinary config: cloud=${cloudName} key_prefix=${apiKey.slice(0,4)}… secret_fingerprint=${apiSecret.slice(0,3)}…[${apiSecret.length}ch] folder=${folder}`);
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );
    await uploadBufferToCloudinary(
      {
        buffer: tinyPng,
        originalname: 'startup-probe.png',
        mimetype: 'image/png',
        size: tinyPng.length,
      } as any,
      { resourceType: 'image' }
    );
    console.log('[startup] ✅ Cloudinary auth probe: OK — signed upload accepted');
  } catch (err: any) {
    const isUpstream = err?.name === 'CloudinaryUpstreamError';
    const kind = isUpstream ? err.kind : 'unknown';
    const httpCode = isUpstream ? err.http_code : undefined;
    const message = err?.message || String(err);
    console.error(`[startup] ❌ Cloudinary auth probe FAILED — kind=${kind} http=${httpCode} message="${message}"`);
    if (kind === 'invalid_signature') {
      console.error('[startup] HINT: CLOUDINARY_API_SECRET on Railway does not match Cloudinary dashboard. Open Cloudinary → Settings → API Keys → copy API Secret → paste into Railway CLOUDINARY_API_SECRET → save → redeploy.');
    } else if (kind === 'unauthorized') {
      console.error('[startup] HINT: CLOUDINARY_API_KEY on Railway does not match Cloudinary dashboard. Verify it in Cloudinary → Settings → API Keys.');
    }
    captureMessage(`Cloudinary boot probe failed: ${message}`, 'error', {
      context: 'cloudinary_boot_probe',
      tags: {
        provider: 'cloudinary',
        job: 'startup',
      },
      kind,
      httpCode,
    });
  }
})();

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
        role: 'fan',
        onboarding_completed: true,
        plan: 'rookie',
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
        role: 'fan',
        onboarding_completed: true,
        plan: 'rookie',
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
