import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ADMIN_EMAILS } from '../lib/adminEmails.js';
import { isVerifiedAdminUser } from '../middleware/requireAdmin.js';

export const rsvpsRouter = Router();

// GET /rsvps?user_id=...&limit=...
// Requires auth. Non-admins can only query their own RSVPs.
rsvpsRouter.get(
  '/',
  requireAuth as any,
  requireVerified as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    const limit = Math.max(
      1,
      Math.min(parseInt(String((req.query as any).limit || '50'), 10) || 50, 200)
    );

    // Determine if caller is admin
    let isAdmin = false;
    if (ADMIN_EMAILS.length > 0) {
      isAdmin = await isVerifiedAdminUser(req.user!.id);
    }

    // Admins can query any user; everyone else is scoped to themselves
    const userParam = String((req.query as any).user_id || '');
    const userId = isAdmin && userParam && userParam !== 'me' ? userParam : req.user!.id;

    const rows = await prisma.eventRsvp.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: limit,
      include: { event: true },
    });
    const list = rows.map(r => ({
      id: r.id,
      created_at: r.created_at,
      event: r.event
        ? {
            id: r.event_id,
            title: (r as any).event?.title,
            date: (r as any).event?.date,
            location: (r as any).event?.location,
          }
        : null,
    }));
    return res.json(list);
  })
);
