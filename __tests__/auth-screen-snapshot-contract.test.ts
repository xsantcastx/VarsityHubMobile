import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), 'utf8');

describe('auth screen snapshot contract', () => {
  it('keeps inbox and thread screens on the AuthProvider snapshot path', () => {
    const messages = read('app', 'messages.tsx');
    const messageThread = read('app', 'message-thread.tsx');

    expect(messages).toContain("import { useAuth } from '@/context/AuthProvider';");
    expect(messages).toContain("import { getAuthSnapshot } from '@/utils/authState';");
    expect(messages).not.toContain('await User.me()');

    expect(messageThread).toContain("import { useAuth } from '@/context/AuthProvider';");
    expect(messageThread).toContain("import { getAuthSnapshot } from '@/utils/authState';");
    expect(messageThread).not.toContain('await User.me()');
  });

  it('keeps post detail and game vertical feed on the shared auth snapshot path', () => {
    const postDetail = read('app', 'post-detail.tsx');
    const gameVertical = read('app', 'game-details', 'GameVerticalFeedScreen.tsx');

    expect(postDetail).toContain("import { useAuth } from '@/context/AuthProvider';");
    expect(postDetail).toContain("import { getAuthSnapshot } from '@/utils/authState';");
    expect(postDetail).not.toContain('await User.me()');

    expect(gameVertical).toContain("import { useAuth } from '@/context/AuthProvider';");
    expect(gameVertical).toContain("import { getAuthSnapshot } from '@/utils/authState';");
    expect(gameVertical).not.toContain('await User.me()');
  });

  it('keeps event, team-create, and game-detail auth reads on shared snapshots', () => {
    const eventDetail = read('app', '(tabs)', 'event-detail.tsx');
    const createTeam = read('app', '(tabs)', 'create-team.tsx');
    const gameDetails = read('app', 'game-details', 'GameDetailsScreen.tsx');

    expect(eventDetail).toContain("import { getAuthSnapshot } from '@/utils/authState';");
    expect(eventDetail).not.toContain('User.me()');

    expect(createTeam).toContain("import { useAuth } from '@/context/AuthProvider';");
    expect(createTeam).toMatch(/get(Fresh)?AuthSnapshot/);
    expect(createTeam).not.toContain('User.me()');

    expect(gameDetails).not.toContain('User.me()');
    expect(gameDetails).toContain('currentUserId={authUser?.id ?? null}');
  });

  it('keeps secondary user-facing screens on AuthProvider-backed snapshots', () => {
    const joinRequests = read('app', 'organization-join-requests.tsx');
    const createFanEvent = read('app', 'create-fan-event.tsx');
    const highlights = read('app', 'highlights.tsx');
    const create = read('app', 'create.tsx');
    const favorites = read('app', 'favorites.tsx');
    const reportAbuse = read('app', 'report-abuse.tsx');
    const dmRestrictions = read('app', 'dm-restrictions.tsx');
    const createPost = read('app', '(tabs)', 'create-post.tsx');
    const myAds = read('app', 'my-ads.tsx');
    const feedback = read('app', 'settings', 'feedback.tsx');
    const adminAds = read('app', 'admin-ads.tsx');
    const adminMessages = read('app', 'admin-messages.tsx');

    expect(joinRequests).toMatch(/getAuthSnapshot\(checkAuth, user\)/);
    expect(joinRequests).not.toContain('User.me()');

    expect(createFanEvent).toMatch(/getAuthSnapshot\(checkAuth, user\)/);
    expect(createFanEvent).not.toContain('User.me()');

    expect(highlights).toContain("import { getAuthSnapshot } from '@/utils/authState';");
    expect(highlights).not.toContain('User.me()');

    // create.tsx is now a thin hub driven by useCreateTeamAccess — no direct
    // user fetching at all.
    expect(create).not.toContain('User.me()');

    expect(favorites).toContain("import { getAuthSnapshot } from '@/utils/authState';");
    expect(favorites).not.toContain('User.me()');

    expect(reportAbuse).toContain("import { getAuthSnapshot } from '@/utils/authState';");
    expect(reportAbuse).not.toContain('User.me()');

    expect(dmRestrictions).toMatch(/getAuthSnapshot\(checkAuth, user\)/);
    expect(dmRestrictions).not.toContain('await User.me()');

    expect(createPost).toContain("import { getAuthSnapshot } from '@/utils/authState';");
    expect(createPost).not.toContain('await User.me()');

    expect(myAds).toContain("import { getAuthSnapshot } from '@/utils/authState';");
    expect(myAds).not.toContain('await User.me()');

    expect(feedback).not.toContain('User.me()');
    expect(adminAds).not.toContain('User.me()');
    expect(adminMessages).not.toContain('User.me()');
  });

  it('keeps theme bootstrap on the auth context instead of opening a parallel /me lane', () => {
    const themeHook = read('hooks', 'useCustomColorScheme.tsx');
    const rootLayout = read('app', '_layout.tsx');

    expect(themeHook).toContain("import { useAuth } from '@/context/AuthProvider';");
    expect(themeHook).not.toContain('User.me()');
    expect(rootLayout).toContain('<MemoizedAuthProvider navReady={navReady}>');
    expect(rootLayout).toContain('<AppShell />');
    expect(rootLayout).toContain('<ThemeProvider>');
  });

  it('limits direct User.me calls in app/hooks/context to the explicit force-refresh allowlist', () => {
    const output = execSync("rg -l 'User\\.me\\(' app hooks context -g '*.{ts,tsx}'", {
      cwd: process.cwd(),
      encoding: 'utf8',
    }).trim();

    const matches = output ? output.split('\n').sort() : [];

    expect(matches).toEqual(['app/(tabs)/edit-profile.tsx', 'context/AuthProvider.tsx']);
  });
});
