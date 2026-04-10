import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const followsRouter = Router();

// GET /follows/teams?user_id=me
// Returns teams the user has explicitly followed via POST /teams/:id/follow.
followsRouter.get('/teams', requireAuth as any, async (req: AuthedRequest, res) => {
  const userParam = String((req.query as any).user_id || '');
  let userId: string | null = null;
  if (userParam === 'me') {
    userId = req.user!.id;
  } else if (userParam) {
    if (userParam !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    userId = userParam;
  }
  if (!userId) return res.status(400).json({ error: 'user_id required' });

  const follows = await prisma.teamFollow.findMany({ where: { user_id: userId }, include: { team: true }, orderBy: { created_at: 'desc' } });
  const list = follows.map((f) => ({ id: f.team_id, name: (f as any).team?.name || '', description: (f as any).team?.description || '' }));
  return res.json(list);
});
