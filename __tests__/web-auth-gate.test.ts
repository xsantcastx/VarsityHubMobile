import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const authProvider = read('context/AuthProvider.tsx');
const rootIndex = read('app/index.tsx');
const publicEvent = read('app/public-event.tsx');
const publicRoutes = read('utils/publicRoutes.ts');
const settingsScreen = read('app/settings/index.tsx');
const pendingApprovalFlow = read('hooks/usePendingApprovalFlow.ts');
const onboardingRoleStep = read('app/onboarding/step-1-role.tsx');

describe('web auth gate', () => {
  it('routes unauthenticated users into the public feed instead of forcing auth on entry', () => {
    expect(publicRoutes).toContain("export const GUEST_HOME_ROUTE = '/(tabs)/feed' as const;");
    expect(authProvider).toMatch(/const unauthenticatedEntryRoute = GUEST_HOME_ROUTE/);
    expect(authProvider).toMatch(
      /redirectWithTelemetry\(\s*unauthenticatedEntryRoute,\s*'unauthenticated'/
    );
    // Root index is a passive splash — AuthProvider/_layout own guest routing.
    // Its only replace call is the stalled-startup failsafe, which must be
    // timer-gated (never an immediate replace racing the central routing).
    expect(rootIndex).toMatch(/setTimeout\(\(\) => \{\s*router\.replace\(GUEST_HOME_ROUTE\)/);
  });

  it('keeps guest-browseable detail routes public and only gates mutations', () => {
    expect(publicRoutes).toContain("'post-detail'");
    expect(publicRoutes).toContain("'public-event'");
    expect(publicRoutes).toContain("'event-detail'");
    expect(publicRoutes).toContain("'game'");
    expect(publicRoutes).toContain("'user-profile'");
    expect(publicRoutes).toContain("'team-page'");
    expect(publicRoutes).toContain("'organization'");
    expect(publicEvent).not.toMatch(/const requiresWebLogin =/);
    expect(publicEvent).not.toMatch(/router\.replace\('\/sign-up'/);
    expect(publicEvent).toMatch(/promptForSignIn\(\s*\(\) => \{/);
    expect(publicEvent).toContain("message: 'Sign in to post to this event.'");
  });

  it('keeps payment redirect routes public so checkout handoff screens can reconcile before auth redirects fire', () => {
    expect(authProvider).toMatch(/'payment-success'/);
    expect(authProvider).toMatch(/'payment-cancel'/);
    expect(authProvider).toMatch(
      /const isPaymentRedirectScreen =\s*firstSegment === 'payment-success' \|\| firstSegment === 'payment-cancel';/
    );
  });

  it('keeps logout flows on the guest feed instead of dropping guests onto sign-in', () => {
    expect(settingsScreen).toContain('router.replace(GUEST_HOME_ROUTE);');
    expect(pendingApprovalFlow).toContain('replaceRoute(GUEST_HOME_ROUTE);');
    expect(onboardingRoleStep).toContain('router.replace(GUEST_HOME_ROUTE);');
    expect(authProvider).toMatch(
      /redirectWithTelemetry\(\s*unauthenticatedEntryRoute,\s*`session_expired:\$\{reason\}`,\s*userBeforeExpiry\s*\)/
    );
  });
});
