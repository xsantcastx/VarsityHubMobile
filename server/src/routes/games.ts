import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const gamesRouter = Router();

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv'];

const isVideoUrl = (url?: string | null) => {
  if (!url) return false;
  const sanitized = url.split('?')[0].toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => sanitized.endsWith(ext));
};

const serializePost = (post: any) => ({
  ...post,
  created_at: post.created_at instanceof Date ? post.created_at.toISOString() : post.created_at,
  author: post.author
    ? {
        id: post.author.id,
        display_name: post.author.display_name,
        avatar_url: post.author.avatar_url,
      }
    : null,
});

const serializeMedia = (story: any) => ({
  id: story.id,
  url: story.media_url,
  kind: isVideoUrl(story.media_url) ? 'video' : 'photo',
  created_at: story.created_at instanceof Date ? story.created_at.toISOString() : story.created_at,
  caption: story.caption ?? null,
  user_id: story.user_id ?? null,
});

const serializeEvent = (event: any | null) =>
  event
    ? {
        id: event.id,
        date: event.date instanceof Date ? event.date.toISOString() : event.date,
        location: event.location,
        banner_url: event.banner_url,
        capacity: event.capacity,
      }
    : null;

const pickBannerUrl = (game: any, event: any | null, media: Array<{ url: string }>) => {
  // Fixed: Prioritize game.banner_url first, then fallback to others
  if (game?.banner_url) return game.banner_url;
  if (game?.cover_image_url) return game.cover_image_url;
  if (event?.banner_url) return event.banner_url;
  return media.length > 0 ? media[0]?.url ?? null : null;
};


const summarizeVotes = async (gameId: string, userId?: string | null) => {
  const [teamA, teamB, mine] = await Promise.all([
    prisma.gameVote.count({ where: { game_id: gameId, team: 'A' } }),
    prisma.gameVote.count({ where: { game_id: gameId, team: 'B' } }),
    userId
      ? prisma.gameVote.findUnique({ where: { game_id_user_id: { game_id: gameId, user_id: userId } } })
      : Promise.resolve(null),
  ]);
  const total = teamA + teamB;
  const pctA = total ? Math.round((teamA / total) * 100) : 0;
  const pctB = total ? 100 - pctA : 0;
  return { teamA, teamB, total, pctA, pctB, userVote: mine?.team ?? null };
};

gamesRouter.get('/', async (req, res) => {
  const sort = String(req.query.sort || '').trim();
  const orderBy =
    sort === '-date'
      ? { date: 'desc' as const }
      : sort === 'date'
        ? { date: 'asc' as const }
        : { created_at: 'desc' as const };
  const games = await prisma.game.findMany({
    orderBy,
    include: { 
      events: { orderBy: { date: 'asc' }, take: 1 },
      _count: { select: { events: true } }
    },
  });
  
  // Get RSVP counts for all games with events
  const gameIds = games.map(g => g.id);
  const eventIds = games.map(g => g.events[0]?.id).filter(Boolean);
  
  const rsvpCounts = eventIds.length > 0 ? await prisma.eventRsvp.groupBy({
    by: ['event_id'],
    _count: { _all: true },
    where: { event_id: { in: eventIds } }
  }) : [];
  
  const rsvpMap = new Map(rsvpCounts.map(r => [r.event_id, r._count._all]));
  
  const payload = games.map((game) => {
    const event = game.events[0] ?? null;
    const { events, _count, ...rest } = game as any;
    return {
      ...rest,
      appearance: rest.appearance ?? null,
      event_id: event?.id ?? null,
      // Fixed: Prioritize game.banner_url over other sources
      banner_url: rest.banner_url || rest.cover_image_url || event?.banner_url || null,
      rsvpCount: event ? (rsvpMap.get(event.id) || 0) : 0,
      // Include coordinates for map display
      latitude: rest.latitude,
      longitude: rest.longitude,
    };
  });
  res.json(payload);
});

// Create a new game
gamesRouter.post('/', requireAuth as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const schema = z.object({
    title: z.string().min(1).max(200),
    home_team: z.string().optional(),
    away_team: z.string().optional(),
    date: z.string().datetime().optional(),
    location: z.string().optional(),
    description: z.string().optional(),
    cover_image_url: z.string().url().optional(),
    banner_url: z.string().url().optional(),
    // Optional appearance preset chosen by coach (e.g. 'classic','sparkle','sporty')
    appearance: z.string().optional(),
    // Coordinate options
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    autoGeocode: z.boolean().optional(),
  });
  
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ 
      error: 'Invalid game data', 
      issues: parsed.error.issues 
    });
  }

  try {
    // Prepare game data
    let gameData: any = {
      ...parsed.data,
      date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
      banner_url: parsed.data.banner_url ?? null,
      cover_image_url: parsed.data.cover_image_url ?? null,
      appearance: parsed.data.appearance ?? null,
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
    };

    // Handle auto-geocoding if requested and location is provided
    if (parsed.data.autoGeocode && parsed.data.location && !parsed.data.latitude && !parsed.data.longitude) {
      try {
        const { geocodeLocation } = await import('../lib/geocoding.js');
        const coords = await geocodeLocation(parsed.data.location);
        if (coords) {
          gameData.latitude = coords.latitude;
          gameData.longitude = coords.longitude;
          console.log(`✅ Auto-geocoded game location: ${parsed.data.location} → ${coords.latitude}, ${coords.longitude}`);
        }
      } catch (geocodeError) {
        console.warn('Auto-geocoding failed, continuing without coordinates:', geocodeError);
        // Continue without coordinates - don't fail the game creation
      }
    }

    const game = await (prisma.game.create as any)({
      data: gameData,
      include: { events: { orderBy: { date: 'asc' }, take: 1 } },
    }) as any;
    
    // Automatically create an associated Event for RSVP functionality
    const event = await prisma.event.create({
      data: {
        title: game.title,
        date: game.date,
        location: game.location || null,
        game_id: game.id,
        status: 'approved', // Auto-approve game events
        capacity: null, // No capacity limit by default
      } as any,
    });
    
    const response = {
      ...game,
      event_id: event.id,
      // Fixed: Ensure banner_url from game data is preserved
      banner_url: game.banner_url,
    };
    
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Get single game by id
gamesRouter.get('/:id', async (req, res) => {
  const id = String(req.params.id);
  const game = await prisma.game.findUnique({
    where: { id },
    include: { events: { orderBy: { date: 'asc' }, take: 1 } },
  });
  if (!game) return res.status(404).json({ error: 'Not found' });
  const event = game.events[0] ?? null;
  const { events, ...rest } = game as any;
  return res.json({ ...rest, appearance: rest.appearance ?? null, event_id: event?.id ?? null });
});

// Compact summary payload for the Game Details screen
gamesRouter.get('/:id/summary', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      events: { orderBy: { date: 'asc' }, take: 1 },
      posts: {
        where: { game_id: id },
        orderBy: [{ upvotes_count: 'desc' }, { created_at: 'desc' }],
        take: 50,
        include: {
          author: { select: { id: true, display_name: true, avatar_url: true } },
          _count: { select: { comments: true } },
        },
      },
      stories: { orderBy: { created_at: 'desc' }, take: 50 },
    },
  });
  if (!game) return res.status(404).json({ error: 'Not found' });

  const event = game.events[0] ?? null;
  const posts = game.posts.map(serializePost);
  const media = game.stories.map(serializeMedia);
  const bannerUrl = pickBannerUrl(game, event, media);
  const location = game.location || event?.location || null;
  const anchorDate = event?.date ?? game.date;
  const isPast = anchorDate instanceof Date ? anchorDate.getTime() < Date.now() : new Date(anchorDate).getTime() < Date.now();

  const [reviewsCount, rsvpCount, userRsvped] = await (async () => {
    const reviewPromise = prisma.post.count({ where: { game_id: id, type: 'review' } });
    if (!event) {
      const [reviewTotal] = await Promise.all([reviewPromise]);
      return [reviewTotal, 0, false] as const;
    }
    const countPromise = prisma.eventRsvp.count({ where: { event_id: event.id } });
    const userPromise = req.user
      ? prisma.eventRsvp.findUnique({
          where: { event_id_user_id: { event_id: event.id, user_id: req.user.id } } as any,
          select: { id: true },
        })
      : Promise.resolve(null);
    const [reviewTotal, count, userRow] = await Promise.all([reviewPromise, countPromise, userPromise]);
    return [reviewTotal, count, Boolean(userRow)] as const;
  })();

  return res.json({
    id: game.id,
    title: game.title,
    appearance: game.appearance ?? null,
    homeTeam: game.home_team || null,
    awayTeam: game.away_team || null,
    date: game.date instanceof Date ? game.date.toISOString() : game.date,
    timeLocal: null,
    location,
    description: game.description,
    bannerUrl,
    coverImageUrl: game.cover_image_url,
    eventId: event?.id ?? null,
    capacity: event?.capacity ?? null,
    rsvpCount,
    userRsvped,
    teams: [],
    posts,
    media,
    reviewsCount,
    isPast,
    event: serializeEvent(event),
  });
});


gamesRouter.get('/:id/votes/summary', async (req: AuthedRequest, res) => {
  const gameId = String(req.params.id);
  const summary = await summarizeVotes(gameId, req.user?.id);
  res.json(summary);
});

gamesRouter.post('/:id/votes', requireAuth as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const gameId = String(req.params.id);
  const teamInput = String((req.body?.team ?? '')).trim().toUpperCase();
  if (teamInput !== 'A' && teamInput !== 'B') {
    return res.status(400).json({ error: 'Invalid team option' });
  }

  await prisma.gameVote.upsert({
    where: { game_id_user_id: { game_id: gameId, user_id: req.user.id } },
    update: { team: teamInput },
    create: { game_id: gameId, user_id: req.user.id, team: teamInput },
  });

  const summary = await summarizeVotes(gameId, req.user.id);
  res.json(summary);
});

gamesRouter.delete('/:id/votes', requireAuth as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const gameId = String(req.params.id);
  await prisma.gameVote.deleteMany({ where: { game_id: gameId, user_id: req.user.id } });
  const summary = await summarizeVotes(gameId, req.user.id);
  res.json(summary);
});

// Delete a game
gamesRouter.delete('/:id', requireAuth as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const id = String(req.params.id);
  
  try {
    // Check if game exists
    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) return res.status(404).json({ error: 'Game not found' });
    
    // Delete the game (cascade deletes will handle related records)
    await prisma.game.delete({ where: { id } });
    
    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

// Posts tied to a game
gamesRouter.get('/:id/posts', async (req, res) => {
  const id = String(req.params.id);
  const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 100);
  const posts = await prisma.post.findMany({
    where: { game_id: id },
    orderBy: [{ upvotes_count: 'desc' }, { created_at: 'desc' }],
    take: limit,
    include: {
      author: { select: { id: true, display_name: true, avatar_url: true } },
      _count: { select: { comments: true } },
    },
  });
  res.json(posts.map(serializePost));
});

// Media (stories) tied to a game
gamesRouter.get('/:id/media', async (req, res) => {
  const id = String(req.params.id);
  const items = await prisma.story.findMany({
    where: { game_id: id },
    orderBy: { created_at: 'desc' },
  });
  res.json(items.map(serializeMedia));
});

// Delete a specific media/story from a game
gamesRouter.delete('/:id/media/:mediaId', requireAuth as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const gameId = String(req.params.id);
  const mediaId = String(req.params.mediaId);
  
  try {
    // Find the story first to check ownership
    const story = await prisma.story.findUnique({
      where: { id: mediaId },
      select: { id: true, user_id: true, game_id: true },
    });
    
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    
    // Verify the story belongs to this game
    if (story.game_id !== gameId) {
      return res.status(400).json({ error: 'Story does not belong to this game' });
    }
    
    // Verify the user owns this story
    if (story.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own stories' });
    }
    
    // Delete the story
    await prisma.story.delete({ where: { id: mediaId } });
    
    console.log(`✅ User ${req.user.id} deleted story ${mediaId} from game ${gameId}`);
    res.json({ message: 'Story deleted successfully' });
  } catch (error) {
    console.error('Error deleting story:', error);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

// Legacy stories endpoints (kept for backwards compatibility)
gamesRouter.get('/:id/stories', async (req, res) => {
  const id = String(req.params.id);
  const stories = await prisma.story.findMany({ where: { game_id: id }, orderBy: { created_at: 'desc' } });
  return res.json(stories);
});

gamesRouter.post('/:id/stories', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const id = String(req.params.id);
  const schema = z.object({ media_url: z.string().min(1), caption: z.string().optional() });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const story = await prisma.story.create({
    data: {
      game_id: id,
      user_id: req.user.id,
      media_url: parsed.data.media_url,
      caption: parsed.data.caption,
    },
  });
  return res.status(201).json(story);
});

// Update cover image
gamesRouter.patch('/:id', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const schema = z.object({ cover_image_url: z.string().url().optional(), appearance: z.string().optional() });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const game = await prisma.game.update({ where: { id }, data: { cover_image_url: parsed.data.cover_image_url, appearance: parsed.data.appearance ?? undefined } });
  return res.json(game);
});
