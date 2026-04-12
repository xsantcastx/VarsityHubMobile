/**
 * Pure helper: rewrite a Postgres DATABASE_URL so it carries sensible
 * connection-pool defaults. Extracted from prisma.ts so it can be exercised
 * without booting PrismaClient.
 */

export const DEFAULT_CONNECTION_LIMIT = '20';
export const DEFAULT_POOL_TIMEOUT = '10';

export function applyConnectionPoolDefaults(rawUrl: string): { url: string; injected: string[] } {
  try {
    const parsed = new URL(rawUrl);
    const injected: string[] = [];
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', DEFAULT_CONNECTION_LIMIT);
      injected.push(`connection_limit=${DEFAULT_CONNECTION_LIMIT}`);
    }
    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', DEFAULT_POOL_TIMEOUT);
      injected.push(`pool_timeout=${DEFAULT_POOL_TIMEOUT}`);
    }
    return { url: parsed.toString(), injected };
  } catch {
    return { url: rawUrl, injected: [] };
  }
}
