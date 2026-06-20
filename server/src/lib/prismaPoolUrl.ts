/**
 * Pure helper (no side effects) for applying connection-pool params to a Prisma
 * datasource URL. Kept separate from prisma.ts so it's unit-testable without
 * constructing a PrismaClient.
 *
 * Explicit params already present in the URL ALWAYS win — we only fill gaps.
 *   - test:       cap each isolated Jest client to 1 connection (pool_timeout=20)
 *                 so the suite doesn't exhaust Postgres.
 *   - production: apply the project's recommended defaults (connection_limit=20,
 *                 pool_timeout=10). Without an explicit pool_timeout a saturated
 *                 pool *hangs* until the socket dies and surfaces as intermittent
 *                 "can't reach database server" errors in cron jobs; a fail-fast
 *                 timeout turns that into a clear, retryable error.
 *   - dev:        left untouched.
 */
export type PoolMode = { isTest: boolean; isProduction: boolean };

export function withPoolLimits(rawUrl: string, mode: PoolMode): string {
  try {
    const url = new URL(rawUrl);
    if (mode.isTest) {
      if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '1');
      if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '20');
    } else if (mode.isProduction) {
      if (!url.searchParams.has('connection_limit')) {
        url.searchParams.set('connection_limit', process.env.PRISMA_CONNECTION_LIMIT || '20');
      }
      if (!url.searchParams.has('pool_timeout')) {
        url.searchParams.set('pool_timeout', process.env.PRISMA_POOL_TIMEOUT || '10');
      }
    }
    return url.toString();
  } catch {
    // Not a parseable URL (e.g. a unix-socket DSN) — leave it untouched.
    return rawUrl;
  }
}
