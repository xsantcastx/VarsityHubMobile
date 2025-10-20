import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { Advertisement as AdsApi, User } from '@/api/entities';
import settings from '@/api/settings';

type ManagedAd = {
  id: string;
  business_name: string;
  contact_name: string;
  contact_email: string;
  banner_url?: string;
  zip_code: string;
  description?: string;
  created_at: string;
  status?: string;
  payment_status?: string;
  owner_id?: string | null;
  isLocal?: boolean;
};

function matchesAccount(ad: ManagedAd, userId: string | null, userEmail: string | null) {
  const normalizedAdEmail = (ad.contact_email || '').trim().toLowerCase();
  if (userId && ad.owner_id && ad.owner_id === userId) return true;
  if (userEmail && normalizedAdEmail && normalizedAdEmail === userEmail) return true;
  return false;
}

export default function MyAdsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const [loading, setLoading] = useState(true);
  const [ads, setAds] = useState<ManagedAd[]>([]);
  const [datesByAd, setDatesByAd] = useState<Record<string, string[]>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me: any = await User.me();
        if (!mounted) return;
        setUserId(me?.id ? String(me.id) : null);
        const email = typeof me?.email === 'string' ? me.email.trim().toLowerCase() : null;
        setUserEmail(email && email.length ? email : null);
      } catch {
        if (!mounted) return;
        setUserId(null);
        setUserEmail(null);
      } finally {
        if (mounted) setUserLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const getLocalAdsKey = useCallback(() => {
    const base = settings.SETTINGS_KEYS.LOCAL_ADS;
    return userId ? `${base}_${userId}` : base;
  }, [userId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let serverAds: any[] | null = null;
      try {
        const s = await AdsApi.listMine();
        serverAds = Array.isArray(s) ? s : [];
      } catch { serverAds = null; }

      const localAds = await settings.getJson<ManagedAd[]>(getLocalAdsKey(), []);
      const combined: ManagedAd[] = [];
      const add = (a: any) => {
        const id = String(a.id);
        if (combined.find((x) => x.id === id)) return;
        combined.push({
          id,
          business_name: String(a.business_name || a.name || ''),
          contact_name: String(a.contact_name || ''),
          contact_email: String(a.contact_email || ''),
          banner_url: a.banner_url || undefined,
          zip_code: String(a.target_zip_code || a.zip_code || ''),
          description: a.description || undefined,
          created_at: a.created_at || new Date().toISOString(),
          status: a.status,
          payment_status: a.payment_status,
          owner_id: a.owner_id,
        });
      };
      if (serverAds) serverAds.forEach(add);
      localAds.forEach(add);
      setAds(combined);

      const entries = await Promise.all(
        combined.map(async (ad) => {
          try {
            const r: any = await AdsApi.reservationsForAd(ad.id);
            return [ad.id, Array.isArray(r?.dates) ? r.dates : []] as const;
          } catch { return [ad.id, []] as const; }
        })
      );
      const map: Record<string, string[]> = {};
      for (const [id, dates] of entries) map[id] = dates;
      setDatesByAd(map);
    } finally { setLoading(false); }
  }, [getLocalAdsKey]);

  useEffect(() => {
    if (userLoaded) {
      load();
    }
  }, [userLoaded, load]);

  const remove = async (id: string) => {
    Alert.alert(
      'Delete Ad', 
      'This will permanently delete the ad and all its scheduled dates. This action cannot be undone.', 
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              // Delete from server
              console.log('[my-ads2] Deleting ad from server:', id);
              await AdsApi.delete(id);
              console.log('[my-ads2] Ad deleted from server successfully');
              
              // Also remove from local storage
              const list = await settings.getJson<ManagedAd[]>(settings.SETTINGS_KEYS.LOCAL_ADS, []);
              const next = list.filter((a) => a.id !== id);
              await settings.setJson(settings.SETTINGS_KEYS.LOCAL_ADS, next);
              
              // Reload the list
              await load();
              
              Alert.alert('Success', 'Ad deleted successfully');
            } catch (error) {
              console.error('[my-ads2] Error deleting ad:', error);
              Alert.alert('Error', 'Failed to delete ad. Please try again.');
            }
          }
        }
      ]
    );
  };

  const categorizeAdDates = (dates: string[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const past: string[] = [];
    const future: string[] = [];
    
    dates.forEach(dateStr => {
      try {
        const date = new Date(dateStr + 'T00:00:00');
        if (date < today) {
          past.push(dateStr);
        } else {
          future.push(dateStr);
        }
      } catch {
        // If date parsing fails, assume future
        future.push(dateStr);
      }
    });
    
    return { past, future };
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return d;
    }
  };

  const renderAd = ({ item }: { item: ManagedAd }) => {
    const dates = datesByAd[item.id] || [];
    const { past, future } = categorizeAdDates(dates);
    const hasCompleted = past.length > 0;
    const hasUpcoming = future.length > 0;
    const hasDates = dates.length > 0;
    const isPaid = item.payment_status === 'paid';
    const isActive = item.status === 'active';
    
    return (
      <View style={[styles.card, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
        {/* Banner Section */}
        <View style={styles.bannerContainer}>
          {item.banner_url ? (
            <Image source={{ uri: item.banner_url }} style={styles.banner} contentFit="cover" />
          ) : (
            <View style={[styles.banner, styles.bannerPlaceholder, { backgroundColor: Colors[colorScheme].surface }]}>
              <Ionicons name="image-outline" size={40} color={Colors[colorScheme].mutedText} />
              <Text style={[styles.bannerPlaceholderText, { color: Colors[colorScheme].mutedText }]}>No banner</Text>
            </View>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoContainer}>
          <Text style={[styles.businessName, { color: Colors[colorScheme].text }]}>{item.business_name}</Text>
          
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={14} color={Colors[colorScheme].mutedText} />
            <Text style={[styles.metaText, { color: Colors[colorScheme].mutedText }]}>{item.contact_name}</Text>
          </View>
          
          <View style={styles.metaRow}>
            <Ionicons name="mail-outline" size={14} color={Colors[colorScheme].mutedText} />
            <Text style={[styles.metaText, { color: Colors[colorScheme].mutedText }]}>{item.contact_email}</Text>
          </View>
          
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={Colors[colorScheme].mutedText} />
            <Text style={[styles.metaText, { color: Colors[colorScheme].mutedText }]}>Zip {item.zip_code}</Text>
          </View>

          {/* Status Badges */}
          <View style={styles.badgesContainer}>
            <View style={[styles.badge, badgeStyleForStatus(item.status, colorScheme)]}>
              <Text style={[styles.badgeText, badgeTextStyleForStatus(item.status)]}>
                {(item.status || 'draft').toUpperCase()}
              </Text>
            </View>
            <View style={[styles.badge, badgeStyleForPayment(item.payment_status, colorScheme)]}>
              <Text style={[styles.badgeText, badgeTextStyleForPayment(item.payment_status)]}>
                {(item.payment_status || 'unpaid').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Dates Section */}
        <View style={[styles.datesSection, { borderTopColor: Colors[colorScheme].border }]}>
          {/* Completed Dates */}
          {hasCompleted && (
            <>
              <View style={styles.datesSectionHeader}>
                <Text style={[styles.datesSectionTitle, { color: Colors[colorScheme].text }]}>
                  Completed ✅ ({past.length})
                </Text>
              </View>
              <View style={styles.datesBadgeWrap}>
                {past.slice(0, 5).map((d) => (
                  <View 
                    key={d} 
                    style={[
                      styles.dateBadge, 
                      styles.dateBadgeCompleted,
                      colorScheme === 'dark' && styles.dateBadgeCompletedDark,
                      { borderColor: Colors[colorScheme].border }
                    ]}
                  >
                    <Text style={[styles.dateBadgeText, styles.dateBadgeTextCompleted]}>
                      {formatDate(d)}
                    </Text>
                  </View>
                ))}
                {past.length > 5 && (
                  <View style={[styles.dateBadge, styles.dateBadgeCompleted, colorScheme === 'dark' && styles.dateBadgeCompletedDark]}>
                    <Text style={[styles.dateBadgeText, styles.dateBadgeTextCompleted]}>+{past.length - 5}</Text>
                  </View>
                )}
              </View>
              <View style={{ height: 10 }} />
            </>
          )}
          
          {/* Upcoming Dates */}
          {hasUpcoming && (
            <>
              <View style={styles.datesSectionHeader}>
                <Text style={[styles.datesSectionTitle, { color: Colors[colorScheme].text }]}>
                  Upcoming 📅 ({future.length})
                </Text>
              </View>
              <View style={styles.datesBadgeWrap}>
                {future.slice(0, 5).map((d) => (
                  <View 
                    key={d} 
                    style={[
                      styles.dateBadge, 
                      styles.dateBadgeUpcoming,
                      colorScheme === 'dark' && styles.dateBadgeUpcomingDark,
                      { borderColor: Colors[colorScheme].border }
                    ]}
                  >
                    <Text style={[styles.dateBadgeText, styles.dateBadgeTextUpcoming]}>
                      {formatDate(d)}
                    </Text>
                  </View>
                ))}
                {future.length > 5 && (
                  <View style={[styles.dateBadge, styles.dateBadgeUpcoming, colorScheme === 'dark' && styles.dateBadgeUpcomingDark]}>
                    <Text style={[styles.dateBadgeText, styles.dateBadgeTextUpcoming]}>+{future.length - 5}</Text>
                  </View>
                )}
              </View>
              <View style={{ height: 10 }} />
            </>
          )}
          
          {/* No Dates */}
          {!hasDates && (
            <>
              <View style={styles.datesSectionHeader}>
                <Ionicons name="calendar-outline" size={16} color={Colors[colorScheme].text} />
                <Text style={[styles.datesSectionTitle, { color: Colors[colorScheme].text }]}>Scheduled Dates</Text>
                <View style={[styles.datesCount, { backgroundColor: Colors[colorScheme].surface }]}>
                  <Text style={[styles.datesCountText, { color: Colors[colorScheme].text }]}>0</Text>
                </View>
              </View>
              <Text style={[styles.noDatesText, { color: Colors[colorScheme].mutedText }]}>No dates scheduled yet</Text>
            </>
          )}
        </View>

        {/* Actions Section */}
        <View style={styles.actionsContainer}>
          <Pressable 
            style={[styles.actionButton, styles.actionButtonPrimary, { backgroundColor: Colors[colorScheme].tint }]} 
            onPress={() => router.push({ pathname: '/ad-calendar', params: { adId: item.id } })}
          >
            <Ionicons name="calendar" size={18} color="#FFFFFF" />
            <Text style={styles.actionButtonTextPrimary}>
              {hasDates ? 'Schedule More' : 'Schedule'}
            </Text>
          </Pressable>
          
          <Pressable 
            style={[styles.actionButton, styles.actionButtonSecondary, { 
              backgroundColor: Colors[colorScheme].surface,
              borderColor: Colors[colorScheme].border
            }]} 
            onPress={() => router.push({ pathname: '/edit-ad', params: { id: item.id } })}
          >
            <Ionicons name="create-outline" size={18} color={Colors[colorScheme].text} />
            <Text style={[styles.actionButtonTextSecondary, { color: Colors[colorScheme].text }]}>Edit</Text>
          </Pressable>
          
          <Pressable 
            style={[styles.actionButton, styles.actionButtonSecondary, { 
              backgroundColor: Colors[colorScheme].surface,
              borderColor: Colors[colorScheme].border
            }]} 
            onPress={() => remove(item.id)}
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
            <Text style={[styles.actionButtonTextSecondary, { color: '#EF4444' }]}>Remove</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ 
        title: 'My Ads',
        headerShown: false // Use custom header
      }} />
      
      {/* Custom Header */}
      <View style={[styles.header, { 
        backgroundColor: Colors[colorScheme].card,
        borderBottomColor: Colors[colorScheme].border 
      }]}>
        <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]}>My Ads</Text>
        <Pressable 
          style={[styles.addButton, { backgroundColor: Colors[colorScheme].tint }]}
          onPress={() => router.push('/submit-ad')}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            <Text style={[styles.loadingText, { color: Colors[colorScheme].mutedText }]}>Loading your ads...</Text>
          </View>
        )}
        
        {!loading && ads.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="megaphone-outline" size={80} color={Colors[colorScheme].mutedText} />
            <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>No Ads Yet</Text>
            <Text style={[styles.emptyText, { color: Colors[colorScheme].mutedText }]}>
              Create your first advertisement to start promoting your business to local teams and families.
            </Text>
            <Pressable 
              style={[styles.emptyButton, { backgroundColor: Colors[colorScheme].tint }]} 
              onPress={() => router.push('/submit-ad')}
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Create Your First Ad</Text>
            </Pressable>
          </View>
        ) : null}
        
        {!loading && ads.length > 0 && (
          <FlatList
            data={ads}
            keyExtractor={(a) => a.id}
            renderItem={renderAd}
            ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
            contentContainerStyle={{ 
              padding: 16, 
              paddingBottom: Platform.OS === 'ios' ? 34 : 24 
            }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function badgeStyleForStatus(status?: string, colorScheme: 'light' | 'dark' = 'light') {
  const s = String(status || 'draft');
  if (s === 'active') return { backgroundColor: colorScheme === 'dark' ? '#065F46' : '#DCFCE7', borderColor: colorScheme === 'dark' ? '#10B981' : '#86EFAC' };
  if (s === 'pending') return { backgroundColor: colorScheme === 'dark' ? '#92400E' : '#FEF9C3', borderColor: colorScheme === 'dark' ? '#FBBF24' : '#FDE68A' };
  if (s === 'archived') return { backgroundColor: colorScheme === 'dark' ? '#374151' : '#F3F4F6', borderColor: colorScheme === 'dark' ? '#6B7280' : '#E5E7EB' };
  return { backgroundColor: colorScheme === 'dark' ? '#1E3A8A' : '#E0E7FF', borderColor: colorScheme === 'dark' ? '#3B82F6' : '#C7D2FE' }; // draft
}
function badgeTextStyleForStatus(status?: string) {
  const s = String(status || 'draft');
  if (s === 'active') return { color: '#10B981' };
  if (s === 'pending') return { color: '#F59E0B' };
  if (s === 'archived') return { color: '#6B7280' };
  return { color: '#3B82F6' };
}
function badgeStyleForPayment(p?: string, colorScheme: 'light' | 'dark' = 'light') {
  const s = String(p || 'unpaid');
  if (s === 'paid') return { backgroundColor: colorScheme === 'dark' ? '#1E3A8A' : '#DBEAFE', borderColor: colorScheme === 'dark' ? '#3B82F6' : '#BFDBFE' };
  if (s === 'refunded') return { backgroundColor: colorScheme === 'dark' ? '#7F1D1D' : '#FFE4E6', borderColor: colorScheme === 'dark' ? '#EF4444' : '#FECDD3' };
  return { backgroundColor: colorScheme === 'dark' ? '#7F1D1D' : '#FEE2E2', borderColor: colorScheme === 'dark' ? '#EF4444' : '#FCA5A5' }; // unpaid
}
function badgeTextStyleForPayment(p?: string) { 
  const s = String(p || 'unpaid');
  if (s === 'paid') return { color: '#3B82F6' };
  if (s === 'refunded') return { color: '#EF4444' };
  return { color: '#EF4444' };
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 14 : 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  bannerContainer: {
    width: '100%',
    height: 140,
    position: 'relative',
  },
  banner: {
    width: '100%',
    height: '100%',
  },
  bannerPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },
  bannerPlaceholderText: {
    marginTop: 6,
    fontSize: 12,
    color: '#6B7280',
  },
  infoContainer: {
    padding: 16,
  },
  businessName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  metaText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  badgesContainer: {
    flexDirection: 'row',
    marginTop: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  datesSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  datesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  datesSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    flex: 1,
  },
  datesCount: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  datesCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  datesBadgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB',
  },
  dateBadgeCompleted: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  dateBadgeCompletedDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  dateBadgeUpcoming: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
  },
  dateBadgeUpcomingDark: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3B82F6',
  },
  dateBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  dateBadgeTextCompleted: {
    color: '#065F46',
    fontWeight: '600',
  },
  dateBadgeTextUpcoming: {
    color: '#1E40AF',
    fontWeight: '600',
  },
  noDatesText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  actionsContainer: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  actionButtonPrimary: {
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  actionButtonSecondary: {
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  actionButtonTextPrimary: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonTextSecondary: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  emptyButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
