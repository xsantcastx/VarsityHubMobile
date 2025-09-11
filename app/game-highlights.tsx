import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, Pressable } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// @ts-ignore
import { Post as PostApi } from '@/api/entities';

export default function GameHighlightsScreen() {
  const { game_id } = useLocalSearchParams<{ game_id?: string }>();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!game_id) return;
    setLoading(true);
    try {
      const page: any = await PostApi.filterPage({ game_id: String(game_id), type: 'highlight' }, null, 24);
      if (Array.isArray(page)) { setItems(page); setCursor(page.length ? String(page[page.length - 1].id) : null); }
      else { setItems(page?.items || []); setCursor(page?.nextCursor || null); }
    } finally { setLoading(false); }
  }, [game_id]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (!game_id || !cursor) return;
    const page: any = await PostApi.filterPage({ game_id: String(game_id), type: 'highlight' }, cursor, 24);
    if (Array.isArray(page)) { setItems((arr) => arr.concat(page)); setCursor(page.length ? String(page[page.length - 1].id) : null); }
    else { setItems((arr) => arr.concat(page?.items || [])); setCursor(page?.nextCursor || null); }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Highlights' }} />
      {loading && <ActivityIndicator />}
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        numColumns={3}
        renderItem={({ item }) => (
          <Pressable>
            <View style={styles.cellVideo}>
              <Ionicons name="play" size={22} color="#fff" />
            </View>
          </Pressable>
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={!loading ? <Text style={styles.muted}>No highlights yet.</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  cellVideo: { width: 110, height: 110, margin: 2, borderRadius: 8, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#6b7280', textAlign: 'center', marginTop: 16 },
});

