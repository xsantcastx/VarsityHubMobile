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
      /httpPost\('\/auth\/coach-applications'[\s\S]*?router\.replace\(\{\s*pathname:\s*'\/onboarding\/league-pending-approval'/
    )?.[0];
    expect(submitSnippet).toBeTruthy();
    expect(submitSnippet).not.toMatch(/markOnboardingCompleteLocally/);
    expect(submitSnippet).not.toMatch(/completeOnboarding\(/);
  });
});
