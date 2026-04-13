import * as Sentry from '@sentry/node';
import type { Express } from 'express';
import { debugLog } from './debugLog.js';
import { getBuildMetadata, resolveBuildSha, resolveReleaseName } from './release.js';

type SentryCaptureContext = {
  context?: string;
  extra?: Record<string, any>;
  tags?: Record<string, string | number | boolean | null | undefined>;
  user?: {
    id?: string;
    email?: string;
    username?: string;
  };
  level?: Sentry.SeverityLevel;
  [key: string]: any;
};

const applyScopeContext = (scope: Sentry.Scope, context?: SentryCaptureContext) => {
  if (!context) return;

  if (context.tags) {
    for (const [key, value] of Object.entries(context.tags)) {
      if (value !== undefined && value !== null) {
        scope.setTag(key, String(value));
      }
    }
  }

  if (context.user) {
    scope.setUser({
      id: context.user.id,
      email: context.user.email,
      username: context.user.username,
    });
  }

  if (context.context) {
    scope.setContext('capture_context', { name: context.context });
  }

  if (context.extra) {
    scope.setContext('extra', context.extra);
  }

  const passthroughEntries = Object.entries(context).filter(
    ([key]) => !['context', 'extra', 'tags', 'user', 'level'].includes(key)
  );
  if (passthroughEntries.length > 0) {
    scope.setContext('additional', Object.fromEntries(passthroughEntries));
  }
};

/**
 * Initialize Sentry error tracking
 */
export function initSentry(app: Express) {
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';
  const release = resolveReleaseName(process.env, 'varsityhub-server');
  const build = getBuildMetadata(process.env, 'varsityhub-server');

  if (!dsn) {
    debugLog('⚠️ Sentry DSN not configured - error tracking disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment,
    release: release ?? undefined,
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
    initialScope: (scope) => {
      if (build.sha) {
        scope.setTag('commit_sha', build.sha);
      }
      if (build.release) {
        scope.setTag('release_name', build.release);
      }
      return scope;
    },
  });

  // Request handler - should be the first middleware
  app.use(Sentry.Handlers.requestHandler());

  // Tracing middleware
  app.use(Sentry.Handlers.tracingHandler());

  debugLog(`✅ Sentry initialized for ${environment} environment${release ? ` (${release})` : ''}`);
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
  if (typeof error === 'string') {
    Sentry.withScope((scope) => {
      applyScopeContext(scope, context);
      Sentry.captureMessage(error, 'error');
    });
    return;
  }

  Sentry.withScope((scope) => {
    applyScopeContext(scope, context);
    Sentry.captureException(error);
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
  Sentry.configureScope((scope) => {
    scope.setUser({
      id: userId,
      email,
      username,
    });
  });
}

/**
 * Clear user context
 */
export function clearUserContext() {
  Sentry.configureScope((scope) => {
    scope.setUser(null);
  });
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

export function bindRequestContext(context: {
  requestId: string;
  method: string;
  path: string;
  userId?: string;
}) {
  const buildSha = resolveBuildSha();
  Sentry.configureScope((scope) => {
    scope.setTag('request_id', context.requestId);
    if (buildSha) {
      scope.setTag('commit_sha', buildSha);
    }
    scope.setTransactionName(`${context.method} ${context.path}`);
    scope.setContext('request', {
      id: context.requestId,
      method: context.method,
      path: context.path,
      userId: context.userId ?? null,
    });
    if (context.userId) {
      scope.setUser({ id: context.userId });
    }
  });
}
