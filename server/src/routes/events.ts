import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { getIsAdmin } from '../middleware/requireAdmin.js';
import { requireVerified } from '../middleware/requireVerified.js';

export const eventsRouter = Router();

const serializeEvent = (event: any, opts: { includeGame?: boolean; rsvpCount?: number; includeCreator?: boolean } = {}) => {
  const base: any = {
    id: event.id,
    title: event.title,
    date: event.date instanceof Date ? event.date.toISOString() : event.date,
    location: event.location,
    latitude: event.latitude,
    longitude: event.longitude,
    banner_url: event.banner_url,
    game_id: event.game_id,
    capacity: event.capacity,
    status: event.status,
    created_at: event.created_at instanceof Date ? event.created_at.toISOString() : event.created_at,
    // Fan event fields
    creator_id: event.creator_id,
    creator_role: event.creator_role,
    approval_status: event.approval_status,
    event_type: event.event_type,
    description: event.description,
    linked_league: event.linked_league,
    max_attendees: event.max_attendees,
    contact_info: event.contact_info,
    approved_at: event.approved_at instanceof Date ? event.approved_at.toISOString() : event.approved_at,
    rejected_reason: event.rejected_reason,
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
  if (opts.includeCreator && event.creator) {
    base.creator = {
      id: event.creator.id,
      display_name: event.creator.display_name,
      avatar_url: event.creator.avatar_url,
    };
  }
  return base;
};

eventsRouter.get('/', async (req, res) => {
  const status = String(req.query.status || '').trim();
  const approvalStatus = String(req.query.approval_status || '').trim();
  const eventType = String(req.query.event_type || '').trim();
  const sort = String(req.query.sort || '').trim();
  
  const where: any = {};
  if (status) where.status = status;
  if (approvalStatus) where.approval_status = approvalStatus;
  else where.approval_status = 'approved'; // Default: only show approved events
  if (eventType) where.event_type = eventType;
  
  const orderBy = sort === 'date' ? { date: 'asc' as const } : { created_at: 'desc' as const };
  const events = await prisma.event.findMany({
    where,
    orderBy,
    include: { 
      game: { select: { id: true, title: true, cover_image_url: true, date: true, location: true } },
      creator: { select: { id: true, display_name: true, avatar_url: true } }
    },
  });
  res.json(events.map((event) => serializeEvent(event, { includeGame: true, includeCreator: true })));
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

// Create event (fans & coaches)
const createEventSchema = z.object({
  title: z.string().min(1),
  date: z.string(),
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  description: z.string().optional(),
  event_type: z.enum(['game', 'watch_party', 'fundraiser', 'tryout', 'bbq', 'other']).optional(),
  linked_league: z.string().optional(),
  max_attendees: z.number().optional(),
  contact_info: z.string().optional(),
  banner_url: z.string().optional(),
  game_id: z.string().optional(),
});

eventsRouter.post('/', requireVerified as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error });
  
  const data = parsed.data;
  const user = await prisma.user.findUnique({ 
    where: { id: req.user.id }, 
    select: { id: true, preferences: true } 
  });
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  
  const prefs = (user.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
  const userRole = prefs.role || 'fan';
  const userPlan = prefs.plan || 'rookie';
  
  // Check event limit for free tier
  if (userRole === 'fan' && (userPlan === 'rookie' || !userPlan || userPlan === 'free')) {
    const pendingCount = await prisma.event.count({
      where: {
        creator_id: user.id,
        approval_status: 'pending',
      },
    });
    
    if (pendingCount >= 3) {
      return res.status(403).json({ 
        error: 'Event limit reached',
        message: "You've reached your limit of 3 pending events. Upgrade to Veteran to create unlimited community events.",
        code: 'EVENT_LIMIT_EXCEEDED',
        limit: 3,
        current: pendingCount,
      });
    }
  }
  
  // Coaches/organizers get auto-approval, fans need approval
  const autoApprove = userRole === 'coach' || userRole === 'organizer';
  
  const event = await prisma.event.create({
    data: {
      title: data.title,
      date: new Date(data.date),
      location: data.location,
      latitude: data.latitude,
      longitude: data.longitude,
      description: data.description,
      event_type: data.event_type,
      linked_league: data.linked_league,
      max_attendees: data.max_attendees,
      contact_info: data.contact_info,
      banner_url: data.banner_url,
      game_id: data.game_id,
      creator_id: user.id,
      creator_role: userRole,
      approval_status: autoApprove ? 'approved' : 'pending',
      status: autoApprove ? 'approved' : 'draft',
      approved_at: autoApprove ? new Date() : null,
    },
  });
  
  return res.status(201).json({
    ...serializeEvent(event),
    message: autoApprove 
      ? 'Event created and published successfully!' 
      : 'Your event has been submitted for approval.',
  });
});

// Get pending events for approval (admins & coaches only)
eventsRouter.get('/pending', authMiddleware as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const user = await prisma.user.findUnique({ 
    where: { id: req.user.id }, 
    select: { id: true, preferences: true } 
  });
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  
  const prefs = (user.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
  const userRole = prefs.role || 'fan';
  const isAdmin = await getIsAdmin(req as any);
  
  // Only coaches, organizers, and admins can view pending events
  if (!isAdmin && userRole !== 'coach' && userRole !== 'organizer') {
    return res.status(403).json({ error: 'Only coaches and admins can view pending events' });
  }
  
  const events = await prisma.event.findMany({
    where: { approval_status: 'pending' },
    orderBy: { created_at: 'desc' },
    include: { 
      game: { select: { id: true, title: true, cover_image_url: true, date: true, location: true } },
      creator: { select: { id: true, display_name: true, avatar_url: true } }
    },
  });
  
  return res.json(events.map((event) => serializeEvent(event, { includeGame: true, includeCreator: true })));
});

// Approve event
eventsRouter.put('/:id/approve', requireVerified as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const user = await prisma.user.findUnique({ 
    where: { id: req.user.id }, 
    select: { id: true, preferences: true } 
  });
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  
  const prefs = (user.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
  const userRole = prefs.role || 'fan';
  const isAdmin = await getIsAdmin(req as any);
  
  if (!isAdmin && userRole !== 'coach' && userRole !== 'organizer') {
    return res.status(403).json({ error: 'Only coaches and admins can approve events' });
  }
  
  const eventId = String(req.params.id);
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return res.status(404).json({ error: 'Event not found' });
  
  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      approval_status: 'approved',
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date(),
    },
    include: {
      creator: { select: { id: true, display_name: true } }
    }
  });
  
  // TODO: Send notification to event creator
  // await createNotification(updated.creator_id, 'EVENT_APPROVED', { event_id: eventId })
  
  return res.json({ 
    ...serializeEvent(updated),
    message: 'Event approved successfully!' 
  });
});

// Reject event
const rejectEventSchema = z.object({
  reason: z.string().optional(),
});

eventsRouter.put('/:id/reject', requireVerified as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const user = await prisma.user.findUnique({ 
    where: { id: req.user.id }, 
    select: { id: true, preferences: true } 
  });
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  
  const prefs = (user.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
  const userRole = prefs.role || 'fan';
  const isAdmin = await getIsAdmin(req as any);
  
  if (!isAdmin && userRole !== 'coach' && userRole !== 'organizer') {
    return res.status(403).json({ error: 'Only coaches and admins can reject events' });
  }
  
  const eventId = String(req.params.id);
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return res.status(404).json({ error: 'Event not found' });
  
  const parsed = rejectEventSchema.safeParse(req.body);
  const reason = parsed.success ? parsed.data.reason : undefined;
  
  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      approval_status: 'rejected',
      status: 'rejected',
      rejected_reason: reason,
      approved_by: user.id,
      approved_at: new Date(),
    },
    include: {
      creator: { select: { id: true, display_name: true } }
    }
  });
  
  // TODO: Send notification to event creator
  // await createNotification(updated.creator_id, 'EVENT_REJECTED', { event_id: eventId, reason })
  
  return res.json({ 
    ...serializeEvent(updated),
    message: 'Event rejected' 
  });
});
