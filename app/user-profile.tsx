import { User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { ProfileLayout } from '@/features/profile/components/ProfileLayout';
import { useCustomColorScheme } from '@/shared/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function UserProfileScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'upvotes'>('posts');
  const [items, setItems] = useState<any[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState<string | null>(null);

  const loadTabData = useCallback(
    async (tab: 'posts' | 'replies' | 'upvotes', targetId: string) => {
      setTabLoading(true);
      setTabError(null);
      try {
        if (tab === 'posts') {
          const page = await User.postsForProfile(String(targetId), { limit: 20, sort: 'newest' });
          setItems(page?.items || page || []);
        } else {
          const type = tab === 'replies' ? 'comment' : 'like';
          const res = await User.interactionsForProfile(String(targetId), { limit: 20, sort: 'newest', type });
          const list = (res?.items || res || []).map((it: any) => {
            const post = it?.post || it?.target?.post || it?.target || it;
            return { ...post, __interaction: it };
          });
          setItems(list);
        }
      } catch (e: any) {
        setItems([]);
        setTabError(e?.message || 'Failed to load activity');
      } finally {
        setTabLoading(false);
      }
    },
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const current = await User.me().catch(() => null);
      setMe(current);
      const targetId = params.id || current?.id;
      if (!targetId) {
        setError('Sign in to view profiles');
        return;
      }

      let targetUser = null;
      try {
        targetUser = await User.getPublic(String(targetId));
      } catch (err) {
        if (current && String(current.id) === String(targetId)) {
          targetUser = current;
        } else {
          throw err;
        }
      }

      setTabError(null);
      setTabLoading(true);
      setItems([]);
      setUser(targetUser);
      setActiveTab('posts');
    } catch (e: any) {
      if (e?.status === 401) {
        setError('Sign in to view profiles');
      } else {
        setError(e?.message || 'Failed to load user');
      }
      setTabLoading(false);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const isOwnProfile = !!(me?.id && user?.id && me.id === user.id);
  const role = user?.preferences?.role || user?.role;
  const joinedText = (() => {
    const raw =
      user?.preferences?.joined_date ||
      user?.created_at ||
      null;
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return `Joined ${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
  })();

  const roleBadge = (() => {
    const normalized = String(role || '').toLowerCase();
    if (normalized === 'coach') return { icon: '🏆', text: 'Coach', color: '#1d4ed8' };
    if (normalized === 'athlete' || normalized === 'player') return { icon: '⚡', text: 'Athlete', color: '#059669' };
    if (normalized === 'staff') return { icon: '👔', text: 'Staff', color: '#7c3aed' };
    return null;
  })();

  useEffect(() => {
    if (user?.id) {
      void loadTabData(activeTab, String(user.id));
    }
  }, [activeTab, user?.id, loadTabData]);

  const onFollow = async () => {
    if (!user?.id) return;
    const next = !user.is_following;
    setUser((prev: any) => ({
      ...prev,
      is_following: next,
      followers_count: (prev.followers_count || 0) + (next ? 1 : -1),
    }));
    try {
      if (next) {
        await User.follow(String(user.id));
      } else {
        await User.unfollow(String(user.id));
      }
    } catch {
      setUser((prev: any) => ({
        ...prev,
        is_following: !next,
        followers_count: (prev.followers_count || 0) + (!next ? 1 : -1),
      }));
    }
  };

  return (
    <SafeAreaView style={[S.container, { backgroundColor: theme.background }]} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ProfileLayout
        loading={loading}
        error={error}
        coverUri={user?.preferences?.header_image_url || null}
        avatarUri={user?.avatar_url || null}
        name={user?.display_name || 'User'}
        handle={user?.username || user?.id || null}
        subtitle={user?.bio || null}
        joinedText={joinedText}
        stats={[
          { label: 'Following', value: user?.following_count ?? 0 },
          { label: 'Followers', value: user?.followers_count ?? 0 },
        ]}
        tabs={[
          { key: 'posts', label: 'Posts' },
          { key: 'replies', label: 'Replies' },
          { key: 'upvotes', label: 'Upvotes' },
        ]}
        activeTab={activeTab}
        onChangeTab={(key) => {
          const tabKey = key as 'posts' | 'replies' | 'upvotes';
          setActiveTab(tabKey);
        }}
        primaryAction={
          isOwnProfile
            ? {
                label: 'Edit profile',
                onPress: () => router.push('/edit-profile'),
                icon: 'pencil',
                variant: 'outline',
              }
            : {
                label: user?.is_following ? 'Following' : 'Follow',
                onPress: onFollow,
                icon: user?.is_following ? 'checkmark' : 'person-add',
              }
        }
        secondaryAction={
          isOwnProfile
            ? { icon: 'settings-outline', onPress: () => router.push('/settings') }
            : undefined
        }
      >
        {tabLoading ? (
          <View style={S.emptyState}>
            <ActivityIndicator color={theme.tint} />
            <Text style={[S.emptyStateText, { color: theme.text }]}>Loading {activeTab}…</Text>
          </View>
        ) : tabError ? (
          <View style={S.emptyState}>
            <Ionicons name="alert-circle-outline" size={28} color="#ef4444" />
            <Text style={[S.emptyStateText, { color: theme.text }]}>{tabError}</Text>
            <Pressable
              style={[S.retryButton, { backgroundColor: theme.tint }]}
              onPress={() => user?.id && loadTabData(activeTab, String(user.id))}
            >
              <Text style={S.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={S.emptyState}>
            <Ionicons name="document-outline" size={48} color={theme.mutedText} />
            <Text style={[S.emptyStateText, { color: theme.text }]}>No posts yet</Text>
            <Text style={[S.emptyStateSubtext, { color: theme.mutedText }]}>
              This user hasn't posted anything yet
            </Text>
          </View>
        ) : (
          items.map((post) => (
            <Pressable
              key={post.id}
              style={[S.postCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push(`/post-detail?id=${post.id}`)}
            >
              <View style={S.postHeader}>
                <Text style={[S.postTitle, { color: theme.text }]} numberOfLines={2}>
                  {post.title || post.caption || post.content || 'Untitled'}
                </Text>
              </View>
              {post.media_url && (
                <Image source={{ uri: post.media_url }} style={S.postMedia} contentFit="cover" />
              )}
              <View style={S.postStats}>
                <View style={S.statItem}>
                  <Ionicons name="arrow-up" size={16} color={theme.mutedText} />
                  <Text style={[S.statItemText, { color: theme.mutedText }]}>{post.upvotes_count ?? 0}</Text>
                </View>
                <View style={S.statItem}>
                  <Ionicons name="chatbubble-outline" size={16} color={theme.mutedText} />
                  <Text style={[S.statItemText, { color: theme.mutedText }]}>{post.comments_count ?? 0}</Text>
                </View>
                <View style={S.statItem}>
                  <Ionicons name="eye-outline" size={16} color={theme.mutedText} />
                  <Text style={[S.statItemText, { color: theme.mutedText }]}>
                    {(post.upvotes_count ?? 0) * 12}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </ProfileLayout>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  contentSection: { paddingBottom: 32 },
  postCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12, overflow: 'hidden' },
  postHeader: { marginBottom: 8 },
  postTitle: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  postMedia: { width: '100%', height: 180, borderRadius: 8, marginBottom: 12 },
  postStats: { flexDirection: 'row', gap: 16 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statItemText: { fontSize: 13, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyStateText: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  emptyStateSubtext: { fontSize: 14, marginTop: 6 },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
