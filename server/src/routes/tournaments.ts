import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getOrganizationMembership } from '../lib/organizationAuthorization.js';
import { getOrganizationState } from '../lib/organizationState.js';
import { prisma } from '../lib/prisma.js';
import {
  buildOrganizationSerializeSelect,
  serializeOrganization,
} from '../lib/serializeOrganization.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireOnboarded } from '../middleware/requireOnboarded.js';

const createTournamentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  sport: z.string().max(100).optional(),
  season: z.string().max(50).optional(),
  logo_url: z.string().url().max(2048).optional(),
  location: z.string().max(500).optional(),
  stadium_name: z.string().max(200).optional(),
  capacity: z.number().int().min(0).optional(),
  opened_year: z.number().int().min(1800).max(2100).optional(),
  tournament_start_date: z.string().optional(),
  tournament_end_date: z.string().optional(),
  tournament_format: z.string().max(100).optional(),
});

const updateTournamentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  logo_url: z.string().url().max(2048).optional(),
  location: z.string().max(500).optional(),
  stadium_name: z.string().max(200).optional(),
  capacity: z.number().int().min(0).optional(),
  opened_year: z.number().int().min(1800).max(2100).optional(),
});

const createTournamentGameSchema = z.object({
  title: z.string().max(255).optional(),
  home_team: z.string().min(1).max(255),
  away_team: z.string().min(1).max(255),
  date: z.string().min(1),
  location: z.string().max(500).optional(),
  latitude: z.union([z.number(), z.string(), z.null()]).optional(),
  longitude: z.union([z.number(), z.string(), z.null()]).optional(),
});

export const tournamentsRouter = Router();

const toOptionalNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
};

/**
 * POST /tournaments
 * Create a new tournament organization
 */
tournamentsRouter.post(
  '/',
  requireAuth as any,
  requireOnboarded as any,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const parsed = createTournamentSchema.safeParse(req.body || {});
      if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
      const {
        name,
        description,
        sport,
        season,
        logo_url,
        location,
        stadium_name,
        capacity,
        opened_year,
        tournament_start_date,
        tournament_end_date,
        tournament_format,
      } = parsed.data;

      const tournament = await prisma.organization.create({
        data: {
          name,
          description: description
            ? stripHtml(description)
            : `${season ? `${season} ` : ''}${sport ?? ''} Tournament`.trim() || undefined,
          org_type: 'tournament',
          sport: sport ?? undefined,
          location: location ?? undefined,
          updated_at: new Date(),
        },
        select: buildOrganizationSerializeSelect(),
      });

      // Add creator as org owner
      await prisma.organizationMembership.create({
        data: {
          organization_id: tournament.id,
          user_id: req.user!.id,
          role: 'owner',
        },
        select: { id: true },
      });

      return res.status(201).json(serializeOrganization(tournament));
    } catch (error: any) {
      console.error('Failed to create tournament:', error);
      return res.status(500).json({ error: 'Failed to create tournament' });
    }
  })
);

/**
 * GET /tournaments
 * List all tournaments
 */
tournamentsRouter.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      const tournaments = await prisma.organization.findMany({
        where: { org_type: 'tournament' },
        take: 200,
        select: {
          ...buildOrganizationSerializeSelect(),
          teams: {
            select: {
              id: true,
              name: true,
              logo_url: true,
            },
          },
        },
      });

      return res.json(
        tournaments.map(tournament => serializeOrganization(tournament, { includeTeams: true }))
      );
    } catch (error: any) {
      console.error('Failed to fetch tournaments:', error);
      return res.status(500).json({ error: 'Failed to fetch tournaments' });
    }
  })
);

/**
 * GET /tournaments/:id
 * Get tournament details
 */
tournamentsRouter.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const tournament = await prisma.organization.findUnique({
        where: { id },
        select: {
          ...buildOrganizationSerializeSelect(),
          teams: {
            take: 500,
            select: {
              id: true,
              name: true,
              logo_url: true,
              description: true,
              sport: true,
              season_start: true,
              season_end: true,
            },
          },
        },
      });

      if (!tournament) {
        return res.status(404).json({ error: 'Tournament not found' });
      }

      return res.json(serializeOrganization(tournament, { includeTeams: true }));
    } catch (error: any) {
      console.error('Failed to fetch tournament:', error);
      return res.status(500).json({ error: 'Failed to fetch tournament' });
    }
  })
);

/**
 * PATCH /tournaments/:id
 * Update tournament
 */
tournamentsRouter.patch(
  '/:id',
  requireAuth as any,
  requireOnboarded as any,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const parsed = updateTournamentSchema.safeParse(req.body || {});
      if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });

      const membership = await getOrganizationMembership(req.user!.id, id);
      if (
        !membership ||
        membership.status !== 'active' ||
        !['owner', 'manager'].includes(String(membership.role))
      ) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const { name, description, location } = parsed.data;

      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (description !== undefined) data.description = description;
      if (location !== undefined) data.location = location;

      const tournament = await prisma.organization.update({
        where: { id },
        data,
        select: buildOrganizationSerializeSelect(),
      });

      return res.json(serializeOrganization(tournament));
    } catch (error: any) {
      console.error('Failed to update tournament:', error);
      return res.status(500).json({ error: 'Failed to update tournament' });
    }
  })
);

/**
 * POST /tournaments/:id/teams
 * Add team to tournament
 */
tournamentsRouter.post(
  '/:id/teams',
  requireAuth as any,
  requireOnboarded as any,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { team_id } = req.body;

      if (!team_id) {
        return res.status(400).json({ error: 'team_id is required' });
      }

      const membership = await getOrganizationMembership(req.user!.id, id);
      if (
        !membership ||
        membership.status !== 'active' ||
        !['owner', 'manager'].includes(String(membership.role))
      ) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      // SECURITY: Verify the team exists and check ownership
      const team = await prisma.team.findUnique({
        where: { id: team_id },
        select: { id: true, organization_id: true },
      });
      if (!team) return res.status(404).json({ error: 'Team not found' });

      // Prevent reassigning teams already belonging to another org
      if (team.organization_id && team.organization_id !== id) {
        return res.status(400).json({ error: 'Team already belongs to another organization' });
      }

      // Verify the caller is owner/coach of the team being added
      const teamMembership = await prisma.teamMembership.findFirst({
        where: {
          team_id: team_id,
          user_id: req.user!.id,
          role: { in: ['owner', 'coach'] as any[] },
        },
      });
      if (!teamMembership) {
        return res
          .status(403)
          .json({ error: 'You must be an owner or coach of this team to add it' });
      }

      const updatedTeam = await prisma.team.update({
        where: { id: team_id },
        data: { organization_id: id },
      });

      return res.json(updatedTeam);
    } catch (error: any) {
      console.error('Failed to add team to tournament:', error);
      return res.status(500).json({ error: 'Failed to add team' });
    }
  })
);

/**
 * POST /tournaments/:id/games
 * Create a tournament game/match
 */
tournamentsRouter.post(
  '/:id/games',
  requireAuth as any,
  requireOnboarded as any,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const parsed = createTournamentGameSchema.safeParse(req.body || {});
      if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
      const { title, home_team, away_team, date, location, latitude, longitude } = parsed.data;

      const tournament = await getOrganizationState(id);
      if (!tournament) {
        return res.status(404).json({ error: 'Tournament not found' });
      }

      const membership = await getOrganizationMembership(req.user!.id, id);
      if (
        !membership ||
        membership.status !== 'active' ||
        !['owner', 'manager'].includes(String(membership.role))
      ) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const game = await prisma.game.create({
        data: {
          title: title || `${home_team} vs ${away_team}`,
          home_team,
          away_team,
          date: new Date(date),
          location: location || tournament.location || null,
          latitude: toOptionalNumber(latitude),
          longitude: toOptionalNumber(longitude),
          approval_status: 'approved',
        },
      });

      return res.status(201).json(game);
    } catch (error: any) {
      console.error('Failed to create tournament game:', error);
      return res.status(500).json({ error: 'Failed to create game' });
    }
  })
);
