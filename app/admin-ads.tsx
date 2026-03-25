import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { Advertisement as AdsApi, User } from '@/api/entities';

type AdStatus = 'draft' | 'pending' | 'approved' | 'active' | 'paused';

export default function AdminAdsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { isAdmin, loading: adminLoading } = useRequireAdmin();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedAds, setSelectedAds] = useState<Set<string>>(new Set());
  const [updating, setUpdating] = useState(false);
  const [reviewingAdId, setReviewingAdId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | AdStatus>('all');
  // Cross-platform modal for approve/reject notes (Alert.prompt is iOS-only)
  const [reviewModal, setReviewModal] = useState<{ adId: string; action: 'approve' | 'reject' } | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true); setError(null);
    try {
      await User.me().catch(() => null);
      const list = await AdsApi.listAll();
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.status === 403 ? 'Access denied (admin only).' : (e?.message || 'Failed to load ads'));
    } finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(() => { void load(); }, [load]);

  const toggleAdSelection = (adId: string) => {
    const newSet = new Set(selectedAds);
    if (newSet.has(adId)) {
      newSet.delete(adId);
    } else {
      newSet.add(adId);
    }
    setSelectedAds(newSet);
  };

  const selectAll = () => {
    const filtered = filteredItems;
    if (selectedAds.size === filtered.length) {
      setSelectedAds(new Set());
    } else {
      setSelectedAds(new Set(filtered.map(a => String(a.id))));
    }
  };

  const bulkApprove = async () => {
    const pendingIds = Array.from(selectedAds).filter((id) => items.find((a) => String(a.id) === id)?.status === 'pending');
    if (pendingIds.length === 0) return;
    setUpdating(true);
    try {
      const results = await Promise.allSettled(
        pendingIds.map((adId) => AdsApi.review(adId, 'approve'))
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        Alert.alert('Partial Success', `Approved ${pendingIds.length - failed} ad(s), ${failed} failed`);
      } else {
        Alert.alert('Success', `Approved ${pendingIds.length} ad${pendingIds.length > 1 ? 's' : ''}`);
      }
      setSelectedAds(new Set());
      setBulkMode(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to approve ads');
    } finally {
      setUpdating(false);
    }
  };

  const bulkReject = async () => {
    const pendingIds = Array.from(selectedAds).filter((id) => items.find((a) => String(a.id) === id)?.status === 'pending');
    if (pendingIds.length === 0) return;
    
    Alert.alert(
      'Reject Ads',
      `Reject ${pendingIds.length} ad${pendingIds.length > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setUpdating(true);
            try {
              const results = await Promise.allSettled(
                pendingIds.map((adId) => AdsApi.review(adId, 'reject'))
              );
              const failed = results.filter((r) => r.status === 'rejected').length;
              if (failed > 0) {
                Alert.alert('Partial Success', `Rejected ${pendingIds.length - failed} ad(s), ${failed} failed`);
              } else {
                Alert.alert('Success', `Rejected ${pendingIds.length} ad${pendingIds.length > 1 ? 's' : ''}`);
              }
              setSelectedAds(new Set());
              setBulkMode(false);
              await load();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to reject ads');
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  const bulkDelete = async () => {
    if (selectedAds.size === 0) return;
    
    Alert.alert(
      'Delete Ads',
      `Delete ${selectedAds.size} ad${selectedAds.size > 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setUpdating(true);
            try {
              const adIds = Array.from(selectedAds);
              const results = await Promise.allSettled(
                adIds.map((adId) => AdsApi.delete(adId))
              );
              const failed = results.filter((r) => r.status === 'rejected').length;
              if (failed > 0) {
                Alert.alert('Partial Success', `Deleted ${adIds.length - failed} ad(s), ${failed} failed`);
              } else {
                Alert.alert('Success', `Deleted ${adIds.length} ad${adIds.length > 1 ? 's' : ''}`);
              }
              setSelectedAds(new Set());
              setBulkMode(false);
              await load();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete ads');
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  const theme = Colors[colorScheme];

  if (adminLoading) {
    return <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}><ActivityIndicator style={{ marginTop: 40 }} /></SafeAreaView>;
  }
  if (!isAdmin) {
    return <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}><Text style={{ textAlign: 'center', marginTop: 40, color: theme.text }}>Admin access required</Text></SafeAreaView>;
  }

  const filteredItems = filterStatus === 'all'
    ? items
    : items.filter(ad => ad.status === filterStatus);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#22c55e';
      case 'approved': return '#3b82f6';
      case 'pending': return '#f59e0b';
      case 'paused': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isSelected = selectedAds.has(String(item.id));
    
    return (
      <Pressable
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border },
          bulkMode && isSelected && {
            borderColor: theme.tint,
            borderWidth: 2
          }
        ]}
        onPress={() => {
          if (bulkMode) {
            toggleAdSelection(String(item.id));
          }
        }}
      >
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          {bulkMode && (
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: isSelected ? theme.tint : '#d1d5db',
              backgroundColor: isSelected ? theme.tint : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 4
            }}>
              {isSelected && (
                <Ionicons name="checkmark" size={16} color="#ffffff" />
              )}
            </View>
          )}
          
          {item.banner_url ? (
            <Image source={{ uri: item.banner_url }} style={styles.bannerPreview} contentFit="cover" />
          ) : (
            <View style={[styles.bannerPreview, { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface }]}>
              <Ionicons name="image-outline" size={24} color={theme.mutedText} />
            </View>
          )}
          
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>{item.business_name || '(no name)'}</Text>
            <Text style={[styles.meta, { color: theme.mutedText }]} numberOfLines={1}>
              {item.contact_name || ''} {item.contact_email ? `· ${item.contact_email}` : ''}
            </Text>
            <Text style={[styles.meta, { color: theme.mutedText }]}>
              <Ionicons name="location" size={12} /> Zip: {item.target_zip_code || 'N/A'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <View style={[
                styles.badgeSmall, 
                { 
                  backgroundColor: getStatusColor(item.status) + '20',
                  borderColor: getStatusColor(item.status)
                }
              ]}>
                <Text style={[styles.badgeSmallText, { color: getStatusColor(item.status) }]}>
                  {String(item.status || 'draft').toUpperCase()}
                </Text>
              </View>
              {item.payment_status && (
                <View style={[styles.badgeSmall, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.badgeSmallText, { color: theme.text }]}>{String(item.payment_status).toUpperCase()}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        
        {!bulkMode && (
          <>
            <View style={{ height: 12 }} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {item.status === 'approved' && (
                <View style={[styles.badgeSmall, { backgroundColor: '#3b82f620', borderColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 6 }]}>
                  <Text style={{ color: '#3b82f6', fontWeight: '600', fontSize: 13 }}>Awaiting payment</Text>
                </View>
              )}
              {item.status === 'pending' && (
                <>
                  <Pressable
                    style={[styles.btn, { backgroundColor: '#22c55e', flex: 1, opacity: reviewingAdId === item.id ? 0.6 : 1 }]}
                    disabled={reviewingAdId === item.id}
                    onPress={() => { setReviewNote(''); setReviewModal({ adId: item.id, action: 'approve' }); }}
                  >
                    {reviewingAdId === item.id ? <ActivityIndicator size={16} color="#fff" /> : <Ionicons name="checkmark-circle" size={16} color="#fff" />}
                    <Text style={styles.btnText}>{reviewingAdId === item.id ? 'Saving...' : 'Approve'}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btn, { backgroundColor: '#dc2626', flex: 1, opacity: reviewingAdId === item.id ? 0.6 : 1 }]}
                    disabled={reviewingAdId === item.id}
                    onPress={() => { setReviewNote(''); setReviewModal({ adId: item.id, action: 'reject' }); }}
                  >
                    <Ionicons name="close-circle" size={16} color="#fff" />
                    <Text style={styles.btnText}>Reject</Text>
                  </Pressable>
                </>
              )}
              <Pressable 
                style={[styles.btn, styles.btnSecondary, (item.status === 'pending' || item.status === 'approved') ? { flex: 0, paddingHorizontal: 16 } : { flex: 1 }]} 
                onPress={() => void router.push({ pathname: '/edit-ad', params: { id: item.id } })}
              >
                <Ionicons name="pencil" size={16} color={theme.text} />
                {item.status !== 'pending' && item.status !== 'approved' && <Text style={[styles.btnText, { color: theme.text }]}>Edit</Text>}
              </Pressable>
            </View>
          </>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Admin · Ads',
          headerShown: true,
          headerLeft: () => (
            <Pressable onPress={() => safeGoBack(router)} style={{ paddingRight: 8 }}>
              <Ionicons name="chevron-back" size={28} color="#007AFF" />
            </Pressable>
          ),
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 12, marginRight: 8 }}>
              {bulkMode && (
                <>
                  <Pressable onPress={selectAll} style={{ padding: 8 }}>
                    <Text style={{ color: theme.tint, fontWeight: '600' }}>
                      {selectedAds.size === filteredItems.length ? 'Deselect' : 'Select All'}
                    </Text>
                  </Pressable>
                  <Pressable 
                    onPress={bulkApprove} 
                    disabled={selectedAds.size === 0 || updating}
                    style={{ padding: 8 }}
                  >
                    <Text style={{ color: selectedAds.size > 0 ? '#22c55e' : '#9ca3af', fontWeight: '600' }}>
                      Approve ({selectedAds.size})
                    </Text>
                  </Pressable>
                  <Pressable 
                    onPress={bulkReject} 
                    disabled={selectedAds.size === 0 || updating}
                    style={{ padding: 8 }}
                  >
                    <Text style={{ color: selectedAds.size > 0 ? '#f59e0b' : '#9ca3af', fontWeight: '600' }}>
                      Reject ({selectedAds.size})
                    </Text>
                  </Pressable>
                  <Pressable 
                    onPress={bulkDelete} 
                    disabled={selectedAds.size === 0 || updating}
                    style={{ padding: 8 }}
                  >
                    <Text style={{ color: selectedAds.size > 0 ? '#dc2626' : '#9ca3af', fontWeight: '600' }}>
                      Delete ({selectedAds.size})
                    </Text>
                  </Pressable>
                </>
              )}
              <Pressable onPress={() => setBulkMode(!bulkMode)} style={{ padding: 8 }}>
                <Ionicons 
                  name={bulkMode ? 'close' : 'checkmark-circle-outline'}
                  size={24} 
                  color={bulkMode ? '#dc2626' : theme.tint} 
                />
              </Pressable>
              <Pressable onPress={() => void router.push('/submit-ad')} style={{ padding: 8 }}>
                <Ionicons name="add-circle" size={24} color={theme.tint} />
              </Pressable>
            </View>
          )
        }} 
      />
      
      {/* Filter Tabs */}
      <View style={{ flexDirection: 'row', padding: 12, gap: 8, backgroundColor: theme.surface }}>
        {(['all', 'pending', 'approved', 'active', 'paused', 'draft'] as const).map((status) => (
          <Pressable
            key={status}
            onPress={() => setFilterStatus(status)}
            style={[
              styles.filterTab,
              {
                backgroundColor: filterStatus === status ? theme.tint : theme.card,
                borderColor: filterStatus === status ? theme.tint : theme.border
              }
            ]}
          >
            <Text style={{
              color: filterStatus === status ? '#fff' : theme.text,
              fontWeight: '600',
              fontSize: 13
            }}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== 'all' && ` (${items.filter(a => a.status === status).length})`}
            </Text>
          </Pressable>
        ))}
      </View>
      
      {loading ? (
        <View style={{ padding: 24, alignItems: 'center' }}>
          <ActivityIndicator color={theme.tint} />
        </View>
      ) : null}
      
      {error ? (
        <Text style={[styles.error, { color: '#dc2626' }]}>{error}</Text>
      ) : null}
      
      {!loading && !error && (
        <FlatList
          data={filteredItems}
          keyExtractor={(a) => String(a.id)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Ionicons name="megaphone-outline" size={64} color={theme.mutedText} />
              <Text style={{ color: theme.mutedText, fontSize: 16, marginTop: 16, textAlign: 'center' }}>
                No ads found
                {filterStatus !== 'all' && ` with status "${filterStatus}"`}
              </Text>
            </View>
          }
        />
      )}
      {/* Ad Review Modal (cross-platform replacement for Alert.prompt) */}
      <Modal visible={!!reviewModal} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 24 }}>
          <View style={{ backgroundColor: colorScheme === 'dark' ? '#1F2937' : 'white', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 8 }}>
              {reviewModal?.action === 'approve' ? 'Approve Ad' : 'Reject Ad'}
            </Text>
            <Text style={{ color: theme.mutedText, marginBottom: 12 }}>
              {reviewModal?.action === 'approve' ? 'Add an optional note for the advertiser:' : 'Add a reason for the advertiser (optional):'}
            </Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10, color: theme.text, backgroundColor: colorScheme === 'dark' ? '#111827' : '#F9FAFB', minHeight: 60, textAlignVertical: 'top' }}
              value={reviewNote}
              onChangeText={setReviewNote}
              placeholder="Note (optional)..."
              placeholderTextColor={theme.mutedText}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Pressable style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: theme.border, alignItems: 'center' }} onPress={() => setReviewModal(null)}>
                <Text style={{ color: theme.text, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: reviewModal?.action === 'approve' ? '#22c55e' : '#dc2626', alignItems: 'center' }}
                onPress={async () => {
                  if (!reviewModal) return;
                  const { adId, action } = reviewModal;
                  setReviewModal(null);
                  setReviewingAdId(adId);
                  try {
                    await AdsApi.review(adId, action, reviewNote.trim() || undefined);
                    Alert.alert('Success', `Ad ${action === 'approve' ? 'approved' : 'rejected'}`);
                    await load();
                  } catch (e: any) {
                    Alert.alert('Error', e?.message || `Failed to ${action}`);
                  } finally {
                    setReviewingAdId(null);
                  }
                }}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>{reviewModal?.action === 'approve' ? 'Approve' : 'Reject'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { 
    padding: 16, 
    borderRadius: 12, 
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  title: { fontWeight: '800', fontSize: 16, marginBottom: 4 },
  meta: { fontSize: 13, marginTop: 2 },
  badgeSmall: { 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 999, 
    borderWidth: 1 
  },
  badgeSmallText: { fontWeight: '800', fontSize: 10 },
  btn: { 
    flexDirection: 'row',
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 6,
    height: 40, 
    borderRadius: 10, 
    backgroundColor: '#111827' 
  },
  btnSecondary: { 
    backgroundColor: '#F3F4F6', 
    borderWidth: 1, 
    borderColor: '#D1D5DB' 
  },
  btnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  error: { padding: 16, textAlign: 'center', fontWeight: '600' },
  bannerPreview: { 
    width: 100, 
    height: 70, 
    borderRadius: 8, 
    backgroundColor: '#D1D5DB' 
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5
  }
});
