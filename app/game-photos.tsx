import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, Pressable } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
// @ts-ignore
import { Post as PostApi } from '@/api/entities';

export default function GamePhotosScreen() {
  const { game_id } = useLocalSearchParams<{ game_id?: string }>();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!game_id) return;
    setLoading(true);
    try {
      const page: any = await PostApi.filterPage({ game_id: String(game_id), type: 'photo' }, null, 24);
      if (Array.isArray(page)) { setItems(page); setCursor(page.length ? String(page[page.length - 1].id) : null); }
      else { setItems(page?.items || []); setCursor(page?.nextCursor || null); }
    } finally { setLoading(false); }
  }, [game_id]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (!game_id || !cursor) return;
    const page: any = await PostApi.filterPage({ game_id: String(game_id), type: 'photo' }, cursor, 24);
    if (Array.isArray(page)) { setItems((arr) => arr.concat(page)); setCursor(page.length ? String(page[page.length - 1].id) : null); }
    else { setItems((arr) => arr.concat(page?.items || [])); setCursor(page?.nextCursor || null); }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Photos' }} />
      {loading && <ActivityIndicator />}
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        numColumns={3}
        renderItem={({ item }) => (
          <Pressable>
            <Image source={{ uri: String(item.media_url || '') }} style={styles.cell} contentFit="cover" />
          </Pressable>
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  cell: { width: 110, height: 110, margin: 2, borderRadius: 8, backgroundColor: '#E5E7EB' },
});

