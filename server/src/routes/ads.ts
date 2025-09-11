import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { getIsAdmin, requireAdmin } from '../middleware/requireAdmin.js';

export const adsRouter = Router();

// Create an Ad (optionally associated to the authenticated user)
adsRouter.post('/', requireVerified as any, async (req: AuthedRequest, res) => {
  const {
    contact_name,
    contact_email,
    business_name,
    banner_url,
    target_zip_code,
    radius,
    description,
    status,
    payment_status,
  } = req.body || {};
  if (!contact_name || !contact_email || !business_name || !target_zip_code) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const ad = await prisma.ad.create({
    data: {
      user_id: req.user?.id,
      contact_name: String(contact_name),
      contact_email: String(contact_email),
      business_name: String(business_name),
      banner_url: banner_url ? String(banner_url) : null,
      target_zip_code: String(target_zip_code),
      radius: typeof radius === 'number' ? radius : 45,
      description: description ? String(description) : null,
      status: status ? String(status) : 'draft',
      payment_status: payment_status ? String(payment_status) : 'unpaid',
    },
  });
  return res.status(201).json(ad);
});

// List Ads. If mine=1, returns ads for the authenticated user. If contact_email is provided, returns by email.
adsRouter.get('/', async (req: AuthedRequest, res) => {
  const mine = String(req.query.mine || '') === '1';
  const contactEmail = req.query.contact_email ? String(req.query.contact_email) : undefined;
  const all = String(req.query.all || '') === '1';
  const where: any = {};
  if (mine) {
    if (!req.user?.id) return res.status(401).json({ error: 'Auth required' });
    where.user_id = req.user.id;
  } else if (contactEmail) {
    where.contact_email = contactEmail;
  } else if (all) {
    const isAdmin = await getIsAdmin(req as any);
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    // return all ads
    const list = await prisma.ad.findMany({ orderBy: { created_at: 'desc' } });
    return res.json(list);
  } else {
    // default: no list without filter
    return res.json([]);
  }
  const list = await prisma.ad.findMany({ where, orderBy: { created_at: 'desc' } });
  return res.json(list);
});

// Get a single Ad with its reservations (dates)
adsRouter.get('/:id', async (req, res) => {
  const id = String(req.params.id);
  const ad = await prisma.ad.findUnique({ where: { id } });
  if (!ad) return res.status(404).json({ error: 'Not found' });
  const dates = await prisma.adReservation.findMany({ where: { ad_id: id }, orderBy: { date: 'asc' } });
  return res.json({ ...ad, dates: dates.map((r) => r.date.toISOString().slice(0, 10)) });
});

// Update an Ad (owner-only if authenticated)
adsRouter.put('/:id', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const existing = await prisma.ad.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.user_id && req.user?.id && existing.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const data: any = {};
  const allowed = ['contact_name','contact_email','business_name','banner_url','target_zip_code','radius','description','status','payment_status'] as const;
  for (const k of allowed) {
    if (k in (req.body || {})) (data as any)[k] = (req.body as any)[k];
  }
  const ad = await prisma.ad.update({ where: { id }, data });
  return res.json(ad);
});

// List reserved dates. Supports optional range and/or specific ad_id.
adsRouter.get('/reservations', async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  const adId = req.query.ad_id ? String(req.query.ad_id) : undefined;
  const where: any = {};
  if (from || to) where.date = {};
  if (from) where.date.gte = from;
  if (to) where.date.lte = to;
  if (adId) where.ad_id = adId;
  const list = await prisma.adReservation.findMany({ where, orderBy: { date: 'asc' } });
  const dates = list.map((r) => r.date.toISOString().slice(0, 10));
  if (adId) return res.json({ ad_id: adId, dates });
  return res.json({ dates });
});

// Create reservation for a set of dates (yyyy-MM-dd strings)
adsRouter.post('/reservations', requireVerified as any, async (req, res) => {
  const { ad_id, dates } = req.body || {};
  if (!ad_id || !Array.isArray(dates) || dates.length === 0) {
    return res.status(400).json({ error: 'ad_id and dates[] are required' });
  }
  const isoDates: string[] = Array.from(new Set(dates.map((d: any) => String(d))));
  // Check conflicts
  const existing = await prisma.adReservation.findMany({ where: { date: { in: isoDates.map((s) => new Date(s + 'T00:00:00.000Z')) } } });
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Dates already reserved', dates: existing.map((r) => r.date.toISOString().slice(0, 10)) });
  }
  // Create
  const created = await prisma.$transaction(
    isoDates.map((s) =>
      prisma.adReservation.create({ data: { ad_id: String(ad_id), date: new Date(s + 'T00:00:00.000Z') } })
    )
  );

  // Price logic matches mobile UI: flat weekday + weekend
  const hasWeekday = isoDates.some((s) => {
    const d = new Date(s + 'T00:00:00.000Z').getUTCDay();
    return d >= 1 && d <= 4; // Mon..Thu
  });
  const hasWeekend = isoDates.some((s) => {
    const d = new Date(s + 'T00:00:00.000Z').getUTCDay();
    return d === 0 || d === 5 || d === 6; // Fri..Sun (Sun=0)
  });
  const price = (hasWeekday ? 10 : 0) + (hasWeekend ? 17.5 : 0);

  return res.status(201).json({ ok: true, reserved: created.length, dates: isoDates, price });
});
