import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, FlatList } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
// @ts-ignore
import { Advertisement as AdsApi, User } from '@/api/entities';

export default function AdminAdsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      try { const u = await User.me(); setMe(u); } catch {}
      const list = await AdsApi.listAll();
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.status === 403 ? 'Access denied (admin only).' : (e?.message || 'Failed to load ads'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }: { item: any }) => (
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
          <Text style={styles.title}>{item.business_name || '(no name)'}</Text>
          <Text style={styles.meta}>{item.contact_name || ''} · {item.contact_email || ''}</Text>
          <Text style={styles.meta}>Zip {item.target_zip_code || ''}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
            <View style={[styles.badgeSmall, { backgroundColor: '#E5E7EB', borderColor: '#D1D5DB' }]}><Text style={styles.badgeSmallText}>{String(item.status || 'draft').toUpperCase()}</Text></View>
            <View style={[styles.badgeSmall, { backgroundColor: '#E5E7EB', borderColor: '#D1D5DB' }]}><Text style={styles.badgeSmallText}>{String(item.payment_status || 'unpaid').toUpperCase()}</Text></View>
          </View>
        </View>
      </View>
      <View style={{ height: 8 }} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable style={styles.btn} onPress={() => router.push({ pathname: '/ad-calendar', params: { adId: item.id } })}>
          <Text style={styles.btnText}>Schedule</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => router.push({ pathname: '/edit-ad', params: { id: item.id } })}>
          <Text style={[styles.btnText, { color: '#111827' }]}>Edit</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Admin · All Ads' }} />
      {loading ? <View style={{ padding: 24, alignItems: 'center' }}><ActivityIndicator /></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && (
        <FlatList
          data={items}
          keyExtractor={(a) => String(a.id)}
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
  badgeSmall: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  badgeSmallText: { fontWeight: '800', fontSize: 10 },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 42, borderRadius: 10, backgroundColor: '#111827' },
  btnSecondary: { backgroundColor: '#F3F4F6', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  btnText: { color: 'white', fontWeight: '800' },
  error: { color: '#b91c1c', padding: 12 },
  bannerPreview: { width: 120, height: 60, borderRadius: 8, backgroundColor: '#E5E7EB' },
});

