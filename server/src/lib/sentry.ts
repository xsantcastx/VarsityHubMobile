import * as Sentry from '@sentry/node';
import crypto from 'node:crypto';
import type { Express } from 'express';

const debugLog = (...args: Parameters<typeof console.log>) => {
  if (process.env.ENABLE_SERVER_DEBUG_LOGS === 'true' || process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

/**
 * Initialize Sentry error tracking
 */
export function initSentry(app: Express) {
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';

  if (!dsn) {
    debugLog('⚠️ Sentry DSN not configured - error tracking disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
    ],
    // Performance Monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    maxBreadcrumbs: 50,
    attachStacktrace: true,
    beforeSend(event: any) {
      // Filter out health checks and non-error requests
      if (event.request?.url?.includes('/health')) {
        return null;
      }
      return event;
    },
  });

  // Request handler - should be the first middleware
  app.use(Sentry.Handlers.requestHandler());

  // Tracing middleware
  app.use(Sentry.Handlers.tracingHandler());

  debugLog(`✅ Sentry initialized for ${environment} environment`);
}

/**
 * Add error handler middleware (should be last)
 */
export function addSentryErrorHandler(app: Express) {
  app.use(Sentry.Handlers.errorHandler());
}

/**
 * Manually capture exception
 */
export function captureException(error: Error | string, context?: Record<string, any>) {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('additional', context);
    }
    if (typeof error === 'string') {
      Sentry.captureMessage(error, 'error');
    } else {
      Sentry.captureException(error);
    }
  });
}

/**
 * Manually capture message
 */
export function captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info') {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId: string, email?: string, username?: string) {
  const hashedUserId = crypto.createHash('sha256').update(userId).digest('hex').slice(0, 16);
  Sentry.setUser({
    id: `u_${hashedUserId}`,
  });
}

/**
 * Clear user context
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message: string, category: string = 'custom', level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info', data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
  });
}
