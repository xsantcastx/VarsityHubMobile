/**
 * Regression test: game approval route must use an atomic pending-only transition.
 *
 * Why this exists:
 *   `/games/:id/approve` used to read the row, check permissions, then issue an
 *   unguarded `prisma.game.update({ where: { id } ... })`. Two reviewers hitting
 *   approve/reject at the same time both saw `approval_status='pending'` and
 *   both writes succeeded, so last-write-wins silently overwrote the first
 *   moderation action.
 *
 *   Fix: transition with `updateMany` constrained by `approval_status: 'pending'`
 *   inside a transaction and return 409 when the guarded update touches 0 rows.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const gamesSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'games.ts'), 'utf8');

describe('games approval race guard', () => {
  it('uses a guarded updateMany for the game approval transition', () => {
    expect(gamesSrc).toMatch(/tx\.game\.updateMany/);
    expect(gamesSrc).toMatch(/where:\s*\{\s*id,\s*approval_status:\s*'pending'/);
  });

  it('returns 409 when a concurrent moderator already changed the game status', () => {
    expect(gamesSrc).toMatch(
      /return sendError\(res,\s*409,\s*'Game approval status changed before this action completed'\)/
    );
  });

  it('keeps the linked event sync inside the same transaction as the guarded game transition', () => {
    expect(gamesSrc).toMatch(/prisma\.\$transaction\(async \(tx\)/);
    expect(gamesSrc).toMatch(/await tx\.event\.updateMany/);
  });
});
