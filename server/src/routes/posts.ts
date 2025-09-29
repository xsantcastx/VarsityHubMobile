import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireVerified } from '../middleware/requireVerified.js';

export const postsRouter = Router();


const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.m4v', '.avi', '.mkv'];
const detectMediaType = (url?: string | null): 'video' | 'image' => {
  if (!url) return 'image';
  const sanitized = url.split('?')[0].split('#')[0].toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => sanitized.endsWith(ext)) ? 'video' : 'image';
};


postsRouter.get('/', async (req: AuthedRequest, res) => {
  const sort = typeof req.query.sort === 'string' ? req.query.sort.trim() : '';
  const limit = Math.min(parseInt(String(req.query.limit ?? '10'), 10) || 10, 50);
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
  const currentUserId = req.user?.id ?? null;

  const orderBy = sort === 'trending'
    ? [{ upvotes_count: 'desc' as const }, { created_at: 'desc' as const }]
    : [{ created_at: 'desc' as const }];

  const where: Record<string, any> = {};
  if (req.query.game_id) where.game_id = String(req.query.game_id);
  if (req.query.type) where.type = String(req.query.type);
  if (req.query.user_id) where.author_id = String(req.query.user_id);

  const query: any = {
    where,
    orderBy,
    include: {
      author: { select: { id: true, display_name: true, avatar_url: true } },
      _count: { select: { comments: true, bookmarks: true } },
    },
    take: limit + 1,
  };
  if (cursor) {
    query.cursor = { id: cursor };
    query.skip = 1;
  }

  const rows = await prisma.post.findMany(query);
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
    console.log('[posts] Follow debug:', { 
      currentUserId, 
      authorIds, 
      followingIds: Array.from(followingIds),
      followRecords: follows.length 
    });
  }

  const payload = items.map((post: any) => ({
    id: post.id,
    author_id: post.author_id, // Include author_id for ownership checks
    title: post.title ?? null, // Include title for editing
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
  }));

  return res.json({ items: payload, nextCursor });
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
  const where: any = {};
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
    location: locationSchema,
  })
  // Require at least content or media_url
  .refine((d) => Boolean((d.content && d.content.trim().length > 0) || (d.media_url && d.media_url.trim().length > 0)), {
    message: 'Either content or media_url is required',
    path: ['content'],
  });

import { geocodeZip, getCountryFromReqOrPrefs, reverseGeocode } from '../lib/geo.js';

postsRouter.post('/', requireVerified as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
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
    } catch {}
  } else if (loc.zip || (prefs?.preferences as any)?.zip_code) {
    try {
      const zip = String(loc.zip || (prefs?.preferences as any)?.zip_code);
      const gg = await geocodeZip(zip, preferCountry);
      lat = gg.lat; lng = gg.lng; country_code = gg.country_code || preferCountry;
    } catch {}
  } else {
    country_code = preferCountry || null;
  }

  const post = await prisma.post.create({
    data: {
      title: data.title,
      content: data.content?.trim() || null,
      type: data.type || 'post',
      media_url: data.media_url,
      game_id: data.game_id,
      author_id: req.user.id,
      country_code: country_code || undefined,
      admin1: admin1 || undefined,
      lat: typeof lat === 'number' ? lat : undefined,
      lng: typeof lng === 'number' ? lng : undefined,
    },
  });

  res.status(201).json({ ...post, location: { lat, lng, place_name, country_code } });
});

postsRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  const post = await prisma.post.findUnique({ where: { id }, include: { _count: { select: { comments: true } } } });
  if (!post) return res.status(404).json({ error: 'Not found' });
  res.json(post);
});

// Comments
postsRouter.get('/:id/comments', async (req, res) => {
  const { id } = req.params;
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

postsRouter.post('/:id/comments', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.params;
  const schema = z.object({ content: z.string().min(1).max(1000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const comment = await prisma.comment.create({ data: { post_id: id, author_id: req.user.id, content: parsed.data.content } });
  // Notify post author (if not self)
  try {
    const post = await prisma.post.findUnique({ where: { id }, select: { author_id: true } });
    const recipient = post?.author_id;
    if (recipient && recipient !== req.user.id) {
      await (prisma as any).notification.create({ data: { user_id: recipient, actor_id: req.user.id, type: 'COMMENT', post_id: id, comment_id: comment.id } });
    }
  } catch {}
  res.status(201).json(comment);
});

// Reactions
// Toggle upvote

postsRouter.post('/:id/upvote', requireAuth as any, async (req: AuthedRequest, res) => {
  const postId = String(req.params.id);
  const userId = req.user!.id;

  const existing = await prisma.postUpvote.findUnique({ where: { post_id_user_id: { post_id: postId, user_id: userId } } });
  if (existing) {
    await prisma.$transaction([
      prisma.postUpvote.delete({ where: { post_id_user_id: { post_id: postId, user_id: userId } } }),
      prisma.post.update({ where: { id: postId }, data: { upvotes_count: { decrement: 1 } } }),
    ]);
    const { upvotes_count } = await prisma.post.findUniqueOrThrow({ where: { id: postId }, select: { upvotes_count: true } });
    return res.json({ has_upvoted: false, upvotes_count, upvoted: false, count: upvotes_count });
  }

  await prisma.$transaction([
    prisma.postUpvote.create({ data: { post_id: postId, user_id: userId } }),
    prisma.post.update({ where: { id: postId }, data: { upvotes_count: { increment: 1 } } }),
  ]);
  const { upvotes_count } = await prisma.post.findUniqueOrThrow({ where: { id: postId }, select: { upvotes_count: true } });
  // Notify post author (if not self)
  try {
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { author_id: true } });
    const recipient = post?.author_id;
    if (recipient && recipient !== userId) {
      await (prisma as any).notification.create({ data: { user_id: recipient, actor_id: userId, type: 'UPVOTE', post_id: postId } });
    }
  } catch {}
  return res.json({ has_upvoted: true, upvotes_count, upvoted: true, count: upvotes_count });
});


postsRouter.post('/:id/bookmark', requireAuth as any, async (req: AuthedRequest, res) => {
  const postId = String(req.params.id);
  const userId = req.user!.id;

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
    const post = await prisma.post.findUnique({ 
      where: { id: postId },
      select: { id: true, author_id: true }
    });
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    if (post.author_id !== userId) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }
    
    // Delete the post (cascade will handle related records)
    await prisma.post.delete({ where: { id: postId } });
    
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
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
    const post = await prisma.post.findUnique({ 
      where: { id: postId },
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

