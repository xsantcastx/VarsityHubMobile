import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
// @ts-ignore
import { Post as PostApi } from '@/api/entities';
import { optimizeImageUrl } from '@/utils/imageUrl';
import { safeGoBack } from '@/utils/navigation';

function GamePhotosScreen() {
  const { game_id } = useLocalSearchParams<{ game_id?: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!game_id) return;
    setLoading(true);
    setError(false);
    try {
      const page: any = await PostApi.filterPage({ game_id: String(game_id), type: 'photo' }, null, 24);
      if (Array.isArray(page)) { setItems(page); setCursor(page.length ? String(page[page.length - 1].id) : null); }
      else { setItems(page?.items || []); setCursor(page?.nextCursor || null); }
    } catch {
      setError(true);
    } finally { setLoading(false); }
  }, [game_id]);

  useEffect(() => { void load(); }, [load]);

  const _loadMore = async () => {
    if (!game_id || !cursor) return;
    try {
      const page: any = await PostApi.filterPage({ game_id: String(game_id), type: 'photo' }, cursor, 24);
      if (Array.isArray(page)) { setItems((arr) => arr.concat(page)); setCursor(page.length ? String(page[page.length - 1].id) : null); }
      else { setItems((arr) => arr.concat(page?.items || [])); setCursor(page?.nextCursor || null); }
    } catch (e) {
      if (__DEV__) console.warn('[game-photos] Failed to load more:', e);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen options={{ title: 'Photos', headerShown: true, headerLeft: () => (
            <Pressable onPress={() => { safeGoBack(router); }} style={{ paddingRight: 8 }}>
              <MaterialIcons name="chevron-left" size={28} color="#007AFF" />
            </Pressable>
          ) }} />
      {loading && <ActivityIndicator color={Colors[colorScheme].tint} />}
      {error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <MaterialIcons name="error-outline" size={48} color={Colors[colorScheme].mutedText} />
          <Text style={{ color: Colors[colorScheme].text, fontSize: 16, fontWeight: '600', marginTop: 12 }}>
            Something went wrong
          </Text>
          <Pressable onPress={() => { setError(false); void load(); }} style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors[colorScheme].tint }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.id)}
          numColumns={3}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => void router.push(`/post-detail?id=${encodeURIComponent(String(item.id))}`)}
              accessibilityRole="button"
              accessibilityLabel="View photo"
            >
              <Image source={{ uri: optimizeImageUrl(String(item.media_url || ''), 400) || '' }} style={[styles.cell, { backgroundColor: Colors[colorScheme].surface }]} contentFit="cover" />
            </Pressable>
          )}
          onEndReached={_loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={!loading ? <Text style={{ color: Colors[colorScheme].mutedText, textAlign: 'center', marginTop: 16 }}>No photos yet</Text> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  cell: { width: 110, height: 110, margin: 2, borderRadius: 8 },
});
