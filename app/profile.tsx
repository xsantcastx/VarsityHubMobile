import { User } from '@/api/entities';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { pickerMediaTypesProp } from '@/utils/picker';
import { Ionicons, SimpleLineIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GameVerticalFeedScreen, { FeedPost } from './game-details/GameVerticalFeedScreen';

const VIDEO_EXT = /\.(mp4|mov|webm|m4v|avi)$/i;

const toFeedPost = (item: any): FeedPost | null => {
  const id = item?.id ? String(item.id) : null;
  if (!id) return null;
  const media = typeof item?.media_url === 'string' ? item.media_url : null;
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
  };
};

type CurrentUser = {
  id?: string | number;
  username?: string;
  email?: string;
  full_name?: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  _count?: {
    posts?: number;
    followers?: number;
    following?: number;
  };
  [key: string]: any;
};

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'interactions'>(() => {
    try { return (globalThis?.localStorage?.getItem('profile.activeTab') as any) || 'posts'; } catch { return 'posts'; }
  });
  const [posts, setPosts] = useState<any[]>([]);
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [postsHasMore, setPostsHasMore] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);

  const [interactions, setInteractions] = useState<any[]>([]);
  const [interCursor, setInterCursor] = useState<string | null>(null);
  const [interHasMore, setInterHasMore] = useState(true);
  const [interLoading, setInterLoading] = useState(false);
  const [interType, setInterType] = useState<'all' | 'like' | 'comment' | 'repost' | 'save'>('all');
  const [sort, setSort] = useState<'newest' | 'most_upvoted' | 'most_commented'>('newest');
  const [counts, setCounts] = useState<{ posts: number; likes: number; comments: number; reposts: number; saves: number } | null>(null);
  const rememberingTab = useRef(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Vertical viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerItems, setViewerItems] = useState<FeedPost[]>([]);

  const handleAvatarPress = async () => {
    setIsUploadingAvatar(true);
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert("Permission required", "You've refused to allow this app to access your photos.");
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        ...pickerMediaTypesProp(),
        allowsEditing: true,
        aspect: [1, 1],
        selectionLimit: 1,
        quality: 0.9,
      } as any);

      if (pickerResult.canceled) {
        return;
      }

      const { uri, fileName, mimeType } = pickerResult.assets[0] as any;
      const manipulated = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 800 } }], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
      const fd = new FormData();
      const name = (fileName && String(fileName).includes('.')) ? String(fileName) : `avatar_${Date.now()}.jpg`;
      fd.append('file', { uri: manipulated.uri, name, type: 'image/jpeg' } as any);
      const token = await (await import('@/api/auth')).loadToken();
      const baseUrl = String((process as any).env?.EXPO_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
      const resp = await fetch(`${baseUrl}/upload/avatar`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } as any : undefined, body: fd as any });
      if (!resp.ok) throw new Error(await resp.text());
      const { url } = await resp.json();
      await User.updateMe({ avatar_url: url });
      setMe((prev) => (prev ? { ...prev, avatar_url: url } : null));

    } catch (error) {
      console.error("Avatar upload failed", error);
      Alert.alert("Upload failed", "Could not upload your new profile picture. Please try again.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: ensure session is valid
      const u: any = await User.me();
      if (u && !u._isNotModified) setMe(u ?? null);
      if (!u?.id) { setLoading(false); return; }

      // Load first page for active tab
      if (activeTab === 'posts') {
        await refreshPosts(u.id);
      } else {
        await refreshInteractions(u.id);
      }
    } catch (e: any) {
      console.error('Failed to load profile', e);
      // Only show sign-in if the session itself is invalid from /me.
      if (e && e.status === 401) {
        setError('You need to sign in to view your profile.');
      } else {
        setError(e?.message ? `Unable to load profile: ${e.message}` : 'Unable to load profile.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // Refresh when screen regains focus (after creating a post, etc.)
  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

  // Refresh when switching tabs
  useEffect(() => {
    if (!me?.id) return;
    if (activeTab === 'posts') {
      refreshPosts(String(me.id));
    } else {
      refreshInteractions(String(me.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // When interactions filters/sort change while on Interactions tab, refresh
  useEffect(() => {
    if (!me?.id) return;
    if (activeTab === 'interactions') {
      refreshInteractions(String(me.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interType, sort]);

  const refreshPosts = useCallback(async (userId: string) => {
    setPostsLoading(true);
    try {
      const page = await User.postsForProfile(String(userId), { limit: 10, sort });
      setPosts(page.items || []);
      setPostsCursor(page.nextCursor || null);
      setPostsHasMore(Boolean(page.nextCursor));
      if (page.counts) setCounts(page.counts);
    } finally {
      setPostsLoading(false);
    }
  }, [sort]);

  const loadMorePosts = useCallback(async (userId: string) => {
    if (postsLoading || !postsHasMore) return;
    setPostsLoading(true);
    try {
      const page = await User.postsForProfile(String(userId), { limit: 10, sort, cursor: postsCursor || undefined });
      setPosts((prev) => [...prev, ...(page.items || [])]);
      setPostsCursor(page.nextCursor || null);
      setPostsHasMore(Boolean(page.nextCursor));
      if (page.counts) setCounts(page.counts);
    } finally {
      setPostsLoading(false);
    }
  }, [postsCursor, postsHasMore, postsLoading, sort]);

  const refreshInteractions = useCallback(async (userId: string) => {
    setInterLoading(true);
    try {
      const page = await User.interactionsForProfile(String(userId), { limit: 10, sort, type: interType });
      setInteractions(page.items || []);
      setInterCursor(page.nextCursor || null);
      setInterHasMore(Boolean(page.nextCursor));
      if (page.counts) setCounts(page.counts);
    } finally {
      setInterLoading(false);
    }
  }, [interType, sort]);

  const loadMoreInteractions = useCallback(async (userId: string) => {
    if (interLoading || !interHasMore) return;
    setInterLoading(true);
    try {
      const page = await User.interactionsForProfile(String(userId), { limit: 10, sort, type: interType, cursor: interCursor || undefined });
      setInteractions((prev) => [...prev, ...(page.items || [])]);
      setInterCursor(page.nextCursor || null);
      setInterHasMore(Boolean(page.nextCursor));
      if (page.counts) setCounts(page.counts);
    } finally {
      setInterLoading(false);
    }
  }, [interCursor, interHasMore, interLoading, interType, sort]);

  const name = me?.display_name || me?.username || 'User';
  const stats = [
    { label: 'posts', value: me?._count?.posts ?? 0 },
    { label: 'followers', value: me?._count?.followers ?? 0 },
    { label: 'following', value: me?._count?.following ?? 0 },
  ];

  const renderHeader = () => (
    <>
      <View style={styles.header}>
        <Pressable onPress={handleAvatarPress} disabled={isUploadingAvatar}>
          <Avatar uri={me.avatar_url} size={80} />
          {isUploadingAvatar && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color="white" />
            </View>
          )}
        </Pressable>
        <View style={styles.statsContainer}>
          {stats.map((stat) => (
            <Pressable
              key={stat.label}
              style={styles.statItem}
              onPress={() => {
                if (stat.label === 'followers') {
                  router.push(`/followers?id=${me.id}&username=${name}`);
                } else if (stat.label === 'following') {
                  router.push(`/following?id=${me.id}&username=${name}`);
                }
              }}
            >
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.bioContainer}>
        <Text style={styles.name}>{name}</Text>
        {me.bio ? <Text style={styles.bio}>{me.bio}</Text> : null}
      </View>
      <View style={styles.actionsContainer}>
  <Button style={{ flex: 1 }} onPress={() => router.push('/edit-profile')}><Text>Edit Profile</Text></Button>
        <Button variant="outline" size="icon" onPress={() => router.push('/settings')}>
          <SimpleLineIcons name="settings" size={20} color="black" />
        </Button>
      </View>
      <View style={styles.tabsContainer}>
        <Pressable
          onPress={() => { setActiveTab('posts'); try { globalThis?.localStorage?.setItem('profile.activeTab','posts'); } catch {} }}
          style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
        >
          <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>Posts{counts ? ` (${counts.posts})` : ''}</Text>
        </Pressable>
        <Pressable
          onPress={() => { setActiveTab('interactions'); try { globalThis?.localStorage?.setItem('profile.activeTab','interactions'); } catch {} }}
          style={[styles.tab, activeTab === 'interactions' && styles.activeTab]}
        >
          <Text style={[styles.tabText, activeTab === 'interactions' && styles.activeTabText]}>Interactions</Text>
        </Pressable>
      </View>

      {activeTab === 'interactions' && (
        <View style={styles.filtersBar}>
          <View style={styles.segmentedRow}>
            {(['all','like','comment','save'] as const).map((t) => {
              const label = t === 'all'
                ? 'All'
                : t === 'like'
                ? `Likes${counts ? ` (${counts.likes})` : ''}`
                : t === 'comment'
                ? `Comments${counts ? ` (${counts.comments})` : ''}`
                : `Saves${counts ? ` (${counts.saves})` : ''}`;
              return (
                <Pressable key={t} onPress={() => setInterType(t)} style={[styles.segment, interType === t && styles.segmentActive]}>
                  <Text style={[styles.segmentText, interType === t && styles.segmentTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.sortRow}>
            {(['newest','most_upvoted','most_commented'] as const).map(s => (
              <Pressable key={s} onPress={() => setSort(s)} style={[styles.sortPill, sort === s && styles.sortPillActive]}>
                <Text style={[styles.sortText, sort === s && styles.sortTextActive]}>
                  {s === 'newest' ? 'Newest' : s === 'most_upvoted' ? 'Most upvoted' : 'Most commented'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </>
  );

  const renderEmptyPosts = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No posts yet</Text>
      <Text style={styles.emptySubtitle}>Share your first moment with the community!</Text>
  <Button onPress={() => router.push('/create-post')}><Text>Create Your First Post</Text></Button>
    </View>
  );

  const onEndReachedPosts = useCallback(() => { if (me?.id) loadMorePosts(String(me.id)); }, [me?.id, loadMorePosts]);
  const onEndReachedInteractions = useCallback(() => { if (me?.id) loadMoreInteractions(String(me.id)); }, [me?.id, loadMoreInteractions]);

  const SkeletonList = ({ count = 8 }: { count?: number }) => (
    <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ height: 100, backgroundColor: '#F3F4F6', borderRadius: 12, marginBottom: 12 }} />
      ))}
    </View>
  );

  if (loading) return <SkeletonList count={8} />;

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <View style={{ height: 8 }} />
  <Button onPress={() => router.push('/sign-in')}><Text>Sign In</Text></Button>
      </View>
    );
  }

  if (!me) {
    return null; // Or some other placeholder
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Profile' }} />
      {activeTab === 'posts' ? (
        <FlatList
          data={posts}
          key={activeTab + '-grid'}
          numColumns={3}
          columnWrapperStyle={styles.gridRow}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyPosts}
          contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 2 }}
          onEndReachedThreshold={0.5}
          onEndReached={onEndReachedPosts}
          renderItem={({ item, index }) => {
            const thumb = item.media_url;
            const isVideo = !!thumb && VIDEO_EXT.test(thumb);
            const likes = item.upvotes_count ?? 0;
            const comments = item.comments_count ?? item._count?.comments ?? 0;
            return (
              <Pressable
                style={styles.gridItem}
                onPress={() => {
                  const mapped = (posts || []).map(toFeedPost);
                  const items = mapped.filter(Boolean) as FeedPost[];
                  const targetId = mapped[index]?.id;
                  const targetIdx = targetId ? items.findIndex((p) => p.id === targetId) : index;
                  setViewerItems(items);
                  setViewerIndex(Math.max(0, targetIdx));
                  setViewerOpen(true);
                }}
              >
                {thumb ? (
                  <>
                    <Image source={{ uri: thumb }} style={styles.gridImage} contentFit="cover" />
                  </>
                ) : (
                  <View style={[styles.gridImage, styles.gridImageFallback]}>
                    <LinearGradient colors={["#0b1120", "#0b1120", "#020617"]} style={StyleSheet.absoluteFillObject as any} />
                    <Text numberOfLines={3} style={styles.gridTextOnly}>{String(item.caption || item.content || '').trim() || 'Post'}</Text>
                  </View>
                )}
                {/* Counts overlay (shown for both media and text tiles) */}
                <View style={styles.gridCounts}>
                  <View style={styles.gridCountItem}>
                    <Ionicons name="arrow-up" size={12} color="#fff" />
                    <Text style={styles.gridCountText}>{likes}</Text>
                  </View>
                  <View style={styles.gridCountItem}>
                    <Ionicons name="chatbubble-ellipses" size={12} color="#fff" />
                    <Text style={styles.gridCountText}>{comments}</Text>
                  </View>
                </View>
                {/* Bottom-right badge: camera for media, text icon for text-only */}
                <View style={styles.gridIconBadge}>
                  <Ionicons name={thumb ? 'camera-outline' : 'text'} size={14} color="#fff" />
                </View>
              </Pressable>
            );
          }}
          ListFooterComponent={postsLoading ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
        />
      ) : (
        <FlatList
          data={interactions}
          key={activeTab + '-grid'}
          numColumns={3}
          columnWrapperStyle={styles.gridRow}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyTitle}>No activity yet</Text></View>}
          contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 2 }}
          onEndReachedThreshold={0.5}
          onEndReached={onEndReachedInteractions}
          renderItem={({ item, index }) => {
            const thumb = item.media_url;
            const isVideo = !!thumb && VIDEO_EXT.test(thumb);
            const likes = item.upvotes_count ?? 0;
            const comments = item.comments_count ?? item._count?.comments ?? 0;
            return (
              <Pressable
                style={styles.gridItem}
                onPress={() => {
                  const mapped = (interactions || []).map(toFeedPost);
                  const items = mapped.filter(Boolean) as FeedPost[];
                  const targetId = mapped[index]?.id;
                  const targetIdx = targetId ? items.findIndex((p) => p.id === targetId) : index;
                  setViewerItems(items);
                  setViewerIndex(Math.max(0, targetIdx));
                  setViewerOpen(true);
                }}
              >
                {thumb ? (
                  <>
                    <Image source={{ uri: thumb }} style={styles.gridImage} contentFit="cover" />
                  </>
                ) : (
                  <View style={[styles.gridImage, styles.gridImageFallback]}>
                    <LinearGradient colors={["#0b1120", "#0b1120", "#020617"]} style={StyleSheet.absoluteFillObject as any} />
                    <Text numberOfLines={3} style={styles.gridTextOnly}>{String(item.caption || item.content || '').trim() || 'Post'}</Text>
                  </View>
                )}
                <View style={styles.gridCounts}>
                  <View style={styles.gridCountItem}>
                    <Ionicons name="arrow-up" size={12} color="#fff" />
                    <Text style={styles.gridCountText}>{likes}</Text>
                  </View>
                  <View style={styles.gridCountItem}>
                    <Ionicons name="chatbubble-ellipses" size={12} color="#fff" />
                    <Text style={styles.gridCountText}>{comments}</Text>
                  </View>
                </View>
                <View style={styles.gridIconBadge}>
                  <Ionicons name={thumb ? 'camera-outline' : 'text'} size={14} color="#fff" />
                </View>
              </Pressable>
            );
          }}
          ListFooterComponent={interLoading ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
        />
      )}

      <Modal visible={viewerOpen} animationType="slide" onRequestClose={() => setViewerOpen(false)}>
        <GameVerticalFeedScreen
          onClose={() => setViewerOpen(false)}
          showHeader
          initialPosts={viewerItems}
          startIndex={viewerIndex}
          title={activeTab === 'posts' ? 'Your posts' : 'Your interactions'}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  center: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#b91c1c', textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  statsContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 14, color: '#6B7280' },
  bioContainer: { paddingHorizontal: 16, paddingBottom: 16 },
  name: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  bio: { fontSize: 14, color: '#4B5563' },
  actionsContainer: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, paddingBottom: 16 },
  tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: 'black' },
  tabText: { color: '#6B7280', fontWeight: '600' },
  activeTabText: { color: 'black' },
  filtersBar: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', gap: 8 },
  segmentedRow: { flexDirection: 'row', gap: 8 },
  segment: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#F3F4F6' },
  segmentActive: { backgroundColor: '#111827' },
  segmentText: { color: '#111827', fontWeight: '600' },
  segmentTextActive: { color: 'white' },
  sortRow: { flexDirection: 'row', gap: 8 },
  sortPill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, backgroundColor: '#F3F4F6' },
  sortPillActive: { backgroundColor: '#111827' },
  sortText: { color: '#111827', fontWeight: '600' },
  sortTextActive: { color: 'white' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold' },
  emptySubtitle: { color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 40,
  },
  activityItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  gridRow: { gap: 2 },
  gridItem: { flex: 1, aspectRatio: 1, margin: 2, borderRadius: 8, overflow: 'hidden', backgroundColor: '#F3F4F6' },
  gridImage: { width: '100%', height: '100%' },
  gridImageFallback: { alignItems: 'center', justifyContent: 'center', padding: 8 },
  gridTextOnly: { textAlign: 'center', color: '#111827', fontWeight: '700' },
  gridIconBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  gridCounts: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 8 },
  gridCountItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gridCountText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
