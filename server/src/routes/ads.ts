import escapeHtml from 'escape-html';
import { Router, type Response, type NextFunction } from 'express';
import { getZipCoordinates, haversineDistance } from '../lib/geoUtils.js';
import { geocodeLocation } from '../lib/geocoding.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { getIsAdmin, isEmailAdmin, requireAdmin } from '../middleware/requireAdmin.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireOnboarded } from '../middleware/requireOnboarded.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { debugLog } from '../lib/debugLog.js';
import { adCreationLimiter, alternativeZipsLimiter } from '../middleware/rateLimiters.js';
import { sendAdApprovedEmail, sendAdPendingReviewEmail, sendAdRejectedEmail } from '../lib/email.js';
import { signJwt, verifyJwt } from '../lib/jwt.js';
import { sendPushNotification } from '../lib/notifications.js';
import { z } from 'zod';
import { registerIdValidation } from '../middleware/validateParams.js';

const adCreateSchema = z.object({
  contact_name: z.string().min(1).max(200),
  contact_email: z.string().email().max(320),
  business_name: z.string().min(1).max(200),
  banner_url: z.string().url().max(2048).nullish(),
  banner_fit_mode: z.enum(['cover', 'contain', 'fill']).nullish(),
  target_url: z.string().url().max(2048).refine(
    (url) => /^https:\/\//i.test(url),
    { message: 'target_url must use https protocol' }
  ).nullish(),
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
  target_url: z.string().url().max(2048).refine(
    (url) => /^https:\/\//i.test(url),
    { message: 'target_url must use https protocol' }
  ).nullish(),
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
registerIdValidation(adsRouter);

// One-time backfill: populate target_lat/target_lng for existing ads that predate the column.
// Runs once at startup, fire-and-forget — safe to repeat (skips ads already populated).
void (async () => {
  try {
    const unresolved = await prisma.ad.findMany({
      where: { target_zip_code: { not: null }, target_lat: null },
      select: { id: true, target_zip_code: true },
      take: 500,
    });
    if (unresolved.length === 0) return;
    console.log(`[ads] backfill: resolving coords for ${unresolved.length} ads`);
    // Deduplicate by zip code — fetch coords once per unique zip, then batch update
    const uniqueZips = [...new Set(unresolved.map((a) => a.target_zip_code!))];
    const coordsByZip = new Map<string, { lat: number; lon: number }>();
    for (const zip of uniqueZips) {
      const coords = await getZipCoordinatesWithFallback(zip);
      if (coords) coordsByZip.set(zip, coords);
    }
    // Group ads by zip and batch-update in chunks of 100
    const BATCH = 100;
    const updates = unresolved.filter((a) => coordsByZip.has(a.target_zip_code!));
    for (let i = 0; i < updates.length; i += BATCH) {
      const chunk = updates.slice(i, i + BATCH);
      await prisma.$transaction(
        chunk.map((ad) => {
          const c = coordsByZip.get(ad.target_zip_code!)!;
          return prisma.ad.update({ where: { id: ad.id }, data: { target_lat: c.lat, target_lng: c.lon } });
        })
      );
    }
    console.log('[ads] backfill: done');
  } catch (err) {
    console.warn('[ads] backfill failed (non-fatal):', (err as any)?.message || err);
  }
})();

// Create an Ad — requires Veteran/Legend plan or admin
adsRouter.post('/', requireVerified as any, requireOnboarded as any, adCreationLimiter, async (req: AuthedRequest, res) => {
  try {
    // Role gate: only Veteran/Legend subscribers or admins can create ads
    if (req.user?.id) {
      const adUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true, email: true } });
      const plan = String((adUser?.preferences as any)?.plan || '').toLowerCase();
      const isAdAdmin = isEmailAdmin(adUser?.email);
      if (!isAdAdmin && plan !== 'veteran' && plan !== 'legend') {
        return res.status(403).json({ error: 'Ad creation requires a Veteran or Legend subscription.', code: 'PLAN_REQUIRED' });
      }
    }

    const { payment_status: _ps, status: _st, ...safeBody } = req.body || {};
    const parsed = adCreateSchema.safeParse(safeBody);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const { contact_name, contact_email, business_name, banner_url, banner_fit_mode, target_url, target_zip_code, description } = parsed.data;
    const zipCoords = await getZipCoordinatesWithFallback(target_zip_code);
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
        target_lat: zipCoords?.lat ?? null,
        target_lng: zipCoords?.lon ?? null,
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

// Submit ad for approval — handler exported for app-level registration (guarantees route is hit)
export async function handleAdSubmitForApproval(req: AuthedRequest, res: Response) {
  try {
    const id = String(req.params.id).trim();
    if (!id || id.length < 10 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return res.status(400).json({ error: 'Invalid ad ID' });
    }
    const { dates } = req.body || {};
    if (!Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ error: 'dates[] is required' });
    }
    if (dates.length > 30) {
      return res.status(400).json({ error: 'Maximum 30 dates per booking' });
    }
    // Validate each date is a valid ISO date string (YYYY-MM-DD)
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const today = new Date().toISOString().slice(0, 10);
    for (const d of dates) {
      const ds = String(d);
      if (!isoDateRegex.test(ds)) {
        return res.status(400).json({ error: `Invalid date format: ${ds}. Use YYYY-MM-DD.` });
      }
      // Past dates are allowed for booking
    }
    const isoDates = Array.from(new Set(dates.map((d: any) => String(d))));
    const ad = await prisma.ad.findUnique({ where: { id } });
    if (!ad) return res.status(404).json({ error: 'Ad not found' });
    if (ad.user_id !== req.user!.id) return res.status(403).json({ error: 'Not authorized' });
    if (ad.status !== 'draft') {
      return res.status(400).json({ error: `Ad status is '${ad.status}'. Submit for approval only from draft.` });
    }

    // Enforce booking horizon — dates must be within 56 days from today
    const MAX_BOOKING_HORIZON_DAYS = 56;
    const horizonCutoff = new Date();
    horizonCutoff.setDate(horizonCutoff.getDate() + MAX_BOOKING_HORIZON_DAYS);
    const pastHorizon = isoDates.filter(d => new Date(d + 'T00:00:00.000Z') > horizonCutoff);
    if (pastHorizon.length > 0) {
      return res.status(400).json({
        error: `Dates must be within ${MAX_BOOKING_HORIZON_DAYS} days from today`,
        dates: pastHorizon,
      });
    }
    // Past dates are allowed — no rejection needed

    const MAX_AD_SLOTS = 2;
    const dateObjects = isoDates.map((s) => new Date(s + 'T00:00:00.000Z'));

    // Slot check + reservation creation inside Serializable transaction to prevent race condition
    const slotResult = await prisma.$transaction(async (tx) => {
      if (ad.target_zip_code) {
        const reservedAdsInZip = await tx.ad.findMany({
          where: {
            target_zip_code: ad.target_zip_code,
            payment_status: { in: ['paid', 'hold', 'pending_approval'] },
            NOT: { id },
          },
          select: { id: true },
          take: 100,
        });
        if (reservedAdsInZip.length > 0) {
          const bookedSlots = await tx.adReservation.groupBy({
            by: ['date'],
            where: { ad_id: { in: reservedAdsInZip.map((a: any) => a.id) }, date: { in: dateObjects } },
            _count: { date: true },
          });
          const fullDates = bookedSlots.filter((s: any) => s._count.date >= MAX_AD_SLOTS);
          if (fullDates.length > 0) {
            return { error: true, dates: fullDates.map((s: any) => s.date.toISOString().slice(0, 10)) };
          }
        }
      }
      await tx.ad.update({
        where: { id },
        data: { status: 'pending', payment_status: 'pending_approval' },
      });
      await tx.adReservation.createMany({
        data: dateObjects.map((d) => ({ ad_id: id, date: d })),
        skipDuplicates: true,
      });
      return { error: false };
    }, { isolationLevel: 'Serializable' as any });

    if (slotResult.error) {
      return res.status(409).json({
        error: 'One or more selected dates are fully booked',
        dates: (slotResult as any).dates,
      });
    }

    // Generate signed tokens for one-click approve/reject from email (7-day expiry)
    const approveToken = signJwt({ adId: id, action: 'approve_ad' }, '7d');
    const rejectToken = signJwt({ adId: id, action: 'reject_ad' }, '7d');

    // Ad approval emails always go to emancero@varsityhub.app (primary admin)
    sendAdPendingReviewEmail({
      to: (process.env.ADMIN_EMAILS?.split(',')[0]?.trim() || 'emancero@varsityhub.app'),
      businessName: ad.business_name || undefined,
      contactName: ad.contact_name || undefined,
      contactEmail: ad.contact_email || undefined,
      zipCode: ad.target_zip_code || undefined,
      bannerUrl: ad.banner_url || undefined,
      adId: id,
      approveToken,
      rejectToken,
    }).then((sent) => {
      if (!sent) console.error('[ads] submit-for-approval email returned false — email NOT delivered for ad', id);
    }).catch((err) => console.error('[ads] submit-for-approval email failed:', (err as any)?.message || err));

    const updated = await prisma.ad.findUnique({ where: { id }, include: { reservations: true } });
    return res.status(200).json(updated);
  } catch (err) {
    console.error('[ads] POST /:id/submit-for-approval error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

adsRouter.post('/:id/submit-for-approval', requireVerified as any, requireOnboarded as any, handleAdSubmitForApproval);

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

    // If no user location, return empty — no untargeted/national ads
    if (!userCoords) {
      return res.json({ date: dateISO, ads: [] });
    }

    // DB-level bounding box: ~9 miles in each direction (0.13° lat ≈ 9mi, 0.15° lng ≈ 9mi at US latitudes)
    // This dramatically reduces rows fetched before the precise Haversine JS filter below.
    // Ads created before this column was added (target_lat IS NULL) fall back to JS-only filtering.
    const BBOX_LAT = 0.13;
    const BBOX_LNG = 0.15;
    const whereAd: any = {
      payment_status: 'paid',
      status: 'active',
      target_zip_code: { not: null },
      OR: [
        {
          target_lat: { gte: userCoords.lat - BBOX_LAT, lte: userCoords.lat + BBOX_LAT },
          target_lng: { gte: userCoords.lon - BBOX_LNG, lte: userCoords.lon + BBOX_LNG },
        },
        { target_lat: null }, // legacy ads without pre-computed coords
      ],
    };

    debugLog('[ads] for-feed where clause for ads:', whereAd);

    const ads = await prisma.ad.findMany({
      where: {
        ...whereAd,
        reservations: {
          some: { date: { gte: start, lt: next } },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 20,
      include: {
        reservations: true,
      },
    });

    // Precise Haversine filter on the smaller bounding-box result set.
    // Also handles legacy ads (target_lat IS NULL) by resolving their ZIP on the fly.
    const adZipCoords = new Map<string, { lat: number; lon: number }>();
    const uniqueAdZips = [...new Set(ads.map(a => a.target_zip_code).filter(Boolean))] as string[];
    await Promise.all(uniqueAdZips.map(async (zip) => {
      const coords = await getZipCoordinatesWithFallback(zip);
      if (coords) adZipCoords.set(zip, coords);
    }));

    const filtered = ads.filter(ad => {
      if (!ad.target_zip_code) return false;
      // Prefer stored coords; fall back to ZIP lookup for legacy ads
      const adCoords = ad.target_lat != null && ad.target_lng != null
        ? { lat: ad.target_lat, lon: ad.target_lng }
        : adZipCoords.get(ad.target_zip_code);
      if (!adCoords) return false;
      const dist = haversineDistance(userCoords!.lat, userCoords!.lon, adCoords.lat, adCoords.lon);
      return dist <= 5.59; // 9km radius (5.59 miles)
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

    // Populate lat/lng when zip code changes
    if ('target_zip_code' in data && data.target_zip_code) {
      const zipCoords = await getZipCoordinatesWithFallback(data.target_zip_code);
      data.target_lat = zipCoords?.lat ?? null;
      data.target_lng = zipCoords?.lon ?? null;
    }

    // If banner_url or target_url changed, ALWAYS require re-approval regardless of payment status
    const bannerChanged = 'banner_url' in data && data.banner_url !== ad.banner_url;
    const targetUrlChanged = 'target_url' in data && data.target_url !== ad.target_url;
    if ((bannerChanged && data.banner_url) || targetUrlChanged) {
      data.status = 'pending';
      data.admin_note = `[Auto] Content changed${ad.payment_status === 'paid' ? ' after payment' : ''} — banner: ${bannerChanged}, target_url: ${targetUrlChanged}. Ad removed from feed pending re-approval.`;
    }

    const updated = await prisma.ad.update({ where: { id }, data });

    // Notify admin when banner or target URL needs review
    if ((bannerChanged && data.banner_url) || targetUrlChanged) {
      void sendAdPendingReviewEmail({
        to: 'emancero@varsityhub.app',
        businessName: updated.business_name || undefined,
        contactName: updated.contact_name || undefined,
        contactEmail: updated.contact_email || undefined,
        zipCode: updated.target_zip_code || undefined,
        bannerUrl: updated.banner_url ?? undefined,
        adId: updated.id,
      }).then((sent) => {
        if (!sent) console.error('[ads] review email returned false — email NOT delivered for ad', updated.id);
      }).catch((err) => console.error('[ads] Failed to send review email:', (err as any)?.message || err));
    }

    return res.json(updated);
  } catch (err) {
    console.error('[ads] PUT /:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete an Ad (owner-only if authenticated)
adsRouter.delete('/:id([a-z0-9]{15,50})', requireVerified as any, requireOnboarded as any, async (req: AuthedRequest, res) => {
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

    // Capture ad details for audit before deletion
    const auditData = {
      ad_id: id,
      business_name: existing.business_name,
      status: existing.status,
      payment_status: existing.payment_status,
      target_zip_code: existing.target_zip_code,
      deleted_by: req.user?.id,
      deleted_by_admin: isAdmin && !isOwner,
    };

    // Delete reservations and ad in transaction, create audit log
    await prisma.$transaction([
      prisma.adReservation.deleteMany({ where: { ad_id: id } }),
      prisma.ad.delete({ where: { id } }),
      prisma.transactionLog.create({
        data: {
          transaction_type: 'AD_DELETED',
          status: 'COMPLETED',
          user_id: req.user?.id || null,
          order_id: `ad_delete_${id}`,
          metadata: auditData,
        },
      }),
    ]);
    debugLog('[ads] DELETE /:id - Ad deleted with audit trail', { id });

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

    // IDOR fix: when ad_id provided, verify ownership (or admin)
    if (adId) {
      const ad = await prisma.ad.findUnique({ where: { id: adId }, select: { user_id: true } });
      if (!ad) return res.status(404).json({ error: 'Ad not found' });
      const isAdmin = await getIsAdmin(req as any);
      if (ad.user_id !== req.user?.id && !isAdmin) {
        return res.status(403).json({ error: 'You can only view reservations for your own ads' });
      }
    }

    const where: any = {};
    if (from || to) where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
    if (adId) {
      where.ad_id = adId;
    } else {
      // No ad_id: scope to the requesting user's own ads only
      const isAdmin = await getIsAdmin(req as any);
      if (!isAdmin) {
        where.ad = { user_id: req.user!.id };
      }
    }

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
    const zipCode = req.query.zip ? String(req.query.zip) : req.query.zip_code ? String(req.query.zip_code) : undefined;
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;
    const excludeAdId = req.query.exclude_ad_id ? String(req.query.exclude_ad_id) : undefined;

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
    // Optionally exclude a specific ad (so editing an ad doesn't block its own dates)
    const adsInZip = await prisma.ad.findMany({
      where: {
        target_zip_code: zipCode,
        payment_status: { in: ['paid', 'hold', 'pending_approval'] },
        ...(excludeAdId ? { id: { not: excludeAdId } } : {}),
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
  } catch (err) {
    console.error('[ads] GET /availability error:', err);
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
adsRouter.get('/alternative-zips', requireAuth as any, alternativeZipsLimiter, async (req: AuthedRequest, res) => {
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

    // Get ads that actually hold slots (active + paid/hold/pending_approval).
    // Draft ads have no reservations and shouldn't affect availability checks.
    const allAds = await prisma.ad.findMany({
      where: {
        status: 'active',
        payment_status: { in: ['paid', 'hold', 'pending_approval'] },
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
        status: 'active',
        payment_status: { in: ['paid', 'hold', 'pending_approval'] },
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

// ── Shared helpers for ad moderation (used by POST, GET, and /review routes) ──

async function approveAd(id: string, note?: string | null) {
  const ad = await prisma.ad.findUnique({ where: { id } });
  if (!ad) return { error: 'Ad not found', status: 404 };
  if (ad.status !== 'pending') return { error: `Ad status is '${ad.status}', not 'pending'`, status: 400 };

  const updated = await prisma.ad.update({
    where: { id },
    data: {
      status: 'approved',
      // Keep payment_status as pending_approval so reservations stay visible to
      // the availability checker until user actually pays
      payment_status: ad.payment_status === 'paid' ? 'paid' : 'pending_approval',
      ...(note ? { admin_note: note } : {}),
    },
  });

  // Notify the ad owner — email, push, and in-app notification
  if (ad.contact_email) {
    try {
      const sent = await sendAdApprovedEmail({ to: ad.contact_email, businessName: ad.business_name || undefined, note: note || undefined });
      if (!sent) console.warn('[ads] approve email template failed for', ad.contact_email);
    } catch (err) {
      console.error('[ads] approve email error:', (err as any)?.message || err);
    }
  }
  if (ad.user_id) {
    try {
      await sendPushNotification(
        ad.user_id,
        'Ad Approved!',
        `Your ad for "${ad.business_name || 'your business'}" has been approved. Tap to complete payment.`,
        { type: 'ad_approved', ad_id: id }
      );
    } catch (err) {
      console.warn('[ads] push notification failed:', (err as any)?.message || err);
    }
    try {
      await prisma.notification.create({
        data: { user_id: ad.user_id, type: 'AD_APPROVED' as any, meta: { ad_id: id, business_name: ad.business_name } },
      });
    } catch (err) {
      console.error('[ads] FAILED to create in-app notification:', (err as any)?.message || err);
    }
  }

  return { ad: updated };
}

async function rejectAd(id: string, reason?: string | null) {
  const ad = await prisma.ad.findUnique({ where: { id } });
  if (!ad) return { error: 'Ad not found', status: 404 };
  if (ad.status !== 'pending') return { error: `Ad status is '${ad.status}', not 'pending'`, status: 400 };

  await prisma.$transaction([
    prisma.adReservation.deleteMany({ where: { ad_id: id } }),
    prisma.ad.update({
      where: { id },
      data: { status: 'draft', payment_status: 'unpaid', ...(reason ? { admin_note: reason } : {}) },
    }),
  ]);

  if (ad.contact_email) {
    sendAdRejectedEmail({ to: ad.contact_email, businessName: ad.business_name || undefined, reason: reason || undefined })
      .catch((err) => console.warn('[ads] reject email failed:', (err as any)?.message || err));
  }

  // Push notification + in-app notification for ad owner
  if (ad.user_id) {
    try {
      await sendPushNotification(
        ad.user_id,
        'Ad Needs Changes',
        `Your ad for "${ad.business_name || 'your business'}" was not approved.${reason ? ` Reason: ${reason}` : ' Please review and resubmit.'}`,
        { type: 'ad_rejected', ad_id: id }
      );
    } catch (err) {
      console.warn('[ads] reject push notification failed:', (err as any)?.message || err);
    }
    try {
      await prisma.notification.create({
        data: { user_id: ad.user_id, type: 'AD_REJECTED' as any, meta: { ad_id: id, business_name: ad.business_name, reason: reason || null } },
      });
    } catch (err) {
      console.error('[ads] FAILED to create ad rejected in-app notification:', (err as any)?.message || err);
    }
  }

  const updated = await prisma.ad.findUnique({ where: { id } });
  return { ad: updated };
}

/** Verify a signed moderation token and check it matches the ad + action */
function verifyModerationToken(token: string, adId: string, expectedAction: string): boolean {
  const payload = verifyJwt<{ adId: string; action: string }>(token);
  return !!payload && payload.adId === adId && payload.action === expectedAction;
}

/** Simple HTML result page — title and message must be pre-escaped via escapeHtml() before calling */
function confirmationPage(safeTitle: string, safeMessage: string, success: boolean) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:60px auto;padding:20px;text-align:center;">
<h2 style="color:${success ? '#16A34A' : '#DC2626'};">${safeTitle}</h2>
<p style="color:#374151;">${safeMessage}</p>
<p style="margin-top:24px;"><a href="${process.env.APP_BASE_URL || 'https://varsityhub.app'}" style="color:#1B3A6B;">Return to VarsityHub</a></p>
</body></html>`;
}

/** Require auth only when no moderation token is present (email links skip auth) */
function requireAuthUnlessToken(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.query?.token) return next();
  return requireAuth(req, res, next);
}

/** HTML confirmation form — safeName must be pre-escaped via escapeHtml() before calling */
function confirmationForm(action: string, adId: string, token: string, safeName: string) {
  const color = action === 'approve' ? '#16A34A' : '#DC2626';
  const verb = action === 'approve' ? 'Approve' : 'Reject';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${verb} Ad</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:60px auto;padding:20px;text-align:center;">
<h2>${verb} this ad?</h2>
<p style="color:#374151;">Ad: <strong>${safeName}</strong></p>
<form method="POST" action="?token=${encodeURIComponent(token)}">
<button type="submit" style="background:${color};color:#fff;border:none;padding:12px 32px;border-radius:8px;font-size:16px;cursor:pointer;margin-top:16px;">${verb} Ad</button>
</form>
<p style="margin-top:24px;color:#9CA3AF;font-size:12px;">Click the button to confirm. This link is single-use.</p>
</body></html>`;
}

// Admin: Approve a pending ad
// GET with token → shows confirmation form (safe from email scanners)
// POST with token → performs the approval
// POST with admin auth → performs the approval (admin dashboard)
async function handleAdApprove(req: AuthedRequest, res: Response) {
  try {
    const id = String(req.params.id);
    const token = (req.query?.token as string) || undefined;

    if (token) {
      if (!verifyModerationToken(token, id, 'approve_ad')) {
        return req.method === 'GET'
          ? res.status(401).send(confirmationPage('Invalid Link', 'This approval link is invalid or has expired.', false))
          : res.status(401).json({ error: 'Invalid or expired approval token' });
      }
      // GET: show confirmation form, don't perform the action
      if (req.method === 'GET') {
        const ad = await prisma.ad.findUnique({ where: { id }, select: { business_name: true } });
        return res.send(confirmationForm('approve', id, token, escapeHtml(ad?.business_name || 'Unknown')));
      }
    } else {
      const isAdmin = await getIsAdmin(req);
      if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    }

    const result = await approveAd(id, typeof req.body?.note === 'string' ? req.body.note.trim() : null);
    if (result.error) {
      return req.method === 'POST' && token
        ? res.status(result.status!).send(confirmationPage('Error', escapeHtml(result.error), false))
        : res.status(result.status!).json({ error: result.error });
    }

    return req.method === 'POST' && token
      ? res.send(confirmationPage('Ad Approved', 'The ad has been approved. The advertiser has been notified.', true))
      : res.json(result.ad);
  } catch (err) {
    console.error('[ads] approve error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

adsRouter.get('/:id([a-z0-9]{15,50})/approve', authMiddleware as any, handleAdApprove as any);
adsRouter.post('/:id([a-z0-9]{15,50})/approve', requireAuthUnlessToken as any, handleAdApprove as any);

// Admin: Reject a pending ad (same confirmation-form pattern as approve)
async function handleAdReject(req: AuthedRequest, res: Response) {
  try {
    const id = String(req.params.id);
    const token = (req.query?.token as string) || undefined;

    if (token) {
      if (!verifyModerationToken(token, id, 'reject_ad')) {
        return req.method === 'GET'
          ? res.status(401).send(confirmationPage('Invalid Link', 'This rejection link is invalid or has expired.', false))
          : res.status(401).json({ error: 'Invalid or expired rejection token' });
      }
      if (req.method === 'GET') {
        const ad = await prisma.ad.findUnique({ where: { id }, select: { business_name: true } });
        return res.send(confirmationForm('reject', id, token, escapeHtml(ad?.business_name || 'Unknown')));
      }
    } else {
      const isAdmin = await getIsAdmin(req);
      if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    }

    const result = await rejectAd(id, req.body?.reason || (req.query?.reason as string) || null);
    if (result.error) {
      return req.method === 'POST' && token
        ? res.status(result.status!).send(confirmationPage('Error', escapeHtml(result.error), false))
        : res.status(result.status!).json({ error: result.error });
    }

    return req.method === 'POST' && token
      ? res.send(confirmationPage('Ad Rejected', 'The ad has been rejected and the advertiser has been notified.', true))
      : res.json(result.ad);
  } catch (err) {
    console.error('[ads] reject error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

adsRouter.get('/:id([a-z0-9]{15,50})/reject', authMiddleware as any, handleAdReject as any);
adsRouter.post('/:id([a-z0-9]{15,50})/reject', requireAuthUnlessToken as any, handleAdReject as any);

// Admin: Review an ad (approve or reject) — used by admin-ads screen
adsRouter.post('/:id([a-z0-9]{15,50})/review', requireAdmin as any, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id);
    const reviewSchema = z.object({
      action: z.enum(['approve', 'reject']),
      note: z.string().max(2000).optional(),
    });
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    const { action, note: rawNote } = parsed.data;
    const note = rawNote?.trim() || null;

    if (action === 'approve') {
      const result = await approveAd(id, note);
      if (result.error) return res.status(result.status!).json({ error: result.error });
      return res.json(result.ad);
    } else {
      const result = await rejectAd(id, note);
      if (result.error) return res.status(result.status!).json({ error: result.error });
      return res.json(result.ad);
    }
  } catch (err) {
    console.error('[ads] POST /:id/review error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
