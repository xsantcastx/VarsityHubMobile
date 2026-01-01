import { Organization, User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { ProfileLayout } from '@/features/profile/components/ProfileLayout';
import { useCustomColorScheme } from '@/shared/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
      const currentUser = await User.me().catch(() => null);
      setMe(currentUser);
      const o = await Organization.get(String(params.id));
      setOrg(o);
      const orgTeams = Array.isArray((o as any)?.teams) ? (o as any).teams : [];
      setTeams(orgTeams);
      setPosts(Array.isArray((o as any)?.posts) ? (o as any).posts : []);
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
  const foundedText = (() => {
    const year = Number((org as any)?.founded_year);
    return Number.isFinite(year) && year > 0 ? `Founded ${year}` : null;
  })();

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

  return (
    <SafeAreaView style={[S.container, { backgroundColor: theme.background }]} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <ProfileLayout
        loading={loading}
        error={error}
        coverUri={org?.preferences?.header_image_url || null}
        avatarUri={org?.logo_url || null}
        avatarFallbackIcon="people"
        name={org?.name || 'Organization'}
        handle={org?.slug || org?.id || null}
        subtitle={
          org?.sport
            ? `${org.sport.charAt(0).toUpperCase() + org.sport.slice(1)} • ${org.location || 'Location TBA'}`
            : org?.location || null
        }
        joinedText={foundedText}
        stats={[
          { label: 'Followers', value: org?.followers_count ?? 0 },
          { label: 'Teams', value: teams.length },
        ]}
        tabs={[
          { key: 'teams', label: 'Teams' },
          { key: 'posts', label: 'Posts' },
          { key: 'games', label: 'Games' },
        ]}
        activeTab={activeTab}
        onChangeTab={(key) => setActiveTab(key as 'teams' | 'posts' | 'games')}
        primaryAction={
          isOwnOrg
            ? {
                label: 'Edit org',
                onPress: () => router.push({ pathname: '/organizations/[id]', params: { id: String(org?.id ?? '') } }),
                icon: 'pencil',
                variant: 'outline',
              }
            : {
                label: org?.is_following ? 'Following' : 'Follow',
                onPress: onFollow,
                icon: org?.is_following ? 'checkmark' : 'person-add',
              }
        }
      >
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
      </ProfileLayout>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  contentSection: { paddingBottom: 32 },
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
