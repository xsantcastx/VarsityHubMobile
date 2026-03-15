import { Router } from 'express';
import { getZipCoordinates, haversineDistance } from '../lib/geoUtils.js';
import { geocodeLocation } from '../lib/geocoding.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { getIsAdmin, requireAdmin } from '../middleware/requireAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { debugLog } from '../lib/debugLog.js';
import { adCreationLimiter } from '../middleware/rateLimiters.js';
import { sendAdApprovedEmail, sendAdPendingReviewEmail, sendAdRejectedEmail } from '../lib/email.js';
import { z } from 'zod';

const adCreateSchema = z.object({
  contact_name: z.string().min(1).max(200),
  contact_email: z.string().email().max(320),
  business_name: z.string().min(1).max(200),
  banner_url: z.string().url().max(2048).nullish(),
  banner_fit_mode: z.enum(['cover', 'contain', 'fill']).nullish(),
  target_url: z.string().url().max(2048).nullish(),
  target_zip_code: z.string().regex(/^\d{5}$/, 'Must be a 5-digit US zip code'),
  radius: z.number().optional(),
  description: z.string().max(1000).nullish(),
});

const adUpdateSchema = z.object({
  contact_name: z.string().min(1).max(200).optional(),
  contact_email: z.string().email().max(320).optional(),
  business_name: z.string().min(1).max(200).optional(),
  banner_url: z.string().url().max(2048).nullish(),
  banner_fit_mode: z.enum(['cover', 'contain', 'fill']).nullish(),
  target_url: z.string().url().max(2048).nullish(),
  target_zip_code: z.string().regex(/^\d{5}$/, 'Must be a 5-digit US zip code').optional(),
  radius: z.number().optional(),
  description: z.string().max(1000).nullish(),
  // status intentionally excluded — owners cannot set status directly.
  // Status transitions: banner change → 'pending' (auto), admin approve → 'active', admin reject → 'rejected'.
});

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
  try {
    const { payment_status: _ps, status: _st, ...safeBody } = req.body || {};
    const parsed = adCreateSchema.safeParse(safeBody);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const { contact_name, contact_email, business_name, banner_url, banner_fit_mode, target_url, target_zip_code, description } = parsed.data;
    const ad = await prisma.ad.create({
      data: {
        user_id: req.user?.id,
        contact_name,
        contact_email,
        business_name,
        banner_url: banner_url ?? null,
        banner_fit_mode: banner_fit_mode ?? null,
        target_url: target_url ?? null,
        target_zip_code,
        radius: 9, // Fixed 9km radius for all ads
        description: description ?? null,
        status: 'draft',
        payment_status: 'unpaid',
      },
    });
    return res.status(201).json(ad);
  } catch (err) {
    console.error('[ads] POST / error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// List Ads. If mine=1, returns ads for the authenticated user. If contact_email is provided, returns by email.
adsRouter.get('/', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
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
      // SECURITY: Only allow querying by contact_email if the user is an admin
      // or if the email belongs to the authenticated user. This prevents IDOR
      // where any user could enumerate ads by guessing email addresses.
      const isAdmin = await getIsAdmin(req as any);
      if (!isAdmin) {
        // Non-admins can only see their own ads (by user_id), not query by arbitrary email
        if (!req.user?.id) return res.status(401).json({ error: 'Auth required' });
        where.user_id = req.user.id;
        where.contact_email = contactEmail;
      } else {
        where.contact_email = contactEmail;
      }
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
  } catch (err) {
    console.error('[ads] GET / error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Ads for feed: return ads with a reservation for a specific date (default: today), filtered by location radius
adsRouter.get('/for-feed', async (req, res) => {
  try {
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
      status: 'active',
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
    // Pre-resolve ad ZIP coordinates (with Google fallback for ZIPs not in static table)
    const adZipCoords = new Map<string, { lat: number; lon: number }>();
    const uniqueAdZips = [...new Set(ads.map(a => a.target_zip_code).filter(Boolean))] as string[];
    await Promise.all(uniqueAdZips.map(async (zip) => {
      const coords = await getZipCoordinatesWithFallback(zip);
      if (coords) adZipCoords.set(zip, coords);
    }));

    const filtered = ads.filter(ad => {
      if (!ad.target_zip_code) return false;
      const adCoords = adZipCoords.get(ad.target_zip_code);
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

    return res.json({
      date: dateISO,
      ads: result.map((ad) => ({
        id: ad.id,
        business_name: ad.business_name,
        banner_url: ad.banner_url,
        banner_fit_mode: ad.banner_fit_mode,
        target_url: ad.target_url,
        target_zip_code: ad.target_zip_code,
        radius: ad.radius,
        description: ad.description,
        status: ad.status,
        payment_status: ad.payment_status,
        created_at: ad.created_at,
      })),
    });
  } catch (err) {
    console.error('[ads] GET /for-feed error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single Ad with its reservations (dates)
adsRouter.get('/:id([a-z0-9]{15,50})', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id);
    const ad = await prisma.ad.findUnique({ where: { id } });
    if (!ad) return res.status(404).json({ error: 'Not found' });
    const isAdmin = await getIsAdmin(req);
    const isOwner = !!ad.user_id && ad.user_id === req.user!.id;
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' });
    const dates = await prisma.adReservation.findMany({ where: { ad_id: id }, orderBy: { date: 'asc' } });
    return res.json({ ...ad, dates: dates.map((r) => r.date.toISOString().slice(0, 10)) });
  } catch (err) {
    console.error('[ads] GET /:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update an Ad (owner-only if authenticated)
adsRouter.put('/:id([a-z0-9]{15,50})', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id);
    const ad = await prisma.ad.findUnique({ where: { id } });
    if (!ad) return res.status(404).json({ error: 'Ad not found' });
    if (ad.user_id !== req.user!.id) return res.status(403).json({ error: 'Not authorized' });
    const { payment_status, status: _status, ...safeBody } = req.body || {};
    const parsed = adUpdateSchema.safeParse(safeBody);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    // Only include fields that were explicitly provided in the request
    const data: Record<string, any> = {};
    for (const [k, v] of Object.entries(parsed.data)) {
      if (k in safeBody) data[k] = v;
    }

    // If banner_url changed, set status to pending for admin review
    const bannerChanged = 'banner_url' in data && data.banner_url !== ad.banner_url;
    if (bannerChanged && data.banner_url) {
      data.status = 'pending';
    }

    const updated = await prisma.ad.update({ where: { id }, data });

    // Notify admin when banner needs review
    if (bannerChanged && data.banner_url) {
      void sendAdPendingReviewEmail({
        to: 'emancero@varsityhub.app',
        businessName: updated.business_name || undefined,
        contactName: updated.contact_name || undefined,
        contactEmail: updated.contact_email || undefined,
        zipCode: updated.target_zip_code || undefined,
        bannerUrl: updated.banner_url ?? undefined,
        adId: updated.id,
      }).catch((err) => console.warn('[ads] Failed to send review email:', (err as any)?.message || err));
    }

    return res.json(updated);
  } catch (err) {
    console.error('[ads] PUT /:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete an Ad (owner-only if authenticated)
adsRouter.delete('/:id([a-z0-9]{15,50})', requireVerified as any, async (req: AuthedRequest, res) => {
  try {
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

    // First delete all reservations for this ad
    await prisma.adReservation.deleteMany({ where: { ad_id: id } });
    debugLog('[ads] DELETE /:id - Deleted reservations', { id });

    // Then delete the ad itself
    await prisma.ad.delete({ where: { id } });
    debugLog('[ads] DELETE /:id - Ad deleted successfully', { id });

    return res.json({ ok: true, message: 'Ad deleted successfully' });
  } catch (err) {
    console.error('[ads] DELETE /:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// List reserved dates. Supports optional range and/or specific ad_id.
adsRouter.get('/reservations', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
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
  } catch (err) {
    console.error('[ads] GET /reservations error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /ads/availability?zip=12345&from=2025-01-15&to=2025-01-31
 * 
 * Returns availability status for each date in the range.
 * Each date can have up to 3 ads (slots). If 3+ ads already exist, date is full.
 */
adsRouter.get('/availability', async (req, res) => {
  try {
    const zipCode = req.query.zip ? String(req.query.zip) : undefined;
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;

    if (!zipCode || !from || !to) {
      return res.status(400).json({ error: 'zip, from, and to are required' });
    }

    const MAX_ADS_PER_DATE = 2; // Maximum ad slots per date

    // Parse date range
    const fromDate = new Date(from + 'T00:00:00.000Z');
    const toDate = new Date(to + 'T00:00:00.000Z');

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    // Get all ads for this zip code (paid, hold, pending_approval all hold slots)
    const adsInZip = await prisma.ad.findMany({
      where: {
        target_zip_code: zipCode,
        payment_status: { in: ['paid', 'hold', 'pending_approval'] },
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
  } catch (err) {
    console.error('[ads] GET /availability error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit ad for approval (no charge). Admin must approve before user can pay.
// Creates reservations and holds slots. No payment until emancero@varsityhub.app approves.
// CUID format: 25 chars, [a-z0-9]. Broader regex for compatibility with Prisma cuid/cuid2.
adsRouter.post('/:id([a-z0-9]{15,50})/submit-for-approval', requireVerified as any, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id);
    const { dates } = req.body || {};
    if (!Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ error: 'dates[] is required' });
    }
    const isoDates = Array.from(new Set(dates.map((d: any) => String(d))));
    const ad = await prisma.ad.findUnique({ where: { id } });
    if (!ad) return res.status(404).json({ error: 'Ad not found' });
    if (ad.user_id !== req.user!.id) return res.status(403).json({ error: 'Not authorized' });
    if (ad.status !== 'draft') {
      return res.status(400).json({ error: `Ad status is '${ad.status}'. Submit for approval only from draft.` });
    }

    const MAX_AD_SLOTS = 2;
    if (ad.target_zip_code) {
      const reservedAdsInZip = await prisma.ad.findMany({
        where: {
          target_zip_code: ad.target_zip_code,
          payment_status: { in: ['paid', 'hold', 'pending_approval'] },
          NOT: { id },
        },
        select: { id: true },
        take: 100,
      });
      if (reservedAdsInZip.length > 0) {
        const dateObjects = isoDates.map((s) => new Date(s + 'T00:00:00.000Z'));
        const bookedSlots = await prisma.adReservation.groupBy({
          by: ['date'],
          where: { ad_id: { in: reservedAdsInZip.map((a) => a.id) }, date: { in: dateObjects } },
          _count: { date: true },
        });
        const fullDates = bookedSlots.filter((s) => s._count.date >= MAX_AD_SLOTS);
        if (fullDates.length > 0) {
          return res.status(409).json({
            error: 'One or more selected dates are fully booked',
            dates: fullDates.map((s) => s.date.toISOString().slice(0, 10)),
          });
        }
      }
    }

    await prisma.$transaction([
      prisma.ad.update({
        where: { id },
        data: { status: 'pending', payment_status: 'pending_approval' },
      }),
      prisma.adReservation.createMany({
        data: isoDates.map((s) => ({ ad_id: id, date: new Date(s + 'T00:00:00.000Z') })),
        skipDuplicates: true,
      }),
    ]);

    sendAdPendingReviewEmail({
      to: process.env.ADMIN_EMAILS?.split(',')[0]?.trim() || 'emancero@varsityhub.app',
      businessName: ad.business_name || undefined,
      contactName: ad.contact_name || undefined,
      contactEmail: ad.contact_email || undefined,
      zipCode: ad.target_zip_code || undefined,
      bannerUrl: ad.banner_url || undefined,
      adId: id,
    }).catch((err) => console.warn('[ads] submit-for-approval email failed:', (err as any)?.message || err));

    const updated = await prisma.ad.findUnique({ where: { id }, include: { reservations: true } });
    return res.status(201).json(updated);
  } catch (err) {
    console.error('[ads] POST /:id/submit-for-approval error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create reservation for a set of dates (yyyy-MM-dd strings)
// SECURITY: Reservations must be created via payment flow (checkout/webhook). This endpoint
// previously allowed adding free dates to paid ads. Use 403 (not 410) so clients don't cache
// a permanent "gone" — endpoint may be repurposed; test-email-queue.sh previously used it.
adsRouter.post('/reservations', requireVerified as any, async (_req: AuthedRequest, res) => {
  return res.status(403).json({
    error: 'RESERVATIONS_VIA_CHECKOUT_ONLY',
    message: 'Ad reservations must be created through the payment checkout flow. Use the Ad Calendar to select dates and pay.',
  });
});

/**
 * GET /ads/alternative-zips?zip=12345&dates=2025-01-15,2025-01-16
 * 
 * Find alternative zip codes within 50 miles when the requested zip is fully booked.
 * Returns nearby zips with availability for the requested dates, sorted by distance.
 */
adsRouter.get('/alternative-zips', async (req: AuthedRequest, res) => {
  try {
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

    // Pre-resolve unique ad ZIP coordinates (with Google fallback)
    const uniqueZips = [...new Set(allAds.map(a => a.target_zip_code).filter(Boolean))] as string[];
    const adZipMap = new Map<string, { lat: number; lon: number }>();
    await Promise.all(uniqueZips.map(async (z) => {
      const coords = await getZipCoordinatesWithFallback(z);
      if (coords) adZipMap.set(z, coords);
    }));

    for (const ad of allAds) {
      if (!ad.target_zip_code) continue;
      if (ad.target_zip_code === zipCode) continue;
      if (zipDistances.has(ad.target_zip_code)) continue;

      const adCoords = adZipMap.get(ad.target_zip_code);
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
  } catch (err) {
    console.error('[ads] GET /alternative-zips error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Approve a pending ad — sets status to 'approved' (user must pay before ad goes live)
// No one is charged until approved by emancero@varsityhub.app
adsRouter.post('/:id([a-z0-9-]{20,40})/approve', requireAdmin as any, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id);
    const ad = await prisma.ad.findUnique({ where: { id } });
    if (!ad) return res.status(404).json({ error: 'Ad not found' });
    if (ad.status !== 'pending') return res.status(400).json({ error: `Ad status is '${ad.status}', not 'pending'` });

    const updated = await prisma.ad.update({
      where: { id },
      data: { status: 'approved' },
    });

    if (ad.contact_email) {
      sendAdApprovedEmail({
        to: ad.contact_email,
        businessName: ad.business_name || undefined,
      }).catch((err) => console.warn('[ads] approve email failed:', (err as any)?.message || err));
    }
    return res.json(updated);
  } catch (err) {
    console.error('[ads] POST /:id/approve error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Reject a pending ad — clears reservations, back to draft
adsRouter.post('/:id([a-z0-9]{15,50})/reject', requireAdmin as any, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id);
    const ad = await prisma.ad.findUnique({ where: { id } });
    if (!ad) return res.status(404).json({ error: 'Ad not found' });

    await prisma.$transaction([
      prisma.adReservation.deleteMany({ where: { ad_id: id } }),
      prisma.ad.update({
        where: { id },
        data: { status: 'draft', payment_status: 'unpaid' },
      }),
    ]);

    if (ad.contact_email) {
      sendAdRejectedEmail({ to: ad.contact_email, businessName: ad.business_name || undefined }).catch((err) =>
        console.warn('[ads] reject email failed:', (err as any)?.message || err)
      );
    }
    const updated = await prisma.ad.findUnique({ where: { id } });
    return res.json(updated);
  } catch (err) {
    console.error('[ads] POST /:id/reject error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Review an ad (approve or reject) — used by admin-ads screen
adsRouter.post('/:id([a-z0-9]{15,50})/review', requireAdmin as any, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id);
    const action = req.body?.action;
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ error: 'action must be "approve" or "reject"' });
    }
    const ad = await prisma.ad.findUnique({ where: { id } });
    if (!ad) return res.status(404).json({ error: 'Ad not found' });
    if (ad.status !== 'pending') return res.status(400).json({ error: `Ad status is '${ad.status}', not 'pending'` });

    if (action === 'approve') {
      const updated = await prisma.ad.update({ where: { id }, data: { status: 'approved' } });
      if (ad.contact_email) {
        sendAdApprovedEmail({ to: ad.contact_email, businessName: ad.business_name || undefined }).catch((err) =>
          console.warn('[ads] approve email failed:', (err as any)?.message || err)
        );
      }
      return res.json(updated);
    } else {
      await prisma.$transaction([
        prisma.adReservation.deleteMany({ where: { ad_id: id } }),
        prisma.ad.update({ where: { id }, data: { status: 'draft', payment_status: 'unpaid' } }),
      ]);
      if (ad.contact_email) {
        sendAdRejectedEmail({ to: ad.contact_email, businessName: ad.business_name || undefined }).catch((err) =>
          console.warn('[ads] reject email failed:', (err as any)?.message || err)
        );
      }
      const updated = await prisma.ad.findUnique({ where: { id } });
      return res.json(updated);
    }
  } catch (err) {
    console.error('[ads] POST /:id/review error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
