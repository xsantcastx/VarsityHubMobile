import { Router } from 'express';
import { z } from 'zod';
import { sendEventDecisionEmail, sendEventRsvpConfirmedEmail } from '../lib/email.js';
import { cancelGameReminders, scheduleGameReminders, sendPushNotification } from '../lib/notifications.js';
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

const TEAM_MANAGEMENT_ROLES = ['owner', 'manager', 'coach', 'assistant_coach'];

const appBaseUrl = (process.env.APP_BASE_URL || 'https://varsityhub.app').replace(/\/$/, '');

const formatEventDateLabel = (value?: Date | string | null) => {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().split('T')[0];
};

async function deriveTeamIdsForEvent(gameId?: string | null, linkedLeague?: string | null): Promise<string[]> {
  const teamIds = new Set<string>();
  if (gameId) {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { home_team_id: true, away_team_id: true },
    });
    if (game?.home_team_id) teamIds.add(game.home_team_id);
    if (game?.away_team_id) teamIds.add(game.away_team_id);
  }

  const normalizedLeague = (linkedLeague || '').trim();
  if (!teamIds.size && normalizedLeague) {
    const matchingTeams = await prisma.team.findMany({
      where: {
        OR: [
          { name: { equals: normalizedLeague, mode: 'insensitive' } },
          { name: { contains: normalizedLeague, mode: 'insensitive' } },
          { league: { contains: normalizedLeague, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
      take: 5,
    });
    matchingTeams.forEach((team) => teamIds.add(team.id));
  }

  return Array.from(teamIds);
}

async function notifyTeamStaffOfPendingEvent(params: {
  teamIds: string[];
  eventId: string;
  eventTitle: string;
  submittingUserId?: string;
  submittingUserName?: string | null;
}): Promise<void> {
  if (!params.teamIds.length) return;

  const memberships = await prisma.teamMembership.findMany({
    where: {
      team_id: { in: params.teamIds },
      role: { in: TEAM_MANAGEMENT_ROLES },
      status: 'active',
    },
    select: { user_id: true },
  });

  const userIds = Array.from(
    new Set(
      memberships
        .map((membership) => membership.user_id)
        .filter((id) => id && id !== params.submittingUserId)
    )
  );

  if (!userIds.length) return;

  const submitterName = params.submittingUserName || 'A fan';
  await Promise.all(
    userIds.map((userId) =>
      sendPushNotification(
        userId,
        'Event needs review',
        `${submitterName} submitted "${params.eventTitle}" for review.`,
        {
          type: 'event_review_required',
          event_id: params.eventId,
          team_ids: params.teamIds,
          screen: 'event-approvals',
        }
      )
    )
  );
}

eventsRouter.get('/', async (req, res) => {
  const status = String(req.query.status || '').trim();
  const approvalStatus = String(req.query.approval_status || '').trim();
  const eventType = String(req.query.event_type || '').trim();
  const search = String(req.query.q || '').trim();
  const sort = String(req.query.sort || '').trim();
  const limitRaw = Number.parseInt(String(req.query.limit ?? ''), 10);
  const take = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : undefined;
  
  const where: any = {};
  if (status) where.status = status;
  if (approvalStatus) where.approval_status = approvalStatus;
  else where.approval_status = 'approved'; // Default: only show approved events
  if (eventType) where.event_type = eventType;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { location: { contains: search, mode: 'insensitive' } },
    ];
  }
  
  const orderBy = sort === 'date' ? { date: 'asc' as const } : { created_at: 'desc' as const };
  const events = await prisma.event.findMany({
    where,
    orderBy,
    take,
    include: { 
      game: { select: { id: true, title: true, cover_image_url: true, date: true, location: true } }
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

eventsRouter.post('/:id/rsvp', requireVerified as any, async (req: AuthedRequest, res) => {
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
    // Schedule game reminder notifications (12h and 1h before)
    await scheduleGameReminders(id, me.id);
    
    // Send RSVP confirmation email
    const fullEvent = await prisma.event.findUnique({ 
      where: { id },
      select: { 
        title: true, 
        date: true, 
        location: true,
        description: true,
        max_attendees: true
      } 
    });
    
    if (fullEvent && me.email) {
      const eventDate = new Date(fullEvent.date);
      const rsvpCount = await prisma.eventRsvp.count({ where: { event_id: id } });
      
      await sendEventRsvpConfirmedEmail({
        to: me.email,
        userName: me.display_name || me.email.split('@')[0],
        eventName: fullEvent.title,
        eventDate: eventDate.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'America/Chicago',
        }),
        eventTime: eventDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/Chicago',
        }),
        eventLocation: fullEvent.location || 'TBD',
        rsvpConfirmedAt: new Date().toISOString(),
        organizationName: 'VarsityHub',
        eventDetailLink: `${appBaseUrl}/events/${id}`,
        calendarLink: `${appBaseUrl}/events/${id}/calendar`,
        cancelRsvpLink: `${appBaseUrl}/events/${id}/rsvp/cancel`,
      }).catch((err: Error) => {
        console.error('[events] Failed to send RSVP confirmation email:', err);
      });
    }
  } else if (!desired && current) {
    await prisma.eventRsvp.delete({ where: { event_id_user_id: { event_id: id, user_id: me.id } } as any });
    // Cancel scheduled reminders
    await cancelGameReminders(id, me.id);
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
    select: { id: true, preferences: true, display_name: true } 
  });
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  
  const prefs = (user.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};
  const userRole = prefs.role || 'fan';
  const userPlan = prefs.plan || 'rookie';
  
  // Check event limit for free tier
  if (userRole === 'fan' && (userPlan === 'rookie' || !userPlan || userPlan === 'free')) {
    const totalCount = await prisma.event.count({
      where: {
        creator_id: user.id,
        approval_status: { in: ['pending', 'approved'] },
      },
    });
    
    if (totalCount >= 3) {
      return res.status(403).json({ 
        error: 'Event limit reached',
        message: "You've reached your limit of 3 events. Upgrade to Veteran to create unlimited community events.",
        code: 'EVENT_LIMIT_EXCEEDED',
        limit: 3,
        current: totalCount,
      });
    }
  }
  
  // Coaches get auto-approval, fans need approval
  const autoApprove = userRole === 'coach';
  
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
  
  if (!autoApprove) {
    try {
      const teamIds = await deriveTeamIdsForEvent(data.game_id, data.linked_league);
      if (teamIds.length > 0) {
        await notifyTeamStaffOfPendingEvent({
          teamIds,
          eventId: event.id,
          eventTitle: data.title,
          submittingUserId: user.id,
          submittingUserName: (user as any).display_name || null,
        });
      }
    } catch (notificationError) {
      console.error('Failed to notify coaches about pending event:', notificationError);
    }
  }
  
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
  
  // Only coaches and admins can view pending events
  if (!isAdmin && userRole !== 'coach') {
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
  
  if (!isAdmin && userRole !== 'coach') {
    return res.status(403).json({ error: 'Only coaches and admins can approve events' });
  }
  
  const eventId = String(req.params.id);
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return res.status(404).json({ error: 'Event not found' });

  // Enforce team scope: only admins or staff for linked teams can approve
  const teamIds = await deriveTeamIdsForEvent(event.game_id, event.linked_league);
  if (!isAdmin) {
    if (!teamIds.length) {
      return res.status(403).json({ error: 'Only admins can approve events without a linked team' });
    }

    const membership = await prisma.teamMembership.findFirst({
      where: {
        team_id: { in: teamIds },
        user_id: req.user.id,
        role: { in: TEAM_MANAGEMENT_ROLES },
        status: 'active',
      },
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only staff for the linked team(s) or admins can approve this event' });
    }
  }
  
  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      approval_status: 'approved',
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date(),
    },
    include: {
      creator: { select: { id: true, display_name: true, email: true } }
    }
  });
  
  if (updated.creator?.email) {
    try {
      await sendEventDecisionEmail({
        to: updated.creator.email,
        coachName: updated.creator.display_name || 'Coach',
        eventName: updated.title,
        eventDate: formatEventDateLabel(updated.date),
        eventLocation: updated.location || undefined,
        approved: true,
        reviewUrl: `${appBaseUrl}/events/${eventId}`,
      });
    } catch (err) {
      console.warn('[events] Failed to send event approval email:', (err as any)?.message || err);
    }
  }
  
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
  
  if (!isAdmin && userRole !== 'coach') {
    return res.status(403).json({ error: 'Only coaches and admins can reject events' });
  }
  
  const eventId = String(req.params.id);
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return res.status(404).json({ error: 'Event not found' });

  // Enforce team scope: only admins or staff for linked teams can reject
  const teamIds = await deriveTeamIdsForEvent(event.game_id, event.linked_league);
  if (!isAdmin) {
    if (!teamIds.length) {
      return res.status(403).json({ error: 'Only admins can reject events without a linked team' });
    }

    const membership = await prisma.teamMembership.findFirst({
      where: {
        team_id: { in: teamIds },
        user_id: req.user.id,
        role: { in: TEAM_MANAGEMENT_ROLES },
        status: 'active',
      },
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only staff for the linked team(s) or admins can reject this event' });
    }
  }
  
  const parsed = rejectEventSchema.safeParse(req.body);
  const reason = parsed.success ? parsed.data.reason : undefined;
  
  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      approval_status: 'rejected',
      status: 'rejected',
      rejected_reason: reason,
      approved_by: null,
      approved_at: null,
    },
    include: {
      creator: { select: { id: true, display_name: true, email: true } }
    }
  });

  // Cascade cleanup: remove RSVPs and post access for rejected events
  await prisma.eventRsvp.deleteMany({ where: { event_id: eventId } });
  await prisma.eventPostAccess.deleteMany({ where: { event_id: eventId } });
  await prisma.post.updateMany({ where: { event_id: eventId }, data: { event_id: null } });
  
  if (updated.creator?.email) {
    try {
      await sendEventDecisionEmail({
        to: updated.creator.email,
        coachName: updated.creator.display_name || 'Coach',
        eventName: updated.title,
        eventDate: formatEventDateLabel(updated.date),
        approved: false,
        reviewUrl: `${appBaseUrl}/events/${eventId}`,
        reason,
      });
    } catch (err) {
      console.warn('[events] Failed to send event rejection email:', (err as any)?.message || err);
    }
  }
  
  return res.json({ 
    ...serializeEvent(updated),
    message: 'Event rejected' 
  });
});
