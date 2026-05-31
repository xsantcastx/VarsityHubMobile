import { PrismaClient } from '@prisma/client';
import { debugLog } from './debugLog.js';
import './load-env.js';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID != null;
const withTestPoolLimits = (rawUrl: string): string => {
  try {
    const url = new URL(rawUrl);
    // Jest loads many isolated Prisma clients across the suite. Cap each test
    // client to a single DB connection so the aggregate doesn't exhaust Postgres.
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '1');
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '20');
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
};

const prismaDatasourceUrl =
  isTest && process.env.DATABASE_URL
    ? withTestPoolLimits(process.env.DATABASE_URL)
    : process.env.DATABASE_URL;

// Runtime diagnostic: mask password in DATABASE_URL and log connection pool settings
(() => {
  const raw = prismaDatasourceUrl;
  if (raw) {
    const masked = raw.replace(/(postgresql:\/\/[^:]+):[^@]*@/, '$1:***@');
    const preview = masked.length > 140 ? masked.slice(0, 140) + '…' : masked;
    debugLog('[env] DATABASE_URL (masked preview):', preview);

    // Parse and log connection pool settings
    try {
      const url = new URL(raw);
      const connectionLimit = url.searchParams.get('connection_limit');
      const poolTimeout = url.searchParams.get('pool_timeout');
      if (
        isProduction &&
        process.env.PRISMA_SKIP_POOL_GUARD !== '1' &&
        !connectionLimit &&
        !poolTimeout
      ) {
        console.warn(
          '[prisma] Production DATABASE_URL does not include connection_limit or pool_timeout query params. Startup will continue, but set them explicitly in Railway for predictable pool behavior.'
        );
      }
      if (connectionLimit || poolTimeout) {
        debugLog(
          `[prisma] Connection pool: limit=${connectionLimit || 'default'}, timeout=${poolTimeout || 'default'}s`
        );
      } else {
        debugLog('[prisma] ⚠️ No connection pool configured. For production, add to DATABASE_URL:');
        debugLog('[prisma]    ?connection_limit=20&pool_timeout=10');
      }
    } catch {
      // URL parsing failed, skip pool logging
    }
  } else {
    debugLog('[env] DATABASE_URL is not set (prisma init)');
  }
})();

/**
 * Prisma Client with production-ready configuration
 *
 * Connection pooling is controlled via DATABASE_URL parameters:
 * - connection_limit: Max concurrent connections (default 5, recommend 20 for production)
 * - pool_timeout: Seconds to wait for connection (default 10)
 *
 * Example: postgresql://user:pass@host/db?connection_limit=20&pool_timeout=10
 */
export const prisma = new PrismaClient({
  ...(prismaDatasourceUrl ? { datasourceUrl: prismaDatasourceUrl } : {}),
  log: isProduction ? ['error'] : ['query', 'error', 'warn'],
});

if (isTest) {
  (globalThis as typeof globalThis & { __VARSITYHUB_TEST_PRISMA__?: PrismaClient }).__VARSITYHUB_TEST_PRISMA__ =
    prisma;
}

const getTrimmed = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  return value.trim();
};

const POST_SOFT_DELETE_READ_ACTIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

const hasDeletedAtFilter = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasDeletedAtFilter);

  const record = value as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, 'deleted_at')) return true;
  return Object.values(record).some(hasDeletedAtFilter);
};

const applyPostSoftDeleteScope = (params: any) => {
  if (params.model !== 'Post' || !POST_SOFT_DELETE_READ_ACTIONS.has(params.action)) {
    return params;
  }

  const args = params.args ?? {};
  const where = args.where;
  if (hasDeletedAtFilter(where)) {
    return params;
  }

  if (params.action === 'findUnique') {
    params.action = 'findFirst';
  }
  if (params.action === 'findUniqueOrThrow') {
    params.action = 'findFirstOrThrow';
  }

  params.args = {
    ...args,
    where: where ? { ...where, deleted_at: null } : { deleted_at: null },
  };

  return params;
};

const validateNonEmpty = (value: unknown, label: string) => {
  const trimmed = getTrimmed(value);
  if (trimmed !== null && trimmed.length === 0) {
    throw new Error(`${label} is required`);
  }
};

prisma.$use(async (params, next) => {
  applyPostSoftDeleteScope(params);

  if (params.model === 'Team') {
    const data = params.args?.data ?? {};
    if (
      params.action === 'create' ||
      params.action === 'update' ||
      params.action === 'updateMany'
    ) {
      const name = (data as any).name ?? (data as any)?.name?.set;
      validateNonEmpty(name, 'Team name');
    }
    if (params.action === 'upsert') {
      validateNonEmpty((data as any)?.create?.name, 'Team name');
      validateNonEmpty(
        (data as any)?.update?.name ?? (data as any)?.update?.name?.set,
        'Team name'
      );
    }
  }
  if (params.model === 'Event') {
    const data = params.args?.data ?? {};
    if (
      params.action === 'create' ||
      params.action === 'update' ||
      params.action === 'updateMany'
    ) {
      const title = (data as any).title ?? (data as any)?.title?.set;
      validateNonEmpty(title, 'Event title');
    }
    if (params.action === 'upsert') {
      validateNonEmpty((data as any)?.create?.title, 'Event title');
      validateNonEmpty(
        (data as any)?.update?.title ?? (data as any)?.update?.title?.set,
        'Event title'
      );
    }
  }
  return next(params);
});
