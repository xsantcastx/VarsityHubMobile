import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
// @ts-ignore
import { Team as TeamApi } from '@/api/entities';

type Team = { id: string; name: string; members: number; status: 'active' | 'archived' };

export default function ManageTeamsScreen() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const list: any[] = await TeamApi.list();
        if (!mounted) return;
        setTeams(list.map((t: any) => ({ id: String(t.id), name: String(t.name || 'Team'), members: Number(t.members || 0), status: (t.status || 'active') as any })));
      } catch (e: any) {
        if (!mounted) return; setError('Failed to load teams');
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return teams.filter(t => t.name.toLowerCase().includes(s));
  }, [q, teams]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Manage Teams' }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={styles.title}>Teams</Text>
  <Button onPress={() => router.push('/create-team')} size="sm"><Text style={{ fontWeight: '700' }}>Create Team</Text></Button>
      </View>
      <Input placeholder="Search teams..." value={q} onChangeText={setQ} style={{ marginBottom: 10 }} />
      {loading && <View style={{ paddingVertical: 16 }}><ActivityIndicator /></View>}
      {error && !loading && <Text style={{ color: '#b91c1c' }}>{error}</Text>}
      <FlatList
        data={filtered}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/team-profile?id=${item.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.muted}>{item.members} members</Text>
            </View>
            <Text style={[styles.badge, item.status === 'active' ? styles.active : styles.archived]}>{item.status}</Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 20, fontWeight: '800' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  name: { fontWeight: '700' },
  muted: { color: '#6b7280' },
  badge: { textTransform: 'capitalize', fontWeight: '700' },
  active: { color: '#16a34a' },
  archived: { color: '#9CA3AF' },
});
