import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const screen = readFileSync(join(ROOT, 'app/settings/zip-code.tsx'), 'utf8');

describe('zip-code contracts', () => {
  it('prefills ZIP from the canonical auth user instead of a separate profile fetch', () => {
    expect(screen).toContain('const { user, checkAuth } = useAuth();');
    expect(screen).toContain(
      "const zipCode = String(user?.preferences?.zip_code || user?.zip_code || '').trim();"
    );
    expect(screen).not.toContain('useUserProfile(');
  });

  it('verifies the saved ZIP with checkAuth instead of User.refresh fallback logic', () => {
    expect(screen).toContain('const fresh = await checkAuth().catch(error => {');
    expect(screen).not.toContain('User.refresh()');
    expect(screen).not.toContain('refreshUserProfile');
  });
});
