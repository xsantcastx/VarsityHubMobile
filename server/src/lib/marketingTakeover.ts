/**
 * Server-controlled marketing feed takeover (see
 * docs/superpowers/specs/2026-08-16-marketing-feed-takeover-server-controlled-design.md).
 *
 * A single self-expiring Redis key drives a bounded, all-users swap of the feed
 * to the shuffled most-active event pages. The TTL IS the auto-revert — no
 * scheduler. Reads fail closed: a Redis error never activates the takeover.
 */
import { cacheGet, cacheSet, cacheDel } from './cache.js';

const KEY = 'marketing:feed_takeover';
const DEFAULT_MINUTES = 60;
const MAX_MINUTES = 180;

export interface MarketingTakeoverState {
  active: boolean;
  until: string | null;
}

/** Clamp a requested duration to [1, 180] minutes; non-finite/<1 → default 60. */
export function clampTakeoverMinutes(minutes: number): number {
  const n = Math.floor(minutes);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MINUTES;
  return Math.min(n, MAX_MINUTES);
}

/** Pure state derivation from a stored `until` timestamp (past/absent → inactive). */
export function deriveTakeoverState(until: string | null | undefined): MarketingTakeoverState {
  const active = !!until && new Date(until).getTime() > Date.now();
  return { active, until: active ? (until as string) : null };
}

/** Current takeover state. Fail-closed on any Redis error. */
export async function getMarketingTakeover(): Promise<MarketingTakeoverState> {
  try {
    const stored = await cacheGet<{ until?: string }>(KEY);
    return deriveTakeoverState(stored?.until ?? null);
  } catch {
    return { active: false, until: null };
  }
}

/** Start (or extend) the window. TTL = duration, so it self-expires. */
export async function startMarketingTakeover(minutes: number): Promise<MarketingTakeoverState> {
  const clamped = clampTakeoverMinutes(minutes);
  const until = new Date(Date.now() + clamped * 60_000).toISOString();
  await cacheSet(KEY, { until }, clamped * 60);
  return { active: true, until };
}

/** Instant kill-switch — clears the key so clients revert on their next load. */
export async function stopMarketingTakeover(): Promise<MarketingTakeoverState> {
  await cacheDel(KEY);
  return { active: false, until: null };
}
