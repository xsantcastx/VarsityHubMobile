type PostItem = { id: string; title?: string; content?: string; media_url?: string; created_at?: string; upvotes_count?: number };
import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { Game, Post as PostApi, User } from '@/api/entities';
import MessagesTabIcon from '@/components/ui/MessagesTabIcon';
import VideoPlayer from '@/components/VideoPlayer';
import { Ionicons } from '@expo/vector-icons';
import { format, formatDistanceToNow } from 'date-fns';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

type GameItem = { id: string; title?: string; date?: string; location?: string; cover_image_url?: string; banner_url?: string | null; event_id?: string | null };

export default function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<GameItem[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const tapTsRef = useRef<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [me, setMe] = useState<any>(null);
  const emailVerified = !!me?.email_verified;

  const load = useCallback(async () => {
    let mounted = true;
      setLoading(true);
      setError(null);
      try {
        // Try to get current user (may throw if unauthenticated)
        try { const u = await User.me(); setMe(u); } catch {}
        const [gamesData, postsData]: any = await Promise.all([
          Game.list('-date'),
          PostApi.list('-created_date', 10),
        ]);
        if (!mounted) return;
        setGames(Array.isArray(gamesData) ? gamesData : []);
        if (Array.isArray(postsData)) {
          setPosts(postsData);
          setPostsCursor(postsData.length ? String(postsData[postsData.length - 1].id) : null);
        } else if (postsData?.items) {
          setPosts(postsData.items);
          setPostsCursor(postsData.nextCursor || null);
        } else {
          setPosts([]);
          setPostsCursor(null);
        }
      } catch (e: any) {
        if (!mounted) return;
        console.error('Failed to load feed', e);
        setError('Unable to load games. Sign in may be required.');
        setGames([]);
      } finally {
        if (mounted) setLoading(false);
      }
    return () => { mounted = false; };
  }, []);

  useEffect(() => { (async () => { await load(); })(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const loadMorePosts = useCallback(async () => {
    if (loadingMorePosts || !posts.length) return;
    setLoadingMorePosts(true);
    try {
      const lastId = String(posts[posts.length - 1].id);
      const page: any = await PostApi.listPage(lastId, 10);
      if (Array.isArray(page)) {
        // Fallback
        setPosts((arr) => arr.concat(page));
        setPostsCursor(page.length ? String(page[page.length - 1].id) : null);
      } else if (page?.items) {
        setPosts((arr) => arr.concat(page.items || []));
        setPostsCursor(page.nextCursor || null);
      }
    } catch {}
    setLoadingMorePosts(false);
  }, [posts, loadingMorePosts]);

  const toggleUpvote = useCallback(async (id: string) => {
    try {
      const r: any = await PostApi.toggleUpvote(id);
      setPosts((arr) => arr.map((p: any) => (
        String(p.id) === String(id)
          ? { ...p, upvotes_count: typeof r?.count === 'number' ? r.count : ((p.upvotes_count || 0) + (r?.upvoted ? 1 : -1)) }
          : p
      )));
    } catch {}
  }, []);

  const onMediaPress = (id: string) => {
    const now = Date.now();
    const last = tapTsRef.current[id] || 0;
    if (now - last < 300) {
      toggleUpvote(String(id));
      triggerHeart(String(id));
    }
    tapTsRef.current[id] = now;
  };

  // Heart overlay animations per post
  const heartAnims = useRef<Map<string, Animated.Value>>(new Map());
  const [heartTick, setHeartTick] = useState(0);
  const getHeartAnim = (id: string) => {
    let v = heartAnims.current.get(id);
    if (!v) {
      v = new Animated.Value(0);
      heartAnims.current.set(id, v);
    }
    return v;
  };
  const triggerHeart = (id: string) => {
    const v = getHeartAnim(id);
    v.stopAnimation();
    v.setValue(0);
    Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 600, delay: 250, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => setHeartTick((x) => x + 1));
  };

  // Reload when returning to Feed so counts/comments stay fresh
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(() => {
    if (!query) return games;
    const q = query.toLowerCase().trim();
    const zip = q.match(/\b\d{5}\b/);
    if (zip) {
      return games.filter(g => (g.location || '').toLowerCase().includes(zip[0]));
    }
    return games.filter(g => (g.title || '').toLowerCase().includes(q) || (g.location || '').toLowerCase().includes(q));
  }, [games, query]);

  return (
    <View style={[styles.container, { paddingTop: 12 + insets.top }]}>
      <Stack.Screen options={{ title: 'VarsityHub' }} />
      {/* Top bar with brand and messages quick link */}
      <View style={styles.headerRow}>
        <View style={styles.brandRow}>
          <Ionicons name="shield-outline" size={28} color="#2563EB" />
          <Text style={styles.brand}>Feed</Text>
        </View>
        <Pressable onPress={() => router.push('/messages')} style={{ padding: 8 }}>
          <MessagesTabIcon color="#111827" />
        </Pressable>
      </View>
      {error && (
        <View style={{ marginBottom: 8 }}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => router.push('/sign-in')} style={{ paddingVertical: 8 }}>
            <Text style={{ color: '#0a7ea4', fontWeight: '600' }}>Sign in to load personalized feed</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#6b7280" />
        <TextInput
          placeholder="Search by Zip Code..."
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
        />
      </View>
      <Text style={styles.helper}>Showing upcoming and recent games in your area.</Text>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      )}
      {!loading && filtered.length === 0 && !error && (
        <Text style={styles.muted}>No games found.</Text>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={() => (me && !emailVerified ? (
          <Pressable onPress={() => router.push('/verify-email')} style={{ padding: 10, borderRadius: 10, backgroundColor: '#FEF9C3', borderWidth: StyleSheet.hairlineWidth, borderColor: '#FDE68A', marginBottom: 10 }}>
            <Text style={{ color: '#92400E', fontWeight: '700' }}>Verify your email to unlock posting and ads. Tap to verify.</Text>
          </Pressable>
        ) : null)}
        renderItem={({ item, index }) => (
          <>
            {/* Card */}
            <Pressable
              style={styles.card}
              onPress={() => router.push({ pathname: '/(tabs)/feed/game/[id]', params: { id: String(item.id) } })}
            >
              <View style={styles.hero}>
                {(() => {
                  const banner = item.cover_image_url || (item as any).banner_url || null;
                  return banner ? (
                    <Image source={{ uri: banner }} style={styles.heroImage} contentFit="cover" />
                  ) : (
                    <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.heroImage} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                  );
                })()}
              </View>
              {item.date ? (
                <Text style={styles.cardDate}>{format(new Date(item.date), 'EEE, MMM d, yyyy')}</Text>
              ) : null}
              <Text style={styles.cardTitle}>{item.title ? String(item.title) : 'Game'}</Text>
              <Text style={styles.cardMeta}>{item.location ? String(item.location) : 'TBD'}</Text>
              <View style={styles.tagRow}>
                <View style={styles.tag}>
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color="#6b7280" />
                  <Text style={styles.tagText}>Reviews</Text>
                </View>
                <View style={styles.tag}>
                  <Ionicons name="camera-outline" size={14} color="#6b7280" />
                  <Text style={styles.tagText}>Photos & Videos</Text>
                </View>
              </View>
            </Pressable>
            {/* Sponsored card after the first item */}
            {false && index === 0 ? (
              <View style={styles.sponsored}>
                <Text style={styles.sponsoredBadge}>SPONSORED</Text>
                <Text style={[styles.cardTitle, { marginTop: 6 }]}>SportsCare Physical Therapy</Text>
                <Text style={styles.cardMeta}>Get back in the game faster · Now accepting new patients</Text>
              </View>
            ) : null}
            {/* Your ad slot */}
            {index === 0 ? (
              <Pressable style={{ padding: 16, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 2, borderStyle: 'dashed', borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' }} onPress={() => router.push('/submit-ad')}>
                <Text style={{ fontWeight: '800', fontSize: 18, marginBottom: 4 }}>Your Ad Here</Text>
                <Text style={styles.muted}>Click to submit a local ad</Text>
              </Pressable>
            ) : null}
          </>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListFooterComponent={
          posts.length > 0 ? (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.sectionTitle}>Latest Posts</Text>
              {posts.map((p, idx) => {
                const url = String(p.media_url || '');
                const isVideo = url ? /\.(mp4|mov|webm|m4v)$/i.test(url) : false;
                const isImage = url && !isVideo;
                const hasMedia = isImage || isVideo;
                const wrapperStyles = [styles.postMediaWrapper, isVideo ? styles.postMediaVideo : styles.postMediaImage];
                const createdAtLabel = p.created_at ? formatDistanceToNow(new Date(p.created_at), { addSuffix: true }) : null;
                return (
                  <Pressable key={`${p.id}-${idx}`} style={styles.postCard} onPress={() => router.push(`/post-detail?id=${p.id}`)}>
                    {p.title ? <Text style={styles.postTitle}>{p.title}</Text> : null}
                    {hasMedia ? (
                      <Pressable onPress={() => onMediaPress(String(p.id))} style={{ marginBottom: 8 }}>
                        <View style={wrapperStyles}>
                          {isImage ? (
                            <Image source={{ uri: url }} style={styles.postMediaContent} contentFit="cover" />
                          ) : (
                            <>
                              <LinearGradient
                                colors={['rgba(30,64,175,0.65)', 'rgba(15,23,42,0.95)']}
                                style={styles.postMediaBackdrop}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                              />
                              <VideoPlayer uri={url} style={styles.postMediaContent} />
                              <View style={styles.postPlayBadge}>
                                <Ionicons name="play" size={18} color="#fff" /><Text style={styles.postPlayLabel}>Tap to play</Text>
                              </View>
                            </>
                          )}
                          <Animated.View
                            pointerEvents="none"
                            style={[
                              styles.heartOverlay,
                              {
                                opacity: getHeartAnim(String(p.id)),
                                transform: [{ scale: getHeartAnim(String(p.id)).interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
                              },
                            ]}
                          >
                            <Ionicons name="arrow-up" size={72} color="#2563EB" />
                          </Animated.View>
                        </View>
                      </Pressable>
                    ) : null}
                    {p.content ? <Text style={styles.postContent} numberOfLines={3}>{p.content}</Text> : null}
                    {!hasMedia && url ? <Text style={styles.postLink}>Media: {url}</Text> : null}
                    {createdAtLabel ? <Text style={styles.postTimestamp}>{createdAtLabel}</Text> : null}
                    <View style={styles.countRow}>
                      <View style={styles.countChip}><Ionicons name="arrow-up" size={12} color="#2563EB" /><Text style={styles.countChipText}>{p.upvotes_count || 0}</Text></View>
                      <View style={styles.countChip}><Ionicons name="chatbubble-ellipses" size={12} color="#6b7280" /><Text style={styles.countChipText}>{(p as any)._count?.comments || 0}</Text></View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: 24 }}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReachedThreshold={0.5}
        onEndReached={loadMorePosts}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F8FAFC' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  center: { paddingVertical: 24, alignItems: 'center' },
  error: { color: '#b91c1c', marginBottom: 8 },
  muted: { color: '#6b7280' },
  helper: { color: '#6b7280', marginBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { fontSize: 28, fontWeight: '900' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#F3F4F6', marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, height: 44 },
  card: { padding: 14, borderRadius: 14, backgroundColor: 'white', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  hero: { height: 140, borderRadius: 12, backgroundColor: '#F1F5F9', marginBottom: 12, overflow: 'hidden' },
    heroImage: { width: '100%', height: '100%' },
  cardDate: { color: '#2563EB', fontWeight: '700', marginBottom: 4 },
  cardTitle: { fontWeight: '800', fontSize: 18, marginBottom: 2 },
  cardMeta: { color: '#6b7280' },
  tagRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F3F4F6' },
  tagText: { color: '#6b7280', fontWeight: '700', fontSize: 12 },
  sponsored: { padding: 14, borderRadius: 14, backgroundColor: '#F1F5F9', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E2E8F0' },
  sponsoredBadge: { color: '#6b7280', fontWeight: '800', fontSize: 10, letterSpacing: 1 },
  adSlot: { padding: 16, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 2, borderStyle: 'dashed', borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  adTitle: { fontWeight: '800', fontSize: 18, marginBottom: 4 },
  postCard: { padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', marginBottom: 10 },
  postTitle: { fontWeight: '700', marginBottom: 4 },
  postContent: { color: '#111827' },
  postLink: { color: '#2563EB', marginTop: 6 },
  postTimestamp: { color: '#6b7280', fontSize: 12, marginTop: 6, alignSelf: 'flex-end' },
  postMediaWrapper: { position: 'relative', borderRadius: 12, overflow: 'hidden', backgroundColor: '#0f172a', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(148,163,184,0.25)', shadowColor: '#0f172a', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  postMediaImage: { height: 180 },
  postMediaVideo: { height: 220 },
  postMediaContent: { ...StyleSheet.absoluteFillObject },
  postMediaBackdrop: { ...StyleSheet.absoluteFillObject },
  postPlayBadge: { position: 'absolute', right: 16, bottom: 16, backgroundColor: 'rgba(15,23,42,0.75)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  postPlayLabel: { color: '#fff', fontWeight: '700', fontSize: 12 },
  heartOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontWeight: '800', marginBottom: 8 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  countChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  countChipText: { color: '#111827', fontWeight: '700', fontSize: 12 },
});












