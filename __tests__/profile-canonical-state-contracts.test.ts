import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const legacyProfile = read('app/profile.tsx');
const navProfile = read('app/features/navigation/screens/ProfileScreen.tsx');
const useUserHook = read('hooks/useUser.ts');

describe('profile canonical state contracts', () => {
  it('profile screens derive the current account from AuthProvider', () => {
    for (const screen of [legacyProfile, navProfile]) {
      expect(screen).toContain('const { user: userFromAuth, checkAuth } = useAuth();');
    }
    // ProfileScreen may still consume useUser, but the hook itself is now an
    // AuthProvider delegate (getAuthSnapshot) — not a parallel /me mirror.
    expect(useUserHook).toContain("import { getAuthSnapshot } from '@/utils/authState';");
    expect(useUserHook).not.toContain('User.me');
  });

  it('profile screens resolve current user through the shared auth snapshot', () => {
    expect(legacyProfile).toContain(
      'const currentUser: any = await getAuthSnapshot(checkAuth, userFromAuth);'
    );
    expect(navProfile).toContain(
      'const currentUser: any = await getAuthSnapshot(checkAuth, userFromAuth ?? userFromHook);'
    );
    for (const screen of [legacyProfile, navProfile]) {
      expect(screen).not.toContain('const currentUser: any = await User.me();');
    }
  });
});
