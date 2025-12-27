import { Organization } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/shared/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COVER_HEIGHT = 240;
const AVATAR_SIZE = 100;

export default function OrganizationScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [org, setOrg] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'teams' | 'posts' | 'games'>('teams');
  const [teams, setTeams] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!params.id) {
      setError('No organization ID');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const o = await Organization.getPublic(String(params.id));
      setOrg(o);
      const teamsPage = await Organization.teams(String(params.id), { limit: 50 });
      setTeams(teamsPage?.items || []);
      const postsPage = await Organization.posts(String(params.id), { limit: 20, sort: 'newest' });
      setPosts(postsPage?.items || []);
    } catch (e: any) {
      if (e?.status === 401) {
        setError('Sign in to view organizations');
      } else {
        setError(e?.message || 'Failed to load organization');
      }
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const isOwnOrg = !!(me?.id && org?.id && me.id === org.owner_id);

  const onFollow = async () => {
    if (!org?.id) return;
    const next = !org.is_following;
    setOrg((prev: any) => ({
      ...prev,
      is_following: next,
      followers_count: (prev.followers_count || 0) + (next ? 1 : -1),
    }));
    try {
      if (next) {
        await Organization.follow(String(org.id));
      } else {
        await Organization.unfollow(String(org.id));
      }
    } catch {
      setOrg((prev: any) => ({
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

  if (error || !org) {
    return (
      <SafeAreaView style={[S.container, { backgroundColor: theme.background }]}>
        <View style={S.center}>
          <Text style={[S.errorText, { color: theme.text }]}>{error || 'Not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const coverUrl = org?.preferences?.header_image_url;

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

          {isOwnOrg && (
            <Pressable style={S.editButton} onPress={() => router.push(`/org-edit?id=${org.id}`)}>
              <Ionicons name="image-outline" size={20} color="#fff" />
              <Text style={S.editButtonText}>Edit cover</Text>
            </Pressable>
          )}

          <Pressable style={S.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
        </View>

        {/* Organization Identity */}
        <View style={[S.profileSection, { backgroundColor: theme.background }]}>
          <View style={S.avatarContainer}>
            {org?.logo_url ? (
              <Image source={{ uri: org.logo_url }} style={S.avatar} contentFit="cover" />
            ) : (
              <View style={[S.avatar, { backgroundColor: theme.card }]}>
                <Ionicons name="business" size={50} color={theme.mutedText} />
              </View>
            )}
          </View>

          <View style={S.nameContainer}>
            <View style={S.nameRow}>
              <Text style={[S.displayName, { color: theme.text }]} numberOfLines={1}>
                {org?.name || 'Organization'}
              </Text>
              {org?.verified && (
                <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />
              )}
            </View>
            {org?.sport && (
              <Text style={[S.username, { color: theme.mutedText }]} numberOfLines={1}>
                {org.sport.charAt(0).toUpperCase() + org.sport.slice(1)} • {org.location || 'Location TBA'}
              </Text>
            )}
            {org?.bio && (
              <Text style={[S.bio, { color: theme.text }]} numberOfLines={2}>
                {org.bio}
              </Text>
            )}
            {org?.founded_year && (
              <View style={S.joinedRow}>
                <Ionicons name="calendar-outline" size={16} color={theme.mutedText} />
                <Text style={[S.joinedText, { color: theme.mutedText }]}>
                  Founded {org.founded_year}
                </Text>
              </View>
            )}
          </View>

          {!isOwnOrg && (
            <Pressable style={[S.followButton, org?.is_following && S.followingButton]} onPress={onFollow}>
              <Ionicons
                name={org?.is_following ? 'checkmark' : 'person-add'}
                size={18}
                color={org?.is_following ? theme.tint : '#fff'}
              />
              <Text style={[S.followButtonText, org?.is_following && S.followingButtonText]}>
                {org?.is_following ? 'Following' : 'Follow'}
              </Text>
            </Pressable>
          )}

          {isOwnOrg && (
            <Pressable
              style={[S.followButton, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}
              onPress={() => router.push(`/org-edit?id=${org.id}`)}
            >
              <Ionicons name="pencil" size={18} color={theme.text} />
              <Text style={[S.followButtonText, { color: theme.text }]}>Edit org</Text>
            </Pressable>
          )}
        </View>

        {/* Stats Row */}
        <View style={[S.statsRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={S.statCell}>
            <Text style={[S.statNumber, { color: theme.text }]}>{teams.length}</Text>
            <Text style={[S.statLabel, { color: theme.mutedText }]}>Teams</Text>
          </View>
          <View style={[S.statDivider, { backgroundColor: theme.border }]} />
          <View style={S.statCell}>
            <Text style={[S.statNumber, { color: theme.text }]}>{org?.posts_count ?? 0}</Text>
            <Text style={[S.statLabel, { color: theme.mutedText }]}>Posts</Text>
          </View>
          <View style={[S.statDivider, { backgroundColor: theme.border }]} />
          <View style={S.statCell}>
            <Text style={[S.statNumber, { color: theme.text }]}>{org?.followers_count ?? 0}</Text>
            <Text style={[S.statLabel, { color: theme.mutedText }]}>Followers</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={[S.tabsContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {['teams', 'posts', 'games'].map((tab) => (
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
          {activeTab === 'teams' && (
            <>
              {teams.length === 0 ? (
                <View style={S.emptyState}>
                  <Ionicons name="people-outline" size={48} color={theme.mutedText} />
                  <Text style={[S.emptyStateText, { color: theme.text }]}>No teams</Text>
                  <Text style={[S.emptyStateSubtext, { color: theme.mutedText }]}>
                    This organization has no teams yet
                  </Text>
                </View>
              ) : (
                teams.map((team) => (
                  <Pressable
                    key={team.id}
                    style={[S.teamCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => router.push(`/team-profile?id=${team.id}`)}
                  >
                    <View style={S.teamHeader}>
                      {team.logo_url && (
                        <Image source={{ uri: team.logo_url }} style={S.teamAvatar} contentFit="cover" />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[S.teamName, { color: theme.text }]} numberOfLines={1}>
                          {team.name}
                        </Text>
                        <Text style={[S.teamInfo, { color: theme.mutedText }]} numberOfLines={1}>
                          {team.sport || 'Sport TBA'} • {team._count?.members || 0} members
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))
              )}
            </>
          )}

          {activeTab === 'posts' && (
            <>
              {posts.length === 0 ? (
                <View style={S.emptyState}>
                  <Ionicons name="document-outline" size={48} color={theme.mutedText} />
                  <Text style={[S.emptyStateText, { color: theme.text }]}>No posts yet</Text>
                  <Text style={[S.emptyStateSubtext, { color: theme.mutedText }]}>
                    This organization hasn't posted anything yet
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
  coverSection: { position: 'relative', height: COVER_HEIGHT },
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
  profileSection: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16, marginBottom: 16 },
  avatarContainer: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
    borderColor: '#fff',
    overflow: 'hidden',
    marginBottom: 16,
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
  teamCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12, overflow: 'hidden' },
  teamHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  teamAvatar: { width: 48, height: 48, borderRadius: 24 },
  teamName: { fontSize: 15, fontWeight: '600' },
  teamInfo: { fontSize: 13, marginTop: 4 },
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
});
