import { Router } from 'express';
import { highlightPostSelect } from '../lib/highlightPostSelect.js';
import { sendError } from '../lib/http/sendError.js';
import { prisma } from '../lib/prisma.js';
import { getInteractionSets, withInteractions } from '../lib/postEnrichment.js';
import {
  buildPrivateTeamPostVisibilityWhere,
  getBlockedUserIds,
  getExcludedPrivateAuthorIds,
  getExcludedPrivateTeamIds,
  getRequestBlockedCache,
} from '../lib/privacyUtils.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';

export const highlightsRouter = Router();

const RADIUS_KM = 100; // Wider radius for more posts

// Trending candidate pool. Bounded per CLAUDE.md (every findMany needs a take).
// Trending ranks the whole app's recent posts by engagement — there is no
// location narrowing — so this is the app-wide pool the score sorts.
const TRENDING_POOL = 300;

// "Top 10 post with the most engagement that month" — a hard product cap, not
// a client-tunable page size. `?limit=` must never widen it.
const TOP_LIMIT = 10;

/**
 * Engagement score for the Top tab. Uses only signals the Post schema actually
 * carries — upvotes_count, plus comment and bookmark counts. There is no view
 * counter on Post, so "views" is not part of this.
 */
const topEngagement = (p: any): number =>
  (p.upvotes_count || 0) + (p._count?.comments || 0) * 1.5 + (p._count?.bookmarks || 0) * 1.5;

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

/**
 * Trending score (owner rule, 2026-07-20): rank the WHOLE app's recent posts by
 * ENGAGEMENT — location does not matter. Highlights covers every user in the
 * app, so the only signals are engagement (upvotes/comments/bookmarks) with a
 * recency lift so a genuinely popular fresh post leads. No proximity term, no
 * followed-author term — Trending is a public, app-wide popularity feed, not a
 * for-you or near-you feed.
 */
const scoreTrendingPost = (p: any): number =>
  (p.upvotes_count || 0) * 2 +
  (p._count?.comments || 0) * 3 +
  (p._count?.bookmarks || 0) * 1.5 +
  recencyBoost(p.created_at) +
  engagementBoost(p.upvotes_count, p._count?.comments || 0);

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

      // Privacy + blocks: exclude private-profile authors, blocked users, AND
      // posts attached to private teams the viewer can't see.
      const [excludedIds, blockedIds, excludedTeamIds] = await Promise.all([
        getExcludedPrivateAuthorIds(req.user?.id ?? null),
        getBlockedUserIds(req.user?.id ?? null, getRequestBlockedCache(req)),
        getExcludedPrivateTeamIds(req.user?.id ?? null),
      ]);
      const allExcluded = [...new Set([...excludedIds, ...blockedIds])];
      const privacyWhere: any = {};
      if (allExcluded.length) privacyWhere.author_id = { notIn: allExcluded };
      const privateTeamPostWhere = buildPrivateTeamPostVisibilityWhere(excludedTeamIds);
      if (privateTeamPostWhere) privacyWhere.OR = privateTeamPostWhere.OR;

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
          // Product rule (owner, 2026-07-16): "Recents should be most recent
          // post." Newest-first, full stop — no date window, so the tab can
          // never be empty while any visible post exists.
          items = await prisma.post.findMany({
            where: baseWhere,
            orderBy: [{ created_at: 'desc' }],
            take: limit,
            select: highlightPostSelect,
          });
        }
        if (sort === 'top') {
          // Product rule: top 10 by engagement over the last 30 days, and
          // exactly 10 items regardless of the client's `limit`.
          //
          // engagement = upvotes_count + comments*1.5 + bookmarks*1.5
          // Only signals the Post schema actually carries (there is no view
          // counter). Comments and bookmarks are weighted above a passing
          // upvote because both take deliberate effort.
          const TOP_WINDOW_DAYS = 30;
          const topSince = new Date(Date.now() - TOP_WINDOW_DAYS * 864e5);
          const [byUpvotes, byComments] = await Promise.all([
            prisma.post.findMany({
              where: { ...baseWhere, created_at: { gte: topSince } },
              orderBy: [{ upvotes_count: 'desc' }, { created_at: 'desc' }],
              take: 100,
              select: highlightPostSelect,
            }),
            prisma.post.findMany({
              where: { ...baseWhere, created_at: { gte: topSince } },
              // Unlike byUpvotes (covered by the country/upvotes/created_at
              // index), this relation-count order runs a per-row correlated
              // COUNT — accepted cost at single-country/one-month volume.
              orderBy: [{ comments: { _count: 'desc' } }, { created_at: 'desc' }],
              take: 100,
              select: highlightPostSelect,
            }),
          ]);
          const merged = new Map<string, any>();
          for (const p of [...byUpvotes, ...byComments]) merged.set(p.id, p);
          items = [...merged.values()]
            .map((p: any) => ({ ...p, _engagement: topEngagement(p) }))
            .sort((a: any, b: any) =>
              b._engagement !== a._engagement
                ? b._engagement - a._engagement
                : // Deterministic tie-break: newest wins, then id, so equal-
                  // engagement posts don't shuffle between requests.
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
                  a.id.localeCompare(b.id)
            )
            .slice(0, TOP_LIMIT);
        }
        if (sort === 'trending') {
          // Product rule (owner, 2026-07-20): Trending ranks the WHOLE app's
          // recent posts by ENGAGEMENT — location does not matter. Highlights
          // covers every user in the app, so there is no proximity term and no
          // per-viewer narrowing; the same popular posts trend for everyone.
          // (Superseded the earlier proximity rules, which crowned nearby
          // 0-engagement posts #1 and degraded to newest-first for viewers with
          // no coords — indistinguishable from Recent.)
          const TRENDING_WINDOW_DAYS = 14;
          const trendingSince = new Date(Date.now() - TRENDING_WINDOW_DAYS * 864e5);
          let pool = await prisma.post.findMany({
            where: { ...baseWhere, created_at: { gte: trendingSince } },
            orderBy: [{ created_at: 'desc' }],
            take: TRENDING_POOL,
            select: highlightPostSelect,
          });

          // Never-empty guarantee: nothing posted in the trending window falls
          // back to the full v2 lookback so the tab still renders something.
          if (pool.length === 0) {
            pool = await prisma.post.findMany({
              where: { ...baseWhere, created_at: { gte: since } },
              orderBy: [{ created_at: 'desc' }],
              take: TRENDING_POOL,
              select: highlightPostSelect,
            });
          }

          items = pool
            .map((p: any) => ({ post: p, score: scoreTrendingPost(p) }))
            .sort(
              (a, b) =>
                b.score - a.score ||
                // Deterministic tie-break: newest wins, then id, so equal-score
                // posts don't shuffle between requests.
                new Date(b.post.created_at).getTime() - new Date(a.post.created_at).getTime() ||
                a.post.id.localeCompare(b.post.id)
            )
            .slice(0, limit)
            .map(x => x.post);
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
