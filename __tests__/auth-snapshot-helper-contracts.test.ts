import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const authState = read('utils/authState.ts');
const messagesScreen = read('app/messages.tsx');
const favoritesScreen = read('app/favorites.tsx');
const myAdsScreen = read('app/my-ads.tsx');
const highlightsScreen = read('app/highlights.tsx');

describe('auth snapshot helper contracts', () => {
  it('centralizes current-user resolution in utils/authState', () => {
    expect(authState).toContain('export async function getAuthSnapshot<T>(');
    // Reuse local snapshot first; only hit checkAuth when absent.
    expect(authState).toContain('if (currentUser != null) {');
    expect(authState).toContain('return (await checkAuth()) ?? null;');
  });

  it('messages/favorites/my-ads/highlights use the shared auth snapshot helper instead of User.me', () => {
    for (const screen of [messagesScreen, favoritesScreen, myAdsScreen, highlightsScreen]) {
      expect(screen).toContain("import { getAuthSnapshot } from '@/utils/authState';");
      // Binding name varies by screen (user vs authUser); the helper call is
      // what the contract pins.
      expect(screen).toMatch(/await getAuthSnapshot\(checkAuth, (user|authUser)\)/);
      expect(screen).not.toContain('await User.me()');
    }
  });
});
