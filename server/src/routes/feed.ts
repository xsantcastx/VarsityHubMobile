import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { sendError } from '../lib/http/sendError.js';
import { getZipCoordinates, haversineDistance } from '../lib/geoUtils.js';
import { geocodeLocation } from '../lib/geocoding.js';
import { detectMediaType, getVideoPreviewUrl } from '../lib/mediaUtils.js';
import {
  getBlockedUserIds,
  getExcludedPrivateAuthorIds,
  getRequestBlockedCache,
} from '../lib/privacyUtils.js';
import { ensureOAuthUserVerified } from '../lib/oauthVerification.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const feedRouter = Router();

const isMissingPollSchemaError = (error: any): boolean => {
  if (!error || (error.code !== 'P2021' && error.code !== 'P2022')) return false;
  const table = String(error?.meta?.table ?? '');
  const column = String(error?.meta?.column ?? '');
  const message = String(error?.message ?? '');
  return /Poll/i.test(table) || /Poll/i.test(column) || /Poll/i.test(message);
};

const withMediaPreview = (post: any) => ({
  ...post,
  media_type: detectMediaType(post.media_url),
  preview_url: getVideoPreviewUrl(post.media_url),
});

const serializePoll = (poll: any, postContent: string | null, userVote: string | null = null) => {
  const options = (poll.options ?? []).map((opt: any) => ({
    id: opt.id,
    text: opt.text,
    votes: opt.votes_count ?? opt._count?.votes ?? 0,
  }));
  const totalVotes = options.reduce((sum: number, o: any) => sum + o.votes, 0);
  return {
    id: poll.id,
    question: postContent || 'Poll',
    options,
    totalVotes,
    endsAt: poll.expires_at
      ? poll.expires_at instanceof Date
        ? poll.expires_at.toISOString()
        : poll.expires_at
      : undefined,
    userVote,
  };
};

async function getZipCoordinatesWithFallback(
  zipCode: string
): Promise<{ lat: number; lon: number } | null> {
  const staticResult = getZipCoordinates(zipCode);
  if (staticResult) return staticResult;

  const geocodeResult = await geocodeLocation(zipCode);
  if (geocodeResult) {
    return { lat: geocodeResult.latitude, lon: geocodeResult.longitude };
  }

  return null;
}

async function getFollowedPostsPage(
  req: AuthedRequest,
  mode: 'followed' | 'followed_teams',
  limit: number
) {
  const currentUserId = req.user?.id ?? null;
  if (!currentUserId) {
    return {
      items: [],
      nextCursor: null,
      ...(mode === 'followed'
        ? { followed_feed_meta: { following_count: 0 } }
        : { followed_teams_feed_meta: { followed_teams_count: 0 } }),
    };
  }

  const where: Record<string, any> = { deleted_at: null };
  let followedFeedMeta: { following_count: number } | undefined;
  let followedTeamsFeedMeta: { followed_teams_count: number } | undefined;

  if (mode === 'followed') {
    const following = await prisma.follows.findMany({
      where: { follower_id: currentUserId, status: 'accepted' },
      select: { following_id: true },
      take: 1000,
    });
    const followingIds = following.map((row: any) => row.following_id);
    followedFeedMeta = { following_count: followingIds.length };
    if (followingIds.length === 0) {
      return { items: [], nextCursor: null, followed_feed_meta: followedFeedMeta };
    }
    where.OR = [{ author_id: { in: followingIds } }, { type: 'admin_broadcast' }];
  } else {
    const teamFollows = await prisma.teamFollow.findMany({
      where: { user_id: currentUserId },
      select: { team_id: true },
      take: 1000,
    });
    const followedTeamIds = teamFollows.map((row: any) => row.team_id);
    followedTeamsFeedMeta = { followed_teams_count: followedTeamIds.length };
    if (followedTeamIds.length === 0) {
      return {
        items: [],
        nextCursor: null,
        followed_teams_feed_meta: followedTeamsFeedMeta,
      };
    }
    const gamesWithFollowedTeams = await prisma.game.findMany({
      where: {
        OR: [
          { home_team_id: { in: followedTeamIds } },
          { away_team_id: { in: followedTeamIds } },
        ],
      },
      select: { id: true },
      take: 500,
      orderBy: { date: 'desc' },
    });
    const gameIds = gamesWithFollowedTeams.map((row: any) => row.id);
    where.OR = [
      { team_id: { in: followedTeamIds } },
      ...(gameIds.length > 0 ? [{ game_id: { in: gameIds } }] : []),
      { type: 'admin_broadcast' },
    ];
  }

  const excludedIds = await getExcludedPrivateAuthorIds(currentUserId);
  if (excludedIds.length) {
    where.author_id = {
      ...(typeof where.author_id === 'object' ? where.author_id : {}),
      notIn: excludedIds,
    };
  }

  const blockedIds = await getBlockedUserIds(currentUserId, getRequestBlockedCache(req));
  if (blockedIds.length) {
    const existing = typeof where.author_id === 'object' ? where.author_id : {};
    const merged = [...(existing.notIn || []), ...blockedIds];
    where.author_id = { ...existing, notIn: merged };
  }

  const query: any = {
    where,
    orderBy: [{ created_at: 'desc' as const }],
    include: {
      author: { select: { id: true, username: true, display_name: true, avatar_url: true } },
      team: { select: { id: true, name: true, logo_url: true } },
      _count: { select: { comments: true, bookmarks: true } },
      poll: { include: { options: true } },
    },
    take: limit + 1,
  };

  let rows: any[] = [];
  try {
    rows = await prisma.post.findMany(query);
  } catch (error: any) {
    if (!isMissingPollSchemaError(error)) throw error;
    const fallbackQuery = { ...query, include: { ...query.include } };
    delete fallbackQuery.include.poll;
    rows = await prisma.post.findMany(fallbackQuery);
  }

  const items = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? rows[limit].id : null;
  const postIds: string[] = items.map((post: any) => post.id);
  const authorIds: string[] = items.map((post: any) => post.author_id).filter(Boolean);
  const pollIds: string[] = items.map((post: any) => post.poll?.id).filter(Boolean);

  let upvotedIds = new Set<string>();
  let bookmarkedIds = new Set<string>();
  let followingIds = new Set<string>();
  let pollVoteMap = new Map<string, string>();

  if (items.length) {
    const followPromise = authorIds.length
      ? prisma.follows.findMany({
          where: { follower_id: currentUserId, following_id: { in: authorIds } },
          select: { following_id: true },
        })
      : Promise.resolve([] as Array<{ following_id: string }>);
    const pollVotePromise = pollIds.length
      ? prisma.pollVote.findMany({
          where: { user_id: currentUserId, poll_option: { poll_id: { in: pollIds } } },
          select: { poll_option: { select: { poll_id: true } }, poll_option_id: true },
        })
      : Promise.resolve([] as any[]);
    const [upvotes, bookmarks, follows, pollVotes] = await Promise.all([
      prisma.postUpvote.findMany({
        where: { user_id: currentUserId, post_id: { in: postIds } },
        select: { post_id: true },
      }),
      prisma.postBookmark.findMany({
        where: { user_id: currentUserId, post_id: { in: postIds } },
        select: { post_id: true },
      }),
      followPromise,
      pollVotePromise,
    ]);
    upvotedIds = new Set(upvotes.map((row: any) => row.post_id));
    bookmarkedIds = new Set(bookmarks.map((row: any) => row.post_id));
    followingIds = new Set((follows as Array<{ following_id: string }>).map(row => row.following_id));
    pollVoteMap = new Map(
      (pollVotes as any[]).map((row: any) => [row.poll_option.poll_id, row.poll_option_id])
    );
  }

  const cleanTitle = (title: string | null): string | null => {
    if (!title) return null;
    const match = title.match(/^\[SAMPLE_GAME:[^\]]+\]\s*(.*)$/);
    return match ? match[1] || null : title;
  };

  const payload = items.map((post: any) => ({
    id: post.id,
    author_id: post.author_id,
    team_id: post.team_id ?? null,
    is_pinned: post.is_pinned ?? false,
    title: cleanTitle(post.title),
    content: post.content ?? null,
    media_url: post.media_url ?? null,
    media_type: detectMediaType(post.media_url),
    preview_url: getVideoPreviewUrl(post.media_url),
    caption: post.content ?? null,
    upvotes_count: post.upvotes_count ?? 0,
    comments_count: post._count?.comments ?? 0,
    bookmarks_count: post._count?.bookmarks ?? 0,
    created_at: post.created_at instanceof Date ? post.created_at.toISOString() : post.created_at,
    author: post.author
      ? {
          id: post.author.id,
          username: post.author.username,
          display_name: post.author.display_name,
          avatar_url: post.author.avatar_url,
        }
      : null,
    team: post.team ? { id: post.team.id, name: post.team.name, logo_url: post.team.logo_url } : null,
    has_upvoted: upvotedIds.has(post.id),
    has_bookmarked: bookmarkedIds.has(post.id),
    is_following_author: post.author ? followingIds.has(post.author.id) : false,
    poll: post.poll
      ? serializePoll(post.poll, post.content, pollVoteMap.get(post.poll.id) || null)
      : null,
  }));

  return {
    items: payload,
    nextCursor,
    ...(followedFeedMeta ? { followed_feed_meta: followedFeedMeta } : {}),
    ...(followedTeamsFeedMeta ? { followed_teams_feed_meta: followedTeamsFeedMeta } : {}),
  };
}

async function getHighlightsBundle(req: AuthedRequest, limit: number) {
  const country = String((req.query as any).country || 'US').toUpperCase();
  const lat = (req.query as any).lat != null ? Number((req.query as any).lat) : undefined;
  const lng = (req.query as any).lng != null ? Number((req.query as any).lng) : undefined;
  const since = new Date(Date.now() - 90 * 864e5);
  const radiusKm = 100;

  const baseSelect = {
    id: true,
    title: true,
    content: true,
    media_url: true,
    upvotes_count: true,
    created_at: true,
    author_id: true,
    author: { select: { id: true, username: true, display_name: true, avatar_url: true } },
    lat: true,
    lng: true,
    country_code: true,
    _count: { select: { comments: true } },
  } as const;

  const excludedIds = await getExcludedPrivateAuthorIds(req.user?.id ?? null);
  const privacyWhere = excludedIds.length ? { author_id: { notIn: excludedIds } } : {};

  let nationalTop = await prisma.post.findMany({
    where: {
      country_code: country,
      created_at: { gte: since },
      media_url: { not: null },
      deleted_at: null,
      ...privacyWhere,
    },
    orderBy: [{ upvotes_count: 'desc' }, { created_at: 'desc' }],
    take: 10,
    select: baseSelect,
  });

  if (nationalTop.length < 10) {
    const fill = await prisma.post.findMany({
      where: {
        created_at: { gte: since },
        id: { notIn: nationalTop.map((post: any) => post.id) },
        media_url: { not: null },
        deleted_at: null,
        ...privacyWhere,
      },
      orderBy: [{ upvotes_count: 'desc' }, { created_at: 'desc' }],
      take: 10 - nationalTop.length,
      select: baseSelect,
    });
    nationalTop = nationalTop.concat(fill);
  }

  const pool = await prisma.post.findMany({
    where: {
      country_code: country,
      created_at: { gte: since },
      id: { notIn: nationalTop.map((post: any) => post.id) },
      media_url: { not: null },
      deleted_at: null,
      ...privacyWhere,
    },
    orderBy: [{ created_at: 'desc' }],
    take: 500,
    select: baseSelect,
  });

  let isLocal: (post: any) => boolean = () => false;
  if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    const kmPerDegLat = 110.574;
    const kmPerDegLng = 111.32 * Math.cos((lat * Math.PI) / 180);
    const dLat = radiusKm / kmPerDegLat;
    const dLng = radiusKm / kmPerDegLng;
    isLocal = (post: any) =>
      typeof post.lat === 'number' &&
      typeof post.lng === 'number' &&
      post.lat >= lat - dLat &&
      post.lat <= lat + dLat &&
      post.lng >= lng - dLng &&
      post.lng <= lng + dLng;
  }

  let followedSet = new Set<string>();
  if (req.user?.id) {
    const follows = await prisma.follows.findMany({
      where: { follower_id: req.user.id },
      select: { following_id: true },
      take: 1000,
    });
    followedSet = new Set(follows.map((row: any) => row.following_id));
  }

  const recencyBoost = (date: Date) => {
    const ageDays = (Date.now() - new Date(date).getTime()) / 864e5;
    if (ageDays <= 0.5) return 12;
    if (ageDays <= 1) return 8;
    if (ageDays <= 3) return 5;
    if (ageDays <= 7) return 3;
    if (ageDays <= 14) return 2;
    return 1;
  };

  const engagementBoost = (upvotes: number, comments: number) => {
    const totalEngagement = (upvotes || 0) + (comments || 0) * 2;
    if (totalEngagement >= 100) return 10;
    if (totalEngagement >= 50) return 6;
    if (totalEngagement >= 20) return 4;
    if (totalEngagement >= 10) return 2;
    return 1;
  };

  const ranked = pool
    .map((post: any) => ({
      ...post,
      _score:
        (post.upvotes_count || 0) * 2 +
        (post._count?.comments || 0) * 3 +
        (followedSet.has(post.author_id) ? 8 : 0) +
        (isLocal(post) ? 6 : 0) +
        recencyBoost(post.created_at) +
        engagementBoost(post.upvotes_count, post._count?.comments || 0) +
        (post.media_url ? 4 : 0),
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);

  return {
    nationalTop: nationalTop.map(withMediaPreview),
    ranked: ranked.map(withMediaPreview),
  };
}

async function getAdsBundle(
  viewer: { date_of_birth?: Date | null; preferences?: any } | null,
  req: AuthedRequest,
  limit: number
) {
  if (viewer) {
    const { isMinor } = await import('../lib/userAge.js');
    if (isMinor(viewer as any)) {
      return { date: new Date().toISOString().slice(0, 10), ads: [] };
    }
  }

  const dateParam = req.query.date ? String(req.query.date) : undefined;
  const zip = req.query.zip ? String(req.query.zip) : undefined;
  const lat = req.query.lat != null ? Number(req.query.lat) : undefined;
  const lng = req.query.lng != null ? Number(req.query.lng) : undefined;
  const dateISO = dateParam || new Date().toISOString().slice(0, 10);
  const start = new Date(dateISO + 'T00:00:00.000Z');
  const next = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  let userCoords: { lat: number; lon: number } | null = null;
  if (zip) {
    userCoords = await getZipCoordinatesWithFallback(zip);
  } else if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    userCoords = { lat, lon: lng };
  }
  if (!userCoords) return { date: dateISO, ads: [] };

  const bboxLat = 0.13;
  const bboxLng = 0.15;
  const ads = await prisma.ad.findMany({
    where: {
      payment_status: 'paid',
      status: 'active',
      target_zip_code: { not: null },
      OR: [
        {
          target_lat: { gte: userCoords.lat - bboxLat, lte: userCoords.lat + bboxLat },
          target_lng: { gte: userCoords.lon - bboxLng, lte: userCoords.lon + bboxLng },
        },
        { target_lat: null },
      ],
      reservations: {
        some: { date: { gte: start, lt: next } },
      },
    },
    orderBy: { created_at: 'desc' },
    take: 20,
    select: {
      id: true,
      business_name: true,
      banner_url: true,
      banner_fit_mode: true,
      target_url: true,
      target_zip_code: true,
      target_lat: true,
      target_lng: true,
      radius: true,
      description: true,
      status: true,
      payment_status: true,
      created_at: true,
    },
  });

  const adZipCoords = new Map<string, { lat: number; lon: number }>();
  const legacyZips = [
    ...new Set(
      ads
        .filter((ad: any) => ad.target_zip_code && (ad.target_lat == null || ad.target_lng == null))
        .map((ad: any) => ad.target_zip_code!)
    ),
  ];
  if (legacyZips.length > 0) {
    await Promise.all(
      legacyZips.map(async zipCode => {
        const coords = await getZipCoordinatesWithFallback(zipCode);
        if (coords) adZipCoords.set(zipCode, coords);
      })
    );
  }

  const filtered = ads.filter((ad: any) => {
    if (!ad.target_zip_code) return false;
    const adCoords =
      ad.target_lat != null && ad.target_lng != null
        ? { lat: ad.target_lat, lon: ad.target_lng }
        : adZipCoords.get(ad.target_zip_code);
    if (!adCoords) return false;
    const distance = haversineDistance(userCoords!.lat, userCoords!.lon, adCoords.lat, adCoords.lon);
    return distance <= 5.59;
  });

  return {
    date: dateISO,
    ads: filtered.slice(0, limit).map((ad: any) => ({
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
  };
}

feedRouter.get(
  '/bundle',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    try {
      const postsLimit = Math.max(1, Math.min(Number(req.query.posts_limit || 20) || 20, 50));
      const highlightsLimit = Math.max(
        1,
        Math.min(Number(req.query.highlights_limit || 20) || 20, 50)
      );
      const adsLimit = Math.max(1, Math.min(Number(req.query.ads_limit || 2) || 2, 5));

      const viewer = req.user?.id
        ? await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
              id: true,
              email_verified: true,
              google_id: true,
              apple_id: true,
              date_of_birth: true,
              preferences: true,
            },
          })
        : null;
      const verifiedViewer = await ensureOAuthUserVerified(viewer as any);

      const [posts, postsFollowedTeams, highlights, ads, unreadNotifications, unreadMessages] =
        await Promise.all([
          getFollowedPostsPage(req, 'followed', postsLimit),
          getFollowedPostsPage(req, 'followed_teams', postsLimit),
          getHighlightsBundle(req, highlightsLimit),
          getAdsBundle(viewer, req, adsLimit),
          prisma.notification.count({
            where: { user_id: req.user!.id, read_at: null },
          }),
          verifiedViewer?.email_verified
            ? prisma.message.count({
                where: { recipient_id: req.user!.id, read: false },
              })
            : Promise.resolve(0),
        ]);

      res.set('Cache-Control', 'no-store, private');
      return res.json({
        posts,
        posts_followed_teams: postsFollowedTeams,
        highlights,
        ads,
        unread_notifications: unreadNotifications,
        unread_messages: unreadMessages,
      });
    } catch (error: any) {
      console.error('[feed] GET /bundle error:', error);
      return sendError(res, 500, 'FEED_BUNDLE_FAILED', {
        message: 'Failed to load feed bundle',
      });
    }
  })
);
