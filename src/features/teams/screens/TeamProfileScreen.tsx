import { Team as TeamApi, User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { ProfileLayout } from '@/features/profile/components/ProfileLayout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
      const currentUser = await User.me().catch(() => null);
      setMe(currentUser);
      const t = await TeamApi.get(String(params.id));
      setTeam(t);
      setPosts([]);
      const membersPage = await TeamApi.members(String(params.id));
      const memberItems = Array.isArray((membersPage as any)?.items) ? (membersPage as any).items : (Array.isArray(membersPage) ? membersPage : []);
      setMembers(memberItems);
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
  const foundedText = (() => {
    const year = Number((team as any)?.founded_year);
    return Number.isFinite(year) && year > 0 ? `Founded ${year}` : null;
  })();

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

  return (
    <SafeAreaView style={[S.container, { backgroundColor: theme.background }]} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <ProfileLayout
        loading={loading}
        error={error}
        coverUri={team?.preferences?.header_image_url || null}
        avatarUri={team?.logo_url || null}
        avatarFallbackIcon="people"
        name={team?.name || 'Team'}
        handle={team?.slug || team?.id || null}
        subtitle={
          team?.sport
            ? `${team.sport.charAt(0).toUpperCase() + team.sport.slice(1)} • ${team.location || 'Location TBA'}`
            : team?.location || null
        }
        joinedText={foundedText}
        stats={[
          { label: 'Followers', value: team?.followers_count ?? 0 },
          { label: 'Members', value: members.length },
        ]}
        tabs={[
          { key: 'posts', label: 'Posts' },
          { key: 'members', label: 'Members' },
          { key: 'games', label: 'Games' },
        ]}
        activeTab={activeTab}
        onChangeTab={(key) => setActiveTab(key as 'posts' | 'members' | 'games')}
        primaryAction={
          isOwnTeam
            ? {
                label: 'Edit team',
                onPress: () => router.push({ pathname: '/team-page', params: { id: String(team?.id ?? '') } }),
                icon: 'pencil',
                variant: 'outline',
              }
            : {
                label: team?.is_following ? 'Following' : 'Follow',
                onPress: onFollow,
                icon: team?.is_following ? 'checkmark' : 'person-add',
              }
        }
      >
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
  memberCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12, overflow: 'hidden' },
  memberHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberAvatar: { width: 48, height: 48, borderRadius: 24 },
  memberName: { fontSize: 15, fontWeight: '600' },
  memberRole: { fontSize: 13, marginTop: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyStateText: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  emptyStateSubtext: { fontSize: 14, marginTop: 6 },
});
