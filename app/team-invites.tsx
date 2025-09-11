import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, Pressable, Alert } from 'react-native';
import { Stack } from 'expo-router';
// @ts-ignore
import { Team as TeamApi } from '@/api/entities';
import { Button } from '@/components/ui/button';

type Invite = { id: string; role?: string; team?: { id: string; name?: string } };

export default function TeamInvitesScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const list: any[] = await TeamApi.myInvites();
      setInvites(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError('Failed to load invites');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const accept = async (id: string) => {
    try { await TeamApi.acceptInvite(id); await load(); } catch { Alert.alert('Error', 'Failed to accept invite'); }
  };
  const decline = async (id: string) => {
    try { await TeamApi.declineInvite(id); await load(); } catch { Alert.alert('Error', 'Failed to decline invite'); }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Team Invites' }} />
      <Text style={styles.title}>Team Invites</Text>
      {loading && <View style={{ paddingVertical: 16 }}><ActivityIndicator /></View>}
      {error && !loading && <Text style={styles.error}>{error}</Text>}
      {!loading && invites.length === 0 && <Text style={styles.muted}>No pending invites.</Text>}
      {!loading && invites.length > 0 && (
        <FlatList
          data={invites}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.team?.name || 'Team'}</Text>
                <Text style={styles.muted}>Role: {item.role || 'member'}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button size="sm" onPress={() => accept(item.id)}>Accept</Button>
                <Button size="sm" variant="outline" onPress={() => decline(item.id)}>Decline</Button>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  error: { color: '#b91c1c' },
  muted: { color: '#6b7280' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  name: { fontWeight: '700' },
});

