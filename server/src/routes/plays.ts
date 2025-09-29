import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const playsRouter = Router();

const detectMediaType = (url?: string | null): 'video' | 'image' => {
  if (!url) return 'image';
  const sanitized = url.split('?')[0].split('#')[0].toLowerCase();
  const extensions = ['.mp4', '.mov', '.webm', '.m4v', '.avi', '.mkv'];
  return extensions.some((ext) => sanitized.endsWith(ext)) ? 'video' : 'image';
};

const RANGE_DEFAULT_MS = 7 * 24 * 60 * 60 * 1000;
const parseRangeToMs = (raw: string | null): number => {
  if (!raw) return RANGE_DEFAULT_MS;
  const match = raw.trim().toLowerCase().match(/^(\d+)([dhm])$/);
  if (!match) return RANGE_DEFAULT_MS;
  const value = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(value) || value <= 0) return RANGE_DEFAULT_MS;
  switch (unit) {
    case 'h':
      return value * 60 * 60 * 1000;
    case 'm':
      return value * 60 * 1000;
    default:
      return value * 24 * 60 * 60 * 1000;
  }
};

const EPSILON = 1e-9;
const encodeCursor = (score: number, createdAtIso: string, id: string) => {
  const payload = JSON.stringify({ score, createdAt: createdAtIso, id });
  return Buffer.from(payload, 'utf8').toString('base64');
};

const decodeCursor = (cursor?: string | null) => {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64').toString('utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed?.score !== 'number' || typeof parsed?.createdAt !== 'string' || typeof parsed?.id !== 'string') {
      return null;
    }
    const createdAtMs = new Date(parsed.createdAt).getTime();
    if (!Number.isFinite(createdAtMs)) return null;
    return { score: parsed.score as number, createdAtMs, id: parsed.id as string };
  } catch (error) {
    return null;
  }
};

playsRouter.get('/top', requireAuth as any, async (req: AuthedRequest, res) => {
  const categoryId = typeof req.query.category === 'string' ? req.query.category.trim() : '';
  if (!categoryId) {
    return res.status(400).json({ error: 'category parameter is required' });
  }

  const rangeParam = typeof req.query.range === 'string' ? req.query.range : null;
  const limit = Math.min(parseInt(String(req.query.limit ?? '10'), 10) || 10, 50);
  const cursorRaw = typeof req.query.cursor === 'string' ? req.query.cursor : null;

  const rangeMs = parseRangeToMs(rangeParam);
  const since = new Date(Date.now() - rangeMs);

  const posts = await prisma.post.findMany({
    where: {
      categories: { some: { category_id: categoryId } },
      created_at: { gte: since },
      media_url: { not: null },
    },
    include: {
      author: { select: { id: true, display_name: true, avatar_url: true } },
      _count: { select: { comments: true } },
    },
    orderBy: [{ created_at: 'desc' }],
    take: 200,
  });

  if (!posts.length) {
    res.set('Cache-Control', 'no-store, private');
    return res.json({ items: [], nextCursor: null });
  }

  const nowMs = Date.now();
  const ranked = posts
    .map((post) => {
      const createdAt = new Date(post.created_at ?? new Date());
      const ageHours = Math.max((nowMs - createdAt.getTime()) / 3600000, 0);
      const score = (post.upvotes_count || 0) / Math.pow(ageHours + 2, 1.5);
      return { post, score, createdAt, createdAtMs: createdAt.getTime() };
    })
    .sort((a, b) => {
      if (Math.abs(b.score - a.score) > EPSILON) return b.score - a.score;
      if (b.createdAtMs !== a.createdAtMs) return b.createdAtMs - a.createdAtMs;
      return b.post.id.localeCompare(a.post.id);
    });

  const cursor = decodeCursor(cursorRaw);
  const filtered = cursor
    ? ranked.filter((entry) => {
        if (entry.score < cursor.score - EPSILON) return true;
        if (Math.abs(entry.score - cursor.score) <= EPSILON) {
          if (entry.createdAtMs < cursor.createdAtMs) return true;
          if (entry.createdAtMs === cursor.createdAtMs) {
            return entry.post.id.localeCompare(cursor.id) < 0;
          }
        }
        return false;
      })
    : ranked;

  const paginated = filtered.slice(0, limit + 1);
  const entries = paginated.slice(0, limit);
  const hasMore = paginated.length > limit;

  if (!entries.length) {
    res.set('Cache-Control', 'no-store, private');
    return res.json({ items: [], nextCursor: null });
  }

  const postIds = entries.map((entry) => entry.post.id);
  const authorIds = entries.map((entry) => entry.post.author_id).filter((id): id is string => Boolean(id));

  const currentUserId = req.user?.id ?? null;
  let upvotedIds = new Set<string>();
  let bookmarkedIds = new Set<string>();
  let followingIds = new Set<string>();

  if (currentUserId && postIds.length) {
    const [upvotes, bookmarks, follows] = await Promise.all([
      prisma.postUpvote.findMany({ where: { user_id: currentUserId, post_id: { in: postIds } }, select: { post_id: true } }),
      prisma.postBookmark.findMany({ where: { user_id: currentUserId, post_id: { in: postIds } }, select: { post_id: true } }),
      authorIds.length
        ? prisma.follows.findMany({ where: { follower_id: currentUserId, following_id: { in: authorIds } }, select: { following_id: true } })
        : Promise.resolve([] as Array<{ following_id: string }>),
    ]);
    upvotedIds = new Set(upvotes.map((u) => u.post_id));
    bookmarkedIds = new Set(bookmarks.map((b) => b.post_id));
    followingIds = new Set((follows as Array<{ following_id: string }>).map((f) => f.following_id));
  }

  const items = entries.map((entry) => {
    const { post, createdAt } = entry;
    const author = post.author
      ? {
          id: post.author.id,
          display_name: post.author.display_name,
          avatar_url: post.author.avatar_url ?? null,
        }
      : null;
    return {
      id: post.id,
      media_url: post.media_url,
      media_type: detectMediaType(post.media_url),
      caption: post.content ?? post.title ?? null,
      created_at: createdAt.toISOString(),
      upvotes_count: post.upvotes_count ?? 0,
      comments_count: post._count?.comments ?? 0,
      has_upvoted: upvotedIds.has(post.id),
      has_bookmarked: bookmarkedIds.has(post.id),
      author,
      is_following_author: author ? followingIds.has(author.id) : false,
    };
  });

  const lastEntry = entries[entries.length - 1];
  const nextCursor = hasMore && lastEntry
    ? encodeCursor(lastEntry.score, lastEntry.createdAt.toISOString(), lastEntry.post.id)
    : null;

  res.set('Cache-Control', 'no-store, private');
  return res.json({ items, nextCursor });
});
