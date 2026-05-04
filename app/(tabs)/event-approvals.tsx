import { Colors } from '@/constants/Colors';
import CoachAccessRedirecting from '@/components/CoachAccessRedirecting';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRequireCoach } from '@/hooks/useRequireCoach';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
import { captureBreadcrumb } from '@/utils/sentry';
import { analytics, ANALYTICS_EVENTS } from '@/utils/analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

type PendingEvent = {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  location: string;
  date: string;
  linked_league?: string;
  max_attendees?: number;
  creator?: { id: string; display_name: string; username?: string; avatar_url?: string };
  _isGame?: boolean;
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

type ApprovalError = {
  isSessionExpired?: boolean;
  status?: number;
  message?: string;
  data?: {
    error?: string;
    message?: string;
  };
  response?: {
    status?: number;
    data?: {
      error?: string;
      message?: string;
    };
  };
};

type RawPendingEvent = PendingEvent & {
  approval_status?: string;
};

type RawPendingGame = PendingEvent & {
  approval_status?: string;
  created_by?: boolean;
  created_by_id?: string;
  created_by_name?: string;
};

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

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
  const { canAccessCoachTools, loading: coachLoading } = useRequireCoach();
  const router = useRouter();
  const params = useLocalSearchParams<{
    event_id?: string;
    action?: 'approve' | 'reject';
    review_kind?: 'event' | 'game';
  }>();
  const colorScheme = useColorScheme() ?? 'light';
  const C = Colors[colorScheme];

  // Section 1 — Pitched Events
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [processingEventId, setProcessingEventId] = useState<string | null>(null);

  // Section 2 — Roster Invites
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);

  // Section 3 — Org Join Requests
  const [orgRequests, setOrgRequests] = useState<OrgJoinRequest[]>([]);
  const [orgRequestsLoading, setOrgRequestsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const lastHandledLinkRef = useRef<string | null>(null);

  const isSessionExpiryError = (err: ApprovalError) => {
    const status = err?.status || err?.response?.status;
    const serverData = err?.data || err?.response?.data;
    const message = String(serverData?.error || serverData?.message || err?.message || '').toLowerCase();
    return err?.isSessionExpired === true || (status === 401 && message.includes('session expired'));
  };

  // ── Loaders ──────────────────────────────────────────────────────────────

  const loadEventsFailedRef = useRef(false);
  const loadInvitesFailedRef = useRef(false);
  const loadOrgFailedRef = useRef(false);

  const loadEvents = useCallback(async () => {
    try {
      // Load both pending events AND pending games (fan pitches go to /games)
      const [eventsData, gamesData] = await Promise.all([
        httpGet('/events/pending').catch(() => []),
        httpGet('/games?show_pending=true&limit=50').catch(() => ({ games: [] })),
      ]);
      const pendingEvents = asArray<RawPendingEvent>(eventsData)
        .filter((event) => event?.approval_status === 'pending');
      const pendingGames = asArray<RawPendingGame>((gamesData as { games?: unknown })?.games)
        .filter((game) => game?.approval_status === 'pending')
        .map((game) => ({
          ...game,
          _isGame: true, // Flag to use game approve endpoint
          event_type: game.event_type || 'game',
          creator: game.created_by
            ? { id: game.created_by_id || '', display_name: game.created_by_name || 'Unknown' }
            : undefined,
        }));
      setEvents([...pendingEvents, ...pendingGames]);
      loadEventsFailedRef.current = false;
    } catch (error: unknown) {
      const e = error as ApprovalError;
      if (__DEV__) console.warn('[Approvals] Events load failed:', e?.message);
      setEvents([]);
      loadEventsFailedRef.current = true;
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const loadTeamInvites = useCallback(async () => {
    try {
      const data = await httpGet('/teams/invites/me');
      const pending = asArray<TeamInvite & { status?: string }>(data)
        .filter((invite) => invite?.status === 'pending');
      setTeamInvites(pending);
      loadInvitesFailedRef.current = false;
    } catch (error: unknown) {
      const e = error as ApprovalError;
      if (__DEV__) console.warn('[Approvals] Team invites load failed:', e?.message);
      setTeamInvites([]);
      loadInvitesFailedRef.current = true;
    } finally {
      setInvitesLoading(false);
    }
  }, []);

  const loadOrgRequests = useCallback(async () => {
    try {
      const data = await httpGet('/organizations/join-requests/me');
      // Show all requests (pending, approved, denied) as read-only status view
      const requests = asArray<OrgJoinRequest>(data);
      setOrgRequests(requests);
      loadOrgFailedRef.current = false;
    } catch (error: unknown) {
      const e = error as ApprovalError;
      if (__DEV__) console.warn('[Approvals] Org join requests load failed:', e?.message);
      setOrgRequests([]);
      loadOrgFailedRef.current = true;
    } finally {
      setOrgRequestsLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setError(null);
    // Team invites (Section 2) and org join request status (Section 3) are always loaded.
    // Pitched events (Section 1) require full coach-tool access, matching requireOnboarded.
    const loaders: Promise<void>[] = [loadTeamInvites(), loadOrgRequests()];
    if (canAccessCoachTools) {
      loaders.push(loadEvents());
    } else {
      setEvents([]);
      setEventsLoading(false);
    }
    await Promise.allSettled(loaders);
    if (
      loadInvitesFailedRef.current &&
      loadOrgFailedRef.current &&
      (!canAccessCoachTools || loadEventsFailedRef.current)
    ) {
      setError('Failed to load approvals. Pull down to refresh.');
    }
  }, [canAccessCoachTools, loadEvents, loadOrgRequests, loadTeamInvites]);

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

  const handleApproveEvent = useCallback(async (eventId: string) => {
    setProcessingEventId(eventId);
    const evt = events.find(event => event.id === eventId);
    captureBreadcrumb('Event approval started', 'admin.approval', {
      action: 'approve',
      actor: 'coach_tools',
      event_id: eventId,
      is_game: !!evt?._isGame,
    });
    try {
      if (evt?._isGame) {
        await httpPut(`/games/${eventId}/approve`, { approval_status: 'approved' });
      } else {
        await httpPut(`/events/${eventId}/approve`, {});
      }
      captureBreadcrumb('Event approval succeeded', 'admin.approval', {
        action: 'approve',
        actor: 'coach_tools',
        event_id: eventId,
        is_game: !!evt?._isGame,
      });
      analytics.track(ANALYTICS_EVENTS.COACH_APPROVED, {
        approval_type: 'event',
        event_id: eventId,
        is_game: !!evt?._isGame,
      });
      Alert.alert('Approved', 'The event has been published.');
      setEvents(prev => prev.filter(event => event.id !== eventId));
    } catch (error: unknown) {
      const e = error as ApprovalError;
      if (isSessionExpiryError(e)) {
        return;
      }
      captureBreadcrumb('Event approval failed', 'admin.approval', {
        action: 'approve',
        actor: 'coach_tools',
        event_id: eventId,
        is_game: !!evt?._isGame,
        error: e?.message || 'unknown_error',
      }, 'error');
      Alert.alert('Error', e?.message || 'Failed to approve event.');
    } finally {
      setProcessingEventId(null);
    }
  }, [events]);

  const [rejectModal, setRejectModal] = useState<{ eventId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleRejectEvent = useCallback((eventId: string) => {
    setRejectReason('');
    setRejectModal({ eventId });
  }, []);

  const confirmRejectEvent = useCallback(async () => {
    if (!rejectModal) return;
    const { eventId } = rejectModal;
    setRejectModal(null);
    setProcessingEventId(eventId);
    const evt = events.find(event => event.id === eventId);
    captureBreadcrumb('Event rejection started', 'admin.approval', {
      action: 'reject',
      actor: 'coach_tools',
      event_id: eventId,
      is_game: !!evt?._isGame,
      has_reason: rejectReason.trim().length > 0,
    });
    try {
      if (evt?._isGame) {
        // Games use the same approve endpoint with approval_status: 'rejected'
        await httpPut(`/games/${eventId}/approve`, { approval_status: 'rejected', reason: rejectReason.trim() || undefined });
      } else {
        await httpPut(`/events/${eventId}/reject`, { reason: rejectReason.trim() || undefined });
      }
      captureBreadcrumb('Event rejection succeeded', 'admin.approval', {
        action: 'reject',
        actor: 'coach_tools',
        event_id: eventId,
        is_game: !!evt?._isGame,
      });
      Alert.alert('Rejected', 'The event has been rejected.');
      setEvents(prev => prev.filter(event => event.id !== eventId));
    } catch (error: unknown) {
      const e = error as ApprovalError;
      if (isSessionExpiryError(e)) {
        return;
      }
      captureBreadcrumb('Event rejection failed', 'admin.approval', {
        action: 'reject',
        actor: 'coach_tools',
        event_id: eventId,
        is_game: !!evt?._isGame,
        error: e?.message || 'unknown_error',
      }, 'error');
      Alert.alert('Error', e?.message || 'Failed to reject event.');
    } finally {
      setProcessingEventId(null);
    }
  }, [events, rejectModal, rejectReason]);

  useEffect(() => {
    const eventId = String(params.event_id || '').trim();
    const action = params.action === 'approve' || params.action === 'reject' ? params.action : null;
    const reviewKind = params.review_kind === 'game' || params.review_kind === 'event'
      ? params.review_kind
      : null;

    if (!canAccessCoachTools || events.length === 0 || !eventId || !action) return;

    const signature = `${reviewKind ?? ''}|${eventId}|${action}`;
    if (lastHandledLinkRef.current === signature) return;

    const matchedEvent = events.find((item) => {
      if (item.id !== eventId) return false;
      if (reviewKind === 'game') return item._isGame === true;
      if (reviewKind === 'event') return item._isGame !== true;
      return true;
    });
    if (!matchedEvent) return;

    lastHandledLinkRef.current = signature;
    if (action === 'approve') {
      void handleApproveEvent(matchedEvent.id);
      return;
    }
    handleRejectEvent(matchedEvent.id);
  }, [canAccessCoachTools, events, handleApproveEvent, handleRejectEvent, params.action, params.event_id, params.review_kind]);

  // ── Team invite actions ───────────────────────────────────────────────────

  const handleAcceptInvite = async (inviteId: string) => {
    setProcessingInviteId(inviteId);
    try {
      await httpPost(`/teams/invites/${inviteId}/accept`);
      Alert.alert('Accepted', 'You have joined the team.');
      setTeamInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch (error: unknown) {
      const e = error as ApprovalError;
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
          } catch (error: unknown) {
            const e = error as ApprovalError;
            Alert.alert('Error', e?.message || 'Failed to decline invite.');
          } finally {
            setProcessingInviteId(null);
          }
        },
      },
    ]);
  };

  // ── Org join request actions ─────────────────────────────────────────────

  // Note: Section 3 is read-only (user's own requests). Approve/deny is on approvals.tsx for org owners.

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
    // Section 3 shows the current user's OWN join requests (read-only status view).
    // Approve/deny actions belong to the org owner on the approvals.tsx screen.
    const statusColor =
      item.status === 'approved' ? '#10B981' :
      item.status === 'denied' ? '#DC2626' :
      '#F59E0B';
    const statusLabel =
      item.status === 'approved' ? 'Approved' :
      item.status === 'denied' ? 'Denied' :
      'Pending Review';
    return (
      <View key={item.id} style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={styles.cardRow}>
          <View style={[styles.statusChip, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.typeChip, { color: statusColor }]}>{statusLabel}</Text>
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

        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={14} color={C.mutedText} />
          <Text style={[styles.metaText, { color: C.mutedText }]}>
            {item.status === 'pending' ? 'Waiting for organization owner to review' : `Request ${statusLabel.toLowerCase()}`}
          </Text>
        </View>
      </View>
    );
  };

  const isLoading = eventsLoading || invitesLoading || orgRequestsLoading;
  // Only count actually-pending items for the empty state. Section 3 now shows all statuses
  // (pending/approved/denied) as read-only, so approved/denied requests shouldn't suppress "All caught up".
  const pendingOrgRequests = orgRequests.filter(r => r.status === 'pending');
  const totalPending = events.length + teamInvites.length + pendingOrgRequests.length;

  // ── Render ────────────────────────────────────────────────────────────────

  if (coachLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: C.background }]} edges={['bottom']}>
        <ActivityIndicator style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!canAccessCoachTools) {
    return (
      <CoachAccessRedirecting
        backgroundColor={C.background}
        spinnerColor={C.tint}
        textColor={C.mutedText}
        edges={['bottom']}
      />
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
          {renderSectionHeader('Roster Invites', 'people-outline', teamInvites.length, '#3B82F6', () => router.push('/my-team' as never))}
          {invitesLoading
            ? <ActivityIndicator style={styles.sectionLoader} color={C.tint} />
            : teamInvites.length === 0
              ? renderEmpty('No pending team invitations.')
              : teamInvites.map(renderInviteCard)
          }

          {/* ── Section 3: Organization Join Requests ── */}
          {renderSectionHeader('Organization Join Requests', 'shield-checkmark-outline', pendingOrgRequests.length, '#8B5CF6')}
          {orgRequestsLoading
            ? <ActivityIndicator style={styles.sectionLoader} color={C.tint} />
            : orgRequests.length === 0
              ? renderEmpty('No organization join requests.')
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
