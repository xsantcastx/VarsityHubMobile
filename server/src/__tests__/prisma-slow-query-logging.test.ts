import { describe, expect, it } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Structural guard for the Prisma slow-query logging middleware.
 *
 * This deliberately does NOT execute the middleware against a live database —
 * that would require a real Postgres connection and would be flaky/slow in
 * CI. Instead it asserts, directly against the source, that the slow-query
 * logging path can only ever emit `Model.action`, a duration, and a
 * threshold — never raw query args, params, or results. If someone later
 * "improves" the log line by interpolating `params.args`, `params`, or the
 * query result, this test fails loudly.
 */

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const prismaSourcePath = path.join(currentDir, '..', 'lib', 'prisma.ts');
const prismaSource = fs.readFileSync(prismaSourcePath, 'utf8');

const extractBlock = (marker: string): string => {
  const start = prismaSource.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = prismaSource.indexOf('\n});', start);
  expect(end).toBeGreaterThan(start);
  return prismaSource.slice(start, end);
};

describe('prisma slow-query logging', () => {
  const slowQueryBlock = extractBlock('export const SLOW_QUERY_THRESHOLD_MS');

  it('measures duration with Date.now() around next(params)', () => {
    expect(slowQueryBlock).toMatch(/Date\.now\(\)/);
    expect(slowQueryBlock).toMatch(/await next\(params\)/);
  });

  it('logs only the model.action label, duration, and threshold', () => {
    // The console.warn call must reference durationMs and the threshold.
    expect(slowQueryBlock).toMatch(/console\.warn/);
    expect(slowQueryBlock).toMatch(/durationMs/);
    expect(slowQueryBlock).toMatch(/SLOW_QUERY_THRESHOLD_MS/);
    expect(slowQueryBlock).toMatch(/params\.model/);
    expect(slowQueryBlock).toMatch(/params\.action/);
  });

  it('never logs raw query args, params, or results', () => {
    const warnCallMatch = slowQueryBlock.match(/console\.warn\(([\s\S]*?)\);/);
    expect(warnCallMatch).not.toBeNull();
    const warnCallSource = warnCallMatch![1];

    // Forbidden: interpolating the raw params object, params.args, or the
    // query result directly into the log line. Only the derived `label`
    // (Model.action), `durationMs`, and `SLOW_QUERY_THRESHOLD_MS` are allowed.
    expect(warnCallSource).not.toMatch(/params\.args/);
    expect(warnCallSource).not.toMatch(/\bresult\b/);
    expect(warnCallSource).not.toMatch(/JSON\.stringify\(params\)/);
    expect(warnCallSource).not.toMatch(/\$\{params\}/);
  });

  it('respects PRISMA_SLOW_QUERY_MS and defaults to 100ms in production / 500ms otherwise', () => {
    expect(slowQueryBlock).toMatch(/PRISMA_SLOW_QUERY_MS/);
    expect(slowQueryBlock).toMatch(/100/);
    expect(slowQueryBlock).toMatch(/500/);
  });

  it('stays silent in the test environment to avoid noisy CI output', () => {
    expect(slowQueryBlock).toMatch(/!isTest/);
  });
});
