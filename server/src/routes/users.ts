import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const usersRouter = Router();

// List users (admin only)
usersRouter.get('/', requireAdmin as any, async (req, res) => {
  const q = String((req.query as any).q || '').trim().toLowerCase();
  const banned = String((req.query as any).banned || '') === '1';
  const limit = Math.min(parseInt(String((req.query as any).limit || '100'), 10) || 100, 500);
  const where: any = {};
  if (q) where.OR = [
    { email: { contains: q, mode: 'insensitive' } },
    { display_name: { contains: q, mode: 'insensitive' } },
  ];
  if (banned) where.banned = true;
  const rows = await prisma.user.findMany({
    where,
    take: limit,
    orderBy: { created_at: 'desc' },
    select: { id: true, email: true, display_name: true, email_verified: true, banned: true, created_at: true },
  });
  return res.json(rows);
});

// Ban/unban (admin only)
usersRouter.post('/:id/ban', requireAdmin as any, async (req, res) => {
  const id = String(req.params.id);
  const u = await prisma.user.update({ where: { id }, data: { banned: true } });
  return res.json({ ok: true, id: u.id, banned: true });
});

usersRouter.post('/:id/unban', requireAdmin as any, async (req, res) => {
  const id = String(req.params.id);
  const u = await prisma.user.update({ where: { id }, data: { banned: false } });
  return res.json({ ok: true, id: u.id, banned: false });
});

// Full user detail with ads and their reservation dates (admin only)
usersRouter.get('/:id/full', requireAdmin as any, async (req, res) => {
  const id = String(req.params.id);
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, display_name: true, email_verified: true, banned: true, created_at: true } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  const ads = await prisma.ad.findMany({ where: { user_id: id }, orderBy: { created_at: 'desc' } });
  const adIds = ads.map(a => a.id);
  const reservations = adIds.length ? await prisma.adReservation.findMany({ where: { ad_id: { in: adIds } }, orderBy: { date: 'asc' } }) : [];
  const datesByAd: Record<string, string[]> = {};
  for (const r of reservations) {
    const key = r.ad_id;
    if (!datesByAd[key]) datesByAd[key] = [];
    datesByAd[key].push(r.date.toISOString().slice(0,10));
  }
  return res.json({ user, ads, datesByAd });
});

// CSV export of user's ads and reservations
usersRouter.get('/:id/export', requireAdmin as any, async (req, res) => {
  const id = String(req.params.id);
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, display_name: true } });
  if (!user) return res.status(404).send('Not found');
  const ads = await prisma.ad.findMany({ where: { user_id: id }, orderBy: { created_at: 'desc' } });
  const adIds = ads.map(a => a.id);
  const reservations = adIds.length ? await prisma.adReservation.findMany({ where: { ad_id: { in: adIds } }, orderBy: { date: 'asc' } }) : [];
  const datesByAd: Record<string, string[]> = {};
  for (const r of reservations) {
    const key = r.ad_id;
    if (!datesByAd[key]) datesByAd[key] = [];
    datesByAd[key].push(r.date.toISOString().slice(0,10));
  }
  let csv = 'ad_id,business_name,status,payment_status,created_at,reservation_dates\n';
  for (const a of ads) {
    const dates = (datesByAd[a.id] || []).join(';');
    const row = [a.id, a.business_name || '', a.status || '', a.payment_status || '', a.created_at.toISOString(), dates]
      .map((v) => '"' + String(v).replace(/"/g,'""') + '"').join(',');
    csv += row + '\n';
  }
  const filename = `user-${user.id}-ads.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csv);
});

// =============================
// Profile: Posts & Interactions
// =============================

const sortParamToOrder = (sort?: string) => {
  switch (sort) {
    case 'most_upvoted':
      return [{ upvotes_count: 'desc' as const }, { created_at: 'desc' as const }];
    case 'most_commented':
      return [{ comments: { _count: 'desc' as any } } as any, { created_at: 'desc' as const }];
    default:
      return [{ created_at: 'desc' as const }];
  }
};

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.m4v', '.avi', '.mkv'];
const detectMediaType = (url?: string | null): 'video' | 'image' => {
  if (!url) return 'image';
  const sanitized = url.split('?')[0].split('#')[0].toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => sanitized.endsWith(ext)) ? 'video' : 'image';
};

function mapPostForPayload(post: any) {
  return {
    id: post.id,
    media_url: post.media_url ?? null,
    media_type: detectMediaType(post.media_url),
    caption: post.content ?? null,
    upvotes_count: post.upvotes_count ?? 0,
    comments_count: post._count?.comments ?? 0,
    bookmarks_count: post._count?.bookmarks ?? 0,
    created_at: post.created_at instanceof Date ? post.created_at.toISOString() : post.created_at,
    author: post.author
      ? { id: post.author.id, display_name: post.author.display_name, avatar_url: post.author.avatar_url }
      : null,
  };
}

// GET /users/:id/posts?cursor=...&limit=...&sort=...
usersRouter.get('/:id/posts', async (req, res) => {
  const id = String(req.params.id);
  const limit = Math.min(parseInt(String(req.query.limit || '10'), 10) || 10, 50);
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'newest';

  const orderBy = sortParamToOrder(sort);
  const query: any = {
    where: { author_id: id },
    take: limit + 1,
    orderBy,
    include: {
      author: { select: { id: true, display_name: true, avatar_url: true } },
      _count: { select: { comments: true, bookmarks: true } },
    },
  };
  if (cursor) { query.cursor = { id: cursor }; query.skip = 1; }
  const rows = await prisma.post.findMany(query);
  const items = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? rows[limit].id : null;

  const payload = items.map(mapPostForPayload);
  const counts = {
    posts: await prisma.post.count({ where: { author_id: id } }),
    likes: await prisma.postUpvote.count({ where: { user_id: id } }),
    comments: await prisma.comment.count({ where: { author_id: id } as any }),
    reposts: 0,
    saves: await prisma.postBookmark.count({ where: { user_id: id } }),
  };

  return res.json({ items: payload, nextCursor, counts });
});

// GET /users/:id/interactions?type=like|comment|repost|save|all&cursor=...&limit=...&sort=...
usersRouter.get('/:id/interactions', async (req, res) => {
  const id = String(req.params.id);
  const limit = Math.min(parseInt(String(req.query.limit || '10'), 10) || 10, 50);
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'newest';
  const type = typeof req.query.type === 'string' ? req.query.type : 'all';

  // Collect interactions
  const likeRows = (type === 'all' || type === 'like')
    ? await prisma.postUpvote.findMany({ where: { user_id: id }, select: { post_id: true, created_at: true } }) : [];
  const commentRows = (type === 'all' || type === 'comment')
    ? await prisma.comment.findMany({ where: { author_id: id } as any, select: { post_id: true, created_at: true } }) : [];
  // No repost model yet
  const saveRows = (type === 'all' || type === 'save')
    ? await prisma.postBookmark.findMany({ where: { user_id: id }, select: { post_id: true, created_at: true } }) : [];

  type Item = { post_id: string; ts: Date };
  const merged: Record<string, Item> = {};
  for (const r of likeRows) {
    const k = r.post_id; const ts = r.created_at as Date;
    if (!merged[k] || merged[k].ts < ts) merged[k] = { post_id: k, ts };
  }
  for (const r of commentRows) {
    const k = r.post_id!; const ts = r.created_at as Date;
    if (!merged[k] || merged[k].ts < ts) merged[k] = { post_id: k, ts };
  }
  for (const r of saveRows) {
    const k = r.post_id; const ts = r.created_at as Date;
    if (!merged[k] || merged[k].ts < ts) merged[k] = { post_id: k, ts };
  }
  let list = Object.values(merged);

  // Sorting
  if (sort === 'most_upvoted') {
    const likeCounts = await prisma.post.findMany({ where: { id: { in: list.map(i => i.post_id) } }, select: { id: true, upvotes_count: true } });
    const likeMap = new Map(likeCounts.map(p => [p.id, p.upvotes_count || 0]));
    list.sort((a, b) => (likeMap.get(b.post_id)! - likeMap.get(a.post_id)!));
  } else if (sort === 'most_commented') {
    const commentCounts = await prisma.comment.groupBy({ by: ['post_id'], _count: { _all: true }, where: { post_id: { in: list.map(i => i.post_id) } } });
    const cMap = new Map(commentCounts.map(c => [c.post_id!, c._count._all]));
    list.sort((a, b) => (cMap.get(b.post_id)! - cMap.get(a.post_id)!));
  } else {
    list.sort((a, b) => b.ts.getTime() - a.ts.getTime());
  }

  // Cursor pagination (keyset on (ts, post_id))
  let start = 0;
  if (cursor) {
    const [tsStr, pid] = cursor.split('::');
    const ts = new Date(tsStr);
    const idx = list.findIndex(i => i.ts.getTime() === ts.getTime() && i.post_id === pid);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const slice = list.slice(start, start + limit + 1);
  const page = slice.slice(0, limit);
  const next = slice.length > limit ? slice[limit] : null;
  const nextCursor = next ? `${next.ts.toISOString()}::${next.post_id}` : null;

  const postIds = page.map(i => i.post_id);
  const posts = postIds.length ? await prisma.post.findMany({
    where: { id: { in: postIds } },
    include: { author: { select: { id: true, display_name: true, avatar_url: true } }, _count: { select: { comments: true, bookmarks: true } } },
  }) : [];
  // Preserve order of page
  const byId = new Map(posts.map(p => [p.id, p]));
  const ordered = postIds.map(id => byId.get(id)).filter(Boolean).map(mapPostForPayload);

  const counts = {
    posts: await prisma.post.count({ where: { author_id: id } }),
    likes: await prisma.postUpvote.count({ where: { user_id: id } }),
    comments: await prisma.comment.count({ where: { author_id: id } as any }),
    reposts: 0,
    saves: await prisma.postBookmark.count({ where: { user_id: id } }),
  };

  return res.json({ items: ordered, nextCursor, counts });
});

// Delete own account (soft-delete)
usersRouter.delete('/me', requireAuth as any, async (req: AuthedRequest, res) => {
  const id = req.user!.id;
  const ts = Date.now();
  const deletedEmail = `deleted+${id}+${ts}@example.com`;
  try {
    await prisma.user.update({
      where: { id },
      data: {
        banned: true,
        email: deletedEmail,
        password_hash: `deleted:${ts}:${Math.random().toString(36).slice(2)}`,
        display_name: null,
        avatar_url: null,
        bio: null,
      },
    });
    return res.json({ deleted: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Username availability check (public to authed users)
usersRouter.get('/username-available', requireAuth as any, async (req: AuthedRequest, res) => {
  const username = String((req.query as any).username || '').trim();
  const valid = /^[a-z0-9_.]{3,20}$/.test(username);
  if (!valid) return res.json({ available: false, valid: false });
  
  // Check both username and display_name fields for conflicts, excluding current user
  const currentUserId = req.user?.id;
  const exists = await prisma.user.findFirst({ 
    where: { 
      OR: [
        { username: { equals: username, mode: 'insensitive' } },
        { display_name: { equals: username, mode: 'insensitive' } }
      ],
      NOT: { id: currentUserId } // Exclude current user from check
    }, 
    select: { id: true } 
  });
  
  return res.json({ available: !exists, valid: true });
});

// Lookup user by email (for onboarding authorized users flow)
usersRouter.get('/lookup', async (req, res) => {
  const email = String((req.query as any).email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Invalid email' });
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, display_name: true } });
  if (!u) return res.status(404).json({ error: 'Not found' });
  return res.json(u);
});

// Follow a user
usersRouter.post('/:id/follow', requireAuth as any, async (req: AuthedRequest, res) => {
  const follower_id = req.user!.id;
  const following_id = req.params.id;

  if (follower_id === following_id) {
    return res.status(400).json({ error: 'You cannot follow yourself.' });
  }

  try {
    await prisma.follows.create({
      data: {
        follower_id,
        following_id,
      },
    });
    // Create follow notification for the recipient
    try {
      if (follower_id !== following_id) {
        await (prisma as any).notification.create({
          data: {
            user_id: following_id,
            actor_id: follower_id,
            type: 'FOLLOW' as any,
          },
        });
      }
    } catch {}
    // Return is_following_author for caller
    res.status(201).json({ is_following_author: true });
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Unfollow a user
usersRouter.delete('/:id/follow', requireAuth as any, async (req: AuthedRequest, res) => {
  const follower_id = req.user!.id;
  const following_id = req.params.id;

  try {
    await prisma.follows.delete({
      where: {
        follower_id_following_id: {
          follower_id,
          following_id,
        },
      },
    });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Get followers
usersRouter.get('/:id/followers', async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const currentUserId = req.user?.id;
  const limit = Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 50);
  const cursor = (req.query.cursor as string | undefined) || undefined;

  const follows = await prisma.follows.findMany({
    where: { following_id: id },
    take: limit + 1,
    cursor: cursor ? { follower_id_following_id: { follower_id: cursor, following_id: id } } : undefined,
    include: { follower: true },
  });

  const users = follows.slice(0, limit).map(f => f.follower);
  const nextCursor = follows.length > limit ? follows[limit].follower_id : null;

  if (currentUserId) {
    const userIds = users.map(u => u.id);
    const followingSet = new Set(
      (await prisma.follows.findMany({
        where: {
          follower_id: currentUserId,
          following_id: { in: userIds },
        },
        select: { following_id: true },
      })).map(f => f.following_id)
    );
    users.forEach(u => (u as any).is_following = followingSet.has(u.id));
  }

  res.json({ items: users, nextCursor });
});

// Get following
usersRouter.get('/:id/following', async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const currentUserId = req.user?.id;
  const limit = Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 50);
  const cursor = (req.query.cursor as string | undefined) || undefined;

  const follows = await prisma.follows.findMany({
    where: { follower_id: id },
    take: limit + 1,
    cursor: cursor ? { follower_id_following_id: { follower_id: id, following_id: cursor } } : undefined,
    include: { following: true },
  });

  const users = follows.slice(0, limit).map(f => f.following);
  const nextCursor = follows.length > limit ? follows[limit].following_id : null;

  if (currentUserId) {
    const userIds = users.map(u => u.id);
    const followingSet = new Set(
      (await prisma.follows.findMany({
        where: {
          follower_id: currentUserId,
          following_id: { in: userIds },
        },
        select: { following_id: true },
      })).map(f => f.following_id)
    );
    users.forEach(u => (u as any).is_following = followingSet.has(u.id));
  }

  res.json({ items: users, nextCursor });
});

// Search users for mentions/tagging
usersRouter.get('/search/mentions', requireAuth as any, async (req: AuthedRequest, res) => {
  const currentUserId = req.user!.id;
  const query = String((req.query as any).q || '').trim().toLowerCase();
  const limit = Math.min(parseInt(String((req.query as any).limit || '10'), 10) || 10, 20);

  if (!query) {
    return res.json({ users: [] });
  }

  // Search all users by username, display_name, or email
  const users = await prisma.user.findMany({
    where: {
      AND: [
        { banned: false },
        {
          OR: [
            // Search by username
            { username: { contains: query, mode: 'insensitive' } },
            // Search by display name
            { display_name: { contains: query, mode: 'insensitive' } },
            // Search by email (for team invites)
            { email: { contains: query, mode: 'insensitive' } }
          ]
        }
      ]
    },
    select: {
      id: true,
      username: true,
      display_name: true,
      email: true,
      avatar_url: true,
      verified: true,
    },
    take: limit,
    orderBy: [
      { display_name: 'asc' }
    ]
  });

  res.json({ users });
});

// Public profile: basic user info plus counts and is_following flag
// NOTE: Keep this AFTER more specific routes like /:id/full, /:id/posts, etc.,
// so it doesn't shadow them.
usersRouter.get('/:id', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const currentUserId = req.user?.id || null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      display_name: true,
      avatar_url: true,
      bio: true,
      created_at: true,
    },
  });
  if (!user) return res.status(404).json({ error: 'Not found' });

  const [posts_count, followers_count, following_count, rel] = await Promise.all([
    prisma.post.count({ where: { author_id: id } }),
    prisma.follows.count({ where: { following_id: id } }),
    prisma.follows.count({ where: { follower_id: id } }),
    currentUserId
      ? prisma.follows.findUnique({
          where: { follower_id_following_id: { follower_id: currentUserId, following_id: id } },
          select: { follower_id: true },
        })
      : Promise.resolve(null),
  ]);

  return res.json({
    ...user,
    posts_count,
    followers_count,
    following_count,
    is_following: Boolean(rel),
  });
});
