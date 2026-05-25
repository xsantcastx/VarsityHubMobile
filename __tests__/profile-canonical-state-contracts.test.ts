import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const legacyProfile = read('app/profile.tsx');
const navProfile = read('app/features/navigation/screens/ProfileScreen.tsx');

describe('profile canonical state contracts', () => {
  it('profile screens derive the current account from AuthProvider instead of useUser mirrors', () => {
    for (const screen of [legacyProfile, navProfile]) {
      expect(screen).toContain('const { user: userFromAuth, checkAuth } = useAuth();');
      expect(screen).not.toContain('useUser(false)');
      expect(screen).not.toContain('refreshUserFromHook');
    }
  });

  it('profile screens resolve current user through checkAuth instead of direct User.me', () => {
    for (const screen of [legacyProfile, navProfile]) {
      expect(screen).toContain(
        'const currentUser: any = ((await checkAuth().catch(() => null)) ?? userFromAuth) as any;'
      );
      expect(screen).not.toContain('const currentUser: any = await User.me();');
    }
  });
});
