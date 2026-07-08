import fs from 'node:fs';
import path from 'node:path';

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), 'utf8');

describe('route wrapper integrity', () => {
  it('ships feed through the canonical implementation at app/feed.tsx', () => {
    const routeFile = read('app', 'feed.tsx');
    const tabsBridge = read('app', '(tabs)', 'feed', 'index.tsx');

    expect(tabsBridge.trim()).toBe("export { default } from '../../feed';");
    expect(routeFile).toMatch(/<BannerAd[\s\S]*adId=\{adData\.id\}/);
    expect(routeFile).toContain("router.push('/verify')");
    expect(routeFile).not.toContain('const userPromise = User.me()');
  });

  it('keeps profile on the canonical implementation with its live post mapper', () => {
    const routeFile = read('app', 'profile.tsx');
    const aliasFile = read('app', 'user-profile.tsx');

    // app/profile.tsx is the single full implementation; the orphaned
    // app/features/navigation/screens/ProfileScreen.tsx copy was deleted
    // (documented in CLAUDE.md). toFeedPost must stay here — its parity with
    // mapHighlightToFeedPost is enforced by post-mapper-consistency.test.ts.
    expect(routeFile).toContain('toFeedPost');
    expect(aliasFile.trim()).toBe("export { default } from './profile';");
    expect(routeFile).not.toContain('const currentUser: any = await User.me()');
  });
});
