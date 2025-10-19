import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore api exports
import { User } from '@/api/entities';
import { BackHeader } from '@/components/ui/BackHeader';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import GameVerticalFeedScreen, { FeedPost } from './game-details/GameVerticalFeedScreen';

export default function UserProfileScreen() {
  const params = useLocalSearchParams<{ id?: string; username?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  // Collage grid state
  const screenWidth = Dimensions.get('window').width;
  const [postsWrapWidth, setPostsWrapWidth] = useState<number>(screenWidth);
  const GUTTER = 6;
  // Viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerItems, setViewerItems] = useState<FeedPost[]>([]);

  const load = useCallback(async () => {
    if (!params.id) { setError('No user id'); setLoading(false); return; }
    console.log('Loading user profile for id:', params.id);
    setLoading(true); setError(null);
    try {
      // Fetch current user and the public profile for target id
      try { const current = await User.me(); setMe(current); } catch {}
      const u = await User.getPublic(String(params.id));
      console.log('Loaded user profile:', u);
      setUser(u);
      const page = await User.postsForProfile(String(params.id), { limit: 10, sort: 'newest' });
      setPosts(page.items || []);
    } catch (e: any) {
      console.error('Error loading user profile:', e);
      setError(e?.message || 'Failed to load user');
    } finally { setLoading(false); }
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  // Helpers to map posts -> feed posts for viewer
  const VIDEO_EXT = /\.(mp4|mov|webm|m4v|avi)$/i;
  const toFeedPost = (item: any): FeedPost | null => {
    const id = item?.id ? String(item.id) : null;
    if (!id) return null;
    const isCollage = item?.type === 'collage' || !!item?.collage;
    const media = isCollage
      ? (typeof item?.preview_url === 'string' ? item.preview_url : (typeof item?.media_url === 'string' ? item.media_url : null))
      : (typeof item?.media_url === 'string' ? item.media_url : null);
    const explicit = typeof item?.media_type === 'string' ? String(item.media_type).toLowerCase() : null;
    const media_type: 'video' | 'image' = media
      ? (explicit === 'video' || explicit === 'image' ? (explicit as any) : (VIDEO_EXT.test(media) ? 'video' : 'image'))
      : 'image';
    return {
      id,
      media_url: media,
      media_type,
      caption: item?.caption ?? item?.content ?? '',
      upvotes_count: item?.upvotes_count ?? 0,
      comments_count: item?.comments_count ?? item?._count?.comments ?? 0,
      bookmarks_count: item?.bookmarks_count ?? 0,
      created_at: item?.created_at ?? null,
      author: item?.author ? { id: String(item.author.id ?? id), display_name: item.author.display_name ?? null, avatar_url: item.author.avatar_url ?? null } : null,
      has_upvoted: Boolean(item?.has_upvoted),
      has_bookmarked: Boolean(item?.has_bookmarked),
      is_following_author: Boolean(item?.is_following_author),
      type: isCollage ? 'collage' : (item?.type ?? null),
      collage: isCollage ? (item?.collage ?? null) : null,
      preview_url: typeof item?.preview_url === 'string' ? item.preview_url : null,
    };
  };

  // Collage helpers
  const columnWidth = Math.max(0, (postsWrapWidth - 4 * 1 - GUTTER) / 2); // align with profile padding
  const chooseAspect = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
    const pick = Math.abs(hash) % 3;
    return pick === 0 ? 1 : pick === 1 ? 3/4 : 4/3;
  };
  const makeMasonryColumns = (items: any[]) => {
    const colA: any[] = [];
    const colB: any[] = [];
    let hA = 0;
    let hB = 0;
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      const id = String(it?.id ?? idx);
      const aspect = chooseAspect(id);
      const estH = columnWidth / aspect + GUTTER;
      const entry = { ...it, __idx: idx, __aspect: aspect };
      if (hA <= hB) { colA.push(entry); hA += estH; } else { colB.push(entry); hB += estH; }
    }
    return { colA, colB };
  };
  const { colA, colB } = makeMasonryColumns(posts);

  return (
    <SafeAreaView style={[S.page, { backgroundColor: theme.background }]} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <BackHeader 
        title={user?.display_name || user?.username || 'Profile'} 
        backgroundColor={theme.background}
        textColor={theme.text}
      />
      {loading ? (
        <View style={S.center}><ActivityIndicator /></View>
      ) : error ? (
        <View style={S.center}><Text style={S.error}>{error}</Text></View>
      ) : !user ? (
        <View style={S.center}><Text>Not found</Text></View>
      ) : (
        <>
          {/* Modern Sport-Inspired Header with proper spacing */}
          <View style={[S.headerContainer, { marginTop: 8 }]}>
            {/* Background Gradient */}
            <LinearGradient
              colors={['#1e3a8a', '#3b82f6', '#60a5fa']}
              style={S.headerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            
            {/* Profile Content */}
            <View style={S.profileContent}>
              {/* Avatar Section */}
              <View style={S.avatarSection}>
                <View style={S.avatarContainer}>
                  {user.avatar_url ? (
                    <Image source={{ uri: String(user.avatar_url) }} style={S.avatarImage} contentFit="cover" />
                  ) : (
                    <View style={S.avatarPlaceholder}>
                      <Ionicons name="person" size={36} color="#ffffff" />
                    </View>
                  )}
                  {user.verified && (
                    <View style={S.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                    </View>
                  )}
                </View>
              </View>

              {/* User Info */}
              <View style={S.userInfo}>
                <Text style={S.userName}>{user.display_name || user.username || 'User'}</Text>
                
                {/* Role and Plan Badges */}
                {(user.role || user.preferences?.plan) && (
                  <View style={S.badgesRow}>
                    {user.role && (
                      <View style={[S.roleBadge, 
                        user.role === 'coach' && S.coachBadge,
                        user.role === 'player' && S.playerBadge,
                        user.role === 'fan' && S.fanBadge
                      ]}>
                        <Ionicons 
                          name={user.role === 'coach' ? 'flag' : user.role === 'player' ? 'american-football' : 'heart'} 
                          size={12} 
                          color="#ffffff" 
                        />
                        <Text style={S.roleText}>{user.role.toUpperCase()}</Text>
                      </View>
                    )}
                    {user.preferences?.plan && (
                      <View style={[S.planBadge,
                        user.preferences.plan.toLowerCase() === 'rookie' && S.rookieBadge,
                        user.preferences.plan.toLowerCase() === 'veteran' && S.veteranBadge,
                        user.preferences.plan.toLowerCase() === 'legend' && S.legendBadge
                      ]}>
                        <Ionicons 
                          name={user.preferences.plan.toLowerCase() === 'rookie' ? 'shield' : 
                               user.preferences.plan.toLowerCase() === 'veteran' ? 'medal' : 'trophy'} 
                          size={12} 
                          color="#ffffff" 
                        />
                        <Text style={S.planBadgeText}>{user.preferences.plan.toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                )}
                
                {user.bio && <Text style={S.userBio}>{user.bio}</Text>}
              </View>

              {/* Follow Button */}
              {me?.id && user?.id && me.id !== user.id && (
                <Pressable
                  onPress={async () => {
                    const next = !user.is_following;
                    setUser((prev: any) => ({ ...prev, is_following: next, followers_count: (prev.followers_count || 0) + (next ? 1 : -1) }));
                    try {
                      if (next) await User.follow(String(user.id)); else await User.unfollow(String(user.id));
                    } catch (e) {
                      setUser((prev: any) => ({ ...prev, is_following: !next, followers_count: (prev.followers_count || 0) + (!next ? 1 : -1) }));
                    }
                  }}
                  style={[S.followButton, user.is_following && S.followingButton]}
                >
                  <Text style={[S.followButtonText, user.is_following && S.followingButtonText]}>
                    {user.is_following ? 'Following' : 'Follow'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Athletic Stats Card */}
          <View style={[S.statsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Pressable style={S.statItem} onPress={() => router.push(`/followers?id=${user.id}&username=${encodeURIComponent(user.display_name || 'User')}`)}>
              <Text style={[S.statNumber, { color: theme.text }]}>{user.posts_count ?? 0}</Text>
              <Text style={[S.statLabel, { color: theme.mutedText }]}>Posts</Text>
            </Pressable>
            
            <View style={[S.statDivider, { backgroundColor: theme.border }]} />
            
            <Pressable style={S.statItem} onPress={() => router.push(`/followers?id=${user.id}&username=${encodeURIComponent(user.display_name || 'User')}`)}>
              <Text style={[S.statNumber, { color: theme.text }]}>{user.followers_count ?? 0}</Text>
              <Text style={[S.statLabel, { color: theme.mutedText }]}>Followers</Text>
            </Pressable>
            
            <View style={[S.statDivider, { backgroundColor: theme.border }]} />
            
            <Pressable style={S.statItem} onPress={() => router.push(`/following?id=${user.id}&username=${encodeURIComponent(user.display_name || 'User')}`)}>
              <Text style={[S.statNumber, { color: theme.text }]}>{user.following_count ?? 0}</Text>
              <Text style={[S.statLabel, { color: theme.mutedText }]}>Following</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: Math.max(24, insets.bottom) }}>
            {posts.length === 0 ? (
              <View style={{ padding: 16, alignItems: 'center' }}>
                <Text style={{ color: theme.mutedText }}>No posts yet.</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: GUTTER }} onLayout={(e) => setPostsWrapWidth(e.nativeEvent.layout.width)}>
                <View style={{ flex: 1, gap: GUTTER }}>
                  {colA.map((item) => {
                    const isCollage = item?.type === 'collage' || !!item?.collage;
                    const thumb = (isCollage ? item?.preview_url : item?.media_url) as string | null;
                    const likes = item?.upvotes_count ?? 0;
                    const comments = item?.comments_count ?? item?._count?.comments ?? 0;
                    const aspect = item.__aspect || 1;
                    const height = columnWidth / aspect;
                    return (
                      <Pressable
                        key={String(item.id)}
                        style={[S.gridItem, { width: columnWidth, height }]}
                        onPress={() => {
                          const mapped = (posts || []).map(toFeedPost);
                          const items = mapped.filter(Boolean) as FeedPost[];
                          const targetId = mapped[item.__idx]?.id;
                          const targetIdx = targetId ? items.findIndex((p) => p.id === targetId) : item.__idx;
                          if (__DEV__) console.debug('UserProfile opening viewer (colA)', { idx: item.__idx, targetIdx, total: items.length });
                          setViewerItems(items);
                          setViewerIndex(Math.max(0, targetIdx));
                          setViewerOpen(true);
                        }}
                      >
                        {thumb ? (
                          <Image source={{ uri: thumb }} style={S.gridImage} contentFit="cover" />
                        ) : (
                          <View style={[S.gridImage, S.gridImageFallback]}>
                            <LinearGradient colors={["#0b1120", "#0b1120", "#020617"]} style={StyleSheet.absoluteFillObject as any} />
                            <Text numberOfLines={2} ellipsizeMode="tail" style={S.gridTextOnly}>{String(item.caption || item.content || '').trim() || 'Post'}</Text>
                          </View>
                        )}
                        <View style={S.gridCounts}>
                          <View style={S.gridCountItem}>
                            <Ionicons name="arrow-up" size={12} color="#fff" />
                            <Text style={S.gridCountText}>{likes}</Text>
                          </View>
                          <View style={S.gridCountItem}>
                            <Ionicons name="chatbubble-ellipses" size={12} color="#fff" />
                            <Text style={S.gridCountText}>{comments}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={{ flex: 1, gap: GUTTER }}>
                  {colB.map((item) => {
                    const isCollage = item?.type === 'collage' || !!item?.collage;
                    const thumb = (isCollage ? item?.preview_url : item?.media_url) as string | null;
                    const likes = item?.upvotes_count ?? 0;
                    const comments = item?.comments_count ?? item?._count?.comments ?? 0;
                    const aspect = item.__aspect || 1;
                    const height = columnWidth / aspect;
                    return (
                      <Pressable
                        key={String(item.id)}
                        style={[S.gridItem, { width: columnWidth, height }]}
                        onPress={() => {
                          const mapped = (posts || []).map(toFeedPost);
                          const items = mapped.filter(Boolean) as FeedPost[];
                          const targetId = mapped[item.__idx]?.id;
                          const targetIdx = targetId ? items.findIndex((p) => p.id === targetId) : item.__idx;
                          if (__DEV__) console.debug('UserProfile opening viewer (colB)', { idx: item.__idx, targetIdx, total: items.length });
                          setViewerItems(items);
                          setViewerIndex(Math.max(0, targetIdx));
                          setViewerOpen(true);
                        }}
                      >
                        {thumb ? (
                          <Image source={{ uri: thumb }} style={S.gridImage} contentFit="cover" />
                        ) : (
                          <View style={[S.gridImage, S.gridImageFallback]}>
                            <LinearGradient colors={["#0b1120", "#0b1120", "#020617"]} style={StyleSheet.absoluteFillObject as any} />
                            <Text numberOfLines={2} ellipsizeMode="tail" style={S.gridTextOnly}>{String(item.caption || item.content || '').trim() || 'Post'}</Text>
                          </View>
                        )}
                        <View style={S.gridCounts}>
                          <View style={S.gridCountItem}>
                            <Ionicons name="arrow-up" size={12} color="#fff" />
                            <Text style={S.gridCountText}>{likes}</Text>
                          </View>
                          <View style={S.gridCountItem}>
                            <Ionicons name="chatbubble-ellipses" size={12} color="#fff" />
                            <Text style={S.gridCountText}>{comments}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>

          <Modal visible={viewerOpen} animationType="slide" onRequestClose={() => setViewerOpen(false)}>
            <GameVerticalFeedScreen
              onClose={() => setViewerOpen(false)}
              showHeader
              initialPosts={viewerItems}
              startIndex={viewerIndex}
              title={(user.display_name || 'Profile') + "'s posts"}
            />
          </Modal>
        </>
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  page: { 
    flex: 1
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#dc2626', fontSize: 16, fontWeight: '500' },

  // Modern Sport Header Styles
  headerContainer: {
    position: 'relative',
    paddingBottom: 20,
    marginTop: 8, // Space for BackHeader
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  profileContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 46,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 46,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  userBio: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    paddingHorizontal: 20,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f59e0b',
    marginTop: 8,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  coachBadge: { backgroundColor: '#1d4ed8' },
  playerBadge: { backgroundColor: '#dc2626' },
  fanBadge: { backgroundColor: '#7c3aed' },
  roleText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#111827',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  rookieBadge: { backgroundColor: '#22c55e' },
  veteranBadge: { backgroundColor: '#f59e0b' },
  legendBadge: { backgroundColor: '#dc2626' },
  planBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  followButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  followingButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  followButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  followingButtonText: {
    color: '#1e3a8a',
  },

  // Athletic Stats Card
  statsCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: -8, // Adjusted for proper spacing
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1e293b',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 16,
  },

  // Legacy styles for backward compatibility
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  avatarWrap: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden' },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  name: { fontWeight: '800', fontSize: 18 },
  bio: { color: '#6b7280' },
  followBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#111827' },
  followBtnOn: { backgroundColor: '#E5E7EB' },
  followBtnText: { color: '#FFFFFF', fontWeight: '800' },
  followBtnTextOn: { color: '#111827' },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 16, paddingBottom: 8 },
  statBox: { alignItems: 'center' },
  statNum: { fontWeight: '900', fontSize: 16 },

  // Enhanced Grid Styles
  gridItem: { 
    borderRadius: 16, 
    overflow: 'hidden', 
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  gridImageContainer: { width: '100%', height: '100%', position: 'relative' },
  gridImage: { width: '100%', height: '100%' },
  gridImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  gridImageFallback: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 16, 
    position: 'relative',
    backgroundColor: '#f8fafc',
  },
  textPostOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    margin: 8,
  },
  gridTextOnly: { 
    textAlign: 'center', 
    color: '#1e40af', 
    fontWeight: '700', 
    fontSize: 12, 
    lineHeight: 16,
  },
  gridCounts: { 
    position: 'absolute', 
    left: 8, 
    bottom: 8, 
    backgroundColor: 'rgba(0,0,0,0.75)', 
    borderRadius: 16, 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  gridCountItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  gridCountText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
});
