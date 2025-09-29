import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { z } from 'zod';

export const eventsRouter = Router();

const serializeEvent = (event: any, opts: { includeGame?: boolean; rsvpCount?: number } = {}) => {
  const base: any = {
    id: event.id,
    title: event.title,
    date: event.date instanceof Date ? event.date.toISOString() : event.date,
    location: event.location,
    banner_url: event.banner_url,
    game_id: event.game_id,
    capacity: event.capacity,
    status: event.status,
    created_at: event.created_at instanceof Date ? event.created_at.toISOString() : event.created_at,
  };
  if (typeof opts.rsvpCount === 'number') {
    base.attendees_count = opts.rsvpCount;
    base.rsvp_count = opts.rsvpCount;
  }
  if (opts.includeGame && event.game) {
    base.game = {
      id: event.game.id,
      title: event.game.title,
      cover_image_url: event.game.cover_image_url,
      date: event.game.date instanceof Date ? event.game.date.toISOString() : event.game.date,
      location: event.game.location,
    };
  }
  return base;
};

eventsRouter.get('/', async (req, res) => {
  const status = String(req.query.status || '').trim();
  const sort = String(req.query.sort || '').trim();
  const where: any = {};
  if (status) where.status = status;
  const orderBy = sort === 'date' ? { date: 'asc' as const } : { created_at: 'desc' as const };
  const events = await prisma.event.findMany({
    where,
    orderBy,
    include: { game: { select: { id: true, title: true, cover_image_url: true, date: true, location: true } } },
  });
  res.json(events.map((event) => serializeEvent(event, { includeGame: true })));
});

// List current user's RSVPs with event basics
eventsRouter.get('/my-rsvps', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const rows = await prisma.eventRsvp.findMany({
    where: { user_id: req.user.id },
    orderBy: { created_at: 'desc' },
    include: { event: { include: { game: { select: { id: true, title: true, cover_image_url: true, date: true, location: true } } } } },
  });
  const list = rows.map((r) => ({
    id: r.id,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    event: r.event ? serializeEvent(r.event, { includeGame: true }) : null,
  }));
  return res.json(list);
});

// Get single event with RSVP count
eventsRouter.get('/:id', async (req, res) => {
  const id = String(req.params.id);
  const event = await prisma.event.findUnique({
    where: { id },
    include: { game: { select: { id: true, title: true, cover_image_url: true, date: true, location: true } } },
  });
  if (!event) return res.status(404).json({ error: 'Not found' });
  const count = await prisma.eventRsvp.count({ where: { event_id: id } });
  return res.json(serializeEvent(event, { includeGame: true, rsvpCount: count }));
});

// Get RSVP status and count
eventsRouter.get('/:id/rsvp', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const event = await prisma.event.findUnique({ where: { id }, select: { capacity: true } });
  if (!event) return res.status(404).json({ error: 'Not found' });
  const count = await prisma.eventRsvp.count({ where: { event_id: id } });
  if (!req.user) return res.json({ going: false, attending: false, count, capacity: event.capacity ?? null });
  const exists = await prisma.eventRsvp.findUnique({ where: { event_id_user_id: { event_id: id, user_id: req.user.id } } as any });
  const going = !!exists;
  return res.json({ going, attending: going, count, capacity: event.capacity ?? null });
});

// Toggle/set RSVP
const rsvpSchema = z.object({ attending: z.boolean().optional(), going: z.boolean().optional() });

eventsRouter.post('/:id/rsvp', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const id = String(req.params.id);
  const event = await prisma.event.findUnique({ where: { id }, select: { id: true, capacity: true } });
  if (!event) return res.status(404).json({ error: 'Not found' });
  const parsed = rsvpSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const me = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!me) return res.status(401).json({ error: 'Unauthorized' });
  const current = await prisma.eventRsvp.findUnique({ where: { event_id_user_id: { event_id: id, user_id: me.id } } as any });
  const desired =
    typeof parsed.data.going === 'boolean'
      ? parsed.data.going
      : typeof parsed.data.attending === 'boolean'
        ? parsed.data.attending
        : !current;
  if (desired && !current) {
    await prisma.eventRsvp.create({ data: { event_id: id, user_id: me.id, user_email: me.email } });
  } else if (!desired && current) {
    await prisma.eventRsvp.delete({ where: { event_id_user_id: { event_id: id, user_id: me.id } } as any });
  }
  const count = await prisma.eventRsvp.count({ where: { event_id: id } });
  return res.json({ going: desired, attending: desired, count, capacity: event.capacity ?? null });
});

