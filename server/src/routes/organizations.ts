import { Router } from 'express';
import { z } from 'zod';
import { validateContent } from '../lib/contentFilter.js';
import {
  sendJoinRequestApproved,
  sendJoinRequestDenied,
  sendJoinRequestToAdmin,
  sendOrganizationInviteEmail,
} from '../lib/email.js';
import { sendOrganizationApprovalEmail } from '../lib/notifications.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { getIsAdmin } from '../middleware/requireAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { debugLog } from '../lib/debugLog.js';
import { getAuthorizedUsersOrgLimit } from '../lib/planLimits.js';
import {
  approveCoachForOrganization,
  markCoachApprovalPending,
  rejectCoachForOrganization,
} from '../lib/coachApproval.js';

export const organizationsRouter = Router();

// ---------------------------------------------
// Duplicate Detection & Admin Helpers
// ---------------------------------------------

// Normalize organization names to detect near-duplicates across org_type variants.
// Strategy: lowercase, replace common abbreviations, strip punctuation/spaces, drop trailing generic terms.
function normalizeOrganizationName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\bst\.?\b/g, 'saint')
    .replace(/\bhs\b/g, 'highschool')
    .replace(/\bhigh school\b/g, 'highschool')
    .replace(/\bclub\b/g, '')
    .replace(/\bleague\b/g, '')
    .replace(/\bschool\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Determine if a membership role is considered an administrator of the organization.
function isOrganizationAdmin(role: string | null | undefined): boolean {
  if (!role) return false;
  return role === 'owner' || role === 'manager' || role === 'administrator';
}

function getPreferenceObject(preferences: unknown): Record<string, any> {
  return preferences && typeof preferences === 'object' && !Array.isArray(preferences)
    ? ({ ...(preferences as Record<string, any>) } as Record<string, any>)
    : {};
}

/**
 * Parse `limit`/`offset` from a request query string and clamp to a safe
 * pagination window. Routes must never return unbounded result sets —
 * especially when rows carry PII (email, names).
 */
function parsePagination(
  query: any,
  { defaultLimit = 50, maxLimit = 100 } = {}
): { limit: number; offset: number } {
  const rawLimit = Number(query?.limit);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(maxLimit, rawLimit))
    : defaultLimit;
  const rawOffset = Number(query?.offset);
  const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;
  return { limit, offset };
}

/**
 * Shared duplicate-org lookup. Scoped to a zip code so the query is always
 * indexable — a nullish/empty zip_code means we cannot reliably detect
 * cross-area duplicates and we MUST NOT fall back to a full-table scan.
 */
async function findDuplicateOrganization(
  name: string,
  zipCode: string | undefined
): Promise<{ id: string; name: string } | null> {
  if (!zipCode) return null;
  const normalized = normalizeOrganizationName(name);
  const candidates = await prisma.organization.findMany({
    where: { zip_code: zipCode, status: 'active' },
    select: { id: true, name: true },
  });
  return candidates.find(o => normalizeOrganizationName(o.name) === normalized) ?? null;
}

async function assertCoachRoleOrAdmin(req: AuthedRequest): Promise<void> {
  if (!req.user) {
    const error: any = new Error('Unauthorized');
    error.status = 401;
    throw error;
  }

  if (await getIsAdmin(req)) return;

  const me = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { preferences: true },
  });
  const prefs = getPreferenceObject(me?.preferences);
  const role = typeof prefs.role === 'string' ? prefs.role.toLowerCase() : 'fan';

  if (role !== 'coach') {
    const error: any = new Error('Only coach accounts can create organizations.');
    error.status = 403;
    error.payload = {
      error: 'COACH_ROLE_REQUIRED',
      message: 'Only coach accounts can create organizations.',
      code: 'COACH_ROLE_REQUIRED',
    };
    throw error;
  }
}

function normalizeJoinRequestStatus(
  status: string | null | undefined
): 'pending' | 'approved' | 'rejected' {
  if (status === 'approved') return 'approved';
  if (status === 'rejected' || status === 'denied') return 'rejected';
  return 'pending';
}

function serializeJoinRequest(joinRequest: any, includeOrganization: boolean = false) {
  const normalizedStatus = normalizeJoinRequestStatus(joinRequest?.status);
  const requesterName =
    joinRequest?.user?.display_name ||
    joinRequest?.user?.username ||
    joinRequest?.user?.email ||
    'Unknown user';

  return {
    id: joinRequest.id,
    organization_id: joinRequest.organization_id,
    organization_name: includeOrganization ? joinRequest.organization?.name || null : null,
    requester_id: joinRequest.user_id,
    requester_name: requesterName,
    requester_email: joinRequest?.user?.email || null,
    requester_avatar_url: joinRequest?.user?.avatar_url || null,
    message: joinRequest.message || null,
    status: normalizedStatus,
    created_at: joinRequest.created_at,
    reviewed_at: joinRequest.reviewed_at || null,
    reviewed_by: joinRequest.reviewed_by || null,
    rejection_reason: normalizedStatus === 'rejected' ? joinRequest.message || null : null,
  };
}

// List organizations (public, with optional search)
organizationsRouter.get('/', async (req, res) => {
  const q = String((req.query as any).q || '').trim();
  const limit = Math.min(parseInt(String((req.query as any).limit || '20'), 10) || 20, 50);

  // Use startsWith (LIKE 'q%') so the @@index([name]) is used; leading-wildcard ILIKE
  // would cause a full table scan. Description search is omitted for the same reason.
  const where: any = q ? { name: { startsWith: q, mode: 'insensitive' } } : {};

  const organizations = await prisma.organization.findMany({
    where,
    take: limit,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      sport: true,
      created_at: true,
      _count: {
        select: {
          memberships: true,
          teams: true,
        },
      },
    },
  });

  return res.json(organizations);
});

// List organizations where current user has admin access
organizationsRouter.get('/mine', requireAuth as any, async (req: AuthedRequest, res) => {
  const orgs = await prisma.organization.findMany({
    where: {
      memberships: {
        some: {
          user_id: req.user!.id,
          role: { in: ['owner', 'manager', 'administrator'] },
          status: 'active',
        },
      },
    },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      sport: true,
      org_type: true,
      created_at: true,
    },
  });
  return res.json(orgs);
});

// Follow an organization
organizationsRouter.post('/:id/follow', requireAuth as any, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const orgId = String(req.params.id);
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return res.status(404).json({ error: 'Organization not found' });
  try {
    await prisma.organizationFollow.create({ data: { user_id: userId, organization_id: orgId } });
    return res.status(201).json({ is_following: true });
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(201).json({ is_following: true });
    throw e;
  }
});

// Unfollow an organization
organizationsRouter.delete('/:id/follow', requireAuth as any, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const orgId = String(req.params.id);
  await prisma.organizationFollow.deleteMany({
    where: { user_id: userId, organization_id: orgId },
  });
  return res.json({ is_following: false });
});

// Get single organization
organizationsRouter.get('/:id', async (req, res) => {
  const id = String(req.params.id);
  const currentUserId = (req as AuthedRequest).user?.id ?? null;
  const organization = await prisma.organization.findUnique({
    where: { id },
    include: {
      _count: { select: { followers: true } },
      teams: {
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          sport: true,
          season_start: true,
          season_end: true,
          status: true,
          logo_url: true,
          avatar_url: true,
          created_at: true,
          _count: {
            select: {
              memberships: true,
            },
          },
        },
      },
      memberships: {
        include: {
          user: {
            select: { id: true, display_name: true, avatar_url: true },
          },
        },
        orderBy: { created_at: 'desc' },
      },
    },
  });

  if (!organization) return res.status(404).json({ error: 'Organization not found' });
  const payload = { ...organization } as any;
  payload.followers_count = (organization as any)._count?.followers ?? 0;
  payload.is_following = currentUserId
    ? !!(await prisma.organizationFollow.findFirst({
        where: { user_id: currentUserId, organization_id: id },
      }))
    : null;
  delete payload._count;
  return res.json(payload);
});

// Get organization members
organizationsRouter.get('/:id/members', requireAuth as any, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const organization = await prisma.organization.findUnique({ where: { id } });
  if (!organization) return res.status(404).json({ error: 'Organization not found' });

  const members = await prisma.organizationMembership.findMany({
    where: { organization_id: id, status: 'active' },
    include: {
      user: {
        select: {
          id: true,
          display_name: true,
          username: true,
          avatar_url: true,
          preferences: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  const list = members.map(m => {
    const user = (m as any).user;
    const prefs = (user?.preferences || {}) as any;
    return {
      ...m,
      user: {
        id: user?.id || m.user_id,
        display_name: user?.display_name || null,
        username: user?.username || null,
        avatar_url: user?.avatar_url || null,
        is_parent: prefs?.is_parent === true,
      },
    };
  });

  return res.json(list);
});

const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  sport: z.string().max(100).optional(),
  org_type: z.string().max(100).optional(),
  location: z.string().max(255).optional(),
  zip_code: z.string().max(10).optional(),
  season_start: z.string().optional(),
  season_end: z.string().optional(),
});

// Create organization
organizationsRouter.post(
  '/',
  requireAuth as any,
  requireVerified as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    try {
      await assertCoachRoleOrAdmin(req);
    } catch (error: any) {
      return res
        .status(error?.status || 403)
        .json(
          error?.payload || { error: 'COACH_ROLE_REQUIRED', message: error?.message || 'Forbidden' }
        );
    }

    const parsed = createOrganizationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

    const data = parsed.data;
    const dup = await findDuplicateOrganization(data.name, data.zip_code);
    if (dup) {
      return res
        .status(409)
        .json({ error: 'DUPLICATE_ORGANIZATION', duplicate_of: { id: dup.id, name: dup.name } });
    }
    const filterResult = validateContent({
      title: data.name,
      content: data.description ?? undefined,
    });
    if (!filterResult.valid) {
      return res.status(400).json({ error: filterResult.error, code: filterResult.code });
    }
    const organization = await prisma.$transaction(async tx => {
      const createdOrganization = await tx.organization.create({
        data: {
          ...data,
          season_start: data.season_start ? new Date(data.season_start) : null,
          season_end: data.season_end ? new Date(data.season_end) : null,
          updated_at: new Date(),
        },
      });

      await tx.organizationMembership.create({
        data: {
          organization_id: createdOrganization.id,
          user_id: req.user!.id,
          role: 'owner',
          status: 'invited',
        },
      });

      await markCoachApprovalPending(
        req.user!.id,
        {
          organization_id: createdOrganization.id,
          organization_name: createdOrganization.name,
        },
        tx
      );

      return createdOrganization;
    });

    return res.status(201).json(organization);
  })
);

const createOrganizationWithTeamsSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  sport: z.string().max(100).optional(),
  org_type: z.string().max(100).optional(),
  location: z.string().max(255).optional(),
  zip_code: z.string().max(10).optional(),
  season_start: z.string().optional(),
  season_end: z.string().optional(),
  authorized_users: z
    .array(
      z.object({
        email: z.string().email().optional(),
        user_id: z.string().optional(),
        role: z.string().optional(),
        assign_team: z.string().optional(),
      })
    )
    .optional(),
});

// Enhanced create organization for onboarding
organizationsRouter.post(
  '/create',
  requireAuth as any,
  requireVerified as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    try {
      await assertCoachRoleOrAdmin(req);
    } catch (error: any) {
      return res
        .status(error?.status || 403)
        .json(
          error?.payload || { error: 'COACH_ROLE_REQUIRED', message: error?.message || 'Forbidden' }
        );
    }

    const parsed = createOrganizationWithTeamsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

    const data = parsed.data;
    const dup = await findDuplicateOrganization(data.name, data.zip_code);
    if (dup) {
      return res
        .status(409)
        .json({ error: 'DUPLICATE_ORGANIZATION', duplicate_of: { id: dup.id, name: dup.name } });
    }
    const filterResult = validateContent({
      title: data.name,
      content: data.description ?? undefined,
    });
    if (!filterResult.valid) {
      return res.status(400).json({ error: filterResult.error, code: filterResult.code });
    }

    const inviteRows = (data.authorized_users || [])
      .filter(user => user.email)
      .map(user => ({
        email: user.email!,
        role: user.role || 'member',
      }));

    const organization = await prisma.$transaction(async tx => {
      const createdOrganization = await tx.organization.create({
        data: {
          name: data.name,
          description: data.description,
          sport: data.sport,
          org_type: data.org_type,
          location: data.location,
          zip_code: data.zip_code,
          season_start: data.season_start ? new Date(data.season_start) : null,
          season_end: data.season_end ? new Date(data.season_end) : null,
          updated_at: new Date(),
        },
      });

      await tx.organizationMembership.create({
        data: {
          organization_id: createdOrganization.id,
          user_id: req.user!.id,
          role: 'owner',
          status: 'invited',
        },
      });

      await markCoachApprovalPending(
        req.user!.id,
        {
          organization_id: createdOrganization.id,
          organization_name: createdOrganization.name,
        },
        tx
      );

      if (inviteRows.length > 0) {
        await tx.organizationInvite.createMany({
          data: inviteRows.map(invite => ({
            organization_id: createdOrganization.id,
            email: invite.email,
            role: invite.role,
          })),
          skipDuplicates: true,
        });
      }

      return createdOrganization;
    });

    if (inviteRows.length > 0) {
      const [inviter, createdInvites] = await Promise.all([
        prisma.user.findUnique({ where: { id: req.user!.id }, select: { display_name: true } }),
        prisma.organizationInvite.findMany({
          where: { organization_id: organization.id, email: { in: inviteRows.map(i => i.email) } },
          select: { id: true, email: true },
        }),
      ]);
      const tokenByEmail = Object.fromEntries(createdInvites.map(i => [i.email, i.id]));
      await Promise.all(
        inviteRows.map(inv =>
          sendOrganizationInviteEmail({
            to: inv.email,
            organizationName: organization.name,
            role: inv.role,
            inviterName: inviter?.display_name || 'An organizer',
            inviteToken: tokenByEmail[inv.email],
          }).catch(() => false)
        )
      );
    }

    return res.status(201).json(organization);
  })
);

const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.string().optional(),
});

// Invite user to organization
organizationsRouter.post('/:id/invite', requireAuth as any, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const parsed = inviteUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

  const { email, role } = parsed.data;

  // Check if user is a member of the organization
  const membership = await prisma.organizationMembership.findUnique({
    where: { organization_id_user_id: { organization_id: id, user_id: req.user!.id } as any },
  });

  if (!membership || !isOrganizationAdmin(membership.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  // PLAN LIMITS: Enforce authorized user caps for organization-level invites
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    const prefs = (user?.preferences || {}) as any;
    const plan = prefs.plan || 'rookie';

    // Get team count for org-level limit calculation
    const teamCountTotal =
      prefs.team_count_total ||
      (await prisma.teamMembership.count({
        where: { user_id: req.user!.id, role: 'owner' },
      }));

    // Get organization-level limit from plan definitions
    const limit = getAuthorizedUsersOrgLimit(plan, teamCountTotal);

    if (limit !== null) {
      const inviteCount = await prisma.organizationInvite.count({ where: { organization_id: id } });
      const memberCount = await prisma.organizationMembership.count({
        where: { organization_id: id, role: { in: ['manager', 'member'] } },
      });
      const totalAuthorized = inviteCount + memberCount;
      if (totalAuthorized >= limit) {
        return res.status(403).json({
          error: 'USER_LIMIT_REACHED',
          message: `Plan limit reached. ${plan} plan allows ${limit} authorized user${limit === 1 ? '' : 's'} for your organization.`,
          limit,
          current: totalAuthorized,
        });
      }
    }
    // If limit is null, plan has unlimited authorized users (Legend tier)
  } catch (e) {
    console.warn('[organizations][invite-limit] check failed', e);
  }

  const invite = await prisma.organizationInvite.create({
    data: {
      organization_id: id,
      email,
      role: role || 'member',
    },
  });
  // Send email (best effort)
  const org = await prisma.organization.findUnique({ where: { id }, select: { name: true } });
  const inviter = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { display_name: true },
  });
  if (org) {
    await sendOrganizationInviteEmail({
      to: email,
      organizationName: org.name,
      role: role || 'member',
      inviterName: inviter?.display_name || 'An organizer',
      inviteToken: invite.id,
    }).catch(() => false);
  }

  return res.status(201).json(invite);
});

// Get my organization invites
organizationsRouter.get('/invites/me', requireAuth as any, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const invites = await prisma.organizationInvite.findMany({
    where: { email: user.email, status: 'pending' },
    include: { organization: true },
    orderBy: { created_at: 'desc' },
  });

  return res.json(invites);
});

// Accept organization invite
organizationsRouter.post(
  '/invites/:inviteId/accept',
  requireAuth as any,
  async (req: AuthedRequest, res) => {
    const inviteId = String(req.params.inviteId);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const invite = await prisma.organizationInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.email !== user.email || invite.status !== 'pending') {
      return res.status(404).json({ error: 'Invite not found or not valid' });
    }

    await prisma.$transaction([
      prisma.organizationMembership.upsert({
        where: {
          organization_id_user_id: {
            organization_id: invite.organization_id,
            user_id: user.id,
          } as any,
        },
        update: { role: invite.role, status: 'active' },
        create: {
          organization_id: invite.organization_id,
          user_id: user.id,
          role: invite.role,
          status: 'active',
        },
      }),
      prisma.organizationInvite.update({ where: { id: inviteId }, data: { status: 'accepted' } }),
    ]);

    // Send welcome email
    const org = await prisma.organization.findUnique({
      where: { id: invite.organization_id },
      select: { name: true },
    });
    if (org) {
      await approveCoachForOrganization({
        userId: user.id,
        organizationId: invite.organization_id,
        organizationName: org.name,
        actorId: req.user!.id,
      });
      await sendOrganizationApprovalEmail({ to: user.email, organizationName: org.name }).catch(
        err => console.warn('[org-invite-accept] Email send failed:', err)
      );
    }

    return res.json({ message: 'Invite accepted' });
  }
);

// Decline organization invite
organizationsRouter.post(
  '/invites/:inviteId/decline',
  requireAuth as any,
  async (req: AuthedRequest, res) => {
    const inviteId = String(req.params.inviteId);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const invite = await prisma.organizationInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.email !== user.email || invite.status !== 'pending') {
      return res.status(404).json({ error: 'Invite not found or not valid' });
    }

    await prisma.organizationInvite.update({
      where: { id: inviteId },
      data: { status: 'declined' },
    });
    return res.json({ message: 'Invite declined' });
  }
);

// ===========================================
// Organization Join Request Endpoints
// ===========================================

// Search organizations by zip code / proximity
organizationsRouter.get('/search/nearby', async (req, res) => {
  const query = String((req.query as any).query || '').trim();
  const sport = String((req.query as any).sport || '').trim();
  const orgType = String((req.query as any).org_type || '').trim();
  const limit = Math.min(parseInt(String((req.query as any).limit || '20'), 10) || 20, 50);

  debugLog('🔍 Organization search request:', { query, sport, orgType, limit });

  if (!query) {
    return res.status(400).json({ error: 'query parameter is required' });
  }

  // Check if query is a zip code (5 digits) or organization name
  const isZipCode = /^\d{5}$/.test(query);

  const where: any = {
    status: 'active',
    OR: isZipCode
      ? [{ zip_code: query }]
      : [
          { name: { contains: query, mode: 'insensitive' } },
          { location: { contains: query, mode: 'insensitive' } },
        ],
  };

  if (sport) where.sport = sport;
  if (orgType) where.org_type = orgType;

  const organizations = await prisma.organization.findMany({
    where,
    take: limit,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      sport: true,
      org_type: true,
      location: true,
      zip_code: true,
      created_at: true,
      _count: {
        select: {
          memberships: true,
          teams: true,
        },
      },
    },
  });

  debugLog(`✅ Found ${organizations.length} organizations matching "${query}"`);
  return res.json(organizations);
});

// Check for duplicate organizations
organizationsRouter.post('/check-duplicate', async (req, res) => {
  const { name, zip_code } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const where: any = {
    name: { equals: name, mode: 'insensitive' },
    status: 'active',
  };

  if (zip_code) {
    where.zip_code = zip_code;
  }

  const existing = await prisma.organization.findFirst({ where });

  return res.json({
    exists: !!existing,
    organization: existing
      ? {
          id: existing.id,
          name: existing.name,
          location: existing.location,
          sport: existing.sport,
        }
      : null,
  });
});

// Create join request
const createJoinRequestSchema = z.object({
  organization_id: z.string(),
  message: z.string().max(500).optional(),
});

organizationsRouter.post('/join-requests', requireAuth as any, async (req: AuthedRequest, res) => {
  const parsed = createJoinRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

  const { organization_id, message } = parsed.data;

  // Check if organization exists
  const organization = await prisma.organization.findUnique({
    where: { id: organization_id },
    include: {
      memberships: {
        where: { role: 'owner' },
        include: {
          user: {
            select: { id: true, email: true, display_name: true },
          },
        },
      },
    },
  });

  if (!organization) {
    return res.status(404).json({ error: 'Organization not found' });
  }

  // Check if user is already a member
  const existingMembership = await prisma.organizationMembership.findUnique({
    where: {
      organization_id_user_id: {
        organization_id,
        user_id: req.user!.id,
      } as any,
    },
  });

  if (existingMembership) {
    return res.status(400).json({ error: 'You are already a member of this organization' });
  }

  // Check for existing pending request
  const existingRequest = await prisma.organizationJoinRequest.findUnique({
    where: {
      organization_id_user_id: {
        organization_id,
        user_id: req.user!.id,
      } as any,
    },
  });

  if (existingRequest && existingRequest.status === 'pending') {
    return res
      .status(400)
      .json({ error: 'You already have a pending request for this organization' });
  }

  // Create or update join request
  const joinRequest = await prisma.organizationJoinRequest.upsert({
    where: {
      organization_id_user_id: {
        organization_id,
        user_id: req.user!.id,
      } as any,
    },
    create: {
      organization_id,
      user_id: req.user!.id,
      message,
      status: 'pending',
    },
    update: {
      message,
      status: 'pending',
      created_at: new Date(),
      reviewed_at: null,
      reviewed_by: null,
    },
    include: {
      user: {
        select: { id: true, display_name: true, email: true },
      },
    },
  });

  // Send email notification to organization owners. Guard the chain: an org
  // with zero owner rows (e.g. a denied coach whose membership was removed)
  // would NPE on `owner.user.email` otherwise.
  const owner = organization.memberships.find(m => m?.user?.email);
  if (owner) {
    await sendJoinRequestToAdmin({
      adminEmail: owner.user.email,
      adminName: owner.user.display_name || 'Admin',
      requesterName: joinRequest.user.display_name || 'A user',
      organizationName: organization.name,
      message: message,
      requestId: joinRequest.id,
    }).catch(err => {
      console.warn('[organizations] sendJoinRequestToAdmin failed:', (err as any)?.message || err);
    });
  }

  await markCoachApprovalPending(req.user!.id, {
    organization_id,
    organization_name: organization.name,
  });

  return res.status(201).json(joinRequest);
});

// Get join requests for an organization (admin only)
organizationsRouter.get(
  '/:id/join-requests',
  requireAuth as any,
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const requestedStatus = String((req.query as any).status || 'pending')
      .trim()
      .toLowerCase();

    // Check if user is owner/manager
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: id,
          user_id: req.user!.id,
        } as any,
      },
    });

    if (!membership || !isOrganizationAdmin(membership.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Paginate to bound the response. Without this a long-running org could
    // return thousands of PII rows (name + email) in a single call.
    const { limit, offset } = parsePagination(req.query);

    const joinRequests = await prisma.organizationJoinRequest.findMany({
      where: {
        organization_id: id,
        status:
          requestedStatus === 'all'
            ? undefined
            : requestedStatus === 'rejected'
              ? { in: ['rejected', 'denied'] }
              : requestedStatus,
      },
      include: {
        user: {
          select: {
            id: true,
            display_name: true,
            username: true,
            avatar_url: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    });

    return res.json(joinRequests.map(joinRequest => serializeJoinRequest(joinRequest)));
  }
);

// Get user's own join requests
organizationsRouter.get(
  '/join-requests/me',
  requireAuth as any,
  async (req: AuthedRequest, res) => {
    const { limit, offset } = parsePagination(req.query);
    const joinRequests = await prisma.organizationJoinRequest.findMany({
      where: { user_id: req.user!.id },
      include: {
        user: {
          select: {
            id: true,
            display_name: true,
            username: true,
            avatar_url: true,
            email: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            description: true,
            sport: true,
            location: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    });

    return res.json(joinRequests.map(joinRequest => serializeJoinRequest(joinRequest, true)));
  }
);

// Approve join request
organizationsRouter.post(
  '/join-requests/:requestId/approve',
  requireAuth as any,
  async (req: AuthedRequest, res) => {
    const requestId = String(req.params.requestId);

    const joinRequest = await prisma.organizationJoinRequest.findUnique({
      where: { id: requestId },
      include: {
        organization: true,
        user: {
          select: {
            id: true,
            email: true,
            display_name: true,
          },
        },
      },
    });

    if (!joinRequest) {
      return res.status(404).json({ error: 'Join request not found' });
    }

    // Check if requester is owner/manager
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: joinRequest.organization_id,
          user_id: req.user!.id,
        } as any,
      },
    });

    if (!membership || !isOrganizationAdmin(membership.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    if (joinRequest.status !== 'pending') {
      return res.status(400).json({ error: 'This request has already been reviewed' });
    }

    await approveCoachForOrganization({
      userId: joinRequest.user_id,
      organizationId: joinRequest.organization_id,
      organizationName: joinRequest.organization.name,
      actorId: req.user!.id,
    });

    // Send approval email to user
    const adminUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { display_name: true },
    });

    await sendJoinRequestApproved({
      userEmail: joinRequest.user.email,
      userName: joinRequest.user.display_name || 'User',
      organizationName: joinRequest.organization.name,
      adminName: adminUser?.display_name || 'Admin',
    });

    return res.json({ message: 'Join request approved' });
  }
);

// Reject join request
const rejectJoinRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});

const rejectJoinRequestHandler = async (req: AuthedRequest, res: any) => {
  const requestId = String(req.params.requestId);
  const parsed = rejectJoinRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

  const { reason } = parsed.data;

  const joinRequest = await prisma.organizationJoinRequest.findUnique({
    where: { id: requestId },
    include: {
      organization: true,
      user: {
        select: {
          id: true,
          email: true,
          display_name: true,
        },
      },
    },
  });

  if (!joinRequest) {
    return res.status(404).json({ error: 'Join request not found' });
  }

  // Check if requester is owner/manager
  const membership = await prisma.organizationMembership.findUnique({
    where: {
      organization_id_user_id: {
        organization_id: joinRequest.organization_id,
        user_id: req.user!.id,
      } as any,
    },
  });

  if (!membership || !isOrganizationAdmin(membership.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  if (joinRequest.status !== 'pending') {
    return res.status(400).json({ error: 'This request has already been reviewed' });
  }

  await rejectCoachForOrganization({
    userId: joinRequest.user_id,
    organizationId: joinRequest.organization_id,
    organizationName: joinRequest.organization.name,
    reason,
    actorId: req.user!.id,
  });

  // Send denial email to user
  await sendJoinRequestDenied({
    userEmail: joinRequest.user.email,
    userName: joinRequest.user.display_name || 'User',
    organizationName: joinRequest.organization.name,
    reason: reason,
  });

  return res.json({ message: 'Join request rejected' });
};

organizationsRouter.post(
  '/join-requests/:requestId/reject',
  requireAuth as any,
  rejectJoinRequestHandler
);
organizationsRouter.post(
  '/join-requests/:requestId/deny',
  requireAuth as any,
  rejectJoinRequestHandler
);
