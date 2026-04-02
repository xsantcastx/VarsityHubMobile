import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { Advertisement as AdsApi, User } from '@/api/entities';
import settings from '@/api/settings';
import { safeGoBack } from '@/utils/navigation';

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

function MyAdsScreen() {
  const router = useRouter();
  const { payment_success } = useLocalSearchParams<{ payment_success?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const [loading, setLoading] = useState(true);
  const [ads, setAds] = useState<ManagedAd[]>([]);
  const [datesByAd, setDatesByAd] = useState<Record<string, string[]>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const successOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const me: any = await User.me();
        if (!mounted) return;
        setUserId(me?.id ? String(me.id) : null);
      } catch {
        if (!mounted) return;
        setUserId(null);
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
    setLoadError(null);
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
    } catch (e: any) {
      if (__DEV__) console.error('[my-ads] Error loading ads:', e);
      setLoadError('Unable to load your ads. Please try again.');
    } finally { setLoading(false); }
  }, [getLocalAdsKey]);

  useEffect(() => {
    if (userLoaded) {
      void load();
    }
  }, [userLoaded, load]);

  // Auto-refresh when screen regains focus (e.g. after payment)
  useFocusEffect(
    useCallback(() => {
      if (userLoaded) void load();
    }, [userLoaded, load])
  );

  useEffect(() => {
    if (payment_success === 'true') {
      setShowSuccess(true);
      successOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(successOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1100),
        Animated.timing(successOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setShowSuccess(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- successOpacity is an Animated.Value (ref-like), adding it causes infinite loops
  }, [payment_success]);

  const remove = async (id: string) => {
    Alert.alert(
      'Delete Ad', 
      'This will permanently remove your ad. Your payment is non-refundable. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => {
            void (async () => {
              try {
                // Delete from server
                await AdsApi.delete(id);
                
                // Also remove from local storage (both scoped and base keys)
                const scopedKey = getLocalAdsKey();
                const scopedList = await settings.getJson<ManagedAd[]>(scopedKey, []);
                await settings.setJson(scopedKey, scopedList.filter((a) => a.id !== id));

                // Also clean base key in case legacy entries exist
                const baseKey = settings.SETTINGS_KEYS.LOCAL_ADS;
                if (baseKey !== scopedKey) {
                  const baseList = await settings.getJson<ManagedAd[]>(baseKey, []);
                  await settings.setJson(baseKey, baseList.filter((a) => a.id !== id));
                }
                
                // Reload the list
                await load();
                
                Alert.alert('Success', 'Ad deleted successfully');
              } catch (error) {
                if (__DEV__) console.error('[my-ads2] Error deleting ad:', error);
                Alert.alert('Error', 'Failed to delete ad. Please try again.');
              }
            })();
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
    
    return (
      <View style={[styles.card, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
        {/* Banner Section */}
        <View style={styles.bannerContainer}>
          {item.banner_url ? (
            <Image source={{ uri: item.banner_url }} style={styles.banner} contentFit="cover" />
          ) : (
            <View style={[styles.banner, styles.bannerPlaceholder, { backgroundColor: Colors[colorScheme].surface }]}>
              <MaterialIcons name="image" size={40} color={Colors[colorScheme].mutedText} />
              <Text style={[styles.bannerPlaceholderText, { color: Colors[colorScheme].mutedText }]}>No banner</Text>
            </View>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoContainer}>
          <Text style={[styles.businessName, { color: Colors[colorScheme].text }]}>{item.business_name}</Text>
          
          <View style={styles.metaRow}>
            <MaterialIcons name="person-outline" size={14} color={Colors[colorScheme].mutedText} />
            <Text style={[styles.metaText, { color: Colors[colorScheme].mutedText }]}>{item.contact_name}</Text>
          </View>
          
          <View style={styles.metaRow}>
            <MaterialIcons name="mail-outline" size={14} color={Colors[colorScheme].mutedText} />
            <Text style={[styles.metaText, { color: Colors[colorScheme].mutedText }]}>{item.contact_email}</Text>
          </View>
          
          <View style={styles.metaRow}>
            <MaterialIcons name="location-on" size={14} color={Colors[colorScheme].mutedText} />
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
                <MaterialIcons name="event" size={16} color={Colors[colorScheme].text} />
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
            onPress={() => { void router.push({ pathname: '/ad-calendar', params: { adId: item.id, isPaid: String(isPaid) } }); }}
          >
            <MaterialIcons name="event" size={18} color="#FFFFFF" />
            <Text style={styles.actionButtonTextPrimary}>
              {isPaid && hasDates ? '✓ Paid - Schedule More' : hasDates ? 'Schedule More' : 'Schedule Dates'}
            </Text>
          </Pressable>
          
          <Pressable 
            style={[styles.actionButton, styles.actionButtonSecondary, { 
              backgroundColor: Colors[colorScheme].surface,
              borderColor: Colors[colorScheme].border
            }]} 
            onPress={() => { void router.push({ pathname: '/edit-ad', params: { id: item.id } }); }}
          >
            <MaterialIcons name="edit" size={18} color={Colors[colorScheme].text} />
            <Text style={[styles.actionButtonTextSecondary, { color: Colors[colorScheme].text }]}>Edit</Text>
          </Pressable>
          
          <Pressable 
            style={[styles.actionButton, styles.actionButtonSecondary, { 
              backgroundColor: Colors[colorScheme].surface,
              borderColor: Colors[colorScheme].border
            }]} 
            onPress={() => remove(item.id)}
          >
            <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
            <Text style={[styles.actionButtonTextSecondary, { color: '#EF4444' }]}>Remove</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, {
        backgroundColor: Colors[colorScheme].card,
        borderBottomColor: Colors[colorScheme].border
      }]}>
        <Pressable onPress={() => { safeGoBack(router); }} hitSlop={8} style={{ padding: 4 }}>
          <MaterialIcons name="chevron-left" size={24} color={Colors[colorScheme].text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: Colors[colorScheme].text, flex: 1 }]}>My Ads</Text>
        <Pressable 
          style={[styles.addButton, { backgroundColor: Colors[colorScheme].tint }]}
          onPress={() => { void router.push('/submit-ad'); }}
        >
          <MaterialIcons name="add" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            <Text style={[styles.loadingText, { color: Colors[colorScheme].mutedText }]}>Loading your ads...</Text>
          </View>
        )}
        
        {!loading && loadError && (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="error-outline" size={64} color="#EF4444" />
            <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>Something went wrong</Text>
            <Text style={[styles.emptyText, { color: Colors[colorScheme].mutedText }]}>{loadError}</Text>
            <Pressable
              style={[styles.emptyButton, { backgroundColor: Colors[colorScheme].tint }]}
              onPress={() => void load()}
            >
              <Text style={styles.emptyButtonText}>Try Again</Text>
            </Pressable>
          </View>
        )}

        {!loading && !loadError && ads.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="campaign" size={80} color={Colors[colorScheme].mutedText} />
            <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>No Ads Yet</Text>
            <Text style={[styles.emptyText, { color: Colors[colorScheme].mutedText }]}>
              Create your first advertisement to start promoting your business to local teams and families.
            </Text>
            <Pressable 
              style={[styles.emptyButton, { backgroundColor: Colors[colorScheme].tint }]} 
              onPress={() => { void router.push('/submit-ad'); }}
            >
              <MaterialIcons name="add-circle-outline" size={20} color="#FFFFFF" />
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

      {showSuccess && (
        <Animated.View style={[styles.successOverlay, { opacity: successOpacity }]} pointerEvents="none">
          <View style={styles.successBadge}>
            <Text style={[styles.successCheck, { color: Colors[colorScheme].text }]}>✓</Text>
            <Text style={[styles.successLabel, { color: Colors[colorScheme].text }]}>Payment Successful</Text>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

function badgeStyleForStatus(status?: string, colorScheme: 'light' | 'dark' = 'light') {
  const s = String(status || 'draft');
  if (s === 'active') return { backgroundColor: colorScheme === 'dark' ? '#065F46' : '#DCFCE7', borderColor: colorScheme === 'dark' ? '#10B981' : '#86EFAC' };
  if (s === 'approved') return { backgroundColor: colorScheme === 'dark' ? '#064E3B' : '#D1FAE5', borderColor: colorScheme === 'dark' ? '#34D399' : '#6EE7B7' };
  if (s === 'pending') return { backgroundColor: colorScheme === 'dark' ? '#92400E' : '#FEF9C3', borderColor: colorScheme === 'dark' ? '#FBBF24' : '#FDE68A' };
  if (s === 'rejected') return { backgroundColor: colorScheme === 'dark' ? '#7F1D1D' : '#FEE2E2', borderColor: colorScheme === 'dark' ? '#EF4444' : '#FCA5A5' };
  if (s === 'archived') return { backgroundColor: colorScheme === 'dark' ? '#374151' : '#F3F4F6', borderColor: colorScheme === 'dark' ? '#6B7280' : '#D1D5DB' };
  return { backgroundColor: colorScheme === 'dark' ? '#1E3A8A' : '#E0E7FF', borderColor: colorScheme === 'dark' ? '#3B82F6' : '#C7D2FE' }; // draft
}
function badgeTextStyleForStatus(status?: string) {
  const s = String(status || 'draft');
  if (s === 'active') return { color: '#10B981' };
  if (s === 'approved') return { color: '#059669' };
  if (s === 'pending') return { color: '#F59E0B' };
  if (s === 'rejected') return { color: '#EF4444' };
  if (s === 'archived') return { color: '#6B7280' };
  return { color: '#3B82F6' };
}
function badgeStyleForPayment(p?: string, colorScheme: 'light' | 'dark' = 'light') {
  const s = String(p || 'unpaid');
  if (s === 'paid') return { backgroundColor: colorScheme === 'dark' ? '#1E3A8A' : '#DBEAFE', borderColor: colorScheme === 'dark' ? '#3B82F6' : '#BFDBFE' };
  if (s === 'hold') return { backgroundColor: colorScheme === 'dark' ? '#92400E' : '#FEF3C7', borderColor: colorScheme === 'dark' ? '#F59E0B' : '#FCD34D' };
  if (s === 'refunded') return { backgroundColor: colorScheme === 'dark' ? '#7F1D1D' : '#FFE4E6', borderColor: colorScheme === 'dark' ? '#EF4444' : '#FECDD3' };
  return { backgroundColor: colorScheme === 'dark' ? '#7F1D1D' : '#FEE2E2', borderColor: colorScheme === 'dark' ? '#EF4444' : '#FCA5A5' }; // unpaid
}
function badgeTextStyleForPayment(p?: string) { 
  const s = String(p || 'unpaid');
  if (s === 'paid') return { color: '#3B82F6' };
  if (s === 'hold') return { color: '#F59E0B' };
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
    borderBottomWidth: 1,
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
    borderWidth: 1,
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
    backgroundColor: '#D1D5DB',
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
    borderTopWidth: 1,
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
    borderWidth: 1,
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
    borderTopWidth: 1,
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
    borderRightWidth: 1,
  },
  actionButtonSecondary: {
    borderRightWidth: 1,
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
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 100,
  },
  successBadge: {
    backgroundColor: '#FFD700',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 48,
    alignItems: 'center',
    gap: 8,
  },
  successCheck: {
    fontSize: 52,
    fontWeight: '800',
  },
  successLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
});
