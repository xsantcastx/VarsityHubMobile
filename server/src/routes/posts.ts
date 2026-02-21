import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireVerified } from '../middleware/requireVerified.js';

export const postsRouter = Router();

const POST_UNDO_WINDOW_MS = 5 * 60 * 1000;
const debugLog = (...args: Parameters<typeof console.log>) => {
  if (process.env.ENABLE_SERVER_DEBUG_LOGS === 'true' || process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.m4v', '.avi', '.mkv'];
const detectMediaType = (url?: string | null): 'video' | 'image' => {
  if (!url) return 'image';
  const sanitized = url.split('?')[0].split('#')[0].toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => sanitized.endsWith(ext)) ? 'video' : 'image';
};
const isMissingPollSchemaError = (error: any): boolean => {
  if (!error || (error.code !== 'P2021' && error.code !== 'P2022')) return false;
  const table = String(error?.meta?.table ?? '');
  const column = String(error?.meta?.column ?? '');
  const message = String(error?.message ?? '');
  return /Poll/i.test(table) || /Poll/i.test(column) || /Poll/i.test(message);
};

const logPollSchemaFallback = (context: string, error: any) => {
  console.warn(`[posts] Poll schema unavailable in ${context}; serving without poll data`, {
    code: error?.code,
    table: error?.meta?.table,
    column: error?.meta?.column,
  });
};


postsRouter.get('/', async (req: AuthedRequest, res) => {
  const sort = typeof req.query.sort === 'string' ? req.query.sort.trim() : '';
  const limit = Math.min(parseInt(String(req.query.limit ?? '10'), 10) || 10, 50);
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
  const currentUserId = req.user?.id ?? null;

  const orderBy = sort === 'trending'
    ? [{ upvotes_count: 'desc' as const }, { created_at: 'desc' as const }]
    : [{ created_at: 'desc' as const }];

  const where: Record<string, any> = { deleted_at: null };
  if (req.query.game_id) {
    const gameId = String(req.query.game_id);
    // Handle sample game IDs (stored in title field with [SAMPLE_GAME:...] marker)
    if (/^sample-/i.test(gameId)) {
      where.title = { startsWith: `[SAMPLE_GAME:${gameId}]` };
    } else {
      where.game_id = gameId;
    }
  }
  if (req.query.type) where.type = String(req.query.type);
  if (req.query.user_id) where.author_id = String(req.query.user_id);

  const query: any = {
    where,
    orderBy,
    include: {
      author: { select: { id: true, display_name: true, avatar_url: true } },
      _count: { select: { comments: true, bookmarks: true } },
      poll: { include: { options: true } },
    },
    take: limit + 1,
  };
  if (cursor) {
    query.cursor = { id: cursor };
    query.skip = 1;
  }

  let rows: any[] = [];
  try {
    rows = await prisma.post.findMany(query);
  } catch (error: any) {
    if (!isMissingPollSchemaError(error)) {
      console.error('[posts] Failed to fetch posts:', error);
      return res.status(500).json({ error: 'Failed to fetch posts' });
    }
    logPollSchemaFallback('GET /posts', error);
    const fallbackQuery = { ...query, include: { ...query.include } };
    delete fallbackQuery.include.poll;
    rows = await prisma.post.findMany(fallbackQuery);
  }
  const items = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? rows[limit].id : null;

  const postIds: string[] = items.map((p: any) => p.id);
  const authorIds: string[] = items.map((p: any) => p.author_id).filter(Boolean);

  let upvotedIds = new Set<string>();
  let bookmarkedIds = new Set<string>();
  let followingIds = new Set<string>();

  if (currentUserId && items.length) {
    const followPromise = authorIds.length
      ? prisma.follows.findMany({ where: { follower_id: currentUserId, following_id: { in: authorIds } }, select: { following_id: true } })
      : Promise.resolve([] as Array<{ following_id: string }>);
    const [upvotes, bookmarks, follows] = await Promise.all([
      prisma.postUpvote.findMany({ where: { user_id: currentUserId, post_id: { in: postIds } }, select: { post_id: true } }),
      prisma.postBookmark.findMany({ where: { user_id: currentUserId, post_id: { in: postIds } }, select: { post_id: true } }),
      followPromise,
    ]);
    upvotedIds = new Set(upvotes.map((u) => u.post_id));
    bookmarkedIds = new Set(bookmarks.map((b) => b.post_id));
    followingIds = new Set((follows as Array<{ following_id: string }>).map((f) => f.following_id));
    
    // Debug logging for follow relationships
    debugLog('[posts] Follow debug:', { 
      currentUserId, 
      authorIds, 
      followingIds: Array.from(followingIds),
      followRecords: follows.length 
    });
  }

  // Helper to clean sample game marker from title
  const cleanTitle = (title: string | null): string | null => {
    if (!title) return null;
    const match = title.match(/^\[SAMPLE_GAME:[^\]]+\]\s*(.*)$/);
    return match ? match[1] || null : title;
  };

  const payload = items.map((post: any) => ({
    id: post.id,
    author_id: post.author_id, // Include author_id for ownership checks
    title: cleanTitle(post.title), // Clean sample game marker from title
    content: post.content ?? null, // Include content for editing
    media_url: post.media_url ?? null,
    media_type: detectMediaType(post.media_url),
    caption: post.content ?? null,
    upvotes_count: post.upvotes_count ?? 0,
    comments_count: post._count?.comments ?? 0,
    bookmarks_count: post._count?.bookmarks ?? 0,
    created_at: post.created_at instanceof Date ? post.created_at.toISOString() : post.created_at,
    author: post.author
      ? {
          id: post.author.id,
          display_name: post.author.display_name,
          avatar_url: post.author.avatar_url,
        }
      : null,
    has_upvoted: upvotedIds.has(post.id),
    has_bookmarked: bookmarkedIds.has(post.id),
    is_following_author: post.author ? followingIds.has(post.author.id) : false,
    poll: post.poll ? {
      ...post.poll,
      userVote: null, // This needs to be fetched separately if needed
      totalVotes: post.poll.options.reduce((acc: number, opt: any) => acc + opt.votes_count, 0),
    } : null,
  }));

  return res.json({ items: payload, nextCursor });
});

postsRouter.get('/trending', async (req: AuthedRequest, res, next) => {
  req.query.sort = 'trending';
  // Forward to the main GET / handler with trending sort
  return next();
});

// Debug endpoint to check follow relationships
postsRouter.get('/debug/follows', requireAuth, async (req: AuthedRequest, res) => {
  const currentUserId = req.user!.id;
  
  const follows = await prisma.follows.findMany({
    where: { follower_id: currentUserId },
    select: {
      following_id: true,
      following: {
        select: { id: true, display_name: true, username: true }
      }
    }
  });

  return res.json({
    userId: currentUserId,
    followingCount: follows.length,
    following: follows.map(f => ({
      id: f.following_id,
      display_name: f.following.display_name,
      username: f.following.username
    }))
  });
});


// Count posts by simple filters (e.g., game_id, type)
postsRouter.get('/count', async (req, res) => {
  const where: any = { deleted_at: null };
  if (req.query.game_id) where.game_id = String(req.query.game_id);
  if (req.query.type) where.type = String(req.query.type);
  const count = await prisma.post.count({ where });
  res.json({ count });
});

const locationSchema = z.object({
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  place_id: z.string().nullable().optional(),
  place_name: z.string().nullable().optional(),
  locality: z.string().nullable().optional(),
  admin_area: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  country_code: z.string().nullable().optional(),
  source: z.enum(['device','places','zip','derived']).nullable().optional(),
  zip: z.string().nullable().optional(),
}).optional();

const createPostSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().max(4000).optional(),
    type: z.string().max(50).optional(),
    // Accept any non-empty string to support data URIs or local uploads handled elsewhere
    media_url: z.string().trim().min(1).optional(),
    game_id: z.string().optional(),
    event_id: z.string().optional(), // For event-specific posts
    location: locationSchema,
  })
  // Require at least content or media_url
  .refine((d) => Boolean((d.content && d.content.trim().length > 0) || (d.media_url && d.media_url.trim().length > 0)), {
    message: 'Either content or media_url is required',
    path: ['content'],
  });

import { geocodeZip, getCountryFromReqOrPrefs, reverseGeocode } from '../lib/geo.js';
import { verifyEventPostingPermission } from '../lib/geofencing.js';
import { getIsAdmin } from '../middleware/requireAdmin.js';
import { notifyPostInteraction } from '../lib/notifications.js';

postsRouter.post('/', requireVerified as any, async (req: AuthedRequest, res) => {
  // req.user is guaranteed by requireVerified middleware
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const data = parsed.data;
  
  // Normalize and enrich location
  let lat: number | null = null;
  let lng: number | null = null;
  let country_code: string | null = null;
  let admin1: string | null = null;
  let place_name: string | null = null;
  
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const prefs = await prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true } });
  const preferCountry = getCountryFromReqOrPrefs(req as any, prefs?.preferences);
  const loc = (data as any).location || {};
  if (typeof loc.lat === 'number' && typeof loc.lng === 'number') {
    lat = loc.lat; lng = loc.lng;
    try {
      const rev = await reverseGeocode(lat as number, lng as number);
      country_code = rev.country_code || preferCountry;
      admin1 = rev.admin_area || null;
      place_name = rev.place_name || null;
    } catch (_error) {}
  } else if (loc.zip || (prefs?.preferences as any)?.zip_code) {
    try {
      const zip = String(loc.zip || (prefs?.preferences as any)?.zip_code);
      const gg = await geocodeZip(zip, preferCountry);
      lat = gg.lat; lng = gg.lng; country_code = gg.country_code || preferCountry;
    } catch (_error) {}
  } else {
    country_code = preferCountry || null;
  }

  // ⚠️ GEOFENCING CHECK FOR EVENT POSTS
  // If this is an event-specific post, verify user is at the venue
  // Skip geofencing for sample events/games (IDs starting with "sample-") - these are demo content
  const eventId = (data as any).event_id;
  const gameId = data.game_id;
  const isSampleEvent = eventId && /^sample-/i.test(String(eventId));
  const isSampleGame = gameId && /^sample-/i.test(String(gameId));
  
  // For sample events, we can't use game_id (foreign key constraint)
  // Store sample game_id in title field with special marker for querying
  let finalGameId: string | null = null;
  let finalTitle = data.title || null;
  if (isSampleGame && gameId) {
    // Store sample game_id in title: [SAMPLE_GAME:sample-warriors-cavaliers] Original Title
    const titlePrefix = `[SAMPLE_GAME:${gameId}]`;
    finalTitle = finalTitle ? `${titlePrefix} ${finalTitle}` : titlePrefix;
    finalGameId = null; // Don't set game_id for sample events (foreign key constraint)
    debugLog(`✅ Sample game detected (${gameId}) - storing in title, skipping geofencing`);
  } else if (isSampleEvent && eventId) {
    debugLog(`✅ Sample event detected (${eventId}) - skipping geofencing check`);
    finalGameId = null;
  } else if (gameId) {
    finalGameId = gameId;
  }
  
  // Allow posting to sample events/games without geofencing
  if (isSampleEvent || isSampleGame) {
    debugLog(`✅ Sample event/game detected (${eventId || gameId}) - skipping geofencing check`);
  } else if (eventId || gameId) {
    // Check geofencing for real events or games (games have associated events)
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    let targetEventId = eventId;
    let homeTeamId: string | null = null;
    let awayTeamId: string | null = null;

    // Look up game to get event + team IDs for membership check
    if (gameId) {
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        select: {
          home_team_id: true,
          away_team_id: true,
          events: {
            orderBy: { date: 'asc' },
            take: 1,
            select: { id: true },
          },
        },
      });
      if (game) {
        homeTeamId = game.home_team_id ?? null;
        awayTeamId = game.away_team_id ?? null;
        if (!targetEventId && game.events?.length) {
          targetEventId = game.events[0].id;
          debugLog(`✅ Found associated event ${targetEventId} for game ${gameId}`);
        }
      }
    }

    // Admins and active members of either team bypass geofencing/time-window checks
    const isAdmin = await getIsAdmin(req as any);
    const teamIds = [homeTeamId, awayTeamId].filter(Boolean) as string[];
    const isTeamMember = teamIds.length > 0
      ? !!(await prisma.teamMembership.findFirst({
          where: { user_id: req.user.id, team_id: { in: teamIds }, status: 'active' },
          select: { id: true },
        }))
      : false;

    if (isAdmin || isTeamMember) {
      debugLog(`✅ Geofencing bypassed (isAdmin=${isAdmin}, isTeamMember=${isTeamMember})`);
    } else if (targetEventId) {
      const verification = await verifyEventPostingPermission(
        targetEventId,
        req.user.id,
        lat,
        lng
      );
      if (!verification.allowed) {
        return res.status(403).json({
          error: verification.code || 'LOCATION_VERIFICATION_FAILED',
          message: verification.reason,
          distance: verification.distance,
        });
      }
      debugLog(`✅ User ${req.user.id} verified at event location (${verification.distance?.toFixed(2)} km away)`);
    } else if (gameId) {
      debugLog(`⚠️  Game ${gameId} has no associated event — allowing post without geofence`);
    }
  }

  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const post = await prisma.post.create({
    data: {
      title: finalTitle,
      content: data.content?.trim() || null,
      type: data.type || 'post',
      media_url: data.media_url,
      game_id: finalGameId,
      author_id: req.user.id,
      country_code: country_code || undefined,
      admin1: admin1 || undefined,
      lat: typeof lat === 'number' ? lat : undefined,
      lng: typeof lng === 'number' ? lng : undefined,
    },
  });

  // Clean sample game marker from title in response
  const cleanTitle = (title: string | null): string | null => {
    if (!title) return null;
    const match = title.match(/^\[SAMPLE_GAME:[^\]]+\]\s*(.*)$/);
    return match ? match[1] || null : title;
  };

  res.status(201).json({ 
    ...post, 
    title: cleanTitle(post.title),
    location: { lat, lng, place_name, country_code } 
  });
});

postsRouter.post('/:id/poll', requireAuth as any, async (req: AuthedRequest, res) => {
  const postId = String(req.params.id);
  const userId = req.user!.id;

  const schema = z.object({
    options: z.array(z.string().min(1).max(100)).min(2).max(5),
    expires_at: z.string().datetime().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  }

  const { options, expires_at } = parsed.data;

  const post = await prisma.post.findFirst({ where: { id: postId, deleted_at: null } });
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  if (post.author_id !== userId) {
    return res.status(403).json({ error: 'Only the post author can create a poll' });
  }

  try {
    const poll = await prisma.poll.create({
      data: {
        post_id: postId,
        expires_at: expires_at ? new Date(expires_at) : undefined,
        options: {
          create: options.map((text) => ({ text })),
        },
      },
      include: {
        options: true,
      },
    });

    res.status(201).json(poll);
  } catch (error: any) {
    if (!isMissingPollSchemaError(error)) {
      console.error('[posts] Failed to create poll:', error);
      return res.status(500).json({ error: 'Failed to create poll' });
    }
    logPollSchemaFallback('POST /posts/:id/poll', error);
    return res.status(503).json({
      error: 'POLL_FEATURE_UNAVAILABLE',
      message: 'Polls are temporarily unavailable. Please try again shortly.',
    });
  }
});

postsRouter.post('/:id/poll/vote', requireAuth as any, async (req: AuthedRequest, res) => {
  const postId = String(req.params.id);
  const userId = req.user!.id;

  const schema = z.object({
    option_id: z.string(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  }

  const { option_id } = parsed.data;

  const postExists = await prisma.post.findFirst({ where: { id: postId, deleted_at: null }, select: { id: true } });
  if (!postExists) {
    return res.status(404).json({ error: 'Post not found' });
  }

  let poll: any;
  try {
    poll = await prisma.poll.findUnique({ where: { post_id: postId }, include: { options: true } });
  } catch (error: any) {
    if (!isMissingPollSchemaError(error)) {
      console.error('[posts] Failed to load poll for voting:', error);
      return res.status(500).json({ error: 'Failed to load poll' });
    }
    logPollSchemaFallback('POST /posts/:id/poll/vote', error);
    return res.status(503).json({
      error: 'POLL_FEATURE_UNAVAILABLE',
      message: 'Poll voting is temporarily unavailable. Please try again shortly.',
    });
  }
  if (!poll) {
    return res.status(404).json({ error: 'Poll not found' });
  }

  const option = poll.options.find((o) => o.id === option_id);
  if (!option) {
    return res.status(404).json({ error: 'Poll option not found' });
  }

  // Check if user has already voted
  const existingVote = await prisma.pollVote.findFirst({
    where: {
      poll_option: {
        poll_id: poll.id,
      },
      user_id: userId,
    },
  });

  if (existingVote) {
    // If user is voting for the same option, do nothing.
    // If user is changing their vote, we need to remove the old vote and add a new one.
    if (existingVote.poll_option_id === option_id) {
      return res.status(200).json({ message: 'Vote already cast' });
    }

    await prisma.$transaction([
      prisma.pollVote.delete({ where: { id: existingVote.id } }),
      prisma.pollOption.update({ where: { id: existingVote.poll_option_id }, data: { votes_count: { decrement: 1 } } }),
      prisma.pollVote.create({ data: { poll_option_id: option_id, user_id: userId } }),
      prisma.pollOption.update({ where: { id: option_id }, data: { votes_count: { increment: 1 } } }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.pollVote.create({ data: { poll_option_id: option_id, user_id: userId } }),
      prisma.pollOption.update({ where: { id: option_id }, data: { votes_count: { increment: 1 } } }),
    ]);
  }

  const updatedPoll = await prisma.poll.findUnique({
    where: { post_id: postId },
    include: {
      options: {
        include: {
          _count: {
            select: { votes: true },
          },
        },
      },
    },
  });

  res.status(200).json(updatedPoll);
});

postsRouter.get('/:id', async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const currentUserId = req.user?.id ?? null;

  let post: any;
  try {
    post = await prisma.post.findFirst({ 
      where: { id, deleted_at: null }, 
      include: { 
        author: { select: { id: true, display_name: true, avatar_url: true } },
        game: { select: { id: true, title: true, home_team: true, away_team: true, date: true } },
        _count: { select: { comments: true, bookmarks: true } },
        poll: { include: { options: true } },
      } 
    });
  } catch (error: any) {
    if (!isMissingPollSchemaError(error)) {
      console.error('[posts] Failed to fetch post:', error);
      return res.status(500).json({ error: 'Failed to fetch post' });
    }
    logPollSchemaFallback('GET /posts/:id', error);
    post = await prisma.post.findFirst({ 
      where: { id, deleted_at: null }, 
      include: { 
        author: { select: { id: true, display_name: true, avatar_url: true } },
        game: { select: { id: true, title: true, home_team: true, away_team: true, date: true } },
        _count: { select: { comments: true, bookmarks: true } },
      } 
    });
  }
  
  if (!post) return res.status(404).json({ error: 'Not found' });

  let has_upvoted = false;
  let has_bookmarked = false;
  let is_following_author = false;
  let user_vote: string | null = null;

  if (currentUserId && post) {
    const [upvotes, bookmarks, follows, pollVote] = await Promise.all([
      prisma.postUpvote.findUnique({ where: { post_id_user_id: { post_id: id, user_id: currentUserId } } }),
      prisma.postBookmark.findUnique({ where: { post_id_user_id: { post_id: id, user_id: currentUserId } } }),
      post.author_id ? prisma.follows.findUnique({ where: { follower_id_following_id: { follower_id: currentUserId, following_id: post.author_id } } }) : null,
      post.poll ? prisma.pollVote.findFirst({ where: { user_id: currentUserId, poll_option: { poll_id: post.poll.id } } }) : null,
    ]);
    
    has_upvoted = !!upvotes;
    has_bookmarked = !!bookmarks;
    is_following_author = !!follows;
    user_vote = pollVote?.poll_option_id || null;
  }

  // Helper to clean sample game marker from title
  const cleanTitle = (title: string | null): string | null => {
    if (!title) return null;
    const match = title.match(/^\[SAMPLE_GAME:[^\]]+\]\s*(.*)$/);
    return match ? match[1] || null : title;
  };

  const response = {
    ...post,
    title: cleanTitle(post.title), // Clean sample game marker from title
    has_upvoted,
    has_bookmarked,
    is_following_author,
    media_type: detectMediaType(post.media_url),
    caption: post.content ?? null,
    bookmarks_count: post._count?.bookmarks ?? 0,
    comments_count: post._count?.comments ?? 0,
    poll: post.poll ? {
      ...post.poll,
      userVote: user_vote,
      totalVotes: post.poll.options.reduce((acc: number, opt: any) => acc + opt.votes_count, 0),
    } : null,
    game: post.game ? {
      id: post.game.id,
      title: post.game.title,
      home_team: post.game.home_team,
      away_team: post.game.away_team,
      date: post.game.date,
    } : null,
  };

  res.json(response);
});

// Comments
postsRouter.get('/:id/comments', async (req, res) => {
  const { id } = req.params;
  const post = await prisma.post.findFirst({ where: { id, deleted_at: null }, select: { id: true } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10) || 20, 50);
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
  const query: any = {
    where: { post_id: id },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    include: {
      author: { select: { id: true, display_name: true, avatar_url: true } }
    },
    take: limit + 1,
  };
  if (cursor) {
    query.cursor = { id: cursor };
    query.skip = 1;
  }
  const rows = await prisma.comment.findMany(query);
  const items = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? rows[limit].id : null;
  res.json({ items, nextCursor });
});

postsRouter.post('/:id/comments', requireAuth as any, async (req: AuthedRequest, res) => {
  // req.user is guaranteed by requireAuth middleware
  const { id } = req.params;
  const postExists = await prisma.post.findFirst({ where: { id, deleted_at: null }, select: { id: true } });
  if (!postExists) return res.status(404).json({ error: 'Post not found' });
  const schema = z.object({ content: z.string().min(1).max(1000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  
  const comment = await prisma.comment.create({ 
    data: { post_id: id, author_id: req.user!.id, content: parsed.data.content },
    include: {
      author: { select: { id: true, display_name: true, avatar_url: true } }
    }
  });
  
  // Notify post author (if not self)
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const post = await prisma.post.findFirst({ where: { id, deleted_at: null }, select: { author_id: true } });
    const recipient = post?.author_id;
    if (recipient && recipient !== req.user.id) {
      await (prisma as any).notification.create({ 
        data: { user_id: recipient, actor_id: req.user.id, type: 'COMMENT', post_id: id, comment_id: comment.id } 
      });
      
      // Send push notification
      await notifyPostInteraction(
        recipient,
        'comment',
        req.user.id,
        comment.author?.display_name || 'Someone',
        id
      );
    }
  } catch (e) {
    console.error('Failed to send comment notification:', e);
  }
  res.status(201).json(comment);
});

// Reactions
// Toggle upvote

postsRouter.post('/:id/upvote', requireAuth as any, async (req: AuthedRequest, res) => {
  const postId = String(req.params.id);
  const userId = req.user!.id;

  const postExists = await prisma.post.findFirst({ where: { id: postId, deleted_at: null }, select: { id: true } });
  if (!postExists) return res.status(404).json({ error: 'Post not found' });

  const existing = await prisma.postUpvote.findUnique({ where: { post_id_user_id: { post_id: postId, user_id: userId } } });
  if (existing) {
    await prisma.$transaction([
      prisma.postUpvote.delete({ where: { post_id_user_id: { post_id: postId, user_id: userId } } }),
      prisma.post.update({ where: { id: postId }, data: { upvotes_count: { decrement: 1 } } }),
    ]);
    const { upvotes_count } = await prisma.post.findFirstOrThrow({ where: { id: postId, deleted_at: null }, select: { upvotes_count: true } });
    return res.json({ has_upvoted: false, upvotes_count, upvoted: false, count: upvotes_count });
  }

  await prisma.$transaction([
    prisma.postUpvote.create({ data: { post_id: postId, user_id: userId } }),
    prisma.post.update({ where: { id: postId }, data: { upvotes_count: { increment: 1 } } }),
  ]);
  const { upvotes_count } = await prisma.post.findFirstOrThrow({ where: { id: postId, deleted_at: null }, select: { upvotes_count: true } });
  
  // Notify post author (if not self)
  try {
    const post = await prisma.post.findFirst({ 
      where: { id: postId, deleted_at: null }, 
      select: { 
        author_id: true,
        author: { select: { display_name: true } }
      } 
    });
    const recipient = post?.author_id;
    if (recipient && recipient !== userId) {
      await (prisma as any).notification.create({ 
        data: { user_id: recipient, actor_id: userId, type: 'UPVOTE', post_id: postId } 
      });
      
      // Send push notification
      const actor = await prisma.user.findUnique({ where: { id: userId }, select: { display_name: true } });
      if (actor) {
        await notifyPostInteraction(
          recipient,
          'like',
          userId,
          actor.display_name || 'Someone',
          postId
        );
      }
    }
  } catch (e) {
    console.error('Failed to send upvote notification:', e);
  }
  return res.json({ has_upvoted: true, upvotes_count, upvoted: true, count: upvotes_count });
});


postsRouter.post('/:id/bookmark', requireAuth as any, async (req: AuthedRequest, res) => {
  const postId = String(req.params.id);
  const userId = req.user!.id;

  const postExists = await prisma.post.findFirst({ where: { id: postId, deleted_at: null }, select: { id: true } });
  if (!postExists) return res.status(404).json({ error: 'Post not found' });

  const existing = await prisma.postBookmark.findUnique({ where: { post_id_user_id: { post_id: postId, user_id: userId } } });
  if (existing) {
    await prisma.postBookmark.delete({ where: { post_id_user_id: { post_id: postId, user_id: userId } } });
    const bookmarks_count = await prisma.postBookmark.count({ where: { post_id: postId } });
    return res.json({ has_bookmarked: false, bookmarks_count, bookmarked: false });
  }

  await prisma.postBookmark.create({ data: { post_id: postId, user_id: userId } });
  const bookmarks_count = await prisma.postBookmark.count({ where: { post_id: postId } });
  return res.json({ has_bookmarked: true, bookmarks_count, bookmarked: true });
});

// Delete post (author only)
postsRouter.delete('/:id', requireAuth as any, async (req: AuthedRequest, res) => {
  const postId = String(req.params.id);
  const userId = req.user!.id;

  try {
    // Check if post exists and user is the author
    const post = await prisma.post.findFirst({ 
      where: { id: postId, deleted_at: null },
      select: { id: true, author_id: true }
    });
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    if (post.author_id !== userId) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }
    
    const deletedAt = new Date();
    await prisma.post.update({ where: { id: postId }, data: { deleted_at: deletedAt } });
    res.json({
      message: 'Post deleted successfully',
      deleted_at: deletedAt.toISOString(),
      undo_until: new Date(deletedAt.getTime() + POST_UNDO_WINDOW_MS).toISOString(),
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Restore a recently deleted post (author only)
postsRouter.post('/:id/restore', requireAuth as any, async (req: AuthedRequest, res) => {
  const postId = String(req.params.id);
  const userId = req.user!.id;

  try {
    const post = await prisma.post.findFirst({
      where: { id: postId },
      select: { id: true, author_id: true, deleted_at: true },
    });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.author_id !== userId) {
      return res.status(403).json({ error: 'You can only restore your own posts' });
    }
    if (!post.deleted_at) {
      return res.status(400).json({ error: 'Post is not deleted' });
    }
    const deletedAtMs = post.deleted_at.getTime();
    if (Date.now() - deletedAtMs > POST_UNDO_WINDOW_MS) {
      return res.status(410).json({ error: 'Restore window has expired' });
    }

    let restored: any;
    try {
      restored = await prisma.post.update({
        where: { id: postId },
        data: { deleted_at: null },
        include: {
          author: { select: { id: true, display_name: true, avatar_url: true } },
          _count: { select: { comments: true, bookmarks: true } },
          poll: { include: { options: true } },
        },
      });
    } catch (error: any) {
      if (!isMissingPollSchemaError(error)) throw error;
      logPollSchemaFallback('POST /posts/:id/restore', error);
      restored = await prisma.post.update({
        where: { id: postId },
        data: { deleted_at: null },
        include: {
          author: { select: { id: true, display_name: true, avatar_url: true } },
          _count: { select: { comments: true, bookmarks: true } },
        },
      });
    }
    return res.json(restored);
  } catch (error) {
    console.error('Error restoring post:', error);
    return res.status(500).json({ error: 'Failed to restore post' });
  }
});

// Update post (author only)
postsRouter.patch('/:id', requireAuth as any, async (req: AuthedRequest, res) => {
  const postId = String(req.params.id);
  const userId = req.user!.id;
  
  const schema = z.object({
    content: z.string().min(1).max(5000).optional(),
    title: z.string().max(200).optional(),
  });
  
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  }

  try {
    // Check if post exists and user is the author
    const post = await prisma.post.findFirst({ 
      where: { id: postId, deleted_at: null },
      select: { id: true, author_id: true }
    });
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    if (post.author_id !== userId) {
      return res.status(403).json({ error: 'You can only edit your own posts' });
    }
    
    // Update the post
    const updatedPost = await prisma.post.update({ 
      where: { id: postId },
      data: parsed.data,
      include: {
        author: { select: { id: true, display_name: true, avatar_url: true } },
        _count: { select: { comments: true } },
      }
    });
    
    res.json(updatedPost);
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// Delete comment (author only)
postsRouter.delete('/:postId/comments/:commentId', requireAuth as any, async (req: AuthedRequest, res) => {
  const { postId, commentId } = req.params;
  const userId = req.user!.id;

  try {
    // Check if comment exists and user is the author
    const comment = await prisma.comment.findUnique({ 
      where: { id: commentId },
      select: { id: true, author_id: true, post_id: true }
    });
    
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    if (comment.post_id !== postId) {
      return res.status(400).json({ error: 'Comment does not belong to this post' });
    }
    
    if (comment.author_id !== userId) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }
    
    // Delete the comment
    await prisma.comment.delete({ where: { id: commentId } });
    
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Update comment (author only)
postsRouter.patch('/:postId/comments/:commentId', requireAuth as any, async (req: AuthedRequest, res) => {
  const { postId, commentId } = req.params;
  const userId = req.user!.id;
  
  const schema = z.object({
    content: z.string().min(1).max(1000),
  });
  
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  }

  try {
    // Check if comment exists and user is the author
    const comment = await prisma.comment.findUnique({ 
      where: { id: commentId },
      select: { id: true, author_id: true, post_id: true }
    });
    
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    if (comment.post_id !== postId) {
      return res.status(400).json({ error: 'Comment does not belong to this post' });
    }
    
    if (comment.author_id !== userId) {
      return res.status(403).json({ error: 'You can only edit your own comments' });
    }
    
    // Update the comment
    const updatedComment = await prisma.comment.update({ 
      where: { id: commentId },
      data: { content: parsed.data.content },
      include: {
        author: { select: { id: true, display_name: true, avatar_url: true } }
      }
    });
    
    res.json(updatedComment);
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// New route handler for creating a collage post
postsRouter.post('/collage', requireVerified as any, async (req: AuthedRequest, res) => {
  const { title, postIds } = req.body;

  if (!Array.isArray(postIds) || postIds.length === 0) {
    return res.status(400).json({ error: 'postIds must be a non-empty array' });
  }

  const posts = await prisma.post.findMany({
    where: {
      id: { in: postIds },
      author_id: req.user!.id,
      deleted_at: null,
      media_url: { not: null },
    },
    select: { media_url: true },
    orderBy: { created_at: 'asc' },
  });

  if (posts.length !== postIds.length) {
    return res.status(403).json({ error: 'You can only create a collage from your own posts that have media.' });
  }

  // In a real implementation, we would generate a collage image here.
  // For now, we'll just create a new post with a placeholder media_url
  // representing the collage.

  const newPost = await prisma.post.create({
    data: {
      title: title || 'My Collage',
      content: `A collage of ${posts.length} posts.`,
      author_id: req.user!.id,
      type: 'collage',
      // In a real app, this would be the URL to the generated collage image
      media_url: posts[0].media_url, 
    },
  });

  res.status(201).json(newPost);
});
