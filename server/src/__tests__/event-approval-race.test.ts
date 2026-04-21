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

const SERVICE = readFileSync(
  join(process.cwd(), 'src', 'lib', 'approvalService.ts'),
  'utf8',
);

// Extract the body of a named exported function. We don't need a real AST — the
// function bodies in this file are well-delimited and short enough to grab via
// regex. We bail out early if the shape ever changes so the test fails loudly
// instead of silently passing against a refactor we didn't anticipate.
function extractFunctionBody(source: string, name: string): string {
  const startPattern = new RegExp(`export async function ${name}\\b`);
  const startMatch = source.match(startPattern);
  if (!startMatch || startMatch.index === undefined) {
    throw new Error(`Could not locate function ${name} in approvalService.ts`);
  }
  const tail = source.slice(startMatch.index);

  // Skip past the parameter list's closing ')' before hunting for the body's
  // opening '{'. A naive indexOf('{') catches type-literal params like
  // `opts?: { reason?: string }` — which is exactly what broke rejectEvent's
  // earlier assertions while approveEvent (no type-literal param) worked.
  const paramsStart = tail.indexOf('(');
  if (paramsStart === -1) throw new Error(`Malformed function ${name} (no params)`);
  let parenDepth = 1;
  let paramsEnd = paramsStart + 1;
  for (; paramsEnd < tail.length; paramsEnd++) {
    if (tail[paramsEnd] === '(') parenDepth++;
    else if (tail[paramsEnd] === ')') {
      parenDepth--;
      if (parenDepth === 0) break;
    }
  }
  if (parenDepth !== 0) throw new Error(`Malformed function ${name} (unbalanced parens)`);

  const firstBrace = tail.indexOf('{', paramsEnd);
  if (firstBrace === -1) throw new Error(`Malformed function ${name} (no body brace)`);

  let depth = 0;
  for (let i = firstBrace; i < tail.length; i++) {
    const ch = tail[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return tail.slice(0, i + 1);
    }
  }
  throw new Error(`Could not find end of function ${name}`);
}

describe('Event approval state-machine race guard', () => {
  const approveBody = extractFunctionBody(SERVICE, 'approveEvent');
  const rejectBody = extractFunctionBody(SERVICE, 'rejectEvent');

  it('approveEvent uses updateMany with approval_status in WHERE (not unguarded update)', () => {
    // The fix pattern is:
    //   await prisma.event.updateMany({
    //     where: { id: eventId, approval_status: 'pending' },
    //     data: { approval_status: 'approved', ... },
    //   });
    expect(approveBody).toMatch(/prisma\.event\.updateMany/);
    expect(approveBody).toMatch(/approval_status:\s*['"]pending['"]/);
  });

  it('approveEvent bails out with 409 when the guarded update touches 0 rows', () => {
    // The loser of a concurrent approve/reject race must surface as 409, not
    // silently succeed. We assert the count check + status 409 are present.
    expect(approveBody).toMatch(/guard\.count\s*===\s*0|count\s*===\s*0/);
    expect(approveBody).toMatch(/status:\s*409/);
  });

  it('rejectEvent uses updateMany with approval_status in WHERE', () => {
    expect(rejectBody).toMatch(/prisma\.event\.updateMany/);
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
});
