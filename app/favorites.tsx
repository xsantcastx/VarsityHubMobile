import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type SavedPost = {
  id: string;
  caption?: string | null;
  media_url?: string | null;
  media_type?: 'image' | 'video';
  created_at?: string | null;
  author?: {
    id: string;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
  upvotes_count?: number;
  comments_count?: number;
};

const VIDEO_EXT = /\.(mp4|mov|webm|m4v|avi)$/i;

const mapSavedPost = (raw: any): SavedPost | null => {
  if (!raw) return null;
  const id = raw.id ?? raw.post_id;
  if (!id) return null;

  const mediaUrl = typeof raw.media_url === 'string' ? raw.media_url : null;
  const mediaType =
    typeof raw.media_type === 'string'
      ? (raw.media_type as 'image' | 'video')
      : mediaUrl && VIDEO_EXT.test(mediaUrl)
      ? 'video'
      : mediaUrl
      ? 'image'
      : undefined;

  return {
    id: String(id),
    caption: raw.caption ?? raw.content ?? null,
    media_url: mediaUrl,
    media_type: mediaType,
    created_at: typeof raw.created_at === 'string' ? raw.created_at : null,
    author: raw.author
      ? {
          id: String(raw.author.id ?? ''),
          display_name: raw.author.display_name ?? null,
          avatar_url: raw.author.avatar_url ?? null,
        }
      : null,
    upvotes_count: typeof raw.upvotes_count === 'number' ? raw.upvotes_count : undefined,
    comments_count: typeof raw.comments_count === 'number' ? raw.comments_count : undefined,
  };
};

export default function FavoritesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<SavedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const me: any = await User.me();
        if (canceled) return;
        const idValue = me?.id ?? me?.user_id;
        if (idValue) {
          setUserId(String(idValue));
        } else {
          setError('Unable to determine your account. Please sign in again.');
        }
      } catch (e) {
        if (!canceled) {
          setError('Unable to load your favorites right now.');
          setLoading(false);
        }
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const fetchSaved = useCallback(
    async ({ cursor: cursorArg, mode }: { cursor?: string | null; mode?: 'append' | 'refresh' | 'initial' } = {}) => {
      if (!userId) return;
      const fetchMode = mode ?? 'initial';
      if (fetchMode === 'append') {
        setLoadingMore(true);
      } else if (fetchMode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const result: any = await User.interactionsForProfile(userId, {
          type: 'save',
          limit: 20,
          cursor: cursorArg || undefined,
          sort: 'newest',
        });
        const mapped = Array.isArray(result?.items)
          ? (result.items.map(mapSavedPost).filter(Boolean) as SavedPost[])
          : [];
        if (fetchMode === 'append') {
          setItems((prev) => {
            const existingIds = new Set(prev.map((item) => item.id));
            const next = mapped.filter((item) => !existingIds.has(item.id));
            return prev.concat(next);
          });
        } else {
          setItems(mapped);
        }
        const nextCursor =
          typeof result?.nextCursor === 'string' && result.nextCursor.length > 0 ? result.nextCursor : null;
        setCursor(nextCursor);
        setHasMore(Boolean(nextCursor));
        setError(null);
      } catch (e: any) {
        const message =
          typeof e?.message === 'string' && e.message.length
            ? e.message
            : 'Unable to load your saved posts. Pull to refresh to try again.';
        setError(message);
        if (mode !== 'append') {
          setItems([]);
        }
      } finally {
        if (fetchMode === 'append') {
          setLoadingMore(false);
        } else if (fetchMode === 'refresh') {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) return;
    fetchSaved({ mode: 'initial' });
  }, [userId, fetchSaved]);

  const handleRefresh = useCallback(() => {
    if (!userId) return;
    fetchSaved({ mode: 'refresh', cursor: null });
  }, [userId, fetchSaved]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingMore || !cursor) return;
    fetchSaved({ cursor, mode: 'append' });
  }, [cursor, hasMore, loadingMore, fetchSaved]);

  const listEmptyComponent = useMemo(() => {
    if (loading) {
      return null;
    }
    return (
      <View style={styles.emptyState}>
        <Ionicons name="bookmark-outline" size={40} color={palette.mutedText} />
        <Text style={[styles.emptyTitle, { color: palette.text }]}>No favorites yet</Text>
        <Text style={[styles.emptySubtitle, { color: palette.mutedText }]}>
          Save highlights, posts, or game recaps to revisit them here.
        </Text>
      </View>
    );
  }, [loading, palette.mutedText, palette.text]);

  const renderItem = useCallback(
    ({ item }: { item: SavedPost }) => (
      <Pressable
        style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
        onPress={() => router.push(`/post-detail?id=${item.id}`)}
      >
        <View style={styles.media}>
          {item.media_url ? (
            <Image source={{ uri: item.media_url }} style={styles.thumbnail} contentFit="cover" />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
              <Ionicons name="image-outline" size={28} color={palette.mutedText} />
            </View>
          )}
          {item.media_type === 'video' ? (
            <View style={styles.playBadge}>
              <Ionicons name="play" size={14} color="#fff" />
            </View>
          ) : null}
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={2}>
            {item.caption || 'Saved highlight'}
          </Text>
          {item.author?.display_name ? (
            <Text style={[styles.cardMeta, { color: palette.mutedText }]} numberOfLines={1}>
              by {item.author.display_name}
            </Text>
          ) : null}
          <View style={styles.cardStats}>
            <View style={styles.statRow}>
              <Ionicons name="arrow-up" size={14} color={palette.mutedText} />
              <Text style={[styles.statText, { color: palette.mutedText }]}>
                {item.upvotes_count != null ? item.upvotes_count : 0}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Ionicons name="chatbubble-ellipses" size={14} color={palette.mutedText} />
              <Text style={[styles.statText, { color: palette.mutedText }]}>
                {item.comments_count != null ? item.comments_count : 0}
              </Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={palette.mutedText} />
      </Pressable>
    ),
    [palette.border, palette.mutedText, palette.surface, palette.text, router],
  );

  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]} edges={['top', 'bottom']}>
        <Stack.Screen options={{ title: 'Favorites' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={palette.tint} size="large" />
          <Text style={[styles.loadingText, { color: palette.mutedText }]}>Loading your saved posts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Favorites' }} />
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>Favorites</Text>
        <Text style={[styles.subtitle, { color: palette.mutedText }]}>
          Highlights and posts you saved for later.
        </Text>
      </View>
      {error ? <Text style={[styles.error, { color: '#DC2626' }]}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={items.length === 0 ? styles.listEmpty : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.tint} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={listEmptyComponent}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color={palette.tint} />
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    paddingHorizontal: 16,
    marginBottom: 8,
    fontSize: 13,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  listEmpty: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  media: {
    position: 'relative',
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  playBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardMeta: {
    fontSize: 13,
  },
  cardStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 14,
  },
  footerLoading: {
    paddingVertical: 16,
  },
});
