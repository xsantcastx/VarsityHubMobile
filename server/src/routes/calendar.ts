import { Router } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { prisma } from '../lib/prisma.js';
import {
  createGoogleCalendarClient,
  exchangeOAuthCode,
  batchSyncEventsToGoogleCalendar,
} from '../lib/googleCalendar.js';

const router = Router();

/**
 * Schema for OAuth code exchange.
 */
const calendarConnectSchema = z.object({
  code: z.string().min(1, 'OAuth code is required'),
  state: z.string().optional(),
});

/**
 * POST /calendar/connect
 * Exchange Google OAuth code for tokens and store in User.preferences.
 */
router.post(
  '/connect',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = calendarConnectSchema.parse(req.body);

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      // Exchange code for tokens
      const tokens = await exchangeOAuthCode(body.code);

      // Update user preferences — preserve existing calendar settings and merge new tokens
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { preferences: true },
      });

      const currentPrefs = (user?.preferences as any) || {};
      const updatedPrefs = {
        ...currentPrefs,
        calendar: {
          ...(currentPrefs.calendar || {}),
          google_calendar_connected: true,
          google_calendar_access_token: tokens.access_token,
          google_calendar_refresh_token: tokens.refresh_token,
          google_calendar_id: 'primary',
          google_calendar_sync_enabled: true,
          google_calendar_last_sync_at: new Date().toISOString(),
        },
      };

      await prisma.user.update({
        where: { id: req.user.id },
        data: { preferences: updatedPrefs as any },
      });

      return res.json({
        success: true,
        message: 'Google Calendar connected successfully',
        calendarId: 'primary',
      });
    } catch (error: any) {
      console.error('[calendar] Connect failed:', error.message);
      return res.status(400).json({
        error: 'Failed to connect Google Calendar',
        details: error.message,
      });
    }
  })
);

/**
 * POST /calendar/disconnect
 * Clear Google Calendar tokens from User.preferences.
 */
router.post(
  '/disconnect',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { preferences: true },
      });

      const currentPrefs = (user?.preferences as any) || {};
      const updatedPrefs = {
        ...currentPrefs,
        calendar: {
          google_calendar_connected: false,
          google_calendar_access_token: null,
          google_calendar_refresh_token: null,
          google_calendar_id: null,
          google_calendar_sync_enabled: false,
        },
      };

      await prisma.user.update({
        where: { id: req.user.id },
        data: { preferences: updatedPrefs as any },
      });

      return res.json({
        success: true,
        message: 'Google Calendar disconnected',
      });
    } catch (error: any) {
      console.error('[calendar] Disconnect failed:', error.message);
      return res.status(400).json({
        error: 'Failed to disconnect Google Calendar',
      });
    }
  })
);

/**
 * GET /calendar/sync-status
 * Check Google Calendar connection and sync status.
 */
router.get(
  '/sync-status',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { preferences: true },
      });

      const calendarPrefs = (user?.preferences as any)?.calendar || {};

      return res.json({
        connected: calendarPrefs.google_calendar_connected || false,
        syncEnabled: calendarPrefs.google_calendar_sync_enabled || false,
        lastSyncAt: calendarPrefs.google_calendar_last_sync_at || null,
        calendarId: calendarPrefs.google_calendar_id || null,
      });
    } catch (error: any) {
      console.error('[calendar] Sync status failed:', error.message);
      return res.status(500).json({ error: 'Failed to fetch sync status' });
    }
  })
);

/**
 * POST /calendar/sync
 * Manually sync upcoming games to Google Calendar.
 * Query param: ?teamId= (optional, sync only one team)
 */
router.post(
  '/sync',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const teamId = req.query.teamId as string | undefined;

    try {
      // Get user and check connection
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { preferences: true },
      });

      const calendarPrefs = (user?.preferences as any)?.calendar;

      if (!calendarPrefs?.google_calendar_connected || !calendarPrefs?.google_calendar_access_token) {
        return res.status(400).json({
          error: 'Google Calendar not connected',
        });
      }

      // Create calendar client with stored tokens
      const calendarClient = createGoogleCalendarClient(
        calendarPrefs.google_calendar_access_token,
        calendarPrefs.google_calendar_refresh_token
      );

      // Get user's team IDs
      const teamIds = await getUserTeamIds(req.user.id, teamId);

      if (teamIds.length === 0) {
        return res.json({
          success: true,
          synced: 0,
          skipped: 0,
          errors: [],
          message: 'No teams found to sync',
        });
      }

      // Fetch upcoming games for the user's teams
      const games = await prisma.game.findMany({
        where: {
          date: { gte: new Date() },
          OR: [{ home_team_id: { in: teamIds } }, { away_team_id: { in: teamIds } }],
        },
        select: {
          id: true,
          title: true,
          date: true,
          location: true,
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
        },
        take: 100,
      });

      // Convert games to calendar events
      const events = games.map(game => {
        // Estimate 2-hour duration for games
        const endDate = new Date(game.date);
        endDate.setHours(endDate.getHours() + 2);

        return {
          id: game.id,
          title: game.title,
          description: game.homeTeam?.name && game.awayTeam?.name
            ? `${game.homeTeam.name} vs ${game.awayTeam.name}`
            : 'VarsityHub Game',
          start_time: game.date,
          end_time: endDate,
          location: game.location || undefined,
        };
      });

      // Sync to Google Calendar
      const results = await batchSyncEventsToGoogleCalendar(
        calendarClient,
        events,
        calendarPrefs.google_calendar_id || 'primary'
      );

      // Update last sync time
      const currentPrefs = (user?.preferences as any) || {};
      const updatedPrefs = {
        ...currentPrefs,
        calendar: {
          ...calendarPrefs,
          google_calendar_last_sync_at: new Date().toISOString(),
        },
      };

      await prisma.user.update({
        where: { id: req.user.id },
        data: { preferences: updatedPrefs as any },
      });

      return res.json({
        success: true,
        synced: results.synced,
        skipped: results.skipped,
        errors: results.errors,
      });
    } catch (error: any) {
      console.error('[calendar] Sync failed:', error.message);
      return res.status(500).json({
        error: 'Failed to sync events',
        details: error.message,
      });
    }
  })
);

/**
 * Helper: Get team IDs for the user (or specific team if provided).
 */
async function getUserTeamIds(userId: string, specificTeamId?: string): Promise<string[]> {
  if (specificTeamId) {
    // Verify user has access to this team
    const membership = await prisma.teamMembership.findFirst({
      where: {
        user_id: userId,
        team_id: specificTeamId,
      },
      select: { team_id: true },
    });
    return membership ? [membership.team_id] : [];
  }

  // Get all teams the user is a member of
  const memberships = await prisma.teamMembership.findMany({
    where: {
      user_id: userId,
    },
    select: { team_id: true },
  });

  return memberships.map(m => m.team_id);
}

export default router;

