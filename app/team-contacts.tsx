import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
// @ts-ignore
import { Team as TeamApi } from '@/api/entities';

export default function TeamContactsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!id) { setError('Missing team id'); setLoading(false); return; }
      setLoading(true); setError(null);
      try {
        const m = await TeamApi.members(String(id));
        if (!mounted) return;
        setContacts(Array.isArray(m) ? m : []);
      } catch (e: any) {
        if (!mounted) return; setError('Failed to load contacts');
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [id]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Team Contacts' }} />
      <Text style={styles.title}>Contacts</Text>
      {loading && <Text style={styles.muted}>Loading…</Text>}
      {error && !loading && <Text style={{ color: '#b91c1c' }}>{error}</Text>}
      {!loading && (
        <FlatList
          data={contacts}
          keyExtractor={(c) => String(c.id)}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.user?.display_name || item.user?.email || 'Member'}</Text>
                <Text style={styles.muted}>{item.role}</Text>
              </View>
              <View style={{ minWidth: 220 }}>
                <Text style={styles.muted}>{item.user?.email || '—'}</Text>
                <Text style={styles.muted}>{'—'}</Text>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  name: { fontWeight: '700' },
  muted: { color: '#6b7280' },
});
