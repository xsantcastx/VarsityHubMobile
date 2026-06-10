import fs from 'node:fs';
import path from 'node:path';

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), 'utf8');

describe('route wrapper integrity', () => {
  it('ships feed through the canonical feature screen', () => {
    const routeFile = read('app', 'feed.tsx');
    const featureFile = read('app', 'features', 'navigation', 'screens', 'FeedScreen.tsx');

    expect(routeFile.trim()).toBe(
      "export { default } from './features/navigation/screens/FeedScreen';"
    );
    expect(featureFile).toMatch(/<BannerAd[\s\S]*adId=\{adData\.id\}/);
    expect(featureFile).toContain("router.push('/verify')");
    expect(featureFile).not.toContain('const userPromise = User.me()');
  });

  it('keeps the dual profile implementations aligned (documented in CLAUDE.md)', () => {
    const routeFile = read('app', 'profile.tsx');
    const aliasFile = read('app', 'user-profile.tsx');
    const featureFile = read('app', 'features', 'navigation', 'screens', 'ProfileScreen.tsx');

    // app/profile.tsx is a full implementation (not a thin wrapper) and
    // ProfileScreen.tsx is its feature-screen sibling. CLAUDE.md's
    // post-mapper rule requires the two to stay in sync — pin the shared
    // mapper so a one-sided removal fails loudly.
    expect(routeFile).toContain('toFeedPost');
    expect(featureFile).toContain('toFeedPost');
    expect(aliasFile.trim()).toBe("export { default } from './profile';");
    expect(featureFile).toContain('goBackToTrackedRoute');
    expect(featureFile).toContain('handleAvatarPress');
    expect(featureFile).not.toContain('const currentUser: any = await User.me()');
  });
});
