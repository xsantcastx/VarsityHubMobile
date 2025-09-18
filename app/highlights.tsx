import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
// @ts-ignore legacy export shape
import { Highlights, User } from '@/api/entities';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FEATURE_HEIGHT = SCREEN_WIDTH * 0.62;

type HighlightItem = {
  id: string;
  title?: string | null;
  caption?: string | null;
  media_url?: string | null;
  upvotes_count?: number | null;
  created_at?: string | null;
  game_id?: string | null;
  author?: { display_name?: string | null; avatar_url?: string | null } | null;
  _count?: { comments?: number | null } | null;
};

type HighlightBuckets = {
  nationalTop?: HighlightItem[];
  ranked?: HighlightItem[];
};

const mapHighlightItem = (input: any): HighlightItem | null => {
  if (!input) return null;
  const idValue = input.id ?? input.post_id ?? input.highlight_id;
  if (!idValue) return null;
  return {
    id: String(idValue),
    title: input.title ?? input.caption ?? null,
    caption: input.caption ?? null,
    media_url: typeof input.media_url === 'string' ? input.media_url : null,
    upvotes_count: typeof input.upvotes_count === 'number' ? input.upvotes_count : null,
    created_at: typeof input.created_at === 'string' ? input.created_at : null,
    game_id: input.game_id ? String(input.game_id) : null,
    author: input.author ?? null,
    _count: input._count ?? null,
  };
};

const timeAgo = (value?: string | Date | null) => {
  if (!value) return '';
  const ts = typeof value === 'string' ? new Date(value).getTime() : new Date(value).getTime();
  const diff = Math.max(0, Date.now() - ts) / 1000;
  const days = Math.floor(diff / 86400);
  if (days >= 30) return 'about 1 month ago';
  if (days >= 7) return `${Math.floor(days / 7)} weeks ago`;
  if (days >= 1) return `${days} days ago`;
  const hours = Math.floor(diff / 3600);
  if (hours >= 1) return `${hours} hours ago`;
  const minutes = Math.floor(diff / 60);
  if (minutes >= 1) return `${minutes} minutes ago`;
  return 'just now';
};

const formatCount = (value?: number | null) => {
  if (!value) return '0';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(value);
};

const StatChip = ({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) => (
  <View style={styles.statChip}>
    <Ionicons name={icon} size={16} color="#2563EB" />
    <View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  </View>
);

const HighlightThumbnail = ({ item, onPress }: { item: HighlightItem; onPress: (item: HighlightItem) => void }) => (
  <Pressable style={styles.horizontalCard} onPress={() => onPress(item)} disabled={!item.game_id}>
    <View style={styles.horizontalMediaWrapper}>
      {item.media_url ? (
        <Image source={{ uri: item.media_url }} style={styles.horizontalMedia} contentFit="cover" />
      ) : (
        <LinearGradient colors={['#1f2937', '#0f172a']} style={styles.horizontalMedia} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      )}
      <LinearGradient colors={['rgba(15,23,42,0)', 'rgba(15,23,42,0.75)']} style={styles.horizontalOverlay} />
      <Text style={styles.horizontalTitle} numberOfLines={2}>{item.title || 'Highlight'}</Text>
    </View>
    <View style={styles.horizontalMetaRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="arrow-up" size={14} color="#2563EB" />
        <Text style={styles.horizontalMeta}>{formatCount(item.upvotes_count || 0)}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="chatbubble-ellipses" size={14} color="#6b7280" />
        <Text style={styles.horizontalMeta}>{formatCount(item._count?.comments || 0)}</Text>
      </View>
    </View>
  </Pressable>
);

const VerticalHighlightCard = ({ item, onPress }: { item: HighlightItem; onPress: (item: HighlightItem) => void }) => (
  <Pressable style={[styles.verticalCard, !item.game_id && styles.cardDisabled]} onPress={() => onPress(item)} disabled={!item.game_id}>
    <View style={styles.verticalHeader}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{String(item.author?.display_name || 'A').charAt(0).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.author}>{item.author?.display_name || 'Anonymous'}</Text>
        <Text style={styles.meta}>{timeAgo(item.created_at)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
    </View>
    {item.title ? <Text style={styles.verticalTitle}>{item.title}</Text> : null}
    <View style={styles.verticalMediaWrapper}>
      {item.media_url ? (
        <Image source={{ uri: item.media_url }} style={styles.verticalMedia} contentFit="cover" />
      ) : (
        <LinearGradient colors={['#1f2937', '#0f172a']} style={styles.verticalMedia} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      )}
      <LinearGradient colors={['rgba(15,23,42,0)', 'rgba(15,23,42,0.85)']} style={styles.verticalMediaOverlay} />
    </View>
    <View style={styles.verticalFooterRow}>
      <View style={styles.metaRow}>
        <Ionicons name="arrow-up" size={14} color="#2563EB" />
        <Text style={styles.meta}> {formatCount(item.upvotes_count || 0)}</Text>
        <Ionicons name="chatbubble-ellipses" size={14} color="#6B7280" style={{ marginLeft: 12 }} />
        <Text style={styles.meta}> {formatCount(item._count?.comments || 0)}</Text>
      </View>
      <Ionicons name="bookmark-outline" size={18} color="#111827" />
    </View>
  </Pressable>
);

export default function HighlightsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [national, setNational] = useState<HighlightItem[]>([]);
  const [ranked, setRanked] = useState<HighlightItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me: any = await User.me().catch(() => null);
      const country = (me?.preferences?.country_code || 'US').toUpperCase();
      const payload: HighlightBuckets = await Highlights.fetch({ country, limit: 40 });
      const mappedNational = Array.isArray(payload?.nationalTop)
        ? payload.nationalTop.map(mapHighlightItem).filter(Boolean) as HighlightItem[]
        : [];
      const mappedRanked = Array.isArray(payload?.ranked)
        ? payload.ranked.map(mapHighlightItem).filter(Boolean) as HighlightItem[]
        : [];
      setNational(mappedNational);
      setRanked(mappedRanked);
    } catch (e: any) {
      console.error('Highlights load failed', e);
      setError('Unable to load highlights.');
      setNational([]);
      setRanked([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  const handleHighlightPress = useCallback((item: HighlightItem) => {
    if (!item?.game_id) return;
    router.push({ pathname: '/(tabs)/feed/game/[id]', params: { id: String(item.game_id) } });
  }, [router]);

  const featuredHighlight = useMemo(() => {
    if (national.length) return national[0];
    if (ranked.length) return ranked[0];
    return null;
  }, [national, ranked]);

  const secondaryNational = useMemo(() => (
    national.length > 1 ? national.slice(1) : []
  ), [national]);

  const stats = useMemo(() => {
    const merged = [...national, ...ranked];
    if (!merged.length) {
      return {
        totalHighlights: 0,
        totalUpvotes: 0,
        totalComments: 0,
        uniqueGames: 0,
      };
    }
    const totalHighlights = merged.length;
    const totalUpvotes = merged.reduce((sum, item) => sum + (item.upvotes_count || 0), 0);
    const totalComments = merged.reduce((sum, item) => sum + (item._count?.comments || 0), 0);
    const uniqueGames = new Set(merged.map((item) => item.game_id || item.id)).size;
    return { totalHighlights, totalUpvotes, totalComments, uniqueGames };
  }, [national, ranked]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Highlights' }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}>
        <Text style={styles.header}>Highlights</Text>
        <Text style={styles.sub}>The most upvoted moments from across the nation.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading ? (
          <View style={[styles.center, { minHeight: 240 }]}>
            <ActivityIndicator color="#2563EB" />
          </View>
        ) : null}

        {!loading && featuredHighlight ? (
          <Pressable
            style={styles.featuredCard}
            onPress={() => handleHighlightPress(featuredHighlight)}
            disabled={!featuredHighlight.game_id}
          >
            {featuredHighlight.media_url ? (
              <Image source={{ uri: featuredHighlight.media_url }} style={styles.featuredMedia} contentFit="cover" />
            ) : (
              <LinearGradient colors={['#0f172a', '#0b1120']} style={styles.featuredMedia} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            )}
            <LinearGradient colors={['rgba(15,23,42,0.1)', 'rgba(15,23,42,0.85)']} style={styles.featuredOverlay} />
            <View style={styles.featuredContent}>
              <View style={styles.featuredBadge}>
                <Ionicons name="flame" size={18} color="#fff" />
                <Text style={styles.featuredBadgeText}>TOP PLAY</Text>
              </View>
              <Text style={styles.featuredTitle} numberOfLines={2}>{featuredHighlight.title || 'Highlight'}</Text>
              <View style={styles.featuredMetaRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="arrow-up" size={16} color="#fff" />
                  <Text style={styles.featuredMeta}>{formatCount(featuredHighlight.upvotes_count || 0)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
                  <Text style={styles.featuredMeta}>{formatCount(featuredHighlight._count?.comments || 0)}</Text>
                </View>
                <Text style={styles.featuredMeta}>{timeAgo(featuredHighlight.created_at)}</Text>
              </View>
            </View>
          </Pressable>
        ) : null}

        {!loading && (national.length || ranked.length) ? (
          <View style={styles.statsRow}>
            <StatChip icon="sparkles" label="Highlights" value={formatCount(stats.totalHighlights)} />
            <StatChip icon="arrow-up" label="Total Upvotes" value={formatCount(stats.totalUpvotes)} />
            <StatChip icon="chatbubble" label="Comments" value={formatCount(stats.totalComments)} />
            <StatChip icon="trophy" label="Games Featured" value={formatCount(stats.uniqueGames)} />
          </View>
        ) : null}

        {secondaryNational.length ? (
          <View style={{ marginTop: 24 }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>National Top Plays</Text>
              <View style={styles.sectionDivider} />
            </View>
            <FlatList
              data={secondaryNational}
              horizontal
              keyExtractor={(item) => `${item.id}`}
              renderItem={({ item }) => (
                <HighlightThumbnail item={item} onPress={handleHighlightPress} />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 6, paddingRight: 24 }}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
            />
          </View>
        ) : null}

        {ranked.length ? (
          <View style={{ marginTop: 32 }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Trending Near You</Text>
              <View style={styles.sectionDivider} />
            </View>
            {ranked.map((item) => (
              <VerticalHighlightCard key={item.id} item={item} onPress={handleHighlightPress} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, paddingBottom: 48 },
  header: { fontSize: 34, fontWeight: '800', marginBottom: 4, color: '#0f172a' },
  sub: { color: '#64748b', marginBottom: 16, fontSize: 16 },
  center: { paddingVertical: 24, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#b91c1c', marginBottom: 12 },
  featuredCard: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
    height: FEATURE_HEIGHT,
    marginBottom: 20,
    backgroundColor: '#0f172a',
  },
  featuredMedia: { ...StyleSheet.absoluteFillObject },
  featuredOverlay: { ...StyleSheet.absoluteFillObject },
  featuredContent: { position: 'absolute', left: 20, right: 20, bottom: 20, gap: 10 },
  featuredBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.85)',
  },
  featuredBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12, letterSpacing: 1 },
  featuredTitle: { color: '#fff', fontSize: 24, fontWeight: '800', lineHeight: 30 },
  featuredMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  featuredMeta: { color: '#e2e8f0', fontWeight: '600' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  statValue: { color: '#1e293b', fontWeight: '800', fontSize: 16 },
  statLabel: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  sectionTitle: { fontWeight: '800', fontSize: 20, color: '#111827' },
  sectionDivider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#E2E8F0' },
  horizontalCard: {
    width: SCREEN_WIDTH * 0.52,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  horizontalMediaWrapper: { position: 'relative', height: 150 },
  horizontalMedia: { ...StyleSheet.absoluteFillObject },
  horizontalOverlay: { ...StyleSheet.absoluteFillObject },
  horizontalTitle: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  horizontalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  horizontalMeta: { color: '#1f2937', fontWeight: '700' },
  verticalCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  cardDisabled: { opacity: 0.6 },
  verticalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#111827', fontWeight: '800' },
  author: { color: '#111827', fontWeight: '800' },
  meta: { color: '#6B7280', fontSize: 14 },
  verticalTitle: { fontWeight: '800', fontSize: 18, marginBottom: 12, color: '#0f172a' },
  verticalMediaWrapper: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#1f2937' },
  verticalMedia: { width: '100%', height: 200 },
  verticalMediaOverlay: { ...StyleSheet.absoluteFillObject },
  verticalFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  voteChip: { alignItems: 'flex-end', gap: 4 },
  voteChipBar: { flexDirection: 'row', borderRadius: 999, overflow: 'hidden', height: 28, width: 180, backgroundColor: '#e2e8f0' },
  voteChipSegmentA: { backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  voteChipSegmentB: { backgroundColor: '#A5B4FC', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  voteChipText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  voteChipHint: { color: '#64748b', fontSize: 11 },
});
