import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
// @ts-ignore
import { Team as TeamApi } from '@/api/entities';

export default function ManageUsersScreen() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const list: any[] = await TeamApi.allMembers();
        if (!mounted) return;
        setRows(list);
      } catch (e: any) {
        if (!mounted) return; setError('Failed to load users');
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return rows.filter((u: any) => (u.user?.display_name || '').toLowerCase().includes(s) || (u.user?.email || '').toLowerCase().includes(s) || (u.team?.name || '').toLowerCase().includes(s));
  }, [q, rows]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Manage Users' }} />
      <Text style={styles.title}>Users</Text>
      <Input placeholder="Search name, email, or team" value={q} onChangeText={setQ} style={{ marginBottom: 10 }} />
      {loading && <View style={{ paddingVertical: 16 }}><ActivityIndicator /></View>}
      {error && !loading && <Text style={{ color: '#b91c1c' }}>{error}</Text>}
      <FlatList
        data={filtered}
        keyExtractor={(u) => String(u.id)}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.user?.display_name || item.user?.email || 'User'}</Text>
              <Text style={styles.muted}>{item.user?.email || ''}</Text>
            </View>
            <Badge>{item.role}</Badge>
            <Text style={[styles.team]}>{item.team?.name || ''}</Text>
            <Text style={[styles.status, (item.status || 'active') === 'active' ? styles.ok : styles.invited]}>{item.status}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  name: { fontWeight: '700' },
  muted: { color: '#6b7280' },
  team: { minWidth: 120, textAlign: 'right', color: '#111827', fontWeight: '600' },
  status: { minWidth: 64, textAlign: 'right', textTransform: 'capitalize', fontWeight: '700' },
  ok: { color: '#16a34a' },
  invited: { color: '#9CA3AF' },
});
