import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { prisma } from '../lib/prisma.js';

export const followsRouter = Router();

// GET /follows/teams?user_id=me
// Returns teams the user has explicitly followed via POST /teams/:id/follow.
followsRouter.get('/teams', requireAuth as any, async (req: AuthedRequest, res) => {
  // SECURITY FIX: Require authentication for all requests
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const userParam = String((req.query as any).user_id || '');
  let userId: string = req.user.id;

  // SECURITY FIX: Only allow querying own data (user_id must be 'me' or match authenticated user)
  if (userParam && userParam !== 'me' && userParam !== req.user.id) {
    return res.status(403).json({ error: 'You can only view your own team memberships' });
  }

  const follows = await prisma.teamFollow.findMany({ where: { user_id: userId }, include: { team: true }, orderBy: { created_at: 'desc' } });
  const list = follows.map((f) => ({ id: f.team_id, name: (f as any).team?.name || '', description: (f as any).team?.description || '' }));
  return res.json(list);
});

