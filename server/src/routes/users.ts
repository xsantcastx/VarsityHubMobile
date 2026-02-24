import { Router } from 'express';
import { notifyNewFollower } from '../lib/notifications.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { mentionsSearchLimiter, userLookupLimiter } from '../middleware/rateLimiters.js';

export const usersRouter = Router();
const publicUserSelect = {
  id: true,
  username: true,
  display_name: true,
  avatar_url: true,
};

// List users (admin only)
usersRouter.get('/', requireAdmin as any, async (req, res) => {
  const q = String((req.query as any).q || '').trim().toLowerCase();
  const banned = String((req.query as any).banned || '') === '1';
  const limit = Math.min(parseInt(String((req.query as any).limit || '100'), 10) || 100, 500);
  const where: any = {};
  if (q) where.OR = [
    { email: { contains: q, mode: 'insensitive' } },
    { username: { contains: q, mode: 'insensitive' } }, // Search by username only
  ];
  if (banned) where.banned = true;
  const rows = await prisma.user.findMany({
    where,
    take: limit,
    orderBy: { created_at: 'desc' },
    select: { id: true, email: true, username: true, email_verified: true, banned: true, created_at: true },
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
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, username: true, email_verified: true, banned: true, created_at: true } });
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

// GET /users/me/export - GDPR/CCPA data portability: export all user data as JSON
usersRouter.get('/me/export', requireAuth as any, async (req: AuthedRequest, res) => {
  const id = req.user!.id;
  try {
    const [user, posts, comments, messagesSent, following, followers] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          display_name: true,
          username: true,
          avatar_url: true,
          bio: true,
          created_at: true,
          email_verified: true,
          preferences: true,
        },
      }),
      prisma.post.findMany({
        where: { author_id: id },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          title: true,
          content: true,
          type: true,
          media_url: true,
          upvotes_count: true,
          created_at: true,
          deleted_at: true,
          game_id: true,
          team_id: true,
        },
      }),
      prisma.comment.findMany({
        where: { author_id: id } as any,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          post_id: true,
          content: true,
          created_at: true,
        },
      }),
      prisma.message.findMany({
        where: { sender_id: id },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          recipient_id: true,
          content: true,
          read: true,
          created_at: true,
        },
      }),
      prisma.follows.findMany({
        where: { follower_id: id },
        select: { following_id: true, created_at: true },
      }),
      prisma.follows.findMany({
        where: { following_id: id },
        select: { follower_id: true, created_at: true },
      }),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      profile: user
        ? {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            username: user.username,
            avatar_url: user.avatar_url,
            bio: user.bio,
            created_at: user.created_at instanceof Date ? user.created_at.toISOString() : user.created_at,
            email_verified: user.email_verified,
          }
        : null,
      preferences: (user?.preferences as object) ?? {},
      posts: posts.map((p) => ({
        ...p,
        created_at: p.created_at instanceof Date ? p.created_at.toISOString() : p.created_at,
        deleted_at: p.deleted_at instanceof Date ? p.deleted_at.toISOString() : p.deleted_at,
      })),
      comments: comments.map((c) => ({
        ...c,
        created_at: c.created_at instanceof Date ? c.created_at.toISOString() : c.created_at,
      })),
      messages_sent: messagesSent.map((m) => ({
        ...m,
        created_at: m.created_at instanceof Date ? m.created_at.toISOString() : m.created_at,
      })),
      following: following.map((f) => ({
        user_id: f.following_id,
        created_at: f.created_at instanceof Date ? f.created_at.toISOString() : f.created_at,
      })),
      followers: followers.map((f) => ({
        user_id: f.follower_id,
        created_at: f.created_at instanceof Date ? f.created_at.toISOString() : f.created_at,
      })),
    };

    const json = JSON.stringify(exportData, null, 2);
    const filename = `varsityhub-data-export-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(json);
  } catch (e: any) {
    console.error('Data export error:', e);
    return res.status(500).json({ error: 'Failed to export data', message: e?.message || 'Unknown error' });
  }
});

// CSV export of user's ads and reservations (admin only)
usersRouter.get('/:id/export', requireAdmin as any, async (req, res) => {
  const id = String(req.params.id);
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, username: true } });
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

/** Returns true if profile owner has profile_private and viewer is not owner/follower */
async function isProfileHiddenFromViewer(ownerId: string, viewerId: string | null): Promise<boolean> {
  if (!viewerId || viewerId === ownerId) return false;
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { preferences: true },
  });
  const prefs = (owner?.preferences || {}) as any;
  if (prefs?.profile_private !== true) return false;
  const rel = await prisma.follows.findUnique({
    where: { follower_id_following_id: { follower_id: viewerId, following_id: ownerId } },
    select: { follower_id: true },
  });
  return !rel; // Hidden if not a follower
}

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
      ? { id: post.author.id, username: post.author.username, avatar_url: post.author.avatar_url }
      : null,
  };
}

// GET /users/:id/posts?cursor=...&limit=...&sort=...
usersRouter.get('/:id/posts', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const currentUserId = req.user?.id || null;
  const hidden = await isProfileHiddenFromViewer(id, currentUserId);
  if (hidden) {
    return res.json({ items: [], nextCursor: null, counts: { posts: 0, likes: 0, comments: 0, reposts: 0, saves: 0 } });
  }
  const limit = Math.min(parseInt(String(req.query.limit || '10'), 10) || 10, 50);
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'newest';

  const orderBy = sortParamToOrder(sort);
  const query: any = {
    where: { author_id: id, deleted_at: null },
    take: limit + 1,
    orderBy,
    include: {
      author: { select: { id: true, username: true, avatar_url: true } },
      _count: { select: { comments: true, bookmarks: true } },
    },
  };
  if (cursor) { query.cursor = { id: cursor }; query.skip = 1; }
  const rows = await prisma.post.findMany(query);
  const items = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? rows[limit].id : null;

  const payload = items.map(mapPostForPayload);
  const counts = {
    posts: await prisma.post.count({ where: { author_id: id, deleted_at: null } }),
    likes: await prisma.postUpvote.count({ where: { user_id: id } }),
    comments: await prisma.comment.count({ where: { author_id: id } as any }),
    reposts: 0,
    saves: await prisma.postBookmark.count({ where: { user_id: id } }),
  };

  return res.json({ items: payload, nextCursor, counts });
});

// GET /users/:id/interactions?type=like|comment|repost|save|all&cursor=...&limit=...&sort=...
usersRouter.get('/:id/interactions', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const currentUserId = req.user?.id || null;
  const hidden = await isProfileHiddenFromViewer(id, currentUserId);
  if (hidden) {
    return res.json({ items: [], nextCursor: null, counts: { posts: 0, likes: 0, comments: 0, reposts: 0, saves: 0 } });
  }
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
  const likeCounts = await prisma.post.findMany({ where: { id: { in: list.map(i => i.post_id) }, deleted_at: null }, select: { id: true, upvotes_count: true } });
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
    where: { id: { in: postIds }, deleted_at: null },
    include: { author: { select: { id: true, display_name: true, avatar_url: true } }, _count: { select: { comments: true, bookmarks: true } } },
  }) : [];
  // Preserve order of page
  const byId = new Map(posts.map(p => [p.id, p]));
  const ordered = postIds.map(id => byId.get(id)).filter(Boolean).map(mapPostForPayload);

  const counts = {
    posts: await prisma.post.count({ where: { author_id: id, deleted_at: null } }),
    likes: await prisma.postUpvote.count({ where: { user_id: id } }),
    comments: await prisma.comment.count({ where: { author_id: id } as any }),
    reposts: 0,
    saves: await prisma.postBookmark.count({ where: { user_id: id } }),
  };

  return res.json({ items: ordered, nextCursor, counts });
});

// GET /users/:id/teams - Teams the user is a member of (for athlete profile)
usersRouter.get('/:id/teams', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const currentUserId = req.user?.id || null;
  const hidden = await isProfileHiddenFromViewer(id, currentUserId);
  if (hidden) return res.json([]);

  const memberships = await prisma.teamMembership.findMany({
    where: { user_id: id, status: 'active' },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          logo_url: true,
          avatar_url: true,
          sport: true,
          season: true,
        },
      },
    },
    orderBy: { created_at: 'asc' },
  });

  const teams = memberships.map((m) => ({
    id: (m as any).team.id,
    name: (m as any).team.name,
    logo_url: (m as any).team.logo_url ?? null,
    avatar_url: (m as any).team.avatar_url ?? null,
    sport: (m as any).team.sport ?? null,
    season: (m as any).team.season ?? null,
    role: m.role,
    position: (m as any).position ?? null,
    jersey_number: (m as any).jersey_number ?? null,
  }));

  return res.json(teams);
});

// Delete own account (soft-delete with anonymization)
usersRouter.delete('/me', requireAuth as any, async (req: AuthedRequest, res) => {
  const id = req.user!.id;
  const ts = Date.now();
  const deletedEmail = `deleted+${id}+${ts}@example.com`;
  try {
    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Anonymize user data
      await tx.user.update({
        where: { id },
        data: {
          banned: true,
          email: deletedEmail,
          password_hash: `deleted:${ts}:${Math.random().toString(36).slice(2)}`,
          display_name: null,
          username: null,
          avatar_url: null,
          bio: null,
          preferences: {}, // Clear preferences
        },
      });
      
      // Anonymize posts (set author to null or keep but mark as deleted)
      // Note: We keep posts but remove author reference for privacy
      // If you want to delete posts, uncomment:
      // await tx.post.deleteMany({ where: { author_id: id } });
      
      // Remove follows (both directions)
      await tx.follows.deleteMany({
        where: {
          OR: [
            { follower_id: id },
            { following_id: id }
          ]
        }
      });
      
      // Remove upvotes and bookmarks (user's interactions)
      await tx.postUpvote.deleteMany({ where: { user_id: id } });
      await tx.postBookmark.deleteMany({ where: { user_id: id } });
      
      // Anonymize comments (or delete them)
      // Option 1: Delete comments
      await tx.comment.deleteMany({ where: { author_id: id } as any });
      // Option 2: Keep comments but anonymize (if you want to preserve discussion)
      // await tx.comment.updateMany({ where: { author_id: id }, data: { author_id: null } });
    });
    
    return res.json({ deleted: true, message: 'Account deleted successfully' });
  } catch (e: any) {
    console.error('Account deletion error:', e);
    return res.status(500).json({ error: 'Failed to delete account', message: e?.message || 'Unknown error' });
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
// CRITICAL: Requires authentication and rate limiting to prevent email enumeration
usersRouter.get('/lookup', requireAuth as any, userLookupLimiter, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const email = String((req.query as any).email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const u = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, display_name: true }
  });

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
        
        // Send push notification
        const follower = await prisma.user.findUnique({ 
          where: { id: follower_id }, 
          select: { display_name: true } 
        });
        if (follower) {
          await notifyNewFollower(
            following_id,
            follower_id,
            follower.display_name || 'Someone'
          );
        }
      }
    } catch (e) {
      console.error('Failed to send follow notification:', e);
    }
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
usersRouter.get('/:id/followers', requireAuth as any, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const currentUserId = req.user?.id;
  const hidden = await isProfileHiddenFromViewer(id, currentUserId || null);
  if (hidden) return res.json({ items: [], nextCursor: null });
  const limit = Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 50);
  const cursor = (req.query.cursor as string | undefined) || undefined;

  const follows = await prisma.follows.findMany({
    where: { following_id: id },
    take: limit + 1,
    cursor: cursor ? { follower_id_following_id: { follower_id: cursor, following_id: id } } : undefined,
    include: { follower: { select: publicUserSelect } },
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
usersRouter.get('/:id/following', requireAuth as any, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const currentUserId = req.user?.id;
  const hidden = await isProfileHiddenFromViewer(id, currentUserId || null);
  if (hidden) return res.json({ items: [], nextCursor: null });
  const limit = Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 50);
  const cursor = (req.query.cursor as string | undefined) || undefined;

  const follows = await prisma.follows.findMany({
    where: { follower_id: id },
    take: limit + 1,
    cursor: cursor ? { follower_id_following_id: { follower_id: id, following_id: cursor } } : undefined,
    include: { following: { select: publicUserSelect } },
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
usersRouter.get('/search/mentions', requireAuth as any, mentionsSearchLimiter as any, async (req: AuthedRequest, res) => {
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
      avatar_url: true,
      email_verified: true,
    },
    take: limit,
    orderBy: [
      { display_name: 'asc' }
    ]
  });

  // Ensure all fields have safe defaults (no null values that will crash React Native)
  const safeUsers = users.map(user => ({
    id: user.id,
    username: user.username || user.display_name || 'user',
    display_name: user.display_name || user.username || 'User',
    avatar_url: user.avatar_url,
    email_verified: user.email_verified,
  }));

  res.json(safeUsers);
});

// Public profile: basic user info plus counts and is_following flag
// When profile_private is true, non-followers see only display_name and avatar_url.
// NOTE: Keep this AFTER more specific routes like /:id/full, /:id/posts, etc.,
// so it doesn't shadow them.
usersRouter.get('/:id', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const currentUserId = req.user?.id || null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      display_name: true,
      avatar_url: true,
      bio: true,
      created_at: true,
      preferences: true,
    },
  });
  if (!user) return res.status(404).json({ error: 'Not found' });

  const prefs = (user.preferences || {}) as any;
  const profile_private = prefs?.profile_private === true;
  const is_parent = prefs?.is_parent === true;

  // Check if viewer is the profile owner or a follower
  let isFollower = false;
  if (currentUserId === id) {
    isFollower = true; // Owner always sees full profile
  } else if (currentUserId) {
    const rel = await prisma.follows.findUnique({
      where: { follower_id_following_id: { follower_id: currentUserId, following_id: id } },
      select: { follower_id: true },
    });
    isFollower = Boolean(rel);
  }

  // Private profile: non-followers get only basic info
  if (profile_private && !isFollower) {
    return res.json({
      id: user.id,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      profile_private: true,
    });
  }

  const [posts_count, followers_count, following_count, rel] = await Promise.all([
    prisma.post.count({ where: { author_id: id, deleted_at: null } }),
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
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    bio: user.bio,
    created_at: user.created_at,
    posts_count,
    followers_count,
    following_count,
    is_following: Boolean(rel),
    is_parent, // Include parent status for coaches viewing profiles
  });
});

// Block a user
usersRouter.post('/:id/block', requireAuth as any, async (req: AuthedRequest, res) => {
  const blocker_id = req.user!.id;
  const blocked_id = req.params.id;

  if (blocker_id === blocked_id) {
    return res.status(400).json({ error: 'Cannot block yourself' });
  }

  try {
    await prisma.blockedUser.create({
      data: {
        blocker_id,
        blocked_id,
      },
    });
    return res.status(201).json({ success: true });
  } catch (error: any) {
    // Handle duplicate blocking
    if (error.code === 'P2002') {
      return res.status(200).json({ success: true, message: 'User already blocked' });
    }
    console.error('Block user error:', error);
    return res.status(500).json({ error: 'Failed to block user' });
  }
});

// Unblock a user
usersRouter.delete('/:id/block', requireAuth as any, async (req: AuthedRequest, res) => {
  const blocker_id = req.user!.id;
  const blocked_id = req.params.id;

  try {
    await prisma.blockedUser.deleteMany({
      where: {
        blocker_id,
        blocked_id,
      },
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Unblock user error:', error);
    return res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// Get blocked users
usersRouter.get('/blocked', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const blocks = await prisma.blockedUser.findMany({
      where: { blocker_id: req.user!.id },
      include: {
        blocked: {
          select: {
            id: true,
            display_name: true,
            avatar_url: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return res.json(blocks.map(b => b.blocked));
  } catch (error) {
    console.error('Get blocked users error:', error);
    return res.status(500).json({ error: 'Failed to get blocked users' });
  }
});
