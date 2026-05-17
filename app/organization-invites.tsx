import CustomActionModal from '@/components/CustomActionModal';
import { Button } from '@/components/ui/button';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { safeGoBack } from '@/utils/navigation';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Organization } from '@/api/entities';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Invite = {
  id: string;
  role?: string;
  organization?: { id: string; name?: string };
};

function OrganizationInvitesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [modal, setModal] = useState<null | { title: string; message?: string; options: any[] }>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await Organization.myInvites();
      const normalized = Array.isArray(list) ? (list as Invite[]) : [];
      const prioritized = params.id
        ? [...normalized].sort((a, b) => (a.id === params.id ? -1 : b.id === params.id ? 1 : 0))
        : normalized;
      setInvites(prioritized);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Unable to load invites');
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const highlightedInviteName = useMemo(
    () => invites.find(invite => invite.id === params.id)?.organization?.name,
    [invites, params.id]
  );

  const accept = async (id: string) => {
    if (processingId) return;
    setProcessingId(id);
    try {
      await Organization.acceptInvite(id);
      await refresh();
      setModal({
        title: 'Invite Accepted',
        message: 'You are now a member of the organization.',
        options: [{ label: 'OK', onPress: () => {}, color: '#2563eb' }],
      });
    } catch (err) {
      setModal({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to accept invite',
        options: [{ label: 'OK', onPress: () => {}, color: '#2563eb' }],
      });
    } finally {
      setProcessingId(null);
    }
  };

  const decline = async (id: string) => {
    if (processingId) return;
    setProcessingId(id);
    try {
      await Organization.declineInvite(id);
      await refresh();
    } catch (err) {
      setModal({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to decline invite',
        options: [{ label: 'OK', onPress: () => {}, color: '#2563eb' }],
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Organization Invites',
          headerShown: true,
          headerLeft: () => (
            <Pressable onPress={() => { safeGoBack(router); }} style={{ paddingRight: 8 }}>
              <MaterialIcons name="chevron-left" size={28} color={Colors[colorScheme].tint} />
            </Pressable>
          ),
        }}
      />
      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Organization Invites</Text>
      {highlightedInviteName ? (
        <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>
          Invitation for {highlightedInviteName}
        </Text>
      ) : null}
      {loading ? <View style={styles.loading}><ActivityIndicator color={Colors[colorScheme].tint} /></View> : null}
      {error && !loading ? <Text style={[styles.error, { color: colorScheme === 'dark' ? '#FCA5A5' : '#B91C1C' }]}>{error}</Text> : null}
      {!loading && invites.length === 0 ? (
        <Text style={[styles.muted, { color: Colors[colorScheme].mutedText }]}>No pending invites.</Text>
      ) : null}
      {!loading && invites.length > 0 ? (
        <FlatList
          data={invites}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: Colors[colorScheme].card,
                  borderColor: item.id === params.id ? Colors[colorScheme].tint : Colors[colorScheme].border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: Colors[colorScheme].text }]}>
                  {item.organization?.name || 'Organization'}
                </Text>
                <Text style={[styles.muted, { color: Colors[colorScheme].mutedText }]}>
                  Role: {item.role || 'member'}
                </Text>
              </View>
              <View style={styles.actions}>
                <Button size="sm" onPress={() => accept(item.id)} disabled={!!processingId}>
                  <Text>Accept</Text>
                </Button>
                <Button size="sm" variant="outline" onPress={() => decline(item.id)} disabled={!!processingId}>
                  <Text>Decline</Text>
                </Button>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      ) : null}
      {modal ? (
        <CustomActionModal
          visible={!!modal}
          title={modal.title}
          message={modal.message}
          options={modal.options}
          onClose={() => setModal(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  container: { flex: 1, padding: 16 },
  error: { color: '#b91c1c' },
  loading: { paddingVertical: 16 },
  muted: {},
  name: { fontWeight: '700' },
  subtitle: { marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
});

export default OrganizationInvitesScreen;
