import { app } from './app.js';
import { captureException } from './lib/sentry.js';
import { debugLog } from './lib/debugLog.js';
import { initEmailService } from './lib/email.js';
import { initializeQueues, shutdownQueues } from './jobs/queues.js';
import { setupScheduler, startSchedulerWorker } from './jobs/scheduler.js';
import { env } from './lib/env.js';

// Initialize SendGrid email service
await initEmailService();

// Initialize job queues (async, non-blocking)
initializeQueues().catch((error) => {
  console.error('[startup] Failed to initialize queues:', error);
  captureException(error, { context: 'queue_initialization' });
});

// Start scheduler (BullMQ with Redis, falls back to setInterval without it)
setupScheduler()
  .then(() => startSchedulerWorker())
  .catch((error) => {
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
process.on('uncaughtException', (error) => {
  console.error('[uncaughtException]', error);
  captureException(error, { context: 'uncaught_exception' });
  shutdown('uncaughtException').finally(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection]', reason);
  captureException(reason as Error, { context: 'unhandled_rejection', promise: String(promise) });
});

// Export app for testing or external usage
export { app };

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, HOST, () => {
    debugLog(`API listening on http://${HOST}:${PORT}`);
  });
}
// force rebuild 1773434047
