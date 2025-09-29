import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

export const teamInvitesRouter = Router();

// POST /team-invites { team_id, email, role }
teamInvitesRouter.post('/', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { team_id, email, role } = (req.body || {}) as any;
  if (!team_id || !email) return res.status(400).json({ error: 'team_id and email required' });
  const team = await prisma.team.findUnique({ where: { id: String(team_id) } });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const invite = await prisma.teamInvite.upsert({
    where: { team_id_email: { team_id: String(team_id), email: String(email).toLowerCase() } } as any,
    update: { role: role || 'member', status: 'pending' },
    create: { team_id: String(team_id), email: String(email).toLowerCase(), role: role || 'member', status: 'pending' },
  });
  return res.status(201).json(invite);
});

