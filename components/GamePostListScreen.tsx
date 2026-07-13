import { Post as PostApi } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { safeGoBack } from '@/utils/navigation';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

type GamePostListScreenProps = {
  title: string;
  gameId?: string;
  postType: 'highlight' | 'photo' | 'review';
  pageSize: number;
  emptyText: string;
  renderItem: ({ item }: { item: any }) => React.ReactElement;
  numColumns?: number;
  itemSeparatorHeight?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function GamePostListScreen({
  title,
  gameId,
  postType,
  pageSize,
  emptyText,
  renderItem,
  numColumns,
  itemSeparatorHeight,
  contentContainerStyle,
}: GamePostListScreenProps) {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!gameId) {
      setError('Game ID is required.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const page: any = await PostApi.filterPage(
        { game_id: String(gameId), type: postType },
        null,
        pageSize
      );
      setItems(Array.isArray(page?.items) ? page.items : []);
      setCursor(page?.nextCursor ?? null);
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [gameId, pageSize, postType]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!gameId || !cursor) return;
    try {
      const page: any = await PostApi.filterPage(
        { game_id: String(gameId), type: postType },
        cursor,
        pageSize
      );
      setItems(current => current.concat(Array.isArray(page?.items) ? page.items : []));
      setCursor(page?.nextCursor ?? null);
    } catch (loadMoreError) {
      if (__DEV__) {
        console.warn(`[game-post-list] Failed to load more ${postType}:`, loadMoreError);
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title,
          headerShown: true,
          headerLeft: () => (
            <Pressable onPress={() => safeGoBack(router)} style={{ paddingRight: 8 }}>
              <MaterialIcons name="chevron-left" size={28} color="#007AFF" />
            </Pressable>
          ),
        }}
      />
      {loading ? <ActivityIndicator color={theme.tint} style={{ marginTop: 20 }} /> : null}
      {error ? (
        <View style={styles.errorState}>
          <MaterialIcons name="error-outline" size={48} color={theme.mutedText} />
          <Text style={[styles.errorTitle, { color: theme.text }]}>{error}</Text>
          <Pressable
            onPress={() => void load()}
            style={[styles.retryButton, { backgroundColor: theme.tint }]}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          numColumns={numColumns}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.5}
          contentContainerStyle={contentContainerStyle}
          ItemSeparatorComponent={
            itemSeparatorHeight ? () => <View style={{ height: itemSeparatorHeight }} /> : undefined
          }
          ListEmptyComponent={
            !loading ? (
              <Text style={[styles.emptyText, { color: theme.mutedText }]}>{emptyText}</Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 16,
  },
});
