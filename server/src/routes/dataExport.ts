/**
 * GDPR / right-to-access data export endpoints.
 *
 *   POST   /me/data-export              → 202 { id, status }
 *   GET    /me/data-exports             → 200 [exports]
 *   GET    /me/data-export/:id          → 200 { export }
 *   GET    /me/data-export/:id/download → 200 { url, expires_at }
 *   DELETE /me/data-export/:id          → 204
 *
 * All endpoints require authenticated + verified email. Ownership is
 * enforced on every read/download/delete — the DataExport row must belong
 * to `req.user.id`. 404 (not 403) is returned on ownership mismatch to
 * prevent export-id enumeration.
 *
 * Rate limit semantics (enforced against the DB rather than rolling-window
 * middleware):
 *   - max 1 in-flight export per user (any row with status IN pending/building)
 *   - 1 successful export per 24h (most recent ready row inside window blocks)
 *
 * The POST path creates a row + enqueues a build job; a worker picks it up
 * and transitions the row through building → ready (or failed).
 */

import { Router } from 'express';
import type { DataExport } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { getObjectStorageAdapter, ObjectStorageNotConfiguredError } from '../lib/objectStorage.js';
import { captureException } from '../lib/sentry.js';

import { sendError } from '../lib/http/sendError.js';
import {
  createExportRequest,
  deleteExportObject,
  exportHasExpired,
  exportDownloadTtl,
  EXPORT_RATE_WINDOW_MS,
  EXPORT_RETENTION_DAYS,
} from '../lib/dataExport/lifecycle.js';

export const dataExportRouter = Router();
dataExportRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});

async function queueDataExportJob(args: { exportId: string; userId: string }) {
  const { queueDataExport } = await import('../jobs/queues.js');
  return queueDataExport(args);
}

/** Shape returned to clients. Never includes storage_key (internal). */
function serializeExport(row: DataExport) {
  return {
    id: row.id,
    status: (exportHasExpired(row) ? 'expired' : row.status) as
      | 'pending'
      | 'building'
      | 'ready'
      | 'expired'
      | 'failed',
    requested_at: row.requested_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    expires_at: row.expires_at,
    size_bytes: row.size_bytes,
    error_category: row.error_category,
    download_count: row.download_count,
    last_downloaded_at: row.last_downloaded_at,
  };
}

function parseExportId(params: unknown) {
  return idParamSchema.safeParse(params);
}

async function findOwnedExport(userId: string, exportId: string) {
  return prisma.dataExport.findFirst({
    where: { id: exportId, user_id: userId },
  });
}

async function resolveOwnedExportRequest(req: AuthedRequest) {
  if (!req.user) {
    return { error: { status: 401, body: { error: 'Unauthorized' } } } as const;
  }

  const parsed = parseExportId(req.params);
  if (!parsed.success) {
    return { error: { status: 400, body: { error: 'Invalid id' } } } as const;
  }

  const row = await findOwnedExport(req.user.id, parsed.data.id);
  if (!row) {
    return { error: { status: 404, body: { error: 'Not found' } } } as const;
  }

  return { row } as const;
}

async function exportAvailability() {
  const { isDataExportWorkerAvailable } = await import('../jobs/queues.js');
  return {
    available: getObjectStorageAdapter().isConfigured() && (await isDataExportWorkerAvailable()),
    retention_days: EXPORT_RETENTION_DAYS,
  };
}

dataExportRouter.get(
  '/me/data-export-availability',
  requireAuth,
  requireVerified,
  asyncHandler(async (_req, res) => res.json(await exportAvailability()))
);

// ─── POST /me/data-export ────────────────────────────────────────────────────

dataExportRouter.post(
  '/me/data-export',
  requireAuth,
  requireVerified,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user.id;

    if (!(await exportAvailability()).available) {
      return sendError(res, 503, 'EXPORT_UNAVAILABLE', {
        message: 'Data exports are temporarily unavailable. Please try again later.',
      });
    }
    const result = await createExportRequest(userId);
    const { row } = result;
    if (result.kind === 'in_flight') {
      return sendError(res, 409, 'EXPORT_IN_FLIGHT', {
        message: 'You already have an export being built.',
        extraFields: { export_id: row.id, status: row.status },
      });
    }
    if (result.kind === 'rate_limited') {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((row.requested_at.getTime() + EXPORT_RATE_WINDOW_MS - Date.now()) / 1000)
      );
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return sendError(res, 429, 'EXPORT_RATE_LIMITED', {
        message: 'You can request one export every 24 hours.',
        extraFields: { retry_after_seconds: retryAfterSeconds, existing_export_id: row.id },
      });
    }

    const jobId = await queueDataExportJob({ exportId: row.id, userId });
    if (!jobId) {
      await prisma.dataExport.updateMany({
        where: { id: row.id, status: 'pending' },
        data: { status: 'failed', error_category: 'queue_unavailable' },
      });
      // Ops alert: a user requested an export and we couldn't even enqueue.
      // queueDataExport() also captures from inside the lib, but we tag
      // here too so the HTTP surface shows up as a breadcrumb — critical
      // for distinguishing "Redis misconfigured" from "Redis flapping".
      captureException(
        new Error('Export row stamped failed/queue_unavailable at POST /me/data-export'),
        {
          extra: {
            context: 'data_export_enqueue_unavailable',
            exportId: row.id,
          },
        }
      );
      return res.status(503).json({
        error: 'EXPORT_QUEUE_UNAVAILABLE',
        message: 'Data exports are temporarily unavailable. Please try again later.',
      });
    }

    return res.status(202).json(serializeExport(row));
  })
);

// ─── GET /me/data-exports ────────────────────────────────────────────────────

dataExportRouter.get(
  '/me/data-exports',
  requireAuth,
  requireVerified,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const rows = await prisma.dataExport.findMany({
      where: { user_id: req.user.id },
      orderBy: { requested_at: 'desc' },
      take: 50,
    });
    return res.json(rows.map(serializeExport));
  })
);

// ─── GET /me/data-export/:id ─────────────────────────────────────────────────

const idParamSchema = z.object({ id: z.string().min(1).max(64) });

dataExportRouter.get(
  '/me/data-export/:id',
  requireAuth,
  requireVerified,
  asyncHandler(async (req: AuthedRequest, res) => {
    const resolved = await resolveOwnedExportRequest(req);
    if (resolved.error) return res.status(resolved.error.status).json(resolved.error.body);
    return res.json(serializeExport(resolved.row));
  })
);

// ─── GET /me/data-export/:id/download ────────────────────────────────────────

dataExportRouter.get(
  '/me/data-export/:id/download',
  requireAuth,
  requireVerified,
  asyncHandler(async (req: AuthedRequest, res) => {
    const resolved = await resolveOwnedExportRequest(req);
    if (resolved.error) return res.status(resolved.error.status).json(resolved.error.body);
    const { row } = resolved;

    if (
      exportHasExpired(row) ||
      (row.status === 'ready' && row.expires_at && exportDownloadTtl(row.expires_at) === 0)
    ) {
      return res.status(410).json({
        error: 'EXPORT_EXPIRED',
        message: 'This archive has expired. Request a new export to download your data.',
      });
    }
    if (row.status === 'failed') {
      return res.status(503).json({
        error: 'EXPORT_FAILED',
        message: 'This export did not complete. Request a new one.',
        error_category: row.error_category,
      });
    }
    if (row.status !== 'ready' || !row.storage_key) {
      // pending or building
      return res.status(409).json({
        error: 'EXPORT_NOT_READY',
        message: 'This export is still being built. Check status again shortly.',
        status: row.status,
      });
    }

    // Generate signed URL. 5-minute TTL by default; the URL itself is
    // single-purpose and should not be logged beyond the download counter
    // bump below.
    let url: string;
    let ttlSeconds: number;
    const signingTime = Date.now();
    try {
      const storage = getObjectStorageAdapter();
      ttlSeconds = exportDownloadTtl(row.expires_at!, signingTime);
      url = await storage.getSignedDownloadUrl(row.storage_key, ttlSeconds, new Date(signingTime));
    } catch (err) {
      if (err instanceof ObjectStorageNotConfiguredError) {
        return res.status(503).json({
          error: 'STORAGE_NOT_CONFIGURED',
          message: 'Download backend is temporarily unavailable.',
        });
      }
      captureException(err instanceof Error ? err : new Error(String(err)), {
        extra: { context: 'data_export_sign_url_failed' },
      });
      return res.status(500).json({ error: 'Failed to generate download URL' });
    }

    // Count the download. We don't store the signed URL or IP — just the
    // bump so the user/ops can see whether an archive was consumed.
    await prisma.dataExport
      .update({
        where: { id: row.id },
        data: {
          download_count: { increment: 1 },
          last_downloaded_at: new Date(),
        },
      })
      .catch((err: any) => {
        // A failed counter bump must not block the download.
        captureException(err instanceof Error ? err : new Error(String(err)), {
          extra: { context: 'data_export_download_counter_bump_failed' },
        });
      });

    const expiresAt = new Date(signingTime + ttlSeconds * 1000).toISOString();
    return res.json({ url, expires_at: expiresAt });
  })
);

// ─── DELETE /me/data-export/:id ──────────────────────────────────────────────

dataExportRouter.delete(
  '/me/data-export/:id',
  requireAuth,
  requireVerified,
  asyncHandler(async (req: AuthedRequest, res) => {
    const resolved = await resolveOwnedExportRequest(req);
    if (resolved.error) return res.status(resolved.error.status).json(resolved.error.body);
    const { row } = resolved;

    // Revoke first. A worker can only publish while still building, so a
    // concurrent cancellation cannot be resurrected after its upload finishes.
    const revoked = await prisma.dataExport.update({
      where: { id: row.id },
      data: { status: 'expired', expires_at: new Date() },
    });
    const uploadMayStillBeRunning =
      revoked.started_at &&
      !revoked.completed_at &&
      revoked.started_at.getTime() > Date.now() - 2 * 60 * 60 * 1000;
    if (revoked.storage_key && !uploadMayStillBeRunning) {
      await deleteExportObject(row.id, revoked.storage_key);
    }

    return res.status(204).send();
  })
);
