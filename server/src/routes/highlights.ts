import { Router } from 'express';
import { highlightPostSelect } from '../lib/highlightPostSelect.js';
import { sendError } from '../lib/http/sendError.js';
import { detectMediaType, getVideoPreviewUrl } from '../lib/mediaUtils.js';
import { prisma } from '../lib/prisma.js';
import {
  getBlockedUserIds,
  getExcludedPrivateAuthorIds,
  getRequestBlockedCache,
} from '../lib/privacyUtils.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';

export const highlightsRouter = Router();

const withMediaPreview = (post: any) => ({
  ...post,
  media_type: detectMediaType(post.media_url),
  preview_url: getVideoPreviewUrl(post.media_url),
});

/**
 * Per-user interaction state for a set of posts. Without this the /highlights
 * payload omits has_upvoted/has_bookmarked, so the client defaults them to false
 * on every refetch and a filled upvote arrow visibly reverts. Mirrors the
 * posts-list endpoints (see routes/posts.ts).
 */
async function getInteractionSets(
  userId: string | null | undefined,
  postIds: string[]
): Promise<{ upvotedIds: Set<string>; bookmarkedIds: Set<string> }> {
  if (!userId || postIds.length === 0) {
    return { upvotedIds: new Set(), bookmarkedIds: new Set() };
  }
  const [upvotes, bookmarks] = await Promise.all([
    prisma.postUpvote.findMany({
      where: { user_id: userId, post_id: { in: postIds } },
      select: { post_id: true },
      take: postIds.length,
    }),
    prisma.postBookmark.findMany({
      where: { user_id: userId, post_id: { in: postIds } },
      select: { post_id: true },
      take: postIds.length,
    }),
  ]);
  return {
    upvotedIds: new Set(upvotes.map(u => u.post_id)),
    bookmarkedIds: new Set(bookmarks.map(b => b.post_id)),
  };
}

const withInteractions = (upvotedIds: Set<string>, bookmarkedIds: Set<string>) => (post: any) => ({
  ...withMediaPreview(post),
  bookmarks_count: post._count?.bookmarks ?? 0,
  has_upvoted: upvotedIds.has(post.id),
  has_bookmarked: bookmarkedIds.has(post.id),
});

const RADIUS_KM = 100; // Wider radius for more posts

function recencyBoost(d: Date) {
  const ageDays = (Date.now() - new Date(d).getTime()) / 864e5;
  if (ageDays <= 0.5) return 12; // Super recent
  if (ageDays <= 1) return 8;
  if (ageDays <= 3) return 5;
  if (ageDays <= 7) return 3;
  if (ageDays <= 14) return 2;
  return 1;
}

function engagementBoost(upvotes: number, comments: number) {
  const totalEngagement = (upvotes || 0) + (comments || 0) * 2; // Comments worth 2x upvotes
  if (totalEngagement >= 100) return 10;
  if (totalEngagement >= 50) return 6;
  if (totalEngagement >= 20) return 4;
  if (totalEngagement >= 10) return 2;
  return 1;
}

function buildIsLocal(lat?: number, lng?: number): (p: any) => boolean {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return () => false;
  }
  const kmPerDegLat = 110.574;
  const kmPerDegLng = 111.32 * Math.cos((lat * Math.PI) / 180);
  const dLat = RADIUS_KM / kmPerDegLat;
  const dLng = RADIUS_KM / kmPerDegLng;
  return (p: any) =>
    typeof p.lat === 'number' &&
    typeof p.lng === 'number' &&
    p.lat >= lat - dLat &&
    p.lat <= lat + dLat &&
    p.lng >= lng - dLng &&
    p.lng <= lng + dLng;
}

async function getFollowedSet(
  userId: string | null | undefined,
  posts: any[]
): Promise<Set<string>> {
  if (!userId || posts.length === 0) return new Set();
  const authorIds = [...new Set(posts.map((p: any) => p.author_id).filter(Boolean))];
  if (authorIds.length === 0) return new Set();
  const follows = await prisma.follows.findMany({
    where: { follower_id: userId, following_id: { in: authorIds } },
    select: { following_id: true },
    take: authorIds.length,
  });
  return new Set(follows.map(f => f.following_id));
}

const scoreHighlightPost = (
  p: any,
  followedSet: Set<string>,
  isLocal: (p: any) => boolean
): number =>
  (p.upvotes_count || 0) * 2 +
  (p._count?.comments || 0) * 3 +
  (followedSet.has(p.author_id) ? 8 : 0) +
  (isLocal(p) ? 6 : 0) +
  recencyBoost(p.created_at) +
  engagementBoost(p.upvotes_count, p._count?.comments || 0) +
  (p.media_url ? 4 : 0);

// GET /highlights?zip=90210&country=US&lat=..&lng=..&limit=20
highlightsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    try {
      const limit = Math.max(
        1,
        Math.min(parseInt(String((req.query as any).limit || '50'), 10) || 50, 100)
      );
      const country = String((req.query as any).country || 'US').toUpperCase();
      const lat = (req.query as any).lat != null ? Number((req.query as any).lat) : undefined;
      const lng = (req.query as any).lng != null ? Number((req.query as any).lng) : undefined;
      const v2 = String((req.query as any).v2 || '').trim() === '1';
      const sortParamRaw = String((req.query as any).sort || '')
        .trim()
        .toLowerCase();
      const sort =
        v2 && (sortParamRaw === 'recent' || sortParamRaw === 'top' || sortParamRaw === 'trending')
          ? sortParamRaw
          : null;
      const SINCE_DAYS = v2 ? 90 : 60; // Longer time window for more posts
      const since = new Date(Date.now() - SINCE_DAYS * 864e5);

      // Privacy + blocks: exclude private-profile authors and blocked users
      const [excludedIds, blockedIds] = await Promise.all([
        getExcludedPrivateAuthorIds(req.user?.id ?? null),
        getBlockedUserIds(req.user?.id ?? null, getRequestBlockedCache(req)),
      ]);
      const allExcluded = [...new Set([...excludedIds, ...blockedIds])];
      const privacyWhere = allExcluded.length ? { author_id: { notIn: allExcluded } } : {};

      // Per-tab sorted mode (v2 only): each mode runs its own correctly-shaped
      // query instead of deriving all tabs from one trending-shaped pool.
      if (sort) {
        const baseWhere = {
          country_code: country,
          media_url: { not: null },
          deleted_at: null,
          ...privacyWhere,
        };
        let items: any[] = [];

        if (sort === 'recent') {
          items = await prisma.post.findMany({
            where: { ...baseWhere, created_at: { gte: since } },
            orderBy: [{ created_at: 'desc' }],
            take: limit,
            select: highlightPostSelect,
          });
        }
        if (sort === 'top') {
          // Product rule: most engagement (upvotes + comments*1.5) in the last
          // 30 days. Union of top-by-upvotes and top-by-comment-count so a
          // comment-heavy post can't be missed by an upvotes-only orderBy.
          const monthAgo = new Date(Date.now() - 30 * 864e5);
          const [byUpvotes, byComments] = await Promise.all([
            prisma.post.findMany({
              where: { ...baseWhere, created_at: { gte: monthAgo } },
              orderBy: [{ upvotes_count: 'desc' }, { created_at: 'desc' }],
              take: 100,
              select: highlightPostSelect,
            }),
            prisma.post.findMany({
              where: { ...baseWhere, created_at: { gte: monthAgo } },
              // Unlike byUpvotes (covered by the country/upvotes/created_at
              // index), this relation-count order runs a per-row correlated
              // COUNT — accepted cost at single-country/30-day volume.
              orderBy: [{ comments: { _count: 'desc' } }, { created_at: 'desc' }],
              take: 100,
              select: highlightPostSelect,
            }),
          ]);
          const merged = new Map<string, any>();
          for (const p of [...byUpvotes, ...byComments]) merged.set(p.id, p);
          const engagement = (p: any) => (p.upvotes_count || 0) + (p._count?.comments || 0) * 1.5;
          items = [...merged.values()]
            .sort((a, b) => engagement(b) - engagement(a))
            .slice(0, limit);
        }
        if (sort === 'trending') {
          // Product rule: trending never surfaces posts older than 14 days.
          const fortnightAgo = new Date(Date.now() - 14 * 864e5);
          const pool = await prisma.post.findMany({
            where: { ...baseWhere, created_at: { gte: fortnightAgo } },
            orderBy: [{ created_at: 'desc' }],
            take: 300,
            select: highlightPostSelect,
          });
          const isLocal = buildIsLocal(lat, lng);
          const followedSet = await getFollowedSet(req.user?.id, pool);
          items = pool
            .map((p: any) => ({ ...p, _score: scoreHighlightPost(p, followedSet, isLocal) }))
            .sort((a: any, b: any) => b._score - a._score)
            .slice(0, limit);
        }

        const { upvotedIds, bookmarkedIds } = await getInteractionSets(
          req.user?.id,
          items.map((p: any) => p.id)
        );
        const enrich = withInteractions(upvotedIds, bookmarkedIds);
        res.set('Cache-Control', 'no-store, private');
        return res.json({ sort, items: items.map(enrich) });
      }

      // Run nationalTop + pool concurrently — dedup in JS after both resolve.
      const [nationalTopRaw, poolRaw] = await Promise.all([
        prisma.post.findMany({
          where: {
            country_code: country,
            created_at: { gte: since },
            media_url: { not: null },
            deleted_at: null,
            ...privacyWhere,
          },
          orderBy: [{ upvotes_count: 'desc' }, { created_at: 'desc' }],
          take: 10,
          select: highlightPostSelect,
        }),
        prisma.post.findMany({
          where: {
            country_code: country,
            created_at: { gte: since },
            media_url: { not: null },
            deleted_at: null,
            ...privacyWhere,
          },
          orderBy: [{ created_at: 'desc' }],
          take: 150,
          select: highlightPostSelect,
        }),
      ]);

      let nationalTop: typeof nationalTopRaw = nationalTopRaw;

      // Backfill nationalTop from pool if national posts are sparse
      if (nationalTop.length < 10) {
        const topIds = new Set(nationalTop.map(p => p.id));
        const globalFill = poolRaw
          .filter(p => !topIds.has(p.id))
          .sort((a, b) => (b.upvotes_count || 0) - (a.upvotes_count || 0))
          .slice(0, 10 - nationalTop.length);
        nationalTop = nationalTop.concat(globalFill) as typeof nationalTopRaw;
      }

      const topIds10 = new Set(nationalTop.map(p => p.id));
      const pool = poolRaw.filter(p => !topIds10.has(p.id));

      if (!v2) {
        // Legacy response: return 'local' list ranked only by upvotes
        let local: any[] = [];
        if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
          const kmPerDegLat = 110.574;
          const kmPerDegLng = 111.32 * Math.cos((lat * Math.PI) / 180);
          const dLat = RADIUS_KM / kmPerDegLat;
          const dLng = RADIUS_KM / kmPerDegLng;
          local = await prisma.post.findMany({
            where: {
              created_at: { gte: since },
              country_code: country,
              lat: { gte: lat - dLat, lte: lat + dLat },
              lng: { gte: lng - dLng, lte: lng + dLng },
              media_url: { not: null },
              deleted_at: null,
              ...privacyWhere,
            },
            orderBy: [{ upvotes_count: 'desc' }, { created_at: 'desc' }],
            take: Math.min(limit, 100),
            select: highlightPostSelect,
          });
        } else {
          local = pool
            .slice()
            .sort((a, b) => (b.upvotes_count || 0) - (a.upvotes_count || 0))
            .slice(0, Math.min(limit, 100));
        }
        const legacyIds = [
          ...new Set([...nationalTop.map(p => p.id), ...local.map((p: any) => p.id)]),
        ];
        const { upvotedIds, bookmarkedIds } = await getInteractionSets(req.user?.id, legacyIds);
        const enrich = withInteractions(upvotedIds, bookmarkedIds);
        res.set('Cache-Control', 'no-store, private');
        return res.json({
          nationalTop: nationalTop.map(enrich),
          local: local.map(enrich),
        });
      }

      // v2 ranked mix

      const isLocal = buildIsLocal(lat, lng);

      // Followed authors (only if authenticated) — bound by authors actually in the pool
      const followedSet = await getFollowedSet(req.user?.id, pool);

      const ranked = pool
        .map((p: any) => ({
          ...p,
          _score: scoreHighlightPost(p, followedSet, isLocal),
        }))
        .sort((a, b) => b._score - a._score)
        .slice(0, limit);

      const rankedIds = [
        ...new Set([...nationalTop.map(p => p.id), ...ranked.map((p: any) => p.id)]),
      ];
      const { upvotedIds, bookmarkedIds } = await getInteractionSets(req.user?.id, rankedIds);
      const enrich = withInteractions(upvotedIds, bookmarkedIds);
      res.set('Cache-Control', 'no-store, private');
      return res.json({
        nationalTop: nationalTop.map(enrich),
        ranked: ranked.map(enrich),
      });
    } catch (err) {
      console.error('[highlights] GET / error:', err);
      return sendError(res, 500, 'HIGHLIGHTS_FETCH_FAILED', {
        message: 'Internal server error',
      });
    }
  })
);
