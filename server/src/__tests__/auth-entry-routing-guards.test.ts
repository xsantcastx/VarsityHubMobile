import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const authProviderSource = readFileSync(
  join(process.cwd(), '..', 'context', 'AuthProvider.tsx'),
  'utf8'
);

describe('auth entry routing guards', () => {
  it('redirects authenticated app-home users away from sign-in/sign-up screens', () => {
    // The old broad public_route_authenticated redirect was replaced by a
    // narrower auth-entry-only bounce: authenticated users may browse public
    // routes, but auth entry screens (sign-in/sign-up/etc.) redirect to the
    // canonical landing route. verify-email is intentionally NOT an auth
    // entry segment, so pending-verification users are never bounced.
    const authEntryBlock =
      authProviderSource.match(
        /if \(\s*isAuthEntryRouteSegment\(firstSegment\)[\s\S]*?redirectWithTelemetry\(landingRoute, 'auth_entry_authenticated'\);[\s\S]*?return;[\s\S]*?\}/
      )?.[0] || '';

    expect(authEntryBlock).toContain("postAuthDecision.kind === 'app_home'");
    expect(authEntryBlock).toContain('!isPaymentRedirectScreen');
  });
});
