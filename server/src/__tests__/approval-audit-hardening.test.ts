/**
 * Approval-audit hardening invariants (2026-07-15 end-to-end approval audit).
 *
 * Each assertion pins a fix from the approval-processes audit. They are
 * source-shape invariants (same idiom as ad-state-invariants.test.ts): they read
 * the shipping source and assert the control is present, so they hold regardless
 * of local test-DB migration drift. If one fails, the control was removed or
 * refactored away — restore it, don't delete the test, unless the change is
 * intentional.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = join(process.cwd(), 'src');
const read = (...parts: string[]) => readFileSync(join(SRC_ROOT, ...parts), 'utf8');

function sliceFunction(source: string, signature: string, span = 6000): string {
  const start = source.indexOf(signature);
  expect(start).toBeGreaterThanOrEqual(0);
  return source.slice(start, start + span);
}

const approvalService = read('lib', 'approvalService.ts');
const games = read('routes', 'games.ts');
const events = read('routes', 'events.ts');
const organizations = read('routes', 'organizations.ts');

describe('Ad approval — paid ad returns to the feed on re-approval', () => {
  it('approveAd reactivates a paid ad instead of stranding it in `approved`', () => {
    const approveAd = sliceFunction(approvalService, 'export async function approveAd');
    // A paid ad bounced back to pending (post-payment edit) must go to `active`
    // on re-approval; an unpaid ad approves to `approved` and awaits payment.
    expect(approveAd).toMatch(/status:\s*ad\.payment_status === 'paid' \? 'active' : 'approved'/);
    // The old, buggy behavior — a bare `status: 'approved'` write — must not return.
    expect(approveAd).not.toMatch(/data:\s*\{\s*status:\s*'approved',/);
  });
});

describe('Coach approval — IDOR + race + audit-trail parity', () => {
  const approveCoach = sliceFunction(approvalService, 'export async function approveCoach');

  it('approveCoach blocks an admin approving their own coach request', () => {
    expect(approveCoach).toMatch(/adminId && adminId === userId/);
    expect(approveCoach).toMatch(/You cannot approve your own coach request/);
  });

  it('approveCoach uses a guarded updateMany + 409 race check, not a bare user.update', () => {
    // Concurrent approvals must not both commit and double-notify — mirror the
    // updateMany/count===0 guard used by approveOrganization/approveAd.
    expect(approveCoach).toMatch(/updateMany\(\{[\s\S]*approval_status:\s*'PENDING'/);
    expect(approveCoach).toMatch(/transition\.count === 0/);
    expect(approveCoach).toMatch(/status:\s*409/);
  });

  it('autoExpirePendingCoaches emits a REJECT_COACH AdminActivityLog row', () => {
    const autoExpire = sliceFunction(
      approvalService,
      'export async function autoExpirePendingCoaches'
    );
    expect(autoExpire).toMatch(/logAdminActivity\(/);
    expect(autoExpire).toMatch(/'REJECT_COACH'/);
    // Keyed on the application submit time, never account age (prior root cause).
    expect(autoExpire).toMatch(/submitted_at:\s*\{\s*lt:/);
  });
});

describe('Admin-confirmation fan-out always reaches the super admin', () => {
  it('league + ad confirmation emails use getApprovalNotificationEmails', () => {
    const leagueFanOut = sliceFunction(
      approvalService,
      'async function notifyAllAdminsOfLeagueAction',
      1200
    );
    const adFanOut = sliceFunction(
      approvalService,
      'async function notifyAllAdminsOfAdAction',
      1200
    );
    expect(leagueFanOut).toMatch(/getApprovalNotificationEmails/);
    expect(adFanOut).toMatch(/getApprovalNotificationEmails/);
  });
});

describe('Game approval — token-path self-review + creator-side edit authority', () => {
  it('applyGameApprovalDecision carries the self-review guard (covers the email-token path)', () => {
    const applyDecision = sliceFunction(games, 'async function applyGameApprovalDecision');
    expect(applyDecision).toMatch(/created_by_id === actingUserId/);
    expect(applyDecision).toMatch(/cannot approve or reject a game you created/i);
  });

  it('the in-app game approve endpoint emits an APPROVE_GAME / REJECT_GAME audit row', () => {
    // The token path already logged; the in-app PUT /:id/approve now does too.
    expect(games).toMatch(/'APPROVE_GAME'\s*:\s*'REJECT_GAME'/);
  });

  it('PUT and PATCH /games/:id authorize on the creator side only, not both teams', () => {
    const putEdit = sliceFunction(games, 'Only the CREATOR side may edit a shared game', 600);
    const patchEdit = sliceFunction(games, 'Creator-side only', 600);
    expect(putEdit).toMatch(/creatorSideTeamIds\(/);
    expect(patchEdit).toMatch(/creatorSideTeamIds\(/);
    // The old both-teams authorization must not linger on the edit paths.
    expect(putEdit).not.toMatch(/\[game\.home_team_id,\s*game\.away_team_id\]/);
    expect(patchEdit).not.toMatch(/\[game\.home_team_id,\s*game\.away_team_id\]/);
  });
});

describe('Event approval — in-app path is auditable', () => {
  it('in-app event approve and reject emit APPROVE_EVENT / REJECT_EVENT rows', () => {
    expect(events).toMatch(/logAdminActivityFromReq\(\s*req,\s*\n?\s*'APPROVE_EVENT'/);
    expect(events).toMatch(/logAdminActivityFromReq\(\s*req,\s*\n?\s*'REJECT_EVENT'/);
  });
});

describe('Org invites — authorized-user cap counts the invite being created', () => {
  it('incremental org invite includes the +1 for the new invite (no off-by-one slot leak)', () => {
    // At exactly (invites + members) === limit, omitting the +1 let one extra
    // invite through, leaking a slot over the paid plan cap.
    expect(organizations).toMatch(/const totalAuthorized = inviteCount \+ memberCount \+ 1;/);
  });
});
