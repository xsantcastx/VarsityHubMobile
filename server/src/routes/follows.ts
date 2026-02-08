import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

export const followsRouter = Router();

// GET /follows/teams?user_id=me
// Returns teams where the user is a member (proxy for "followed").
// SECURITY: Only allows querying own teams - requires authentication
followsRouter.get('/teams', async (req: AuthedRequest, res) => {
  // SECURITY FIX: Require authentication for all requests
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const userParam = String((req.query as any).user_id || '');
  let userId: string = req.user.id;

  // SECURITY FIX: Only allow querying own data (user_id must be 'me' or match authenticated user)
  if (userParam && userParam !== 'me' && userParam !== req.user.id) {
    return res.status(403).json({ error: 'You can only view your own team memberships' });
  }

  const mems = await prisma.teamMembership.findMany({ where: { user_id: userId }, include: { team: true }, orderBy: { created_at: 'desc' } });
  const list = mems.map((m) => ({ id: m.team_id, name: (m as any).team?.name || '', description: (m as any).team?.description || '', role: m.role }));
  return res.json(list);
});

