import { Router } from 'express';
import { z } from 'zod';
import { validateContent } from '../lib/contentFilter.js';
import {
  sendEventApprovedEmail,
  sendEventCanceledEmail,
  sendEventRsvpConfirmedEmail,
  sendEventUpdatedEmail,
} from '../lib/email.js';
import {
  cancelGameReminders,
  scheduleGameReminders,
  sendPushNotification,
} from '../lib/notifications.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getIsAdmin } from '../middleware/requireAdmin.js';
import { requireVerified } from '../middleware/requireVerified.js';

export const eventsRouter = Router();
const eventModerationRoles = ['owner', 'manager', 'coach', 'assistant_coach'] as const;
const organizationModerationRoles = ['owner', 'manager', 'administrator'] as const;

async function hasEventModerationAccess(userId: string): Promise<boolean> {
  const scope = await getEventModerationScope(userId);
  return (
    scope.teamIds.length > 0 ||
    scope.organizationIds.length > 0 ||
    scope.organizationNames.length > 0
  );
}

async function getEventModerationScope(userId: string) {
  const [teamMemberships, organizationMemberships] = await Promise.all([
    prisma.teamMembership.findMany({
      where: {
        user_id: userId,
        role: { in: [...eventModerationRoles] },
        status: 'active',
      },
      select: { team_id: true },
    }),
    prisma.organizationMembership.findMany({
      where: {
        user_id: userId,
        role: { in: [...organizationModerationRoles] },
        status: 'active',
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  const organizationIds = new Set<string>();
  const organizationNames = new Set<string>();
  for (const membership of organizationMemberships) {
    if (membership.organization_id) {
      organizationIds.add(String(membership.organization_id));
    }
    if (membership.organization?.name) {
      organizationNames.add(membership.organization.name.trim());
    }
  }

  return {
    teamIds: teamMemberships.map(membership => membership.team_id),
    organizationIds: Array.from(organizationIds),
    organizationNames: Array.from(organizationNames),
  };
}

function buildPendingEventsWhere(scope: {
  teamIds: string[];
  organizationIds: string[];
  organizationNames: string[];
}) {
  const scopedConditions: any[] = [];

  if (scope.teamIds.length > 0) {
    scopedConditions.push({
      game: {
        OR: [{ home_team_id: { in: scope.teamIds } }, { away_team_id: { in: scope.teamIds } }],
      },
    });
  }

  if (scope.organizationIds.length > 0 || scope.organizationNames.length > 0) {
    scopedConditions.push({
      OR: [
        ...(scope.organizationIds.length > 0
          ? [{ linked_league: { in: scope.organizationIds } }]
          : []),
        ...scope.organizationNames.map(name => ({
          linked_league: { equals: name, mode: 'insensitive' as const },
        })),
      ],
    });
  }

  if (scopedConditions.length === 0) {
    return {
      approval_status: 'pending',
      id: '__no_visible_events__',
    };
  }

  return {
    approval_status: 'pending',
    OR: scopedConditions,
  };
}

function canModerateEvent(
  event: {
    game?: { home_team_id?: string | null; away_team_id?: string | null } | null;
    linked_league?: string | null;
  },
  scope: { teamIds: string[]; organizationIds: string[]; organizationNames: string[] }
) {
  if (event.game?.home_team_id && scope.teamIds.includes(event.game.home_team_id)) return true;
  if (event.game?.away_team_id && scope.teamIds.includes(event.game.away_team_id)) return true;
  if (event.linked_league) {
    if (scope.organizationIds.includes(event.linked_league)) {
      return true;
    }
    const normalizedLeague = event.linked_league.trim().toLowerCase();
    if (scope.organizationNames.some(name => name.trim().toLowerCase() === normalizedLeague)) {
      return true;
    }
  }
  return false;
}

const serializeEvent = (
  event: any,
  opts: { includeGame?: boolean; rsvpCount?: number; includeCreator?: boolean } = {}
) => {
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
    created_at:
      event.created_at instanceof Date ? event.created_at.toISOString() : event.created_at,
    // Fan event fields
    creator_id: event.creator_id,
    creator_role: event.creator_role,
    approval_status: event.approval_status,
    event_type: event.event_type,
    description: event.description,
    linked_league: event.linked_league,
    max_attendees: event.max_attendees,
    contact_info: event.contact_info,
    approved_at:
      event.approved_at instanceof Date ? event.approved_at.toISOString() : event.approved_at,
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
      home_score: (event.game as any).home_score ?? null,
      away_score: (event.game as any).away_score ?? null,
      winner: (event.game as any).winner ?? null,
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
  const includeCancelled = String(req.query.include_cancelled || '').toLowerCase() === 'true';
  const approvalStatus = String(req.query.approval_status || '').trim();
  const eventType = String(req.query.event_type || '').trim();
  const search = String(req.query.q || '').trim();
  const sort = String(req.query.sort || '').trim();
  const limitRaw = Number.parseInt(String(req.query.limit ?? ''), 10);
  const take = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;

  const where: any = {};
  if (status) where.status = status;
  else if (!includeCancelled) where.status = { not: 'cancelled' }; // Exclude cancelled by default; ?include_cancelled=true for admin views
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

  // Filter out past events by default (unless explicitly requested)
  if (!req.query.include_past && !approvalStatus) {
    where.date = { gte: new Date() };
  }

  const orderBy = sort === 'date' ? { date: 'asc' as const } : { created_at: 'desc' as const };
  const events = await prisma.event.findMany({
    where,
    orderBy,
    take,
    include: {
      game: {
        select: { id: true, title: true, cover_image_url: true, date: true, location: true },
      },
    },
  });
  res.json(events.map(event => serializeEvent(event, { includeGame: true, includeCreator: true })));
});

// List current user's RSVPs with event basics
eventsRouter.get('/my-rsvps', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const rows = await prisma.eventRsvp.findMany({
    where: { user_id: req.user.id },
    orderBy: { created_at: 'desc' },
    include: {
      event: {
        include: {
          game: {
            select: { id: true, title: true, cover_image_url: true, date: true, location: true },
          },
        },
      },
    },
  });
  const list = rows.map(r => ({
    id: r.id,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    event: r.event ? serializeEvent(r.event, { includeGame: true }) : null,
  }));
  return res.json(list);
});

// List current user's created events (for fans to track their submissions)
eventsRouter.get('/my-events', requireAuth as any, async (req: AuthedRequest, res) => {
  // req.user is guaranteed by requireAuth middleware
  const events = await prisma.event.findMany({
    where: { creator_id: req.user!.id },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      title: true,
      date: true,
      location: true,
      event_type: true,
      approval_status: true,
      status: true,
      rejected_reason: true,
      created_at: true,
      approved_at: true,
      description: true,
    },
  });
  return res.json(events);
});

// Get pending events for approval (admins & coaches only) - MUST be before /:id to avoid "pending" matching as id
eventsRouter.get('/pending', authMiddleware as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const isAdmin = await getIsAdmin(req as any);
  const scope = await getEventModerationScope(req.user.id);
  const isCoach =
    scope.teamIds.length > 0 ||
    scope.organizationIds.length > 0 ||
    scope.organizationNames.length > 0;

  // Only active coaches/team managers and admins can view pending events
  if (!isAdmin && !isCoach) {
    return res.status(403).json({ error: 'Only coaches and admins can view pending events' });
  }

  const events = await prisma.event.findMany({
    where: isAdmin ? { approval_status: 'pending' } : buildPendingEventsWhere(scope),
    orderBy: { created_at: 'desc' },
    include: {
      game: {
        select: {
          id: true,
          title: true,
          cover_image_url: true,
          date: true,
          location: true,
          home_team_id: true,
          away_team_id: true,
        },
      },
      creator: { select: { id: true, display_name: true, avatar_url: true } },
    },
  });

  return res.json(
    events.map(event => serializeEvent(event, { includeGame: true, includeCreator: true }))
  );
});

// Get single event with RSVP count (optionally includes can_cancel when authenticated)
eventsRouter.get('/:id', authMiddleware as any, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      game: {
        select: {
          id: true,
          title: true,
          cover_image_url: true,
          date: true,
          location: true,
          home_team_id: true,
          away_team_id: true,
          home_score: true,
          away_score: true,
          winner: true,
        },
      },
    },
  });
  if (!event) return res.status(404).json({ error: 'Not found' });
  const count = await prisma.eventRsvp.count({ where: { event_id: id } });
  const payload = serializeEvent(event, { includeGame: true, rsvpCount: count });
  if (req.user && event.status !== 'cancelled') {
    const isCreator = event.creator_id === req.user.id;
    let isTeamOwner = false;
    if (event.game?.home_team_id || event.game?.away_team_id) {
      const teamIds = [event.game.home_team_id, event.game.away_team_id].filter(
        Boolean
      ) as string[];
      const ownership = await prisma.teamMembership.findFirst({
        where: { team_id: { in: teamIds }, user_id: req.user.id, role: 'owner', status: 'active' },
      });
      isTeamOwner = !!ownership;
    }
    const isAdmin = await getIsAdmin(req as any);
    (payload as any).can_cancel = isCreator || isTeamOwner || isAdmin;
  }
  return res.json(payload);
});

// Get RSVP status and count
eventsRouter.get('/:id/rsvp', authMiddleware as any, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const event = await prisma.event.findUnique({
    where: { id },
    select: { capacity: true, max_attendees: true },
  });
  if (!event) return res.status(404).json({ error: 'Not found' });
  const count = await prisma.eventRsvp.count({ where: { event_id: id } });
  const capacity = event.capacity ?? event.max_attendees ?? null;
  if (!req.user) return res.json({ going: false, attending: false, count, capacity });
  const exists = await prisma.eventRsvp.findUnique({
    where: { event_id_user_id: { event_id: id, user_id: req.user.id } } as any,
  });
  const going = !!exists;
  return res.json({ going, attending: going, count, capacity });
});

// Toggle/set RSVP
const rsvpSchema = z.object({ attending: z.boolean().optional(), going: z.boolean().optional() });

eventsRouter.post('/:id/rsvp', requireAuth as any, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);

  // Get event with date, capacity, title, location for RSVP and confirmation email
  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      location: true,
      capacity: true,
      max_attendees: true,
      date: true,
    },
  });
  if (!event) return res.status(404).json({ error: 'Not found' });

  // Validate event hasn't passed
  const eventDate = new Date(event.date);
  const now = new Date();
  if (eventDate < now) {
    return res.status(400).json({
      error: 'Event has passed',
      message: 'You cannot RSVP to events that have already occurred.',
    });
  }

  const parsed = rsvpSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      issues: parsed.error.issues.map(i => ({ path: i.path, message: i.message })),
    });
  }
  const me = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!me) return res.status(401).json({ error: 'Unauthorized' });
  const current = await prisma.eventRsvp.findUnique({
    where: { event_id_user_id: { event_id: id, user_id: me.id } } as any,
  });
  const desired =
    typeof parsed.data.going === 'boolean'
      ? parsed.data.going
      : typeof parsed.data.attending === 'boolean'
        ? parsed.data.attending
        : !current;

  if (desired && !current) {
    // Use transaction to prevent race condition and enforce capacity
    try {
      await prisma.$transaction(async tx => {
        // Check current count within transaction (prevents race condition)
        const currentCount = await tx.eventRsvp.count({ where: { event_id: id } });
        const capacity = event.capacity ?? event.max_attendees;

        if (capacity && currentCount >= capacity) {
          throw new Error('EVENT_AT_CAPACITY');
        }

        await tx.eventRsvp.create({
          data: { event_id: id, user_id: me.id, user_email: me.email },
        });
      });

      // Send RSVP confirmation email (best-effort, don't block response)
      if (me.email) {
        const eventDate = new Date(event.date);
        const eventDateStr = eventDate.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const eventTimeStr = eventDate.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        });
        sendEventRsvpConfirmedEmail({
          to: me.email,
          userName: me.display_name || me.username || 'there',
          eventName: event.title || 'Event',
          eventDate: eventDateStr,
          eventTime: eventTimeStr,
          eventLocation: event.location || undefined,
          eventLink: `${process.env.APP_BASE_URL || 'https://varsityhub.app'}/event-detail?id=${id}`,
        }).catch(err => console.warn('[events] Failed to send RSVP confirmation email:', err));
      }

      // Schedule game reminder notifications (12h and 1h before)
      await scheduleGameReminders(id, me.id).catch(err =>
        console.warn('[events] Failed to schedule reminders:', err)
      );
    } catch (error: any) {
      if (error.message === 'EVENT_AT_CAPACITY') {
        const currentCount = await prisma.eventRsvp.count({ where: { event_id: id } });
        const capacity = event.capacity ?? event.max_attendees;
        return res.status(403).json({
          error: 'Event at capacity',
          message: 'This event is full. Please check back later for cancellations.',
          count: currentCount,
          capacity,
        });
      }
      throw error;
    }
  } else if (!desired && current) {
    await prisma.eventRsvp.delete({
      where: { event_id_user_id: { event_id: id, user_id: me.id } } as any,
    });
    // Cancel scheduled reminders
    await cancelGameReminders(id, me.id).catch(err =>
      console.warn('[events] Failed to cancel reminders:', err)
    );
  }
  const count = await prisma.eventRsvp.count({ where: { event_id: id } });
  const capacity = event.capacity ?? event.max_attendees;
  return res.json({ going: desired, attending: desired, count, capacity: capacity ?? null });
});

// Create event (fans & coaches)
const createEventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  date: z.string().refine(
    dateStr => {
      const eventDate = new Date(dateStr);
      const now = new Date();
      return eventDate >= now;
    },
    {
      message: 'Event date must be in the future',
    }
  ),
  location: z.string().trim().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  description: z.string().trim().max(5000).optional(),
  event_type: z.enum(['game', 'watch_party', 'fundraiser', 'tryout', 'bbq', 'other']).optional(),
  linked_league: z.string().trim().optional(),
  max_attendees: z.number().optional(),
  contact_info: z.string().trim().optional(),
  banner_url: z.string().optional(),
  game_id: z.string().optional(),
});

eventsRouter.post('/', requireVerified as any, async (req: AuthedRequest, res) => {
  // req.user is guaranteed by requireVerified middleware
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      issues: parsed.error.issues.map(i => ({ path: i.path, message: i.message })),
    });
  }

  const data = parsed.data;

  // Content filter: profanity, spam, bullying
  const filterResult = validateContent({
    title: data.title,
    description: data.description,
  });
  if (!filterResult.valid) {
    return res.status(400).json({
      error: filterResult.error,
      code: filterResult.code,
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, preferences: true },
  });
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const prefs =
    user.preferences && typeof user.preferences === 'object' ? (user.preferences as any) : {};
  const userPlan = prefs.plan || 'rookie';
  const accountRole = prefs.role || 'fan';
  const isAdmin = await getIsAdmin(req as any);

  // Fans cannot create past events, but coaches/admins may need to log historical events.
  const eventDate = new Date(data.date);
  const now = new Date();
  if (eventDate < now && !isAdmin && accountRole === 'fan') {
    return res.status(400).json({
      error: 'Invalid date',
      message: 'Fan-created event dates must be in the future.',
    });
  }
  const isCoach = await hasEventModerationAccess(user.id);
  const userRole = isCoach ? 'coach' : 'fan';

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
        message:
          "You've reached your limit of 3 pending events. Upgrade to Veteran to create unlimited community events.",
        code: 'EVENT_LIMIT_EXCEEDED',
        limit: 3,
        current: pendingCount,
      });
    }
  }

  // Real coaches/team managers and admins get auto-approval, fans need approval
  const autoApprove = isAdmin || isCoach;

  // Use capacity if provided, otherwise max_attendees (for backward compatibility)
  const capacity = data.max_attendees ?? null;

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
      capacity: capacity,
      max_attendees: data.max_attendees, // Keep for backward compatibility
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

  // Get pending count for response (helpful for fans to know their limit status)
  const pendingCount =
    userRole === 'fan' && (userPlan === 'rookie' || !userPlan || userPlan === 'free')
      ? await prisma.event.count({
          where: {
            creator_id: user.id,
            approval_status: 'pending',
          },
        })
      : null;

  return res.status(201).json({
    ...serializeEvent(event),
    message: autoApprove
      ? 'Event created and published successfully!'
      : 'Your event has been submitted for approval.',
    pending_count: pendingCount,
    limit:
      userRole === 'fan' && (userPlan === 'rookie' || !userPlan || userPlan === 'free') ? 3 : null,
  });
});

// Approve event
eventsRouter.put('/:id/approve', requireVerified as any, async (req: AuthedRequest, res) => {
  // req.user is guaranteed by requireVerified middleware
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true },
  });
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const isAdmin = await getIsAdmin(req as any);
  const scope = await getEventModerationScope(user.id);
  const isCoach =
    scope.teamIds.length > 0 ||
    scope.organizationIds.length > 0 ||
    scope.organizationNames.length > 0;

  if (!isAdmin && !isCoach) {
    return res.status(403).json({ error: 'Only coaches and admins can approve events' });
  }

  const eventId = String(req.params.id);
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      game: {
        select: {
          home_team_id: true,
          away_team_id: true,
        },
      },
    },
  });
  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (!isAdmin && event.creator_id === user.id) {
    return res.status(403).json({ error: 'You cannot approve your own event' });
  }
  if (!isAdmin && !canModerateEvent(event, scope)) {
    return res
      .status(403)
      .json({ error: 'You can only approve events for teams or organizations you manage' });
  }

  // Validate event is in pending state
  if (event.approval_status === 'approved') {
    return res.status(400).json({
      error: 'Event already approved',
      message: 'This event has already been approved.',
    });
  }

  if (event.approval_status === 'rejected') {
    return res.status(400).json({
      error: 'Event already rejected',
      message: 'This event has already been rejected. Cannot approve a rejected event.',
    });
  }

  if (event.approval_status !== 'pending') {
    return res.status(400).json({
      error: 'Invalid state',
      message: 'Can only approve pending events.',
    });
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
      creator: { select: { id: true, email: true, display_name: true } },
    },
  });

  if (updated.creator?.email) {
    await sendEventApprovedEmail({
      to: updated.creator.email,
      recipientName: updated.creator.display_name || 'Coach',
      eventId: updated.id,
      eventTitle: updated.title,
      eventDate:
        updated.date instanceof Date
          ? updated.date.toISOString().slice(0, 10)
          : String(updated.date || ''),
      eventLocation: updated.location || '',
    }).catch(err => console.warn('[events] Failed to send approval email:', err));
  }

  // Send notification to event creator
  if (updated.creator_id) {
    await sendPushNotification(
      updated.creator_id,
      'Event Approved',
      `Your event "${updated.title}" has been approved and is now visible to everyone!`,
      {
        type: 'event_approved',
        event_id: eventId,
        screen: 'event-detail',
        event_id_param: eventId,
      }
    ).catch(err => console.warn('[events] Failed to send approval notification:', err));
  }

  return res.json({
    ...serializeEvent(updated),
    message: 'Event approved successfully!',
  });
});

// Reject event
const rejectEventSchema = z.object({
  reason: z.string().optional(),
});

eventsRouter.put('/:id/reject', requireVerified as any, async (req: AuthedRequest, res) => {
  // req.user is guaranteed by requireVerified middleware
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true },
  });
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const isAdmin = await getIsAdmin(req as any);
  const scope = await getEventModerationScope(user.id);
  const isCoach =
    scope.teamIds.length > 0 ||
    scope.organizationIds.length > 0 ||
    scope.organizationNames.length > 0;

  if (!isAdmin && !isCoach) {
    return res.status(403).json({ error: 'Only coaches and admins can reject events' });
  }

  const eventId = String(req.params.id);
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      game: {
        select: {
          home_team_id: true,
          away_team_id: true,
        },
      },
    },
  });
  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (!isAdmin && event.creator_id === user.id) {
    return res.status(403).json({ error: 'You cannot review your own event' });
  }
  if (!isAdmin && !canModerateEvent(event, scope)) {
    return res
      .status(403)
      .json({ error: 'You can only review events for teams or organizations you manage' });
  }

  // Validate event is in pending state
  if (event.approval_status === 'approved') {
    return res.status(400).json({
      error: 'Event already approved',
      message: 'This event has already been approved. Cannot reject an approved event.',
    });
  }

  if (event.approval_status === 'rejected') {
    return res.status(400).json({
      error: 'Event already rejected',
      message: 'This event has already been rejected.',
    });
  }

  if (event.approval_status !== 'pending') {
    return res.status(400).json({
      error: 'Invalid state',
      message: 'Can only reject pending events.',
    });
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
      creator: { select: { id: true, display_name: true } },
    },
  });

  // Send notification to event creator
  if (updated.creator_id) {
    const reasonText = reason ? ` Reason: ${reason}` : '';
    await sendPushNotification(
      updated.creator_id,
      'Event Not Approved',
      `Your event "${updated.title}" was not approved.${reasonText}`,
      {
        type: 'event_rejected',
        event_id: eventId,
        reason: reason || null,
        screen: 'event-detail',
        event_id_param: eventId,
      }
    ).catch(err => console.warn('[events] Failed to send rejection notification:', err));
  }

  return res.json({
    ...serializeEvent(updated),
    message: 'Event rejected',
  });
});

// Update event (creator, team owner/coach, or admin)
const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  date: z.string().optional(),
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  description: z.string().optional(),
  event_type: z.enum(['game', 'watch_party', 'fundraiser', 'tryout', 'bbq', 'other']).optional(),
  linked_league: z.string().optional(),
  max_attendees: z.number().optional(),
  contact_info: z.string().optional(),
  banner_url: z.string().optional(),
  // Opponent (updates linked Game when event has game_id)
  opponent: z.string().trim().optional(), // Alias for away_team_name (manual opponent name)
  away_team_id: z.string().trim().nullable().optional(),
  away_team_name: z.string().trim().optional(),
});

const COACH_EDITABLE_FIELDS = [
  'date',
  'location',
  'latitude',
  'longitude',
  'description',
  'opponent',
  'away_team_id',
  'away_team_name',
];

eventsRouter.patch('/:id', requireAuth as any, async (req: AuthedRequest, res) => {
  const eventId = String(req.params.id);
  const userId = req.user!.id;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      game: { select: { id: true, home_team_id: true, away_team_id: true } },
    },
  });

  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (event.status === 'cancelled') {
    return res.status(400).json({ error: 'Cannot edit cancelled event' });
  }

  const isCreator = event.creator_id === userId;
  let isTeamOwner = false;
  if (event.game?.home_team_id || event.game?.away_team_id) {
    const teamIds = [event.game.home_team_id, event.game.away_team_id].filter(Boolean) as string[];
    const ownership = await prisma.teamMembership.findFirst({
      where: {
        team_id: { in: teamIds },
        user_id: userId,
        role: { in: ['owner', 'manager', 'coach', 'assistant_coach'] },
        status: 'active',
      },
    });
    isTeamOwner = !!ownership;
  }
  const isAdmin = await getIsAdmin(req as any);

  if (!isCreator && !isTeamOwner && !isAdmin) {
    return res.status(403).json({
      error: 'Permission denied',
      message: 'Only the event creator, team owner, or admin can edit this event.',
    });
  }

  const parsed = updateEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      issues: parsed.error.issues.map(i => ({ path: i.path, message: i.message })),
    });
  }

  const data = parsed.data;
  // Normalize opponent -> away_team_name
  if (data.opponent !== undefined) {
    data.away_team_name = data.opponent;
  }

  // Coaches/team owners can only edit approved events with limited fields
  const isApproved = event.approval_status === 'approved';
  const isCoachOrOwner = (isCreator || isTeamOwner) && !isAdmin;
  if (isCoachOrOwner && isApproved) {
    const disallowed = Object.keys(data).filter(k => !COACH_EDITABLE_FIELDS.includes(k));
    if (disallowed.length > 0) {
      return res.status(403).json({
        error: 'Limited edit scope',
        message:
          'Coaches and team owners can only edit time, location, description, and opponent for approved events.',
        disallowed,
      });
    }
  }

  if (data.date) {
    const eventDate = new Date(data.date);
    const now = new Date();
    if (eventDate < now) {
      return res.status(400).json({
        error: 'Invalid date',
        message: 'Event date must be in the future.',
      });
    }
  }

  const updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.date !== undefined) updateData.date = new Date(data.date);
  if (data.location !== undefined) updateData.location = data.location;
  if (data.latitude !== undefined) updateData.latitude = data.latitude;
  if (data.longitude !== undefined) updateData.longitude = data.longitude;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.event_type !== undefined) updateData.event_type = data.event_type;
  if (data.linked_league !== undefined) updateData.linked_league = data.linked_league;
  if (data.max_attendees !== undefined) {
    updateData.capacity = data.max_attendees;
    updateData.max_attendees = data.max_attendees;
  }
  if (data.contact_info !== undefined) updateData.contact_info = data.contact_info;
  if (data.banner_url !== undefined) updateData.banner_url = data.banner_url;

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: updateData,
  });

  // Update opponent on linked Game when event has game_id
  if (
    event.game_id &&
    (data.away_team_id !== undefined ||
      data.away_team_name !== undefined ||
      data.opponent !== undefined)
  ) {
    const gameUpdate: any = {};
    if (data.away_team_id !== undefined) gameUpdate.away_team_id = data.away_team_id || null;
    if (data.away_team_name !== undefined) gameUpdate.away_team_name = data.away_team_name ?? null;
    if (Object.keys(gameUpdate).length > 0) {
      await prisma.game.update({
        where: { id: event.game_id },
        data: gameUpdate,
      });
    }
  }

  // Notify RSVPed users when time, location, or opponent changed
  const changes: string[] = [];
  if (data.date)
    changes.push(
      `Time: ${new Date(data.date).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`
    );
  if (data.location !== undefined || data.latitude !== undefined || data.longitude !== undefined) {
    changes.push(`Location: ${data.location || updated.location || 'Updated'}`);
  }
  if (
    data.away_team_id !== undefined ||
    data.away_team_name !== undefined ||
    data.opponent !== undefined
  ) {
    const opponentName =
      data.away_team_name ?? data.opponent ?? (data.away_team_id ? 'Updated' : 'TBD');
    changes.push(`Opponent: ${opponentName}`);
  }

  if (changes.length > 0) {
    const rsvps = await prisma.eventRsvp.findMany({
      where: { event_id: eventId },
      include: { user: { select: { id: true, email: true, display_name: true } } },
    });

    const eventName = updated.title || event.title || 'Event';
    const changeSummary = changes.join('; ');
    const pushBody = `Event Updated: ${eventName} — ${changeSummary}`;
    const appBase = process.env.APP_BASE_URL || 'https://varsityhub.app';
    const updatedDate = updated.date instanceof Date ? updated.date : new Date(updated.date);
    const eventDate = updatedDate.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const eventDateTime = `${eventDate} at ${updatedDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;

    for (const rsvp of rsvps) {
      const email = rsvp.user?.email || rsvp.user_email;
      if (email) {
        sendEventUpdatedEmail({
          to: email,
          recipientName: rsvp.user?.display_name || 'Team Member',
          eventName,
          eventDate: eventDateTime,
          changeSummary,
          eventId,
          eventDetailLink: `${appBase}/event-detail?id=${eventId}`,
          updatedAt: new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          }),
          organizationName: 'VarsityHub',
        }).catch(err => console.warn('[events] Failed to send event updated email:', err));
      }
      if (rsvp.user?.id && rsvp.user.id !== userId) {
        sendPushNotification(rsvp.user.id, 'Event Updated', pushBody, {
          type: 'event_updated',
          event_id: eventId,
          screen: 'event-detail',
        }).catch(err => console.warn('[events] Failed to send push:', err));
      }
    }
  }

  return res.json({
    ...serializeEvent(updated),
    message: 'Event updated successfully.',
  });
});

// Cancel event (creator or team owner only)
eventsRouter.patch('/:id/cancel', requireAuth as any, async (req: AuthedRequest, res) => {
  const eventId = String(req.params.id);
  const userId = req.user!.id;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      game: { select: { id: true, home_team_id: true, away_team_id: true } },
    },
  });

  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (event.status === 'cancelled') {
    return res.status(400).json({ error: 'Event already cancelled' });
  }

  // Permission: creator OR team owner (of game's home/away team)
  const isCreator = event.creator_id === userId;
  let isTeamOwner = false;
  if (event.game?.home_team_id || event.game?.away_team_id) {
    const teamIds = [event.game.home_team_id, event.game.away_team_id].filter(Boolean) as string[];
    const ownership = await prisma.teamMembership.findFirst({
      where: {
        team_id: { in: teamIds },
        user_id: userId,
        role: 'owner',
        status: 'active',
      },
    });
    isTeamOwner = !!ownership;
  }

  const isAdmin = await getIsAdmin(req as any);
  if (!isCreator && !isTeamOwner && !isAdmin) {
    return res.status(403).json({
      error: 'Permission denied',
      message: 'Only the event creator or team owner can cancel this event.',
    });
  }

  // Update event status
  const updated = await prisma.event.update({
    where: { id: eventId },
    data: { status: 'cancelled' },
  });

  // Get RSVPed users for emails and push
  const rsvps = await prisma.eventRsvp.findMany({
    where: { event_id: eventId },
    include: { user: { select: { id: true, email: true, display_name: true, preferences: true } } },
  });

  const eventDate = event.date instanceof Date ? event.date : new Date(event.date);
  const eventDateStr = eventDate.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const eventTimeStr = eventDate.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  const eventLocation = [event.location].filter(Boolean).join(', ');
  const appBase = process.env.APP_BASE_URL || 'https://varsityhub.app';

  // Send cancellation emails and push notifications (best-effort, non-blocking)
  for (const rsvp of rsvps) {
    const email = rsvp.user?.email || rsvp.user_email;
    if (email) {
      sendEventCanceledEmail({
        to: email,
        recipientName: rsvp.user?.display_name || 'Team Member',
        eventName: event.title || 'Event',
        eventDate: eventDateStr,
        eventTime: eventTimeStr,
        eventLocation,
        canceledAt: new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
        organizationName: 'VarsityHub',
        cancelReason: '',
        upcomingEventsLink: `${appBase}/events`,
        contactOrganizerLink: `mailto:support@varsityhub.app`,
      }).catch(err => console.warn('[events] Failed to send cancellation email:', err));
    }
    if (rsvp.user?.id && rsvp.user.id !== userId) {
      sendPushNotification(
        rsvp.user.id,
        'Event Cancelled',
        `"${event.title || 'Event'}" has been cancelled.`,
        { type: 'event_cancelled', event_id: eventId, screen: 'event-detail' }
      ).catch(err => console.warn('[events] Failed to send push:', err));
    }
  }

  // Cancel scheduled reminders for all RSVPed users
  for (const rsvp of rsvps) {
    await cancelGameReminders(eventId, rsvp.user_id).catch(() => {});
  }

  return res.json({
    ...serializeEvent(updated),
    message: 'Event cancelled successfully.',
  });
});
