import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRequireCoach } from '@/hooks/useRequireCoach';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeGoBack } from '@/utils/navigation';
// @ts-ignore
import { httpGet, httpPost, httpPut } from '@/api/http';
// @ts-ignore
import { User } from '@/api/entities';

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
  const { isCoach, loading: coachLoading } = useRequireCoach();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const C = Colors[colorScheme];

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

  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ── Loaders ──────────────────────────────────────────────────────────────

  const loadEventsFailedRef = useRef(false);
  const loadInvitesFailedRef = useRef(false);
  const loadOrgFailedRef = useRef(false);

  const loadEvents = async () => {
    try {
      // Load both pending events AND pending games (fan pitches go to /games)
      const [eventsData, gamesData] = await Promise.all([
        httpGet('/events/pending').catch(() => []),
        httpGet('/games?show_pending=true&limit=50').catch(() => ({ games: [] })),
      ]);
      const pendingEvents = Array.isArray(eventsData)
        ? eventsData.filter((e: any) => e?.approval_status === 'pending')
        : [];
      const pendingGames = (gamesData?.games || [])
        .filter((g: any) => g?.approval_status === 'pending')
        .map((g: any) => ({
          ...g,
          _isGame: true, // Flag to use game approve endpoint
          event_type: g.event_type || 'game',
          creator: g.created_by ? { id: g.created_by_id, display_name: g.created_by_name } : undefined,
        }));
      setEvents([...pendingEvents, ...pendingGames]);
      loadEventsFailedRef.current = false;
    } catch (e: any) {
      if (__DEV__) console.warn('[Approvals] Events load failed:', e?.message);
      setEvents([]);
      loadEventsFailedRef.current = true;
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
      loadInvitesFailedRef.current = false;
    } catch (e: any) {
      if (__DEV__) console.warn('[Approvals] Team invites load failed:', e?.message);
      setTeamInvites([]);
      loadInvitesFailedRef.current = true;
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
      loadOrgFailedRef.current = false;
    } catch (e: any) {
      if (__DEV__) console.warn('[Approvals] Org join requests load failed:', e?.message);
      setOrgRequests([]);
      loadOrgFailedRef.current = true;
    } finally {
      setOrgRequestsLoading(false);
    }
  };

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const me = await User.me() as { preferences?: { role?: string }; approval_status?: string };
      const isApprovedCoach = me?.preferences?.role === 'coach' && me?.approval_status === 'APPROVED';
      if (!isApprovedCoach) return;
    } catch {
      return;
    }
    await Promise.allSettled([loadEvents(), loadTeamInvites(), loadOrgRequests()]);
    if (loadEventsFailedRef.current && loadInvitesFailedRef.current && loadOrgFailedRef.current) {
      setError('Failed to load approvals. Pull down to refresh.');
    }
  }, []);

  // Guard: redirect non-coaches
  useEffect(() => {
    void (async () => {
      try {
        const me = await User.me() as { preferences?: { role?: string }; approval_status?: string };
        const isApprovedCoach = me?.preferences?.role === 'coach' && me?.approval_status === 'APPROVED';
        if (!isApprovedCoach) {
          Alert.alert('Restricted', 'Only coach accounts can access Approvals.');
          safeGoBack(router);

        }
      } catch {
        // silently ignore — auth errors handled elsewhere
      }
    })();
  }, [router]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  useEffect(() => { void loadAll(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setEventsLoading(true);
    setInvitesLoading(true);
    setOrgRequestsLoading(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  // ── Event actions ─────────────────────────────────────────────────────────

  const handleApproveEvent = async (eventId: number) => {
    setProcessingEventId(eventId);
    try {
      const evt = events.find(e => e.id === eventId) as any;
      if (evt?._isGame) {
        await httpPut(`/games/${eventId}/approve`, {});
      } else {
        await httpPut(`/events/${eventId}/approve`, {});
      }
      Alert.alert('Approved', 'The event has been published.');
      setEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to approve event.');
    } finally {
      setProcessingEventId(null);
    }
  };

  const [rejectModal, setRejectModal] = useState<{ eventId: number } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleRejectEvent = (eventId: number) => {
    setRejectReason('');
    setRejectModal({ eventId });
  };

  const confirmRejectEvent = async () => {
    if (!rejectModal) return;
    const { eventId } = rejectModal;
    setRejectModal(null);
    setProcessingEventId(eventId);
    try {
      const evt = events.find(e => e.id === eventId) as any;
      if (evt?._isGame) {
        await httpPut(`/games/${eventId}/reject`, { reason: rejectReason.trim() || undefined });
      } else {
        await httpPut(`/events/${eventId}/reject`, { reason: rejectReason.trim() || undefined });
      }
      Alert.alert('Rejected', 'The event has been rejected.');
      setEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to reject event.');
    } finally {
      setProcessingEventId(null);
    }
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

  // ── Org join request actions ─────────────────────────────────────────────

  const [processingOrgRequestId, setProcessingOrgRequestId] = useState<string | null>(null);

  const handleApproveOrgRequest = async (requestId: string) => {
    setProcessingOrgRequestId(requestId);
    try {
      await httpPost(`/organizations/join-requests/${requestId}/approve`, {});
      Alert.alert('Approved', 'The request has been approved.');
      setOrgRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to approve request.');
    } finally {
      setProcessingOrgRequestId(null);
    }
  };

  const handleDenyOrgRequest = (requestId: string) => {
    Alert.prompt('Deny Request', 'Provide a reason (optional):', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deny',
        style: 'destructive',
        onPress: async (reason?: string) => {
          setProcessingOrgRequestId(requestId);
          try {
            await httpPost(`/organizations/join-requests/${requestId}/deny`, { reason: reason?.trim() || undefined });
            Alert.alert('Denied', 'The request has been denied.');
            setOrgRequests(prev => prev.filter(r => r.id !== requestId));
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to deny request.');
          } finally {
            setProcessingOrgRequestId(null);
          }
        },
      },
    ], 'plain-text');
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderSectionHeader = (
    title: string,
    icon: keyof typeof Ionicons.glyphMap,
    count: number,
    color: string,
    onAddPress?: () => void,
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
      {onAddPress ? (
        <Pressable onPress={onAddPress} style={[styles.addButton, { backgroundColor: color + '22' }]} hitSlop={8}>
          <Ionicons name="add" size={20} color={color} />
        </Pressable>
      ) : null}
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

  const renderOrgRequestCard = (item: OrgJoinRequest) => {
    const isProcessing = processingOrgRequestId === item.id;
    return (
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

        {item.message ? (
          <View style={styles.metaRow}>
            <Ionicons name="chatbubble-outline" size={14} color={C.mutedText} />
            <Text style={[styles.metaText, { color: C.mutedText }]}>{item.message}</Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.approveBtn, isProcessing && { opacity: 0.5 }]}
            onPress={() => handleApproveOrgRequest(item.id)}
            disabled={isProcessing}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#16A34A" />
            <Text style={[styles.btnText, { color: '#16A34A' }]}>Approve</Text>
          </Pressable>
          <Pressable
            style={[styles.rejectBtn, isProcessing && { opacity: 0.5 }]}
            onPress={() => handleDenyOrgRequest(item.id)}
            disabled={isProcessing}
          >
            <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
            <Text style={[styles.btnText, { color: '#DC2626' }]}>Deny</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const isLoading = eventsLoading || invitesLoading || orgRequestsLoading;
  const totalPending = events.length + teamInvites.length + orgRequests.length;

  // ── Render ────────────────────────────────────────────────────────────────

  if (coachLoading || !isCoach) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: C.background }]} edges={['bottom']}>
        <ActivityIndicator style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Approvals', headerShown: true, headerLeft: () => (
            <Pressable onPress={() => safeGoBack(router)} style={{ paddingRight: 8 }}>
              <Ionicons name="chevron-back" size={28} color="#007AFF" />
            </Pressable>
          ) }} />

      {error && !isLoading && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: '#ff4444', fontSize: 16, textAlign: 'center', marginBottom: 16 }}>{error}</Text>
          <TouchableOpacity onPress={() => { setError(null); setEventsLoading(true); setInvitesLoading(true); setOrgRequestsLoading(true); void loadAll(); }} style={{ backgroundColor: '#1e3a5f', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      {!error && isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.tint} />
        </View>
      ) : !error && (
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
          {renderSectionHeader('Roster Invites', 'people-outline', teamInvites.length, '#3B82F6', () => router.push('/my-team' as any))}
          {invitesLoading
            ? <ActivityIndicator style={styles.sectionLoader} color={C.tint} />
            : teamInvites.length === 0
              ? renderEmpty('No pending team invitations.')
              : teamInvites.map(renderInviteCard)
          }

          {/* ── Section 3: Authorized User Requests ── */}
          {renderSectionHeader('Authorized User Requests', 'shield-checkmark-outline', orgRequests.length, '#8B5CF6', () => router.push('/team-hub' as any))}
          {orgRequestsLoading
            ? <ActivityIndicator style={styles.sectionLoader} color={C.tint} />
            : orgRequests.length === 0
              ? renderEmpty('No pending organization requests.')
              : orgRequests.map(renderOrgRequestCard)
          }
        </ScrollView>
      )}
      {/* Reject Event Modal */}
      <Modal visible={!!rejectModal} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 24 }}>
          <View style={{ backgroundColor: colorScheme === 'dark' ? '#1F2937' : 'white', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 8 }}>Reject Event</Text>
            <Text style={{ color: C.mutedText, marginBottom: 12 }}>Provide a reason for rejection (optional):</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10, color: C.text, backgroundColor: colorScheme === 'dark' ? '#111827' : '#F9FAFB', minHeight: 60, textAlignVertical: 'top' }}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Reason (optional)..."
              placeholderTextColor={C.mutedText}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Pressable style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: C.border, alignItems: 'center' }} onPress={() => setRejectModal(null)}>
                <Text style={{ color: C.text, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#dc2626', alignItems: 'center' }} onPress={confirmRejectEvent}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Reject</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLoader: { marginVertical: 12 },

  // Cards
  card: {
    borderRadius: 12,
    borderWidth: 1,
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
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyText: { fontSize: 13 },
  globalEmpty: {
    borderWidth: 1,
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
