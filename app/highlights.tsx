import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, Pressable, Animated, Easing } from 'react-native';
import { Stack } from 'expo-router';
import { Image } from 'expo-image';
import VideoPlayer from '@/components/VideoPlayer';
import { Ionicons } from '@expo/vector-icons';
// @ts-ignore JS exports
import { Post as PostApi, User } from '@/api/entities';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type PostItem = { id: string | number; title?: string; content?: string; media_url?: string; created_at?: string };
type FilterKind = 'all' | 'photos' | 'videos';

export default function HighlightsScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKind>('all');

  const tapTsRef = useRef<Record<string, number>>({});
  const heartAnims = useRef<Map<string, Animated.Value>>(new Map());
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
    ]).start();
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      try { await User.me(); } catch {}
      const list: any = await PostApi.list('-created_date', 30);
      const arr: PostItem[] = Array.isArray(list) ? list : (list?.items || []);
      setPosts(arr);
    } catch (e: any) {
      console.error('Highlights load failed', e);
      setError('Unable to load highlights.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const byQuery = (p: PostItem) => {
      if (!query) return true;
      const q = query.toLowerCase().trim();
      return (p.title || '').toLowerCase().includes(q) || (p.content || '').toLowerCase().includes(q);
    };
    const isVideo = (url: string) => /\.(mp4|mov|webm|m4v)$/i.test(url);
    const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
    return posts
      .filter((p) => !!p.media_url)
      .filter(byQuery)
      .filter((p) => {
        const url = String(p.media_url || '');
        if (filter === 'all') return true;
        if (filter === 'photos') return isImage(url) || (!!url && !isVideo(url));
        return isVideo(url);
      });
  }, [posts, query, filter]);

  const likePost = async (id: string | number) => {
    try { await PostApi.like(String(id)); } catch {}
  };
  const onMediaPress = (id: string | number) => {
    const key = String(id);
    const now = Date.now();
    const last = tapTsRef.current[key] || 0;
    if (now - last < 300) {
      likePost(key);
      triggerHeart(key);
    }
    tapTsRef.current[key] = now;
  };

  const renderItem = ({ item }: { item: PostItem }) => {
    const url = String(item.media_url || '');
    const isVid = /\.(mp4|mov|webm|m4v)$/i.test(url);
    const isImg = !!url && !isVid;
    return (
      <Pressable style={styles.card}>
        {item.title ? <Text style={styles.title}>{item.title}</Text> : null}
        {isImg ? (
          <Pressable onPress={() => onMediaPress(item.id)} style={{ marginBottom: 8 }}>
            <View style={{ position: 'relative' }}>
              <Image source={{ uri: url }} style={styles.mediaImg} contentFit="cover" />
              <Animated.View
                pointerEvents="none"
                style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center',
                  opacity: getHeartAnim(String(item.id)),
                  transform: [{ scale: getHeartAnim(String(item.id)).interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
                }}
              >
                <Ionicons name="heart" size={72} color="#ef4444" />
              </Animated.View>
            </View>
          </Pressable>
        ) : null}
        {isVid ? (
          <Pressable onPress={() => onMediaPress(item.id)} style={{ marginBottom: 8 }}>
            <View style={{ position: 'relative' }}>
              <VideoPlayer uri={url} style={styles.mediaVid} />
              <Animated.View
                pointerEvents="none"
                style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center',
                  opacity: getHeartAnim(String(item.id)),
                  transform: [{ scale: getHeartAnim(String(item.id)).interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
                }}
              >
                <Ionicons name="heart" size={72} color="#ef4444" />
              </Animated.View>
            </View>
          </Pressable>
        ) : null}
        {item.content ? <Text numberOfLines={3} style={styles.content}>{item.content}</Text> : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Highlights' }} />
      <Text style={styles.header}>Highlights</Text>
      <Input placeholder="Search highlights..." value={query} onChangeText={setQuery} style={{ marginBottom: 10 }} />
      <View style={styles.filterRow}>
        {(['all','photos','videos'] as FilterKind[]).map((k) => (
          <Pressable key={k} onPress={() => setFilter(k)} style={[styles.filterChip, filter === k && styles.filterChipActive]}>
            <Text style={[styles.filterText, filter === k && styles.filterTextActive]}>
              {k === 'all' ? 'All' : k === 'photos' ? 'Photos' : 'Videos'}
            </Text>
          </Pressable>
        ))}
        <Badge style={{ marginLeft: 'auto' }}>{String(filtered.length)}</Badge>
      </View>
      {loading && <View style={styles.center}><ActivityIndicator /></View>}
      {error && !loading && <Text style={styles.error}>{error}</Text>}
      {!loading && filtered.length === 0 && !error && (
        <Text style={styles.muted}>No highlights found.</Text>
      )}
      {!loading && filtered.length > 0 && (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={{ paddingVertical: 6, paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  header: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  center: { paddingVertical: 24, alignItems: 'center' },
  error: { color: '#b91c1c', marginBottom: 8 },
  muted: { color: '#6b7280' },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F3F4F6' },
  filterChipActive: { backgroundColor: '#111827' },
  filterText: { color: '#374151', fontWeight: '700' },
  filterTextActive: { color: 'white' },
  card: { padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  title: { fontWeight: '700', marginBottom: 6 },
  content: { color: '#111827' },
  mediaImg: { width: '100%', height: 200, borderRadius: 10, backgroundColor: '#E5E7EB' },
  mediaVid: { width: '100%', height: 220, borderRadius: 10, backgroundColor: '#111827' },
});
