import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Stack } from 'expo-router';
import { httpGet } from '@/api/http';

export default function FollowedTeamsScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { (async () => {
    setLoading(true); setError(null);
    try { const rows = await httpGet('/follows/teams?user_id=me'); setItems(Array.isArray(rows) ? rows : []); }
    catch (e: any) { setError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  })(); }, []);
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Followed Teams' }} />
      <Text style={styles.title}>Followed Teams</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <Text style={styles.muted}>Loading…</Text> : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          renderItem={({ item }) => (
            <View style={styles.row}><Text style={styles.rowTitle}>{item.name}</Text><Text style={styles.mutedSmall}>{item.description || ''}</Text></View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={<Text style={styles.muted}>No followed teams yet.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  error: { color: '#b91c1c', marginBottom: 8 },
  muted: { color: '#6b7280' },
  mutedSmall: { color: '#9CA3AF', fontSize: 12 },
  row: { padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  rowTitle: { fontWeight: '600' },
});

