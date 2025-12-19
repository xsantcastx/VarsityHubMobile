import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
// @ts-ignore
import { Post as PostApi } from '@/api/entities';

export default function GameHighlightsScreen() {
  const { game_id } = useLocalSearchParams<{ game_id?: string }>();
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = useMemo(() => Colors[scheme], [scheme]);
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

  useEffect(() => { void load(); }, [load]);

  const _loadMore = async () => {
    if (!game_id || !cursor) return;
    const page: any = await PostApi.filterPage({ game_id: String(game_id), type: 'highlight' }, cursor, 24);
    if (Array.isArray(page)) { setItems((arr) => arr.concat(page)); setCursor(page.length ? String(page[page.length - 1].id) : null); }
    else { setItems((arr) => arr.concat(page?.items || [])); setCursor(page?.nextCursor || null); }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Stack.Screen options={{ 
        title: 'Highlights',
        headerLeft: () => (
          <Pressable onPress={() => router.back()} style={{ paddingLeft: 8 }}>
            <Ionicons name="chevron-back" size={24} color={palette.tint} />
          </Pressable>
        ),
      }} />
      {loading && <ActivityIndicator />}
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        numColumns={3}
        renderItem={({ item: _item }) => (
          <Pressable>
            <View style={[styles.cellVideo, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Ionicons name="play" size={22} color={palette.text} />
            </View>
          </Pressable>
        )}
        onEndReached={_loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={!loading ? <Text style={[styles.muted, { color: palette.mutedText }]}>No highlights yet.</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  cellVideo: { width: 110, height: 110, margin: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  muted: { textAlign: 'center', marginTop: 16 },
});
