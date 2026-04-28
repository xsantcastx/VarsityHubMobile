import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const approvalsScreen = readFileSync(
  join(process.cwd(), '..', 'app', '(tabs)', 'approvals.tsx'),
  'utf8'
);
const pendingApprovalScreen = readFileSync(
  join(process.cwd(), '..', 'app', 'onboarding', 'pending-approval.tsx'),
  'utf8'
);
const leaguePendingApprovalScreen = readFileSync(
  join(process.cwd(), '..', 'app', 'onboarding', 'league-pending-approval.tsx'),
  'utf8'
);
const adminAdsScreen = readFileSync(
  join(process.cwd(), '..', 'app', 'admin-ads.tsx'),
  'utf8'
);
const adminDashboardScreen = readFileSync(
  join(process.cwd(), '..', 'app', 'admin-dashboard.tsx'),
  'utf8'
);
const eventApprovalsScreen = readFileSync(
  join(process.cwd(), '..', 'app', '(tabs)', 'event-approvals.tsx'),
  'utf8'
);
const joinRequestsScreen = readFileSync(
  join(process.cwd(), '..', 'app', 'organization-join-requests.tsx'),
  'utf8'
);
const onboardingIndexScreen = readFileSync(
  join(process.cwd(), '..', 'app', 'onboarding', 'index.tsx'),
  'utf8'
);
const authProvider = readFileSync(
  join(process.cwd(), '..', 'context', 'AuthProvider.tsx'),
  'utf8'
);
const appRouteDecisions = readFileSync(
  join(process.cwd(), '..', 'utils', 'appRouteDecisions.ts'),
  'utf8'
);
const step3LeagueScreen = readFileSync(
  join(process.cwd(), '..', 'app', 'onboarding', 'step-3-league.tsx'),
  'utf8'
);

describe('coach approval UI guards', () => {
  it('decline flow resets both declining state and row action loading in finally', () => {
    expect(approvalsScreen).toMatch(
      /handleDeclineConfirm[\s\S]*?setActionLoading\(declineTarget\.user\.id\);/
    );
    expect(approvalsScreen).toMatch(
      /handleDeclineConfirm[\s\S]*?finally\s*\{[\s\S]*?setActionLoading\(null\);[\s\S]*?setDeclining\(false\);/
    );
  });

  it.each([
    ['pending-approval.tsx', pendingApprovalScreen],
    ['league-pending-approval.tsx', leaguePendingApprovalScreen],
  ])('%s guards approved CTA navigation against double-taps', (_name, source) => {
    expect(source).toMatch(/const isNavigatingRef = useRef\(false\)/);
    expect(source).toMatch(
      /const handleApprovedNavigation = useCallback\(async \(redirect: 'organization' \| 'create-team'\) => \{[\s\S]*?if \(isNavigatingRef\.current\) return;/
    );
    expect(source).toMatch(/setNavigationTarget\(redirect\);/);
    expect(source).toMatch(/disabled=\{navigationTarget !== null\}/);
    expect(source).toMatch(/if \(mountedRef\.current\) setNavigationTarget\(null\);/);
  });

  it.each([
    ['pending-approval.tsx', pendingApprovalScreen],
    ['league-pending-approval.tsx', leaguePendingApprovalScreen],
  ])('%s does not locally mark onboarding complete while waiting for approval', (_name, source) => {
    expect(source).not.toMatch(/markOnboardingCompleteLocally/);
    expect(source).not.toMatch(/onboarding_completed:\s*true/);
  });

  it('coach application submission routes to waiting instead of locally completing onboarding', () => {
    const submitSnippet = step3LeagueScreen.match(
      /httpPost\('\/auth\/coach-applications'[\s\S]*?const nextDecision = getPostAuthRouteDecision\(authUser\)[\s\S]*?if \(nextDecision\.route === '\/onboarding\/league-pending-approval'\)[\s\S]*?router\.replace\(\{[\s\S]*?pathname:\s*nextDecision\.route/
    )?.[0];
    expect(submitSnippet).toBeTruthy();
    expect(submitSnippet).not.toMatch(/markOnboardingCompleteLocally/);
    expect(submitSnippet).not.toMatch(/completeOnboarding\(/);
  });

  it.each([
    [
      'admin-ads.tsx',
      adminAdsScreen,
      /const signature = `\$\{adId\}\|\$\{action \?\? ''\}`;/,
    ],
    [
      'admin-dashboard.tsx',
      adminDashboardScreen,
      /const signature = `\$\{reviewType\}\|\$\{coachId\}\|\$\{leagueId\}\|\$\{action \?\? ''\}`;/,
    ],
    [
      'organization-join-requests.tsx',
      joinRequestsScreen,
      /const signature = `\$\{requestId\}\|\$\{action\}`;/,
    ],
    [
      'event-approvals.tsx',
      eventApprovalsScreen,
      /const signature = `\$\{reviewKind \?\? ''\}\|\$\{eventId\}\|\$\{action\}`;/,
    ],
  ])('%s handles email review links by deep-link signature, not one-shot session state', (_name, source, signatureRegex) => {
    expect(source).toMatch(/const lastHandledLinkRef = useRef<string \| null>\(null\)/);
    expect(source).not.toMatch(/emailReviewHandledRef/);
    expect(source).toMatch(signatureRegex);
    expect(source).toMatch(/if \(lastHandledLinkRef\.current === signature\) return;/);
    expect(source).toMatch(/lastHandledLinkRef\.current = signature;/);
  });

  it('onboarding index trusts canonical onboarding completion before falling back to preferences', () => {
    expect(onboardingIndexScreen).toContain('getOnboardingIndexRouteDecision');
    expect(appRouteDecisions).toContain('isCoachOnboardingComplete(user)');
  });

  it('step-3 league allows server-directed coach setup without bouncing back to earlier onboarding steps', () => {
    expect(step3LeagueScreen).toMatch(
      /const canEnterStep3FromServer =[\s\S]*coach_application_required[\s\S]*coach_agreement_required[\s\S]*coach_final_setup_required/
    );
    expect(step3LeagueScreen).toMatch(
      /if \(canEnterStep3FromServer\) \{[\s\S]*setOB\(\(?prev\)? => \{[\s\S]*role: nextRole,[\s\S]*step_2_visited: true,[\s\S]*\}\);[\s\S]*return;/
    );
    expect(step3LeagueScreen).toMatch(
      /if \(!ob\.role\) \{[\s\S]*router\.replace\('\/onboarding\/step-1-role'\);[\s\S]*\} else if \(!ob\.step_2_visited\) \{[\s\S]*router\.replace\('\/onboarding\/step-2-basic'\);/
    );
  });

  it('join-existing onboarding copy points to the league owner as decision maker', () => {
    expect(step3LeagueScreen).toContain("ownerName: 'the league owner'");
    expect(step3LeagueScreen).toContain('Optional message to league owner');
    expect(pendingApprovalScreen).toContain("params.ownerName || 'the league owner'");
  });

  it('client admin access requires a verified admin account before showing admin screens', () => {
    expect(authProvider).toMatch(
      /const isAdmin =\s*user\?\.email_verified === true &&\s*\(/
    );
  });
});
