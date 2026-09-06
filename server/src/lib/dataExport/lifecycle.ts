import type { DataExport } from '@prisma/client';
import { prisma } from '../prisma.js';
import { getObjectStorageAdapter } from '../objectStorage.js';
import { captureException } from '../sentry.js';

export const EXPORT_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const EXPORT_RETENTION_DAYS = 7;

export function exportHasExpired(row: Pick<DataExport, 'status' | 'expires_at'>, now = Date.now()) {
  return (
    row.status === 'expired' ||
    (row.status === 'ready' && (!row.expires_at || row.expires_at.getTime() <= now))
  );
}

export function exportDownloadTtl(expiresAt: Date, now = Date.now()): number {
  const configured = Number(process.env.DATA_EXPORT_SIGNED_URL_TTL_SECONDS);
  const maximum = Number.isFinite(configured) && configured > 0 ? Math.min(300, configured) : 300;
  return Math.max(0, Math.floor(Math.min(maximum, (expiresAt.getTime() - now) / 1000)));
}

export async function createExportRequest(userId: string) {
  return prisma.$transaction(async tx => {
    // Lock the account across replicas before checking and inserting. Deleting a
    // completed archive must not bypass the successful-export cooldown.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const inFlight = await tx.dataExport.findFirst({
      where: { user_id: userId, status: { in: ['pending', 'building'] } },
      orderBy: { requested_at: 'desc' },
    });
    if (inFlight) return { kind: 'in_flight', row: inFlight } as const;
    const recent = await tx.dataExport.findFirst({
      where: {
        user_id: userId,
        OR: [{ completed_at: { not: null } }, { status: 'ready' }],
        requested_at: { gt: new Date(Date.now() - EXPORT_RATE_WINDOW_MS) },
      },
      orderBy: { requested_at: 'desc' },
    });
    if (recent) return { kind: 'rate_limited', row: recent } as const;
    const row = await tx.dataExport.create({ data: { user_id: userId, status: 'pending' } });
    return { kind: 'created', row } as const;
  });
}

/** Retain the key on failure so scheduled cleanup can retry. Never removes
 * an active build: a canceled uploader owns cleanup until it has settled. */
export async function deleteExportObject(id: string, storageKey: string): Promise<boolean> {
  try {
    const storage = getObjectStorageAdapter();
    if (!storage.isConfigured()) return false;
    await storage.deleteObject(storageKey);
    await prisma.dataExport.updateMany({
      where: { id, storage_key: storageKey, status: { in: ['expired', 'failed'] } },
      data: { storage_key: null, size_bytes: null },
    });
    return true;
  } catch (error) {
    captureException(error instanceof Error ? error : new Error(String(error)), {
      extra: { context: 'data_export_storage_delete_failed', exportId: id },
    });
    return false;
  }
}
