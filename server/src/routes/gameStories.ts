import type { Request, Response } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import type { PrismaClient } from '@prisma/client';
import { verifyStoryPostingPermission } from '../lib/geofencing.js';
import { getVideoPreviewUrl } from '../lib/mediaUtils.js';
import { getIsAdmin } from '../middleware/requireAdmin.js';

export const isVideoUrl = (url?: string | null) => {
  if (!url) return false;
  const sanitized = url.split('?')[0].toLowerCase();
  return ['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv'].some((ext) => sanitized.endsWith(ext));
};

export const serializeMedia = (story: any) => {
  const isVideo = isVideoUrl(story.media_url);
  return {
    id: story.id,
    url: story.media_url,
    kind: isVideo ? 'video' : 'photo',
    thumbnail_url: isVideo ? getVideoPreviewUrl(story.media_url) : null,
    created_at: story.created_at instanceof Date ? story.created_at.toISOString() : story.created_at,
    caption: story.caption ?? null,
    user_id: story.user_id ?? null,
    expires_at: story.expires_at instanceof Date ? story.expires_at.toISOString() : (story.expires_at ?? null),
  };
};

const isMissingStoryLocationColumnError = (error: any): boolean => {
  if (!error || error.code !== 'P2022') return false;
  const modelName = String(error?.meta?.modelName ?? '');
  const column = String(error?.meta?.column ?? '');
  return modelName === 'Story' && (column === 'Story.lat' || column === 'Story.lng');
};

const locationSchema = z.object({
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  source: z.enum(['device','places','zip','derived']).nullable().optional(),
}).optional();

const storySchema = z.object({
  media_url: z.string().min(1),
  caption: z.string().optional(),
  location: locationSchema,
});

type StoryDeps = { prisma: PrismaClient };

const STORY_EXPIRY_HOURS = 24;

async function canViewGameMedia(
  prisma: PrismaClient,
  gameId: string,
  req: AuthedRequest,
): Promise<{ allowed: boolean; exists: boolean }> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      approval_status: true,
      created_by_id: true,
      home_team_id: true,
      away_team_id: true,
    } as any,
  });
  if (!game) return { allowed: false, exists: false };
  if ((game as any).approval_status === 'approved') return { allowed: true, exists: true };

  const viewerId = req.user?.id ?? null;
  if (!viewerId) return { allowed: false, exists: true };
  if ((game as any).created_by_id && (game as any).created_by_id === viewerId) return { allowed: true, exists: true };
  if (await getIsAdmin(req as any)) return { allowed: true, exists: true };

  const teamIds = [(game as any).home_team_id, (game as any).away_team_id].filter(Boolean) as string[];
  if (teamIds.length === 0) return { allowed: false, exists: true };

  const teamMembership = await prisma.teamMembership.findFirst({
    where: {
      user_id: viewerId,
      team_id: { in: teamIds },
      role: { in: ['owner', 'manager', 'coach', 'assistant_coach'] },
      status: 'active',
    },
    select: { id: true },
  });
  if (teamMembership) return { allowed: true, exists: true };

  const teams = await prisma.team.findMany({
    where: { id: { in: teamIds } },
    select: { organization_id: true },
  });
  const organizationIds = teams.map((team) => team.organization_id).filter(Boolean) as string[];
  if (organizationIds.length === 0) return { allowed: false, exists: true };

  const orgMembership = await prisma.organizationMembership.findFirst({
    where: {
      user_id: viewerId,
      organization_id: { in: organizationIds },
      role: { in: ['owner', 'manager'] },
      status: 'active',
    },
    select: { id: true },
  });
  return { allowed: !!orgMembership, exists: true };
}

export const makeListMediaHandler = ({ prisma }: StoryDeps) => async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const now = new Date();
  try {
    const visibility = await canViewGameMedia(prisma, id, req as AuthedRequest);
    if (!visibility.exists) return res.status(404).json({ error: 'Not found' });
    if (!visibility.allowed) return res.status(404).json({ error: 'Not found' });

    const items = await prisma.story.findMany({
      where: {
        game_id: id,
        OR: [
          { expires_at: { gt: now } },
          { expires_at: null }, // Backward compat: stories without expires_at still show
        ],
      },
      orderBy: { created_at: 'desc' },
      take: 50,
      select: {
        id: true,
        media_url: true,
        created_at: true,
        caption: true,
        user_id: true,
        expires_at: true,
      },
    });
    // If include_expired=true|1 and user is authenticated, append creator's expired stories
    const rawExpired = String((req as any).query?.include_expired ?? '');
    const includeExpired = rawExpired === '1' || rawExpired === 'true';
    const currentUserId = (req as AuthedRequest).user?.id ?? null;
    if (includeExpired && currentUserId) {
      const expired = await prisma.story.findMany({
        where: {
          game_id: id,
          user_id: currentUserId,
          expires_at: { lte: now },
        },
        orderBy: { created_at: 'desc' },
        take: 20,
        select: {
          id: true,
          media_url: true,
          created_at: true,
          caption: true,
          user_id: true,
          expires_at: true,
        },
      });
      const seen = new Set(items.map((s) => s.id));
      for (const s of expired) {
        if (!seen.has(s.id)) {
          items.push(s);
          seen.add(s.id);
        }
      }
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return res.json(items.map(serializeMedia));
  } catch (error: any) {
    if (isMissingStoryLocationColumnError(error)) {
      console.warn('[stories] Story location columns missing, falling back to legacy query');
      // Validate game id to prevent injection (Prisma parameterizes, but defense-in-depth)
      if (!/^[a-zA-Z0-9_-]+$/.test(id) || id.length > 100) {
        return res.status(400).json({ error: 'Invalid game id' });
      }
      try {
        const items = await prisma.$queryRaw<Array<{
          id: string;
          media_url: string;
          created_at: Date | string;
          caption: string | null;
          user_id: string | null;
        }>>`
          SELECT "id", "media_url", "created_at", "caption", "user_id"
          FROM "Story"
          WHERE "game_id" = ${id}
            AND ("expires_at" IS NULL OR "expires_at" > NOW())
          ORDER BY "created_at" DESC
          LIMIT 50
        `;
        return res.json(items.map(serializeMedia));
      } catch (fallbackError) {
        console.error('[stories] Legacy fallback query failed:', fallbackError);
        return res.status(500).json({ error: 'Failed to load game media' });
      }
    }

    console.error('[stories] Failed to list game media:', error);
    return res.status(500).json({ error: 'Failed to load game media' });
  }
};

export const makeCreateStoryHandler = ({ prisma }: StoryDeps) => async (req: AuthedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const id = String(req.params.id);
  const parsed = storySchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  
  // Skip geofencing for sample games (IDs starting with "sample-")
  const isSampleGame = /^sample-/i.test(id);
  
  if (!isSampleGame) {
    // Fetch game with team IDs so we can check team membership for bypass
    const game = await prisma.game.findUnique({
      where: { id },
      select: {
        id: true,
        home_team_id: true,
        away_team_id: true,
        events: {
          orderBy: { date: 'asc' },
          take: 1,
          select: { id: true, date: true, latitude: true, longitude: true, location: true },
        },
      },
    });

    // Admins and active members of either team bypass geofencing/time-window checks
    const isAdmin = await getIsAdmin(req as any);
    const teamIds = [game?.home_team_id, game?.away_team_id].filter(Boolean) as string[];
    const isTeamMember = teamIds.length > 0
      ? !!(await prisma.teamMembership.findFirst({
          where: { user_id: req.user.id, team_id: { in: teamIds }, status: 'active' },
          select: { id: true },
        }))
      : false;

    if (!isAdmin && !isTeamMember && game?.events && game.events.length > 0) {
      const event = game.events[0];
      const location = parsed.data.location;
      const lat = location?.lat ?? null;
      const lng = location?.lng ?? null;

      const verification = await verifyStoryPostingPermission(
        event.id,
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
    }
  }
  
  // Extract location data if provided
  const location = parsed.data.location;
  const lat = location?.lat ?? null;
  const lng = location?.lng ?? null;
  
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + STORY_EXPIRY_HOURS * 60 * 60 * 1000);
  const createData: any = {
    game_id: id,
    user_id: req.user.id,
    media_url: parsed.data.media_url,
    caption: parsed.data.caption,
    expires_at: expiresAt,
  };
  if (typeof lat === 'number') createData.lat = lat;
  if (typeof lng === 'number') createData.lng = lng;

  let story;
  try {
    story = await prisma.story.create({ data: createData });
  } catch (error: any) {
    if (!isMissingStoryLocationColumnError(error)) {
      console.error('[stories] Failed to create story:', error);
      return res.status(500).json({ error: 'Failed to create story' });
    }
    console.warn('[stories] Story location columns missing, retrying without lat/lng');
    const { lat: _lat, lng: _lng, ...withoutCoords } = createData;
    try {
      story = await prisma.story.create({ data: withoutCoords });
    } catch (fallbackError) {
      console.error('[stories] Failed to create story in fallback mode:', fallbackError);
      return res.status(500).json({ error: 'Failed to create story' });
    }
  }

  // Notify game creator about the new story (if different from poster)
  try {
    const game = await prisma.game.findUnique({
      where: { id },
      select: { id: true, title: true, created_by_id: true },
    });
    if (game?.created_by_id && game.created_by_id !== req.user.id) {
      const poster = await prisma.user.findUnique({ where: { id: req.user.id }, select: { display_name: true } });
      const posterName = poster?.display_name || 'Someone';

      await prisma.notification.create({
        data: {
          user_id: game.created_by_id,
          actor_id: req.user.id,
          type: 'GAME_STORY_ADDED',
          meta: { game_id: id, game_title: game.title, poster_name: posterName },
        },
      });

      const { sendPushNotification } = await import('../lib/notifications.js');
      await sendPushNotification(
        game.created_by_id,
        `New story on ${game.title}`,
        `${posterName} added a story to your game`,
        { type: 'game_story_added', game_id: id, screen: 'game-detail' }
      );
    }
  } catch (notifErr) {
    console.error('[stories] Failed to send game story notification:', notifErr);
  }

  return res.status(201).json(story);
};
