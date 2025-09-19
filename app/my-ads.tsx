import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Alert, FlatList } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
// @ts-ignore
import { Advertisement as AdsApi } from '@/api/entities';
import settings from '@/api/settings';

type DraftAd = {
  id: string;
  business_name: string;
  contact_name: string;
  contact_email: string;
  banner_url?: string;
  zip_code: string;
  description?: string;
  created_at: string;
};

export default function MyAdsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [ads, setAds] = useState<DraftAd[]>([]);
  const [datesByAd, setDatesByAd] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let serverAds: any[] | null = null;
      try {
        const s = await AdsApi.listMine();
        serverAds = Array.isArray(s) ? s : [];
      } catch { serverAds = null; }

      const localAds = await settings.getJson<DraftAd[]>(settings.SETTINGS_KEYS.LOCAL_ADS, []);
      const combined: DraftAd[] = [];
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
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    Alert.alert('Remove Ad', 'This removes the local draft only. Scheduled dates remain.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const list = await settings.getJson<DraftAd[]>(settings.SETTINGS_KEYS.LOCAL_ADS, []);
        const next = list.filter((a) => a.id !== id);
        await settings.setJson(settings.SETTINGS_KEYS.LOCAL_ADS, next);
        setAds(next);
      }}
    ]);
  };

  const renderItem = ({ item }: { item: DraftAd }) => {
    const dates = datesByAd[item.id] || [];
    return (
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {item.banner_url ? (
            <Image source={{ uri: item.banner_url }} style={styles.bannerPreview} contentFit="cover" />
          ) : (
            <View style={[styles.bannerPreview, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' }]}>
              <Text style={{ color: '#6b7280' }}>No banner</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.business_name}</Text>
            <Text style={styles.meta}>{item.contact_name} � {item.contact_email}</Text>
            <Text style={styles.meta}>Zip {item.zip_code}</Text>
          </View>
        </View>
        <View style={{ height: 8 }} />
        <Text style={styles.section}>Scheduled Dates</Text>
        {dates.length > 0 ? (
          <View style={styles.badgeWrap}>
            {dates.map((d) => {
              let label = d;
              try { label = new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch {}
              return (
                <View key={d} style={styles.badge}><Text style={styles.badgeText}>{label}</Text></View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.muted}>None yet</Text>
        )}
        <View style={styles.row}>
          <Pressable style={styles.btn} onPress={() => router.push({ pathname: '/ad-calendar', params: { adId: item.id } })}>
            <Text style={styles.btnText}>Schedule Dates</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => remove(item.id)}>
            <Text style={[styles.btnText, { color: '#111827' }]}>Remove</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'My Ads' }} />
      {loading && <View style={{ padding: 24, alignItems: 'center' }}><ActivityIndicator /></View>}
      {!loading && ads.length === 0 ? (
        <View style={{ padding: 16 }}>
          <Text style={styles.muted}>No ads yet. Create your first ad.</Text>
          <View style={{ height: 8 }} />
          <Pressable style={styles.btn} onPress={() => router.push('/submit-ad')}>
            <Text style={styles.btnText}>Submit Ad</Text>
          </Pressable>
        </View>
      ) : null}
      {!loading && ads.length > 0 && (
        <FlatList
          data={ads}
          keyExtractor={(a) => a.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  card: { padding: 12, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  title: { fontWeight: '800', fontSize: 16 },
  meta: { color: '#6b7280' },
  section: { fontWeight: '700', marginBottom: 6 },
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F3F4F6' },
  badgeText: { fontWeight: '700', fontSize: 12, color: '#111827' },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 42, borderRadius: 10, backgroundColor: '#111827' },
  btnSecondary: { backgroundColor: '#F3F4F6', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  btnText: { color: 'white', fontWeight: '800' },
  muted: { color: '#6b7280' },
  bannerPreview: { width: 120, height: 60, borderRadius: 8, backgroundColor: '#E5E7EB' },
});

