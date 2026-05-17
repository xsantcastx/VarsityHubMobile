import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
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

import { User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getAuthSnapshot } from '@/utils/authState';
import { resolveMediaType, resolvePostMedia } from '@/utils/media';
import { safeGoBack } from '@/utils/navigation';

type SavedPost = {
  id: string;
  caption?: string | null;
  media_url?: string | null;
  preview_url?: string | null;
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

const mapSavedPost = (raw: any): SavedPost | null => {
  if (!raw) return null;
  const id = raw.id ?? raw.post_id;
  if (!id) return null;

  const mediaUrl = typeof raw.media_url === 'string' ? raw.media_url : null;
  const mediaType = resolveMediaType(raw.media_url, raw.media_type) ?? undefined;

  return {
    id: String(id),
    caption: raw.caption ?? raw.content ?? null,
    media_url: mediaUrl,
    preview_url: typeof raw.preview_url === 'string' ? raw.preview_url : null,
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

function FavoritesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const router = useRouter();
  const { user: authUser, checkAuth } = useAuth();

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
    void (async () => {
      try {
        const me: any = await getAuthSnapshot(checkAuth, authUser);
        if (canceled) return;
        const idValue = me?.id ?? me?.user_id;
        if (idValue) {
          setUserId(String(idValue));
        } else {
          setError('Unable to determine your account. Please sign in again.');
        }
      } catch (error) {
        if (__DEV__) console.error('[favorites] Failed to load user data:', error);
        if (!canceled) {
          setError('Unable to load your favorites right now.');
          setLoading(false);
        }
      }
    })();
    return () => {
      canceled = true;
    };
  }, [authUser, checkAuth]);

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
    void fetchSaved({ mode: 'initial' });
  }, [userId, fetchSaved]);

  const handleRefresh = useCallback(() => {
    if (!userId) return;
    void fetchSaved({ mode: 'refresh', cursor: null });
  }, [userId, fetchSaved]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingMore || !cursor) return;
    void fetchSaved({ cursor, mode: 'append' });
  }, [cursor, hasMore, loadingMore, fetchSaved]);

  const listEmptyComponent = useMemo(() => {
    if (loading) {
      return null;
    }
    return (
      <View style={styles.emptyState}>
        <MaterialIcons name="bookmark-border" size={40} color={palette.mutedText} />
        <Text style={[styles.emptyTitle, { color: palette.text }]}>No favorites yet</Text>
        <Text style={[styles.emptySubtitle, { color: palette.mutedText }]}>
          Save highlights, posts, or game recaps to revisit them here.
        </Text>
      </View>
    );
  }, [loading, palette.mutedText, palette.text]);

  const renderItem = useCallback(
    ({ item }: { item: SavedPost }) => {
      const media = resolvePostMedia(item);
      return (
        <Pressable
          style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
          onPress={() => void router.push(`/post-detail?id=${item.id}`)}
        >
          <View style={styles.media}>
            {media.displayImageUrl ? (
              <Image
                source={{ uri: media.displayImageUrl }}
                style={styles.thumbnail}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                <MaterialIcons
                  name={media.isVideo ? 'play-arrow' : 'image'}
                  size={28}
                  color={palette.mutedText}
                />
              </View>
            )}
            {media.isVideo ? (
              <View style={styles.playBadge}>
                <MaterialIcons name="play-arrow" size={14} color="#fff" />
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
                <MaterialIcons name="arrow-upward" size={14} color={palette.mutedText} />
                <Text style={[styles.statText, { color: palette.mutedText }]}>
                  {item.upvotes_count != null ? item.upvotes_count : 0}
                </Text>
              </View>
              <View style={styles.statRow}>
                <MaterialIcons name="chat-bubble" size={14} color={palette.mutedText} />
                <Text style={[styles.statText, { color: palette.mutedText }]}>
                  {item.comments_count != null ? item.comments_count : 0}
                </Text>
              </View>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={18} color={palette.mutedText} />
        </Pressable>
      );
    },
    [palette.border, palette.mutedText, palette.surface, palette.text, router],
  );

  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]} edges={['top', 'bottom']}>
        <Stack.Screen options={{
          title: 'Favorites',
          headerBackTitle: 'Back',
          headerShown: true,
          headerLeft: () => (
            <Pressable onPress={() => { safeGoBack(router); }} style={{ paddingRight: 8 }}>
              <MaterialIcons name="chevron-left" size={28} color="#007AFF" />
            </Pressable>
          ),
        }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={palette.tint} size="large" />
          <Text style={[styles.loadingText, { color: palette.mutedText }]}>Loading your saved posts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ 
        title: 'Favorites',
        headerBackTitle: 'Back',
        headerShown: true,
      }} />
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
    paddingTop: 2,
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
    borderWidth: 1,
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

export default FavoritesScreen;
