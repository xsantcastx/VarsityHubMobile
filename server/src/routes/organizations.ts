import { Router } from 'express';
import { z } from 'zod';
import { validateContent } from '../lib/contentFilter.js';
import {
  sendOrganizationInviteEmail, sendLeagueApprovalRequestEmail,
  sendCoachApprovedEmail, sendCoachRejectedEmail,
  sendCoachJoinRequestEmail,
} from '../lib/email.js';
import { sendPushNotification } from '../lib/notifications.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { requireAdmin, isEmailAdmin } from '../middleware/requireAdmin.js';
import { debugLog } from '../lib/debugLog.js';
import escapeHtml from 'escape-html';
import { inviteLimiter, organizationsNearbyLimiter } from '../middleware/rateLimiters.js';
import { requireOnboarded } from '../middleware/requireOnboarded.js';
import { getAuthorizedUsersOrgLimit } from '../lib/planLimits.js';
import { signJwt, verifyJwt } from '../lib/jwt.js';
import { registerIdValidation } from '../middleware/validateParams.js';
import { approveOrganization, rejectOrganization } from '../lib/approvalService.js';
import { logAdminActivity } from '../lib/adminActivityLogger.js';
import { invalidateMeCacheForUser } from '../lib/userCache.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const organizationsRouter = Router();
registerIdValidation(organizationsRouter);

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

async function isCurrentUserPlatformAdmin(req: AuthedRequest): Promise<boolean> {
  if (!req.user?.id) return false;
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { email: true },
  });
  return isEmailAdmin(user?.email);
}

// List organizations (public, with optional search)
organizationsRouter.get('/', asyncHandler(async (req, res) => {
  try {
    const authedReq = req as AuthedRequest;
    const currentUserId = authedReq.user?.id ?? null;
    const isAdminUser = await isCurrentUserPlatformAdmin(authedReq);
    const q = String((req.query as any).q || '').trim();
    const limit = Math.max(1, Math.min(parseInt(String((req.query as any).limit || '20'), 10) || 20, 50));

    const where: any = q ? { name: { startsWith: q, mode: 'insensitive' } } : {};
    if (!isAdminUser) {
      if (currentUserId) {
        where.OR = [
          { admin_approved: true },
          { memberships: { some: { user_id: currentUserId, status: 'active' } } },
          { joinRequests: { some: { user_id: currentUserId, status: 'pending' } } },
        ];
      } else {
        where.admin_approved = true;
      }
    }

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
}));

// List organizations where current user has admin access
organizationsRouter.get('/mine', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
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
}));

// Update organization (admin only)
// H3: zip_code aligned with ads — 5-digit US format when provided
const updateOrgSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  logo_url: z.string().url().max(2000).refine(
    (url) => { try { const h = new URL(url).hostname; return ['res.cloudinary.com','varsityhub.app','cdn.varsityhub.app'].some(d => h.endsWith(d)); } catch { return false; } },
    { message: 'Image URL must be from an allowed domain' }
  ).optional().nullable(),
  profile_picture_url: z.string().url().max(2000).refine(
    (url) => { try { const h = new URL(url).hostname; return ['res.cloudinary.com','varsityhub.app','cdn.varsityhub.app'].some(d => h.endsWith(d)); } catch { return false; } },
    { message: 'Image URL must be from an allowed domain' }
  ).optional().nullable(),
  background_url: z.string().url().max(2000).refine(
    (url) => { try { const h = new URL(url).hostname; return ['res.cloudinary.com','varsityhub.app','cdn.varsityhub.app'].some(d => h.endsWith(d)); } catch { return false; } },
    { message: 'Image URL must be from an allowed domain' }
  ).optional().nullable(),
  sport: z.string().max(100).optional().nullable(),
  org_type: z.string().max(50).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  zip_code: z.string().regex(/^\d{5}$/, 'Must be a 5-digit US zip code').optional().nullable(),
  contact_info: z.string().max(500).optional().nullable(),
});

organizationsRouter.patch('/:id', requireAuth as any, requireVerified as any, requireOnboarded as any, asyncHandler(async (req: AuthedRequest, res) => {
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
        ...(data.contact_info !== undefined && { contact_info: data.contact_info }),
      },
      select: { id: true, name: true, description: true, logo_url: true, profile_picture_url: true, background_url: true, sport: true, org_type: true, location: true, zip_code: true, contact_info: true },
    });
    return res.json(updated);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'An organization with that name already exists in this area.' });
    console.error('[organizations] PATCH /:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}));

// Follow an organization
organizationsRouter.post('/:id/follow', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
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
}));

// Unfollow an organization
organizationsRouter.delete('/:id/follow', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const orgId = String(req.params.id);
    await prisma.organizationFollow.deleteMany({ where: { user_id: userId, organization_id: orgId } });
    return res.json({ is_following: false });
  } catch (err) {
    console.error('[organizations] DELETE /:id/follow error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}));

// NOTE: GET /:id moved to bottom of file to avoid shadowing literal routes
// like /invites/me, /search/nearby, /join-requests/me

// Get organization members (requires auth + membership or admin)
organizationsRouter.get('/:id/members', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id);
    const organization = await prisma.organization.findUnique({ where: { id } });
    if (!organization) return res.status(404).json({ error: 'Organization not found' });

    // Caller must be a member of this org or a platform admin
    const callerMembership = await prisma.organizationMembership.findUnique({
      where: { organization_id_user_id: { organization_id: id, user_id: req.user!.id } as any },
    });
    if (!callerMembership) {
      const caller = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { email: true } });
      if (!isEmailAdmin(caller?.email)) {
        return res.status(403).json({ error: 'You must be a member of this organization' });
      }
    }

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
}));

// H3: zip_code aligned with ads — 5-digit US format when provided
const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  sport: z.string().max(100).optional(),
  org_type: z.string().max(100).optional(),
  location: z.string().max(255).optional(),
  formatted_address: z.string().max(500).optional(),
  place_id: z.string().max(255).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  zip_code: z.string().regex(/^\d{5}$/, 'Must be a 5-digit US zip code').optional(),
  season_start: z.string().optional(),
  season_end: z.string().optional(),
  supporting_document_url: z.string().url({ message: 'Supporting document is required' }),
  onboarding: z.boolean().optional(), // bypass requireVerified during onboarding
});

// Create organization
organizationsRouter.post('/', requireAuth as any, requireVerified as any, requireOnboarded as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const parsed = createOrganizationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

    // v1.0.2: 48hr cooldown if prior application was rejected (mirrors POST /create).
    const REJECTION_COOLDOWN_MS = 48 * 60 * 60 * 1000;
    const applicant = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { approval_status: true, rejected_at: true, rejection_reason: true },
    });
    // v1.0.2 pass 4: backfill rejected_at for legacy REJECTED users so they can't bypass cooldown.
    if (applicant?.approval_status === 'REJECTED') {
      let rejectedAt = applicant.rejected_at;
      if (!rejectedAt) {
        rejectedAt = new Date();
        await prisma.user.update({
          where: { id: req.user!.id },
          data: { rejected_at: rejectedAt },
        });
        await invalidateMeCacheForUser(req.user!.id);
      }
      const elapsed = Date.now() - new Date(rejectedAt).getTime();
      if (Number.isFinite(elapsed) && elapsed < REJECTION_COOLDOWN_MS) {
        const retryAfterMs = REJECTION_COOLDOWN_MS - elapsed;
        return res.status(429).json({
          error: 'Your previous application was declined. Please wait before creating another organization.',
          code: 'REJECTION_COOLDOWN',
          retry_after_ms: retryAfterMs,
          retry_after_hours: Math.ceil(retryAfterMs / (60 * 60 * 1000)),
          reason: applicant.rejection_reason || null,
        });
      }
    }

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
    const { formatted_address: _fa, place_id: _pid, latitude: _lat, longitude: _lng, ...orgFields } = data;
    const organization = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          ...orgFields,
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
        data: {
          approval_status: 'PENDING',
          // v1.0.2: clear prior rejection tracking on a fresh application
          rejected_at: null,
          rejection_reason: null,
        },
      });
      return org;
    });
    await invalidateMeCacheForUser(req.user!.id);

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
      supportingDocumentUrl: data.supporting_document_url,
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
}));

// H3: zip_code aligned with ads — 5-digit US format when provided
const createOrganizationWithTeamsSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  sport: z.string().max(100).optional(),
  org_type: z.string().max(100).optional(),
  location: z.string().max(255).optional(),
  formatted_address: z.string().max(500).optional(),
  place_id: z.string().max(255).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  zip_code: z.string().regex(/^\d{5}$/, 'Must be a 5-digit US zip code').optional(),
  season_start: z.string().optional(),
  season_end: z.string().optional(),
  supporting_document_url: z.string().url({ message: 'Supporting document is required' }),
  onboarding: z.boolean().optional(),
  authorized_users: z.array(z.object({
    email: z.string().email().optional(),
    user_id: z.string().optional(),
    role: z.string().optional(),
    assign_team: z.string().optional(),
  })).optional(),
});

// Enhanced create organization for onboarding
organizationsRouter.post('/create', requireAuth as any, requireVerified as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const parsed = createOrganizationWithTeamsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

    // v1.0.2: 48hr cooldown for users whose prior org application was rejected.
    const REJECTION_COOLDOWN_MS = 48 * 60 * 60 * 1000;
    const applicant = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { approval_status: true, rejected_at: true, rejection_reason: true },
    });
    // v1.0.2 pass 4: backfill rejected_at for legacy REJECTED users so they can't bypass cooldown.
    if (applicant?.approval_status === 'REJECTED') {
      let rejectedAt = applicant.rejected_at;
      if (!rejectedAt) {
        rejectedAt = new Date();
        await prisma.user.update({
          where: { id: req.user!.id },
          data: { rejected_at: rejectedAt },
        });
        await invalidateMeCacheForUser(req.user!.id);
      }
      const elapsed = Date.now() - new Date(rejectedAt).getTime();
      if (Number.isFinite(elapsed) && elapsed < REJECTION_COOLDOWN_MS) {
        const retryAfterMs = REJECTION_COOLDOWN_MS - elapsed;
        return res.status(429).json({
          error: 'Your previous application was declined. Please wait before creating another organization.',
          code: 'REJECTION_COOLDOWN',
          retry_after_ms: retryAfterMs,
          retry_after_hours: Math.ceil(retryAfterMs / (60 * 60 * 1000)),
          reason: applicant.rejection_reason || null,
        });
      }
    }

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
          supporting_document_url: data.supporting_document_url,
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
        data: {
          approval_status: 'PENDING',
          // v1.0.2: clear prior rejection tracking on a fresh application
          rejected_at: null,
          rejection_reason: null,
        },
      });
      return org;
    });
    await invalidateMeCacheForUser(req.user!.id);

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
      supportingDocumentUrl: data.supporting_document_url,
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
              console.warn('[organizations] Invite email reported unsent for', inv.email);
            }
            return sent;
          }).catch((err) => {
            console.warn('[organizations] Failed sending invite email to', inv.email, err);
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
}));

const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.string().optional(),
});

// Invite user to organization
// Rule B: No plan gate on the inviting user — authorized users are covered by the org owner's plan.
// The plan-based user limit is enforced inside the handler using the org owner's tier.
organizationsRouter.post('/:id/invite', requireAuth as any, requireVerified as any, requireOnboarded as any, inviteLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  try {
  const id = String(req.params.id);
  const parsed = inviteUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

  const { email, role } = parsed.data;

  // Validate role against allowed org roles
  const VALID_ORG_INVITE_ROLES = ['manager', 'member'];
  if (role && !VALID_ORG_INVITE_ROLES.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ORG_INVITE_ROLES.join(', ')}` });
  }

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

  // Atomic limit check + create to prevent race condition on concurrent invites.
  // v1.0.2 pass 12: promote to Serializable isolation — the default ReadCommitted still
  // permits two parallel invite requests to both pass the count check before either
  // INSERTs, over-counting the authorized-user cap. Serializable forces one to retry.
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
  }, { isolationLevel: 'Serializable' });

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
        console.warn('[organizations] Direct invite email reported unsent for', email);
      }
      return sent;
    }).catch((err) => {
      console.warn('[organizations] Failed sending direct invite email to', email, err);
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
}));

// Get my organization invites
organizationsRouter.get('/invites/me', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const invites = await prisma.organizationInvite.findMany({
      where: { email: user.email, status: 'pending' },
      include: { organization: true },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    return res.json(invites);
  } catch (err) {
    console.error('[organizations] GET /invites/me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}));

// Accept organization invite
organizationsRouter.post('/invites/:inviteId/accept', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
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
        update: { status: 'active' }, // SECURITY: Only reactivate — never escalate role via invite
        create: { organization_id: invite.organization_id, user_id: user.id, role: invite.role, status: 'active' }
      }),
      prisma.organizationInvite.update({ where: { id: inviteId }, data: { status: 'accepted' } }),
    ]);

    // Organization approval welcome email removed — non-mandatory

    return res.json({ message: 'Invite accepted' });
  } catch (err) {
    console.error('[organizations] POST /invites/:inviteId/accept error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}));

// Decline organization invite
organizationsRouter.post('/invites/:inviteId/decline', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
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
}));

// ===========================================
// Organization Join Request Endpoints
// ===========================================

// Search organizations by zip code / proximity
organizationsRouter.get('/search/nearby', organizationsNearbyLimiter, asyncHandler(async (req, res) => {
  try {
    const query = String((req.query as any).query || '').trim();
    const sport = String((req.query as any).sport || '').trim();
    const orgType = String((req.query as any).org_type || '').trim();
    const limit = Math.max(1, Math.min(parseInt(String((req.query as any).limit || '20'), 10) || 20, 50));

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
}));

// Check for duplicate organizations using normalized name comparison
organizationsRouter.post('/check-duplicate', requireAuth as any, asyncHandler(async (req, res) => {
  try {
    const checkDuplicateSchema = z.object({
      name: z.string().min(1).max(200),
      zip_code: z.string().max(20).optional(),
    });
    const parsed = checkDuplicateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    const { name, zip_code } = parsed.data;

    const normalizedInput = normalizeOrganizationName(name);
    if (!normalizedInput) {
      return res.json({ exists: false, organization: null });
    }

    // If zip_code provided, check orgs in that zip first
    if (zip_code) {
      const localOrgs = await prisma.organization.findMany({
        where: { zip_code, status: 'active' },
        select: { id: true, name: true, location: true, sport: true },
        take: 200,
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
}));

// Create join request
const createJoinRequestSchema = z.object({
  organization_id: z.string(),
  message: z.string().max(500).optional(),
});

organizationsRouter.post('/join-requests', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
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

    // ORG-9: Enforce 7-day cooldown after a rejected join request
    if (existingRequest && existingRequest.status === 'denied' && existingRequest.reviewed_at) {
      const cooldownMs = 7 * 24 * 60 * 60 * 1000; // 7 days
      const timeSinceRejection = Date.now() - new Date(existingRequest.reviewed_at).getTime();
      if (timeSinceRejection < cooldownMs) {
        const daysLeft = Math.ceil((cooldownMs - timeSinceRejection) / (24 * 60 * 60 * 1000));
        return res.status(429).json({ error: `Your previous request was denied. You can re-apply in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.` });
      }
    }

    // Check if requester is a coach before the write so we can set PENDING atomically
    const requester = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { preferences: true } });
    const isCoachRole = (requester?.preferences as any)?.role === 'coach';

    // Create join request + set coach to PENDING atomically
    const [joinRequest] = await prisma.$transaction([
      prisma.organizationJoinRequest.upsert({
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
      }),
      // Always update approval_status for coaches — atomic with join request
      ...(isCoachRole ? [
        prisma.user.update({
          where: { id: req.user!.id },
          data: { approval_status: 'PENDING' },
        })
      ] : []),
    ]);
    if (isCoachRole) {
      await invalidateMeCacheForUser(req.user!.id);
    }

    // Send email + push + in-app notification to organization owner
    if (organization.memberships.length > 0) {
      const owner = organization.memberships[0];
      try {
        // v1.0.2 audit fix: search-mode join requests now send email to org owner
        // (previously only push + in-app). Uses LEAGUE_PENDING_APPROVAL template.
        sendCoachJoinRequestEmail({
          ownerEmail: owner.user.email!,
          ownerName: owner.user.display_name || 'League Owner',
          coachName: joinRequest.user.display_name || 'A coach',
          coachEmail: joinRequest.user.email || '',
          organizationName: organization.name,
          organizationId: organization.id,
        }).catch((err) => console.error('[orgs] Failed to send join request email:', (err as any)?.message));

        // Push notification to league owner
        sendPushNotification(
          owner.user.id,
          'New coach request',
          `${joinRequest.user.display_name || 'A coach'} wants to join ${organization.name}`,
          { type: 'coach_request', screen: 'approvals', organization_id: organization.id },
        ).catch(() => {});

        // In-app notification record for league owner
        await prisma.notification.create({
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
        }).catch((err) => console.error('[orgs] FAILED to create join request notification:', (err as any)?.message));
      } catch (err) {
        console.error('Failed to send join request notification to admin:', err);
      }
    }

    return res.status(201).json(joinRequest);
  } catch (err) {
    console.error('[organizations] POST /join-requests error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}));

// Get join requests for an organization (admin only)
organizationsRouter.get('/:id/join-requests', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
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
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    return res.json(joinRequests);
  } catch (err) {
    console.error('[organizations] GET /:id/join-requests error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}));

// Get user's own join requests
organizationsRouter.get('/join-requests/me', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
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
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    return res.json(joinRequests);
  } catch (err) {
    console.error('[organizations] GET /join-requests/me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}));

// Approve join request
organizationsRouter.post('/join-requests/:requestId/approve', requireAuth as any, requireVerified as any, requireOnboarded as any, asyncHandler(async (req: AuthedRequest, res) => {
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

  // SECURITY: Only allow approving join requests for admin-approved organizations.
  // Without this, coaches could get APPROVED status by joining an unapproved org.
  if (!joinRequest.organization.admin_approved) {
    return res.status(403).json({ error: 'Organization must be approved by VarsityHub before accepting members.' });
  }

  // ORG-8 + ORG-4: Serializable isolation with status re-check inside transaction
  await prisma.$transaction(async (tx) => {
    // Re-check status inside transaction to prevent race condition (ORG-4)
    const fresh = await tx.organizationJoinRequest.findUnique({ where: { id: requestId } });
    if (!fresh || fresh.status !== 'pending') {
      throw new Error('JOIN_REQUEST_ALREADY_REVIEWED');
    }
    await tx.organizationJoinRequest.update({
      where: { id: requestId },
      data: {
        status: 'approved',
        reviewed_at: new Date(),
        reviewed_by: req.user!.id
      }
    });
    await tx.organizationMembership.create({
      data: {
        organization_id: joinRequest.organization_id,
        user_id: joinRequest.user_id,
        role: 'coach',
        status: 'active'
      }
    });
    await tx.user.update({
      where: { id: joinRequest.user_id },
      data: { approval_status: 'APPROVED', paid_by_owner: true }
    });
  }, { isolationLevel: 'Serializable' });
  await invalidateMeCacheForUser(joinRequest.user_id);
  
  // Persist org info into coach's preferences (non-blocking, non-fatal)
  prisma.user.findUnique({ where: { id: joinRequest.user_id }, select: { preferences: true } })
    .then((coachRecord) => {
      const current = (coachRecord?.preferences as any) || {};
      const merged = {
        ...current,
        organization_id: joinRequest.organization_id,
        organization_name: joinRequest.organization.name,
      };
      return prisma.user
        .update({ where: { id: joinRequest.user_id }, data: { preferences: merged } })
        .then(async (updatedCoach) => {
          await invalidateMeCacheForUser(updatedCoach.id);
          return updatedCoach;
        });
    })
    .catch((err) => {
      console.warn('[orgs] failed to persist org_id into coach preferences on join-request approval:', (err as any)?.message || err);
    });

  // Push notification so coach knows they were approved
  try {
    await sendPushNotification(
      joinRequest.user_id,
      'Join Request Approved',
      `Your request to join ${joinRequest.organization.name} was approved!`,
      { type: 'join_request_approved', organization_id: joinRequest.organization_id }
    );
    console.log(`[notif] push sent JOIN_REQUEST_APPROVED to user=${joinRequest.user_id}`);
  } catch (err) {
    console.error('[notif] Failed to send push for JOIN_REQUEST_APPROVED:', (err as any)?.message || err);
  }

  // In-app notification so it shows in the Updates page
  try {
    const notif = await prisma.notification.create({
      data: {
        user_id: joinRequest.user_id,
        actor_id: req.user?.id || null,
        type: 'JOIN_REQUEST_APPROVED',
        meta: { organization_id: joinRequest.organization_id, organization_name: joinRequest.organization.name },
      },
    });
    console.log(`[notif] JOIN_REQUEST_APPROVED created id=${notif.id} for user=${joinRequest.user_id}`);
  } catch (err) {
    console.error('[notif] Failed to create JOIN_REQUEST_APPROVED notification:', (err as any)?.message || err);
  }

  return res.json({ message: 'Join request approved' });
  } catch (err: any) {
    if (err?.message === 'JOIN_REQUEST_ALREADY_REVIEWED') {
      return res.status(400).json({ error: 'This request has already been reviewed' });
    }
    console.error('[organizations] POST /join-requests/:requestId/approve error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}));

// Deny join request
const denyJoinRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});

organizationsRouter.post('/join-requests/:requestId/deny', requireAuth as any, requireVerified as any, requireOnboarded as any, asyncHandler(async (req: AuthedRequest, res) => {
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
  
  await prisma.$transaction([
    prisma.organizationJoinRequest.update({
      where: { id: requestId },
      data: {
        status: 'denied',
        reviewed_at: new Date(),
        reviewed_by: req.user!.id,
        rejection_reason: reason || null,
      }
    }),
    // Set user approval_status to REJECTED so they don't stay PENDING forever
    prisma.user.update({
      where: { id: joinRequest.user.id },
      data: { approval_status: 'REJECTED' },
    }),
  ]);
  await invalidateMeCacheForUser(joinRequest.user.id);
  
  // Create in-app notification for the denied user
  try {
    await prisma.notification.create({
      data: {
        user_id: joinRequest.user.id,
        actor_id: req.user!.id,
        type: 'JOIN_REQUEST_DENIED',
        meta: {
          organization_id: joinRequest.organization_id,
          organization_name: joinRequest.organization.name,
          reason: reason || undefined,
        },
      },
    });
  } catch (notifErr) {
    console.warn('[organizations] Failed to create denial notification:', notifErr);
  }

  return res.json({ message: 'Join request denied' });
  } catch (err) {
    console.error('[organizations] POST /join-requests/:requestId/deny error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}));

// -----------------------------------------------
// POST /organizations/:id/transfer-ownership
// -----------------------------------------------
organizationsRouter.post('/:id/transfer-ownership', requireAuth as any, requireVerified as any, requireOnboarded as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const orgId = req.params.id;
    const transferSchema = z.object({ new_owner_id: z.string().min(1) });
    const parsed = transferSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    const { new_owner_id } = parsed.data;

    // Verify requester is current owner
    const currentOwnership = await prisma.organizationMembership.findFirst({
      where: { organization_id: orgId, user_id: req.user.id, role: 'owner' },
    });
    if (!currentOwnership) {
      return res.status(403).json({ error: 'Only the current owner can transfer ownership' });
    }

    // ORG-10: Prevent self-transfer (no-op that could cause confusion)
    if (new_owner_id === req.user.id) {
      return res.status(400).json({ error: 'Cannot transfer ownership to yourself' });
    }

    // Verify new owner is a member of the organization
    const newOwnerMembership = await prisma.organizationMembership.findFirst({
      where: { organization_id: orgId, user_id: new_owner_id },
    });
    if (!newOwnerMembership) {
      return res.status(400).json({ error: 'New owner must be a member of the organization' });
    }

    // Transfer: demote current owner to manager, promote new owner (ORG-10: atomic)
    await prisma.$transaction([
      prisma.organizationMembership.update({
        where: { id: currentOwnership.id },
        data: { role: 'manager' },
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
}));

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
organizationsRouter.get('/:id/approve', authMiddleware as any, (req, res, next) => { (approveLeagueHandler as any)(req, res).catch(next); });
organizationsRouter.post('/:id/approve', authMiddleware as any, (req, res, next) => { (approveLeagueHandler as any)(req, res).catch(next); });

async function approveLeagueHandler(req: AuthedRequest, res: any) {
  try {
    const orgId = req.params.id;
    const token = req.query.token as string | undefined;

    // Validate org exists early (before auth) to avoid Prisma errors on invalid UUIDs
    const orgExists = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } }).catch(() => null);
    if (!orgExists) return res.status(404).json({ error: 'Organization not found' });

    // Auth: either signed token OR authenticated admin
    let adminUserId: string | null = null;

    if (token) {
      const payload = verifyJwt<{ orgId: string; action: string }>(token);
      if (!payload || payload.orgId !== orgId || payload.action !== 'approve_league') {
        return res.status(401).json({ error: 'Invalid or expired approval token' });
      }
      // GET: show confirmation form — don't perform write on GET (email scanner safe)
      if (req.method === 'GET') {
        const orgInfo = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, admin_approved: true } });
        if (orgInfo?.admin_approved) return res.send(`<html><body style="font-family:Arial;text-align:center;padding:60px"><h1>Already Approved</h1><p>This league was already approved.</p></body></html>`);
        return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Approve League</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:500px;margin:60px auto;padding:20px;text-align:center;">
<h2>Approve this league?</h2><p><strong>${escapeHtml(orgInfo?.name || 'Unknown')}</strong></p>
<form method="POST" action="?token=${encodeURIComponent(token)}">
<button type="submit" style="background:#16A34A;color:#fff;border:none;padding:12px 32px;border-radius:8px;font-size:16px;cursor:pointer;">Approve League</button>
</form></body></html>`);
      }
    } else {
      // Require authenticated admin
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true } });
      if (!isEmailAdmin(me?.email)) return res.status(403).json({ error: 'Admin only' });
      adminUserId = req.user.id;
    }

    const adminNote: string | undefined = req.body?.note || undefined;

    const result = await approveOrganization(orgId, adminUserId, prisma, { note: adminNote });
    if (result.error) return res.status((result as any).status || 500).json({ error: result.error });
    if ((result as any).already) return res.json({ message: 'Already approved' });

    const org = (result as any).org;

    // ORG-11: Log league approval via centralized logger
    const approverEmail = adminUserId
      ? ((await prisma.user.findUnique({ where: { id: adminUserId }, select: { email: true } }))?.email || adminUserId)
      : 'token-auth';
    await logAdminActivity(
      adminUserId || 'token-auth', approverEmail, 'APPROVE_LEAGUE', 'organization', orgId,
      `Approved league: ${org.name || orgId}${adminNote ? ` — ${adminNote}` : ''}`
    );

    // If accessed via browser link, show a simple HTML confirmation (escape org.name to prevent XSS)
    if (token) {
      return res.send(`<html><body style="font-family:Arial;text-align:center;padding:60px"><h1 style="color:#16A34A">League Approved</h1><p>"${escapeHtml(String(org.name || ''))}" is now live on VarsityHub.</p></body></html>`);
    }

    return res.json({ message: 'League approved', organization_id: orgId });
  } catch (err) {
    console.error('[organizations] POST /:id/approve error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET handler so email reject links work as simple browser clicks
organizationsRouter.get('/:id/reject', authMiddleware as any, (req, res, next) => { (rejectLeagueHandler as any)(req, res).catch(next); });
organizationsRouter.post('/:id/reject', authMiddleware as any, (req, res, next) => { (rejectLeagueHandler as any)(req, res).catch(next); });

async function rejectLeagueHandler(req: AuthedRequest, res: any) {
  try {
    const orgId = req.params.id;
    const token = req.query.token as string | undefined;
    const reason = req.body?.reason as string | undefined;

    // Validate org exists early (before auth) to avoid Prisma errors on invalid UUIDs
    const orgExists = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } }).catch(() => null);
    if (!orgExists) return res.status(404).json({ error: 'Organization not found' });

    // Auth: either signed token OR authenticated admin
    if (token) {
      const payload = verifyJwt<{ orgId: string; action: string }>(token);
      if (!payload || payload.orgId !== orgId || payload.action !== 'reject_league') {
        return res.status(401).json({ error: 'Invalid or expired rejection token' });
      }
      // GET: show confirmation form — don't perform write on GET
      if (req.method === 'GET') {
        const orgInfo = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
        return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reject League</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:500px;margin:60px auto;padding:20px;text-align:center;">
<h2>Reject this league?</h2><p><strong>${escapeHtml(orgInfo?.name || 'Unknown')}</strong></p>
<form method="POST" action="?token=${encodeURIComponent(token)}">
<button type="submit" style="background:#DC2626;color:#fff;border:none;padding:12px 32px;border-radius:8px;font-size:16px;cursor:pointer;">Reject League</button>
</form></body></html>`);
      }
    } else {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true } });
      if (!isEmailAdmin(me?.email)) return res.status(403).json({ error: 'Admin only' });
    }

    const adminUserId = req.user?.id || null;
    const result = await rejectOrganization(orgId, adminUserId, prisma, { reason });
    if (result.error) return res.status((result as any).status || 500).json({ error: result.error });

    const org = (result as any).org;

    // ORG-11: Log league rejection via centralized logger
    const rejecterEmail = adminUserId
      ? ((await prisma.user.findUnique({ where: { id: adminUserId }, select: { email: true } }))?.email || adminUserId)
      : 'token-auth';
    await logAdminActivity(
      adminUserId || 'token-auth', rejecterEmail, 'REJECT_LEAGUE', 'organization', orgId,
      `Rejected league: ${org.name || orgId}${reason ? ` — ${reason}` : ''}`
    );

    if (token) {
      return res.send(`<html><body style="font-family:Arial;text-align:center;padding:60px"><h1 style="color:#DC2626">League Rejected</h1><p>"${escapeHtml(String(org.name || ''))}" has been declined.</p></body></html>`);
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
organizationsRouter.get('/:id/pending-coaches', requireAuth as any, asyncHandler(async (req: AuthedRequest, res) => {
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
      take: 200,
    });

    return res.json(pendingRequests);
  } catch (err) {
    console.error('[organizations] GET /:id/pending-coaches error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}));

/**
 * POST /organizations/:id/coaches/:userId/approve
 * League owner approves a coach. Sets approval_status: APPROVED, paid_by_owner: true.
 */
organizationsRouter.post('/:id/coaches/:userId/approve', requireAuth as any, requireVerified as any, requireOnboarded as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { id: orgId, userId: coachId } = req.params;
    const { team_id: teamId } = req.body || {};

    // Verify requester is league owner
    const membership = await prisma.organizationMembership.findFirst({
      where: { organization_id: orgId, user_id: req.user.id, role: 'owner', status: 'active' },
    });
    if (!membership) return res.status(403).json({ error: 'Only the league owner can approve coaches' });

    // Idempotency: if coach is already approved, return success without writing again
    const coachUser = await prisma.user.findUnique({ where: { id: coachId }, select: { approval_status: true } });
    if (coachUser?.approval_status === 'APPROVED') {
      const existingMembership = await prisma.organizationMembership.findFirst({
        where: { organization_id: orgId, user_id: coachId, status: 'active' },
      });
      if (existingMembership) {
        return res.json({ message: 'Coach already approved', coach_id: coachId, already_approved: true });
      }
    }

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
      prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, admin_approved: true } }),
      prisma.user.findUnique({ where: { id: coachId }, select: { display_name: true, email: true } }),
    ]);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    if (!org.admin_approved) {
      return res.status(403).json({
        error: 'Organization must be approved by VarsityHub before approving coaches.',
      });
    }

    // Approve: update join request, create org membership, assign to team, set coach approval status
    const txOps: any[] = [
      prisma.organizationJoinRequest.update({
        where: { id: joinRequest.id },
        data: { status: 'approved', reviewed_at: new Date(), reviewed_by: req.user.id },
      }),
      prisma.organizationMembership.create({
        data: { organization_id: orgId, user_id: coachId, role: 'coach', status: 'active' },
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

    // Add notification record to the transaction for atomicity
    txOps.push(
      prisma.notification.create({
        data: {
          user_id: coachId,
          actor_id: req.user!.id,
          type: 'TEAM_INVITE',
          meta: {
            coach_approved: true,
            organization_id: orgId,
            organization_name: org?.name || 'your league',
          },
        },
      })
    );

    await prisma.$transaction(txOps);
    await invalidateMeCacheForUser(coachId);

    // Persist org info into coach's preferences so complete-onboarding succeeds
    // even if the coach never explicitly saved it (e.g. join-request path pre-fix).
    prisma.user.findUnique({ where: { id: coachId }, select: { preferences: true } })
      .then((coachRecord) => {
        const current = (coachRecord?.preferences as any) || {};
        const merged = {
          ...current,
          organization_id: orgId,
          organization_name: org?.name || current.organization_name,
        };
        return prisma.user
          .update({ where: { id: coachId }, data: { preferences: merged } })
          .then(async (updatedCoach) => {
            await invalidateMeCacheForUser(updatedCoach.id);
            return updatedCoach;
          });
      })
      .catch((err) => {
        console.warn('[orgs] failed to persist org_id into coach preferences:', (err as any)?.message || err);
      });

    // Non-blocking: email and push notifications fire after transaction succeeds.
    // If these fail the approval is still recorded — we log but don't roll back.
    if (coach?.email) {
      sendCoachApprovedEmail({
        to: coach.email,
        coachName: coach.display_name || 'Coach',
        leagueName: org?.name || 'your league',
      }).catch((err) => {
        console.error('[orgs] coach approval email failed:', (err as any)?.message || err);
      });
    }

    sendPushNotification(
      coachId,
      'Congratulations!',
      `Congratulations on being accepted as a coach! Tap to complete your setup.`,
      { type: 'coach_approved', screen: 'onboarding', organization_id: orgId },
    ).then(() => {
      console.log(`[notif] push sent TEAM_INVITE(coach_approved) to user=${coachId}`);
    }).catch((err) => {
      console.error('[notif] coach approval push failed:', (err as any)?.message || err);
    });

    return res.json({ message: 'Coach approved', coach_id: coachId });
  } catch (err: any) {
    // Handle unique constraint violation (coach already a member)
    if (err?.code === 'P2002') {
      // Already a member — atomically update join request + approval status
      const { id: orgId, userId: coachId } = req.params;
      await prisma.$transaction([
        prisma.organizationJoinRequest.updateMany({
          where: { organization_id: orgId, user_id: coachId, status: 'pending' },
          data: { status: 'approved', reviewed_at: new Date(), reviewed_by: req.user!.id },
        }),
        prisma.user.update({
          where: { id: coachId },
          data: { approval_status: 'APPROVED', paid_by_owner: true },
        }),
      ]);
      await invalidateMeCacheForUser(coachId);
      return res.json({ message: 'Coach approved (already a member)', coach_id: coachId });
    }
    console.error('[organizations] POST /:id/coaches/:userId/approve error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}));

/**
 * POST /organizations/:id/coaches/:userId/reject
 * League owner rejects a coach request.
 */
organizationsRouter.post('/:id/coaches/:userId/reject', requireAuth as any, requireVerified as any, requireOnboarded as any, asyncHandler(async (req: AuthedRequest, res) => {
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
    await invalidateMeCacheForUser(coachId);

    if (coach?.email) {
      sendCoachRejectedEmail({
        to: coach.email,
        coachName: coach.display_name || 'Coach',
        leagueName: org?.name || 'the league',
        reason,
      }).catch(() => {});
    }

    // Push notification to rejected coach (non-blocking)
    sendPushNotification(
      coachId,
      'Application Update',
      `Your application to join ${org?.name || 'the league'} was not approved.${reason ? ` Reason: ${reason}` : ''}`,
      { type: 'coach_rejected', screen: 'profile', organization_id: orgId },
    ).catch((err) => {
      console.warn('[orgs] coach rejection push failed:', (err as any)?.message || err);
    });

    // Create in-app notification for coach rejection
    try {
      await prisma.notification.create({
        data: {
          user_id: coachId,
          actor_id: req.user!.id,
          type: 'COACH_REJECTED',
          meta: { organization_id: orgId, organization_name: org?.name || 'the league', reason: reason || null },
        },
      });
    } catch (err) {
      console.error('[orgs] FAILED to create coach rejected in-app notification:', (err as any)?.message || err);
    }

    return res.json({ message: 'Coach request rejected', coach_id: coachId });
  } catch (err) {
    console.error('[organizations] POST /:id/coaches/:userId/reject error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}));

// Get single organization
// IMPORTANT: This catch-all /:id route MUST be last so it doesn't shadow
// literal routes like /invites/me, /search/nearby, /join-requests/me
organizationsRouter.get('/:id', asyncHandler(async (req, res) => {
  try {
    const id = String(req.params.id);
    const authedReq = req as AuthedRequest;
    const currentUserId = authedReq.user?.id ?? null;
    console.log(`[org-get] id=${id} user=${currentUserId || 'anon'}`);
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: { select: { followers: true, memberships: true } },
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
        }
        // memberships excluded from public endpoint — use GET /:id/members (requires auth)
      }
    });

    if (!organization) {
      console.log(`[org-get] not found: id=${id}`);
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (!organization.admin_approved) {
      const isAdminUser = await isCurrentUserPlatformAdmin(authedReq);
      if (!isAdminUser) {
        if (!currentUserId) {
          console.log(`[org-get] unapproved+anon: id=${id}`);
          return res.status(404).json({ error: 'Organization not found' });
        }
        const [membership, pendingJoin] = await Promise.all([
          prisma.organizationMembership.findUnique({
            where: { organization_id_user_id: { organization_id: id, user_id: currentUserId } },
            select: { status: true },
          }),
          prisma.organizationJoinRequest.findUnique({
            where: { organization_id_user_id: { organization_id: id, user_id: currentUserId } },
            select: { status: true },
          }),
        ]);
        const hasAccess = membership?.status === 'active' || pendingJoin?.status === 'pending';
        if (!hasAccess) {
          console.log(`[org-get] unapproved+no-access: id=${id} user=${currentUserId}`);
          return res.status(404).json({ error: 'Organization not found' });
        }
      }
    }

    const payload = { ...organization } as any;
    payload.followers_count = (organization as any)._count?.followers ?? 0;
    payload.members_count = (organization as any)._count?.memberships ?? 0;
    payload.is_following = currentUserId
      ? !!(await prisma.organizationFollow.findFirst({ where: { user_id: currentUserId, organization_id: id } }))
      : null;
    delete payload._count;
    return res.json(payload);
  } catch (err) {
    console.error('[organizations] GET /:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}));
