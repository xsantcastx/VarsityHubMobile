import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const organizationsRouter = Router();

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
  season_start: z.string().optional(),
  season_end: z.string().optional(),
});

// Create organization
organizationsRouter.post('/', requireAuth as any, async (req: AuthedRequest, res) => {
  const parsed = createOrganizationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  
  const data = parsed.data;
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
  
  // Create organization
  const organization = await prisma.organization.create({ 
    data: {
      name: data.name,
      description: data.description,
      sport: data.sport,
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
  
  if (!membership || !['owner', 'manager'].includes(membership.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  const invite = await prisma.organizationInvite.create({ 
    data: { 
      organization_id: id, 
      email, 
      role: role || 'member' 
    } 
  });
  
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
