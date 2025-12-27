import { Team as TeamApi } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COVER_HEIGHT = Math.max(180, Math.min(220, Math.floor(Dimensions.get('window').height * 0.24)));
const AVATAR_SIZE = 100;

export default function TeamProfileScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [team, setTeam] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'members' | 'games'>('posts');
  const [posts, setPosts] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!params.id) {
      setError('No team ID');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const t = await TeamApi.getPublic(String(params.id));
      setTeam(t);
      const postsPage = await TeamApi.posts(String(params.id), { limit: 20, sort: 'newest' });
      setPosts(postsPage?.items || []);
      const membersPage = await TeamApi.members(String(params.id));
      setMembers(membersPage?.items || []);
    } catch (e: any) {
      if (e?.status === 401) {
        setError('Sign in to view teams');
      } else {
        setError(e?.message || 'Failed to load team');
      }
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const isOwnTeam = !!(me?.id && team?.id && me.id === team.owner_id);

  const onFollow = async () => {
    if (!team?.id) return;
    const next = !team.is_following;
    setTeam((prev: any) => ({
      ...prev,
      is_following: next,
      followers_count: (prev.followers_count || 0) + (next ? 1 : -1),
    }));
    try {
      if (next) {
        await TeamApi.follow(String(team.id));
      } else {
        await TeamApi.unfollow(String(team.id));
      }
    } catch {
      setTeam((prev: any) => ({
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

  if (error || !team) {
    return (
      <SafeAreaView style={[S.container, { backgroundColor: theme.background }]}>
        <View style={S.center}>
          <Text style={[S.errorText, { color: theme.text }]}>{error || 'Not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const coverUrl = team?.preferences?.header_image_url;

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

          {/* Edit cover is handled in team edit; remove inline button */}

          <Pressable style={S.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
        </View>

        {/* Team Identity */}
        <View style={[S.profileSection, { backgroundColor: theme.background }]}>
          <View style={S.avatarContainer}>
            {team?.logo_url ? (
              <Image source={{ uri: team.logo_url }} style={S.avatar} contentFit="cover" />
            ) : (
              <View style={[S.avatar, { backgroundColor: theme.card }]}>
                <Ionicons name="people" size={50} color={theme.mutedText} />
              </View>
            )}
          </View>

          <View style={S.nameContainer}>
            <View style={S.nameRow}>
              <Text style={[S.displayName, { color: theme.text }]} numberOfLines={1}>
                {team?.name || 'Team'}
              </Text>
              {team?.verified && (
                <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />
              )}
            </View>
            {team?.sport && (
              <Text style={[S.username, { color: theme.mutedText }]} numberOfLines={1}>
                {team.sport.charAt(0).toUpperCase() + team.sport.slice(1)} • {team.location || 'Location TBA'}
              </Text>
            )}
            {team?.bio && (
              <Text style={[S.bio, { color: theme.text }]} numberOfLines={2}>
                {team.bio}
              </Text>
            )}
            {team?.founded_year && (
              <View style={S.joinedRow}>
                <Ionicons name="calendar-outline" size={16} color={theme.mutedText} />
                <Text style={[S.joinedText, { color: theme.mutedText }]}>
                  Founded {team.founded_year}
                </Text>
              </View>
            )}
          </View>

          {!isOwnTeam && (
            <Pressable style={[S.followButton, team?.is_following && S.followingButton]} onPress={onFollow}>
              <Ionicons
                name={team?.is_following ? 'checkmark' : 'person-add'}
                size={18}
                color={team?.is_following ? theme.tint : '#fff'}
              />
              <Text style={[S.followButtonText, team?.is_following && S.followingButtonText]}>
                {team?.is_following ? 'Following' : 'Follow'}
              </Text>
            </Pressable>
          )}

          {isOwnTeam && (
            <Pressable
              style={[S.followButton, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}
              onPress={() => router.push(`/team-edit?id=${team.id}`)}
            >
              <Ionicons name="pencil" size={18} color={theme.text} />
              <Text style={[S.followButtonText, { color: theme.text }]}>Edit team</Text>
            </Pressable>
          )}
        </View>

        {/* Stats Row */}
        <View style={[S.statsRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={S.statCell}>
            <Text style={[S.statNumber, { color: theme.text }]}>{team?.posts_count ?? 0}</Text>
            <Text style={[S.statLabel, { color: theme.mutedText }]}>Posts</Text>
          </View>
          <View style={[S.statDivider, { backgroundColor: theme.border }]} />
          <View style={S.statCell}>
            <Text style={[S.statNumber, { color: theme.text }]}>{members.length}</Text>
            <Text style={[S.statLabel, { color: theme.mutedText }]}>Members</Text>
          </View>
          <View style={[S.statDivider, { backgroundColor: theme.border }]} />
          <View style={S.statCell}>
            <Text style={[S.statNumber, { color: theme.text }]}>{team?.followers_count ?? 0}</Text>
            <Text style={[S.statLabel, { color: theme.mutedText }]}>Followers</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={[S.tabsContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {['posts', 'members', 'games'].map((tab) => (
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
          {activeTab === 'posts' && (
            <>
              {posts.length === 0 ? (
                <View style={S.emptyState}>
                  <Ionicons name="document-outline" size={48} color={theme.mutedText} />
                  <Text style={[S.emptyStateText, { color: theme.text }]}>No posts yet</Text>
                  <Text style={[S.emptyStateSubtext, { color: theme.mutedText }]}>
                    This team hasn't posted anything yet
                  </Text>
                </View>
              ) : (
                posts.map((post) => (
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
            </>
          )}

          {activeTab === 'members' && (
            <>
              {members.length === 0 ? (
                <View style={S.emptyState}>
                  <Ionicons name="people-outline" size={48} color={theme.mutedText} />
                  <Text style={[S.emptyStateText, { color: theme.text }]}>No members</Text>
                  <Text style={[S.emptyStateSubtext, { color: theme.mutedText }]}>
                    This team has no members yet
                  </Text>
                </View>
              ) : (
                members.map((member) => (
                  <Pressable
                    key={member.id}
                    style={[S.memberCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => member.user?.id && router.push(`/user-profile?id=${member.user.id}`)}
                  >
                    <View style={S.memberHeader}>
                      {member.user?.avatar_url && (
                        <Image source={{ uri: member.user.avatar_url }} style={S.memberAvatar} contentFit="cover" />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[S.memberName, { color: theme.text }]} numberOfLines={1}>
                          {member.user?.display_name || 'Unknown'}
                        </Text>
                        <Text style={[S.memberRole, { color: theme.mutedText }]} numberOfLines={1}>
                          {member.customPosition || member.role || 'Member'}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))
              )}
            </>
          )}

          {activeTab === 'games' && (
            <View style={S.emptyState}>
              <Ionicons name="football-outline" size={48} color={theme.mutedText} />
              <Text style={[S.emptyStateText, { color: theme.text }]}>No games scheduled</Text>
              <Text style={[S.emptyStateSubtext, { color: theme.mutedText }]}>
                Check back soon for upcoming games
              </Text>
            </View>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: { width: '100%', height: '100%' },
  nameContainer: { alignItems: 'center', marginBottom: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  displayName: { fontSize: 22, fontWeight: '700' },
  username: { fontSize: 14, marginBottom: 8 },
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
  memberCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12, overflow: 'hidden' },
  memberHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberAvatar: { width: 48, height: 48, borderRadius: 24 },
  memberName: { fontSize: 15, fontWeight: '600' },
  memberRole: { fontSize: 13, marginTop: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyStateText: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  emptyStateSubtext: { fontSize: 14, marginTop: 6 },
});
