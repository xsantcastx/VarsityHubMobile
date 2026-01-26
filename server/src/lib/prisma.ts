import { PrismaClient } from '@prisma/client';
import './load-env.js';
import { debugLog } from './debugLog.js';

const isProduction = process.env.NODE_ENV === 'production';

// Runtime diagnostic: mask password in DATABASE_URL and log connection pool settings
(() => {
	const raw = process.env.DATABASE_URL;
	if (raw) {
		const masked = raw.replace(/(postgresql:\/\/[^:]+):[^@]*@/, '$1:***@');
		const preview = masked.length > 140 ? masked.slice(0, 140) + '…' : masked;
		debugLog('[env] DATABASE_URL (masked preview):', preview);

		// Parse and log connection pool settings
		try {
			const url = new URL(raw);
			const connectionLimit = url.searchParams.get('connection_limit');
			const poolTimeout = url.searchParams.get('pool_timeout');
			if (connectionLimit || poolTimeout) {
				debugLog(`[prisma] Connection pool: limit=${connectionLimit || 'default'}, timeout=${poolTimeout || 'default'}s`);
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
	log: isProduction
		? ['error']
		: ['query', 'error', 'warn'],
});

const getTrimmed = (value: unknown): string | null => {
	if (typeof value !== 'string') return null;
	return value.trim();
};

const validateNonEmpty = (value: unknown, label: string) => {
	const trimmed = getTrimmed(value);
	if (trimmed !== null && trimmed.length === 0) {
		throw new Error(`${label} is required`);
	}
};

prisma.$use(async (params, next) => {
	if (params.model === 'Team') {
		const data = params.args?.data ?? {};
		if (params.action === 'create' || params.action === 'update' || params.action === 'updateMany') {
			const name = (data as any).name ?? (data as any)?.name?.set;
			validateNonEmpty(name, 'Team name');
		}
		if (params.action === 'upsert') {
			validateNonEmpty((data as any)?.create?.name, 'Team name');
			validateNonEmpty((data as any)?.update?.name ?? (data as any)?.update?.name?.set, 'Team name');
		}
	}
	if (params.model === 'Event') {
		const data = params.args?.data ?? {};
		if (params.action === 'create' || params.action === 'update' || params.action === 'updateMany') {
			const title = (data as any).title ?? (data as any)?.title?.set;
			validateNonEmpty(title, 'Event title');
		}
		if (params.action === 'upsert') {
			validateNonEmpty((data as any)?.create?.title, 'Event title');
			validateNonEmpty((data as any)?.update?.title ?? (data as any)?.update?.title?.set, 'Event title');
		}
	}
	return next(params);
});
