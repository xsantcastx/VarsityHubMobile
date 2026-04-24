/**
 * Coach onboarding + approval structural invariants
 *
 * These tests scan server source code for patterns that MUST remain true
 * for the coach flow to work correctly. Integration tests that actually
 * boot Express are blocked by an ESM/Jest config issue (tracked separately);
 * these static checks cost ~5ms each and catch every regression class we've
 * shipped in the last few weeks.
 *
 * When a test here fails, it means somebody introduced a new code path that
 * bypasses the canonical helpers, fire-and-forget email pattern, or idempotent
 * approval contract. Fix the source, don't relax the test.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC_DIR = join(process.cwd(), 'src');
const ROUTES_DIR = join(SRC_DIR, 'routes');
const MIDDLEWARE_DIR = join(SRC_DIR, 'middleware');
const LIB_DIR = join(SRC_DIR, 'lib');

const read = (path: string) => readFileSync(path, 'utf8');

const approvalService = read(join(LIB_DIR, 'approvalService.ts'));
const email = read(join(LIB_DIR, 'email.ts'));
const adminEmails = read(join(LIB_DIR, 'adminEmails.ts'));
const requireOnboarded = read(join(MIDDLEWARE_DIR, 'requireOnboarded.ts'));
const requireVerified = read(join(MIDDLEWARE_DIR, 'requireVerified.ts'));
const auth = read(join(ROUTES_DIR, 'auth.ts'));
const organizations = read(join(ROUTES_DIR, 'organizations.ts'));
const teams = read(join(ROUTES_DIR, 'teams.ts'));
const admin = read(join(ROUTES_DIR, 'admin.ts'));

describe('coach flow structural invariants', () => {
  // ──────────────────────────────────────────────────────────────────────
  // Admin email fan-out — every admin notification uses the env-driven list
  // ──────────────────────────────────────────────────────────────────────

  describe('admin email fan-out goes through getAllAdminEmails()', () => {
    it('adminEmails.ts defines getAllAdminEmails with a non-personal fallback', () => {
      expect(/export function getAllAdminEmails/.test(adminEmails)).toBe(true);
      expect(/customerservice@varsityhub\.app/.test(adminEmails)).toBe(true);
    });

    it('league approval request notification uses getAllAdminEmails', () => {
      // email.ts::sendLeagueApprovalRequestEmail must iterate all admin recipients.
      // Slice a generous chunk after the declaration and assert the helper is
      // referenced there; don't try to regex-match a closing brace across ~40
      // lines of nested code.
      const startIdx = email.indexOf('export async function sendLeagueApprovalRequestEmail');
      expect(startIdx).toBeGreaterThanOrEqual(0);
      const fnBody = email.slice(startIdx, startIdx + 2000);
      expect(/getAllAdminEmails/.test(fnBody)).toBe(true);
    });

    it('coach approval/rejection admin confirmations use getAllAdminEmails', () => {
      expect(/getAllAdminEmails/.test(approvalService)).toBe(true);
    });

    it('coach application admin notification in auth.ts uses getAllAdminEmails', () => {
      const snippet = auth.match(/coach application[\s\S]{0,400}/i)?.[0] || '';
      expect(/getAllAdminEmails/.test(auth)).toBe(true);
      // Sanity: the notification path references the helper somewhere near
      // the coach-application logic (at minimum uses the helper at all).
      expect(snippet.length).toBeGreaterThan(0);
    });

    it('NO approval email sends hardcode a personal recipient', () => {
      // Accept customerservice@ as the safe fallback, reject any other hardcoded @gmail / @varsityhub.app
      const hardcoded = approvalService.match(/['"][\w.+-]+@(gmail\.com|yahoo\.com|hotmail\.com)['"]/gi);
      expect(hardcoded).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Idempotent approvals — every approve function uses the updateMany guard
  // ──────────────────────────────────────────────────────────────────────

  describe('approvals are race-safe (updateMany guarded + idempotent)', () => {
    it('approveOrganization uses updateMany guarded by admin_approved:false', () => {
      const fn = approvalService.match(/export async function approveOrganization[\s\S]*?^\}/m)?.[0];
      expect(fn).toBeTruthy();
      expect(/updateMany/.test(fn!)).toBe(true);
      expect(/admin_approved:\s*false/.test(fn!)).toBe(true);
    });

    it('approveOrganization is idempotent (early return on already-approved)', () => {
      const fn = approvalService.match(/export async function approveOrganization[\s\S]*?^\}/m)?.[0];
      expect(/if\s*\(\s*org\.admin_approved\s*\)/.test(fn!)).toBe(true);
      expect(/already:\s*true/.test(fn!)).toBe(true);
    });

    it('approveCoach checks for PENDING status before writing', () => {
      const fn = approvalService.match(/export async function approveCoach[\s\S]*?^\}/m)?.[0];
      expect(fn).toBeTruthy();
      expect(/approval_status\s*!==?\s*['"]PENDING['"]/.test(fn!)).toBe(true);
    });

    it('coach join-request approval in organizations.ts runs in a transaction', () => {
      const snippet = organizations.match(/approveCoach[\s\S]{0,6000}/)?.[0] || organizations;
      expect(/prisma\.\$transaction/.test(snippet)).toBe(true);
    });

    it('approval side effects (emails, push) are fire-and-forget via .catch()', () => {
      // Every send in approvalService must either be awaited inside a
      // try/catch OR have a .catch(...) to isolate failures. We require the
      // .catch pattern specifically because it's the one we can statically
      // verify — awaiting wrapped in try/catch is fine but harder to detect.
      const sendSites = approvalService.match(/send(?:League|Coach|Ad|Event|AdminAction)[A-Za-z]+Email\(/g) || [];
      expect(sendSites.length).toBeGreaterThan(0);
      // Count catch handlers in proximity. We require AT LEAST as many .catch
      // usages as send sites (indicates each has error isolation).
      const catchSites = approvalService.match(/\.catch\(/g) || [];
      expect(catchSites.length).toBeGreaterThanOrEqual(sendSites.length);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Canonical role usage — no new route re-reads preferences.role directly
  // ──────────────────────────────────────────────────────────────────────

  describe('canonical auth-state helpers are used in middleware', () => {
    it('requireOnboarded uses getCanonicalUserRole (not preferences.role directly)', () => {
      expect(/getCanonicalUserRole/.test(requireOnboarded)).toBe(true);
    });

    it('requireOnboarded uses isUserOnboardingComplete (not checking prefs directly)', () => {
      expect(/isUserOnboardingComplete/.test(requireOnboarded)).toBe(true);
    });

    it('requireVerified uses isUserOnboardingComplete for its onboarding bypass', () => {
      expect(/isUserOnboardingComplete/.test(requireVerified)).toBe(true);
    });

    it('requireOnboarded selects BOTH role column and onboarding_completed column in its findUnique', () => {
      // The canonical helpers can only work if the column is present in the
      // Prisma select. Without this, getCanonicalUserRole would silently
      // fall through to preferences.role and the bypass would fail for coaches
      // whose prefs JSON lagged the column.
      expect(requireOnboarded.includes('role: true')).toBe(true);
      expect(requireOnboarded.includes('onboarding_completed: true')).toBe(true);
    });

    it('requireVerified selects the role + onboarding_completed columns (lockstep with requireOnboarded)', () => {
      expect(requireVerified.includes('role: true')).toBe(true);
      expect(requireVerified.includes('onboarding_completed: true')).toBe(true);
    });

    it('requireOnboarded payment gate uses canonical billing/auth helpers, not prefs.role drift', () => {
      expect(/getSelectedPlan/.test(requireOnboarded)).toBe(true);
      expect(/isPaymentPending/.test(requireOnboarded)).toBe(true);
      expect(/isPaymentApproved/.test(requireOnboarded)).toBe(true);
      expect(/prefs\?\.role\s*===\s*['"]coach['"]/.test(requireOnboarded)).toBe(false);
    });

    it('teams create route uses canonical role/onboarding helpers for approval gating', () => {
      expect(/getCanonicalUserRole/.test(teams)).toBe(true);
      expect(/isUserOnboardingComplete/.test(teams)).toBe(true);
      expect(/prefsCheck\.role\s*===\s*['"]coach['"]/.test(teams)).toBe(false);
      expect(/prefsCheck\.onboarding_completed\s*!==\s*true/.test(teams)).toBe(false);
    });

    it('OAuth sign-in paths return a 409 conflict for same-email existing accounts instead of auto-linking', () => {
      expect(auth).toMatch(/buildOAuthExistingAccountConflict/);
      expect(auth).toMatch(/status\(409\)/);
    });

    it('Google same-email OAuth collision lookup is case-insensitive', () => {
      expect(auth).toMatch(
        /existingByEmail\s*=\s*await prisma\.user\.findFirst\(\{\s*where:\s*\{\s*email:\s*\{\s*equals:\s*email,\s*mode:\s*'insensitive'/
      );
    });

    it('provider-linked OAuth accounts still sign in by provider id before email collision handling', () => {
      expect(auth).toMatch(/findUnique\(\{\s*where:\s*\{\s*google_id:\s*googleId\s*\}\s*\}\)/);
      expect(auth).toMatch(/findUnique\(\{\s*where:\s*\{\s*apple_id:\s*appleId\s*\}\s*\}\)/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Coach-only prerequisite gates — server enforces, doesn't trust client
  // ──────────────────────────────────────────────────────────────────────

  describe('server enforces coach approval prerequisites', () => {
    it('requireOnboarded blocks coaches with approval_status !== APPROVED', () => {
      expect(
        /approval_status\s*!==?\s*['"]APPROVED['"]/.test(requireOnboarded)
      ).toBe(true);
    });

    it('requireOnboarded blocks approved coaches without accepted coach agreement', () => {
      expect(/COACH_AGREEMENT_REQUIRED/.test(requireOnboarded)).toBe(true);
    });

    it('requireOnboarded blocks approved coaches whose org is not admin_approved', () => {
      expect(requireOnboarded).toMatch(/admin_approved/);
      expect(requireOnboarded).toMatch(/organization is pending approval/i);
    });

    it('requireOnboarded enforces paid-plan checkout for paying coaches', () => {
      expect(/PAYMENT_REQUIRED/.test(requireOnboarded)).toBe(true);
      expect(/isPaymentPending/.test(requireOnboarded)).toBe(true);
      expect(/getSelectedPlan/.test(requireOnboarded)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Upgrade-to-coach path — age gate, DOB gate, rejection cooldown
  // ──────────────────────────────────────────────────────────────────────

  describe('upgrade-to-coach guardrails', () => {
    it('POST /upgrade-to-coach rejects users already in coach role', () => {
      expect(/Account is already a coach/.test(auth)).toBe(true);
    });

    it('POST /upgrade-to-coach enforces DOB required (no silent bypass)', () => {
      expect(/DOB_REQUIRED/.test(auth)).toBe(true);
    });

    it('POST /upgrade-to-coach enforces 18+ age requirement', () => {
      expect(/AGE_REQUIREMENT/.test(auth)).toBe(true);
      expect(/18 years old/.test(auth)).toBe(true);
    });

    it('POST /upgrade-to-coach enforces 48h rejection cooldown', () => {
      expect(/REJECTION_COOLDOWN/.test(auth)).toBe(true);
      expect(/REJECTION_COOLDOWN_MS\s*=\s*48\s*\*\s*60\s*\*\s*60\s*\*\s*1000/.test(auth)).toBe(true);
    });

    it('POST /upgrade-to-coach sets approval_status=PENDING on success', () => {
      const fn = auth.match(/\/upgrade-to-coach[\s\S]*?approval_status[\s\S]*?^\)/m)?.[0];
      expect(fn).toBeTruthy();
      expect(/approval_status:\s*['"]PENDING['"]/.test(fn!)).toBe(true);
    });

    it('POST /upgrade-to-coach resets onboarding_completed to false', () => {
      const fn = auth.match(/\/upgrade-to-coach[\s\S]*?onboarding_completed[\s\S]*?^\)/m)?.[0];
      expect(fn).toBeTruthy();
      expect(/onboarding_completed:\s*false/.test(fn!)).toBe(true);
    });

    it('rejection cooldown returns retry_at ISO timestamp (not just hours)', () => {
      // Regression: hour-rounded-up values read misleadingly; retry_at is the
      // absolute wall-clock time the user can re-apply.
      expect(auth).toMatch(/retry_at:/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // complete-onboarding — required field validation
  // ──────────────────────────────────────────────────────────────────────

  describe('POST /auth/complete-onboarding coach field validation', () => {
    it('rejects coach onboarding without a username', () => {
      expect(/Username required for coach onboarding/.test(auth)).toBe(true);
    });

    it('rejects coach onboarding without a plan', () => {
      expect(/Plan selection required for coach onboarding/.test(auth)).toBe(true);
    });

    it('rejects coach onboarding without a team or organization', () => {
      expect(/Team or organization required for coach onboarding/.test(auth)).toBe(true);
      expect(/ORG_TEAM_REQUIRED/.test(auth)).toBe(true);
    });

    it('rejects setting role=coach after onboarding complete except via /upgrade-to-coach', () => {
      expect(/Cannot change role after onboarding is complete/.test(auth)).toBe(true);
    });

    it('enforces 18+ age gate when role transitions to coach', () => {
      const coachGateSnippet = auth.match(/18[\s\S]{0,300}coach/gi)?.join('\n') || '';
      expect(coachGateSnippet.length).toBeGreaterThan(0);
    });
  });

  describe('coach application submission invariants', () => {
    it('submitting a coach application does not mutate User.role', () => {
      const fn = auth.match(/\/coach-applications[\s\S]*?return res\.status\(201\)\.json/m)?.[0];
      expect(fn).toBeTruthy();
      expect(fn).toMatch(/currentRole !== 'coach'/);
      expect(fn).not.toMatch(/role:\s*'coach'/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Organization creation — admin notification fires
  // ──────────────────────────────────────────────────────────────────────

  describe('organization creation notification flow', () => {
    it('organization create-data sanitizer defaults to pending but supports approved final-setup orgs', () => {
      expect(/const adminApproved = options\?\.adminApproved === true;/.test(organizations)).toBe(
        true
      );
      expect(/admin_approved:\s*adminApproved/.test(organizations)).toBe(true);
      expect(/approved_at:\s*adminApproved \? new Date\(\) : null/.test(organizations)).toBe(
        true
      );
    });

    it('only onboarding final-setup with approved user plus approved application can skip pending org approval', () => {
      expect(/params\.onboarding !== true/.test(organizations)).toBe(true);
      expect(/String\(params\.approvalStatus \|\| ''\)\.toUpperCase\(\) !== 'APPROVED'/.test(organizations)).toBe(true);
      expect(/latestApplication\?\.status !== 'approved'/.test(organizations)).toBe(true);
    });

    it('organization writes flow through an explicit create-data sanitizer', () => {
      expect(/function buildOrganizationCreateData/.test(organizations)).toBe(true);
      const createRouteBlock = organizations.match(/organizationsRouter\.post\(\s*['"]\/['"][\s\S]{0,5000}/)?.[0] || '';
      const createWithTeamsBlock = organizations.match(/organizationsRouter\.post\(\s*['"]\/create['"][\s\S]{0,5000}/)?.[0] || '';
      expect(/data:\s*buildOrganizationCreateData\(data,\s*req\.user!\.id,\s*\{/.test(createRouteBlock)).toBe(true);
      expect(/data:\s*buildOrganizationCreateData\(data,\s*req\.user!\.id,\s*\{/.test(createWithTeamsBlock)).toBe(true);
    });

    it('organization create routes do not spread parsed onboarding payloads into Prisma writes', () => {
      expect(/\.\.\.orgFields/.test(organizations)).toBe(false);
      const createCalls = organizations.match(/organization\.create\(\{[\s\S]{0,600}/g) || [];
      expect(createCalls.length).toBeGreaterThan(0);
      for (const call of createCalls) {
        expect(/\.\.\.data/.test(call)).toBe(false);
        expect(/\.\.\.orgFields/.test(call)).toBe(false);
      }
    });

    it('POST /organizations triggers sendLeagueApprovalRequestEmail', () => {
      expect(/sendLeagueApprovalRequestEmail/.test(organizations)).toBe(true);
    });

    it('coach join requests notify the organization owner', () => {
      expect(/sendCoachJoinRequestEmail/.test(organizations)).toBe(true);
    });

    it('coach approval in org path sends sendCoachApprovedEmail', () => {
      expect(/sendCoachApprovedEmail/.test(organizations)).toBe(true);
    });

    it('coach rejection in org path sends sendCoachRejectedEmail', () => {
      expect(/sendCoachRejectedEmail/.test(organizations)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Cache invalidation on state changes — /me must reflect reality
  // ──────────────────────────────────────────────────────────────────────

  describe('cache invalidation after state transitions', () => {
    it('approvalService calls invalidateMeCacheForUser after approve/reject', () => {
      expect(/invalidateMeCacheForUser/.test(approvalService)).toBe(true);
    });

    it('org route approval/rejection calls invalidateMeCacheForUser', () => {
      expect(/invalidateMeCacheForUser/.test(organizations)).toBe(true);
    });

    it('/upgrade-to-coach invalidates cache on success', () => {
      const fn = auth.match(/\/upgrade-to-coach[\s\S]*?invalidateMeCacheForUser/m)?.[0];
      expect(fn).toBeTruthy();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Admin dashboard surface — admins can see the backlog
  // ──────────────────────────────────────────────────────────────────────

  describe('admin dashboard exposes pending backlog', () => {
    it('/admin/dashboard returns pendingLeagues', () => {
      expect(/pendingLeagues/.test(admin)).toBe(true);
      expect(/admin_approved:\s*false/.test(admin)).toBe(true);
    });

    it('/admin/dashboard returns pendingCoaches', () => {
      expect(/pendingCoaches/.test(admin)).toBe(true);
      expect(/approval_status:\s*['"]PENDING['"]/.test(admin)).toBe(true);
    });

    it('admin approve/reject coach endpoints call centralized functions', () => {
      expect(/approveCoach\(/.test(admin)).toBe(true);
      expect(/rejectCoach\(/.test(admin)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Approval email wiring — every transition has a user notification
  // ──────────────────────────────────────────────────────────────────────

  describe('every approval transition has a user-facing email', () => {
    it('sendLeagueApprovedEmail is defined', () => {
      expect(/export async function sendLeagueApprovedEmail/.test(email)).toBe(true);
    });

    it('sendLeagueRejectedEmail is defined', () => {
      expect(/export async function sendLeagueRejectedEmail/.test(email)).toBe(true);
    });

    it('sendCoachApprovedEmail is defined', () => {
      expect(/export async function sendCoachApprovedEmail/.test(email)).toBe(true);
    });

    it('sendCoachRejectedEmail is defined', () => {
      expect(/export async function sendCoachRejectedEmail/.test(email)).toBe(true);
    });

    it('sendAdApprovedEmail is defined', () => {
      expect(/export async function sendAdApprovedEmail/.test(email)).toBe(true);
    });

    it('sendAdRejectedEmail is defined', () => {
      expect(/export async function sendAdRejectedEmail/.test(email)).toBe(true);
    });

    it('sendEventApprovedEmail is defined', () => {
      expect(/export async function sendEventApprovedEmail/.test(email)).toBe(true);
    });

    it('sendEventDeniedEmail is defined', () => {
      expect(/export async function sendEventDeniedEmail/.test(email)).toBe(true);
    });

    it('sendAdminActionConfirmationEmail (admin fan-out on actions) is defined', () => {
      expect(/export async function sendAdminActionConfirmationEmail/.test(email)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Approval email wired into approvalService (every code path references them)
  // ──────────────────────────────────────────────────────────────────────

  describe('approvalService imports all required email senders', () => {
    it('imports league approved/rejected senders', () => {
      expect(/sendLeagueApprovedEmail/.test(approvalService)).toBe(true);
      expect(/sendLeagueRejectedEmail/.test(approvalService)).toBe(true);
    });

    it('imports coach approved/rejected senders', () => {
      expect(/sendCoachApprovedEmail/.test(approvalService)).toBe(true);
      expect(/sendCoachRejectedEmail/.test(approvalService)).toBe(true);
    });

    it('imports ad approved/rejected senders', () => {
      expect(/sendAdApprovedEmail/.test(approvalService)).toBe(true);
      expect(/sendAdRejectedEmail/.test(approvalService)).toBe(true);
    });

    it('imports event approved/denied senders', () => {
      expect(/sendEventApprovedEmail/.test(approvalService)).toBe(true);
      expect(/sendEventDeniedEmail/.test(approvalService)).toBe(true);
    });

    it('imports admin confirmation email (fan-out to all admins on action)', () => {
      expect(/sendAdminActionConfirmationEmail/.test(approvalService)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Startup boot-time visibility — missing config surfaces loud
  // ──────────────────────────────────────────────────────────────────────

  describe('server/src/index.ts startup safety guards', () => {
    const indexSrc = read(join(SRC_DIR, 'index.ts'));

    it('warns loudly if ADMIN_EMAILS is empty at boot', () => {
      expect(/ADMIN_EMAILS env var is empty/.test(indexSrc)).toBe(true);
    });

    it('warns loudly if SENDGRID_API_KEY is missing at boot', () => {
      expect(/SENDGRID_API_KEY is missing/.test(indexSrc)).toBe(true);
    });

    it('runs a Cloudinary auth probe at boot and logs the outcome', () => {
      expect(/Cloudinary auth probe/.test(indexSrc)).toBe(true);
      expect(/uploadBufferToCloudinary/.test(indexSrc)).toBe(true);
    });
  });
});
