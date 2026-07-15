/**
 * Phase 2a: coach auto-expire / reminder must key off the APPLICATION submission
 * time, not the User row's created_at. The 2026-07-14 audit found that any
 * account older than 30 days that upgraded to coach was auto-REJECTED on the
 * next daily cron because the query filtered User.created_at. Re-key to
 * CoachApplication.submitted_at (column already exists — no migration).
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src', 'lib', 'approvalService.ts'), 'utf8');

// Isolate the two cron functions.
const fn = (name: string) => {
  const start = src.indexOf(`export async function ${name}`);
  const end = src.indexOf('\nexport async function', start + 10);
  return start >= 0 ? src.slice(start, end > start ? end : start + 2000) : '';
};

describe('autoExpirePendingCoaches keys off application submission', () => {
  const body = fn('autoExpirePendingCoaches');
  it('queries coachApplication (submission-based), not user.created_at', () => {
    expect(body).toMatch(/coachApplication\./);
    expect(body).toMatch(/submitted_at/);
  });
  it('does not gate expiry on User.created_at', () => {
    expect(body).not.toMatch(/created_at:\s*\{\s*lt:/);
  });
});

describe('remindPendingCoachApprovals keys off application submission', () => {
  const body = fn('remindPendingCoachApprovals');
  it('queries coachApplication and filters by submitted_at', () => {
    expect(body).toMatch(/coachApplication\./);
    expect(body).toMatch(/submitted_at/);
  });
  it('does not gate reminders on User.created_at', () => {
    expect(body).not.toMatch(/created_at:\s*\{\s*lt:/);
  });
});
