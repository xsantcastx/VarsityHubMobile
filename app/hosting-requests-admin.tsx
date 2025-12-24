import { httpGet, httpPatch } from '@/api/http';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface HostingRequest {
  id: string;
  organization_name: string;
  contact_name: string;
  contact_email: string;
  venue?: string | null;
  requested_dates?: string | null;
  status: 'pending' | 'approved' | 'denied';
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export default function HostingRequestsAdminScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { isAdmin, loading: adminLoading } = useRequireAdmin();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<HostingRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('all');
  const [selectedRequest, setSelectedRequest] = useState<HostingRequest | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionNotes, setActionNotes] = useState('');

  const loadRequests = useCallback(async () => {
    if (!isAdmin) return;

    setLoading(true);
    setError(null);
    try {
      const data = await httpGet('/hosting-requests');
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(
        e?.status === 403
          ? 'Access denied (admin only).'
          : e?.message || 'Failed to load hosting requests'
      );
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const filteredItems = items.filter((item) => {
    if (statusFilter === 'all') return true;
    return item.status === statusFilter;
  });

  const handleApprove = async () => {
    if (!selectedRequest) return;

    setActionLoading(true);
    try {
      await httpPatch(`/hosting-requests/${selectedRequest.id}/status`, {
        status: 'approved',
        notes: actionNotes,
      });
      setModalVisible(false);
      setActionNotes('');
      setSelectedRequest(null);
      await loadRequests();
    } catch (e: any) {
      setError(e?.message || 'Failed to approve request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeny = async () => {
    if (!selectedRequest) return;

    setActionLoading(true);
    try {
      await httpPatch(`/hosting-requests/${selectedRequest.id}/status`, {
        status: 'denied',
        notes: actionNotes,
      });
      setModalVisible(false);
      setActionNotes('');
      setSelectedRequest(null);
      await loadRequests();
    } catch (e: any) {
      setError(e?.message || 'Failed to deny request');
    } finally {
      setActionLoading(false);
    }
  };

  if (adminLoading) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          {
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: Colors[colorScheme].background,
          },
        ]}
        edges={['top', 'bottom']}
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          {
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: Colors[colorScheme].background,
          },
        ]}
        edges={['top', 'bottom']}
      >
        <Text
          style={{
            color: Colors[colorScheme].text,
            fontSize: 16,
            fontWeight: '600',
          }}
        >
          Admin access required
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: Colors[colorScheme].background },
      ]}
      edges={['top', 'bottom']}
    >
      <Stack.Screen options={{ title: 'Admin · Hosting Requests' }} />

      {/* Filter Bar */}
      <View style={[styles.filterBar, { borderBottomColor: Colors[colorScheme].border }]}>
        {(['all', 'pending', 'approved', 'denied'] as const).map((status) => (
          <Pressable
            key={status}
            style={[
              styles.filterButton,
              statusFilter === status && {
                backgroundColor: Colors[colorScheme].tint,
              },
              { borderColor: Colors[colorScheme].border },
            ]}
            onPress={() => setStatusFilter(status)}
          >
            <Text
              style={[
                styles.filterButtonText,
                {
                  color:
                    statusFilter === status
                      ? '#fff'
                      : Colors[colorScheme].text,
                  fontWeight: statusFilter === status ? '600' : '400',
                },
              ]}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Error */}
      {error && (
        <Text style={[styles.error, { color: '#ff4444' }]}>{error}</Text>
      )}

      {/* Loading */}
      {loading && (
        <View style={{ padding: 24, alignItems: 'center' }}>
          <ActivityIndicator />
        </View>
      )}

      {/* List */}
      {!loading && filteredItems.length === 0 && (
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ color: Colors[colorScheme].mutedText }}>
            No requests found
          </Text>
        </View>
      )}

      {!loading && (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.requestCard,
                {
                  backgroundColor: Colors[colorScheme].card,
                  borderColor: Colors[colorScheme].border,
                },
              ]}
              onPress={() => {
                setSelectedRequest(item);
                setModalVisible(true);
              }}
            >
              <View style={styles.cardHeader}>
                <Text
                  style={[
                    styles.organizationName,
                    { color: Colors[colorScheme].text },
                  ]}
                >
                  {item.organization_name}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        item.status === 'pending'
                          ? '#ffa500'
                          : item.status === 'approved'
                            ? '#4caf50'
                            : '#ff4444',
                    },
                  ]}
                >
                  <Text style={styles.statusText}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Text>
                </View>
              </View>

              <Text style={[styles.contactName, { color: Colors[colorScheme].text }]}>
                {item.contact_name}
              </Text>
              <Text style={[styles.email, { color: Colors[colorScheme].mutedText }]}>
                {item.contact_email}
              </Text>

              {item.venue && (
                <Text style={[styles.detail, { color: Colors[colorScheme].mutedText }]}>
                  Venue: {item.venue}
                </Text>
              )}
              {item.requested_dates && (
                <Text
                  style={[styles.detail, { color: Colors[colorScheme].mutedText }]}
                >
                  Dates: {item.requested_dates}
                </Text>
              )}

              <Text style={[styles.timestamp, { color: Colors[colorScheme].mutedText }]}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </Pressable>
          )}
          scrollEnabled={!modalVisible}
        />
      )}

      {/* Detail Modal */}
      {selectedRequest && (
        <Modal visible={modalVisible} animationType="slide" transparent={true}>
          <SafeAreaView
            style={[
              styles.modalContainer,
              { backgroundColor: Colors[colorScheme].background },
            ]}
            edges={['top', 'bottom']}
          >
            <View
              style={[
                styles.modalHeader,
                { borderBottomColor: Colors[colorScheme].border },
              ]}
            >
              <Pressable
                onPress={() => {
                  setModalVisible(false);
                  setActionNotes('');
                }}
              >
                <Text style={[{ color: Colors[colorScheme].tint }]}>Close</Text>
              </Pressable>
              <Text
                style={[
                  styles.modalTitle,
                  { color: Colors[colorScheme].text },
                ]}
              >
                Request Details
              </Text>
              <View style={{ width: 50 }} />
            </View>

            <View style={styles.modalContent}>
              <View style={styles.detailSection}>
                <Text style={[styles.label, { color: Colors[colorScheme].mutedText }]}>
                  Organization
                </Text>
                <Text style={[styles.value, { color: Colors[colorScheme].text }]}>
                  {selectedRequest.organization_name}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.label, { color: Colors[colorScheme].mutedText }]}>
                  Contact Name
                </Text>
                <Text style={[styles.value, { color: Colors[colorScheme].text }]}>
                  {selectedRequest.contact_name}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.label, { color: Colors[colorScheme].mutedText }]}>
                  Contact Email
                </Text>
                <Text style={[styles.value, { color: Colors[colorScheme].text }]}>
                  {selectedRequest.contact_email}
                </Text>
              </View>

              {selectedRequest.venue && (
                <View style={styles.detailSection}>
                  <Text
                    style={[styles.label, { color: Colors[colorScheme].mutedText }]}
                  >
                    Venue
                  </Text>
                  <Text style={[styles.value, { color: Colors[colorScheme].text }]}>
                    {selectedRequest.venue}
                  </Text>
                </View>
              )}

              {selectedRequest.requested_dates && (
                <View style={styles.detailSection}>
                  <Text
                    style={[styles.label, { color: Colors[colorScheme].mutedText }]}
                  >
                    Requested Dates
                  </Text>
                  <Text style={[styles.value, { color: Colors[colorScheme].text }]}>
                    {selectedRequest.requested_dates}
                  </Text>
                </View>
              )}

              {selectedRequest.notes && (
                <View style={styles.detailSection}>
                  <Text
                    style={[styles.label, { color: Colors[colorScheme].mutedText }]}
                  >
                    Admin Notes
                  </Text>
                  <Text style={[styles.value, { color: Colors[colorScheme].text }]}>
                    {selectedRequest.notes}
                  </Text>
                </View>
              )}

              {selectedRequest.status === 'pending' && (
                <>
                  <Text
                    style={[
                      styles.label,
                      { color: Colors[colorScheme].mutedText, marginTop: 20 },
                    ]}
                  >
                    Admin Notes (optional)
                  </Text>
                  <TextInput
                    value={actionNotes}
                    onChangeText={setActionNotes}
                    placeholder="Add notes for the requester..."
                    placeholderTextColor={Colors[colorScheme].mutedText}
                    style={[
                      styles.notesInput,
                      {
                        backgroundColor: Colors[colorScheme].card,
                        borderColor: Colors[colorScheme].border,
                        color: Colors[colorScheme].text,
                      },
                    ]}
                    multiline
                    numberOfLines={4}
                  />

                  <View style={styles.actionButtons}>
                    <Pressable
                      style={[
                        styles.approveButton,
                        actionLoading && { opacity: 0.5 },
                      ]}
                      onPress={handleApprove}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.approveButtonText}>Approve</Text>
                      )}
                    </Pressable>

                    <Pressable
                      style={[
                        styles.denyButton,
                        actionLoading && { opacity: 0.5 },
                      ]}
                      onPress={handleDeny}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.denyButtonText}>Deny</Text>
                      )}
                    </Pressable>
                  </View>
                </>
              )}

              {selectedRequest.status !== 'pending' && (
                <View style={[styles.statusSection, { marginTop: 20 }]}>
                  <Text
                    style={[
                      styles.label,
                      { color: Colors[colorScheme].mutedText },
                    ]}
                  >
                    Status
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          selectedRequest.status === 'approved'
                            ? '#4caf50'
                            : '#ff4444',
                        alignSelf: 'flex-start',
                      },
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {selectedRequest.status
                        .charAt(0)
                        .toUpperCase() +
                        selectedRequest.status.slice(1)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 13,
  },
  error: {
    padding: 12,
    fontSize: 13,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 8,
  },
  requestCard: {
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  organizationName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  contactName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  email: {
    fontSize: 12,
    marginBottom: 8,
  },
  detail: {
    fontSize: 12,
    marginVertical: 2,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  detailSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    fontFamily: 'System',
    fontSize: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#4caf50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  denyButton: {
    flex: 1,
    backgroundColor: '#ff4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  denyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  statusSection: {
    marginBottom: 16,
  },
});
