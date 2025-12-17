import { JerseyBadge, Sport } from '@/components/JerseyBadge';
import { getConfig } from '@/config/env';
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
import { getGradientForColor } from '@/utils/theme';
import GameVerticalFeedScreen, { FeedPost } from './game-details/GameVerticalFeedScreen';

const appConfig = getConfig();
const HEADER_IMAGE_DRAG_LIMIT = 120;
const clampValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Get sport emoji based on sport type
 */
const getSportEmoji = (sport: string): string => {
  const emojiMap: Record<string, string> = {
    basketball: '🏀',
    football: '🏈',
    baseball: '⚾',
    soccer: '⚽',
    volleyball: '🏐',
    other: '🏆',
  };
  return emojiMap[sport.toLowerCase()] || '🏆';
};

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
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async () => {
    if (!params.id) { setError('No user id'); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      // Fetch current user and the public profile for target id
      try { 
        const current = await User.me(); 
        setMe(current);
        
        // Check if current user is admin
        const adminEmails = (appConfig.adminEmails.length ? appConfig.adminEmails : [])
          .map((e) => e.toLowerCase());
        setIsAdmin(adminEmails.includes((current?.email || '').toLowerCase()));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error: any) {}
      const u = await User.getPublic(String(params.id));
      setUser(u);
      const page = await User.postsForProfile(String(params.id), { limit: 10, sort: 'newest' });
      setPosts(page.items || []);
    } catch (e: any) {
      // Error loading user profile - handled via error message display
      // Handle 401 separately like profile.tsx
      if (e && e.status === 401) {
        setError('You need to sign in to view profiles.');
      } else {
        setError(e?.message || 'Failed to load user');
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } finally { setLoading(false); }
  }, [params.id]);

  useEffect(() => { void load(); }, [load]);

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
  
  // Athlete-specific data extraction
  const isAthlete = user ? Boolean(user?.preferences?.position || user?.preferences?.jersey_number) : false;
  const jerseyNumber = user?.preferences?.jersey_number || user?.jersey_number;
  const position = user?.preferences?.position || user?.position;
  const gradeLevel = user?.preferences?.grade_level;
  const graduationYear = user?.preferences?.graduation_year;
  const accolades = user?.preferences?.accolades;
  const primarySport = (user?.preferences?.primary_sport || user?.preferences?.sport || 'other') as Sport;
  const userThemeColor = user?.preferences?.theme_color || '#3B82F6';
  const headerBackgroundImage = user?.preferences?.header_image_url || null;
  const headerImageFocusY = clampValue(typeof user?.preferences?.header_image_focus_y === 'number' ? user.preferences.header_image_focus_y : 0, -1, 1);
  const heroGradientColors: [string, string, ...string[]] = headerBackgroundImage
    ? ['rgba(4,7,20,0.85)', 'rgba(15,23,42,0.45)']
    : (getGradientForColor(userThemeColor) as [string, string, ...string[]]);

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
            {/* Background Image / Gradient */}
            {headerBackgroundImage ? (
              <Image
                source={{ uri: headerBackgroundImage }}
                style={[
                  S.headerBackgroundImage,
                  { transform: [{ translateY: headerImageFocusY * HEADER_IMAGE_DRAG_LIMIT }] },
                ]}
                contentFit="cover"
              />
            ) : null}
            <LinearGradient
              colors={heroGradientColors}
              style={S.headerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            
            {/* Jersey Badge (Top Right for Athletes) */}
            {isAthlete && jerseyNumber && (
              <View style={[S.jerseyBadgeTopRight, { top: 20 + insets.top }]}>
                <JerseyBadge 
                  jerseyNumber={jerseyNumber} 
                  sport={primarySport}
                  teamColor={userThemeColor}
                  size="medium"
                />
              </View>
            )}
            
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={S.userName}>{user.display_name || user.username || 'User'}</Text>
                  {/* Admin Badge - Only visible when viewing own profile as admin */}
                  {isAdmin && me?.id === user.id && (
                    <View style={S.adminBadge}>
                      <Ionicons name="shield-checkmark" size={16} color="#ffffff" />
                    </View>
                  )}
                </View>
                
                {/* Role and Plan Badges */}
                {(user.role || user.preferences?.plan) && (
                  <View style={S.badgesRow}>
                    {user.role && (
                      <View style={[S.roleBadge, 
                        user.role === 'coach' && S.coachBadge,
                        (user.role === 'coach') && S.coachBadge,
                        user.role === 'fan' && S.fanBadge
                      ]}>
                        <Ionicons 
                          name={user.role === 'coach' ? 'flag' : 'heart'} 
                          size={12} 
                          color="#ffffff" 
                        />
                        <Text style={S.roleText}>
                          {user.role.toUpperCase()}
                        </Text>
                      </View>
                    )}
                    {user.preferences?.plan && (
                      <View style={[S.planBadge,
                        user.preferences.plan.toLowerCase() === 'rookie' && S.rookieBadge,
                        user.preferences.plan.toLowerCase() === 'veteran' && S.veteranBadge,
                        user.preferences.plan.toLowerCase() === 'legend' && S.legendBadge
                      ]}>
                        {user.preferences.plan.toLowerCase() === 'veteran' ? (
                          <Text style={{ fontSize: 12 }}>🏆</Text>
                        ) : user.preferences.plan.toLowerCase() === 'legend' ? (
                          <Text style={{ fontSize: 12 }}>🥇</Text>
                        ) : (
                          <Ionicons name="shield" size={12} color="#ffffff" />
                        )}
                        <Text style={S.planBadgeText}>{user.preferences.plan.toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                )}
                
                {/* Position Badge (Athletes Only) */}
                {isAthlete && position && (
                  <View style={S.positionBadge}>
                    <Text style={S.positionText}>{position.toUpperCase()}</Text>
                  </View>
                )}
                
                {/* Athletic Credentials (Athletes Only) */}
                {isAthlete && (gradeLevel || accolades || graduationYear) && (
                  <View style={S.credentialsContainer}>
                    <Text style={S.credentialsText}>
                      {[
                        gradeLevel,
                        accolades && accolades.length > 0 ? accolades[0] : null,
                        graduationYear ? `Class of ${graduationYear}` : null,
                      ].filter(Boolean).join(' | ')}
                      {primarySport && primarySport !== 'other' ? ` ${getSportEmoji(primarySport)}` : ''}
                    </Text>
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
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    } catch (_error: any) {
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
            <Pressable style={S.statItem} onPress={() => void router.push(`/followers?id=${user.id}&username=${encodeURIComponent(user.display_name || 'User')}`)}>
              <Text style={[S.statNumber, { color: theme.text }]}>{user.posts_count ?? 0}</Text>
              <Text style={[S.statLabel, { color: theme.mutedText }]}>Posts</Text>
            </Pressable>
            
            <View style={[S.statDivider, { backgroundColor: theme.border }]} />
            
            <Pressable style={S.statItem} onPress={() => void router.push(`/followers?id=${user.id}&username=${encodeURIComponent(user.display_name || 'User')}`)}>
              <Text style={[S.statNumber, { color: theme.text }]}>{user.followers_count ?? 0}</Text>
              <Text style={[S.statLabel, { color: theme.mutedText }]}>Followers</Text>
            </Pressable>
            
            <View style={[S.statDivider, { backgroundColor: theme.border }]} />
            
            <Pressable style={S.statItem} onPress={() => void router.push(`/following?id=${user.id}&username=${encodeURIComponent(user.display_name || 'User')}`)}>
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
                          // Debug: UserProfile opening viewer (colA)
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
                          // Debug: UserProfile opening viewer (colB)
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
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0b1120',
  },
  headerBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    height: 220,
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
    height: 220,
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
  adminBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 20,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
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
  
  // Athlete-specific styles
  jerseyBadgeTopRight: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
  },
  positionBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  positionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  credentialsContainer: {
    marginTop: 6,
    paddingHorizontal: 12,
  },
  credentialsText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
