/**
 * Coach approval flow — client routing & gating logic.
 *
 * Mirrors the server-side approval lifecycle (approvalService.ts /
 * requireOnboarded) on the client. `getPostAuthRouteDecision` is the single
 * function that decides where a user lands after auth: pending coaches wait,
 * rejected coaches wait or fall to fan mode, approved coaches reach the app.
 * If this matrix drifts, an approved coach can get stranded on a waiting screen
 * (or a pending coach can slip into the app) — neither is caught by tsc.
 *
 * Pure functions only — no rendering, no native modules.
 */
import { describe, expect, it } from '@jest/globals';

// usePendingApprovalFlow imports @/api/entities, whose transitive import of
// @sentry/react-native starts a cleanup setInterval that leaks an open handle
// and prevents Jest from exiting. The cooldown helpers under test are pure and
// never touch the API, so stub the module to sever that chain.
jest.mock('@/api/entities', () => ({ Notification: {}, User: {} }));

import { getPostAuthRouteDecision } from '@/utils/appRouteDecisions';
import { isProceedingAsFanSnapshot } from '@/utils/authState';
import {
  getCoachReapplyCooldownState,
  formatCoachReapplyCooldown,
} from '@/hooks/usePendingApprovalFlow';

const verified = { email_verified: true as const };

describe('getPostAuthRouteDecision — auth gates', () => {
  it('routes an unauthenticated user to sign-in', () => {
    expect(getPostAuthRouteDecision(null)).toEqual({
      kind: 'unauthenticated',
      route: '/sign-in',
    });
  });

  it('routes a pending-verification user to verify', () => {
    const decision = getPostAuthRouteDecision({ ...verified }, { pendingVerification: true });
    expect(decision.kind).toBe('pending_verification');
    expect(decision.route).toBe('/verify');
  });

  it('forces email verification before anything else', () => {
    const decision = getPostAuthRouteDecision({ email_verified: false });
    expect(decision.kind).toBe('email_verification_required');
    expect(decision.route).toBe('/verify');
  });
});

describe('getPostAuthRouteDecision — coach approval lifecycle (server-directed)', () => {
  it('keeps a submitted application on the waiting screen', () => {
    const decision = getPostAuthRouteDecision({
      ...verified,
      account_state: 'coach_application_submitted',
    });
    expect(decision.kind).toBe('server_application_submitted_waiting');
    expect(decision.route).toBe('/onboarding/league-pending-approval');
  });

  it('lets a submitted applicant proceed as a fan', () => {
    const decision = getPostAuthRouteDecision({
      ...verified,
      account_state: 'coach_application_submitted',
      proceeding_as_fan: true,
    });
    expect(decision.kind).toBe('server_application_submitted_fan_mode');
    expect(decision.route).toBe('/(tabs)/feed');
  });

  it('keeps a rejected applicant on the waiting screen', () => {
    const decision = getPostAuthRouteDecision({
      ...verified,
      account_state: 'coach_application_rejected',
    });
    expect(decision.kind).toBe('server_application_rejected_waiting');
    expect(decision.route).toBe('/onboarding/league-pending-approval');
  });

  it('lets a rejected applicant fall back to fan mode (never trapped)', () => {
    const decision = getPostAuthRouteDecision({
      ...verified,
      account_state: 'coach_application_rejected',
      proceeding_as_fan: true,
    });
    expect(decision.kind).toBe('server_application_rejected_fan_mode');
    expect(decision.route).toBe('/(tabs)/feed');
  });

  it('routes a pending-approval coach to the generic waiting screen', () => {
    const decision = getPostAuthRouteDecision({
      ...verified,
      account_state: 'coach_pending_approval',
    });
    expect(decision.kind).toBe('server_pending_approval_waiting');
    expect(decision.route).toBe('/onboarding/pending-approval');
  });

  it('routes a league-scoped pending coach to the league waiting screen', () => {
    const decision = getPostAuthRouteDecision({
      ...verified,
      account_state: 'coach_pending_approval',
      next_step: '/onboarding/league-pending-approval',
    });
    expect(decision.kind).toBe('server_pending_approval_league_waiting');
    expect(decision.route).toBe('/onboarding/league-pending-approval');
  });

  it('routes an approved coach who must accept the agreement', () => {
    const decision = getPostAuthRouteDecision({
      ...verified,
      account_state: 'coach_agreement_required',
    });
    expect(decision.kind).toBe('server_coach_agreement_required');
    expect(decision.route).toBe('/onboarding/coach-agreement');
  });

  it('routes an approved coach into final setup', () => {
    const decision = getPostAuthRouteDecision({
      ...verified,
      account_state: 'coach_final_setup_required',
    });
    expect(decision.kind).toBe('server_final_setup_required');
    expect(decision.route).toBe('/onboarding/step-3-league');
  });
});

describe('getPostAuthRouteDecision — completed accounts reach the app', () => {
  it('sends a fully-onboarded fan to the feed', () => {
    const decision = getPostAuthRouteDecision({
      ...verified,
      onboarding_completed: true,
    });
    expect(decision.kind).toBe('app_home');
    expect(decision.route).toBe('/(tabs)/feed');
  });
});

describe('isProceedingAsFanSnapshot', () => {
  it('reads the canonical column first', () => {
    expect(isProceedingAsFanSnapshot({ proceeding_as_fan: true })).toBe(true);
    expect(isProceedingAsFanSnapshot({ proceeding_as_fan: false })).toBe(false);
  });

  it('falls back to preferences when the column is absent', () => {
    expect(isProceedingAsFanSnapshot({ preferences: { proceeding_as_fan: true } })).toBe(true);
    expect(isProceedingAsFanSnapshot(null)).toBe(false);
  });
});

describe('getCoachReapplyCooldownState — 48h re-apply gate after rejection', () => {
  const COOLDOWN_MS = 48 * 60 * 60 * 1000;

  it('is inactive when there is no rejection timestamp', () => {
    expect(getCoachReapplyCooldownState(null)).toEqual({
      isActive: false,
      remainingMs: 0,
      retryAt: null,
    });
  });

  it('is inactive for an unparseable timestamp', () => {
    expect(getCoachReapplyCooldownState('not-a-date').isActive).toBe(false);
  });

  it('is active immediately after rejection with ~48h remaining', () => {
    const now = Date.parse('2026-06-19T00:00:00.000Z');
    const state = getCoachReapplyCooldownState('2026-06-19T00:00:00.000Z', now);
    expect(state.isActive).toBe(true);
    expect(state.remainingMs).toBe(COOLDOWN_MS);
    expect(state.retryAt?.getTime()).toBe(now + COOLDOWN_MS);
  });

  it('expires exactly at the 48h boundary', () => {
    const rejectedAt = Date.parse('2026-06-19T00:00:00.000Z');
    const state = getCoachReapplyCooldownState(new Date(rejectedAt), rejectedAt + COOLDOWN_MS);
    expect(state.isActive).toBe(false);
    expect(state.remainingMs).toBe(0);
  });

  it('clamps remaining time to zero once the window has passed', () => {
    const rejectedAt = Date.parse('2026-06-19T00:00:00.000Z');
    const state = getCoachReapplyCooldownState(
      new Date(rejectedAt),
      rejectedAt + COOLDOWN_MS + 99999
    );
    expect(state.isActive).toBe(false);
    expect(state.remainingMs).toBe(0);
  });
});

describe('formatCoachReapplyCooldown', () => {
  it('formats hours and minutes', () => {
    expect(formatCoachReapplyCooldown((2 * 60 + 30) * 60000)).toBe('2h 30m');
  });
  it('formats whole hours', () => {
    expect(formatCoachReapplyCooldown(3 * 60 * 60000)).toBe('3h');
  });
  it('formats minutes only', () => {
    expect(formatCoachReapplyCooldown(5 * 60000)).toBe('5m');
  });
  it('never shows 0m (floors at 1m)', () => {
    expect(formatCoachReapplyCooldown(0)).toBe('1m');
  });
});
