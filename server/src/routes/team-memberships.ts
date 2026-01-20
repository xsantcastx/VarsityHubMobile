import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

export const teamMembershipsRouter = Router();

// POST /team-memberships { team_id, user_id, role }
// CRITICAL: Only team owners/managers/coaches can add members to their teams
teamMembershipsRouter.post('/', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { team_id, user_id, role } = (req.body || {}) as any;
  if (!team_id || !user_id) return res.status(400).json({ error: 'team_id and user_id required' });
  
  // Verify requester is team owner/manager/coach
  const requesterMembership = await prisma.teamMembership.findFirst({
    where: {
      team_id: String(team_id),
      user_id: req.user.id,
      role: { in: ['owner', 'manager', 'coach', 'assistant_coach'] },
      status: 'active'
    }
  });
  
  if (!requesterMembership) {
    return res.status(403).json({ 
      error: 'PERMISSION_DENIED',
      message: 'Only team owners, managers, or coaches can add members to teams.'
    });
  }
  
  const team = await prisma.team.findUnique({ where: { id: String(team_id) } });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const user = await prisma.user.findUnique({ where: { id: String(user_id) } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const m = await prisma.teamMembership.upsert({
    where: { team_id_user_id: { team_id: String(team_id), user_id: String(user_id) } } as any,
    update: { role: String(role || 'member'), status: 'active' },
    create: { team_id: String(team_id), user_id: String(user_id), role: String(role || 'member'), status: 'active' },
  });
  return res.status(201).json(m);
});

