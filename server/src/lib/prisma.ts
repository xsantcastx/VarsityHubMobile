import { PrismaClient } from '@prisma/client';
import './load-env.js';
import { debugLog } from './debugLog.js';

// Runtime diagnostic: mask password in DATABASE_URL and log first segment once
(() => {
	const raw = process.env.DATABASE_URL;
	if (raw) {
		const masked = raw.replace(/(postgresql:\/\/[^:]+):[^@]*@/, '$1:***@');
		const preview = masked.length > 140 ? masked.slice(0, 140) + '…' : masked;
		debugLog('[env] DATABASE_URL (masked preview):', preview);
	} else {
		debugLog('[env] DATABASE_URL is not set (prisma init)');
	}
})();

export const prisma = new PrismaClient();

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
