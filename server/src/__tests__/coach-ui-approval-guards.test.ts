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
const pendingApprovalFlowHook = readFileSync(
  join(process.cwd(), '..', 'hooks', 'usePendingApprovalFlow.ts'),
  'utf8'
);
const adminAdsScreen = readFileSync(join(process.cwd(), '..', 'app', 'admin-ads.tsx'), 'utf8');
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
const authProvider = readFileSync(join(process.cwd(), '..', 'context', 'AuthProvider.tsx'), 'utf8');
const appRouteDecisions = readFileSync(
  join(process.cwd(), '..', 'utils', 'appRouteDecisions.ts'),
  'utf8'
);
const step3LeagueScreen = readFileSync(
  join(process.cwd(), '..', 'app', 'onboarding', 'step-3-league.tsx'),
  'utf8'
);

describe('coach approval UI guards', () => {
  it('approvals screen is now an org-picker shell that forwards into organization requests', () => {
    expect(approvalsScreen).toContain('Organization.reviewSummaries()');
    expect(approvalsScreen).toContain('useAuth');
    expect(approvalsScreen).not.toContain('CoachAccessRedirecting');
    expect(approvalsScreen).toContain('function buildOrganizationRequestsRoute');
    expect(approvalsScreen).toContain("safeGoBack(router, '/organization?tab=requests')");
    expect(approvalsScreen).toMatch(/const hasAutoForwardedRef = useRef\(false\)/);
    expect(approvalsScreen).toMatch(
      /if \(loading \|\| refreshing \|\| error \|\| entries\.length !== 1 \|\| hasAutoForwardedRef\.current\)/
    );
    expect(approvalsScreen).toMatch(
      /hasAutoForwardedRef\.current = true;[\s\S]*router\.replace\(buildOrganizationRequestsRoute\(entries\[0\]\.id\)\);/
    );
  });

  it('pending approval navigation guards live in the shared hook and screens consume the disabled state', () => {
    expect(pendingApprovalFlowHook).toMatch(/const isNavigatingRef = useRef\(false\)/);
    expect(pendingApprovalFlowHook).toMatch(
      /const handleApprovedNavigation = useCallback\(\s*async \(redirect: 'organization' \| 'create-team'\) => \{[\s\S]*?if \(isNavigatingRef\.current\) return;/
    );
    expect(pendingApprovalFlowHook).toMatch(/setNavigationTarget\(redirect\);/);
    expect(pendingApprovalFlowHook).toMatch(
      /if \(mountedRef\.current\) setNavigationTarget\(null\);/
    );

    expect(pendingApprovalScreen).toContain('usePendingApprovalActions({');
    expect(pendingApprovalScreen).toMatch(/disabled=\{navigationTarget !== null\}/);
    expect(leaguePendingApprovalScreen).toContain('usePendingApprovalActions({');
    expect(leaguePendingApprovalScreen).toMatch(/disabled=\{navigationTarget !== null\}/);
  });

  it.each([
    ['pending-approval.tsx', pendingApprovalScreen],
    ['league-pending-approval.tsx', leaguePendingApprovalScreen],
  ])('%s does not locally mark onboarding complete while waiting for approval', (_name, source) => {
    expect(source).not.toMatch(/markOnboardingCompleteLocally/);
    expect(source).not.toMatch(/onboarding_completed:\s*true/);
  });

  it.each([
    ['pending-approval.tsx', pendingApprovalScreen],
    ['league-pending-approval.tsx', leaguePendingApprovalScreen],
  ])('%s enables fan mode without rewriting the account role', (_name, source) => {
    expect(source).toMatch(/User\.updatePreferences\(\{\s*proceeding_as_fan:\s*true\s*\}\)/);
    expect(source).not.toMatch(
      /User\.updatePreferences\(\{\s*proceeding_as_fan:\s*true,\s*role:\s*'fan'\s*\}\)/
    );
  });

  it('pending approval screen keys fan mode off proceeding_as_fan instead of a raw role fallback', () => {
    expect(pendingApprovalScreen).toContain(
      'const isProceedingAsFan = isProceedingAsFanSnapshot(me);'
    );
    expect(pendingApprovalScreen).not.toContain("isProceedingAsFanSnapshot(me) || role === 'fan'");
  });

  it('coach application submission routes to waiting instead of locally completing onboarding', () => {
    const submitSnippet = step3LeagueScreen.match(
      /httpPost\('\/auth\/coach-applications'[\s\S]*?const nextDecision = getPostAuthRouteDecision\(authUser\)[\s\S]*?routeFromDecision\(nextDecision\.route,[\s\S]*?organizationName:\s*orgName\.trim\(\)/
    )?.[0];
    expect(submitSnippet).toBeTruthy();
    expect(submitSnippet).not.toMatch(/markOnboardingCompleteLocally/);
    expect(submitSnippet).not.toMatch(/completeOnboarding\(/);
  });

  it.each([
    ['admin-ads.tsx', adminAdsScreen, /const signature = `\$\{adId\}\|\$\{action \?\? ''\}`;/],
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
  ])(
    '%s handles email review links by deep-link signature, not one-shot session state',
    (_name, source, signatureRegex) => {
      expect(source).toMatch(/const lastHandledLinkRef = useRef<string \| null>\(null\)/);
      expect(source).not.toMatch(/emailReviewHandledRef/);
      expect(source).toMatch(signatureRegex);
      expect(source).toMatch(/if \(lastHandledLinkRef\.current === signature\) return;/);
      expect(source).toMatch(/lastHandledLinkRef\.current = signature;/);
    }
  );

  it('event approvals is coach-gated through useRequireCoach with a redirecting fallback', () => {
    expect(eventApprovalsScreen).toContain(
      'const loaders: Promise<void>[] = [loadEvents(), loadTeamInvites(), loadOrgRequests()];'
    );
    expect(eventApprovalsScreen).toContain('useAuth');
    // The screen is the coach review hub: useRequireCoach owns the redirect
    // (approved-but-blocked coaches go to coach-agreement, never a pending
    // screen) and CoachAccessRedirecting renders while it happens. Roster
    // invites for non-coaches live on app/team-invites.tsx.
    expect(eventApprovalsScreen).toContain(
      'const { canAccessCoachTools, loading: coachLoading } = useRequireCoach();'
    );
    expect(eventApprovalsScreen).toContain('return <CoachAccessRedirecting');
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
      /const canonicalStep3Route = user \? getPostAuthRouteDecision\(user as any\)\.route : null;/
    );
    expect(step3LeagueScreen).toMatch(
      /canonicalStep3Route &&[\s\S]*router\.replace\(canonicalStep3Route as any\);/
    );
    expect(step3LeagueScreen).toMatch(
      /if \(canEnterStep3FromServer\) \{[\s\S]*setOB\(\(?prev\)? => \{[\s\S]*role: nextRole,[\s\S]*step_2_visited: true,[\s\S]*\}\);[\s\S]*return;/
    );
    expect(step3LeagueScreen).toMatch(
      /if \(!ob\.role\) \{[\s\S]*router\.replace\('\/onboarding\/step-1-role'\);[\s\S]*\} else if \(!ob\.step_2_visited\) \{[\s\S]*router\.replace\('\/onboarding\/step-2-basic'\);/
    );
    expect(step3LeagueScreen).not.toMatch(
      /const me: any = await User\.me\(\);[\s\S]*const finalSetupRequired =/
    );
  });

  it('final coach setup mode suppresses search-and-join UI and explains that approval already happened', () => {
    expect(step3LeagueScreen).toContain(
      'const canSearchForExistingOrganization = !isFinalCoachSetup;'
    );
    expect(step3LeagueScreen).toContain('setShowSearch(false);');
    expect(step3LeagueScreen).toContain('Approved Coach Setup');
    expect(step3LeagueScreen).toContain(
      'You do not need to apply again or search for an existing league here.'
    );
    expect(step3LeagueScreen).toMatch(/\{canSearchForExistingOrganization && showSearch \?/);
  });

  it('join-existing onboarding copy points to the league owner as decision maker', () => {
    expect(step3LeagueScreen).toContain("ownerName: 'the league owner'");
    expect(step3LeagueScreen).toContain('Optional message to league owner');
    expect(pendingApprovalScreen).toContain("params.ownerName || 'the league owner'");
  });

  it('client admin access requires a verified admin account before showing admin screens', () => {
    expect(authProvider).toMatch(/const isAdmin =\s*user\?\.email_verified === true &&\s*\(/);
  });
});
