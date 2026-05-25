import CustomActionModal from '@/components/CustomActionModal';
import {
  InviteScreenShell,
  inviteScreenSharedStyles as sharedStyles,
} from '@/components/InviteScreenShared';
import { Button } from '@/components/ui/button';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { safeGoBack } from '@/utils/navigation';
import { Organization } from '@/api/entities';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';

type Invite = {
  id: string;
  role?: string;
  organization?: { id: string; name?: string };
};

function OrganizationInvitesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; fallback?: string }>();
  const explicitFallback =
    typeof params.fallback === 'string' && params.fallback.trim().startsWith('/')
      ? params.fallback.trim()
      : '/(tabs)/notifications/index';
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
    <InviteScreenShell
      title="Organization Invites"
      backgroundColor={Colors[colorScheme].background}
      textColor={Colors[colorScheme].text}
      onBack={() => {
        safeGoBack(router, explicitFallback);
      }}
      subtitle={highlightedInviteName ? (
        <Text style={[sharedStyles.subtitle, { color: Colors[colorScheme].mutedText }]}>
          Invitation for {highlightedInviteName}
        </Text>
      ) : null}
    >
      {loading ? <View style={sharedStyles.loading}><ActivityIndicator /></View> : null}
      {error && !loading ? <Text style={sharedStyles.error}>{error}</Text> : null}
      {!loading && invites.length === 0 ? (
        <Text style={[sharedStyles.muted, { color: Colors[colorScheme].mutedText }]}>No pending invites.</Text>
      ) : null}
      {!loading && invites.length > 0 ? (
        <FlatList
          data={invites}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              style={[
                sharedStyles.card,
                {
                  backgroundColor: Colors[colorScheme].card,
                  borderColor: item.id === params.id ? Colors[colorScheme].tint : Colors[colorScheme].border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[sharedStyles.name, { color: Colors[colorScheme].text }]}>
                  {item.organization?.name || 'Organization'}
                </Text>
                <Text style={[sharedStyles.muted, { color: Colors[colorScheme].mutedText }]}>
                  Role: {item.role || 'member'}
                </Text>
              </View>
              <View style={sharedStyles.actions}>
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
    </InviteScreenShell>
  );
}

export default OrganizationInvitesScreen;
