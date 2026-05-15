import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const authProviderSource = readFileSync(
  join(process.cwd(), '..', 'context', 'AuthProvider.tsx'),
  'utf8'
);

describe('auth entry routing guards', () => {
  it('redirects authenticated app-home users away from sign-in/sign-up screens', () => {
    const publicRouteAuthenticatedBlock =
      authProviderSource.match(
        /if \(\s*isPublic[\s\S]*?postAuthDecision\.kind === 'app_home'[\s\S]*?redirectWithTelemetry\(landingRoute, 'public_route_authenticated'\);[\s\S]*?return;[\s\S]*?\}/
      )?.[0] || '';

    expect(publicRouteAuthenticatedBlock).toContain("firstSegment !== 'verify-email'");
    expect(publicRouteAuthenticatedBlock).toContain('!isPaymentRedirectScreen');
    expect(publicRouteAuthenticatedBlock).not.toContain('!isAuthEntryScreen');
  });
});
