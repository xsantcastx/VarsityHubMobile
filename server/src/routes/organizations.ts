import { Router } from 'express';
import { z } from 'zod';
import { debugLog } from '../lib/debugLog.js';
import {
    sendOrganizationInvitationEmail,
    sendPlanLimitWarningEmail,
    sendStaffMemberJoinedEmail
} from '../lib/email.js';
import { sendOrganizationApprovalEmail } from '../lib/notifications.js';
import { getAuthorizedUsersOrgLimit, getPlanDisplayName, resolvePlan } from '../lib/planLimits.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';

import { getPlaceDetails } from '../lib/geocoding.js';
import { normalizeOrganizationName } from '../lib/normalizeNames.js';

export const organizationsRouter = Router();

// ---------------------------------------------
// Duplicate Detection & Admin Helpers
// ---------------------------------------------

// ...existing code...

// Determine if a membership role is considered an administrator of the organization.
function isOrganizationAdmin(role: string | null | undefined): boolean {
  if (!role) return false;
  return role === 'owner' || role === 'manager' || role === 'administrator';
}

async function userHasOrgAdminAccess(userId: string, orgId: string): Promise<boolean> {
  const membership = await prisma.organizationMembership.findFirst({
    where: { user_id: userId, organization_id: orgId, status: 'active' },
    select: { role: true },
  });
  return isOrganizationAdmin(membership?.role || null);
}

async function notifyOrganizationPlanLimitEmail({
  email,
  plan,
  used,
  limit,
}: {
  email?: string | null;
  plan?: string | null;
  used: number;
  limit: number | null;
}) {
  if (!email) return;
  try {
    await sendPlanLimitWarningEmail({
      to: email,
      planName: getPlanDisplayName(plan),
      resourceType: 'organization',
      used,
      limit,
    });
  } catch (err) {
    console.warn('[organizations] Failed to send plan limit warning email:', (err as any)?.message || err);
  }
}

type OrganizationLocationInput = {
  place_id?: string | null;
  formatted_address?: string | null;
  location?: string | null;
  zip_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

async function resolveOrganizationLocation(data: OrganizationLocationInput) {
  let placeId = (data.place_id || '').trim() || null;
  let formattedAddress = data.formatted_address?.trim() || null;
  let locationLabel = data.location?.trim() || null;
  let zipCode = data.zip_code?.trim() || null;
  let latitude = typeof data.latitude === 'number' ? data.latitude : null;
  let longitude = typeof data.longitude === 'number' ? data.longitude : null;

  if (placeId) {
    try {
      const details = await getPlaceDetails(placeId);
      if (details) {
        placeId = details.place_id || placeId;
        formattedAddress = formattedAddress || details.formatted_address || details.description || formattedAddress;
        latitude = latitude ?? details.latitude ?? null;
        longitude = longitude ?? details.longitude ?? null;
        const derivedLocation = [details.city, details.state].filter(Boolean).join(', ');
        locationLabel = locationLabel || derivedLocation || details.formatted_address || details.description || locationLabel;
        zipCode = zipCode || details.postal_code || zipCode;
      }
    } catch (error) {
      console.warn('[organizations] Unable to resolve place details:', error);
    }
  }

  return { placeId, formattedAddress, locationLabel, zipCode, latitude, longitude };
}

// List organizations (public, with optional search)
organizationsRouter.get('/', async (req, res) => {
  const q = String((req.query as any).q || '').trim();
  const limit = Math.min(parseInt(String((req.query as any).limit || '50'), 10) || 50, 100);
  
  const where: any = q ? {
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ]
  } : {};
  
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
        }
      }
    },
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
});

// Get single organization
organizationsRouter.get('/:id', async (req, res) => {
  const id = String(req.params.id);
  const organization = await prisma.organization.findUnique({ 
    where: { id },
    include: {
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
        }
      }
    }
  });
  
  if (!organization) return res.status(404).json({ error: 'Organization not found' });
  return res.json(organization);
});

// Get organization members
organizationsRouter.get('/:id/members', async (req, res) => {
  const id = String(req.params.id);
  const organization = await prisma.organization.findUnique({ where: { id } });
  if (!organization) return res.status(404).json({ error: 'Organization not found' });
  
  const members = await prisma.organizationMembership.findMany({
    where: { organization_id: id, status: 'active' },
    include: {
      user: {
        select: { id: true, display_name: true, username: true, avatar_url: true }
      }
    },
    orderBy: { created_at: 'desc' }
  });
  
  return res.json(members);
});

const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  sport: z.string().max(100).optional(),
  org_type: z.string().max(100).optional(),
  location: z.string().max(255).optional(),
  formatted_address: z.string().max(500).optional(),
  place_id: z.string().max(255).optional(),
  zip_code: z.string().max(10).optional(),
  season_start: z.string().optional(),
  season_end: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

// Create organization
organizationsRouter.post('/', requireAuth as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  // Enforce coach role and plan limits
  const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, email: true, preferences: true } });
  if (!me) return res.status(401).json({ error: 'Unauthorized' });
  const prefs = (me.preferences && typeof me.preferences === 'object') ? (me.preferences as any) : {};
  const userRole = prefs.role || 'fan';
  if (userRole !== 'coach') {
    return res.status(403).json({
      error: 'COACH_ROLE_REQUIRED',
      message: 'Only coach accounts can create organizations.',
      code: 'COACH_ROLE_REQUIRED'
    });
  }
  // Plan limit enforcement
  const plan = resolvePlan(prefs.plan);
  const orgLimit = getAuthorizedUsersOrgLimit(plan);
  const ownedOrgsCount = await prisma.organization.count({
    where: {
      memberships: {
        some: {
          user_id: me.id,
          role: { in: ['owner', 'manager', 'administrator'] },
          status: 'active',
        }
      }
    }
  });
  if (orgLimit !== null && ownedOrgsCount >= orgLimit) {
    await notifyOrganizationPlanLimitEmail({
      email: me.email,
      plan,
      used: ownedOrgsCount,
      limit: orgLimit,
    });
    return res.status(403).json({
      error: 'Organization limit reached',
      message: `You've reached your ${plan} plan limit of ${orgLimit} organization${orgLimit > 1 ? 's' : ''}. Upgrade your plan to create more organizations.`,
      owned_organizations: ownedOrgsCount,
      max_organizations: orgLimit,
      current_plan: plan,
      upgrade_required: true,
      upgrade_url: `${process.env.APP_BASE_URL}/upgrade?from=org_limit`
    });
  }
  const parsed = createOrganizationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const data = parsed.data;
  const locationMeta = await resolveOrganizationLocation({
    place_id: data.place_id,
    formatted_address: data.formatted_address,
    location: data.location,
    zip_code: data.zip_code,
    latitude: data.latitude,
    longitude: data.longitude,
  });
  // Enhanced duplicate guard: check normalized name collisions within same zip_code regardless of org_type/sport
  const nm = normalizeOrganizationName(data.name);
  const duplicateZip = locationMeta.zipCode || data.zip_code || undefined;

  if (locationMeta.placeId) {
    const existingByPlace = await prisma.organization.findFirst({
      where: { place_id: locationMeta.placeId, status: 'active' },
      select: { id: true, name: true },
    });
    if (existingByPlace) {
      return res.status(409).json({
        error: 'DUPLICATE_ORGANIZATION',
        duplicate_of: existingByPlace,
      });
    }
  }

  let possibleDuplicates: Array<{ id: string; name: string }> = [];
  if (duplicateZip) {
    possibleDuplicates = await prisma.organization.findMany({
      where: {
        zip_code: duplicateZip,
        status: 'active'
      },
      select: { id: true, name: true, zip_code: true }
    });
  }
  const dup = possibleDuplicates.find(o => normalizeOrganizationName(o.name) === nm);
  if (dup) {
    return res.status(409).json({ error: 'DUPLICATE_ORGANIZATION', duplicate_of: { id: dup.id, name: dup.name } });
  }
  const organization = await prisma.organization.create({ 
    data: {
      name: data.name,
      description: data.description,
      sport: data.sport,
      org_type: data.org_type,
      location: locationMeta.locationLabel || data.location || null,
      formatted_address: locationMeta.formattedAddress || data.formatted_address || null,
      place_id: locationMeta.placeId,
      zip_code: duplicateZip || null,
      season_start: data.season_start ? new Date(data.season_start) : null,
      season_end: data.season_end ? new Date(data.season_end) : null,
      latitude: typeof locationMeta.latitude === 'number' ? locationMeta.latitude : null,
      longitude: typeof locationMeta.longitude === 'number' ? locationMeta.longitude : null,
    }
  });
  
  // Add creator as owner
  await prisma.organizationMembership.create({ 
    data: { 
      organization_id: organization.id, 
      user_id: req.user!.id, 
      role: 'owner' 
    } 
  });
  
  return res.status(201).json(organization);
});

const createOrganizationWithTeamsSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  sport: z.string().max(100).optional(),
  org_type: z.string().max(100).optional(),
  location: z.string().max(255).optional(),
  formatted_address: z.string().max(500).optional(),
  place_id: z.string().max(255).optional(),
  zip_code: z.string().max(10).optional(),
  season_start: z.string().optional(),
  season_end: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  authorized_users: z.array(z.object({
    email: z.string().email().optional(),
    user_id: z.string().optional(),
    role: z.string().optional(),
    assign_team: z.string().optional(),
  })).optional(),
});

// Enhanced create organization for onboarding
organizationsRouter.post('/create', requireAuth as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  // Enforce coach role and plan limits
  const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, preferences: true } });
  if (!me) return res.status(401).json({ error: 'Unauthorized' });
  const prefs = (me.preferences && typeof me.preferences === 'object') ? (me.preferences as any) : {};
  const userRole = prefs.role || 'fan';
  if (userRole !== 'coach') {
    return res.status(403).json({
      error: 'COACH_ROLE_REQUIRED',
      message: 'Only coach accounts can create organizations.',
      code: 'COACH_ROLE_REQUIRED'
    });
  }
  // Plan limit enforcement
  const plan = resolvePlan(prefs.plan);
  const orgLimit = getAuthorizedUsersOrgLimit(plan);
  const ownedOrgsCount = await prisma.organization.count({
    where: {
      memberships: {
        some: {
          user_id: me.id,
          role: { in: ['owner', 'manager', 'administrator'] },
          status: 'active',
        }
      }
    }
  });
  if (orgLimit !== null && ownedOrgsCount >= orgLimit) {
    return res.status(403).json({
      error: 'Organization limit reached',
      message: `You've reached your ${plan} plan limit of ${orgLimit} organization${orgLimit > 1 ? 's' : ''}. Upgrade your plan to create more organizations.`,
      owned_organizations: ownedOrgsCount,
      max_organizations: orgLimit,
      current_plan: plan,
      upgrade_required: true,
      upgrade_url: `${process.env.APP_BASE_URL}/upgrade?from=org_limit`
    });
  }

  const parsed = createOrganizationWithTeamsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  
  const data = parsed.data;
  const locationMeta = await resolveOrganizationLocation({
    place_id: data.place_id,
    formatted_address: data.formatted_address,
    location: data.location,
    zip_code: data.zip_code,
    latitude: data.latitude,
    longitude: data.longitude,
  });
  // Duplicate guard (same logic as simple create)
  const nm = normalizeOrganizationName(data.name);
  const duplicateZip = locationMeta.zipCode || data.zip_code || undefined;

  if (locationMeta.placeId) {
    const existingByPlace = await prisma.organization.findFirst({
      where: { place_id: locationMeta.placeId, status: 'active' },
      select: { id: true, name: true },
    });
    if (existingByPlace) {
      return res.status(409).json({ error: 'DUPLICATE_ORGANIZATION', duplicate_of: existingByPlace });
    }
  }

  let possibleDuplicates: Array<{ id: string; name: string }> = [];
  if (duplicateZip) {
    possibleDuplicates = await prisma.organization.findMany({
      where: {
        zip_code: duplicateZip,
        status: 'active'
      },
      select: { id: true, name: true, zip_code: true }
    });
  }
  const dup = possibleDuplicates.find(o => normalizeOrganizationName(o.name) === nm);
  if (dup) {
    return res.status(409).json({ error: 'DUPLICATE_ORGANIZATION', duplicate_of: { id: dup.id, name: dup.name } });
  }
  
  // Create organization
  const organization = await prisma.organization.create({ 
    data: {
      name: data.name,
      description: data.description,
      sport: data.sport,
      org_type: data.org_type,
      location: locationMeta.locationLabel || data.location || null,
      formatted_address: locationMeta.formattedAddress || data.formatted_address || null,
      place_id: locationMeta.placeId,
      zip_code: duplicateZip || null,
      season_start: data.season_start ? new Date(data.season_start) : null,
      season_end: data.season_end ? new Date(data.season_end) : null,
      latitude: typeof locationMeta.latitude === 'number' ? locationMeta.latitude : null,
      longitude: typeof locationMeta.longitude === 'number' ? locationMeta.longitude : null,
    }
  });
  
  // Add creator as owner
  await prisma.organizationMembership.create({ 
    data: { 
      organization_id: organization.id, 
      user_id: req.user!.id, 
      role: 'owner' 
    } 
  });
  
  // Send invites to authorized users
  if (data.authorized_users && data.authorized_users.length > 0) {
    const invites = data.authorized_users
      .filter(user => user.email)
      .map(user => ({
        organization_id: organization.id,
        email: user.email!,
        role: user.role || 'member',
        assign_team: user.assign_team || null,
      }));
    
    if (invites.length > 0) {
      await prisma.organizationInvite.createMany({
        data: invites,
        skipDuplicates: true,
      });
      // Send invite emails (best effort)
      const inviter = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { display_name: true, email: true } });
      await Promise.all(invites.map(inv => 
        sendOrganizationInvitationEmail({
          to: inv.email,
          recipientName: inv.email.split('@')[0],
          inviterName: inviter?.display_name || 'An organizer',
          organizationName: organization.name,
          role: inv.role,
          acceptLink: `${process.env.APP_BASE_URL || 'https://varsityhub.app'}/organization-invites?invite=${organization.id}`,
          declineLink: `${process.env.APP_BASE_URL || 'https://varsityhub.app'}/organization-invites/${organization.id}/decline`,
        }).catch(() => false)
      ));
    }
  }
  
  return res.status(201).json(organization);
});

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
    where: { organization_id_user_id: { organization_id: id, user_id: req.user!.id } as any }
  });
  
  if (!membership || !isOrganizationAdmin(membership.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  // PLAN LIMITS: Enforce authorized user caps for organization-level invites
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    const prefs = (user?.preferences || {}) as any;
    const plan = resolvePlan(prefs.plan);
    const teamCountTotal =
      prefs.team_count_total ||
      (await prisma.teamMembership.count({ where: { user_id: req.user!.id, role: 'owner' } }));
    const limit = getAuthorizedUsersOrgLimit(plan, teamCountTotal);
    if (limit !== null) {
      const inviteCount = await prisma.organizationInvite.count({ where: { organization_id: id } });
      const memberCount = await prisma.organizationMembership.count({ where: { organization_id: id, role: { in: ['manager','member'] } } });
      const totalAuthorized = inviteCount + memberCount;
      if (totalAuthorized >= limit) {
        return res.status(403).json({
          error: 'USER_LIMIT_REACHED',
          message: `Plan limit reached. ${plan} plan allows ${limit} authorized user${limit === 1 ? '' : 's'} across your organization.`,
          limit,
          current: totalAuthorized
        });
      }
    }
  } catch (e) {
    console.warn('[organizations][invite-limit] check failed', e);
  }
  
  const invite = await prisma.organizationInvite.create({ 
    data: { 
      organization_id: id, 
      email, 
      role: role || 'member',
      assign_team: data.assign_team || null
    } 
  });
  // Send email (best effort)
  const org = await prisma.organization.findUnique({ where: { id }, select: { name: true } });
  const inviter = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { display_name: true, email: true } });
  if (org) {
    await sendOrganizationInvitationEmail({
      to: email,
      recipientName: email.split('@')[0],
      inviterName: inviter?.display_name || 'An organizer',
      organizationName: org.name,
      role: role || 'member',
      acceptLink: `${process.env.APP_BASE_URL || 'https://varsityhub.app'}/organization-invites?invite=${invite.id}`,
      declineLink: `${process.env.APP_BASE_URL || 'https://varsityhub.app'}/organization-invites/${invite.id}/decline`,
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
    orderBy: { created_at: 'desc' } 
  });
  
  return res.json(invites);
});

// Accept organization invite
organizationsRouter.post('/invites/:inviteId/accept', requireAuth as any, async (req: AuthedRequest, res) => {
  const inviteId = String(req.params.inviteId);
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const invite = await prisma.organizationInvite.findUnique({ 
    where: { id: inviteId },
    include: { organization: true }
  });
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
  if (invite.organization) {
    await sendOrganizationApprovalEmail({ to: user.email, organizationName: invite.organization.name }).catch(err => 
      console.warn('[org-invite-accept] Email send failed:', err)
    );
    
    // Send staff member joined notification to organization admins
    const admins = await prisma.organizationMembership.findMany({
      where: {
        organization_id: invite.organization_id,
        role: { in: ['owner', 'manager', 'administrator'] },
        user_id: { not: user.id },
        status: 'active'
      },
      include: { user: true }
    });
    
    const joinedDate = new Date().toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/Chicago',
    });
    
    await Promise.all(
      admins.map(admin => 
        sendStaffMemberJoinedEmail({
          to: admin.user.email!,
          recipientName: admin.user.display_name || admin.user.email!,
          newMemberName: user.display_name || user.email,
          memberRole: invite.role,
          teamName: invite.organization.name,
          joinedDate: joinedDate,
          organizationName: invite.organization.name,
          viewTeamLink: `${process.env.APP_BASE_URL || 'https://varsityhub.app'}/organizations/${invite.organization_id}/members`,
          manageStaffLink: `${process.env.APP_BASE_URL || 'https://varsityhub.app'}/organizations/${invite.organization_id}/staff`,
        }).catch((err: Error) => {
          console.error('[organizations] Failed to send staff member joined email:', err);
        })
      )
    );
  }
  
  return res.json({ message: 'Invite accepted' });
});

// Decline organization invite
organizationsRouter.post('/invites/:inviteId/decline', requireAuth as any, async (req: AuthedRequest, res) => {
  const inviteId = String(req.params.inviteId);
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const invite = await prisma.organizationInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.email !== user.email || invite.status !== 'pending') {
    return res.status(404).json({ error: 'Invite not found or not valid' });
  }
  
  await prisma.organizationInvite.update({ where: { id: inviteId }, data: { status: 'declined' } });
  return res.json({ message: 'Invite declined' });
});

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
          { location: { contains: query, mode: 'insensitive' } }
        ]
  };
  
  if (sport) where.sport = sport;
  if (orgType) {
    // Match organization type case-insensitively (e.g., 'school' vs 'School')
    where.org_type = { equals: orgType, mode: 'insensitive' } as any;
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
});

// Check for duplicate organizations
organizationsRouter.post('/check-duplicate', async (req, res) => {
  const { name, zip_code, place_id } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  
  // Check by place_id first (most reliable)
  if (place_id) {
    const existingByPlace = await prisma.organization.findFirst({
      where: { place_id, status: 'active' },
      select: { id: true, name: true, location: true, sport: true }
    });
    if (existingByPlace) {
      return res.json({ 
        exists: true,
        organization: existingByPlace
      });
    }
  }
  
  // Fallback to name + zip_code check
  const where: any = {
    name: { equals: name, mode: 'insensitive' },
    status: 'active'
  };
  
  if (zip_code) {
    where.zip_code = zip_code;
  }
  
  const existing = await prisma.organization.findFirst({ where });
  
  return res.json({ 
    exists: !!existing,
    organization: existing ? {
      id: existing.id,
      name: existing.name,
      location: existing.location,
      sport: existing.sport,
    } : null
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
  
  // Notify organization owners via in-app notifications
  if (organization.memberships.length > 0) {
    await Promise.all(organization.memberships.map(async (membership) => {
      try {
        await (prisma as any).notification.create({
          data: {
            user_id: membership.user.id,
            actor_id: req.user!.id,
            type: 'ORG_JOIN_REQUEST' as any,
            meta: {
              organization_id,
              organization_name: organization.name,
              join_request_id: joinRequest.id,
              requester_id: joinRequest.user.id,
              requester_name: joinRequest.user.display_name || joinRequest.user.email || 'New member',
              message: message || null,
            },
          },
        });
      } catch (err) {
        console.warn('[org][join-request] failed to create notification', err);
      }
    }));
  }
  
  return res.status(201).json(joinRequest);
});

// Get join requests for an organization (admin only)
organizationsRouter.get('/:id/join-requests', requireAuth as any, async (req: AuthedRequest, res) => {
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
});

// Get user's own join requests
organizationsRouter.get('/join-requests/me', requireAuth as any, async (req: AuthedRequest, res) => {
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
});

// Approve join request
organizationsRouter.post('/join-requests/:requestId/approve', requireAuth as any, async (req: AuthedRequest, res) => {
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
  
  // Update join request and create membership
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
    })
  ]);
  
  // Send approval email to user (disabled - templates removed from approved list)
  const adminUser = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { display_name: true }
  });
  
  // DISABLED: sendMembershipDecisionEmail and sendJoinRequestApproved - templates removed
  // let membershipEmailSent = false;
  // try {
  //   membershipEmailSent = await sendMembershipDecisionEmail({
  //     to: joinRequest.user.email,
  //     teamName: joinRequest.organization.name,
  //     organizationName: joinRequest.organization.name,
  //     approved: true,
  //   });
  // } catch (err) {
  //   console.warn('[org-join] membership approval email failed:', (err as any)?.message || err);
  // }
  
  // if (!membershipEmailSent) {
  //   await sendJoinRequestApproved({
  //     userEmail: joinRequest.user.email,
  //     userName: joinRequest.user.display_name || 'User',
  //     organizationName: joinRequest.organization.name,
  //     adminName: adminUser?.display_name || 'Admin',
  //   });
  // }
  
  return res.json({ message: 'Join request approved' });
});

// Deny join request
const denyJoinRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});

organizationsRouter.post('/join-requests/:requestId/deny', requireAuth as any, async (req: AuthedRequest, res) => {
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
  
  if (!membership || !['owner', 'manager'].includes(membership.role)) {
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
  
  // DISABLED: sendMembershipDecisionEmail and sendJoinRequestDenied - templates removed
  // let denialEmailSent = false;
  // try {
  //   denialEmailSent = await sendMembershipDecisionEmail({
  //     to: joinRequest.user.email,
  //     teamName: joinRequest.organization.name,
  //     organizationName: joinRequest.organization.name,
  //     approved: false,
  //   });
  // } catch (err) {
  //   console.warn('[org-join] membership denial email failed:', (err as any)?.message || err);
  // }
  
  // if (!denialEmailSent) {
  //   await sendJoinRequestDenied({
  //     userEmail: joinRequest.user.email,
  //     userName: joinRequest.user.display_name || 'User',
  //     organizationName: joinRequest.organization.name,
  //     reason: reason,
  //   });
  // }
  
  return res.json({ message: 'Join request denied' });
});
