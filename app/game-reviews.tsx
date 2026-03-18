import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
// @ts-ignore
import { Post as PostApi } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { safeGoBack } from '@/utils/navigation';

export default function GameReviewsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { game_id } = useLocalSearchParams<{ game_id?: string }>();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!game_id) return;
    setLoading(true);
    setError(false);
    try {
      const page: any = await PostApi.filterPage({ game_id: String(game_id), type: 'review' }, null, 20);
      if (Array.isArray(page)) { setItems(page); setCursor(page.length ? String(page[page.length - 1].id) : null); }
      else { setItems(page?.items || []); setCursor(page?.nextCursor || null); }
    } catch {
      setError(true);
    } finally { setLoading(false); }
  }, [game_id]);

  useEffect(() => { void load(); }, [load]);

  const _loadMore = async () => {
    if (!game_id || !cursor) return;
    const page: any = await PostApi.filterPage({ game_id: String(game_id), type: 'review' }, cursor, 20);
    if (Array.isArray(page)) { setItems((arr) => arr.concat(page)); setCursor(page.length ? String(page[page.length - 1].id) : null); }
    else { setItems((arr) => arr.concat(page?.items || [])); setCursor(page?.nextCursor || null); }
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen options={{ title: 'Reviews', headerShown: true, headerLeft: () => (
            <Pressable onPress={() => { safeGoBack(router); }} style={{ paddingRight: 8 }}>
              <MaterialIcons name="chevron-left" size={28} color="#007AFF" />
            </Pressable>
          ) }} />
      {loading && <ActivityIndicator />}
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
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
              {item.title ? <Text style={[styles.title, { color: Colors[colorScheme].text }]}>{String(item.title)}</Text> : null}
              {item.content ? <Text style={[styles.content, { color: Colors[colorScheme].text }]}>{String(item.content)}</Text> : <Text style={[styles.contentMuted, { color: Colors[colorScheme].mutedText }]}>No content</Text>}
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ padding: 12 }}
          onEndReached={_loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={!loading ? <Text style={[styles.muted, { color: Colors[colorScheme].mutedText }]}>No reviews yet.</Text> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { padding: 12, borderRadius: 12, borderWidth: 1 },
  title: { fontWeight: '700', marginBottom: 6 },
  content: {},
  contentMuted: {},
  muted: { textAlign: 'center', marginTop: 16 },
});

