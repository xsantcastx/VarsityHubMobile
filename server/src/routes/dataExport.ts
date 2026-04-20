/**
 * GDPR / right-to-access data export endpoints.
 *
 *   POST   /me/data-export              → 202 { export_id, status }
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
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { queueDataExport } from '../jobs/queues.js';
import {
  getObjectStorageAdapter,
  ObjectStorageNotConfiguredError,
} from '../lib/objectStorage.js';
import { captureException } from '../lib/sentry.js';

export const dataExportRouter = Router();

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 1 successful export per 24h

// Prisma client types are regenerated post-migration; in older sandbox
// copies the DataExport model may not be on the typed surface yet. All
// access goes through this aliased any-client, matching the pattern used
// for parental consent fields in requireOnboarded.ts.
const p = prisma as any;

/** Shape returned to clients. Never includes storage_key (internal). */
function serializeExport(row: any) {
  return {
    id: row.id,
    status: row.status as
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

// ─── POST /me/data-export ────────────────────────────────────────────────────

dataExportRouter.post(
  '/me/data-export',
  requireAuth,
  requireVerified,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user.id;

    // Max 1 in-flight per user. If there's already a pending or building
    // export, return 409 and point the client at its status endpoint.
    const inFlight = await p.dataExport.findFirst({
      where: {
        user_id: userId,
        status: { in: ['pending', 'building'] },
      },
      orderBy: { requested_at: 'desc' },
    });
    if (inFlight) {
      return res.status(409).json({
        error: 'EXPORT_IN_FLIGHT',
        message: 'You already have an export being built. Wait for it to complete.',
        export_id: inFlight.id,
        status: inFlight.status,
      });
    }

    // 1 successful export per 24h. If the last ready row is still inside
    // the window, reject with retry-after. Expired/failed rows don't count.
    const recentReady = await p.dataExport.findFirst({
      where: {
        user_id: userId,
        status: 'ready',
        requested_at: { gt: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
      },
      orderBy: { requested_at: 'desc' },
    });
    if (recentReady) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(
          (new Date(recentReady.requested_at).getTime() +
            RATE_LIMIT_WINDOW_MS -
            Date.now()) /
            1000
        )
      );
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        error: 'EXPORT_RATE_LIMITED',
        message:
          'You can request one export every 24 hours. Use your existing archive or wait for the window to pass.',
        retry_after_seconds: retryAfterSeconds,
        existing_export_id: recentReady.id,
      });
    }

    // Create the row first, then enqueue. If enqueue fails, we flip the
    // row to 'failed' so the user isn't left with a zombie 'pending' row.
    const row = await p.dataExport.create({
      data: {
        user_id: userId,
        status: 'pending',
      },
    });

    const jobId = await queueDataExport({ exportId: row.id, userId });
    if (!jobId) {
      await p.dataExport.update({
        where: { id: row.id },
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
        message:
          'Data exports are temporarily unavailable. Please try again later.',
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
    const rows = await p.dataExport.findMany({
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
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid id' });

    const row = await p.dataExport.findFirst({
      where: { id: parsed.data.id, user_id: req.user.id },
    });
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json(serializeExport(row));
  })
);

// ─── GET /me/data-export/:id/download ────────────────────────────────────────

dataExportRouter.get(
  '/me/data-export/:id/download',
  requireAuth,
  requireVerified,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid id' });

    const row = await p.dataExport.findFirst({
      where: { id: parsed.data.id, user_id: req.user.id },
    });
    if (!row) return res.status(404).json({ error: 'Not found' });

    if (row.status === 'expired') {
      return res.status(410).json({
        error: 'EXPORT_EXPIRED',
        message:
          'This archive has expired. Request a new export to download your data.',
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
    try {
      const storage = getObjectStorageAdapter();
      ttlSeconds =
        Number(process.env.DATA_EXPORT_SIGNED_URL_TTL_SECONDS) || 300;
      url = await storage.getSignedDownloadUrl(row.storage_key, ttlSeconds);
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
    await p.dataExport
      .update({
        where: { id: row.id },
        data: {
          download_count: { increment: 1 },
          last_downloaded_at: new Date(),
        },
      })
      .catch((err: any) => {
        // A failed counter bump must not block the download.
        captureException(
          err instanceof Error ? err : new Error(String(err)),
          { extra: { context: 'data_export_download_counter_bump_failed' } }
        );
      });

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    return res.json({ url, expires_at: expiresAt });
  })
);

// ─── DELETE /me/data-export/:id ──────────────────────────────────────────────

dataExportRouter.delete(
  '/me/data-export/:id',
  requireAuth,
  requireVerified,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid id' });

    const row = await p.dataExport.findFirst({
      where: { id: parsed.data.id, user_id: req.user.id },
    });
    if (!row) return res.status(404).json({ error: 'Not found' });

    // Best-effort storage delete. If the object's already gone (or the
    // backend is unhappy), mark the row expired anyway — the user asked to
    // get rid of it and the archive's TTL would have caught up regardless.
    if (row.storage_key) {
      try {
        const storage = getObjectStorageAdapter();
        if (storage.isConfigured()) {
          await storage.deleteObject(row.storage_key);
        }
      } catch (err) {
        captureException(err instanceof Error ? err : new Error(String(err)), {
          extra: { context: 'data_export_delete_storage_failed' },
        });
      }
    }

    // Preserve the row as a metadata-only audit record (matches the
    // cleanup cron's behavior). Flip status to 'expired' and clear
    // storage_key + size_bytes so we don't keep references to objects
    // that no longer exist.
    await p.dataExport.update({
      where: { id: row.id },
      data: {
        status: 'expired',
        storage_key: null,
        size_bytes: null,
      },
    });

    return res.status(204).send();
  })
);
