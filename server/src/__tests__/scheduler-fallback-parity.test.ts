/**
 * Regression: the no-Redis fallback scheduler must derive from the single
 * SCHEDULED_JOBS list. 2026-07-13 audit found the fallback hand-reimplemented
 * each job as setInterval and had silently dropped 5 jobs (db-backup-sync,
 * coach-state-drift-probe, stripe-webhook-reconciliation,
 * apple-iap-reconciliation, ad-refund-reconcile).
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src', 'jobs', 'scheduler.ts'), 'utf8');
const fnStart = src.indexOf('function setupFallbackCron');
const fnEnd = src.indexOf('export async function startSchedulerWorker');
const fallback = src.slice(fnStart, fnEnd);

describe('setupFallbackCron parity with SCHEDULED_JOBS', () => {
  it('iterates SCHEDULED_JOBS instead of hand-listing jobs', () => {
    expect(fnStart).toBeGreaterThan(-1);
    expect(fallback).toMatch(/for \(const job of SCHEDULED_JOBS\)/);
    expect(fallback).toMatch(/node-cron/);
  });
  it('contains no hand-rolled per-job logic that can drift', () => {
    expect(fallback).not.toMatch(/notifyUpcomingGames/);
    expect(fallback).not.toMatch(/remindPendingCoachApprovals/);
    expect(fallback).not.toMatch(/setInterval/);
  });
});
