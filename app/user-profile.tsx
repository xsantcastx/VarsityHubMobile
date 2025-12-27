import { User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/shared/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COVER_HEIGHT = Math.max(180, Math.min(220, Math.floor(Dimensions.get('window').height * 0.24)));
const AVATAR_SIZE = 100;

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
  const joinedDate =
    user?.preferences?.joined_date ||
    user?.created_at ||
    null;

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

  if (loading) {
    return (
      <SafeAreaView style={[S.container, { backgroundColor: theme.background }]}>
        <View style={S.center}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !user) {
    return (
      <SafeAreaView style={[S.container, { backgroundColor: theme.background }]}>
        <View style={S.center}>
          <Text style={[S.errorText, { color: theme.text }]}>{error || 'Not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const coverUrl = user?.preferences?.header_image_url;

  return (
    <SafeAreaView style={[S.container, { backgroundColor: theme.background }]} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView showsVerticalScrollIndicator={false} scrollEventThrottle={16}>
        {/* Cover Image */}
        <View style={S.coverSection}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={S.coverImage} contentFit="cover" />
          ) : (
            <LinearGradient colors={['#667eea', '#764ba2']} style={S.coverImage} />
          )}

          {/* Edit cover moved to Edit Profile; remove inline cover edit button */}

          <Pressable style={S.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
        </View>

        {/* Profile Identity */}
        <View style={[S.profileSection, { backgroundColor: theme.background }]}>
          <View style={S.avatarContainer}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={S.avatar} contentFit="cover" />
            ) : (
              <View style={[S.avatarPlaceholder, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Ionicons name="person" size={42} color={theme.mutedText} />
              </View>
            )}
          </View>

          <View style={S.nameContainer}>
            <View style={S.nameRow}>
              <Text style={[S.displayName, { color: theme.text }]} numberOfLines={1}>
                {user?.display_name || 'User'}
              </Text>
              {user?.verified && (
                <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />
              )}
            </View>
            <Text style={[S.username, { color: theme.mutedText }]} numberOfLines={1}>
              @{user?.username || user?.id}
            </Text>
            {roleBadge ? (
              <View style={[S.roleBadge, { backgroundColor: roleBadge.color }]}>
                <Text style={S.roleBadgeText}>{roleBadge.icon} {roleBadge.text}</Text>
              </View>
            ) : null}
            {user?.bio && (
              <Text style={[S.bio, { color: theme.text }]} numberOfLines={2}>
                {user.bio}
              </Text>
            )}
            {joinedDate && (
              <View style={S.joinedRow}>
                <Ionicons name="calendar-outline" size={16} color={theme.mutedText} />
                <Text style={[S.joinedText, { color: theme.mutedText }]}>
                  Joined{' '}
                  {new Date(joinedDate).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            )}
          </View>

          {!isOwnProfile && (
            <Pressable style={[S.followButton, user?.is_following && S.followingButton]} onPress={onFollow}>
              <Ionicons
                name={user?.is_following ? 'checkmark' : 'person-add'}
                size={18}
                color={user?.is_following ? theme.tint : '#fff'}
              />
              <Text style={[S.followButtonText, user?.is_following && S.followingButtonText]}>
                {user?.is_following ? 'Following' : 'Follow'}
              </Text>
            </Pressable>
          )}

          {isOwnProfile && (
            <Pressable
              style={[S.followButton, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}
              onPress={() => router.push('/edit-profile')}
            >
              <Ionicons name="pencil" size={18} color={theme.text} />
              <Text style={[S.followButtonText, { color: theme.text }]}>Edit profile</Text>
            </Pressable>
          )}
        </View>

        {/* Stats Row */}
        <View style={[S.statsRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={S.statCell}>
            <Text style={[S.statNumber, { color: theme.text }]}>{user?.posts_count ?? 0}</Text>
            <Text style={[S.statLabel, { color: theme.mutedText }]}>Posts</Text>
          </View>
          <View style={[S.statDivider, { backgroundColor: theme.border }]} />
          <View style={S.statCell}>
            <Text style={[S.statNumber, { color: theme.text }]}>{user?.followers_count ?? 0}</Text>
            <Text style={[S.statLabel, { color: theme.mutedText }]}>Followers</Text>
          </View>
          <View style={[S.statDivider, { backgroundColor: theme.border }]} />
          <View style={S.statCell}>
            <Text style={[S.statNumber, { color: theme.text }]}>{user?.following_count ?? 0}</Text>
            <Text style={[S.statLabel, { color: theme.mutedText }]}>Following</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={[S.tabsContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {['posts', 'replies', 'upvotes'].map((tab) => (
            <Pressable
              key={tab}
              style={[S.tab, activeTab === tab && S.activeTab, { borderBottomColor: activeTab === tab ? theme.tint : 'transparent' }]}
              onPress={() => setActiveTab(tab as any)}
            >
              <Text
                style={[
                  S.tabText,
                  activeTab === tab ? { color: theme.tint, fontWeight: '700' } : { color: theme.mutedText },
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Content */}
        <View style={S.contentSection}>
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, fontWeight: '500' },
  coverSection: { position: 'relative', height: COVER_HEIGHT, overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  backButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  editButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: AVATAR_SIZE * 0.2 + 8,
    paddingBottom: 8,
    marginTop: -(AVATAR_SIZE * 1.1),
    marginBottom: 12,
  },
  avatarContainer: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
    borderColor: '#fff',
    overflow: 'hidden',
    marginBottom: 8,
  },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  nameContainer: { alignItems: 'center', marginBottom: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  displayName: { fontSize: 22, fontWeight: '700' },
  username: { fontSize: 14, marginBottom: 8 },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  roleBadgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  bio: { fontSize: 14, lineHeight: 20, marginBottom: 8, textAlign: 'center', paddingHorizontal: 12 },
  joinedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  joinedText: { fontSize: 13 },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    minWidth: 120,
  },
  followingButton: { backgroundColor: '#f0f4f8' },
  followButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  followingButtonText: { color: '#3b82f6' },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statNumber: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  statLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1 },
  tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 12, borderBottomWidth: 2, alignItems: 'center' },
  activeTab: { borderBottomColor: 'currentColor' },
  tabText: { fontSize: 15, fontWeight: '500' },
  contentSection: { paddingHorizontal: 16, paddingBottom: 32 },
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
