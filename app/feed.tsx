import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, Pressable, Animated, Easing } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
// @ts-ignore JS exports
import { Game, Post as PostApi, User } from '@/api/entities';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Video } from 'expo-av';

type GameItem = { id: string; title?: string; date?: string; location?: string; cover_image_url?: string };
type PostItem = { id: string; title?: string; content?: string; media_url?: string; created_at?: string };

export default function FeedScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<GameItem[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const tapTsRef = useRef<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    let mounted = true;
      setLoading(true);
      setError(null);
      try {
        // Try to get current user (may throw if unauthenticated)
        try { await User.me(); } catch {}
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

  const likePost = useCallback(async (id: string) => {
    try {
      await PostApi.like(id);
      setPosts((arr) => arr.map((p) => (String(p.id) === String(id) ? { ...p, upvotes_count: (p.upvotes_count || 0) + 1 } : p)));
    } catch {}
  }, []);

  const onMediaPress = (id: string) => {
    const now = Date.now();
    const last = tapTsRef.current[id] || 0;
    if (now - last < 300) {
      likePost(String(id));
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
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'VarsityHub' }} />
      {/* Top bar with brand and messages quick link */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: '800' }}>VarsityHub</Text>
        <Pressable onPress={() => router.push('/messages')} style={{ padding: 8 }}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color="#111827" />
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
      <Input placeholder="Search by Zip Code..." value={query} onChangeText={setQuery} style={{ marginBottom: 12 }} />
      <Text style={[styles.muted, { marginBottom: 10 }]}>Showing upcoming and recent games in your area.</Text>

      {loading && (
        <View style={styles.center}> <ActivityIndicator /> </View>
      )}
      {!loading && filtered.length === 0 && !error && (
        <Text style={styles.muted}>No games found.</Text>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <>
            {/* Card */}
            <Pressable style={styles.card} onPress={() => router.push(`/game-detail?id=${item.id}`)}>
              {item.date ? (
                <Text style={styles.cardDate}>{format(new Date(item.date), 'EEE, MMM d, yyyy')}</Text>
              ) : null}
              <Text style={styles.cardTitle}>{item.title || 'Game'}</Text>
              <Text style={styles.cardMeta}>{item.location || 'TBD'}</Text>
              <View style={styles.tagRow}>
                <View style={styles.tag}>
                  <Ionicons name="star-outline" size={14} color="#6b7280" />
                  <Text style={styles.tagText}>Reviews</Text>
                </View>
                <View style={styles.tag}>
                  <Ionicons name="images-outline" size={14} color="#6b7280" />
                  <Text style={styles.tagText}>Photos & Videos</Text>
                </View>
              </View>
            </Pressable>
            {/* Sponsored card after the first item */}
            {index === 0 ? (
              <View style={styles.sponsored}>
                <Text style={styles.sponsoredBadge}>Sponsored</Text>
                <Text style={[styles.cardTitle, { marginTop: 6 }]}>SportsCare Physical Therapy</Text>
                <Text style={styles.cardMeta}>Get back in the game faster · Now accepting new patients</Text>
              </View>
            ) : null}
          </>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListFooterComponent={
          posts.length > 0 ? (
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontWeight: '800', marginBottom: 8 }}>Latest Posts</Text>
              {posts.map((p, idx) => {
                const url = String(p.media_url || '');
                const isVideo = url ? /\.(mp4|mov|webm|m4v)$/i.test(url) : false;
                const isImage = url && !isVideo; // default to image if present
                return (
                  <Pressable key={`${p.id}-${idx}`} style={styles.postCard} onPress={() => router.push(`/post-detail?id=${p.id}`)}>
                    {p.title ? <Text style={styles.postTitle}>{p.title}</Text> : null}
                    {isImage ? (
                      <Pressable onPress={() => onMediaPress(String(p.id))} style={{ marginBottom: 8 }}>
                        <View style={{ position: 'relative' }}>
                          <Image source={{ uri: url }} style={{ width: '100%', height: 160, borderRadius: 10, backgroundColor: '#E5E7EB' }} contentFit="cover" />
                          {/* Heart overlay */}
                          <Animated.View
                            pointerEvents="none"
                            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center',
                              opacity: getHeartAnim(String(p.id)),
                              transform: [{ scale: getHeartAnim(String(p.id)).interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
                            }}
                          >
                            <Ionicons name="heart" size={72} color="#ef4444" />
                          </Animated.View>
                        </View>
                      </Pressable>
                    ) : null}
                    {isVideo ? (
                      <Pressable onPress={() => onMediaPress(String(p.id))} style={{ marginBottom: 8 }}>
                        <View style={{ position: 'relative' }}>
                          <Video source={{ uri: url }} style={{ width: '100%', height: 200, borderRadius: 10, backgroundColor: '#111827' }} useNativeControls resizeMode="contain" />
                          <Animated.View
                            pointerEvents="none"
                            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center',
                              opacity: getHeartAnim(String(p.id)),
                              transform: [{ scale: getHeartAnim(String(p.id)).interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
                            }}
                          >
                            <Ionicons name="heart" size={72} color="#ef4444" />
                          </Animated.View>
                        </View>
                      </Pressable>
                    ) : null}
                    {p.content ? <Text style={styles.postContent} numberOfLines={3}>{p.content}</Text> : null}
                    {!isImage && !isVideo && url ? <Text style={styles.postLink}>Media: {url}</Text> : null}
                    <View style={styles.countRow}>
                      <View style={styles.countChip}><Ionicons name="heart" size={12} color="#ef4444" /><Text style={styles.countChipText}>{p.upvotes_count || 0}</Text></View>
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
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  center: { paddingVertical: 24, alignItems: 'center' },
  error: { color: '#b91c1c', marginBottom: 8 },
  muted: { color: '#6b7280' },
  card: { padding: 14, borderRadius: 14, backgroundColor: 'white', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  cardDate: { color: '#2563EB', fontWeight: '700', marginBottom: 4 },
  cardTitle: { fontWeight: '800', fontSize: 18, marginBottom: 2 },
  cardMeta: { color: '#6b7280' },
  tagRow: { flexDirection: 'row', gap: 16, marginTop: 10 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tagText: { color: '#6b7280', fontWeight: '600' },
  sponsored: { padding: 14, borderRadius: 14, backgroundColor: '#EEF2FF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DBEAFE' },
  postCard: { padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', marginBottom: 10 },
  postTitle: { fontWeight: '700', marginBottom: 4 },
  postContent: { color: '#111827' },
  postLink: { color: '#2563EB', marginTop: 6 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  countChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  countChipText: { color: '#111827', fontWeight: '700', fontSize: 12 },
});

