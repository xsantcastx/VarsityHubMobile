import { PrismaClient } from '@prisma/client';
import './load-env.js';

// Runtime diagnostic: mask password in DATABASE_URL and log first segment once
(() => {
	const raw = process.env.DATABASE_URL;
	if (raw) {
		const masked = raw.replace(/(postgresql:\/\/[^:]+):[^@]*@/, '$1:***@');
		const preview = masked.length > 140 ? masked.slice(0, 140) + '…' : masked;
		console.log('[env] DATABASE_URL (masked preview):', preview);
	} else {
		console.log('[env] DATABASE_URL is not set (prisma init)');
	}
})();

export const prisma = new PrismaClient();
