/**
 * Navigation guard regression test.
 *
 * Locks in the two objective invariants the navigation audit
 * (scripts/audit-navigation.sh) enforces, so a regression fails the jest suite
 * — not just the pre-push hook:
 *
 *   1. `router.replace('/(tabs)')` (bare tab root) is BANNED. It drops the
 *      entire navigation history and strands the user on the tab root with no
 *      back stack. The fix is always `safeGoBack(router, '/(tabs)/feed')`.
 *   2. `safeGoBack` must remain the dominant back primitive over `router.replace`.
 *
 * Pure `node:fs` scan — fast, stable, no native modules.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SCAN_ROOTS = ['app', 'components', 'hooks', 'utils'].map(d => join(process.cwd(), d));

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      collectSourceFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

const files = SCAN_ROOTS.flatMap(root => collectSourceFiles(root));

// Bare tab-root replace: quote must immediately follow `(tabs)` so
// `router.replace('/(tabs)/feed')` (a valid fallback) is NOT matched.
const BANNED_TAB_ROOT_REPLACE = /router\.replace\(\s*['"]\/\(tabs\)['"]\s*\)/;
const SAFE_GO_BACK = /safeGoBack\s*\(/g;
const ROUTER_REPLACE = /router\.replace\s*\(/g;

function countMatches(src: string, re: RegExp): number {
  return (src.match(re) || []).length;
}

describe('navigation guards', () => {
  it('contains no banned router.replace("/(tabs)") (history-dropping dead end)', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      src.split('\n').forEach((line, i) => {
        if (BANNED_TAB_ROOT_REPLACE.test(line)) {
          offenders.push(`${file.replace(`${process.cwd()}/`, '')}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('keeps safeGoBack as the dominant back primitive over router.replace', () => {
    let safeGoBack = 0;
    let routerReplace = 0;
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      safeGoBack += countMatches(src, SAFE_GO_BACK);
      routerReplace += countMatches(src, ROUTER_REPLACE);
    }
    // Healthy ratio (audit baseline ~204:102). Strictly-greater locks the
    // invariant without being brittle to small day-to-day changes.
    expect(safeGoBack).toBeGreaterThan(routerReplace);
  });
});
