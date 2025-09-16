import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { Stack } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
// @ts-ignore
import { Highlights, User } from '@/api/entities';
import { LinearGradient } from 'expo-linear-gradient';

function timeAgo(d: string | Date) {
  const ts = typeof d === 'string' ? new Date(d).getTime() : new Date(d).getTime();
  const diff = Math.max(0, Date.now() - ts) / 1000;
  const days = Math.floor(diff / 86400);
  if (days >= 30) return 'about 1 month ago';
  if (days >= 7) return `${Math.floor(days / 7)} weeks ago`;
  if (days >= 1) return `${days} days ago`;
  const hours = Math.floor(diff / 3600);
  if (hours >= 1) return `${hours} hours ago`;
  const mins = Math.floor(diff / 60);
  if (mins >= 1) return `${mins} minutes ago`;
  return 'just now';
}

export default function HighlightsScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [national, setNational] = useState<any[]>([]);
  const [ranked, setRanked] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const me: any = await User.me();
      const country = (me?.preferences?.country_code || 'US').toUpperCase();
      const { nationalTop, ranked } = await Highlights.fetch({ country });
      setNational(Array.isArray(nationalTop) ? nationalTop : []);
      setRanked(Array.isArray(ranked) ? ranked : []);
    } catch (e: any) {
      console.error('Highlights load failed', e);
      setError('Unable to load highlights.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={S.container}>
      <Stack.Screen options={{ title: 'Highlights' }} />
      <Text style={S.header}>Highlights</Text>
      <Text style={S.sub}>The most upvoted moments from across the nation.</Text>
      {loading && <View style={S.center}><ActivityIndicator /></View>}
      {error && !loading && <Text style={S.error}>{error}</Text>}
      {!loading && (
        <>
          <Text style={S.sectionTitle}>National Top 3</Text>
          {national.length === 0 && (
            <View style={S.card}><Text style={S.muted}>Be the first to post highlights in your country.</Text></View>
          )}
          {national.map((p, idx) => (
            <View key={p.id} style={S.card}>
              {/* Header */}
              <View style={S.headerRow}>
                <View style={S.avatar}><Text style={S.avatarText}>{String(p?.author?.display_name || 'A').charAt(0).toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={S.author}>{p?.author?.display_name || 'Anonymous'}</Text>
                  <Text style={S.meta}>{timeAgo(p.created_at)}</Text>
                </View>
              </View>
              {/* Badge */}
              <View style={S.rowBetween}>
                <Text style={S.postTitle}>{p.title || 'Highlight'}</Text>
                {idx === 0 ? (
                  <LinearGradient colors={["#F59E0B", "#F97316"]} start={{x:0,y:0}} end={{x:1,y:0}} style={S.badge1}>
                    <Text style={S.badgeText}>#1 TRENDING</Text>
                  </LinearGradient>
                ) : (
                  <View style={S.badge2}><Text style={S.badgeText}>#{idx+1} NATIONAL</Text></View>
                )}
              </View>
              {p.media_url ? <Image source={{ uri: p.media_url }} style={S.media} contentFit="cover" /> : null}
              <View style={S.footerRow}>
                <View style={S.metaRow}>
                  <Ionicons name="arrow-up" size={14} color="#111827" />
                  <Text style={S.meta}> {p.upvotes_count || 0}</Text>
                  <Ionicons name="chatbubble-ellipses" size={14} color="#6B7280" style={{ marginLeft: 12 }} />
                  <Text style={S.meta}> {p._count?.comments || 0}</Text>
                </View>
                <Ionicons name="bookmark-outline" size={18} color="#111827" />
              </View>
            </View>
          ))}

          <Text style={[S.sectionTitle, { marginTop: 12 }]}>Trending Near You</Text>
          <FlatList
            data={ranked}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <View style={S.card}>
                {/* Header */}
                <View style={S.headerRow}>
                  <View style={S.avatar}><Text style={S.avatarText}>{String(item?.author?.display_name || 'A').charAt(0).toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.author}>{item?.author?.display_name || 'Anonymous'}</Text>
                    <Text style={S.meta}>{timeAgo(item.created_at)}</Text>
                  </View>
                </View>
                {item.title ? <Text style={S.postTitle}>{item.title}</Text> : null}
                {item.media_url ? <Image source={{ uri: item.media_url }} style={S.media} contentFit="cover" /> : null}
                <View style={S.footerRow}>
                  <View style={S.metaRow}>
                    <Ionicons name="arrow-up" size={14} color="#111827" />
                    <Text style={S.meta}> {item.upvotes_count || 0}</Text>
                    <Ionicons name="chatbubble-ellipses" size={14} color="#6B7280" style={{ marginLeft: 12 }} />
                    <Text style={S.meta}> {item._count?.comments || 0}</Text>
                  </View>
                  <Ionicons name="bookmark-outline" size={18} color="#111827" />
                </View>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            contentContainerStyle={{ paddingVertical: 6, paddingBottom: 24 }}
          />
        </>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#FFFFFF' },
  header: { fontSize: 34, fontWeight: '800', marginBottom: 4, color: '#111827' },
  sub: { color: '#6B7280', marginBottom: 8, fontSize: 16 },
  center: { paddingVertical: 24, alignItems: 'center' },
  error: { color: '#b91c1c', marginBottom: 8 },
  muted: { color: '#6B7280' },
  sectionTitle: { fontWeight: '800', marginBottom: 6, color: '#111827' },
  card: { padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', marginVertical: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#111827', fontWeight: '800' },
  author: { color: '#111827', fontWeight: '800' },
  postTitle: { fontWeight: '800', fontSize: 22, marginBottom: 8, color: '#111827' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  meta: { color: '#6B7280', fontSize: 14 },
  media: { width: '100%', height: 180, borderRadius: 10, backgroundColor: '#E5E7EB' },
  badge1: { position: 'absolute', right: -8, top: -12, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  badge2: { position: 'absolute', right: -8, top: 16, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#2563EB' },
  badgeText: { color: 'white', fontWeight: '800', fontSize: 12 },
});

