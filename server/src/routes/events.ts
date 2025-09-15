import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { z } from 'zod';

export const eventsRouter = Router();

eventsRouter.get('/', async (req, res) => {
  const status = String(req.query.status || '').trim();
  const sort = String(req.query.sort || '').trim();
  const where: any = {};
  if (status) where.status = status;
  const orderBy = sort === 'date' ? { date: 'asc' as const } : { created_at: 'desc' as const };
  const events = await prisma.event.findMany({ where, orderBy });
  res.json(events);
});

// List current user's RSVPs with event basics
eventsRouter.get('/my-rsvps', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const rows = await prisma.eventRsvp.findMany({
    where: { user_id: req.user.id },
    orderBy: { created_at: 'desc' },
    include: { event: true },
  });
  const list = rows.map((r) => ({
    id: r.id,
    created_at: r.created_at,
    event: r.event ? { id: r.event.id, title: r.event.title, date: r.event.date, location: r.event.location } : null,
  }));
  return res.json(list);
});

// Get single event with RSVP count
eventsRouter.get('/:id', async (req, res) => {
  const id = String(req.params.id);
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return res.status(404).json({ error: 'Not found' });
  const count = await prisma.eventRsvp.count({ where: { event_id: id } });
  return res.json({ ...event, attendees_count: count });
});

// Get RSVP status and count
eventsRouter.get('/:id/rsvp', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const count = await prisma.eventRsvp.count({ where: { event_id: id } });
  if (!req.user) return res.json({ attending: false, count });
  const exists = await prisma.eventRsvp.findUnique({ where: { event_id_user_id: { event_id: id, user_id: req.user.id } } as any });
  return res.json({ attending: !!exists, count });
});

// Toggle/set RSVP
const rsvpSchema = z.object({ attending: z.boolean().optional() });
eventsRouter.post('/:id/rsvp', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const id = String(req.params.id);
  const parsed = rsvpSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const me = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!me) return res.status(401).json({ error: 'Unauthorized' });
  const current = await prisma.eventRsvp.findUnique({ where: { event_id_user_id: { event_id: id, user_id: me.id } } as any });
  const desired = typeof parsed.data.attending === 'boolean' ? parsed.data.attending : !current;
  if (desired && !current) {
    await prisma.eventRsvp.create({ data: { event_id: id, user_id: me.id, user_email: me.email } });
  } else if (!desired && current) {
    await prisma.eventRsvp.delete({ where: { event_id_user_id: { event_id: id, user_id: me.id } } as any });
  }
  const count = await prisma.eventRsvp.count({ where: { event_id: id } });
  return res.json({ attending: desired, count });
});
