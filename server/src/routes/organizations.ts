import { Router } from 'express';
import { z } from 'zod';
import { validateContent } from '../lib/contentFilter.js';
import {
  sendJoinRequestApproved, sendJoinRequestDenied, sendJoinRequestToAdmin,
  sendOrganizationInviteEmail, sendLeagueApprovalRequestEmail, sendLeagueApprovedEmail,
  sendLeagueRejectedEmail, sendCoachApprovedEmail, sendCoachRejectedEmail,
  sendNewCoachRequestEmail, sendAdminActionConfirmationEmail,
} from '../lib/email.js';
import { sendOrganizationApprovalEmail, sendPushNotification } from '../lib/notifications.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin, isEmailAdmin } from '../middleware/requireAdmin.js';
import { debugLog } from '../lib/debugLog.js';
import { inviteLimiter, organizationsNearbyLimiter } from '../middleware/rateLimiters.js';
import { requireOnboarded } from '../middleware/requireOnboarded.js';
import { getAuthorizedUsersOrgLimit } from '../lib/planLimits.js';
import { signJwt, verifyJwt } from '../lib/jwt.js';

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
  return role === 'owner' || role === 'manager';
}

// List organizations (public, with optional search)
organizationsRouter.get('/', async (req, res) => {
  try {
    const q = String((req.query as any).q || '').trim();
    const limit = Math.min(parseInt(String((req.query as any).limit || '20'), 10) || 20, 50);

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
            teams: true
          }
        }
      },
    });

    return res.json(organizations);
  } catch (err) {
    console.error('[organizations] GET / error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// List organizations where current user has admin access
organizationsRouter.get('/mine', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const orgs = await prisma.organization.findMany({
      where: {
        memberships: {
          some: {
            user_id: req.user!.id,
            role: { in: ['owner', 'manager'] },
            status: 'active',
          }
        }
      },
      take: 50,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        sport: true,
        org_type: true,
        created_at: true,
      }
    });
    return res.json(orgs);
  } catch (err) {
    console.error('[organizations] GET /mine error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update organization (admin only)
// H3: zip_code aligned with ads — 5-digit US format when provided
const updateOrgSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  logo_url: z.string().max(2000).optional().nullable(),
  profile_picture_url: z.string().max(2000).optional().nullable(),
  background_url: z.string().max(2000).optional().nullable(),
  sport: z.string().max(100).optional().nullable(),
  org_type: z.string().max(50).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  zip_code: z.string().regex(/^\d{5}$/, 'Must be a 5-digit US zip code').optional().nullable(),
  contact_info: z.string().max(500).optional().nullable(),
});

organizationsRouter.patch('/:id', requireAuth as any, requireOnboarded as any, async (req: AuthedRequest, res) => {
  try {
    const orgId = String(req.params.id);
    const userId = req.user!.id;

    // Verify user is org admin
    const membership = await prisma.organizationMembership.findFirst({
      where: { organization_id: orgId, user_id: userId, status: 'active', role: { in: ['owner', 'manager'] } },
    });
    if (!membership) return res.status(403).json({ error: 'Only organization admins can edit this organization.' });

    const parsed = updateOrgSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });

    const data = parsed.data;

    // Content filter on name and description
    if (data.name || data.description) {
      const filterResult = validateContent({ title: data.name, content: data.description ?? undefined });
      if (!filterResult.valid) return res.status(400).json({ error: filterResult.error, code: filterResult.code });
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.logo_url !== undefined && { logo_url: data.logo_url }),
        ...(data.profile_picture_url !== undefined && { profile_picture_url: data.profile_picture_url }),
        ...(data.background_url !== undefined && { background_url: data.background_url }),
        ...(data.sport !== undefined && { sport: data.sport }),
        ...(data.org_type !== undefined && { org_type: data.org_type }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.zip_code !== undefined && { zip_code: data.zip_code }),
      },
      select: { id: true, name: true, description: true, logo_url: true, profile_picture_url: true, background_url: true, sport: true, org_type: true, location: true, zip_code: true },
    });
    return res.json(updated);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'An organization with that name already exists in this area.' });
    console.error('[organizations] PATCH /:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Follow an organization
organizationsRouter.post('/:id/follow', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
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
  } catch (err) {
    console.error('[organizations] POST /:id/follow error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Unfollow an organization
organizationsRouter.delete('/:id/follow', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const orgId = String(req.params.id);
    await prisma.organizationFollow.deleteMany({ where: { user_id: userId, organization_id: orgId } });
    return res.json({ is_following: false });
  } catch (err) {
    console.error('[organizations] DELETE /:id/follow error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single organization
organizationsRouter.get('/:id', async (req, res) => {
  try {
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
              }
            }
          }
        },
        memberships: {
          include: {
            user: {
              select: { id: true, display_name: true, avatar_url: true }
            }
          },
          orderBy: { created_at: 'desc' }
        }
      }
    });

    if (!organization) return res.status(404).json({ error: 'Organization not found' });
    const payload = { ...organization } as any;
    payload.followers_count = (organization as any)._count?.followers ?? 0;
    payload.is_following = currentUserId
      ? !!(await prisma.organizationFollow.findFirst({ where: { user_id: currentUserId, organization_id: id } }))
      : null;
    delete payload._count;
    return res.json(payload);
  } catch (err) {
    console.error('[organizations] GET /:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get organization members
organizationsRouter.get('/:id/members', async (req, res) => {
  try {
    const id = String(req.params.id);
    const organization = await prisma.organization.findUnique({ where: { id } });
    if (!organization) return res.status(404).json({ error: 'Organization not found' });

    const members = await prisma.organizationMembership.findMany({
      where: { organization_id: id, status: 'active' },
      take: 500,
      include: {
        user: {
          select: {
            id: true,
            display_name: true,
            username: true,
            avatar_url: true,
            preferences: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    const list = members.map((m) => {
      const user = (m as any).user;
      const prefs = (user?.preferences || {}) as any;
      return {
        ...m,
        user: {
          id: user?.id,
          display_name: user?.display_name,
          username: user?.username,
          avatar_url: user?.avatar_url,
          is_parent: prefs?.is_parent === true,
        }
      };
    });

    return res.json(list);
  } catch (err) {
    console.error('[organizations] GET /:id/members error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// H3: zip_code aligned with ads — 5-digit US format when provided
const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  sport: z.string().max(100).optional(),
  org_type: z.string().max(100).optional(),
  location: z.string().max(255).optional(),
  zip_code: z.string().regex(/^\d{5}$/, 'Must be a 5-digit US zip code').optional(),
  season_start: z.string().optional(),
  season_end: z.string().optional(),
  supporting_document_url: z.string().url({ message: 'Supporting document is required' }),
});

// Create organization
organizationsRouter.post('/', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const parsed = createOrganizationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

    const data = parsed.data;
    // Duplicate guard: when zip_code is provided scope to that area; otherwise skip the
    // full-table scan (no zip_code means we can't reliably detect cross-area duplicates and
    // `zip_code: undefined` in a Prisma where clause removes the filter entirely, causing a
    // scan of ALL organizations).
    const nm = normalizeOrganizationName(data.name);
    let dup: { id: string; name: string } | null = null;
    if (data.zip_code) {
      const sameZipOrgs = await prisma.organization.findMany({
        where: { zip_code: data.zip_code, status: 'active' },
        select: { id: true, name: true },
        take: 100,
      });
      dup = sameZipOrgs.find(o => normalizeOrganizationName(o.name) === nm) ?? null;
    }
    if (dup) {
      return res.status(409).json({ error: 'DUPLICATE_ORGANIZATION', duplicate_of: { id: dup.id, name: dup.name } });
    }
    const filterResult = validateContent({ title: data.name, content: data.description ?? undefined });
    if (!filterResult.valid) {
      return res.status(400).json({ error: filterResult.error, code: filterResult.code });
    }
    // Transaction: create org + owner membership + set coach to PENDING atomically
    const organization = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          ...data,
          season_start: data.season_start ? new Date(data.season_start) : null,
          season_end: data.season_end ? new Date(data.season_end) : null,
          updated_at: new Date(),
          league_owner_id: req.user!.id,
          admin_approved: false, // requires super admin approval
        }
      });
      await tx.organizationMembership.create({
        data: {
          organization_id: org.id,
          user_id: req.user!.id,
          role: 'owner'
        }
      });
      // Set coach to PENDING until league is approved by super admin
      await tx.user.update({
        where: { id: req.user!.id },
        data: { approval_status: 'PENDING' },
      });
      return org;
    });

    // Send approval request email to super admin (best effort)
    const creator = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { display_name: true, email: true } });
    const approveToken = signJwt({ orgId: organization.id, action: 'approve_league' }, '7d');
    const rejectToken = signJwt({ orgId: organization.id, action: 'reject_league' }, '7d');
    sendLeagueApprovalRequestEmail({
      leagueId: organization.id,
      leagueName: organization.name,
      ownerName: creator?.display_name || 'Unknown',
      ownerEmail: creator?.email || '',
      sport: data.sport,
      orgType: data.org_type,
      approveToken,
      rejectToken,
    }).then((sent) => {
      if (!sent) {
        console.warn('[organizations] League approval request email reported unsent (/). Check mail provider config.');
      }
    }).catch((err) => {
      console.warn('[organizations] Failed sending league approval request email (/):', err);
    });

    return res.status(201).json(organization);
  } catch (err) {
    console.error('[organizations] POST / error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// H3: zip_code aligned with ads — 5-digit US format when provided
const createOrganizationWithTeamsSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  sport: z.string().max(100).optional(),
  org_type: z.string().max(100).optional(),
  location: z.string().max(255).optional(),
  zip_code: z.string().regex(/^\d{5}$/, 'Must be a 5-digit US zip code').optional(),
  season_start: z.string().optional(),
  season_end: z.string().optional(),
  supporting_document_url: z.string().url({ message: 'Supporting document is required' }),
  authorized_users: z.array(z.object({
    email: z.string().email().optional(),
    user_id: z.string().optional(),
    role: z.string().optional(),
    assign_team: z.string().optional(),
  })).optional(),
});

// Enhanced create organization for onboarding
organizationsRouter.post('/create', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const parsed = createOrganizationWithTeamsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

    const data = parsed.data;
    // Duplicate guard (same logic as simple create)
    const nm = normalizeOrganizationName(data.name);
    const duplicateWhere: any = { status: 'active' };
    if (data.zip_code) duplicateWhere.zip_code = data.zip_code;
    const possibleDuplicates = await prisma.organization.findMany({
      where: duplicateWhere,
      select: { id: true, name: true, zip_code: true },
      take: 100,
    });
    const dup = possibleDuplicates.find(o => normalizeOrganizationName(o.name) === nm);
    if (dup) {
      return res.status(409).json({ error: 'DUPLICATE_ORGANIZATION', duplicate_of: { id: dup.id, name: dup.name } });
    }
    const filterResult = validateContent({ title: data.name, content: data.description ?? undefined });
    if (!filterResult.valid) {
      return res.status(400).json({ error: filterResult.error, code: filterResult.code });
    }

    // Transaction: create org + owner membership + set league owner to PENDING atomically
    // League owner has no coach access until super admin approves the league
    const organization = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
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
          league_owner_id: req.user!.id,
          admin_approved: false, // requires super admin approval
        }
      });
      await tx.organizationMembership.create({
        data: {
          organization_id: org.id,
          user_id: req.user!.id,
          role: 'owner'
        }
      });
      await tx.user.update({
        where: { id: req.user!.id },
        data: { approval_status: 'PENDING' },
      });
      return org;
    });

    // Send approval request email to super admin (best effort)
    const creator = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { display_name: true, email: true } });
    const approveToken = signJwt({ orgId: organization.id, action: 'approve_league' }, '7d');
    const rejectToken = signJwt({ orgId: organization.id, action: 'reject_league' }, '7d');
    sendLeagueApprovalRequestEmail({
      leagueId: organization.id,
      leagueName: organization.name,
      ownerName: creator?.display_name || 'Unknown',
      ownerEmail: creator?.email || '',
      sport: data.sport,
      orgType: data.org_type,
      approveToken,
      rejectToken,
    }).then((sent) => {
      if (!sent) {
        console.warn('[organizations] League approval request email reported unsent (/create). Check mail provider config.');
      }
    }).catch((err) => {
      console.warn('[organizations] Failed sending league approval request email (/create):', err);
    });

    // Send invites to authorized users
    if (data.authorized_users && data.authorized_users.length > 0) {
      const invites = data.authorized_users
        .filter(user => user.email)
        .map(user => ({
          organization_id: organization.id,
          email: user.email!,
          role: user.role || 'member',
        }));

      if (invites.length > 0) {
        await prisma.organizationInvite.createMany({
          data: invites,
          skipDuplicates: true,
        });
        // Send invite emails (best effort)
        const [inviter, createdInvites] = await Promise.all([
          prisma.user.findUnique({ where: { id: req.user!.id }, select: { display_name: true } }),
          prisma.organizationInvite.findMany({
            where: { organization_id: organization.id, email: { in: invites.map(i => i.email) } },
            select: { id: true, email: true },
          }),
        ]);
        const tokenByEmail = Object.fromEntries(createdInvites.map(i => [i.email, i.id]));
        await Promise.all(invites.map(inv =>
          sendOrganizationInviteEmail({
            to: inv.email,
            organizationName: organization.name,
            role: inv.role,
            inviterName: inviter?.display_name || 'An organizer',
            inviteToken: tokenByEmail[inv.email],
          }).then((sent) => {
            if (!sent) {
              console.warn(`[organizations] Invite email reported unsent for ${inv.email}.`);
            }
            return sent;
          }).catch((err) => {
            console.warn(`[organizations] Failed sending invite email to ${inv.email}:`, err);
            return false;
          })
        ));
      }
    }

    return res.status(201).json(organization);
  } catch (err) {
    console.error('[organizations] POST /create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.string().optional(),
});

// Invite user to organization
// Rule B: No plan gate on the inviting user — authorized users are covered by the org owner's plan.
// The plan-based user limit is enforced inside the handler using the org owner's tier.
organizationsRouter.post('/:id/invite', requireAuth as any, requireOnboarded as any, inviteLimiter, async (req: AuthedRequest, res) => {
  try {
  const id = String(req.params.id);
  const parsed = inviteUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

  const { email, role } = parsed.data;

  // Check if user is a member of the organization
  const membership = await prisma.organizationMembership.findUnique({
    where: { organization_id_user_id: { organization_id: id, user_id: req.user!.id } as any }
  });

  if (!membership || !isOrganizationAdmin(membership.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  // PLAN LIMITS: Enforce authorized user caps based on ORG OWNER's plan (Rule B).
  // Authorized users are covered by the coach's plan — never charged individually.
  const ownerMembership = await prisma.organizationMembership.findFirst({
    where: { organization_id: id, role: 'owner', status: 'active' },
    select: { user_id: true },
  });
  const ownerId = ownerMembership?.user_id || req.user!.id;
  const owner = await prisma.user.findUnique({ where: { id: ownerId } });
  if (!owner) {
    return res.status(404).json({ error: 'Organization owner not found. Please contact support.' });
  }
  const ownerPrefs = (owner.preferences || {}) as any;
  // Use confirmed plan only — pending_plan is not yet paid for
  const plan = ownerPrefs.payment_pending ? 'rookie' : (ownerPrefs.plan || 'rookie');

  // Get team count for org-level limit calculation (from org owner's profile)
  const teamCountTotal = ownerPrefs.team_count_total || await prisma.teamMembership.count({
    where: { user_id: ownerId, role: 'owner' }
  });

  // Get organization-level limit from the owner's plan definitions
  const limit = getAuthorizedUsersOrgLimit(plan, teamCountTotal);

  // Atomic limit check + create to prevent race condition on concurrent invites
  const invite = await prisma.$transaction(async (tx) => {
    if (limit !== null) {
      const inviteCount = await tx.organizationInvite.count({ where: { organization_id: id, status: 'pending' } });
      const memberCount = await tx.organizationMembership.count({ where: { organization_id: id, status: 'active', role: { in: ['manager','member'] } } });
      const totalAuthorized = inviteCount + memberCount;
      if (totalAuthorized >= limit) {
        throw Object.assign(new Error('USER_LIMIT_REACHED'), {
          status: 403,
          body: {
            error: 'USER_LIMIT_REACHED',
            message: `Plan limit reached. ${plan} plan allows ${limit} authorized user${limit === 1 ? '' : 's'} for your organization.`,
            limit,
            current: totalAuthorized,
          },
        });
      }
    }
    return tx.organizationInvite.create({
      data: { organization_id: id, email, role: role || 'member' },
    });
  });

  // Send email (best effort)
  const org = await prisma.organization.findUnique({ where: { id }, select: { name: true } });
  const inviter = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { display_name: true } });
  if (org) {
    await sendOrganizationInviteEmail({
      to: email,
      organizationName: org.name,
      role: role || 'member',
      inviterName: inviter?.display_name || 'An organizer',
      inviteToken: invite.id,
    }).then((sent) => {
      if (!sent) {
        console.warn(`[organizations] Direct invite email reported unsent for ${email}.`);
      }
      return sent;
    }).catch((err) => {
      console.warn(`[organizations] Failed sending direct invite email to ${email}:`, err);
      return false;
    });
  }

  return res.status(201).json(invite);
  } catch (err: any) {
    if (err?.status && err?.body) {
      return res.status(err.status).json(err.body);
    }
    console.error('[organizations] POST /:id/invite error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get my organization invites
organizationsRouter.get('/invites/me', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const invites = await prisma.organizationInvite.findMany({
      where: { email: user.email, status: 'pending' },
      include: { organization: true },
      orderBy: { created_at: 'desc' }
    });

    return res.json(invites);
  } catch (err) {
    console.error('[organizations] GET /invites/me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept organization invite
organizationsRouter.post('/invites/:inviteId/accept', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const inviteId = String(req.params.inviteId);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const invite = await prisma.organizationInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.email !== user.email || invite.status !== 'pending') {
      return res.status(404).json({ error: 'Invite not found or not valid' });
    }

    await prisma.$transaction([
      prisma.organizationMembership.upsert({
        where: { organization_id_user_id: { organization_id: invite.organization_id, user_id: user.id } as any },
        update: { role: invite.role, status: 'active' },
        create: { organization_id: invite.organization_id, user_id: user.id, role: invite.role, status: 'active' }
      }),
      prisma.organizationInvite.update({ where: { id: inviteId }, data: { status: 'accepted' } }),
    ]);

    // Send welcome email
    const org = await prisma.organization.findUnique({ where: { id: invite.organization_id }, select: { name: true } });
    if (org) {
      await sendOrganizationApprovalEmail({ to: user.email, organizationName: org.name }).catch(err =>
        console.warn('[org-invite-accept] Email send failed:', err)
      );
    }

    return res.json({ message: 'Invite accepted' });
  } catch (err) {
    console.error('[organizations] POST /invites/:inviteId/accept error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Decline organization invite
organizationsRouter.post('/invites/:inviteId/decline', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const inviteId = String(req.params.inviteId);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const invite = await prisma.organizationInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.email !== user.email || invite.status !== 'pending') {
      return res.status(404).json({ error: 'Invite not found or not valid' });
    }

    await prisma.organizationInvite.update({ where: { id: inviteId }, data: { status: 'declined' } });
    return res.json({ message: 'Invite declined' });
  } catch (err) {
    console.error('[organizations] POST /invites/:inviteId/decline error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ===========================================
// Organization Join Request Endpoints
// ===========================================

// Search organizations by zip code / proximity
organizationsRouter.get('/search/nearby', organizationsNearbyLimiter, async (req, res) => {
  try {
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
            { location: { contains: query, mode: 'insensitive' } }
          ]
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
            teams: true
          }
        }
      },
    });

    debugLog(`✅ Found ${organizations.length} organizations matching "${query}"`);
    return res.json(organizations);
  } catch (err) {
    console.error('[organizations] GET /search/nearby error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Check for duplicate organizations using normalized name comparison
organizationsRouter.post('/check-duplicate', requireAuth as any, async (req, res) => {
  try {
    const { name, zip_code } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const normalizedInput = normalizeOrganizationName(name);
    if (!normalizedInput) {
      return res.json({ exists: false, organization: null });
    }

    // If zip_code provided, check orgs in that zip first
    if (zip_code) {
      const localOrgs = await prisma.organization.findMany({
        where: { zip_code, status: 'active' },
        select: { id: true, name: true, location: true, sport: true },
      });
      const localMatch = localOrgs.find(
        (o) => normalizeOrganizationName(o.name) === normalizedInput
      );
      if (localMatch) {
        return res.json({ exists: true, organization: localMatch });
      }
    }

    // Broader name-only scan as fallback (recent 200 active orgs)
    const recentOrgs = await prisma.organization.findMany({
      where: { status: 'active' },
      orderBy: { created_at: 'desc' },
      take: 200,
      select: { id: true, name: true, location: true, sport: true },
    });
    const broadMatch = recentOrgs.find(
      (o) => normalizeOrganizationName(o.name) === normalizedInput
    );

    return res.json({
      exists: !!broadMatch,
      organization: broadMatch ?? null,
    });
  } catch (err) {
    console.error('[organizations] POST /check-duplicate error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create join request
const createJoinRequestSchema = z.object({
  organization_id: z.string(),
  message: z.string().max(500).optional(),
});

organizationsRouter.post('/join-requests', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
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
              select: { id: true, email: true, display_name: true }
            }
          }
        }
      }
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check if user is already a member
    const existingMembership = await prisma.organizationMembership.findUnique({
      where: {
        organization_id_user_id: {
          organization_id,
          user_id: req.user!.id
        } as any
      }
    });

    if (existingMembership) {
      return res.status(400).json({ error: 'You are already a member of this organization' });
    }

    // Check for existing pending request
    const existingRequest = await prisma.organizationJoinRequest.findUnique({
      where: {
        organization_id_user_id: {
          organization_id,
          user_id: req.user!.id
        } as any
      }
    });

    if (existingRequest && existingRequest.status === 'pending') {
      return res.status(400).json({ error: 'You already have a pending request for this organization' });
    }

    // Create or update join request
    const joinRequest = await prisma.organizationJoinRequest.upsert({
      where: {
        organization_id_user_id: {
          organization_id,
          user_id: req.user!.id
        } as any
      },
      create: {
        organization_id,
        user_id: req.user!.id,
        message,
        status: 'pending'
      },
      update: {
        message,
        status: 'pending',
        created_at: new Date(),
        reviewed_at: null,
        reviewed_by: null
      },
      include: {
        user: {
          select: { id: true, display_name: true, email: true }
        }
      }
    });

    // Set coach approval_status to PENDING (if they're a coach)
    const requesterPrefs = (joinRequest.user as any)?.preferences;
    const isCoachRole = requesterPrefs?.role === 'coach' ||
      (await prisma.user.findUnique({ where: { id: req.user!.id }, select: { preferences: true } })
        .then(u => (u?.preferences as any)?.role === 'coach'));
    if (isCoachRole) {
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { approval_status: 'PENDING' },
      });
    }

    // Send email notification to organization owners
    if (organization.memberships.length > 0) {
      const owner = organization.memberships[0];
      try {
        // Legacy template-based notification
        await sendJoinRequestToAdmin({
          adminEmail: owner.user.email,
          adminName: owner.user.display_name || 'Admin',
          requesterName: joinRequest.user.display_name || 'A user',
          organizationName: organization.name,
          message: message,
          requestId: joinRequest.id,
        });

        // Coach request notification to league owner (SendGrid template)
        await sendNewCoachRequestEmail({
          to: owner.user.email,
          ownerName: owner.user.display_name || 'League Owner',
          coachName: joinRequest.user.display_name || 'A coach',
          coachEmail: joinRequest.user.email,
          leagueName: organization.name,
          requestId: joinRequest.id,
          organizationId: organization.id,
        });

        // Push notification to league owner
        sendPushNotification(
          owner.user.id,
          'New coach request',
          `${joinRequest.user.display_name || 'A coach'} wants to join ${organization.name}`,
          { type: 'coach_request', screen: 'approvals', organization_id: organization.id },
        ).catch(() => {});

        // In-app notification record for league owner
        prisma.notification.create({
          data: {
            user_id: owner.user.id,
            actor_id: req.user!.id,
            type: 'TEAM_INVITE', // Closest available type for coach request
            meta: {
              coach_request: true,
              organization_id: organization.id,
              organization_name: organization.name,
              coach_name: joinRequest.user.display_name || 'A coach',
            },
          },
        }).catch(() => {});
      } catch (err) {
        console.error('Failed to send join request email to admin:', err);
      }
    }

    return res.status(201).json(joinRequest);
  } catch (err) {
    console.error('[organizations] POST /join-requests error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get join requests for an organization (admin only)
organizationsRouter.get('/:id/join-requests', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id);
    const status = String((req.query as any).status || 'pending');

    // Check if user is owner/manager
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: id,
          user_id: req.user!.id
        } as any
      }
    });

    if (!membership || !isOrganizationAdmin(membership.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const joinRequests = await prisma.organizationJoinRequest.findMany({
      where: {
        organization_id: id,
        status: status === 'all' ? undefined : status
      },
      include: {
        user: {
          select: {
            id: true,
            display_name: true,
            username: true,
            avatar_url: true,
            email: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    return res.json(joinRequests);
  } catch (err) {
    console.error('[organizations] GET /:id/join-requests error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's own join requests
organizationsRouter.get('/join-requests/me', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const joinRequests = await prisma.organizationJoinRequest.findMany({
      where: { user_id: req.user!.id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            description: true,
            sport: true,
            location: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    return res.json(joinRequests);
  } catch (err) {
    console.error('[organizations] GET /join-requests/me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve join request
organizationsRouter.post('/join-requests/:requestId/approve', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
  const requestId = String(req.params.requestId);

  const joinRequest = await prisma.organizationJoinRequest.findUnique({
    where: { id: requestId },
    include: {
      organization: true,
      user: {
        select: {
          id: true,
          email: true,
          display_name: true
        }
      }
    }
  });
  
  if (!joinRequest) {
    return res.status(404).json({ error: 'Join request not found' });
  }
  
  // Check if requester is owner/manager
  const membership = await prisma.organizationMembership.findUnique({
    where: { 
      organization_id_user_id: { 
        organization_id: joinRequest.organization_id, 
        user_id: req.user!.id 
      } as any 
    }
  });
  
  if (!membership || !isOrganizationAdmin(membership.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  if (joinRequest.status !== 'pending') {
    return res.status(400).json({ error: 'This request has already been reviewed' });
  }
  
  // Update join request, create membership, and set coach approval — approved coaches get free access
  await prisma.$transaction([
    prisma.organizationJoinRequest.update({
      where: { id: requestId },
      data: {
        status: 'approved',
        reviewed_at: new Date(),
        reviewed_by: req.user!.id
      }
    }),
    prisma.organizationMembership.create({
      data: {
        organization_id: joinRequest.organization_id,
        user_id: joinRequest.user_id,
        role: 'member',
        status: 'active'
      }
    }),
    prisma.user.update({
      where: { id: joinRequest.user_id },
      data: { approval_status: 'APPROVED', paid_by_owner: true }
    }),
  ]);
  
  // Send approval email to user
  const adminUser = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { display_name: true }
  });
  
  try {
    await sendJoinRequestApproved({
      userEmail: joinRequest.user.email,
      userName: joinRequest.user.display_name || 'User',
      organizationName: joinRequest.organization.name,
      adminName: adminUser?.display_name || 'Admin',
    });
  } catch (err) {
    console.error('Failed to send join request approved email:', err);
  }

  // Push notification so coach knows they were approved
  try {
    await sendPushNotification(
      joinRequest.user_id,
      'Join Request Approved',
      `Your request to join ${joinRequest.organization.name} was approved!`,
      { type: 'join_request_approved', organization_id: joinRequest.organization_id }
    );
  } catch (err) {
    console.error('Failed to send join request approved push notification:', err);
  }

  return res.json({ message: 'Join request approved' });
  } catch (err) {
    console.error('[organizations] POST /join-requests/:requestId/approve error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Deny join request
const denyJoinRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});

organizationsRouter.post('/join-requests/:requestId/deny', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
  const requestId = String(req.params.requestId);
  const parsed = denyJoinRequestSchema.safeParse(req.body);
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
          display_name: true
        }
      }
    }
  });
  
  if (!joinRequest) {
    return res.status(404).json({ error: 'Join request not found' });
  }
  
  // Check if requester is owner/manager
  const membership = await prisma.organizationMembership.findUnique({
    where: { 
      organization_id_user_id: { 
        organization_id: joinRequest.organization_id, 
        user_id: req.user!.id 
      } as any 
    }
  });
  
  if (!membership || !isOrganizationAdmin(membership.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  if (joinRequest.status !== 'pending') {
    return res.status(400).json({ error: 'This request has already been reviewed' });
  }
  
  await prisma.organizationJoinRequest.update({
    where: { id: requestId },
    data: {
      status: 'denied',
      reviewed_at: new Date(),
      reviewed_by: req.user!.id,
      message: reason || joinRequest.message // Store denial reason in message field
    }
  });
  
  // Send denial email to user
  try {
    await sendJoinRequestDenied({
      userEmail: joinRequest.user.email,
      userName: joinRequest.user.display_name || 'User',
      organizationName: joinRequest.organization.name,
      reason: reason,
    });
  } catch (err) {
    console.error('Failed to send join request denied email:', err);
  }
  
  return res.json({ message: 'Join request denied' });
  } catch (err) {
    console.error('[organizations] POST /join-requests/:requestId/deny error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// -----------------------------------------------
// POST /organizations/:id/transfer-ownership
// -----------------------------------------------
organizationsRouter.post('/:id/transfer-ownership', requireAuth as any, requireOnboarded as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const orgId = req.params.id;
    const { new_owner_id } = req.body || {};
    if (!new_owner_id) return res.status(400).json({ error: 'new_owner_id is required' });

    // Verify requester is current owner
    const currentOwnership = await prisma.organizationMembership.findFirst({
      where: { organization_id: orgId, user_id: req.user.id, role: 'owner' },
    });
    if (!currentOwnership) {
      return res.status(403).json({ error: 'Only the current owner can transfer ownership' });
    }

    // Verify new owner is a member of the organization
    const newOwnerMembership = await prisma.organizationMembership.findFirst({
      where: { organization_id: orgId, user_id: new_owner_id },
    });
    if (!newOwnerMembership) {
      return res.status(400).json({ error: 'New owner must be a member of the organization' });
    }

    // Transfer: demote current owner to admin, promote new owner
    await prisma.$transaction([
      prisma.organizationMembership.update({
        where: { id: currentOwnership.id },
        data: { role: 'admin' },
      }),
      prisma.organizationMembership.update({
        where: { id: newOwnerMembership.id },
        data: { role: 'owner' },
      }),
    ]);

    return res.json({ message: 'Ownership transferred successfully' });
  } catch (err) {
    console.error('[organizations] POST /:id/transfer-ownership error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// SUPER ADMIN LEAGUE APPROVAL (emancero@varsityhub.app)
// =====================================================

/**
 * POST /organizations/:id/approve
 * Approves a league page. Supports two auth methods:
 * 1. Authenticated admin (requireAdmin middleware)
 * 2. Email-based token (JWT in query param, no login required)
 */
// GET handler so email links work as simple browser clicks
organizationsRouter.get('/:id/approve', (req, res, next) => { (approveLeagueHandler as any)(req, res).catch(next); });
organizationsRouter.post('/:id/approve', (req, res, next) => { (approveLeagueHandler as any)(req, res).catch(next); });

async function approveLeagueHandler(req: AuthedRequest, res: any) {
  try {
    const orgId = req.params.id;
    const token = req.query.token as string | undefined;

    // Auth: either signed token OR authenticated admin
    let adminUserId: string | null = null;

    if (token) {
      const payload = verifyJwt<{ orgId: string; action: string }>(token);
      if (!payload || payload.orgId !== orgId || payload.action !== 'approve_league') {
        return res.status(401).json({ error: 'Invalid or expired approval token' });
      }
    } else {
      // Require authenticated admin
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true } });
      if (!isEmailAdmin(me?.email)) return res.status(403).json({ error: 'Admin only' });
      adminUserId = req.user.id;
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: { leagueOwner: { select: { id: true, display_name: true, email: true } } },
    });
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    if (org.admin_approved) return res.json({ message: 'Already approved' });

    // Atomic approval: WHERE admin_approved=false prevents race condition
    // if two admins approve simultaneously
    const updated = await prisma.organization.updateMany({
      where: { id: orgId, admin_approved: false },
      data: {
        admin_approved: true,
        approved_by: adminUserId || 'email-token',
        approved_at: new Date(),
      },
    });

    // If no rows updated, another request already approved it
    if (updated.count === 0) return res.json({ message: 'Already approved' });

    // Approve the league owner so they get coach tools
    if (org.leagueOwner?.id) {
      await prisma.user.update({
        where: { id: org.leagueOwner.id },
        data: { approval_status: 'APPROVED' },
      });
    }

    // Email league owner
    if (org.leagueOwner?.email) {
      sendLeagueApprovedEmail({
        to: org.leagueOwner.email,
        ownerName: org.leagueOwner.display_name || 'League Owner',
        leagueName: org.name,
      }).catch(() => {});
    }

    // Confirm action to super admin (SendGrid template)
    sendAdminActionConfirmationEmail({
      to: 'emancero@varsityhub.app',
      action: 'league_approved',
      leagueName: org.name,
      ownerName: org.leagueOwner?.display_name || undefined,
      ownerEmail: org.leagueOwner?.email || undefined,
    }).catch(() => {});

    // If accessed via browser link, show a simple HTML confirmation (escape org.name to prevent XSS)
    if (token) {
      const safeName = String(org.name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      return res.send(`<html><body style="font-family:Arial;text-align:center;padding:60px"><h1 style="color:#16A34A">League Approved</h1><p>"${safeName}" is now live on VarsityHub.</p></body></html>`);
    }

    return res.json({ message: 'League approved', organization_id: orgId });
  } catch (err) {
    console.error('[organizations] POST /:id/approve error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET handler so email reject links work as simple browser clicks
organizationsRouter.get('/:id/reject', (req, res, next) => { (rejectLeagueHandler as any)(req, res).catch(next); });
organizationsRouter.post('/:id/reject', (req, res, next) => { (rejectLeagueHandler as any)(req, res).catch(next); });

async function rejectLeagueHandler(req: AuthedRequest, res: any) {
  try {
    const orgId = req.params.id;
    const token = req.query.token as string | undefined;
    const reason = req.body?.reason as string | undefined;

    // Auth: either signed token OR authenticated admin
    if (token) {
      const payload = verifyJwt<{ orgId: string; action: string }>(token);
      if (!payload || payload.orgId !== orgId || payload.action !== 'reject_league') {
        return res.status(401).json({ error: 'Invalid or expired rejection token' });
      }
    } else {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true } });
      if (!isEmailAdmin(me?.email)) return res.status(403).json({ error: 'Admin only' });
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: { leagueOwner: { select: { id: true, display_name: true, email: true } } },
    });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    await prisma.organization.update({
      where: { id: orgId },
      data: { status: 'rejected' },
    });

    // Set league owner back to REJECTED so they can't access coach tools
    if (org.leagueOwner?.id) {
      await prisma.user.update({
        where: { id: org.leagueOwner.id },
        data: { approval_status: 'REJECTED' },
      });
    }

    // Email league owner
    if (org.leagueOwner?.email) {
      sendLeagueRejectedEmail({
        to: org.leagueOwner.email,
        ownerName: org.leagueOwner.display_name || 'League Owner',
        leagueName: org.name,
        reason,
      }).catch(() => {});
    }

    // Confirm action to super admin (SendGrid template)
    sendAdminActionConfirmationEmail({
      to: 'emancero@varsityhub.app',
      action: 'league_rejected',
      leagueName: org.name,
      ownerName: org.leagueOwner?.display_name || undefined,
      ownerEmail: org.leagueOwner?.email || undefined,
      reason,
    }).catch(() => {});

    if (token) {
      const safeName = String(org.name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      return res.send(`<html><body style="font-family:Arial;text-align:center;padding:60px"><h1 style="color:#DC2626">League Rejected</h1><p>"${safeName}" has been declined.</p></body></html>`);
    }

    return res.json({ message: 'League rejected', organization_id: orgId });
  } catch (err) {
    console.error('[organizations] POST /:id/reject error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// =====================================================
// LEAGUE OWNER → COACH APPROVAL
// =====================================================

/**
 * GET /organizations/:id/pending-coaches
 * Returns all users with PENDING approval_status who have a join request for this org.
 * Requires league owner role.
 */
organizationsRouter.get('/:id/pending-coaches', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const orgId = req.params.id;

    // Verify requester is league owner
    const membership = await prisma.organizationMembership.findFirst({
      where: { organization_id: orgId, user_id: req.user.id, role: 'owner', status: 'active' },
    });
    if (!membership) return res.status(403).json({ error: 'Only the league owner can view pending coaches' });

    const pendingRequests = await prisma.organizationJoinRequest.findMany({
      where: { organization_id: orgId, status: 'pending' },
      include: {
        user: {
          select: {
            id: true, display_name: true, username: true,
            avatar_url: true, approval_status: true, preferences: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return res.json(pendingRequests);
  } catch (err) {
    console.error('[organizations] GET /:id/pending-coaches error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /organizations/:id/coaches/:userId/approve
 * League owner approves a coach. Sets approval_status: APPROVED, paid_by_owner: true.
 */
organizationsRouter.post('/:id/coaches/:userId/approve', requireAuth as any, requireOnboarded as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { id: orgId, userId: coachId } = req.params;
    const { team_id: teamId } = req.body || {};

    // Verify requester is league owner
    const membership = await prisma.organizationMembership.findFirst({
      where: { organization_id: orgId, user_id: req.user.id, role: 'owner', status: 'active' },
    });
    if (!membership) return res.status(403).json({ error: 'Only the league owner can approve coaches' });

    // Verify there's a pending join request for this coach
    const joinRequest = await prisma.organizationJoinRequest.findFirst({
      where: { organization_id: orgId, user_id: coachId, status: 'pending' },
    });
    if (!joinRequest) return res.status(404).json({ error: 'No pending join request found for this coach' });

    // If team_id provided, verify the team belongs to this organization
    if (teamId) {
      const team = await prisma.team.findUnique({ where: { id: teamId }, select: { organization_id: true } });
      if (!team || team.organization_id !== orgId) {
        return res.status(400).json({ error: 'Team does not belong to this organization' });
      }
    }

    // Get org and coach info
    const [org, coach] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: coachId }, select: { display_name: true, email: true } }),
    ]);

    // Approve: update join request, create org membership, assign to team, set coach approval status
    const txOps: any[] = [
      prisma.organizationJoinRequest.update({
        where: { id: joinRequest.id },
        data: { status: 'approved', reviewed_at: new Date(), reviewed_by: req.user.id },
      }),
      prisma.organizationMembership.create({
        data: { organization_id: orgId, user_id: coachId, role: 'member', status: 'active' },
      }),
      prisma.user.update({
        where: { id: coachId },
        data: { approval_status: 'APPROVED', paid_by_owner: true },
      }),
    ];

    // Assign coach to specific team if provided
    if (teamId) {
      txOps.push(
        prisma.teamMembership.create({
          data: { team_id: teamId, user_id: coachId, role: 'coach', status: 'active' },
        })
      );
    }

    await prisma.$transaction(txOps);

    // Email the coach
    if (coach?.email) {
      sendCoachApprovedEmail({
        to: coach.email,
        coachName: coach.display_name || 'Coach',
        leagueName: org?.name || 'your league',
      }).catch(() => {});
    }

    // Push notification to coach
    sendPushNotification(
      coachId,
      'Application Approved!',
      `${org?.name || 'Your league'} approved your coach application`,
      { type: 'coach_approved', screen: 'onboarding', organization_id: orgId },
    ).catch(() => {});

    // In-app notification for coach
    prisma.notification.create({
      data: {
        user_id: coachId,
        actor_id: req.user.id,
        type: 'TEAM_INVITE', // Closest available type
        meta: {
          coach_approved: true,
          organization_id: orgId,
          organization_name: org?.name || 'your league',
        },
      },
    }).catch(() => {});

    return res.json({ message: 'Coach approved', coach_id: coachId });
  } catch (err: any) {
    // Handle unique constraint violation (coach already a member)
    if (err?.code === 'P2002') {
      // Already a member — just update the join request and approval status
      const { id: orgId, userId: coachId } = req.params;
      await prisma.organizationJoinRequest.updateMany({
        where: { organization_id: orgId, user_id: coachId, status: 'pending' },
        data: { status: 'approved', reviewed_at: new Date(), reviewed_by: req.user!.id },
      });
      await prisma.user.update({
        where: { id: coachId },
        data: { approval_status: 'APPROVED', paid_by_owner: true },
      });
      return res.json({ message: 'Coach approved (already a member)', coach_id: coachId });
    }
    console.error('[organizations] POST /:id/coaches/:userId/approve error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /organizations/:id/coaches/:userId/reject
 * League owner rejects a coach request.
 */
organizationsRouter.post('/:id/coaches/:userId/reject', requireAuth as any, requireOnboarded as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { id: orgId, userId: coachId } = req.params;
    const reason = req.body?.reason as string | undefined;

    // Verify requester is league owner
    const membership = await prisma.organizationMembership.findFirst({
      where: { organization_id: orgId, user_id: req.user.id, role: 'owner', status: 'active' },
    });
    if (!membership) return res.status(403).json({ error: 'Only the league owner can reject coaches' });

    const joinRequest = await prisma.organizationJoinRequest.findFirst({
      where: { organization_id: orgId, user_id: coachId, status: 'pending' },
    });
    if (!joinRequest) return res.status(404).json({ error: 'No pending join request found for this coach' });

    const [org, coach] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: coachId }, select: { display_name: true, email: true } }),
    ]);

    await prisma.$transaction([
      prisma.organizationJoinRequest.update({
        where: { id: joinRequest.id },
        data: { status: 'denied', message: reason, reviewed_at: new Date(), reviewed_by: req.user.id },
      }),
      prisma.user.update({
        where: { id: coachId },
        data: { approval_status: 'REJECTED' },
      }),
    ]);

    if (coach?.email) {
      sendCoachRejectedEmail({
        to: coach.email,
        coachName: coach.display_name || 'Coach',
        leagueName: org?.name || 'the league',
        reason,
      }).catch(() => {});
    }

    return res.json({ message: 'Coach request rejected', coach_id: coachId });
  } catch (err) {
    console.error('[organizations] POST /:id/coaches/:userId/reject error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
