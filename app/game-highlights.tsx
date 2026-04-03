import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
// @ts-ignore
import { Post as PostApi } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { safeGoBack } from '@/utils/navigation';

function GameHighlightsScreen() {
  const { game_id } = useLocalSearchParams<{ game_id?: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!game_id) return;
    setLoading(true);
    setError(false);
    try {
      const page: any = await PostApi.filterPage({ game_id: String(game_id), type: 'highlight' }, null, 24);
      if (Array.isArray(page)) { setItems(page); setCursor(page.length ? String(page[page.length - 1].id) : null); }
      else { setItems(page?.items || []); setCursor(page?.nextCursor || null); }
    } catch {
      setError(true);
    } finally { setLoading(false); }
  }, [game_id]);

  useEffect(() => { void load(); }, [load]);

  const _loadMore = async () => {
    if (!game_id || !cursor) return;
    const page: any = await PostApi.filterPage({ game_id: String(game_id), type: 'highlight' }, cursor, 24);
    if (Array.isArray(page)) { setItems((arr) => arr.concat(page)); setCursor(page.length ? String(page[page.length - 1].id) : null); }
    else { setItems((arr) => arr.concat(page?.items || [])); setCursor(page?.nextCursor || null); }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ 
        title: 'Highlights',
        headerLeft: () => (
          <Pressable onPress={() => { safeGoBack(router); }} style={{ paddingLeft: 8 }}>
            <MaterialIcons name="chevron-left" size={24} color={theme.tint} />
          </Pressable>
        ),
      }} />
      {loading && <ActivityIndicator />}
      {error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <MaterialIcons name="error-outline" size={48} color={theme.mutedText} />
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginTop: 12 }}>
            Something went wrong
          </Text>
          <Pressable onPress={() => { setError(false); void load(); }} style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: theme.tint }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.id)}
          numColumns={3}
          renderItem={({ item: _item }) => (
            <Pressable
              onPress={() => void router.push(`/post-detail?id=${encodeURIComponent(String(_item.id))}`)}
              accessibilityRole="button"
              accessibilityLabel="View highlight"
            >
              <View style={styles.cellVideo}>
                <MaterialIcons name="play-arrow" size={22} color="#fff" />
              </View>
            </Pressable>
          )}
          onEndReached={_loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={!loading ? <Text style={[styles.muted, { color: theme.mutedText }]}>No highlights yet.</Text> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  cellVideo: { width: 110, height: 110, margin: 2, borderRadius: 8, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#6b7280', textAlign: 'center', marginTop: 16 },
});

export default GameHighlightsScreen;
