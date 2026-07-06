/**
 * Canonical Prisma select for the "game summary" shape returned by
 * team-scoped list endpoints.
 *
 * Background: game/event rows are fetched by hand-rolled Prisma `select`
 * blocks in ~20 places (teams screen-summary/admin-summary, organizations,
 * search, games). The field lists drift independently — the "vs TBD" bug
 * class came directly from this: `event_type` was omitted from some selects,
 * so the client couldn't tell a competitive game from a normal event and
 * fell back to "vs TBD". Fixing one select left the others broken.
 *
 * This constant centralizes the summary field set so the endpoints that
 * return this exact shape share ONE definition — mirroring the proven
 * `serializeTeam.ts` pattern. `event_type` is part of the baseline here so
 * it can never silently fall out of a summary payload again.
 *
 * IMPORTANT — scope: this is the field set used by the team screen-summary
 * and admin-summary endpoints (identical today). It is intentionally NOT
 * applied to `search`, `organizations`, or the `games` list endpoints yet:
 * those return DIFFERENT shapes (search omits the team IDs; organizations
 * reads the `homeTeam` relation; games uses `include`). Migrating those onto
 * a shared select requires per-endpoint field-parity review first, or a
 * client-visible contract changes. Do that deliberately, not by sweep.
 */
import { Prisma } from '@prisma/client';

export const GAME_SUMMARY_SELECT = {
  id: true,
  title: true,
  date: true,
  location: true,
  home_team: true,
  away_team: true,
  home_team_id: true,
  away_team_id: true,
  approval_status: true,
  event_type: true,
} satisfies Prisma.GameSelect;
