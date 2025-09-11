import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
// @ts-ignore
import { Event as EventApi } from '@/api/entities';

type Item = { id: string; created_at?: string; event?: { id: string; title?: string; date?: string; location?: string } };

export default function RsvpHistoryScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const list: any[] = await EventApi.myRsvps();
        if (!mounted) return;
        setItems(Array.isArray(list) ? list : []);
      } catch (e: any) {
        if (!mounted) return; setError('Failed to load RSVP history');
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return items.filter((i) => i.event?.date && new Date(String(i.event.date)).getTime() >= now);
  }, [items]);
  const past = useMemo(() => {
    const now = Date.now();
    return items.filter((i) => i.event?.date && new Date(String(i.event.date)).getTime() < now);
  }, [items]);

  const renderItem = ({ item }: { item: Item }) => (
    <Pressable style={styles.card} onPress={() => item.event?.id && router.push(`/event-detail?id=${item.event.id}`)}>
      <Text style={styles.title}>{item.event?.title || 'Event'}</Text>
      <Text style={styles.muted}>{item.event?.location || 'TBD'}</Text>
      <Text style={styles.muted}>{item.event?.date ? new Date(String(item.event.date)).toLocaleString() : ''}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'RSVP History' }} />
      <Text style={styles.header}>Upcoming</Text>
      {loading && <View style={{ paddingVertical: 10 }}><ActivityIndicator /></View>}
      {error && !loading && <Text style={styles.error}>{error}</Text>}
      {!loading && upcoming.length === 0 && <Text style={styles.muted}>No upcoming RSVPs.</Text>}
      {!loading && upcoming.length > 0 && (
        <FlatList data={upcoming} keyExtractor={(i) => i.id} renderItem={renderItem} ItemSeparatorComponent={() => <View style={{ height: 8 }} />} />
      )}
      <Text style={[styles.header, { marginTop: 12 }]}>Past</Text>
      {!loading && past.length === 0 && <Text style={styles.muted}>No past RSVPs.</Text>}
      {!loading && past.length > 0 && (
        <FlatList data={past} keyExtractor={(i) => 'p-' + i.id} renderItem={renderItem} ItemSeparatorComponent={() => <View style={{ height: 8 }} />} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  header: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  error: { color: '#b91c1c' },
  muted: { color: '#6b7280' },
  card: { padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  title: { fontWeight: '700' },
});

