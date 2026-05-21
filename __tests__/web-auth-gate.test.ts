import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const authProvider = read('context/AuthProvider.tsx');
const rootIndex = read('app/index.tsx');
const publicEvent = read('app/public-event.tsx');

describe('web auth gate', () => {
  it('routes unauthenticated web users into sign-up instead of leaving them in the app shell', () => {
    expect(authProvider).toMatch(/const unauthenticatedEntryRoute = Platform\.OS === 'web' \? '\/sign-up' : '\/sign-in'/);
    expect(authProvider).toMatch(/redirectWithTelemetry\(\s*unauthenticatedEntryRoute,\s*'unauthenticated'/);
    expect(rootIndex).toMatch(/Platform\.OS === 'web' \? '\/sign-up' : '\/sign-in'/);
  });

  it('does not keep public-event open to anonymous web visitors', () => {
    expect(authProvider).not.toMatch(/'public-event'/);
    expect(publicEvent).toMatch(/const requiresWebLogin = Platform\.OS === 'web' && !authLoading && !user/);
    expect(publicEvent).toMatch(/router\.replace\('\/sign-up'/);
  });

  it('keeps payment redirect routes public so checkout handoff screens can reconcile before auth redirects fire', () => {
    expect(authProvider).toMatch(/'payment-success'/);
    expect(authProvider).toMatch(/'payment-cancel'/);
    expect(authProvider).toMatch(/const isPaymentRedirectScreen =\s*firstSegment === 'payment-success' \|\| firstSegment === 'payment-cancel';/);
  });
});
