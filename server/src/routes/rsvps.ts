import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { prisma } from '../lib/prisma.js';

export const rsvpsRouter = Router();

// GET /rsvps?user_id=...&limit=...
// Requires auth. Non-admins can only query their own RSVPs.
rsvpsRouter.get('/', requireAuth as any, async (req: AuthedRequest, res) => {
  const limit = Math.min(parseInt(String((req.query as any).limit || '50'), 10) || 50, 200);

  // Determine if caller is admin
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  let isAdmin = false;
  if (adminEmails.length > 0) {
    const caller = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { email: true } });
    isAdmin = !!caller?.email && adminEmails.includes(caller.email.toLowerCase());
  }

  // Admins can query any user; everyone else is scoped to themselves
  const userParam = String((req.query as any).user_id || '');
  const userId = isAdmin && userParam && userParam !== 'me'
    ? userParam
    : req.user!.id;

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

