import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { Stack } from 'expo-router';
// @ts-ignore
import { Team as TeamApi, User } from '@/api/entities';

export default function AdminTeamsScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      await User.me();
      const list = await TeamApi.list(''); // default list
      setTeams(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.status === 403 ? 'Access denied (admin only).' : (e?.message || 'Failed to load teams'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Admin · All Teams' }} />
      {loading ? <View style={{ padding: 24, alignItems: 'center' }}><ActivityIndicator /></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && (
        <FlatList
          data={teams}
          keyExtractor={(t) => String(t.id)}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.title}>{item.name}</Text>
              {item.description ? <Text style={styles.meta}>{item.description}</Text> : null}
              <Text style={styles.meta}>Members: {item.members}</Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  row: { padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  title: { fontWeight: '800', fontSize: 16 },
  meta: { color: '#6b7280' },
  error: { color: '#b91c1c', padding: 12 },
});

