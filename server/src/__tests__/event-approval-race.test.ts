/**
 * Regression test: event approve/reject state-machine race guard
 *
 * Why this exists:
 *   approveEvent and rejectEvent in server/src/lib/approvalService.ts used to
 *   do a pre-transaction findUnique, check `approval_status === 'pending'`, and
 *   then issue an unguarded `prisma.event.update`. Two admins hitting approve
 *   and reject at the same moment both saw status='pending', both passed the
 *   check, and both updates succeeded — last write wins. The state machine
 *   could end up 'approved' after a 'rejected' already happened (or vice
 *   versa), with both email notifications already sent.
 *
 *   Fix: updateMany with `approval_status: 'pending'` in the WHERE clause.
 *   Whichever admin's UPDATE commits first wins; the loser gets count:0 and
 *   is returned a 409 instead of silently overwriting.
 *
 *   This test is structural — it reads the source of both functions and
 *   asserts the atomic-guard pattern is present. If someone refactors it
 *   back to an unguarded `prisma.event.update({ where: { id } })`, the test
 *   fails before the code ships.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractFunctionBody } from './helpers/extractFunctionBody.js';

const SERVICE = readFileSync(
  join(process.cwd(), 'src', 'lib', 'approvalService.ts'),
  'utf8',
);

describe('Event approval state-machine race guard', () => {
  const approveBody = extractFunctionBody(SERVICE, 'approveEvent');
  const rejectBody = extractFunctionBody(SERVICE, 'rejectEvent');

  it('approveEvent uses updateMany with approval_status in WHERE (not unguarded update)', () => {
    // The fix pattern is:
    //   await prisma.event.updateMany({
    //     where: { id: eventId, approval_status: 'pending' },
    //     data: { approval_status: 'approved', ... },
    //   });
    expect(approveBody).toMatch(/(?:prisma|tx)\.event\.updateMany/);
    expect(approveBody).toMatch(/approval_status:\s*['"]pending['"]/);
  });

  it('approveEvent bails out with 409 when the guarded update touches 0 rows', () => {
    // The loser of a concurrent approve/reject race must surface as 409, not
    // silently succeed. We assert the count check + status 409 are present.
    expect(approveBody).toMatch(/guard\.count\s*===\s*0|count\s*===\s*0/);
    expect(approveBody).toMatch(/status:\s*409/);
  });

  it('rejectEvent uses updateMany with approval_status in WHERE', () => {
    expect(rejectBody).toMatch(/(?:prisma|tx)\.event\.updateMany/);
    expect(rejectBody).toMatch(/approval_status:\s*['"]pending['"]/);
  });

  it('rejectEvent bails out with 409 when the guarded update touches 0 rows', () => {
    expect(rejectBody).toMatch(/guard\.count\s*===\s*0|count\s*===\s*0/);
    expect(rejectBody).toMatch(/status:\s*409/);
  });

  it('neither function calls the unguarded prisma.event.update form for the state transition', () => {
    // Regression: prevent someone from "simplifying" the updateMany back into
    // a bare prisma.event.update({ where: { id } }) which loses the guard.
    // NOTE: we're looking for the state-transition update specifically — there
    // may be other unrelated updates (e.g., bumping a side field) that are
    // fine. The tell is the `approval_status: 'approved' | 'rejected'` literal
    // inside the data payload of a non-updateMany call.
    const unguardedApprove =
      /prisma\.event\.update\(\{[\s\S]*?approval_status:\s*['"]approved['"][\s\S]*?\}\)/.exec(
        approveBody,
      );
    const unguardedReject =
      /prisma\.event\.update\(\{[\s\S]*?approval_status:\s*['"]rejected['"][\s\S]*?\}\)/.exec(
        rejectBody,
      );
    expect(unguardedApprove).toBeNull();
    expect(unguardedReject).toBeNull();
  });

  it('syncs linked game approval state inside the same guarded transition', () => {
    expect(approveBody).toMatch(/tx\.game\.updateMany/);
    expect(approveBody).toMatch(/id:\s*event\.game_id/);
    expect(approveBody).toMatch(/approval_status:\s*['"]approved['"]/);

    expect(rejectBody).toMatch(/tx\.game\.updateMany/);
    expect(rejectBody).toMatch(/id:\s*event\.game_id/);
    expect(rejectBody).toMatch(/approval_status:\s*['"]rejected['"]/);
  });
});
