import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const editUsernameScreen = read('app/settings/edit-username.tsx');
const resetPasswordScreen = read('app/settings/reset-password.tsx');

describe('account settings contracts', () => {
  it('edit username derives current account state from AuthProvider instead of useUser', () => {
    expect(editUsernameScreen).toContain(
      'const { user, loading: authLoading, checkAuth } = useAuth();'
    );
    expect(editUsernameScreen).not.toContain('useUser(');
    expect(editUsernameScreen).not.toContain('refreshUser()');
  });

  it('reset password derives provider state from AuthProvider instead of useUser', () => {
    expect(resetPasswordScreen).toContain('const { user, checkAuth } = useAuth();');
    expect(resetPasswordScreen).not.toContain('useUser(');
    expect(resetPasswordScreen).not.toContain('refreshUser()');
  });

  it('account mutations resync through checkAuth only', () => {
    expect(editUsernameScreen).toContain('await checkAuth().catch(');
    expect(editUsernameScreen).toContain("console.warn('[edit-username] Auth refresh failed:', e);");
    expect(resetPasswordScreen).toContain('await checkAuth().catch(');
    expect(resetPasswordScreen).toContain(
      "console.warn('[reset-password] Auth refresh failed:', e);"
    );
  });
});
