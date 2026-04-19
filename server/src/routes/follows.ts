import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { sendError } from '../lib/http/sendError.js';

export const followsRouter = Router();

// GET /follows/teams?user_id=me
// Returns teams the user has explicitly followed via POST /teams/:id/follow.
followsRouter.get(
  '/teams',
  requireAuth as any,
  requireVerified as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return sendError(res, 401, 'Unauthorized');

    const userParam = String((req.query as any).user_id || '');
    const userId: string = req.user.id;

    if (userParam && userParam !== 'me' && userParam !== req.user.id) {
      return sendError(res, 403, 'You can only view your own team memberships');
    }

    const follows = await prisma.teamFollow.findMany({
      where: { user_id: userId },
      include: { team: true },
      orderBy: { created_at: 'desc' },
      take: 500,
    });
    const list = follows.map(f => ({
      id: f.team_id,
      name: (f as any).team?.name || '',
      description: (f as any).team?.description || '',
      venue_address: (f as any).team?.venue_address || null,
    }));
    return res.json(list);
  })
);
