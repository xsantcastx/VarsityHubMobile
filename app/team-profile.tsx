import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
// @ts-ignore
import { Team as TeamApi } from '@/api/entities';

export default function TeamProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [team, setTeam] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const id = String(params?.id || '');
      if (!id) { setLoading(false); setError('Missing team id.'); return; }
      setLoading(true); setError(null);
      try {
        const [t, m] = await Promise.all([TeamApi.get(id), TeamApi.members(id)]);
        if (!mounted) return;
        setTeam(t);
        setMembers(Array.isArray(m) ? m : []);
      } catch (e: any) {
        if (!mounted) return; setError('Failed to load team');
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [params?.id]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Team Profile' }} />
      {loading && <View style={{ paddingVertical: 16 }}><ActivityIndicator /></View>}
      {error && !loading && <Text style={{ color: '#b91c1c' }}>{error}</Text>}
      {team && !loading && (
        <>
          <Text style={styles.title}>{team.name}</Text>
          {team.description ? <Text style={styles.muted}>{team.description}</Text> : null}

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Pressable style={styles.btn} onPress={() => router.push(`/team-contacts?id=${team.id}`)}><Text style={styles.btnText}>Contacts</Text></Pressable>
            <Pressable style={styles.btnOutline} onPress={() => router.push('/edit-team')}><Text style={styles.btnOutlineText}>Edit Team</Text></Pressable>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Members</Text>
          <FlatList
            data={members}
            keyExtractor={(m) => String(m.id)}
            renderItem={({ item }) => (
              <View style={styles.row}><Text style={styles.member}>{item.user?.display_name || item.user?.email || 'Member'}</Text><Text style={styles.muted}>{item.role}</Text></View>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            contentContainerStyle={{ paddingVertical: 8 }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 22, fontWeight: '800' },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  muted: { color: '#6b7280' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  member: { fontWeight: '700' },
  btn: { backgroundColor: '#111827', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  btnText: { color: 'white', fontWeight: '700' },
  btnOutline: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  btnOutlineText: { color: '#111827', fontWeight: '700' },
});
