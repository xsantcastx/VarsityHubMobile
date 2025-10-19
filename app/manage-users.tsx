import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { Team as TeamApi } from '@/api/entities';

export default function ManageUsersScreen() {
  const colorScheme = useColorScheme() ?? 'light';
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
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Manage Users' }} />
      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Users</Text>
      <Input placeholder="Search name, email, or team" value={q} onChangeText={setQ} style={{ marginBottom: 10 }} />
      {loading && <View style={{ paddingVertical: 16 }}><ActivityIndicator /></View>}
      {error && !loading && <Text style={{ color: '#b91c1c' }}>{error}</Text>}
      <FlatList
        data={filtered}
        keyExtractor={(u) => String(u.id)}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: Colors[colorScheme].text }]}>{item.user?.display_name || item.user?.email || 'User'}</Text>
              <Text style={[styles.muted, { color: Colors[colorScheme].mutedText }]}>{item.user?.email || ''}</Text>
            </View>
            <Badge>{item.role}</Badge>
            <Text style={[styles.team, { color: Colors[colorScheme].text }]}>{item.team?.name || ''}</Text>
            <Text style={[styles.status, (item.status || 'active') === 'active' ? styles.ok : styles.invited]}>{item.status}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  name: { fontWeight: '700' },
  muted: {},
  team: { minWidth: 120, textAlign: 'right', fontWeight: '600' },
  status: { minWidth: 64, textAlign: 'right', textTransform: 'capitalize', fontWeight: '700' },
  ok: { color: '#16a34a' },
  invited: { color: '#9CA3AF' },
});
