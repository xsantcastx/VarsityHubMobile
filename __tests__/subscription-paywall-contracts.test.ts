import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const paywall = readFileSync(join(ROOT, 'app/subscription-paywall.tsx'), 'utf8');

describe('subscription-paywall contracts', () => {
  it('derives initial access state from canonical auth user instead of refetching /me', () => {
    expect(paywall).toContain("const { user, checkAuth } = useAuth();");
    expect(paywall).toContain('const me: any = user;');
    expect(paywall).not.toContain('User.me()');
  });

  it('uses a shared checkAuth-based activation poll instead of User.refresh loops', () => {
    expect(paywall).toContain('const waitForPaidPlanActivation = useCallback(async () => {');
    expect(paywall).toContain("const fresh: any = await checkAuth().catch(() => null);");
    expect(paywall).not.toContain('User.refresh()');
  });
});
