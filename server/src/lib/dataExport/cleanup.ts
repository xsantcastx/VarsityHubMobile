import { prisma } from '../prisma.js';
import { deleteExportObject } from './lifecycle.js';

/** Bounded sweeps preserve failed-delete keys for a later retry. A canceled
 * build gets two hours to settle before cleanup may touch its upload key. */
export async function runDataExportCleanupSweep() {
  const now = new Date();
  const stuckCutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const rows = await prisma.dataExport.findMany({
    where: {
      OR: [
        { status: 'ready', OR: [{ expires_at: { lte: now } }, { expires_at: null }] },
        { status: 'pending', requested_at: { lt: stuckCutoff } },
        { status: 'building', started_at: { lt: stuckCutoff } },
        {
          status: { in: ['expired', 'failed'] },
          storage_key: { not: null },
          OR: [{ started_at: null }, { started_at: { lt: stuckCutoff } }],
        },
      ],
    },
    orderBy: { requested_at: 'asc' },
    take: 500,
  });
  let expiredCleaned = 0;
  let stuckReaped = 0;
  let storageDeleteFailed = 0;
  for (const row of rows) {
    const stuck = row.status === 'pending' || row.status === 'building';
    const transitioned = await prisma.dataExport.updateMany({
      where: { id: row.id, status: row.status, started_at: row.started_at },
      data: stuck
        ? { status: 'failed', error_category: 'stuck_build_reaped' }
        : { status: row.status === 'ready' ? 'expired' : row.status },
    });
    if (!transitioned.count) continue;
    if (stuck) stuckReaped++;
    else expiredCleaned++;
    if (row.storage_key && !(await deleteExportObject(row.id, row.storage_key)))
      storageDeleteFailed++;
  }
  return { expiredCleaned, stuckReaped, storageDeleteFailed };
}
