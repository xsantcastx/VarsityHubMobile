import { Router } from 'express';
import { getZipCoordinates, haversineDistance } from '../lib/geoUtils.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { getIsAdmin } from '../middleware/requireAdmin.js';
import { requireVerified } from '../middleware/requireVerified.js';

export const adsRouter = Router();

// Create an Ad (optionally associated to the authenticated user)
adsRouter.post('/', requireVerified as any, async (req: AuthedRequest, res) => {
  const {
    contact_name,
    contact_email,
    business_name,
    banner_url,
    banner_fit_mode,
    target_url,
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
      banner_fit_mode: banner_fit_mode ? String(banner_fit_mode) : null,
      target_url: target_url ? String(target_url) : null,
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
  
  console.log('[ads] GET / query params:', { 
    mine, 
    contactEmail, 
    all, 
    userId: req.user?.id,
    queryMine: req.query.mine 
  });
  
  if (mine) {
    if (!req.user?.id) {
      console.warn('[ads] GET / mine=1 but no user authenticated');
      return res.status(401).json({ error: 'Auth required' });
    }
    where.user_id = req.user.id;
    console.log('[ads] GET / filtering by user_id:', req.user.id);
  } else if (contactEmail) {
    where.contact_email = contactEmail;
  } else if (all) {
    const isAdmin = await getIsAdmin(req as any);
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    // return all ads
    const list = await prisma.ad.findMany({ orderBy: { created_at: 'desc' } });
    console.log('[ads] GET / admin all ads count:', list.length);
    return res.json(list);
  } else {
    // SECURITY: Default to requiring authentication and returning user's ads only
    console.log('[ads] GET / no filter provided, defaulting to user ads only');
    if (!req.user?.id) {
      console.warn('[ads] GET / no filter and no user authenticated, returning empty');
      return res.json([]);
    }
    // Default to showing only the authenticated user's ads
    where.user_id = req.user.id;
  }
  
  const list = await prisma.ad.findMany({ where, orderBy: { created_at: 'desc' } });
  console.log('[ads] GET / returning ads:', { 
    count: list.length, 
    where,
    adIds: list.map(a => a.id),
    userIds: list.map(a => a.user_id) 
  });
  return res.json(list);
});

// Ads for feed: return ads with a reservation for a specific date (default: today), optional zip filter, paid only
adsRouter.get('/for-feed', async (req, res) => {
  const dateParam = req.query.date ? String(req.query.date) : undefined; // yyyy-MM-dd
  const zip = req.query.zip ? String(req.query.zip) : undefined;
  const limit = Math.max(1, Math.min(Number(req.query.limit || 1) || 1, 5));
  // Build date range [start, next)
  const dateISO = dateParam || new Date().toISOString().slice(0, 10);
  const start = new Date(dateISO + 'T00:00:00.000Z');
  const next = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  console.log('[ads] for-feed query:', { dateParam, dateISO, zip, limit, start, next });

  const whereAd: any = {
    payment_status: 'paid',
    // Removed banner_url requirement - allow ads with or without banners
  };
  if (zip) whereAd.target_zip_code = zip;

  console.log('[ads] for-feed where clause for ads:', whereAd);

  const ads = await prisma.ad.findMany({
    where: {
      ...whereAd,
      reservations: {
        some: { date: { gte: start, lt: next } },
      },
    },
    orderBy: { created_at: 'desc' },
    take: limit,
    include: {
      reservations: true, // Include reservations for debugging
    },
  });

  console.log('[ads] for-feed found ads:', { 
    count: ads.length, 
    ads: ads.map(ad => ({
      id: ad.id,
      payment_status: ad.payment_status,
      banner_url: !!ad.banner_url,
      reservations: ad.reservations.map(r => ({ id: r.id, date: r.date, dateISO: r.date.toISOString() }))
    }))
  });

  return res.json({ date: dateISO, ads: ads.map(ad => ({ ...ad, reservations: undefined })) }); // Remove reservations from response
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
  const allowed = ['contact_name','contact_email','business_name','banner_url','banner_fit_mode','target_url','target_zip_code','radius','description','status','payment_status'] as const;
  for (const k of allowed) {
    if (k in (req.body || {})) (data as any)[k] = (req.body as any)[k];
  }
  const ad = await prisma.ad.update({ where: { id }, data });
  return res.json(ad);
});

// Delete an Ad (owner-only if authenticated)
adsRouter.delete('/:id', requireVerified as any, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  console.log('[ads] DELETE /:id request', { id, userId: req.user?.id });
  
  const existing = await prisma.ad.findUnique({ where: { id } });
  if (!existing) {
    console.warn('[ads] DELETE /:id - Ad not found', { id });
    return res.status(404).json({ error: 'Not found' });
  }
  
  // Check ownership
  if (existing.user_id && req.user?.id && existing.user_id !== req.user.id) {
    console.warn('[ads] DELETE /:id - Forbidden (user does not own ad)', { 
      id, 
      adUserId: existing.user_id, 
      requestUserId: req.user.id 
    });
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  try {
    // First delete all reservations for this ad
    await prisma.adReservation.deleteMany({ where: { ad_id: id } });
    console.log('[ads] DELETE /:id - Deleted reservations', { id });
    
    // Then delete the ad itself
    await prisma.ad.delete({ where: { id } });
    console.log('[ads] DELETE /:id - Ad deleted successfully', { id });
    
    return res.json({ ok: true, message: 'Ad deleted successfully' });
  } catch (error) {
    console.error('[ads] DELETE /:id - Error deleting ad', { id, error });
    return res.status(500).json({ error: 'Failed to delete ad' });
  }
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
  
  console.log('[ads] GET /reservations query:', { from, to, adId, where });
  
  const list = await prisma.adReservation.findMany({ where, orderBy: { date: 'asc' } });
  const dates = list.map((r) => r.date.toISOString().slice(0, 10));
  
  console.log('[ads] Found reservations:', { 
    adId, 
    count: list.length, 
    rawDates: list.map(r => ({ id: r.id, date: r.date, dateISO: r.date.toISOString() })),
    formattedDates: dates 
  });
  
  if (adId) return res.json({ ad_id: adId, dates });
  return res.json({ dates });
});

/**
 * GET /ads/availability?zip=12345&from=2025-01-15&to=2025-01-31
 * 
 * Returns availability status for each date in the range.
 * Each date can have up to 3 ads (slots). If 3+ ads already exist, date is full.
 */
adsRouter.get('/availability', async (req, res) => {
  const zipCode = req.query.zip ? String(req.query.zip) : undefined;
  const from = req.query.from ? String(req.query.from) : undefined;
  const to = req.query.to ? String(req.query.to) : undefined;

  if (!zipCode || !from || !to) {
    return res.status(400).json({ error: 'zip, from, and to are required' });
  }

  const MAX_ADS_PER_DATE = 3; // Maximum ad slots per date

  // Parse date range
  const fromDate = new Date(from + 'T00:00:00.000Z');
  const toDate = new Date(to + 'T00:00:00.000Z');

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return res.status(400).json({ error: 'Invalid date format' });
  }

  // Get all ads for this zip code
  const adsInZip = await prisma.ad.findMany({
    where: {
      target_zip_code: zipCode,
      payment_status: 'paid', // Only count paid ads
    },
    select: { id: true },
  });

  const adIds = adsInZip.map(a => a.id);

  // Get all reservations for these ads in the date range
  const reservations = await prisma.adReservation.findMany({
    where: {
      ad_id: { in: adIds },
      date: {
        gte: fromDate,
        lte: toDate,
      },
    },
    select: {
      date: true,
      ad_id: true,
    },
  });

  // Count ads per date
  const adCountByDate: Record<string, number> = {};
  
  reservations.forEach(r => {
    const dateISO = r.date.toISOString().slice(0, 10);
    adCountByDate[dateISO] = (adCountByDate[dateISO] || 0) + 1;
  });

  // Generate all dates in range and check availability
  const availability: Record<string, { available: boolean; slotsUsed: number; slotsRemaining: number }> = {};
  
  let currentDate = new Date(fromDate);
  while (currentDate <= toDate) {
    const dateISO = currentDate.toISOString().slice(0, 10);
    const slotsUsed = adCountByDate[dateISO] || 0;
    const slotsRemaining = MAX_ADS_PER_DATE - slotsUsed;
    
    availability[dateISO] = {
      available: slotsRemaining > 0,
      slotsUsed,
      slotsRemaining: Math.max(0, slotsRemaining),
    };
    
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return res.json({
    zip: zipCode,
    from,
    to,
    maxSlotsPerDate: MAX_ADS_PER_DATE,
    availability,
  });
});

// Create reservation for a set of dates (yyyy-MM-dd strings)
adsRouter.post('/reservations', requireVerified as any, async (req, res) => {
  const { ad_id, dates } = req.body || {};
  if (!ad_id || !Array.isArray(dates) || dates.length === 0) {
    return res.status(400).json({ error: 'ad_id and dates[] are required' });
  }
  const isoDates: string[] = Array.from(new Set(dates.map((d: any) => String(d))));
  // No global conflicts: allow multiple ads on the same date.
  // Enforce only one reservation per ad per date via DB unique constraint.
  // Create (skip duplicates for idempotency)
  const createdMany = await prisma.adReservation.createMany({
    data: isoDates.map((s) => ({ ad_id: String(ad_id), date: new Date(s + 'T00:00:00.000Z') })),
    skipDuplicates: true,
  });

  // Price logic: charge per individual day
  // Mon-Thu = $10/day, Fri-Sun = $17.50/day
  let totalPrice = 0;
  isoDates.forEach((s) => {
    const d = new Date(s + 'T00:00:00.000Z').getUTCDay();
    if (d >= 1 && d <= 4) {
      // Mon-Thu: weekday rate
      totalPrice += 10.00;
    } else {
      // Fri-Sun: weekend rate (Sun=0, Fri=5, Sat=6)
      totalPrice += 17.50;
    }
  });

  return res.status(201).json({ ok: true, reserved: createdMany.count, dates: isoDates, price: totalPrice });
});

/**
 * GET /ads/alternative-zips?zip=12345&dates=2025-01-15,2025-01-16
 * 
 * Find alternative zip codes within 50 miles when the requested zip is fully booked.
 * Returns nearby zips with availability for the requested dates, sorted by distance.
 */
adsRouter.get('/alternative-zips', async (req: AuthedRequest, res) => {
  const { zip, dates } = req.query;
  
  if (!zip || !dates) {
    return res.status(400).json({ error: 'Missing required params: zip, dates' });
  }
  
  const zipCode = String(zip);
  const dateList = String(dates).split(',').map(d => d.trim());
  
  // Get coordinates for the requested zip
  const originCoords = getZipCoordinates(zipCode);
  if (!originCoords) {
    return res.status(400).json({ error: 'Invalid zip code or coordinates not found' });
  }
  
  // Get all ads within approximate range (we'll use all ads for simplicity, 
  // but in production you'd want to filter by geographic bounds first)
  const allAds = await prisma.ad.findMany({
    where: {
      status: { in: ['draft', 'active'] },
    },
    select: {
      id: true,
      target_zip_code: true,
    },
  });
  
  // Calculate distances and group by zip code
  const zipDistances: Map<string, number> = new Map();
  
  for (const ad of allAds) {
    if (!ad.target_zip_code) continue; // Skip ads without zip codes
    if (ad.target_zip_code === zipCode) continue; // Skip the original zip
    if (zipDistances.has(ad.target_zip_code)) continue; // Already calculated
    
    const adCoords = getZipCoordinates(ad.target_zip_code);
    if (!adCoords) continue;
    
    const distance = haversineDistance(
      originCoords.lat,
      originCoords.lon,
      adCoords.lat,
      adCoords.lon
    );
    
    // Only consider zips within 50 miles
    if (distance <= 50) {
      zipDistances.set(ad.target_zip_code, distance);
    }
  }
  
  // Check availability for each nearby zip
  const alternatives: Array<{ zip: string; distance: number; available: boolean }> = [];
  
  for (const [nearbyZip, distance] of zipDistances.entries()) {
    // Find ads in this zip code
    const adsInZip = await prisma.ad.findMany({
      where: {
        target_zip_code: nearbyZip,
        status: { in: ['draft', 'active'] },
      },
      include: {
        reservations: {
          where: {
            date: {
              in: dateList.map(d => new Date(d + 'T00:00:00.000Z')),
            },
          },
        },
      },
    });
    
    // Check if ALL requested dates are available (no ads fully booked for all dates)
    let hasAvailability = false;
    
    for (const ad of adsInZip) {
      const bookedDates = new Set(ad.reservations.map(r => r.date.toISOString().split('T')[0]));
      const allDatesBooked = dateList.every(date => bookedDates.has(date));
      
      if (!allDatesBooked) {
        hasAvailability = true;
        break;
      }
    }
    
    // If no ads exist in this zip, it's available
    if (adsInZip.length === 0) {
      hasAvailability = true;
    }
    
    alternatives.push({
      zip: nearbyZip,
      distance: Math.round(distance * 10) / 10, // Round to 1 decimal
      available: hasAvailability,
    });
  }
  
  // Sort by distance and filter to available only
  const availableAlternatives = alternatives
    .filter(a => a.available)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5); // Return top 5 closest alternatives
  
  return res.json({
    requested_zip: zipCode,
    alternatives: availableAlternatives,
  });
});
