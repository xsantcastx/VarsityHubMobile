import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
// @ts-ignore api exports
import { User } from '@/api/entities';
import GameVerticalFeedScreen, { FeedPost } from './game-details/GameVerticalFeedScreen';

export default function UserProfileScreen() {
  const params = useLocalSearchParams<{ id?: string; username?: string }>();
  const router = useRouter();
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
    <View style={S.page}>
      <Stack.Screen options={{ title: params.username ? String(params.username) : 'Profile' }} />
      {loading ? (
        <View style={S.center}><ActivityIndicator /></View>
      ) : error ? (
        <View style={S.center}><Text style={S.error}>{error}</Text></View>
      ) : !user ? (
        <View style={S.center}><Text>Not found</Text></View>
      ) : (
        <>
          <View style={S.header}>
            <View style={S.avatarWrap}>
              {user.avatar_url ? (
                <Image source={{ uri: String(user.avatar_url) }} style={S.avatar} contentFit="cover" />
              ) : (
                <View style={[S.avatar, { backgroundColor: '#E5E7EB' }]} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.name}>{user.display_name || user.username || 'User'}</Text>
              {user.bio ? <Text style={S.bio}>{user.bio}</Text> : null}
            </View>
            {me?.id && user?.id && me.id !== user.id ? (
              <Pressable
                onPress={async () => {
                  const next = !user.is_following;
                  setUser((prev: any) => ({ ...prev, is_following: next, followers_count: (prev.followers_count || 0) + (next ? 1 : -1) }));
                  try {
                    if (next) await User.follow(String(user.id)); else await User.unfollow(String(user.id));
                  } catch (e) {
                    // revert on failure
                    setUser((prev: any) => ({ ...prev, is_following: !next, followers_count: (prev.followers_count || 0) + (!next ? 1 : -1) }));
                  }
                }}
                style={[S.followBtn, user.is_following && S.followBtnOn]}
              >
                <Text style={[S.followBtnText, user.is_following && S.followBtnTextOn]}>{user.is_following ? 'Following' : 'Follow'}</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Stats row */}
          <View style={S.statsRow}>
            <View style={S.statBox}>
              <Text style={S.statNum}>{user.posts_count ?? 0}</Text>
              <Text style={S.statLabel}>Posts</Text>
            </View>
            <Pressable style={S.statBox} onPress={() => router.push(`/followers?id=${user.id}&username=${encodeURIComponent(user.display_name || 'User')}`)}>
              <Text style={S.statNum}>{user.followers_count ?? 0}</Text>
              <Text style={S.statLabel}>Followers</Text>
            </Pressable>
            <Pressable style={S.statBox} onPress={() => router.push(`/following?id=${user.id}&username=${encodeURIComponent(user.display_name || 'User')}`)}>
              <Text style={S.statNum}>{user.following_count ?? 0}</Text>
              <Text style={S.statLabel}>Following</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 24 }}>
            {posts.length === 0 ? (
              <View style={{ padding: 16, alignItems: 'center' }}>
                <Text style={{ color: '#6B7280' }}>No posts yet.</Text>
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
    </View>
  );
}

const S = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#b91c1c' },
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
  statLabel: { color: '#6b7280', fontSize: 12 },
  gridItem: { 
    borderRadius: 12, 
    overflow: 'hidden', 
    backgroundColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
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
  gridImageFallback: { alignItems: 'center', justifyContent: 'center', padding: 12, position: 'relative' },
  textPostOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    margin: 8,
    backdropFilter: 'blur(10px)'
  },
  gridTextOnly: { 
    textAlign: 'center', 
    color: '#ffffff', 
    fontWeight: '700', 
    fontSize: 11, 
    lineHeight: 14,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  },
  gridCounts: { 
    position: 'absolute', 
    left: 8, 
    bottom: 8, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    borderRadius: 14, 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2
  },
  gridCountItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  gridCountText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
