import CustomActionModal from '@/components/CustomActionModal';
import {
  InviteScreenShell,
  inviteScreenSharedStyles as sharedStyles,
} from '@/components/InviteScreenShared';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
// @ts-ignore
import { Team as TeamApi } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { useTeamInvites } from '@/hooks/useTeamInvites';
import { safeGoBack } from '@/utils/navigation';
import { toUserMessage } from '@/utils/toUserMessage';

type Invite = { id: string; role?: string; team?: { id: string; name?: string } };

function TeamInvitesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; fallback?: string }>();
  const explicitFallback =
    typeof params.fallback === 'string' && params.fallback.trim().startsWith('/')
      ? params.fallback.trim()
      : '/(tabs)/notifications/index';
  const [modal, setModal] = useState<null | { title: string; message?: string; options: any[] }>(
    null
  );
  const { invites, loading, error: invitesError, refresh } = useTeamInvites<Invite>();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const prioritizedInvites = params.id
    ? [...invites].sort((a, b) => (a.id === params.id ? -1 : b.id === params.id ? 1 : 0))
    : invites;

  const accept = async (id: string, teamId?: string) => {
    if (processingId) return;
    setProcessingId(id);
    try {
      await TeamApi.acceptInvite(id);
      await refresh();
      // Show success and option to view team
      if (teamId) {
        setModal({
          title: 'Invite Accepted!',
          message: 'You have successfully joined the team. Would you like to view the team now?',
          options: [
            { label: 'Later', onPress: () => {}, color: Colors.light.mutedText },
            {
              label: 'View Team',
              onPress: () => router.push(`/team-page?id=${teamId}&from=program`),
              color: '#2563eb',
            },
          ],
        });
      }
    } catch (err) {
      setModal({
        title: 'Error',
        message: toUserMessage(err, 'Failed to accept invite'),
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
      await TeamApi.declineInvite(id);
      await refresh();
    } catch (err) {
      setModal({
        title: 'Error',
        message: toUserMessage(err, 'Failed to decline invite'),
        options: [{ label: 'OK', onPress: () => {}, color: '#2563eb' }],
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <InviteScreenShell
      title="Team Invites"
      backgroundColor={Colors[colorScheme].background}
      textColor={Colors[colorScheme].text}
      onBack={() => {
        safeGoBack(router, explicitFallback);
      }}
      subtitle={
        params.id && prioritizedInvites.some(invite => invite.id === params.id) ? (
          <Text
            style={[sharedStyles.muted, { color: Colors[colorScheme].mutedText, marginBottom: 8 }]}
          >
            Your emailed invitation is at the top of the list.
          </Text>
        ) : null
      }
    >
      {loading && (
        <View style={sharedStyles.loading}>
          <ActivityIndicator />
        </View>
      )}
      {invitesError && !loading && <Text style={sharedStyles.error}>{invitesError}</Text>}
      {!loading && invites.length === 0 && (
        <Text style={[sharedStyles.muted, { color: Colors[colorScheme].mutedText }]}>
          No pending invites.
        </Text>
      )}
      {!loading && prioritizedInvites.length > 0 && (
        <FlatList
          data={prioritizedInvites}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <View
              style={[
                sharedStyles.card,
                {
                  backgroundColor: Colors[colorScheme].card,
                  borderColor: Colors[colorScheme].border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[sharedStyles.name, { color: Colors[colorScheme].text }]}>
                  {item.team?.name || 'Team'}
                </Text>
                <Text style={[sharedStyles.muted, { color: Colors[colorScheme].mutedText }]}>
                  Role: {item.role || 'member'}
                </Text>
              </View>
              <View style={sharedStyles.actions}>
                <Button
                  size="sm"
                  onPress={() => accept(item.id, item.team?.id)}
                  disabled={!!processingId}
                >
                  <Text>Accept</Text>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => decline(item.id)}
                  disabled={!!processingId}
                >
                  <Text>Decline</Text>
                </Button>
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
    </InviteScreenShell>
  );
}

export default TeamInvitesScreen;
