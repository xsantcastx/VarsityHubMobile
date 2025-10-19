import CustomActionModal from '@/components/CustomActionModal';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { Team as TeamApi } from '@/api/entities';
import { Button } from '@/components/ui/button';

type Invite = { id: string; role?: string; team?: { id: string; name?: string } };

export default function TeamInvitesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const [modal, setModal] = useState<null | { title: string; message?: string; options: any[] }>(null);
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

  const accept = async (id: string, teamId?: string) => {
    try { 
      await TeamApi.acceptInvite(id); 
      await load(); 
      // Show success and option to view team
      if (teamId) {
        setModal({
          title: 'Invite Accepted!',
          message: 'You have successfully joined the team. Would you like to view the team now?',
          options: [
            { label: 'Later', onPress: () => {}, color: '#6b7280' },
            { label: 'View Team', onPress: () => router.push(`/team-viewer?id=${teamId}`), color: '#2563eb' }
          ]
        });
      }
    } catch {
      setModal({
        title: 'Error',
        message: 'Failed to accept invite',
        options: [
          { label: 'OK', onPress: () => {}, color: '#2563eb' }
        ]
      });
    }
  };
  const decline = async (id: string) => {
    try {
      await TeamApi.declineInvite(id);
      await load();
    } catch {
      setModal({
        title: 'Error',
        message: 'Failed to decline invite',
        options: [
          { label: 'OK', onPress: () => {}, color: '#2563eb' }
        ]
      });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Team Invites' }} />
      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Team Invites</Text>
      {loading && <View style={{ paddingVertical: 16 }}><ActivityIndicator /></View>}
      {error && !loading && <Text style={styles.error}>{error}</Text>}
      {!loading && invites.length === 0 && <Text style={[styles.muted, { color: Colors[colorScheme].mutedText }]}>No pending invites.</Text>}
      {!loading && invites.length > 0 && (
        <FlatList
          data={invites}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: Colors[colorScheme].text }]}>{item.team?.name || 'Team'}</Text>
                <Text style={[styles.muted, { color: Colors[colorScheme].mutedText }]}>Role: {item.role || 'member'}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button size="sm" onPress={() => accept(item.id, item.team?.id)}><Text>Accept</Text></Button>
                <Button size="sm" variant="outline" onPress={() => decline(item.id)}><Text>Decline</Text></Button>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
      {modal && (
        <CustomActionModal
          visible={!!modal}
          title={modal.title}
          message={modal.message}
          options={modal.options}
          onClose={() => setModal(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  error: { color: '#b91c1c' },
  muted: {},
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  name: { fontWeight: '700' },
});

