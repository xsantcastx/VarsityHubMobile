import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
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

  const migrateLegacyDrafts = useCallback(
    async (currentDrafts: ManagedAd[]) => {
      const baseKey = settings.SETTINGS_KEYS.LOCAL_ADS;
      const scopedKey = getLocalAdsKey();
      if (!userId) return currentDrafts;

      const legacyDrafts = await settings.getJson<ManagedAd[]>(baseKey, []);
      if (!legacyDrafts.length) return currentDrafts;

      const belongToUser = legacyDrafts.filter((draft) =>
        matchesAccount(
          {
            ...draft,
            contact_email: (draft.contact_email || '').trim().toLowerCase(),
            owner_id: draft.owner_id ?? null,
          },
          userId,
          userEmail,
        ),
      );

      if (!belongToUser.length) return currentDrafts;

      const merged = [...currentDrafts];
      belongToUser.forEach((draft) => {
        const existing = merged.find((ad) => ad.id === draft.id);
        if (!existing) {
          merged.push({
            ...draft,
            isLocal: true,
            owner_id: draft.owner_id ?? userId,
            contact_email: (draft.contact_email || '').trim().toLowerCase(),
          });
        }
      });

      await settings.setJson(
        scopedKey,
        merged.filter((ad) => ad.isLocal),
      );

      const remainingLegacy = legacyDrafts.filter((draft) => !belongToUser.includes(draft));
      await settings.setJson(baseKey, remainingLegacy);

      return merged;
    },
    [getLocalAdsKey, userId, userEmail],
  );

  const loadAds = useCallback(async () => {
    if (!userLoaded) return;
    setLoading(true);
    try {
      let serverAds: any[] = [];
      try {
        const resp = await AdsApi.listMine();
        if (Array.isArray(resp)) serverAds = resp;
      } catch {
        serverAds = [];
      }

      const scopedKey = getLocalAdsKey();
      let localDrafts = await settings.getJson<ManagedAd[]>(scopedKey, []);
      localDrafts = await migrateLegacyDrafts(localDrafts);

      const normalizedUserId = userId ? String(userId) : null;
      const normalizedEmail = userEmail || null;

      const combined: ManagedAd[] = [];
      const add = (source: any, isLocal: boolean) => {
        const id = String(source.id);
        if (!id || combined.some((ad) => ad.id === id)) return;

        const ownerId = typeof source.user_id === 'string' && source.user_id.length ? String(source.user_id) : null;
        const contactEmail = typeof source.contact_email === 'string' ? source.contact_email.trim().toLowerCase() : '';

        if (!isLocal) {
          if (!matchesAccount({ ...source, contact_email: contactEmail, owner_id: ownerId }, normalizedUserId, normalizedEmail)) {
            return;
          }
        }

        const businessName = String(source.business_name || source.name || '').trim();
        combined.push({
          id,
          business_name: businessName.length ? businessName : 'Untitled Ad',
          contact_name: String(source.contact_name || ''),
          contact_email: contactEmail,
          banner_url: source.banner_url || undefined,
          zip_code: String(source.target_zip_code || source.zip_code || ''),
          description: source.description || undefined,
          created_at: source.created_at || new Date().toISOString(),
          status: source.status || 'draft',
          payment_status: source.payment_status || 'unpaid',
          owner_id: ownerId,
          isLocal,
        });
      };

      serverAds.forEach((ad) => add(ad, false));
      localDrafts.forEach((ad) => add(ad, true));

      setAds(combined);

      const reservations = await Promise.all(
        combined.map(async (ad) => {
          try {
            const res: any = await AdsApi.reservationsForAd(ad.id);
            return [ad.id, Array.isArray(res?.dates) ? res.dates : []] as const;
          } catch {
            return [ad.id, []] as const;
          }
        }),
      );
      const dateMap: Record<string, string[]> = {};
      reservations.forEach(([id, dates]) => {
        dateMap[id] = dates;
      });
      setDatesByAd(dateMap);
    } finally {
      setLoading(false);
    }
  }, [getLocalAdsKey, migrateLegacyDrafts, userLoaded, userId, userEmail]);

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  const summary = useMemo(() => ({
    active: ads.filter((ad) => ad.status === 'active').length,
    pending: ads.filter((ad) => ad.status === 'pending').length,
    drafts: ads.filter((ad) => ad.isLocal || !ad.status || ad.status === 'draft').length,
  }), [ads]);

  const canManageAd = (ad: ManagedAd) => {
    const normalizedAdEmail = (ad.contact_email || '').trim().toLowerCase();
    return (
      ad.isLocal ||
      (userId && ad.owner_id && ad.owner_id === userId) ||
      (userEmail && normalizedAdEmail && normalizedAdEmail === userEmail)
    );
  };

  const removeLocalAd = async (id: string) => {
    Alert.alert('Remove Draft Ad', 'Removing a draft does not cancel scheduled dates.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const localKey = getLocalAdsKey();
          const list = await settings.getJson<ManagedAd[]>(localKey, []);
          const filtered = list.filter((ad) => ad.id !== id);
          await settings.setJson(localKey, filtered);
          setAds((prev) => prev.filter((ad) => ad.id !== id));
        },
      },
    ]);
  };

  const renderAd = ({ item }: { item: ManagedAd }) => {
    const dates = datesByAd[item.id] || [];
    const manageable = canManageAd(item);
    const paymentLabel = (item.payment_status || 'unpaid').toUpperCase();
    const statusLabel = (item.status || 'draft').toUpperCase();

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {item.banner_url ? (
            <Image source={{ uri: item.banner_url }} style={styles.banner} contentFit="cover" />
          ) : (
            <View style={styles.bannerPlaceholder}>
              <Text style={styles.bannerPlaceholderText}>No banner</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.business_name}</Text>
            <Text style={styles.meta}>{item.contact_name} · {item.contact_email || '—'}</Text>
            <Text style={styles.meta}>Zip {item.zip_code}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badgeSmall, badgeStyleForStatus(item.status)]}>
                <Text style={[styles.badgeSmallText, badgeTextStyleForStatus(item.status)]}>{statusLabel}</Text>
              </View>
              <View style={[styles.badgeSmall, badgeStyleForPayment(item.payment_status)]}>
                <Text style={[styles.badgeSmallText, badgeTextStyleForPayment(item.payment_status)]}>{paymentLabel}</Text>
              </View>
              {item.isLocal && (
                <View style={[styles.badgeSmall, styles.localBadge]}>
                  <Text style={[styles.badgeSmallText, { color: '#0369A1' }]}>LOCAL DRAFT</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Scheduled Dates</Text>
        {dates.length > 0 ? (
          <View style={styles.dateWrap}>
            {dates.map((d) => {
              let label = d;
              try {
                label = new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
              } catch {}
              return (
                <View key={d} style={styles.dateBadge}>
                  <Text style={styles.dateBadgeText}>{label}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.muted}>None yet</Text>
        )}

        <View style={styles.actions}>
          <Pressable
            style={[styles.primaryButton, !manageable && styles.disabledButton]}
            onPress={() => {
              if (!manageable) {
                Alert.alert('View only', 'This ad belongs to another account. Contact support for changes.');
                return;
              }
              router.push({ pathname: '/ad-calendar', params: { adId: item.id } });
            }}
          >
            <Text style={styles.primaryButtonText}>Schedule Dates</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, !manageable && styles.disabledButton]}
            onPress={() => {
              if (!manageable) {
                Alert.alert('View only', 'This ad belongs to another account. Contact support for changes.');
                return;
              }
              router.push({ pathname: '/edit-ad', params: { id: item.id } });
            }}
          >
            <Text style={styles.secondaryButtonText}>Edit</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, (!item.isLocal) && styles.disabledButton]}
            onPress={() => {
              if (!item.isLocal) {
                Alert.alert('Managed by server', 'Live ads cannot be removed here. Contact support to archive the ad.');
                return;
              }
              removeLocalAd(item.id);
            }}
          >
            <Text style={styles.secondaryButtonText}>Remove</Text>
          </Pressable>
        </View>

        {!manageable && (
          <Text style={[styles.muted, { marginTop: 8 }]}>
            This ad is read-only because it belongs to another account. Contact support if you need changes.
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'My Ads' }} />
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator />
        </View>
      )}
      {!loading && ads.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.muted}>No ads yet. Create your first ad.</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.push('/submit-ad')}>
            <Text style={styles.primaryButtonText}>Submit Ad</Text>
          </Pressable>
        </View>
      ) : null}
      {!loading && ads.length > 0 && (
        <FlatList
          data={ads}
          keyExtractor={(ad) => ad.id}
          renderItem={renderAd}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ListHeaderComponent={() => (
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Ad Overview</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Active</Text>
                <Text style={styles.summaryValue}>{summary.active}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Pending</Text>
                <Text style={styles.summaryValue}>{summary.pending}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Draft / Local</Text>
                <Text style={styles.summaryValue}>{summary.drafts}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

function badgeStyleForStatus(status?: string) {
  const s = String(status || 'draft').toLowerCase();
  if (s === 'active') return { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' };
  if (s === 'pending') return { backgroundColor: '#FEF9C3', borderColor: '#FDE68A' };
  if (s === 'archived') return { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' };
  return { backgroundColor: '#E0E7FF', borderColor: '#C7D2FE' };
}
function badgeTextStyleForStatus(status?: string) {
  const s = String(status || 'draft').toLowerCase();
  if (s === 'active') return { color: '#166534' };
  if (s === 'pending') return { color: '#92400E' };
  if (s === 'archived') return { color: '#374151' };
  return { color: '#3730A3' };
}
function badgeStyleForPayment(payment?: string) {
  const s = String(payment || 'unpaid').toLowerCase();
  if (s === 'paid') return { backgroundColor: '#DBEAFE', borderColor: '#BFDBFE' };
  if (s === 'refunded') return { backgroundColor: '#FFE4E6', borderColor: '#FECDD3' };
  return { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' };
}
function badgeTextStyleForPayment(payment?: string) {
  const s = String(payment || 'unpaid').toLowerCase();
  if (s === 'paid') return { color: '#1D4ED8' };
  if (s === 'refunded') return { color: '#991B1B' };
  return { color: '#991B1B' };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loading: { padding: 24, alignItems: 'center' },
  emptyState: { padding: 16, gap: 12, alignItems: 'center' },
  card: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  cardHeader: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  banner: { width: 120, height: 66, borderRadius: 8, backgroundColor: '#E5E7EB' },
  bannerPlaceholder: {
    width: 120,
    height: 66,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerPlaceholderText: { color: '#6B7280', fontWeight: '600' },
  title: { fontWeight: '800', fontSize: 16 },
  meta: { color: '#6B7280', marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeSmallText: { fontWeight: '800', fontSize: 10 },
  localBadge: { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' },
  sectionHeading: { fontWeight: '700', marginBottom: 6 },
  dateWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dateBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F3F4F6' },
  dateBadgeText: { fontWeight: '700', fontSize: 12, color: '#111827' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  primaryButton: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800' },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: { color: '#111827', fontWeight: '800' },
  disabledButton: { opacity: 0.45 },
  muted: { color: '#6B7280' },
  summary: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  summaryTitle: { fontWeight: '800', fontSize: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: '#4B5563', fontWeight: '600' },
  summaryValue: { color: '#111827', fontWeight: '800' },
});
