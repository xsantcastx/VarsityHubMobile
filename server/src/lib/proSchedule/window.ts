import type { ProLeague } from '@prisma/client';

const DEFAULT_PRO_SCHEDULE_WINDOW_DAYS = 45;
const MIN_PRO_SCHEDULE_WINDOW_DAYS = 1;
const MAX_PRO_SCHEDULE_WINDOW_DAYS = 90;

/**
 * Per-league window defaults that override the global one.
 *
 * MLS NEXT Pro runs a dense weekly slate and the product owner wants only the
 * near horizon surfaced, so it rolls on 14 days while everything else keeps the
 * 45-day default. A per-league Railway var (see below) still wins over this.
 */
const PER_LEAGUE_WINDOW_DAYS: Partial<Record<ProLeague, number>> = {
  mls_next_pro: 14,
};

/** `PRO_SCHEDULE_WINDOW_DAYS_MLS_NEXT_PRO` etc. — a per-league env override. */
function leagueEnvKey(league: ProLeague): string {
  return `PRO_SCHEDULE_WINDOW_DAYS_${league.toUpperCase()}`;
}

function clampDays(parsed: number, fallback: number): number {
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, MIN_PRO_SCHEDULE_WINDOW_DAYS), MAX_PRO_SCHEDULE_WINDOW_DAYS);
}

/**
 * Rolling-ingest horizon in days.
 *
 * Resolution order (first that yields a value wins): per-league env override →
 * per-league code default → global `PRO_SCHEDULE_WINDOW_DAYS` env → the built-in
 * default. Every source is clamped to [1, 90]. Passing no `league` returns the
 * global window (unchanged from before per-league overrides existed).
 */
export function getProScheduleWindowDays(
  env: NodeJS.ProcessEnv = process.env,
  fallback = DEFAULT_PRO_SCHEDULE_WINDOW_DAYS,
  league?: ProLeague
): number {
  const globalRaw = env.PRO_SCHEDULE_WINDOW_DAYS;
  const globalParsed = Number.parseInt(String(globalRaw ?? ''), 10);
  const globalWindow = Number.isFinite(globalParsed) ? clampDays(globalParsed, fallback) : fallback;

  if (!league) return globalWindow;

  const leagueRaw = env[leagueEnvKey(league)];
  const leagueParsed = Number.parseInt(String(leagueRaw ?? ''), 10);
  if (Number.isFinite(leagueParsed)) return clampDays(leagueParsed, globalWindow);

  const codeDefault = PER_LEAGUE_WINDOW_DAYS[league];
  if (typeof codeDefault === 'number') return clampDays(codeDefault, globalWindow);

  return globalWindow;
}

export { DEFAULT_PRO_SCHEDULE_WINDOW_DAYS, PER_LEAGUE_WINDOW_DAYS };
