import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getApiBaseUrl } from '../api/http';
// @ts-ignore
import { User } from '@/api/entities';

export default function AdminUserDetailScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { isAdmin, loading: adminLoading } = useRequireAdmin();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const d = await User.getFull(String(id));
      setDetail(d);
    } catch (e: any) {
      setError(e?.status === 403 ? 'Access denied (admin only).' : (e?.message || 'Failed to load user'));
    } finally { setLoading(false); }
  }, [id, isAdmin]);

  useEffect(() => { void load(); }, [load]);

  const onDownload = async () => {
    if (!id) return;
    const url = getApiBaseUrl() + `/users/${encodeURIComponent(String(id))}/export`;
    try { await WebBrowser.openBrowserAsync(url); } catch { /* no-op */ }
  };

  const ads = detail?.ads || [];
  const datesByAd = detail?.datesByAd || {};

  if (adminLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
        <Text style={{ color: Colors[colorScheme].text, fontSize: 16, fontWeight: '600' }}>Admin access required</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ 
        title: 'Admin · User Detail',
        headerLeft: () => (
          <Pressable onPress={() => router.back()} style={{ paddingLeft: 8 }}>
            <Ionicons name="chevron-back" size={24} color="#3B82F6" />
          </Pressable>
        ),
      }} />
      {loading ? <View style={{ padding: 24, alignItems: 'center' }}><ActivityIndicator /></View> : null}
      {error ? <Text style={[styles.error, { color: Colors[colorScheme].mutedText }]}>{error}</Text> : null}
      {!loading && !error && detail ? (
        <>
          <View style={[styles.header, { borderBottomColor: Colors[colorScheme].border }]}>
            <Text style={[styles.title, { color: Colors[colorScheme].text }]}>{detail.user?.display_name || '(no name)'}</Text>
            <Text style={[styles.meta, { color: Colors[colorScheme].mutedText }]}>{detail.user?.email}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              <View style={[styles.badge, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
                <Text style={[styles.badgeText, { color: Colors[colorScheme].text }]}>{detail.user?.email_verified ? 'VERIFIED' : 'UNVERIFIED'}</Text>
              </View>
              {detail.user?.banned ? <View style={[styles.badge, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}><Text style={[styles.badgeText, { color: '#991B1B' }]}>BANNED</Text></View> : null}
            </View>
            <Pressable style={[styles.btn, { backgroundColor: Colors[colorScheme].tint }]} onPress={onDownload}><Text style={styles.btnText}>Download Ads CSV</Text></Pressable>
          </View>
          <FlatList
            data={ads}
            keyExtractor={(a) => String(a.id)}
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
                <Text style={[styles.cardTitle, { color: Colors[colorScheme].text }]}>{item.business_name || '(no business)'}</Text>
                <Text style={[styles.meta, { color: Colors[colorScheme].mutedText }]}>Status: {item.status || 'draft'} · Payment: {item.payment_status || 'unpaid'}</Text>
                <Text style={[styles.meta, { color: Colors[colorScheme].mutedText }]}>Zip {item.target_zip_code || ''}</Text>
                <Text style={[styles.meta, { color: Colors[colorScheme].mutedText }]}>Dates: {(datesByAd[item.id] || []).join(', ') || '—'}</Text>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          />
        </>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontWeight: '800', fontSize: 18 },
  meta: {},
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  badgeText: { fontWeight: '800', fontSize: 10 },
  btn: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8 },
  btnText: { color: 'white', fontWeight: '800' },
  card: { padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  cardTitle: { fontWeight: '800' },
  error: { color: '#b91c1c', padding: 12 },
});
