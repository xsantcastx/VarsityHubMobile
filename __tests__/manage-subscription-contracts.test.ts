import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const screen = readFileSync(join(ROOT, 'app/settings/manage-subscription.tsx'), 'utf8');

describe('manage-subscription contracts', () => {
  it('derives billing state from the canonical auth snapshot instead of refetching /me', () => {
    expect(screen).toContain('const { user, checkAuth } = useAuth();');
    expect(screen).toContain('const me: any = user;');
    expect(screen).toContain('const billing = getCanonicalBillingState(me);');
    expect(screen).not.toContain('User.me()');
  });

  it('resyncs billing through checkAuth after lifecycle and payment transitions', () => {
    expect(screen).toContain('const syncBillingState = useCallback(');
    expect(screen).toContain('async (options?: { forceRefresh?: boolean }) => {');
    expect(screen).toContain(
      'return (await checkAuth({ forceRefresh: options?.forceRefresh === true }).catch('
    );
    expect(screen).toContain('const waitForPaidPlanActivation = useCallback(async () => {');
    expect(screen).toContain('void syncBillingState({ forceRefresh: true })');
  });
});
