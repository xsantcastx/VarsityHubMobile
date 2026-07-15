/**
 * PARITY GUARDRAIL (Phase 0): every game-write path must derive approval_status
 * and opponent-approval through the single authority lib/gameApproval.ts. This
 * is the structural fix for the recurring drift where a sibling write path
 * (bulk, PUT) re-implemented or skipped the decision — the 2026-07-14 audit's
 * games/bulk auto-approve injection and PUT team-reassignment consent bypass.
 *
 * If you add a new game-write endpoint, route it through deriveGameApproval and
 * add it here. A hardcoded `approval_status: 'approved'` literal is banned.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const gamesSrcRaw = readFileSync(join(process.cwd(), 'src', 'routes', 'games.ts'), 'utf8');

// The admin-only /seed-samples handler legitimately seeds pre-approved demo
// games (requireAdmin, not part of the coach/org attack surface). Exclude its
// body from the literal ban.
const seedStart = gamesSrcRaw.indexOf("'/seed-samples'");
const seedEnd = seedStart >= 0 ? gamesSrcRaw.indexOf('gamesRouter.', seedStart + 50) : -1;
const gamesSrc =
  seedStart >= 0 && seedEnd > seedStart
    ? gamesSrcRaw.slice(0, seedStart) + gamesSrcRaw.slice(seedEnd)
    : gamesSrcRaw;

describe('game-write approval authority parity', () => {
  it('imports the deriveGameApproval authority', () => {
    expect(gamesSrc).toMatch(
      /import\s*\{[^}]*\bderiveGameApproval\b[^}]*\}\s*from\s*'\.\.\/lib\/gameApproval\.js'/
    );
  });

  it('calls deriveGameApproval on every game-write path (single, bulk, PUT)', () => {
    const calls = gamesSrc.match(/deriveGameApproval\(/g) ?? [];
    // one import reference is not a call; require at least 3 call sites
    expect(calls.length).toBeGreaterThanOrEqual(3);
  });

  it('never hardcodes approval_status: "approved" (must come from the authority)', () => {
    expect(gamesSrc).not.toMatch(/approval_status:\s*'approved'/);
    expect(gamesSrc).not.toMatch(/approval_status:\s*"approved"/);
  });

  it('writes opponent_approval_status only from a decision, never an inline literal/ternary', () => {
    // Query filters (where: { opponent_approval_status: 'pending' }) are fine.
    // These target the two write shapes the audit found drifting:
    //   opponent_approval_status: (x ? 'pending' : 'not_required')   [bulk]
    //   opponent_approval_status: 'not_required'                      [literal write]
    // create-time drift shape: (... ? 'pending' : 'not_required')
    expect(gamesSrc).not.toMatch(/\?\s*'pending'\s*:\s*'not_required'/);
    expect(gamesSrc).not.toMatch(/opponent_approval_status:\s*'not_required'/);
  });
});
