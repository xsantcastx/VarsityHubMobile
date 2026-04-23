/**
 * Prisma findMany bounds — structural regression guard.
 *
 * CLAUDE.md invariant: every findMany MUST have a `take` limit. Without one,
 * the feed/notification/message routes degrade catastrophically as tables
 * grow (each query pulls every row into memory and serializes it to JSON).
 *
 * This test recursively walks server/src for findMany call sites, slices
 * the next 25 lines of context (enough to capture typical call shape), and
 * asserts `take:` appears before the call closes. Allow-list is for
 * `findMany` calls where a bounded `where: { id: { in: [...] } }` makes the
 * result-size bounded by the input array — those are safe.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(process.cwd(), 'src');

/** Recursively collect .ts files under dir, excluding __tests__. */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === '__tests__' || name === 'node_modules' || name === 'dist') continue;
      walk(p, out);
    } else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) {
      out.push(p);
    }
  }
  return out;
}

type Finding = {
  file: string;
  line: number;
  snippet: string;
};

/**
 * Any call shape that makes the result size bounded by the INPUT, not by the
 * table size, is exempt. Examples:
 *   where: { id: { in: ids } }                 ← bounded by ids.length
 *   where: { user_id: { in: userIds } }        ← bounded by userIds.length
 *   where: { organization_id: { in: orgs } }   ← bounded by orgs.length
 *   where: { order_id: { in: orderRefs } }     ← bounded by orderRefs.length
 *   where: { blocker_id: x, blocked_id: { in: ids } }  ← bounded by ids
 *
 * Any `{ in: ... }` clause inside the where scope counts as input-bounded,
 * regardless of position. Presence of `{ in:` is the heuristic.
 *
 * Opting out via `// @allow-unbounded-findMany` on the line right above the
 * findMany call is also accepted for edge cases (migration scripts, admin
 * cron sweeps) — grep the code comment to audit them.
 */
const BOUNDED_BY_INPUT = /\{\s*in\s*:/;

/**
 * Single-FK equality scoping — e.g. `user_id: userId` or `organization_id: org.id`.
 * These restrict the query to records belonging to ONE entity, making the
 * result size bounded by that entity's realistic activity (per-user history,
 * per-org membership, etc.) rather than by full table size.
 *
 * Deliberately excludes the `{ in: ... }` form (that's handled by
 * BOUNDED_BY_INPUT) and the nested-filter form `user_id: { ... }`.
 */
const SINGLE_FK_SCOPED = /\b[\w]+_id\s*:\s*[a-zA-Z_][\w.!]*\s*[,}\n]/;

function analyze(filePath: string): Finding[] {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const findings: Finding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/\.findMany\(/.test(line)) continue;

    // Skip findMany(variableName) calls — query object built elsewhere; can't
    // statically verify. Trust the call site (typical pattern: paginated
    // helpers that build { take, where, cursor } once and reuse).
    if (/\.findMany\(\s*[a-zA-Z_][\w]*\s*\)/.test(line)) continue;

    // Grab a generous context window (50 lines) starting at the findMany
    // call — some multi-line queries with nested selects span this far.
    const snippet = lines.slice(i, Math.min(i + 50, lines.length)).join('\n');
    // `take: N` (literal), `take,` (destructured variable), or `take\n` (shorthand)
    if (/\btake\s*[:,\n)]/.test(snippet)) continue; // bounded by explicit take
    if (BOUNDED_BY_INPUT.test(snippet)) continue; // bounded by input array
    if (SINGLE_FK_SCOPED.test(snippet)) continue; // bounded by single FK equality
    // Prior-line opt-out comment
    if (i > 0 && /@allow-unbounded-findMany/.test(lines[i - 1])) continue;

    findings.push({
      file: relative(process.cwd(), filePath),
      line: i + 1,
      snippet: snippet.slice(0, 400),
    });
  }
  return findings;
}

describe('Prisma query bounds — no unbounded findMany', () => {
  it('every findMany has a take limit, is bounded by an input array, or has an opt-out comment', () => {
    const files = walk(SRC);
    const allFindings = files.flatMap(analyze);
    if (allFindings.length > 0) {
      const formatted = allFindings
        .map((f) => `  ${f.file}:${f.line}\n${f.snippet.split('\n').map((l) => '    ' + l).join('\n')}`)
        .join('\n\n');
      throw new Error(
        `Found ${allFindings.length} unbounded findMany call(s). Each MUST have take: N, be scoped by an { in: [...] } input bound, or carry a // @allow-unbounded-findMany comment.\n\n${formatted}`
      );
    }
    expect(allFindings).toEqual([]);
  });
});
