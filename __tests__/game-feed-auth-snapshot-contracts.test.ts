import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const feedScreen = read('app/feed.tsx');
const gameDetailsScreen = read('app/game-details/GameDetailsScreen.tsx');
const gameVerticalFeedScreen = read('app/game-details/GameVerticalFeedScreen.tsx');

describe('game/feed auth snapshot contracts', () => {
  it('feed screen resolves current user through the shared auth snapshot helper', () => {
    expect(feedScreen).toContain("import { useAuth } from '@/context/AuthProvider';");
    expect(feedScreen).toContain("import { getAuthSnapshot } from '@/utils/authState';");
    expect(feedScreen).toContain('const { user, checkAuth, isAdmin } = useAuth();');
    expect(feedScreen).toContain('const userPromise = getAuthSnapshot(checkAuth, user)');
    expect(feedScreen).not.toContain('const userPromise = User.me()');
  });

  it('game details and game vertical feed no longer refetch /me directly for current-user identity', () => {
    // GameDetailsScreen resolves identity from the AuthProvider user and passes
    // it down as a prop (currentUserId={authUser?.id ?? null}) — no /me refetch.
    expect(gameDetailsScreen).toContain("import { useAuth } from '@/context/AuthProvider';");
    expect(gameDetailsScreen).toContain('currentUserId={authUser?.id ?? null}');
    expect(gameDetailsScreen).not.toContain('User.me()');
    // GameVerticalFeedScreen resolves the viewer through the shared snapshot.
    expect(gameVerticalFeedScreen).toContain(
      "import { getAuthSnapshot } from '@/utils/authState';"
    );
    expect(gameVerticalFeedScreen).toContain('const { user, checkAuth } = useAuth();');
    expect(gameVerticalFeedScreen).toContain('const resolveMeInfo = useCallback(async () => {');
    expect(gameVerticalFeedScreen).toContain(
      'const me: any = await getAuthSnapshot(checkAuth, user)'
    );
    expect(gameVerticalFeedScreen).not.toContain('const user = await User.me();');
    expect(gameVerticalFeedScreen).not.toContain('const me: any = await User.me();');
  });
});
