import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

// app/features/navigation/screens/ProfileScreen.tsx was deleted (orphaned dead
// code). app/profile.tsx is the single live profile screen now.
const legacyProfile = read('app/profile.tsx');
const useUserHook = read('hooks/useUser.ts');

describe('profile canonical state contracts', () => {
  it('profile screen derives the current account from AuthProvider', () => {
    expect(legacyProfile).toContain('const { user: userFromAuth, checkAuth } = useAuth();');
    // useUser is now an AuthProvider delegate (getAuthSnapshot), not a parallel
    // /me mirror.
    expect(useUserHook).toContain("import { getAuthSnapshot } from '@/utils/authState';");
    expect(useUserHook).not.toContain('User.me');
  });

  it('profile screen resolves current user through the shared auth snapshot', () => {
    expect(legacyProfile).toContain(
      'const currentUser: any = await getAuthSnapshot(checkAuth, userFromAuth);'
    );
    expect(legacyProfile).not.toContain('const currentUser: any = await User.me();');
  });
});
