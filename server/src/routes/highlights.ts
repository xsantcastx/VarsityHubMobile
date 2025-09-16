import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const highlightsRouter = Router();

// GET /highlights?zip=90210&country=US&lat=..&lng=..&limit=20
highlightsRouter.get('/', requireAuth as any, async (req: AuthedRequest, res) => {
  const limit = Math.min(parseInt(String((req.query as any).limit || '30'), 10) || 30, 50);
  const country = String((req.query as any).country || 'US').toUpperCase();
  const lat = (req.query as any).lat != null ? Number((req.query as any).lat) : undefined;
  const lng = (req.query as any).lng != null ? Number((req.query as any).lng) : undefined;
  const v2 = String((req.query as any).v2 || '').trim() === '1';
  const SINCE_DAYS = v2 ? 60 : 30;
  const since = new Date(Date.now() - SINCE_DAYS * 864e5);
  const RADIUS_KM = 80;

  const baseSelect = {
    id: true, title: true, content: true, media_url: true,
    upvotes_count: true, created_at: true, author_id: true,
    author: { select: { id: true, display_name: true, avatar_url: true } },
    lat: true, lng: true, country_code: true,
    _count: { select: { comments: true } },
  } as const;

  // Top 3 national
  let nationalTop = await prisma.post.findMany({
    where: { country_code: country, created_at: { gte: since } },
    orderBy: [{ upvotes_count: 'desc' }, { created_at: 'desc' }],
    take: 3,
    select: baseSelect,
  });
  if (nationalTop.length < 3) {
    const fill = await prisma.post.findMany({
      where: { created_at: { gte: since }, id: { notIn: nationalTop.map((p) => p.id) } },
      orderBy: [{ upvotes_count: 'desc' }, { created_at: 'desc' }],
      take: 3 - nationalTop.length,
      select: baseSelect,
    });
    nationalTop = nationalTop.concat(fill);
  }

  if (!v2) {
    // Legacy response: return 'local' list ranked only by upvotes
    let local: any[] = [];
    if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      const kmPerDegLat = 110.574;
      const kmPerDegLng = 111.320 * Math.cos((lat * Math.PI) / 180);
      const dLat = RADIUS_KM / kmPerDegLat;
      const dLng = RADIUS_KM / kmPerDegLng;
      local = await prisma.post.findMany({
        where: { created_at: { gte: since }, country_code: country, lat: { gte: lat - dLat, lte: lat + dLat }, lng: { gte: lng - dLng, lte: lng + dLng } },
        orderBy: [{ upvotes_count: 'desc' }, { created_at: 'desc' }],
        take: Math.min(limit, 50),
        select: baseSelect,
      });
    } else {
      local = await prisma.post.findMany({
        where: { country_code: country, created_at: { gte: since } },
        orderBy: [{ upvotes_count: 'desc' }, { created_at: 'desc' }],
        take: Math.min(limit, 50),
        select: baseSelect,
      });
    }
    res.set('Cache-Control', 'no-store, private');
    return res.json({ nationalTop, local });
  }

  // v2 ranked mix
  const ids3 = nationalTop.map((p) => p.id);

  // Candidate pool
  const pool = await prisma.post.findMany({
    where: { country_code: country, created_at: { gte: since }, id: { notIn: ids3 } },
    orderBy: [{ created_at: 'desc' }],
    take: 200,
    select: baseSelect,
  });

  // Local bbox predicate
  let isLocal: (p: any) => boolean = () => false;
  if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    const kmPerDegLat = 110.574;
    const kmPerDegLng = 111.320 * Math.cos((lat * Math.PI) / 180);
    const dLat = RADIUS_KM / kmPerDegLat;
    const dLng = RADIUS_KM / kmPerDegLng;
    isLocal = (p: any) => typeof p.lat === 'number' && typeof p.lng === 'number' && p.lat >= lat - dLat && p.lat <= lat + dLat && p.lng >= lng - dLng && p.lng <= lng + dLng;
  }

  // Followed authors
  const follows = await prisma.follows.findMany({ where: { follower_id: req.user!.id }, select: { following_id: true } });
  const followedSet = new Set(follows.map((f) => f.following_id));

  function recencyBoost(d: Date) {
    const ageDays = (Date.now() - new Date(d).getTime()) / 864e5;
    if (ageDays <= 1) return 7;
    if (ageDays <= 7) return 3;
    return 1;
  }

  const ranked = pool
    .map((p: any) => ({
      ...p,
      _score: (p.upvotes_count || 0) * 2 + (followedSet.has(p.author_id) ? 6 : 0) + (isLocal(p) ? 4 : 0) + recencyBoost(p.created_at),
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);

  res.set('Cache-Control', 'no-store, private');
  return res.json({ nationalTop, ranked });
});
