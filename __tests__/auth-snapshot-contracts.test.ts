import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const verifyIdentityScreen = read('app/verify-identity.tsx');
const dmRestrictionsScreen = read('app/dm-restrictions.tsx');
const messageThreadScreen = read('app/message-thread.tsx');

describe('auth snapshot contracts', () => {
  it('verify-identity routes from checkAuth/auth state instead of refetching /me', () => {
    expect(verifyIdentityScreen).toContain('const { user, checkAuth } = useAuth();');
    expect(verifyIdentityScreen).toContain('const freshUser = (await checkAuth().catch(() => null)) as any;');
    expect(verifyIdentityScreen).toContain("const userInfo = ((await checkAuth().catch(() => null)) ?? user) as any;");
    expect(verifyIdentityScreen).not.toContain('const userInfo = await User.me();');
  });

  it('dm-restrictions seeds from auth state and only falls back to checkAuth', () => {
    expect(dmRestrictionsScreen).toContain('const { user, checkAuth } = useAuth();');
    expect(dmRestrictionsScreen).toContain("const authPolicy = (user?.preferences as any)?.dm_policy;");
    expect(dmRestrictionsScreen).toContain('const me = (await checkAuth().catch(() => null)) as any;');
    expect(dmRestrictionsScreen).not.toContain('const me = await User.me();');
  });

  it('message-thread derives the current user from AuthProvider instead of refetching /me', () => {
    expect(messageThreadScreen).toContain('const { user, checkAuth } = useAuth();');
    expect(messageThreadScreen).toContain(
      'const currentUser = ((await checkAuth().catch(() => null)) ?? user) as any;'
    );
    expect(messageThreadScreen).not.toContain('const user = await User.me();');
  });
});
