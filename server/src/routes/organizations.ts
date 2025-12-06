import { Router } from 'express';
import { z } from 'zod';
import { sendJoinRequestApproved, sendJoinRequestDenied, sendJoinRequestToAdmin, sendOrganizationInviteEmail } from '../lib/email.js';
import { sendOrganizationApprovalEmail } from '../lib/notifications.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { debugLog } from '../lib/debugLog.js';

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
        },
        orderBy: { created_at: 'desc' }
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
  zip_code: z.string().max(10).optional(),
  season_start: z.string().optional(),
  season_end: z.string().optional(),
});

// Create organization
organizationsRouter.post('/', requireAuth as any, async (req: AuthedRequest, res) => {
  const parsed = createOrganizationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  
  const data = parsed.data;
  // Enhanced duplicate guard: check normalized name collisions within same zip_code regardless of org_type/sport
  const nm = normalizeOrganizationName(data.name);
  const possibleDuplicates = await prisma.organization.findMany({
    where: {
      zip_code: data.zip_code || undefined,
      status: 'active'
    },
    select: { id: true, name: true, zip_code: true }
  });
  const dup = possibleDuplicates.find(o => normalizeOrganizationName(o.name) === nm);
  if (dup) {
    return res.status(409).json({ error: 'DUPLICATE_ORGANIZATION', duplicate_of: { id: dup.id, name: dup.name } });
  }
  const organization = await prisma.organization.create({ 
    data: {
      ...data,
      season_start: data.season_start ? new Date(data.season_start) : null,
      season_end: data.season_end ? new Date(data.season_end) : null,
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
  zip_code: z.string().max(10).optional(),
  season_start: z.string().optional(),
  season_end: z.string().optional(),
  authorized_users: z.array(z.object({
    email: z.string().email().optional(),
    user_id: z.string().optional(),
    role: z.string().optional(),
    assign_team: z.string().optional(),
  })).optional(),
});

// Enhanced create organization for onboarding
organizationsRouter.post('/create', requireAuth as any, async (req: AuthedRequest, res) => {
  const parsed = createOrganizationWithTeamsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  
  const data = parsed.data;
  // Duplicate guard (same logic as simple create)
  const nm = normalizeOrganizationName(data.name);
  const possibleDuplicates = await prisma.organization.findMany({
    where: {
      zip_code: data.zip_code || undefined,
      status: 'active'
    },
    select: { id: true, name: true, zip_code: true }
  });
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
      location: data.location,
      zip_code: data.zip_code,
      season_start: data.season_start ? new Date(data.season_start) : null,
      season_end: data.season_end ? new Date(data.season_end) : null,
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
      }));
    
    if (invites.length > 0) {
      await prisma.organizationInvite.createMany({
        data: invites,
        skipDuplicates: true,
      });
      // Send invite emails (best effort)
      const inviter = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { display_name: true } });
      await Promise.all(invites.map(inv => 
        sendOrganizationInviteEmail({
          to: inv.email,
          organizationName: organization.name,
          role: inv.role,
          inviterName: inviter?.display_name || 'An organizer',
                  orgLogoUrl: organization.logo || undefined,
                  primaryColor: (organization.brand_colors as any)?.primary || undefined,
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
    const plan = prefs.plan || 'rookie';
    let limit: number | null = null;
    if (plan === 'rookie') limit = 1; // Rookie org usage unlikely but safeguard
    else if (plan === 'veteran') {
      const teamCountTotal = prefs.team_count_total || await prisma.teamMembership.count({ where: { user_id: req.user!.id, role: 'owner' } });
      limit = (teamCountTotal * 2) || 12; // fallback 12
    }
    // legend => unlimited
    if (limit !== null) {
      const inviteCount = await prisma.organizationInvite.count({ where: { organization_id: id } });
      const memberCount = await prisma.organizationMembership.count({ where: { organization_id: id, role: { in: ['manager','member'] } } });
      const totalAuthorized = inviteCount + memberCount;
      if (totalAuthorized >= limit) {
        return res.status(403).json({
          error: 'USER_LIMIT_REACHED',
          message: `Plan limit reached. ${plan} plan allows ${limit} authorized user${limit === 1 ? '' : 's'} (${plan === 'veteran' ? '2 per team' : 'Rookie max'}).`,
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
      role: role || 'member' 
    } 
  });
  // Send email (best effort)
  const org = await prisma.organization.findUnique({ where: { id }, select: { name: true, logo: true, brand_colors: true } });
  const inviter = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { display_name: true } });
  if (org) {
    await sendOrganizationInviteEmail({
      to: email,
      organizationName: org.name,
      role: role || 'member',
        orgLogoUrl: org.logo || undefined,
        primaryColor: (org.brand_colors as any)?.primary || undefined,
      inviterName: inviter?.display_name || 'An organizer',
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
    await sendOrganizationApprovalEmail({ to: user.email, orgName: org.name }).catch(err => 
      console.warn('[org-invite-accept] Email send failed:', err)
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
});

// Check for duplicate organizations
organizationsRouter.post('/check-duplicate', async (req, res) => {
  const { name, zip_code } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  
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
  
  // Send email notification to organization owners
  if (organization.memberships.length > 0) {
    const owner = organization.memberships[0];
    await sendJoinRequestToAdmin({
      adminEmail: owner.user.email,
      adminName: owner.user.display_name || 'Admin',
      requesterName: joinRequest.user.display_name || 'A user',
      organizationName: organization.name,
      message: message,
      requestId: joinRequest.id,
      orgLogoUrl: organization.logo || undefined,
    });
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
  
  // Send approval email to user
  const adminUser = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { display_name: true }
  });
  
  await sendJoinRequestApproved({
    userEmail: joinRequest.user.email,
    userName: joinRequest.user.display_name || 'User',
    organizationName: joinRequest.organization.name,
    adminName: adminUser?.display_name || 'Admin',
    orgLogoUrl: joinRequest.organization.logo || undefined,
  });
  
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
  
  // Send denial email to user
  await sendJoinRequestDenied({
    userEmail: joinRequest.user.email,
    userName: joinRequest.user.display_name || 'User',
    organizationName: joinRequest.organization.name,
    reason: reason,
    orgLogoUrl: joinRequest.organization.logo || undefined,
  });
  
  return res.json({ message: 'Join request denied' });
});

