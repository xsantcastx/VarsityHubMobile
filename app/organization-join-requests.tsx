import { Organization, User } from '@/api/entities';
import { canManageOrgAsCoach } from '@/utils/roleChecks';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { captureException } from '@/utils/sentry';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeGoBack } from '@/utils/navigation';

/** API returns OrganizationJoinRequest (user-based coach requests) */
type ApiJoinRequest = {
  id: string;
  organization_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'denied';
  message?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  user: { id: string; display_name?: string | null; username?: string | null; avatar_url?: string | null; email?: string };
};

type JoinRequest = {
  id: string;
  organization_id: string;
  organization_name: string;
  requester_id: string;
  requester_name: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approved_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
};

function OrganizationJoinRequestsScreen() {
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];
  const router = useRouter();
  const params = useLocalSearchParams<{
    organization_id: string;
    organization_name?: string;
    request_id?: string;
    action?: 'approve' | 'reject';
  }>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ visible: boolean; request: JoinRequest | null; reason: string }>({ visible: false, request: null, reason: '' });
  // Tracks which deep-link signature we've already handled. A boolean
  // ref made every email link after the first a silent no-op even when
  // the new link pointed at a different request — admins reported "the
  // approve button didn't work" on the second join-request email.
  const lastHandledLinkRef = useRef<string | null>(null);

  const loadRequests = useCallback(async () => {
    // Guard: require organization_id
    if (!params.organization_id) {
      setLoading(false);
      setError('Organization ID is required. Please select an organization.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Permission gate: a pending/rejected coach (or fan) who still has an
      // owner/manager membership row from a prior approved state could
      // otherwise load the review UI and see action controls. Verify the
      // user is currently allowed to manage this org BEFORE loading any
      // requests. Mirrors the server gate on approve/reject mutations.
      const [currentUser, members] = await Promise.all([
        User.me().catch(() => null),
        Organization.members(params.organization_id).catch(() => []),
      ]);
      if (!canManageOrgAsCoach(currentUser as any, Array.isArray(members) ? members : [])) {
        setLoading(false);
        setError('You do not have permission to review join requests for this organization.');
        return;
      }

      const status = filter === 'pending' ? 'pending' : undefined;
      const data = await Organization.getJoinRequests(params.organization_id, status);
      const raw = Array.isArray(data) ? data : [];
      const orgName = params.organization_name || 'Organization';
      const mapped: JoinRequest[] = raw.map((r: ApiJoinRequest) => ({
        id: r.id,
        organization_id: r.organization_id,
        organization_name: orgName,
        requester_id: r.user_id,
        requester_name: r.user?.display_name || r.user?.username || 'Coach',
        message: r.message || '',
        status: r.status === 'denied' ? 'rejected' : r.status,
        created_at: r.created_at,
        approved_at: r.status === 'approved' ? r.reviewed_at ?? undefined : undefined,
        rejected_at: r.status === 'denied' ? r.reviewed_at ?? undefined : undefined,
        rejection_reason: r.status === 'denied' ? (r.rejection_reason || r.message || undefined) : undefined,
      }));
      setRequests(mapped);
    } catch (err: any) {
      if (__DEV__) console.error('[OrganizationJoinRequests] Error loading requests:', err);
      captureException(err, { tags: { screen: 'organization-join-requests', action: 'load' } });
      setError(err?.message || 'Failed to load join requests');
    } finally {
      setLoading(false);
    }
  }, [params.organization_id, params.organization_name, filter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  }, [loadRequests]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    const requestId = String(params.request_id || '').trim();
    const action = params.action === 'approve' || params.action === 'reject' ? params.action : null;
    if (!requestId || !action || requests.length === 0) return;

    const signature = `${requestId}|${action}`;
    if (lastHandledLinkRef.current === signature) return;

    const request = requests.find(item => item.id === requestId && item.status === 'pending');
    lastHandledLinkRef.current = signature;
    if (!request) return;

    if (action === 'approve') {
      void handleApprove(request);
      return;
    }
    handleReject(request);
  }, [params.action, params.request_id, requests]);

  const handleApprove = async (request: JoinRequest) => {
    Alert.alert(
      'Approve Request',
      `Allow ${request.requester_name} to join ${params.organization_name || 'this organization'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: () => {
            void (async () => {
              setProcessingId(request.id);
              try {
                await Organization.approveJoinRequest(request.id);
                Alert.alert('Success', `${request.requester_name} has been added to your organization!`);
                await loadRequests();
              } catch (err: any) {
                if (__DEV__) console.error('[OrganizationJoinRequests] Error approving request:', err);
                captureException(err, { tags: { screen: 'organization-join-requests', action: 'approve' } });
                Alert.alert('Error', err?.message || 'Failed to approve request');
              } finally {
                setProcessingId(null);
              }
            })();
          },
        },
      ]
    );
  };

  const handleReject = (request: JoinRequest) => {
    setRejectModal({ visible: true, request, reason: '' });
  };

  const submitReject = () => {
    void (async () => {
      if (!rejectModal.request) return;
      
      // Validate reason is not empty
      const reason = rejectModal.reason.trim();
      if (!reason) {
        Alert.alert('Reason Required', 'Please provide a reason for rejecting this request.');
        return;
      }
      
      setProcessingId(rejectModal.request.id);
      try {
        await Organization.rejectJoinRequest(rejectModal.request.id, reason);
        Alert.alert('Request Rejected', `${rejectModal.request.requester_name} has been notified.`);
        await loadRequests();
      } catch (err: any) {
        if (__DEV__) console.error('[OrganizationJoinRequests] Error rejecting request:', err);
        captureException(err, { tags: { screen: 'organization-join-requests', action: 'reject' } });
        Alert.alert('Error', err?.message || 'Failed to reject request');
      } finally {
        setProcessingId(null);
        setRejectModal({ visible: false, request: null, reason: '' });
      }
    })();
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Team Join Requests',
          headerShown: false,
        }}
      />

      {/* Custom Header */}
      <View style={[styles.header, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <Pressable 
          onPress={() => safeGoBack(router)} 
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Coach Requests</Text>
          {params.organization_name && (
            <Text style={[styles.headerSubtitle, { color: theme.mutedText }]} numberOfLines={1}>
              {params.organization_name}
            </Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <Pressable
          onPress={() => setFilter('pending')}
          style={[
            styles.filterButton,
            { backgroundColor: filter === 'pending' ? theme.tint : 'transparent' },
          ]}
        >
          <Text
            style={[
              styles.filterText,
              { color: filter === 'pending' ? '#fff' : theme.text },
            ]}
          >
            Pending {pendingRequests.length > 0 ? `(${pendingRequests.length})` : ''}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setFilter('all')}
          style={[
            styles.filterButton,
            { backgroundColor: filter === 'all' ? theme.tint : 'transparent' },
          ]}
        >
          <Text
            style={[
              styles.filterText,
              { color: filter === 'all' ? '#fff' : theme.text },
            ]}
          >
            All
          </Text>
        </Pressable>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color={theme.mutedText} />
          <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
          <Pressable onPress={loadRequests} style={[styles.retryButton, { backgroundColor: theme.tint }]}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.tint}
              colors={[theme.tint]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {requests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="check-circle-outline" size={64} color={theme.mutedText} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {filter === 'pending' ? 'No Pending Requests' : 'No Requests Yet'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.mutedText }]}>
                {filter === 'pending'
                  ? 'All caught up! New requests will appear here.'
                  : 'Coaches can request to join your organization during onboarding or from the league search.'}
              </Text>
            </View>
          ) : (
            <View style={styles.requestsList}>
              {requests.map((request) => {
                const isPending = request.status === 'pending';
                const isProcessing = processingId === request.id;

                return (
                  <View
                    key={request.id}
                    style={[
                      styles.requestCard,
                      { backgroundColor: theme.card, borderColor: theme.border },
                    ]}
                  >
                    {/* Requester Info */}
                    <View style={styles.requestHeader}>
                      <View style={styles.requestHeaderText}>
                        <Text style={[styles.teamName, { color: theme.text }]}>
                          {request.requester_name}
                        </Text>
                        <Text style={[styles.requesterName, { color: theme.mutedText }]}>
                          Coach join request
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              request.status === 'approved'
                                ? '#10b981'
                                : request.status === 'rejected'
                                  ? '#ef4444'
                                  : '#f59e0b',
                          },
                        ]}
                      >
                        <Text style={styles.statusText}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Text>
                      </View>
                    </View>

                    {/* Message */}
                    {request.message && (
                      <View style={[styles.messageContainer, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.messageText, { color: theme.text }]}>
                          "{request.message}"
                        </Text>
                      </View>
                    )}

                    {/* Rejection Reason */}
                    {request.status === 'rejected' && request.rejection_reason && (
                      <View style={[styles.rejectionContainer, { backgroundColor: '#fef2f2', borderColor: '#fee2e2' }]}>
                        <MaterialIcons name="cancel" size={16} color="#dc2626" />
                        <Text style={[styles.rejectionText, { color: '#dc2626' }]}>
                          {request.rejection_reason}
                        </Text>
                      </View>
                    )}

                    {/* Timestamp */}
                    <Text style={[styles.timestamp, { color: theme.mutedText }]}>
                      {formatDate(request.created_at)}
                    </Text>

                    {/* Action Buttons (only for pending requests) */}
                    {isPending && (
                      <View style={styles.actionButtons}>
                        <Pressable
                          onPress={() => handleReject(request)}
                          disabled={isProcessing}
                          style={[styles.actionButton, styles.rejectButton, { borderColor: theme.border }]}
                        >
                          {isProcessing ? (
                            <ActivityIndicator size="small" color="#dc2626" />
                          ) : (
                            <>
                              <MaterialIcons name="cancel" size={20} color="#dc2626" />
                              <Text style={[styles.rejectButtonText, { color: '#dc2626' }]}>Reject</Text>
                            </>
                          )}
                        </Pressable>
                        <Pressable
                          onPress={() => handleApprove(request)}
                          disabled={isProcessing}
                          style={[styles.actionButton, styles.approveButton, { backgroundColor: theme.tint }]}
                        >
                          {isProcessing ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <MaterialIcons name="check-circle-outline" size={20} color="#fff" />
                              <Text style={styles.approveButtonText}>Approve</Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      <Modal
        visible={rejectModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModal({ visible: false, request: null, reason: '' })}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setRejectModal({ visible: false, request: null, reason: '' })}
        >
          <Pressable style={[styles.modalCard, { backgroundColor: theme.background }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Reject Request</Text>
            <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>
              {rejectModal.request ? `Provide a reason for rejecting ${rejectModal.request.requester_name}.` : ''}
            </Text>
            <TextInput
              placeholder="Reason (required)"
              placeholderTextColor={theme.mutedText}
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border }]}
              value={rejectModal.reason}
              onChangeText={(text) => setRejectModal((prev) => ({ ...prev, reason: text }))}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, { borderColor: theme.border }]}
                onPress={() => setRejectModal({ visible: false, request: null, reason: '' })}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonDanger]}
                onPress={submitReject}
                disabled={processingId === rejectModal.request?.id}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                  {processingId === rejectModal.request?.id ? 'Rejecting...' : 'Reject'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
    borderBottomWidth: 1,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  requestsList: {
    gap: 12,
  },
  requestCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  requestHeaderText: {
    flex: 1,
    gap: 4,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
  },
  requesterName: {
    fontSize: 13,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  messageContainer: {
    padding: 12,
    borderRadius: 8,
  },
  messageText: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  rejectionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  rejectionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
  },
  rejectButton: {
    borderWidth: 1,
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  approveButton: {
    // backgroundColor set via theme.tint
  },
  approveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    maxWidth: 420,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalButtonDanger: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  modalButtonText: {
    fontWeight: '700',
  },
});

export default OrganizationJoinRequestsScreen;
