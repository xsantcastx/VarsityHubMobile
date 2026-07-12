import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const adminAdsScreen = read('app/admin-ads.tsx');
const adminMessagesScreen = read('app/admin-messages.tsx');
const organizationJoinRequestsScreen = read('app/organization-join-requests.tsx');
const paymentSuccessScreen = read('app/payment-success.tsx');
const createPostScreen = read('app/(tabs)/create-post.tsx');
const discoverScreen = read('app/(tabs)/discover/mobile-community.tsx');
const editProfileScreen = read('app/(tabs)/edit-profile.tsx');

describe('remaining auth canonical state contracts', () => {
  it('admin screens do not refetch /me before loading admin data', () => {
    expect(adminAdsScreen).not.toContain('await User.me()');
    expect(adminMessagesScreen).not.toContain('await User.me()');
  });

  it('organization join requests gates owner access through the shared auth snapshot helper', () => {
    expect(organizationJoinRequestsScreen).toContain(
      "import { useAuth } from '@/context/AuthProvider';"
    );
    expect(organizationJoinRequestsScreen).toContain(
      "import { getAuthSnapshot } from '@/utils/authState';"
    );
    expect(organizationJoinRequestsScreen).toContain('const { user, checkAuth } = useAuth();');
    expect(organizationJoinRequestsScreen).toContain(
      'getAuthSnapshot(checkAuth, user).catch(() => null)'
    );
    expect(organizationJoinRequestsScreen).not.toContain('User.me().catch(() => null)');
  });

  it('payment success, create post, discover, and edit profile resolve current user from canonical auth state', () => {
    expect(paymentSuccessScreen).toContain("import { getAuthSnapshot } from '@/utils/authState';");
    expect(paymentSuccessScreen).toContain('const { user, checkAuth } = useAuth();');
    expect(paymentSuccessScreen).toContain('const me = await getAuthSnapshot(checkAuth, user);');
    expect(paymentSuccessScreen).not.toContain('User.me({ force: true })');

    expect(createPostScreen).toContain("import { getAuthSnapshot } from '@/utils/authState';");
    expect(createPostScreen).toContain(
      'const { user, checkAuth, loading: authLoading } = useAuth();'
    );
    expect(createPostScreen).toContain(
      'const me = await getAuthSnapshot(checkAuth, user).catch(() => null);'
    );
    expect(createPostScreen).not.toContain('const me = await User.me().catch(() => null);');

    expect(discoverScreen).toContain(
      "import { getAuthSnapshot, getCanonicalOrganizationId } from '@/utils/authState';"
    );
    expect(discoverScreen).toContain('const { user, checkAuth } = useAuth();');
    expect(discoverScreen).toContain('await getAuthSnapshot(checkAuth, user)');
    expect(discoverScreen).not.toContain('user = await User.me();');

    // edit-profile is the one allowlisted force-refresh screen (see
    // auth-screen-snapshot-contract): editing requires a guaranteed-fresh
    // server copy, not a cached snapshot.
    expect(editProfileScreen).toContain('const me: any = await User.me({ force: true });');
  });
});
