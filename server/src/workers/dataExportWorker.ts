/**
 * BullMQ worker for GDPR data export builds.
 *
 * For each job, the worker:
 *   1. Loads the DataExport row and verifies it's still `pending`
 *   2. Flips status to `building` and stamps `started_at`
 *   3. Calls the domain builder to assemble the ZIP
 *   4. Uploads the ZIP to object storage
 *   5. Updates the row with `status='ready'`, `storage_key`, `size_bytes`,
 *      `completed_at`, `expires_at`
 *
 * Any failure during this sequence flips `status='failed'` with a coarse
 * `error_category` (no raw stack in the DB). BullMQ `attempts: 1` is set
 * in queues.ts — users retry by issuing a new POST /me/data-export.
 *
 * The worker is a no-op when REDIS_URL is unset, matching the emailWorker
 * pattern. Production must have Redis for data export to function.
 */

import type { Job, Worker as WorkerType } from 'bullmq';
import type { DataExportJob } from '../jobs/queues.js';
import { prisma } from '../lib/prisma.js';
import { debugLog } from '../lib/debugLog.js';
import { captureException } from '../lib/sentry.js';
import { buildUserDataExportArchive } from '../lib/dataExport/builder.js';
import {
  getObjectStorageAdapter,
  ObjectStorageNotConfiguredError,
} from '../lib/objectStorage.js';

let worker: WorkerType<DataExportJob> | null = null;

const DATA_EXPORT_RETENTION_DAYS_DEFAULT = 7;

function buildStorageKey(exportId: string, userId: string): string {
  // Path shape: exports/{user_id_first_2}/{user_id}/{export_id}.zip
  // The first-2-char prefix gives even object distribution for backends
  // that shard by key prefix. user_id and export_id are cuid() so they
  // have no PII — safe for storage paths.
  const prefix = userId.slice(0, 2);
  return `exports/${prefix}/${userId}/${exportId}.zip`;
}

/** @internal exported for unit testing; production callers use the Worker wrapper */
export async function processExportJob(job: Job<DataExportJob>): Promise<void> {
  const { exportId, userId } = job.data;
  const p = prisma as any;

  // Load and lock via status check — if the row is already past pending,
  // someone else is handling it (or it was canceled). Idempotent.
  const row = await p.dataExport.findUnique({ where: { id: exportId } });
  if (!row) {
    console.warn('[data-export-worker] Export row missing, skipping job');
    return;
  }
  if (row.user_id !== userId) {
    // Sanity: job payload disagrees with the row. Refuse to process.
    await p.dataExport.update({
      where: { id: exportId },
      data: { status: 'failed', error_category: 'job_user_mismatch' },
    });
    return;
  }
  if (row.status !== 'pending') {
    debugLog(`[data-export-worker] Export ${exportId} already ${row.status}, skipping`);
    return;
  }

  // Storage backend check happens BEFORE we flip to building so the user
  // can retry later once ops fixes env. Distinct from a build failure.
  const storage = getObjectStorageAdapter();
  if (!storage.isConfigured()) {
    await p.dataExport.update({
      where: { id: exportId },
      data: { status: 'failed', error_category: 'storage_not_configured' },
    });
    console.error('[data-export-worker] Storage adapter not configured — failing export');
    return;
  }

  await p.dataExport.update({
    where: { id: exportId },
    data: { status: 'building', started_at: new Date() },
  });

  try {
    const { zipBuffer, sizeBytes, domainsIncluded, domainsFailed } =
      await buildUserDataExportArchive(userId);

    const storageKey = buildStorageKey(exportId, userId);
    await storage.putObject(storageKey, zipBuffer, 'application/zip');

    const retentionDays =
      Number(process.env.DATA_EXPORT_RETENTION_DAYS) ||
      DATA_EXPORT_RETENTION_DAYS_DEFAULT;
    const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

    await p.dataExport.update({
      where: { id: exportId },
      data: {
        status: 'ready',
        storage_key: storageKey,
        size_bytes: sizeBytes,
        completed_at: new Date(),
        expires_at: expiresAt,
      },
    });

    console.log(
      `[data-export-worker] Export ready: bytes=${sizeBytes} domains=${domainsIncluded.length} failed=${domainsFailed.length}`
    );
  } catch (err) {
    // Classify the failure into a coarse, PII-safe category. Raw error
    // message NEVER lands in the DB — it'd leak schema/path details over
    // the admin surface.
    let errorCategory = 'build_failed';
    if (err instanceof ObjectStorageNotConfiguredError) {
      errorCategory = 'storage_not_configured';
    } else if ((err as any)?.name === 'AccessDenied' || (err as any)?.$metadata?.httpStatusCode === 403) {
      errorCategory = 'storage_access_denied';
    } else if ((err as any)?.$metadata?.httpStatusCode >= 500) {
      errorCategory = 'storage_5xx';
    }

    await p.dataExport
      .update({
        where: { id: exportId },
        data: { status: 'failed', error_category: errorCategory },
      })
      .catch((nestedErr: any) => {
        // If even the failure-recording update blows up, surface to Sentry —
        // the job is lost but the row remains stuck in 'building'. A stuck
        // row at TTL + retention will be picked up by the cleanup cron.
        captureException(
          nestedErr instanceof Error ? nestedErr : new Error(String(nestedErr)),
          { extra: { context: 'data_export_worker_failure_update_failed', exportId } }
        );
      });

    // Also send the original error to Sentry so we get stack traces in
    // aggregate. Keep the DB row PII-safe.
    captureException(err instanceof Error ? err : new Error(String(err)), {
      extra: { context: 'data_export_worker_build_failed', exportId, errorCategory },
    });
  }
}

export async function startDataExportWorker(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    debugLog('[data-export-worker] No REDIS_URL configured, worker not started');
    return;
  }

  try {
    const { default: Redis } = await import('ioredis');
    const { Worker } = await import('bullmq');
    const RedisCtor = Redis as unknown as new (url: string, options?: any) => any;
    const connection = new RedisCtor(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    worker = new Worker<DataExportJob>(
      'data-export',
      async (job: Job<DataExportJob>) => {
        debugLog(`[data-export-worker] Processing export job ${job.id}`);
        await processExportJob(job);
      },
      {
        connection,
        // Export builds can hit 10k+ rows and large JSON allocations.
        // Low concurrency keeps Node heap predictable on small instances.
        concurrency: 2,
      }
    );

    worker.on('completed', job => {
      debugLog(`[data-export-worker] Job completed: ${job.id}`);
    });

    worker.on('failed', (job, err) => {
      console.error(
        `[data-export-worker] Job ${job?.id} failed:`,
        err?.message || err
      );
    });

    worker.on('error', err => {
      console.error('[data-export-worker] Worker error:', err);
    });

    debugLog('[data-export-worker] Started and listening for jobs');
  } catch (error) {
    console.error('[data-export-worker] Failed to start:', error);
    captureException(error instanceof Error ? error : new Error(String(error)), {
      extra: { context: 'data_export_worker_start_failed' },
    });
  }
}

export async function stopDataExportWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    debugLog('[data-export-worker] Stopped');
  }
}
