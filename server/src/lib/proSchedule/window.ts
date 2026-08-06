const DEFAULT_PRO_SCHEDULE_WINDOW_DAYS = 45;
const MIN_PRO_SCHEDULE_WINDOW_DAYS = 1;
const MAX_PRO_SCHEDULE_WINDOW_DAYS = 90;

export function getProScheduleWindowDays(
  env: NodeJS.ProcessEnv = process.env,
  fallback = DEFAULT_PRO_SCHEDULE_WINDOW_DAYS
): number {
  const raw = env.PRO_SCHEDULE_WINDOW_DAYS;
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, MIN_PRO_SCHEDULE_WINDOW_DAYS), MAX_PRO_SCHEDULE_WINDOW_DAYS);
}

export { DEFAULT_PRO_SCHEDULE_WINDOW_DAYS };
