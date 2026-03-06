import { Router } from 'express';
import { getZipCoordinates, haversineDistance } from '../lib/geoUtils.js';
import { geocodeLocation } from '../lib/geocoding.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { getIsAdmin } from '../middleware/requireAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { debugLog } from '../lib/debugLog.js';
import { calculateAdPriceDollars } from '../utils/adPricing.js';
import { adCreationLimiter } from '../middleware/rateLimiters.js';

/**
 * Get coordinates for a ZIP code with fallback to Google Geocoding API
 * First tries the static lookup table, then falls back to API if not found
 */
async function getZipCoordinatesWithFallback(zipCode: string): Promise<{ lat: number; lon: number } | null> {
  // Try static lookup first (faster, no API call)
  const staticResult = getZipCoordinates(zipCode);
  if (staticResult) {
    return staticResult;
  }

  // Fall back to Google Geocoding API for ZIP codes not in static table
  debugLog('[ads] ZIP code not in static table, trying Google Geocoding:', zipCode);
  const geocodeResult = await geocodeLocation(zipCode);
  if (geocodeResult) {
    return { lat: geocodeResult.latitude, lon: geocodeResult.longitude };
  }

  return null;
}

export const adsRouter = Router();

// Create an Ad (optionally associated to the authenticated user)
adsRouter.post('/', requireVerified as any, adCreationLimiter, async (req: AuthedRequest, res) => {
  const { payment_status: _ps, status: _st, ...safeBody } = req.body || {};
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
  } = safeBody;
  if (!contact_name || !contact_email || !business_name || !target_zip_code) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!/^\d{5}$/.test(String(target_zip_code))) {
    return res.status(400).json({ error: 'target_zip_code must be a 5-digit US zip code' });
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
      radius: 9, // Fixed 9km radius for all ads
      description: description ? String(description) : null,
      status: 'draft',
      payment_status: 'unpaid',
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
  
  debugLog('[ads] GET / query params:', { 
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
    debugLog('[ads] GET / filtering by user_id:', req.user.id);
  } else if (contactEmail) {
    where.contact_email = contactEmail;
  } else if (all) {
    const isAdmin = await getIsAdmin(req as any);
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    // return all ads
    const list = await prisma.ad.findMany({ orderBy: { created_at: 'desc' }, take: 200 });
    debugLog('[ads] GET / admin all ads count:', list.length);
    return res.json(list);
  } else {
    // SECURITY: Default to requiring authentication and returning user's ads only
    debugLog('[ads] GET / no filter provided, defaulting to user ads only');
    if (!req.user?.id) {
      console.warn('[ads] GET / no filter and no user authenticated, returning empty');
      return res.json([]);
    }
    // Default to showing only the authenticated user's ads
    where.user_id = req.user.id;
  }
  
  const list = await prisma.ad.findMany({ where, orderBy: { created_at: 'desc' }, take: 100 });
  debugLog('[ads] GET / returning ads:', { 
    count: list.length, 
    where,
    adIds: list.map(a => a.id),
    userIds: list.map(a => a.user_id) 
  });
  return res.json(list);
});

// Ads for feed: return ads with a reservation for a specific date (default: today), filtered by location radius
adsRouter.get('/for-feed', async (req, res) => {
  const dateParam = req.query.date ? String(req.query.date) : undefined; // yyyy-MM-dd
  const zip = req.query.zip ? String(req.query.zip) : undefined;
  const lat = req.query.lat ? Number(req.query.lat) : undefined;
  const lng = req.query.lng ? Number(req.query.lng) : undefined;
  const limit = Math.max(1, Math.min(Number(req.query.limit || 1) || 1, 5));
  // Build date range [start, next)
  const dateISO = dateParam || new Date().toISOString().slice(0, 10);
  const start = new Date(dateISO + 'T00:00:00.000Z');
  const next = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  debugLog('[ads] for-feed query:', { dateParam, dateISO, zip, lat, lng, limit, start, next });

  // Validate zip format if provided
  if (zip && !/^\d{5}$/.test(zip)) {
    return res.status(400).json({ error: 'Invalid zip code format' });
  }

  // Resolve user coordinates from zip or lat/lng
  let userCoords: { lat: number; lon: number } | null = null;
  if (zip) {
    userCoords = await getZipCoordinatesWithFallback(zip);
  } else if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
    userCoords = { lat, lon: lng };
  }

  debugLog('[ads] for-feed user coordinates:', userCoords);

  const whereAd: any = {
    payment_status: 'paid',
    target_zip_code: { not: null }, // Only show ads with a target zip code
  };

  // If no user location, return empty — no untargeted/national ads
  if (!userCoords) {
    return res.json({ date: dateISO, ads: [] });
  }

  debugLog('[ads] for-feed where clause for ads:', whereAd);

  const ads = await prisma.ad.findMany({
    where: {
      ...whereAd,
      reservations: {
        some: { date: { gte: start, lt: next } },
      },
    },
    orderBy: { created_at: 'desc' },
    take: 50, // Safety cap; distance filter applied below
    include: {
      reservations: true,
    },
  });

  // Filter by distance — only show ads whose target zip is within their radius
  const filtered = ads.filter(ad => {
    if (!ad.target_zip_code) return false; // No zip = not shown
    const adCoords = getZipCoordinates(ad.target_zip_code);
    if (!adCoords) return false;
    const dist = haversineDistance(userCoords!.lat, userCoords!.lon, adCoords.lat, adCoords.lon);
    return dist <= 5.59; // Fixed 9km radius (5.59 miles)
  });

  const result = filtered.slice(0, limit);

  debugLog('[ads] for-feed found ads:', {
    totalFetched: ads.length,
    afterFilter: filtered.length,
    returned: result.length,
    ads: result.map(ad => ({
      id: ad.id,
      payment_status: ad.payment_status,
      banner_url: !!ad.banner_url,
      target_zip_code: ad.target_zip_code,
      radius: ad.radius,
      reservations: ad.reservations.map(r => ({ id: r.id, date: r.date, dateISO: r.date.toISOString() }))
    }))
  });

  return res.json({ date: dateISO, ads: result.map(ad => ({ ...ad, reservations: undefined })) });
});

// Get a single Ad with its reservations (dates)
adsRouter.get('/:id([a-z0-9-]{20,40})', requireAuth as any, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const ad = await prisma.ad.findUnique({ where: { id } });
  if (!ad) return res.status(404).json({ error: 'Not found' });
  const isAdmin = await getIsAdmin(req);
  const isOwner = !!ad.user_id && ad.user_id === req.user!.id;
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' });
  const dates = await prisma.adReservation.findMany({ where: { ad_id: id }, orderBy: { date: 'asc' } });
  return res.json({ ...ad, dates: dates.map((r) => r.date.toISOString().slice(0, 10)) });
});

// Update an Ad (owner-only if authenticated)
adsRouter.put('/:id([a-z0-9-]{20,40})', requireAuth as any, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const ad = await prisma.ad.findUnique({ where: { id } });
  if (!ad) return res.status(404).json({ error: 'Ad not found' });
  if (ad.user_id !== req.user!.id) return res.status(403).json({ error: 'Not authorized' });
  const { payment_status, ...safeBody } = req.body || {};
  const data: any = {};
  const allowed = ['contact_name','contact_email','business_name','banner_url','banner_fit_mode','target_url','target_zip_code','radius','description','status'] as const;
  for (const k of allowed) {
    if (k in safeBody) (data as any)[k] = (safeBody as any)[k];
  }
  const updated = await prisma.ad.update({ where: { id }, data });
  return res.json(updated);
});

// Delete an Ad (owner-only if authenticated)
adsRouter.delete('/:id([a-z0-9-]{20,40})', requireVerified as any, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  debugLog('[ads] DELETE /:id request', { id, userId: req.user?.id });
  
  const existing = await prisma.ad.findUnique({ where: { id } });
  if (!existing) {
    console.warn('[ads] DELETE /:id - Ad not found', { id });
    return res.status(404).json({ error: 'Not found' });
  }
  
  const isAdmin = await getIsAdmin(req);
  const isOwner = existing.user_id === req.user?.id;

  // Only the owner (or an admin) can delete. Ads without owner can no longer be deleted by any authenticated user.
  if (!isOwner && !isAdmin) {
    console.warn('[ads] DELETE /:id - Forbidden (user does not own ad)', { 
      id, 
      adUserId: existing.user_id, 
      requestUserId: req.user?.id 
    });
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  try {
    // First delete all reservations for this ad
    await prisma.adReservation.deleteMany({ where: { ad_id: id } });
    debugLog('[ads] DELETE /:id - Deleted reservations', { id });
    
    // Then delete the ad itself
    await prisma.ad.delete({ where: { id } });
    debugLog('[ads] DELETE /:id - Ad deleted successfully', { id });
    
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
  
  debugLog('[ads] GET /reservations query:', { from, to, adId, where });
  
  const list = await prisma.adReservation.findMany({ where, orderBy: { date: 'asc' }, take: 1000 });
  const dates = list.map((r) => r.date.toISOString().slice(0, 10));
  
  debugLog('[ads] Found reservations:', { 
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
    take: 100,
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
adsRouter.post('/reservations', requireVerified as any, async (req: AuthedRequest, res) => {
  const { ad_id, dates } = req.body || {};
  if (!ad_id || !Array.isArray(dates) || dates.length === 0) {
    return res.status(400).json({ error: 'ad_id and dates[] are required' });
  }

  // Guard: ad must belong to the requesting user and must be paid.
  const ad = await prisma.ad.findUnique({ where: { id: String(ad_id) } });
  if (!ad) return res.status(404).json({ error: 'Ad not found' });
  if (ad.user_id !== req.user?.id) return res.status(403).json({ error: 'Forbidden' });
  if (ad.payment_status !== 'paid') return res.status(403).json({ error: 'Ad is not paid' });

  const isoDates: string[] = Array.from(new Set(dates.map((d: any) => String(d))));
  // No global conflicts: allow multiple ads on the same date.
  // Enforce only one reservation per ad per date via DB unique constraint.
  // Create (skip duplicates for idempotency)
  const createdMany = await prisma.adReservation.createMany({
    data: isoDates.map((s) => ({ ad_id: String(ad_id), date: new Date(s + 'T00:00:00.000Z') })),
    skipDuplicates: true,
  });

  // Use shared ad pricing helper for consistent calculation
  // Mon-Thu = $5.00 per week block, Fri-Sun = $8.00 per week block
  // Properly groups dates into week blocks (multiple dates in same week = single charge)
  const totalPrice = calculateAdPriceDollars(isoDates);

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

  // Get coordinates for the requested zip (with Google Geocoding fallback)
  const originCoords = await getZipCoordinatesWithFallback(zipCode);
  if (!originCoords) {
    return res.status(400).json({ error: 'Could not find coordinates for ZIP code. Please verify the ZIP code is valid.' });
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
    take: 500,
  });

  // Calculate distances and group by zip code
  const zipDistances: Map<string, number> = new Map();

  for (const ad of allAds) {
    if (!ad.target_zip_code) continue; // Skip ads without zip codes
    if (ad.target_zip_code === zipCode) continue; // Skip the original zip
    if (zipDistances.has(ad.target_zip_code)) continue; // Already calculated

    // Use sync lookup for iteration (to avoid too many API calls)
    const adCoords = getZipCoordinates(ad.target_zip_code);
    if (!adCoords) continue;
    
    const distance = haversineDistance(
      originCoords.lat,
      originCoords.lon,
      adCoords.lat,
      adCoords.lon
    );
    
    // Only consider zips within 9km (5.59 miles)
    if (distance <= 5.59) {
      zipDistances.set(ad.target_zip_code, distance);
    }
  }
  
  // Batch query: fetch all ads in nearby zips in a single query (avoids N+1)
  const nearbyZips = Array.from(zipDistances.keys());
  const allNearbyAds = nearbyZips.length > 0 ? await prisma.ad.findMany({
    where: {
      target_zip_code: { in: nearbyZips },
      status: { in: ['draft', 'active'] },
    },
    include: {
      reservations: {
        where: {
          date: { in: dateList.map(d => new Date(d + 'T00:00:00.000Z')) },
        },
      },
    },
    take: 200,
  }) : [];

  // Group ads by zip code
  const adsByZip = new Map<string, typeof allNearbyAds>();
  for (const ad of allNearbyAds) {
    const zip = ad.target_zip_code || '';
    const list = adsByZip.get(zip) || [];
    list.push(ad);
    adsByZip.set(zip, list);
  }

  // Check availability for each nearby zip
  const alternatives: Array<{ zip: string; distance: number; available: boolean }> = [];

  for (const [nearbyZip, distance] of zipDistances.entries()) {
    const adsInZip = adsByZip.get(nearbyZip) || [];

    // If no ads exist in this zip, it's available
    let hasAvailability = adsInZip.length === 0;

    if (!hasAvailability) {
      for (const ad of adsInZip) {
        const bookedDates = new Set(ad.reservations.map(r => r.date.toISOString().split('T')[0]));
        const allDatesBooked = dateList.every(date => bookedDates.has(date));
        if (!allDatesBooked) {
          hasAvailability = true;
          break;
        }
      }
    }

    alternatives.push({
      zip: nearbyZip,
      distance: Math.round(distance * 10) / 10,
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
