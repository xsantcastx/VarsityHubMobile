import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

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
