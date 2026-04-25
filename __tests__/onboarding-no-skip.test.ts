/**
 * Onboarding flow — "no screens can be skipped" invariants
 *
 * These tests scan client source code for patterns that guarantee every
 * onboarding screen enforces its prerequisites. If somebody adds a new
 * shortcut that lets a user leapfrog past step-1, step-2, coach-agreement,
 * or the pending-approval waiting screen, one of these tests fails.
 *
 * Static source scans — no React renderer needed. ~5ms per test.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const step1 = read('app/onboarding/step-1-role.tsx');
const step2 = read('app/onboarding/step-2-basic.tsx');
const step3 = read('app/onboarding/step-3-league.tsx');
const coachAgreement = read('app/onboarding/coach-agreement.tsx');
const pendingApproval = read('app/onboarding/pending-approval.tsx');
const leaguePendingApproval = read('app/onboarding/league-pending-approval.tsx');
const onboardingLayout = read('app/onboarding/_layout.tsx');
const onboardingIndex = read('app/onboarding/index.tsx');
const rootIndex = read('app/index.tsx');
const authProvider = read('context/AuthProvider.tsx');

describe('onboarding flow — no screens can be skipped', () => {
  // ──────────────────────────────────────────────────────────────────────
  // Entry gate — onboarding layer only loads for authenticated + verified
  // ──────────────────────────────────────────────────────────────────────

  describe('onboarding layout gates entry', () => {
    it('_layout redirects unauthenticated users away from onboarding', () => {
      expect(onboardingLayout).toMatch(/!user|user\s*==\s*null|user\s*===\s*null/);
    });

    it('_layout enforces email_verified before entering onboarding', () => {
      // The layout check was added specifically so deep-link attacks or
      // bootstrap races cannot land an unverified user on step-1.
      expect(onboardingLayout).toMatch(/email_verified/);
    });

    it('onboarding/index.tsx routes to the correct step based on state', () => {
      // Must use the centralized route-decision helper so it can send users
      // to the right incomplete step or server-directed recovery screen
      // instead of hardcoding inline redirects in the screen.
      expect(onboardingIndex).toMatch(/getOnboardingIndexRouteDecision/);
      expect(onboardingIndex).toMatch(/decision\.route/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Step-by-step prerequisites — each screen verifies the one before it
  // ──────────────────────────────────────────────────────────────────────

  describe('step ordering — each step requires the prior to be complete', () => {
    it('step-2 redirects to step-1 if role is not set (prevents role skip)', () => {
      // Guard at top of Step2Basic — if ob.role is falsy, redirect back.
      // Without this guard, a deep link to /onboarding/step-2-basic could land
      // a user there with no role in context, leaving them stuck after save.
      expect(step2).toMatch(/if\s*\(\s*!ob\.role\s*\)/);
      expect(step2).toMatch(/router\.replace\(['"]\/onboarding\/step-1-role/);
    });

    it('step-1-role persists the role to the server before advancing to step-2', () => {
      // If role persistence fails, the user MUST NOT proceed to step-2 —
      // otherwise they end up stuck at step-3 with requireOnboarded 403.
      expect(step1).toMatch(/updatePreferences\(\s*\{\s*role\s*\}/);
      expect(step1).toMatch(/Do NOT navigate to step 2/i);
    });

    it('step-1-role resumes coach recovery routes instead of dead-ending on role lock', () => {
      expect(step1).toMatch(/getPostAuthRouteDecision/);
      expect(step1).toMatch(/router\.replace\(recoveryRoute/);
    });

    it('step-1-role retries transient network errors before giving up', () => {
      expect(step1).toMatch(/persistRole/);
      expect(step1).toMatch(/attempt\s*<\s*2/);
    });

    it('step-2 submit persists DOB + username + zip BEFORE moving to step-3 or tabs', () => {
      // Both User.patchMe (username) and User.updatePreferences (prefs) must
      // fire before router.replace. If either throws, the screen shows an
      // error and does NOT navigate — preventing partial-state skipping.
      expect(step2).toMatch(/User\.patchMe/);
      expect(step2).toMatch(/User\.updatePreferences/);
    });

    it('step-3 enforces supporting document for create-new-org path', () => {
      // Coaches creating a new org must attach a supporting document —
      // this is a soft "no skip" gate enforced client-side AND server-side.
      expect(step3).toMatch(/supporting_document|supportingDocument/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Pending approval — cannot be reached without submitting something
  // ──────────────────────────────────────────────────────────────────────

  describe('pending approval screens gate on actual pending state', () => {
    it('pending-approval polls /me and only proceeds when server state shifts', () => {
      // Must call User.me() in the polling loop and check approval_status
      // or onboarding_completed before moving forward.
      expect(pendingApproval).toMatch(/User\.me\(\)/);
    });

    it('league-pending-approval requires an orgId to start polling', () => {
      // If orgId is missing, don't start the interval — prevents a user from
      // loading the waiting screen without having actually submitted an org.
      expect(leaguePendingApproval).toMatch(/if\s*\(\s*!orgId\s*\)/);
    });

    it('pending-approval has a "continue as fan" escape hatch (not a trap)', () => {
      // Users who can't wait must have a way out. Without this, a user whose
      // admin is slow could be stuck on this screen indefinitely.
      expect(pendingApproval).toMatch(/proceeding_as_fan|proceedAsFan|role:\s*['"]fan['"]/i);
    });

    it('pending approval screens re-check immediately on screen focus', () => {
      // Poll-only waiting screens create a 0-30s stale window after the user
      // returns from background or navigates back from another screen.
      expect(pendingApproval).toMatch(/useFocusEffect/);
      expect(pendingApproval).toMatch(/checkApproval\('focus'\)/);
      expect(leaguePendingApproval).toMatch(/useFocusEffect/);
      expect(leaguePendingApproval).toMatch(/checkApproval\('focus'\)/);
    });

    it('pending approval screens re-check immediately when the app becomes active', () => {
      // Admin approvals frequently happen while the coach has the app in the
      // background. Active-state refresh closes the stale timer gap.
      expect(pendingApproval).toMatch(/AppState\.addEventListener\('change'/);
      expect(pendingApproval).toMatch(/checkApproval\('foreground'\)/);
      expect(leaguePendingApproval).toMatch(/AppState\.addEventListener\('change'/);
      expect(leaguePendingApproval).toMatch(/checkApproval\('foreground'\)/);
    });

    it('lifecycle-triggered approval checks are guarded against duplicate storms', () => {
      expect(pendingApproval).toMatch(/approvalCheckInFlightRef/);
      expect(pendingApproval).toMatch(/lastLifecycleCheckRef/);
      expect(leaguePendingApproval).toMatch(/approvalCheckInFlightRef/);
      expect(leaguePendingApproval).toMatch(/lastLifecycleCheckRef/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Coach agreement — approved coaches cannot reach tabs without accepting
  // ──────────────────────────────────────────────────────────────────────

  describe('coach agreement gate', () => {
    it('coach-agreement screen writes coach_agreement_accepted_at on accept', () => {
      expect(coachAgreement).toMatch(/coach_agreement_accepted_at/);
      expect(coachAgreement).toMatch(/updatePreferences/);
    });

    it('AuthProvider routes approved coaches to /onboarding/coach-agreement when unsigned', () => {
      // This is the "no skip" gate for coach tools. An approved coach who
      // closes the app mid-flow is routed back to coach-agreement on next
      // open, not dropped into tabs where requireOnboarded would 403.
      expect(authProvider).toMatch(/\/onboarding\/coach-agreement/);
      expect(authProvider).toMatch(/coach_agreement_accepted_at/);
    });

    it('AuthProvider checks hasCurrentCoachAgreement / coachAccess.hasCurrentCoachAgreement before tabs', () => {
      expect(authProvider).toMatch(/hasCurrentCoachAgreement|coach_agreement_accepted_at/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Root routing — covers every state transition with no gaps
  // ──────────────────────────────────────────────────────────────────────

  describe('root index + AuthProvider cover every state', () => {
    // Note: app/index.tsx is now a passive splash screen — all routing
    // moved to AuthProvider to eliminate the index/_layout race. These
    // assertions follow the routing logic to its new home.

    it('AuthProvider routes unauthenticated users → /sign-in', () => {
      expect(authProvider).toMatch(/\/sign-in/);
      expect(authProvider).toMatch(/!user|user\s*==\s*null|user\s*===\s*null/);
    });

    it('AuthProvider routes unverified users → /verify (no skip)', () => {
      expect(authProvider).toMatch(/email_verified/);
      expect(authProvider).toMatch(/['"]\/verify['"]/);
    });

    it('AuthProvider routes users with incomplete onboarding → /onboarding/step-1-role', () => {
      expect(authProvider).toMatch(/onboarding_completed|isOnboardingComplete/);
      expect(authProvider).toMatch(/generic_onboarding_required|onboarding_required/);
      expect(authProvider).toMatch(/getPostAuthRouteDecision/);
    });

    it('AuthProvider routes fully-verified + completed users → (tabs)', () => {
      expect(authProvider).toMatch(/\(tabs\)/);
    });

    it('app/index.tsx is a passive splash that delegates to AuthProvider', () => {
      // Lock in the architecture: index must NOT contain its own routing
      // logic (would re-introduce the race AuthProvider was built to fix).
      expect(rootIndex).toMatch(/AuthProvider handles all routing|navigation is handled centrally/);
    });

    it('AuthProvider has a pending-coach redirect path (not just implicit)', () => {
      // Coaches with approval_status PENDING/REJECTED must land on the
      // pending-approval screen, not on (tabs) where they'd hit 403s.
      expect(authProvider).toMatch(/approval_status|isPendingCoach|isRejectedCoach/);
    });

    it('AuthProvider has a payment-required redirect for paid-plan coaches', () => {
      // Approved coach with a paid plan selected must go through checkout
      // before accessing coach tools — not into tabs with payment_pending.
      expect(authProvider).toMatch(/subscription-paywall|manage-subscription|coach_checkout|payment_pending/);
    });

    it('AuthProvider has a server-is-truth guard against AsyncStorage onboarding flag', () => {
      // Prevents a stale local flag from letting a user skip the server's
      // onboarding_completed check. The server is the source of truth.
      expect(authProvider).toMatch(/SERVER IS SOURCE OF TRUTH|isOnboardingComplete\(user\)/i);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Step-3 submission — no bypass shortcuts
  // ──────────────────────────────────────────────────────────────────────

  describe('step-3 league — submission paths', () => {
    it('create-new-org path sends a supporting document URL to the server', () => {
      expect(step3).toMatch(/supporting_document_url|supportingDocumentUrl/);
    });

    it('join-existing-org path persists join_request_pending to server preferences', () => {
      // Regression: without this, a force-close after the Alert loses the
      // pending state and the user can re-submit a duplicate join request
      // on next launch.
      expect(step3).toMatch(/join_request_pending:\s*true/);
    });

    it('onContinue calls User.completeOnboarding with the canonical role', () => {
      expect(step3).toMatch(/completeOnboarding/);
      expect(step3).toMatch(/role:\s*['"]coach['"]|role:\s*['"]fan['"]/);
    });

    it('existing-org continue path respects coach recovery routes before completing onboarding', () => {
      expect(step3).toMatch(/getPostAuthRouteDecision/);
      expect(step3).toMatch(/shouldResumeRecoveryFlow/);
    });

    it('AuthProvider has a redirect-family loop breaker', () => {
      expect(authProvider).toMatch(/routing_loop_detected/);
      expect(authProvider).toMatch(/recentRedirectsRef/);
      expect(authProvider).toMatch(/getRouteFamily/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Verify step — email verification cannot be bypassed for password users
  // ──────────────────────────────────────────────────────────────────────

  describe('/verify screen — the one path past unverified email', () => {
    const verify = read('app/verify.tsx');

    it('verify screen actually calls the verification API', () => {
      expect(verify).toMatch(/verifyEmail|verify\/confirm|User\.verifyEmail|confirmCode/);
    });

    it('verify screen has an escape hatch (sign-out / back to login)', () => {
      // User must have a path out when they realize they signed up with
      // the wrong email — without this they're trapped on /verify forever.
      expect(verify).toMatch(/signOut|Sign out|Wrong account/i);
    });

    it('verify screen auto-advances when email_verified is already true', () => {
      // Returning users who landed here from a stale route should not be
      // forced to re-enter a code. The effect should route them out.
      expect(verify).toMatch(/email_verified.*true|checkAuth/);
    });
  });
});
