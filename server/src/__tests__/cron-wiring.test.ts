/**
 * Every `start*` starter exported by cron/overnightTasks.ts must actually be
 * invoked by app.ts.
 *
 * This exists because seven of eleven starters — including
 * `startAnonymizedUserPurge`, the job responsible for finalizing
 * right-to-be-forgotten deletions — were written, tested, and never wired.
 * The existing purge tests called `hardDeleteAnonymizedUsers` directly, so
 * they passed for months while the job never ran in production.
 *
 * A source-level assertion is the right shape here: importing app.ts to
 * observe the calls would boot the whole Express app (and app.ts guards the
 * cron block behind `!isTest`, so the calls would not fire anyway). Matches
 * the existing pattern in GameVerticalFeedScreen.nav.test.tsx.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const overnightTasksSrc = readFileSync(
  join(process.cwd(), 'src', 'cron', 'overnightTasks.ts'),
  'utf8'
);
const appSrc = readFileSync(join(process.cwd(), 'src', 'app.ts'), 'utf8');

function exportedStarters(): string[] {
  const names = [...overnightTasksSrc.matchAll(/export function (start[A-Za-z0-9_]*)\s*\(/g)].map(
    m => m[1]
  );
  return [...new Set(names)].sort();
}

describe('overnight cron wiring', () => {
  it('finds the exported starters (guards against the regex silently matching nothing)', () => {
    expect(exportedStarters().length).toBeGreaterThanOrEqual(11);
  });

  it.each(exportedStarters())('app.ts either invokes or explicitly defers %s()', starter => {
    // Called (not merely imported)...
    const isWired = new RegExp(`^\\s*${starter}\\(\\);`, 'm').test(appSrc);
    // ...or consciously parked in DEFERRED_CRON_STARTERS with a stated reason.
    const isDeferred = new RegExp(`'${starter}',`).test(appSrc);

    // Exactly one: a starter that is both wired and listed as deferred is a
    // contradiction, and one that is neither is dead code nobody noticed.
    expect(isWired !== isDeferred).toBe(true);

    if (isWired) {
      expect(appSrc).toMatch(
        new RegExp(`\\b${starter}\\b[\\s\\S]*?from '\\./cron/overnightTasks\\.js'`)
      );
    }
  });

  it('wires the anonymized-user purge specifically (the job that was dead)', () => {
    expect(appSrc).toMatch(/^\s*startAnonymizedUserPurge\(\);/m);
  });
});
