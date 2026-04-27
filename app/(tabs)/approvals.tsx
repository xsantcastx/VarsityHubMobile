import { Organization } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useRequireCoach } from '@/hooks/useRequireCoach';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { safeGoBack } from '@/utils/navigation';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureBreadcrumb } from '@/utils/sentry';
import { isSessionExpiryError } from '@/utils/sessionExpiryError';

// ─── Types ────────────────────────────────────────────────────────────────────

type PendingCoach = {
  id: string;
  organization_id: string;
  user_id: string;
  status: string;
  message?: string;
  created_at: string;
  user: {
    id: string;
    display_name: string;
    username: string;
    email: string;
    avatar_url: string | null;
    approval_status: string;
    preferences: any;
  };
};

type OwnedOrg = {
  id: string;
  name: string;
  sport?: string | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ApprovalsScreen() {
  const { canAccessCoachTools, loading: coachLoading } = useRequireCoach();
  const colorScheme = useCustomColorScheme();
  const C = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  useAuth();

  const [orgs, setOrgs] = useState<OwnedOrg[]>([]);
  const [coaches, setCoaches] = useState<PendingCoach[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  // Approve modal (replaces Alert.prompt which is iOS-only)
  const [approveTarget, setApproveTarget] = useState<PendingCoach | null>(null);
  const [approveNote, setApproveNote] = useState('');
  const [approving, setApproving] = useState(false);

  // Decline modal
  const [declineTarget, setDeclineTarget] = useState<PendingCoach | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [declining, setDeclining] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Load owned orgs, then pending coaches for each
  const loadData = useCallback(async () => {
    try {
      const myOrgs: any = await Organization.mine();
      if (!mountedRef.current) return;
      const orgList: OwnedOrg[] = Array.isArray(myOrgs) ? myOrgs : [];
      setOrgs(orgList);

      // Fetch pending coaches for all orgs in parallel
      const allCoaches: PendingCoach[] = [];
      await Promise.all(
        orgList.map(async (org) => {
          try {
            const pending: any = await Organization.pendingCoaches(org.id);
            if (Array.isArray(pending)) {
              allCoaches.push(...pending);
            }
          } catch {
            // 403 = not owner for this org, skip
          }
        })
      );

      if (!mountedRef.current) return;
      // Sort by newest first
      allCoaches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setCoaches(allCoaches);
    } catch (err: any) {
      if (__DEV__) console.error('[Approvals] Load error:', err);
      if (mountedRef.current) {
        if (isSessionExpiryError(err)) {
          return;
        }
        Alert.alert('Error', err?.message || 'Failed to load approvals. Please try again.');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
  }, [loadData]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleApprove = (coach: PendingCoach) => {
    setApproveTarget(coach);
    setApproveNote('');
  };

  const handleApproveConfirm = async () => {
    if (!approveTarget) return;
    setApproving(true);
    setActionLoading(approveTarget.user.id);
    captureBreadcrumb('League owner coach approval started', 'admin.approval', {
      action: 'approve',
      actor: 'league_owner',
      coach_id: approveTarget.user.id,
      organization_id: approveTarget.organization_id,
      has_note: approveNote.trim().length > 0,
    });
    try {
      await Organization.approveCoach(approveTarget.organization_id, approveTarget.user.id, approveNote.trim() || undefined);
      const userId = approveTarget.user.id;
      captureBreadcrumb('League owner coach approval succeeded', 'admin.approval', {
        action: 'approve',
        actor: 'league_owner',
        coach_id: userId,
        organization_id: approveTarget.organization_id,
      });
      setApproveTarget(null);
      setApproveNote('');
      // Show green checkmark briefly
      setApprovedIds((prev) => new Set(prev).add(userId));
      setTimeout(() => {
        if (mountedRef.current) {
          setCoaches((prev) => prev.filter((c) => c.user.id !== userId));
          setApprovedIds((prev) => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
          });
        }
      }, 1200);
    } catch (err: any) {
      if (isSessionExpiryError(err)) {
        return;
      }
      captureBreadcrumb('League owner coach approval failed', 'admin.approval', {
        action: 'approve',
        actor: 'league_owner',
        coach_id: approveTarget.user.id,
        organization_id: approveTarget.organization_id,
        error: err?.data?.error || err?.message || 'unknown_error',
      }, 'error');
      const msg = err?.data?.error || err?.message || 'Failed to approve coach';
      Alert.alert('Error', msg);
    } finally {
      if (mountedRef.current) {
        setActionLoading(null);
        setApproving(false);
      }
    }
  };

  const handleDeclineConfirm = async () => {
    if (!declineTarget) return;
    setDeclining(true);
    setActionLoading(declineTarget.user.id);
    captureBreadcrumb('League owner coach rejection started', 'admin.approval', {
      action: 'reject',
      actor: 'league_owner',
      coach_id: declineTarget.user.id,
      organization_id: declineTarget.organization_id,
      has_reason: declineReason.trim().length > 0,
    });
    try {
      await Organization.rejectCoach(
        declineTarget.organization_id,
        declineTarget.user.id,
        declineReason.trim() || undefined,
      );
      captureBreadcrumb('League owner coach rejection succeeded', 'admin.approval', {
        action: 'reject',
        actor: 'league_owner',
        coach_id: declineTarget.user.id,
        organization_id: declineTarget.organization_id,
      });
      setCoaches((prev) => prev.filter((c) => c.user.id !== declineTarget.user.id));
      setDeclineTarget(null);
      setDeclineReason('');
    } catch (err: any) {
      if (isSessionExpiryError(err)) {
        return;
      }
      captureBreadcrumb('League owner coach rejection failed', 'admin.approval', {
        action: 'reject',
        actor: 'league_owner',
        coach_id: declineTarget.user.id,
        organization_id: declineTarget.organization_id,
        error: err?.data?.error || err?.message || 'unknown_error',
      }, 'error');
      const msg = err?.data?.error || err?.message || 'Failed to decline coach';
      Alert.alert('Error', msg);
    } finally {
      if (mountedRef.current) {
        setActionLoading(null);
        setDeclining(false);
      }
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const getOrgName = (orgId: string) => orgs.find((o) => o.id === orgId)?.name || 'League';

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const renderCoach = ({ item }: { item: PendingCoach }) => {
    const u = item.user;
    const isApproved = approvedIds.has(u.id);
    const isActioning = actionLoading === u.id;
    const sport = u.preferences?.sport || u.preferences?.primary_sport || '';

    return (
      <View style={[styles.card, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF', borderColor: isDark ? '#374151' : '#D1D5DB' }]}>
        {isApproved && (
          <View style={styles.approvedOverlay}>
            <MaterialIcons name="check-circle" size={48} color="#16A34A" />
            <Text style={styles.approvedText}>Approved</Text>
          </View>
        )}
        <View style={[styles.cardContent, isApproved && { opacity: 0.3 }]}>
          <View style={styles.row}>
            {u.avatar_url ? (
              <Image source={{ uri: u.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: isDark ? '#374151' : '#D1D5DB' }]}>
                <MaterialIcons name="person" size={24} color={isDark ? '#6B7280' : '#9CA3AF'} />
              </View>
            )}
            <View style={styles.info}>
              <Text style={[styles.name, { color: C.text }]} numberOfLines={1}>
                {u.display_name || u.username || 'Coach'}
              </Text>
              {u.username && (
                <Text style={[styles.username, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1}>
                  @{u.username}
                </Text>
              )}
              <View style={styles.metaRow}>
                {sport ? (
                  <Text style={[styles.metaText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{sport}</Text>
                ) : null}
                <Text style={[styles.metaText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
                  {formatDate(item.created_at)}
                </Text>
              </View>
              {orgs.length > 1 && (
                <Text style={[styles.orgLabel, { color: isDark ? '#60A5FA' : '#2563EB' }]} numberOfLines={1}>
                  {getOrgName(item.organization_id)}
                </Text>
              )}
            </View>
          </View>

          {item.message && (
            <Text style={[styles.messageText, { color: isDark ? '#D1D5DB' : '#374151' }]} numberOfLines={2}>
              &ldquo;{item.message}&rdquo;
            </Text>
          )}

          <View style={styles.actions}>
            <Pressable
              style={[styles.approveBtn, isActioning && { opacity: 0.6 }]}
              onPress={() => handleApprove(item)}
              disabled={isActioning || isApproved}
            >
              {isActioning ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="check" size={18} color="#fff" />
                  <Text style={styles.approveBtnText}>Approve</Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={[styles.declineBtn, { borderColor: isDark ? '#EF4444' : '#DC2626' }]}
              onPress={() => { setDeclineTarget(item); setDeclineReason(''); }}
              disabled={isActioning || isApproved}
            >
              <MaterialIcons name="close" size={18} color={isDark ? '#EF4444' : '#DC2626'} />
              <Text style={[styles.declineBtnText, { color: isDark ? '#EF4444' : '#DC2626' }]}>Decline</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color={C.tint} />
        <Text style={[styles.emptySubtitle, { color: isDark ? '#6B7280' : '#9CA3AF', marginTop: 12 }]}>Loading...</Text>
      </View>
    );
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="check-circle-outline" size={64} color={isDark ? '#374151' : '#D1D5DB'} />
        <Text style={[styles.emptyTitle, { color: C.text }]}>No pending requests</Text>
        <Text style={[styles.emptySubtitle, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
          When coaches request to join your league, they&apos;ll appear here.
        </Text>
      </View>
    );
  };

  const renderSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.card, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF', borderColor: isDark ? '#374151' : '#D1D5DB' }]}>
          <View style={styles.cardContent}>
            <View style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: isDark ? '#374151' : '#D1D5DB' }]} />
              <View style={styles.info}>
                <View style={[styles.skeletonLine, { width: 140, backgroundColor: isDark ? '#374151' : '#D1D5DB' }]} />
                <View style={[styles.skeletonLine, { width: 100, backgroundColor: isDark ? '#374151' : '#D1D5DB', marginTop: 6 }]} />
                <View style={[styles.skeletonLine, { width: 80, backgroundColor: isDark ? '#374151' : '#D1D5DB', marginTop: 6 }]} />
              </View>
            </View>
            <View style={[styles.skeletonActions, { marginTop: 12 }]}>
              <View style={[styles.skeletonBtn, { backgroundColor: isDark ? '#374151' : '#D1D5DB' }]} />
              <View style={[styles.skeletonBtn, { backgroundColor: isDark ? '#374151' : '#D1D5DB' }]} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  // Gate: must be a coach
  if (coachLoading || !canAccessCoachTools) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B1120' : '#F8FAFC' }]}>
        <ActivityIndicator style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  // If user has no owned orgs, they shouldn't be here
  if (!loading && orgs.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B1120' : '#F8FAFC' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.emptyContainer}>
          <MaterialIcons name="lock-outline" size={64} color={isDark ? '#374151' : '#D1D5DB'} />
          <Text style={[styles.emptyTitle, { color: C.text }]}>League Owners Only</Text>
          <Text style={[styles.emptySubtitle, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
            This screen is for league owners to manage coach requests.
          </Text>
          <Pressable style={styles.backBtn} onPress={() => safeGoBack(router)}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B1120' : '#F8FAFC' }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: isDark ? '#1F2937' : '#D1D5DB' }]}>
        <Pressable onPress={() => safeGoBack(router)} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={C.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.text }]}>Pending Approvals</Text>
        {coaches.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{coaches.length}</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
      </View>

      {loading ? (
        renderSkeleton()
      ) : (
        <FlatList
          data={coaches}
          keyExtractor={(item) => item.id}
          renderItem={renderCoach}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.tint} />
          }
        />
      )}

      {/* Approve Bottom Sheet / Modal */}
      <Modal
        visible={!!approveTarget}
        animationType="slide"
        transparent
        onRequestClose={() => setApproveTarget(null)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <Pressable style={styles.modalOverlay} onPress={() => setApproveTarget(null)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]} onPress={() => {}}>
            <View style={[styles.modalHandle, { backgroundColor: isDark ? '#4B5563' : '#D1D5DB' }]} />
            <Text style={[styles.modalTitle, { color: C.text }]}>Approve Coach</Text>
            {approveTarget && (
              <Text style={[styles.modalSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                {approveTarget.user.display_name || approveTarget.user.username}
              </Text>
            )}
            <Text style={[styles.modalLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              Note for the coach (optional)
            </Text>
            <TextInput
              style={[styles.modalInput, {
                color: C.text,
                borderColor: isDark ? '#374151' : '#D1D5DB',
                backgroundColor: isDark ? '#111827' : '#F9FAFB',
              }]}
              value={approveNote}
              onChangeText={setApproveNote}
              placeholder="e.g. Welcome to the league!"
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              multiline
              maxLength={300}
            />
            <Pressable
              style={[styles.confirmApproveBtn, approving && { opacity: 0.6 }]}
              onPress={handleApproveConfirm}
              disabled={approving}
            >
              {approving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmApproveBtnText}>Confirm Approve</Text>
              )}
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setApproveTarget(null)}>
              <Text style={[styles.cancelBtnText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Decline Bottom Sheet / Modal */}
      <Modal
        visible={!!declineTarget}
        animationType="slide"
        transparent
        onRequestClose={() => setDeclineTarget(null)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <Pressable style={styles.modalOverlay} onPress={() => setDeclineTarget(null)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]} onPress={() => {}}>
            <View style={[styles.modalHandle, { backgroundColor: isDark ? '#4B5563' : '#D1D5DB' }]} />
            <Text style={[styles.modalTitle, { color: C.text }]}>Decline Coach Request</Text>
            {declineTarget && (
              <Text style={[styles.modalSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                {declineTarget.user.display_name || declineTarget.user.username}
              </Text>
            )}
            <Text style={[styles.modalLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              Reason (optional)
            </Text>
            <TextInput
              style={[styles.modalInput, {
                color: C.text,
                borderColor: isDark ? '#374151' : '#D1D5DB',
                backgroundColor: isDark ? '#111827' : '#F9FAFB',
              }]}
              value={declineReason}
              onChangeText={setDeclineReason}
              placeholder="e.g. Not verified as a coach for this league"
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              multiline
              maxLength={300}
            />
            <Pressable
              style={[styles.confirmDeclineBtn, declining && { opacity: 0.6 }]}
              onPress={handleDeclineConfirm}
              disabled={declining}
            >
              {declining ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmDeclineBtnText}>Confirm Decline</Text>
              )}
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setDeclineTarget(null)}>
              <Text style={[styles.cancelBtnText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardContent: { padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700' },
  username: { fontSize: 13, marginTop: 1 },
  metaRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  metaText: { fontSize: 12 },
  orgLabel: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  messageText: { fontSize: 13, fontStyle: 'italic', marginTop: 10, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#DAA520',
    paddingVertical: 10,
    borderRadius: 8,
  },
  approveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    paddingVertical: 10,
    borderRadius: 8,
  },
  declineBtnText: { fontSize: 14, fontWeight: '700' },

  // Approved overlay
  approvedOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  approvedText: { color: '#16A34A', fontSize: 16, fontWeight: '700', marginTop: 4 },

  // Empty state
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 16 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  // Skeleton
  skeletonContainer: { padding: 16 },
  skeletonLine: { height: 14, borderRadius: 6 },
  skeletonActions: { flexDirection: 'row', gap: 10 },
  skeletonBtn: { flex: 1, height: 40, borderRadius: 8 },

  // Back button
  backBtn: {
    marginTop: 20,
    backgroundColor: '#1B3A6B',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  backBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Decline modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, marginBottom: 16 },
  modalLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  confirmApproveBtn: {
    backgroundColor: '#DAA520',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmApproveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  confirmDeclineBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmDeclineBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelBtnText: { fontSize: 14, fontWeight: '600' },
});
