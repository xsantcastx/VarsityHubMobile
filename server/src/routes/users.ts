import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const usersRouter = Router();

// List users (admin only)
usersRouter.get('/', requireAdmin as any, async (req, res) => {
  const q = String((req.query as any).q || '').trim().toLowerCase();
  const banned = String((req.query as any).banned || '') === '1';
  const limit = Math.min(parseInt(String((req.query as any).limit || '100'), 10) || 100, 500);
  const where: any = {};
  if (q) where.OR = [
    { email: { contains: q, mode: 'insensitive' } },
    { display_name: { contains: q, mode: 'insensitive' } },
  ];
  if (banned) where.banned = true;
  const rows = await prisma.user.findMany({
    where,
    take: limit,
    orderBy: { created_at: 'desc' },
    select: { id: true, email: true, display_name: true, email_verified: true, banned: true, created_at: true },
  });
  return res.json(rows);
});

// Ban/unban (admin only)
usersRouter.post('/:id/ban', requireAdmin as any, async (req, res) => {
  const id = String(req.params.id);
  const u = await prisma.user.update({ where: { id }, data: { banned: true } });
  return res.json({ ok: true, id: u.id, banned: true });
});

usersRouter.post('/:id/unban', requireAdmin as any, async (req, res) => {
  const id = String(req.params.id);
  const u = await prisma.user.update({ where: { id }, data: { banned: false } });
  return res.json({ ok: true, id: u.id, banned: false });
});

// Full user detail with ads and their reservation dates (admin only)
usersRouter.get('/:id/full', requireAdmin as any, async (req, res) => {
  const id = String(req.params.id);
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, display_name: true, email_verified: true, banned: true, created_at: true } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  const ads = await prisma.ad.findMany({ where: { user_id: id }, orderBy: { created_at: 'desc' } });
  const adIds = ads.map(a => a.id);
  const reservations = adIds.length ? await prisma.adReservation.findMany({ where: { ad_id: { in: adIds } }, orderBy: { date: 'asc' } }) : [];
  const datesByAd: Record<string, string[]> = {};
  for (const r of reservations) {
    const key = r.ad_id;
    if (!datesByAd[key]) datesByAd[key] = [];
    datesByAd[key].push(r.date.toISOString().slice(0,10));
  }
  return res.json({ user, ads, datesByAd });
});

// CSV export of user's ads and reservations
usersRouter.get('/:id/export', requireAdmin as any, async (req, res) => {
  const id = String(req.params.id);
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, display_name: true } });
  if (!user) return res.status(404).send('Not found');
  const ads = await prisma.ad.findMany({ where: { user_id: id }, orderBy: { created_at: 'desc' } });
  const adIds = ads.map(a => a.id);
  const reservations = adIds.length ? await prisma.adReservation.findMany({ where: { ad_id: { in: adIds } }, orderBy: { date: 'asc' } }) : [];
  const datesByAd: Record<string, string[]> = {};
  for (const r of reservations) {
    const key = r.ad_id;
    if (!datesByAd[key]) datesByAd[key] = [];
    datesByAd[key].push(r.date.toISOString().slice(0,10));
  }
  let csv = 'ad_id,business_name,status,payment_status,created_at,reservation_dates\n';
  for (const a of ads) {
    const dates = (datesByAd[a.id] || []).join(';');
    const row = [a.id, a.business_name || '', a.status || '', a.payment_status || '', a.created_at.toISOString(), dates]
      .map((v) => '"' + String(v).replace(/"/g,'""') + '"').join(',');
    csv += row + '\n';
  }
  const filename = `user-${user.id}-ads.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csv);
});

// Delete own account (soft-delete)
usersRouter.delete('/me', requireAuth as any, async (req: AuthedRequest, res) => {
  const id = req.user!.id;
  const ts = Date.now();
  const deletedEmail = `deleted+${id}+${ts}@example.com`;
  try {
    await prisma.user.update({
      where: { id },
      data: {
        banned: true,
        email: deletedEmail,
        password_hash: `deleted:${ts}:${Math.random().toString(36).slice(2)}`,
        display_name: null,
        avatar_url: null,
        bio: null,
      },
    });
    return res.json({ deleted: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Username availability check (public to authed users)
usersRouter.get('/username-available', async (req, res) => {
  const username = String((req.query as any).username || '').trim();
  const valid = /^[a-z0-9_.]{3,20}$/.test(username);
  if (!valid) return res.json({ available: false, valid: false });
  const exists = await prisma.user.findFirst({ where: { display_name: { equals: username, mode: 'insensitive' } }, select: { id: true } });
  return res.json({ available: !exists, valid: true });
});

// Lookup user by email (for onboarding authorized users flow)
usersRouter.get('/lookup', async (req, res) => {
  const email = String((req.query as any).email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Invalid email' });
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, display_name: true } });
  if (!u) return res.status(404).json({ error: 'Not found' });
  return res.json(u);
});

// Follow a user
usersRouter.post('/:id/follow', requireAuth as any, async (req: AuthedRequest, res) => {
  const follower_id = req.user!.id;
  const following_id = req.params.id;

  if (follower_id === following_id) {
    return res.status(400).json({ error: 'You cannot follow yourself.' });
  }

  try {
    await prisma.follows.create({
      data: {
        follower_id,
        following_id,
      },
    });
    // Return is_following_author for caller
    res.status(201).json({ is_following_author: true });
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Unfollow a user
usersRouter.delete('/:id/follow', requireAuth as any, async (req: AuthedRequest, res) => {
  const follower_id = req.user!.id;
  const following_id = req.params.id;

  try {
    await prisma.follows.delete({
      where: {
        follower_id_following_id: {
          follower_id,
          following_id,
        },
      },
    });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Get followers
usersRouter.get('/:id/followers', async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const currentUserId = req.user?.id;
  const limit = Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 50);
  const cursor = (req.query.cursor as string | undefined) || undefined;

  const follows = await prisma.follows.findMany({
    where: { following_id: id },
    take: limit + 1,
    cursor: cursor ? { follower_id_following_id: { follower_id: cursor, following_id: id } } : undefined,
    include: { follower: true },
  });

  const users = follows.slice(0, limit).map(f => f.follower);
  const nextCursor = follows.length > limit ? follows[limit].follower_id : null;

  if (currentUserId) {
    const userIds = users.map(u => u.id);
    const followingSet = new Set(
      (await prisma.follows.findMany({
        where: {
          follower_id: currentUserId,
          following_id: { in: userIds },
        },
        select: { following_id: true },
      })).map(f => f.following_id)
    );
    users.forEach(u => (u as any).is_following = followingSet.has(u.id));
  }

  res.json({ items: users, nextCursor });
});

// Get following
usersRouter.get('/:id/following', async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const currentUserId = req.user?.id;
  const limit = Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 50);
  const cursor = (req.query.cursor as string | undefined) || undefined;

  const follows = await prisma.follows.findMany({
    where: { follower_id: id },
    take: limit + 1,
    cursor: cursor ? { follower_id_following_id: { follower_id: id, following_id: cursor } } : undefined,
    include: { following: true },
  });

  const users = follows.slice(0, limit).map(f => f.following);
  const nextCursor = follows.length > limit ? follows[limit].following_id : null;

  if (currentUserId) {
    const userIds = users.map(u => u.id);
    const followingSet = new Set(
      (await prisma.follows.findMany({
        where: {
          follower_id: currentUserId,
          following_id: { in: userIds },
        },
        select: { following_id: true },
      })).map(f => f.following_id)
    );
    users.forEach(u => (u as any).is_following = followingSet.has(u.id));
  }

  res.json({ items: users, nextCursor });
});
