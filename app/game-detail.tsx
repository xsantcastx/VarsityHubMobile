import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Share } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
// @ts-ignore JS exports
import { Game } from '@/api/entities';

type GameItem = { id: string; title?: string; date?: string; location?: string; description?: string };

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameItem | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!id) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      try {
        const data: any = await (Game.get ? Game.get(id as string) : Game.filter({ id }).then((r: any[]) => r?.[0]));
        if (!mounted) return;
        setGame(data ?? null);
      } catch (e: any) {
        if (!mounted) return;
        console.error('Failed to load game detail', e);
        setError('Unable to load game.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [id]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Game Detail' }} />
      {!id && <Text style={styles.error}>Missing game id.</Text>}
      {loading && (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator />
        </View>
      )}
      {error && !loading && <Text style={styles.error}>{error}</Text>}
      {game && !loading && (
        <View style={{ gap: 8 }}>
          <Text style={styles.title}>{game.title || 'Game'}</Text>
          <Text style={styles.meta}>{game.location || 'TBD'}</Text>
          <Text style={styles.meta}>{game.date ? new Date(game.date).toLocaleString() : ''}</Text>
          {game.description ? <Text>{game.description}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Pressable style={styles.outlineBtn} onPress={async () => { try { await Share.share({ message: game.title || 'Game' }); } catch {} }}>
              <Text style={styles.outlineBtnText}>Share</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 22, fontWeight: '800' },
  meta: { color: '#6b7280' },
  error: { color: '#b91c1c' },
  outlineBtn: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#D1D5DB', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  outlineBtnText: { color: '#111827', fontWeight: '700' },
});
