import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

export const rsvpsRouter = Router();

// GET /rsvps?user_id=me&limit=...
rsvpsRouter.get('/', async (req: AuthedRequest, res) => {
  const userParam = String((req.query as any).user_id || '');
  const limit = Math.min(parseInt(String((req.query as any).limit || '50'), 10) || 50, 200);
  let userId: string | null = null;
  if (userParam === 'me') {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    userId = req.user.id;
  } else if (userParam) {
    userId = userParam;
  }
  if (!userId) return res.status(400).json({ error: 'user_id required' });

  const rows = await prisma.eventRsvp.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    take: limit,
    include: { event: true },
  });
  const list = rows.map((r) => ({
    id: r.id,
    created_at: r.created_at,
    event: r.event ? { id: r.event_id, title: (r as any).event?.title, date: (r as any).event?.date, location: (r as any).event?.location } : null,
  }));
  return res.json(list);
});

