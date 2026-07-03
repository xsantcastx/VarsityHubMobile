import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const centerTab = read('components/ui/CenterTabButton.tsx');
const createPost = read('app/(tabs)/create-post.tsx');
const profile = read('app/profile.tsx');
const navProfile = read('app/features/navigation/screens/ProfileScreen.tsx');
const discover = read('app/(tabs)/discover/mobile-community.tsx');
const publicEvent = read('app/public-event.tsx');
const gameDetails = read('app/game-details/GameDetailsScreen.tsx');
const signIn = read('app/sign-in.tsx');
const create = read('app/create.tsx');
const feedScreen = read('app/feed.tsx');
const submitAd = read('components/SubmitAdScreenBase.tsx');

describe('guest create-entry contracts', () => {
  it('routes generic create entry points through /create instead of the raw composer', () => {
    expect(centerTab).toContain("void router.push('/create');");
    expect(profile).toContain("onPress={() => void router.push('/create')}");
    expect(navProfile).toContain("onPress={() => void router.push('/create')}");
    expect(discover).toContain("onPress={() => void router.push('/create')}");
  });

  it('keeps the composer self-guarded so direct navigation cannot bypass auth', () => {
    expect(createPost).toContain('const { user, checkAuth, loading: authLoading } = useAuth();');
    expect(createPost).toContain("router.replace('/create');");
  });

  it('keeps event-scoped create paths on /create-post with sign-in prompts and game context', () => {
    expect(publicEvent).toContain("pathname: '/create-post'");
    expect(publicEvent).toContain("message: 'Sign in to post to this event.'");
    expect(gameDetails).toContain("pathname: '/create-post'");
    expect(gameDetails).toContain("message: 'Sign in to post to this event.'");
  });

  it('keeps sign-in limited to auth actions instead of adding an extra guest CTA', () => {
    expect(signIn).not.toContain('Continue as guest');
    expect(signIn).toContain("onPress={() => void router.replace('/sign-up')}");
  });

  it('keeps ad reservation reachable for guests and prompts sign-in only when submission needs auth', () => {
    // Ad reservation entry moved from the create hub to the guest-visible
    // feed promo card.
    expect(feedScreen).toContain("router.push('/submit-ad')");
    expect(feedScreen).toContain('Reserve Your Ad Space Now');
    expect(submitAd).toContain("promptForSignIn(() => router.push('/sign-in'), {");
    expect(submitAd).toContain("message: 'Sign in to reserve ad space.'");
  });
});
