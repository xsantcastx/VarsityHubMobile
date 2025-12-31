import { Router } from 'express';
import { debugLog } from '../lib/debugLog.js';
import { prisma } from '../lib/prisma.js';

export const searchRouter = Router();

const clampLimit = (value: any, fallback = 5, max = 25) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(parsed, max);
  }
  return fallback;
};

searchRouter.get('/', async (req, res) => {
  const rawQ = String((req.query as any).q || '').trim();
  const limit = clampLimit((req.query as any).limit, 5, 25);

  if (!rawQ || rawQ.length === 0) {
    return res.status(400).json({ error: 'Missing search query (q)' });
  }

  const q = rawQ.slice(0, 80); // prevent unbounded strings
  const textMatch = { contains: q, mode: 'insensitive' as const };

  try {
    const [users, teams, organizations, games, posts, highlights, events] = await Promise.all([
      prisma.user.findMany({
        where: {
          OR: [
            { display_name: textMatch },
            { username: textMatch },
            { email: textMatch },
          ],
        },
        select: {
          id: true,
          display_name: true,
          username: true,
          avatar_url: true,
          bio: true,
          preferences: true,
          created_at: true,
        },
        take: limit,
      }),
      prisma.team.findMany({
        where: {
          OR: [
            { name: textMatch },
            { city: textMatch },
            { state: textMatch },
            { league: textMatch },
            { sport: textMatch },
          ],
        },
        include: {
          _count: { select: { memberships: true } },
        },
        take: limit,
      }),
      prisma.organization.findMany({
        where: {
          OR: [
            { name: textMatch },
            { location: textMatch },
            { formatted_address: textMatch },
            { sport: textMatch },
            { org_type: textMatch },
          ],
        },
        include: { _count: { select: { teams: true } } },
        take: limit,
      }),
      prisma.game.findMany({
        where: {
          OR: [
            { title: textMatch },
            { location: textMatch },
            { home_team: textMatch },
            { away_team: textMatch },
            { away_team_name: textMatch },
          ],
        },
        select: {
          id: true,
          title: true,
          location: true,
          date: true,
          cover_image_url: true,
          banner_url: true,
          home_team: true,
          away_team: true,
          created_at: true,
        },
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
        take: limit,
      }),
      prisma.post.findMany({
        where: {
          OR: [
            { title: textMatch },
            { content: textMatch },
          ],
        },
        select: {
          id: true,
          title: true,
          content: true,
          media_url: true,
          created_at: true,
          upvotes_count: true,
          type: true,
        },
        orderBy: [{ created_at: 'desc' }],
        take: limit,
      }),
      prisma.post.findMany({
        where: {
          OR: [
            { title: textMatch },
            { content: textMatch },
          ],
          OR: [{ type: { equals: 'highlight', mode: 'insensitive' as any } }, { type: 'highlight' }],
        },
        select: {
          id: true,
          title: true,
          content: true,
          media_url: true,
          created_at: true,
          upvotes_count: true,
          type: true,
        },
        orderBy: [{ created_at: 'desc' }],
        take: limit,
      }),
      prisma.event.findMany({
        where: {
          approval_status: 'approved',
          OR: [
            { title: textMatch },
            { description: textMatch },
            { location: textMatch },
          ],
        },
        select: {
          id: true,
          title: true,
          description: true,
          date: true,
          location: true,
          banner_url: true,
          cover_image_url: true,
          event_type: true,
        },
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
        take: limit,
      }),
    ]);

    debugLog('🔍 Universal search', {
      q,
      limit,
      users: users.length,
      teams: teams.length,
      organizations: organizations.length,
      games: games.length,
      posts: posts.length,
      highlights: highlights.length,
      events: events.length,
    });

    return res.json({
      users: users.map((u) => ({
        id: u.id,
        display_name: u.display_name,
        username: u.username,
        avatar_url: u.avatar_url,
        bio: u.bio,
        role: (u.preferences as any)?.role || null,
        created_at: u.created_at,
      })),
      teams: teams.map((t: any) => ({
        id: t.id,
        name: t.name,
        logo_url: t.logo_url || t.avatar_url || null,
        city: t.city,
        state: t.state,
        sport: t.sport,
        members_count: t._count?.memberships ?? 0,
      })),
      organizations: organizations.map((o: any) => ({
        id: o.id,
        name: o.name,
        logo_url: o.logo_url || null,
        location: o.location || o.formatted_address || null,
        sport: o.sport,
        org_type: o.org_type,
        teams_count: o._count?.teams ?? 0,
      })),
      games: games.map((g) => ({
        id: g.id,
        title: g.title,
        location: g.location,
        date: g.date,
        cover_image_url: g.cover_image_url || g.banner_url || null,
        teams: {
          home: g.home_team || null,
          away: g.away_team || g.away_team_name || null,
        },
      })),
      posts: posts.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        media_url: p.media_url,
        created_at: p.created_at,
        upvotes_count: p.upvotes_count ?? 0,
        type: p.type || null,
      })),
      highlights: highlights.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        media_url: p.media_url,
        created_at: p.created_at,
        upvotes_count: p.upvotes_count ?? 0,
        type: p.type || 'highlight',
      })),
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        location: e.location,
        date: e.date,
        cover_image_url: e.cover_image_url || e.banner_url || null,
        event_type: e.event_type || null,
      })),
    });
  } catch (err: any) {
    console.error('[search] Failed to run search', err);
    return res.status(500).json({ error: 'Search failed' });
  }
});
