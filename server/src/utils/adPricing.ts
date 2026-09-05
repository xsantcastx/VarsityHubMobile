import { z } from 'zod';

export const adDateSchema = z.string().refine(value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Expected a real calendar date in YYYY-MM-DD format');

/**
 * Ad calendar pricing is **per calendar week block**, not per day:
 * - One fee covers all selected Mon–Thu days in that week (weekday block).
 * - One fee covers all selected Fri–Sun days in that week (weekend block).
 * UI copy must not imply a per-day rate unless product intentionally changes this model.
 */
const WEEKDAY_BLOCK_PRICE = 4.99; // USD per Mon–Thu slot
const WEEKEND_BLOCK_PRICE = 7.99; // USD per Fri–Sun slot

// Use Math.round to avoid floating-point imprecision (4.99 * 100 = 498.99... not 499)
export const WEEKDAY_BLOCK_PRICE_CENTS = Math.round(WEEKDAY_BLOCK_PRICE * 100);
export const WEEKEND_BLOCK_PRICE_CENTS = Math.round(WEEKEND_BLOCK_PRICE * 100);

type WeekUsage = { hasWeekday: boolean; hasWeekend: boolean };

/**
 * Group ISO dates (YYYY-MM-DD) into weekly slots and determine whether a given
 * week has weekday and/or weekend coverage.
 */
function buildWeekUsage(dates: string[]): Map<string, WeekUsage> {
  const weekMap = new Map<string, WeekUsage>();

  dates.forEach(dateStr => {
    adDateSchema.parse(dateStr);
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const day = date.getUTCDay(); // 0 (Sun) .. 6 (Sat)

    const diff = day === 0 ? -6 : 1 - day; // find Monday of same week
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() + diff);
    const weekKey = monday.toISOString().split('T')[0];

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, { hasWeekday: false, hasWeekend: false });
    }

    const week = weekMap.get(weekKey)!;
    if (day >= 1 && day <= 4) {
      week.hasWeekday = true;
    } else {
      week.hasWeekend = true;
    }
  });

  return weekMap;
}

export function calculateAdPriceCents(isoDates: string[]): {
  totalCents: number;
  weekdayBlocks: number;
  weekendBlocks: number;
} {
  if (!isoDates.length) {
    return { totalCents: 0, weekdayBlocks: 0, weekendBlocks: 0 };
  }

  const weekMap = buildWeekUsage(isoDates);
  let weekdayBlocks = 0;
  let weekendBlocks = 0;

  for (const week of weekMap.values()) {
    if (week.hasWeekday) weekdayBlocks += 1;
    if (week.hasWeekend) weekendBlocks += 1;
  }

  const totalCents =
    weekdayBlocks * WEEKDAY_BLOCK_PRICE_CENTS + weekendBlocks * WEEKEND_BLOCK_PRICE_CENTS;
  return { totalCents, weekdayBlocks, weekendBlocks };
}

export function calculateAdPriceDollars(isoDates: string[]): number {
  const { totalCents } = calculateAdPriceCents(isoDates);
  return totalCents / 100;
}
