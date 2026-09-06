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
import type { Redis as RedisType } from 'ioredis';
import { deleteExportObject, EXPORT_RETENTION_DAYS } from '../lib/dataExport/lifecycle.js';
import type { DataExportJob } from '../jobs/queues.js';
import { prisma } from '../lib/prisma.js';
import { debugLog } from '../lib/debugLog.js';
import { captureException } from '../lib/sentry.js';
import { buildUserDataExportArchive } from '../lib/dataExport/builder.js';
import { getObjectStorageAdapter, ObjectStorageNotConfiguredError } from '../lib/objectStorage.js';

let worker: WorkerType<DataExportJob> | null = null;

let connection: RedisType | null = null;

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
  const storage = getObjectStorageAdapter();
  const storageKey = buildStorageKey(exportId, userId);
  const startedAt = new Date();
  // Atomic claim: only one delivery may build. Mismatched payloads must not
  // mutate another user's row, and canceled/completed rows stay terminal.
  const claimed = await prisma.dataExport.updateMany({
    where: { id: exportId, user_id: userId, status: 'pending' },
    data: storage.isConfigured()
      ? { status: 'building', started_at: startedAt, storage_key: storageKey }
      : { status: 'failed', error_category: 'storage_not_configured' },
  });
  if (!claimed.count || !storage.isConfigured()) return;

  try {
    const { zipBuffer, sizeBytes, domainsIncluded, domainsFailed } =
      await buildUserDataExportArchive(userId);

    if (domainsFailed.length) throw new Error('Incomplete export archive');
    await storage.putObject(storageKey, zipBuffer, 'application/zip');

    const published = await prisma.dataExport.updateMany({
      where: { id: exportId, user_id: userId, status: 'building', started_at: startedAt },
      data: {
        status: 'ready',
        storage_key: storageKey,
        size_bytes: sizeBytes,
        completed_at: new Date(),
        expires_at: new Date(Date.now() + EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    if (!published.count) {
      await deleteExportObject(exportId, storageKey);
      return;
    }

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
    } else if (
      (err as any)?.name === 'AccessDenied' ||
      (err as any)?.$metadata?.httpStatusCode === 403
    ) {
      errorCategory = 'storage_access_denied';
    } else if ((err as any)?.$metadata?.httpStatusCode >= 500) {
      errorCategory = 'storage_5xx';
    }

    await prisma.dataExport
      .updateMany({
        where: { id: exportId, user_id: userId, status: 'building', started_at: startedAt },
        data: { status: 'failed', error_category: errorCategory },
      })
      .catch((nestedErr: any) => {
        // If even the failure-recording update blows up, surface to Sentry —
        // the job is lost but the row remains stuck in 'building'. A stuck
        // row at TTL + retention will be picked up by the cleanup cron.
        captureException(nestedErr instanceof Error ? nestedErr : new Error(String(nestedErr)), {
          extra: { context: 'data_export_worker_failure_update_failed', exportId },
        });
      });

    await deleteExportObject(exportId, storageKey);

    // Also send the original error to Sentry so we get stack traces in
    // aggregate. Keep the DB row PII-safe.
    captureException(err instanceof Error ? err : new Error(String(err)), {
      extra: { context: 'data_export_worker_build_failed', exportId, errorCategory },
    });
  }
}

export async function startDataExportWorker(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (worker || !getObjectStorageAdapter().isConfigured()) return;
  if (!redisUrl) {
    debugLog('[data-export-worker] No REDIS_URL configured, worker not started');
    return;
  }

  try {
    const { default: Redis } = await import('ioredis');
    const { Worker } = await import('bullmq');
    const RedisCtor = Redis as unknown as new (url: string, options?: any) => RedisType;
    connection = new RedisCtor(redisUrl, {
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
      console.error(`[data-export-worker] Job ${job?.id} failed:`, err?.message || err);
    });

    worker.on('error', err => {
      console.error('[data-export-worker] Worker error:', err);
    });

    await worker.waitUntilReady();
    debugLog('[data-export-worker] Started and listening for jobs');
  } catch (error) {
    await stopDataExportWorker();
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
  if (connection) {
    connection.disconnect();
    connection = null;
  }
}
