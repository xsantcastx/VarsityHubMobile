import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User } from '@/api/entities';
// @ts-ignore
import { httpGet, httpPost, httpPut } from '@/api/http';

// ─── Types ────────────────────────────────────────────────────────────────────

type PendingEvent = {
  id: number;
  title: string;
  description?: string;
  event_type: string;
  location: string;
  date: string;
  linked_league?: string;
  max_attendees?: number;
  creator?: { id: number; display_name: string };
};

type TeamInvite = {
  id: string;
  role: string;
  created_at: string;
  team: { id: string; name: string };
};

type OrgJoinRequest = {
  id: string;
  status: string;
  message?: string;
  created_at: string;
  organization: { id: string; name: string };
};

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  game: '🏈 Game',
  watch_party: '📺 Watch Party',
  fundraiser: '💰 Fundraiser',
  tryout: '🏃 Tryout',
  bbq: '🍔 BBQ',
  other: '📌 Other',
};

const ROLE_LABELS: Record<string, string> = {
  coach: 'Coach',
  manager: 'Manager',
  assistant_coach: 'Asst. Coach',
  player: 'Player',
  staff: 'Staff',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventApprovalsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const C = Colors[colorScheme];
  const [accessResolved, setAccessResolved] = useState(false);
  const [hasCoachAccess, setHasCoachAccess] = useState(false);

  // Section 1 — Pitched Events
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [processingEventId, setProcessingEventId] = useState<number | null>(null);

  // Section 2 — Roster Invites
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);

  // Section 3 — Org Join Requests
  const [orgRequests, setOrgRequests] = useState<OrgJoinRequest[]>([]);
  const [orgRequestsLoading, setOrgRequestsLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const me: any = await User.me();
        const isCoach = me?.preferences?.role === 'coach';
        if (!mounted) return;
        if (!isCoach) {
          Alert.alert('Access Restricted', 'Only coach accounts can review approvals.');
          router.replace('/(tabs)' as any);
          return;
        }
        setHasCoachAccess(true);
      } catch {
        if (!mounted) return;
        router.replace('/(tabs)' as any);
      } finally {
        if (mounted) setAccessResolved(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  // ── Loaders ──────────────────────────────────────────────────────────────

  const loadEvents = async () => {
    try {
      const data = await httpGet('/events/pending');
      const pending = Array.isArray(data)
        ? data.filter((e: any) => e?.approval_status === 'pending')
        : [];
      setEvents(pending);
    } catch (e: any) {
      console.warn('[Approvals] Events load failed:', e?.message);
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  const loadTeamInvites = async () => {
    try {
      const data = await httpGet('/teams/invites/me');
      const pending = Array.isArray(data)
        ? data.filter((inv: any) => inv?.status === 'pending')
        : [];
      setTeamInvites(pending);
    } catch (e: any) {
      console.warn('[Approvals] Team invites load failed:', e?.message);
      setTeamInvites([]);
    } finally {
      setInvitesLoading(false);
    }
  };

  const loadOrgRequests = async () => {
    try {
      const data = await httpGet('/organizations/join-requests/me');
      const pending = Array.isArray(data)
        ? data.filter((r: any) => r?.status === 'pending')
        : [];
      setOrgRequests(pending);
    } catch (e: any) {
      console.warn('[Approvals] Org join requests load failed:', e?.message);
      setOrgRequests([]);
    } finally {
      setOrgRequestsLoading(false);
    }
  };

  const loadAll = useCallback(async () => {
    await Promise.allSettled([loadEvents(), loadTeamInvites(), loadOrgRequests()]);
  }, []);

  useEffect(() => {
    if (!hasCoachAccess) return;
    void loadAll();
  }, [hasCoachAccess, loadAll]);

  const onRefresh = useCallback(async () => {
    if (!hasCoachAccess) return;
    setRefreshing(true);
    setEventsLoading(true);
    setInvitesLoading(true);
    setOrgRequestsLoading(true);
    await loadAll();
    setRefreshing(false);
  }, [hasCoachAccess, loadAll]);

  // ── Event actions ─────────────────────────────────────────────────────────

  const handleApproveEvent = async (eventId: number) => {
    setProcessingEventId(eventId);
    try {
      await httpPut(`/events/${eventId}/approve`, {});
      Alert.alert('Approved', 'The event has been published.');
      setEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to approve event.');
    } finally {
      setProcessingEventId(null);
    }
  };

  const handleRejectEvent = (eventId: number) => {
    Alert.alert('Reject Event', 'Are you sure you want to reject this event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setProcessingEventId(eventId);
          try {
            await httpPut(`/events/${eventId}/reject`, {});
            Alert.alert('Rejected', 'The event has been rejected.');
            setEvents(prev => prev.filter(e => e.id !== eventId));
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to reject event.');
          } finally {
            setProcessingEventId(null);
          }
        },
      },
    ]);
  };

  // ── Team invite actions ───────────────────────────────────────────────────

  const handleAcceptInvite = async (inviteId: string) => {
    setProcessingInviteId(inviteId);
    try {
      await httpPost(`/teams/invites/${inviteId}/accept`);
      Alert.alert('Accepted', 'You have joined the team.');
      setTeamInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to accept invite.');
    } finally {
      setProcessingInviteId(null);
    }
  };

  const handleDeclineInvite = (inviteId: string) => {
    Alert.alert('Decline Invite', 'Are you sure you want to decline this invitation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setProcessingInviteId(inviteId);
          try {
            await httpPost(`/teams/invites/${inviteId}/decline`);
            setTeamInvites(prev => prev.filter(i => i.id !== inviteId));
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to decline invite.');
          } finally {
            setProcessingInviteId(null);
          }
        },
      },
    ]);
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderSectionHeader = (
    title: string,
    icon: keyof typeof Ionicons.glyphMap,
    count: number,
    color: string,
  ) => (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIconWrap, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.sectionTitle, { color: C.text }]}>{title}</Text>
      {count > 0 && (
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
    </View>
  );

  const renderEmpty = (message: string) => (
    <View style={[styles.emptyRow, { borderColor: C.border }]}>
      <Text style={[styles.emptyText, { color: C.mutedText }]}>{message}</Text>
    </View>
  );

  const renderEventCard = (item: PendingEvent) => {
    const isProcessing = processingEventId === item.id;
    return (
      <View key={item.id} style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={styles.cardRow}>
          <Text style={[styles.typeChip, { color: C.tint }]}>
            {EVENT_TYPE_LABELS[item.event_type] || item.event_type}
          </Text>
          <Text style={[styles.metaText, { color: C.mutedText }]}>
            {new Date(item.date).toLocaleDateString()}
          </Text>
        </View>

        <Text style={[styles.cardTitle, { color: C.text }]}>{item.title}</Text>

        {item.description ? (
          <Text style={[styles.cardDesc, { color: C.mutedText }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        <View style={styles.cardMeta}>
          {item.location ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color={C.mutedText} />
              <Text style={[styles.metaText, { color: C.mutedText }]}>{item.location}</Text>
            </View>
          ) : null}
          {item.creator ? (
            <View style={styles.metaRow}>
              <Ionicons name="person-outline" size={14} color={C.mutedText} />
              <Text style={[styles.metaText, { color: C.mutedText }]}>
                {item.creator.display_name}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.btn, styles.approveBtn, isProcessing && styles.btnDisabled]}
            onPress={() => handleApproveEvent(item.id)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#10B981" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
                <Text style={[styles.btnText, { color: '#10B981' }]}>Approve</Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={[styles.btn, styles.rejectBtn, isProcessing && styles.btnDisabled]}
            onPress={() => handleRejectEvent(item.id)}
            disabled={isProcessing}
          >
            <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
            <Text style={[styles.btnText, { color: '#DC2626' }]}>Reject</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderInviteCard = (item: TeamInvite) => {
    const isProcessing = processingInviteId === item.id;
    return (
      <View key={item.id} style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={styles.cardRow}>
          <Text style={[styles.typeChip, { color: '#3B82F6' }]}>
            {ROLE_LABELS[item.role] ?? item.role}
          </Text>
          <Text style={[styles.metaText, { color: C.mutedText }]}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>

        <Text style={[styles.cardTitle, { color: C.text }]}>{item.team.name}</Text>

        <View style={styles.metaRow}>
          <Ionicons name="people-outline" size={14} color={C.mutedText} />
          <Text style={[styles.metaText, { color: C.mutedText }]}>
            Invited to join as {ROLE_LABELS[item.role] ?? item.role}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.btn, styles.approveBtn, isProcessing && styles.btnDisabled]}
            onPress={() => handleAcceptInvite(item.id)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#10B981" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
                <Text style={[styles.btnText, { color: '#10B981' }]}>Accept</Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={[styles.btn, styles.rejectBtn, isProcessing && styles.btnDisabled]}
            onPress={() => handleDeclineInvite(item.id)}
            disabled={isProcessing}
          >
            <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
            <Text style={[styles.btnText, { color: '#DC2626' }]}>Decline</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderOrgRequestCard = (item: OrgJoinRequest) => (
    <View key={item.id} style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={styles.cardRow}>
        <View style={[styles.statusChip, { backgroundColor: '#F59E0B22' }]}>
          <Text style={[styles.typeChip, { color: '#F59E0B' }]}>Pending Review</Text>
        </View>
        <Text style={[styles.metaText, { color: C.mutedText }]}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>

      <Text style={[styles.cardTitle, { color: C.text }]}>{item.organization.name}</Text>

      <View style={styles.metaRow}>
        <Ionicons name="time-outline" size={14} color={C.mutedText} />
        <Text style={[styles.metaText, { color: C.mutedText }]}>
          Awaiting organization admin approval
        </Text>
      </View>
    </View>
  );

  const isLoading = eventsLoading || invitesLoading || orgRequestsLoading;
  const totalPending = events.length + teamInvites.length + orgRequests.length;

  // ── Render ────────────────────────────────────────────────────────────────

  if (!accessResolved || !hasCoachAccess) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: C.background }]} edges={['bottom']}>
        <View style={styles.accessLoadingContainer}>
          <ActivityIndicator size="large" color={C.tint} />
          <Text style={[styles.accessLoadingText, { color: C.mutedText }]}>Checking access...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Approvals', headerShown: true }} />

      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.tint} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.tint} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Empty state */}
          {totalPending === 0 && (
            <View style={[styles.globalEmpty, { borderColor: C.border }]}>
              <Ionicons name="checkmark-done-circle-outline" size={40} color={C.mutedText} />
              <Text style={[styles.globalEmptyTitle, { color: C.text }]}>All caught up</Text>
              <Text style={[styles.globalEmptyText, { color: C.mutedText }]}>
                No pending approvals right now.
              </Text>
            </View>
          )}

          {/* ── Section 1: Pitched Events ── */}
          {renderSectionHeader('Pitched Events', 'calendar-outline', events.length, '#F59E0B')}
          {eventsLoading
            ? <ActivityIndicator style={styles.sectionLoader} color={C.tint} />
            : events.length === 0
              ? renderEmpty('No pending event submissions.')
              : events.map(renderEventCard)
          }

          {/* ── Section 2: Roster Invites ── */}
          {renderSectionHeader('Roster Invites', 'people-outline', teamInvites.length, '#3B82F6')}
          {invitesLoading
            ? <ActivityIndicator style={styles.sectionLoader} color={C.tint} />
            : teamInvites.length === 0
              ? renderEmpty('No pending team invitations.')
              : teamInvites.map(renderInviteCard)
          }

          {/* ── Section 3: Authorized User Requests ── */}
          {renderSectionHeader('Authorized User Requests', 'shield-checkmark-outline', orgRequests.length, '#8B5CF6')}
          {orgRequestsLoading
            ? <ActivityIndicator style={styles.sectionLoader} color={C.tint} />
            : orgRequests.length === 0
              ? renderEmpty('No pending organization requests.')
              : orgRequests.map(renderOrgRequestCard)
          }
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  accessLoadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  accessLoadingText: { fontSize: 15, fontWeight: '600' },
  scrollContent: { padding: 16, gap: 8, paddingBottom: 32 },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  sectionLoader: { marginVertical: 12 },

  // Cards
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8,
    marginBottom: 8,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeChip: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  statusChip: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  cardMeta: { gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 13 },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  approveBtn: { borderColor: '#10B981' },
  rejectBtn: { borderColor: '#DC2626' },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontSize: 14, fontWeight: '700' },

  // Empty states
  emptyRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyText: { fontSize: 13 },
  globalEmpty: {
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  globalEmptyTitle: { fontSize: 17, fontWeight: '700' },
  globalEmptyText: { fontSize: 14, textAlign: 'center' },
});
