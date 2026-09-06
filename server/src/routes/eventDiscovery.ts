import { Router } from 'express';
import { listEventDiscoveryItems } from '../lib/eventDiscovery.js';
import { InvalidDiscoveryCursor } from '../lib/discoveryCursor.js';
import { sendError } from '../lib/http/sendError.js';
import { prisma } from '../lib/prisma.js';
import { normalizeSportToSlug } from '../lib/sportsTaxonomy.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';

export const eventDiscoveryRouter = Router();

function parseDateParam(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

eventDiscoveryRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const surfaceRaw = String(req.query.surface ?? 'all')
      .trim()
      .toLowerCase();
    if (!['feed', 'map', 'all'].includes(surfaceRaw)) {
      return sendError(res, 400, 'Invalid surface');
    }

    const scopeRaw = String(req.query.scope ?? 'public')
      .trim()
      .toLowerCase();
    if (!['public', 'following'].includes(scopeRaw)) {
      return sendError(res, 400, 'Invalid scope');
    }

    const typeRaw = req.query.type != null ? String(req.query.type).trim().toLowerCase() : null;
    if (typeRaw && !['game', 'event'].includes(typeRaw)) {
      return sendError(res, 400, 'Invalid type');
    }
    const sportRaw =
      typeof req.query.sport === 'string' && req.query.sport.trim() ? req.query.sport.trim() : null;
    if (sportRaw && (sportRaw.length > 100 || !normalizeSportToSlug(sportRaw))) {
      return sendError(res, 400, 'Invalid sport');
    }
    const level = req.query.level == null ? null : String(req.query.level);
    if (level && !['major', 'minor', 'college', 'other'].includes(level)) {
      return sendError(res, 400, 'Invalid level');
    }
    const paginated = req.query.paginated === 'true';
    const cursor = req.query.cursor == null ? null : String(req.query.cursor);
    if (cursor && (!paginated || cursor.length > 2048)) {
      return sendError(res, 400, 'Invalid discovery cursor');
    }

    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);
    if (req.query.from && !from) return sendError(res, 400, 'Invalid from');
    if (req.query.to && !to) return sendError(res, 400, 'Invalid to');
    if (from && to && from.getTime() > to.getTime()) {
      return sendError(res, 400, 'from must be before to');
    }

    const limitRaw = Number.parseInt(String(req.query.limit ?? ''), 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;
    try {
      const payload = await listEventDiscoveryItems(prisma, {
        surface: surfaceRaw as 'feed' | 'map' | 'all',
        scope: scopeRaw as 'public' | 'following',
        sport: sportRaw,
        type: typeRaw ? (typeRaw as 'game' | 'event') : undefined,
        from,
        to,
        limit,
        viewerId: req.user?.id ?? null,
        paginated,
        cursor,
        level: level as 'major' | 'minor' | 'college' | 'other' | null,
      });
      return res.json(payload);
    } catch (error) {
      if (error instanceof InvalidDiscoveryCursor) return sendError(res, 400, error.message);
      throw error;
    }
  })
);
