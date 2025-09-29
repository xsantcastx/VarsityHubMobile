import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

export const followsRouter = Router();

// GET /follows/teams?user_id=me
// Returns teams where the user is a member (proxy for "followed").
followsRouter.get('/teams', async (req: AuthedRequest, res) => {
  const userParam = String((req.query as any).user_id || '');
  let userId: string | null = null;
  if (userParam === 'me') {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    userId = req.user.id;
  } else if (userParam) {
    userId = userParam;
  }
  if (!userId) return res.status(400).json({ error: 'user_id required' });

  const mems = await prisma.teamMembership.findMany({ where: { user_id: userId }, include: { team: true }, orderBy: { created_at: 'desc' } });
  const list = mems.map((m) => ({ id: m.team_id, name: (m as any).team?.name || '', description: (m as any).team?.description || '', role: m.role }));
  return res.json(list);
});

