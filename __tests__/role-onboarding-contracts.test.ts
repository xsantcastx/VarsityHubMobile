import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const roleOnboarding = readFileSync(join(ROOT, 'app/role-onboarding.tsx'), 'utf8');

describe('role-onboarding contracts', () => {
  it('prefills account type from canonical auth state instead of refetching /me', () => {
    expect(roleOnboarding).toContain('const { user, checkAuth } = useAuth();');
    expect(roleOnboarding).toContain(
      'const me: any = await getFreshAuthSnapshot(checkAuth, user);'
    );
    expect(roleOnboarding).not.toContain('User.me()');
  });

  it('uses checkAuth for zip-code round-trip and coach-upgrade routing', () => {
    expect(roleOnboarding).toContain('const fresh = await checkAuth().catch(() => null);');
    expect(roleOnboarding).toContain('const decision = getPostAuthRouteDecision(fresh ?? null);');
    expect(roleOnboarding).not.toContain('User.refresh()');
  });
});
