import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, Pressable } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
// @ts-ignore
import { User } from '@/api/entities';

export default function AdminUserDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const d = await User.getFull(String(id));
      setDetail(d);
    } catch (e: any) {
      setError(e?.status === 403 ? 'Access denied (admin only).' : (e?.message || 'Failed to load user'));
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onDownload = async () => {
    if (!id) return;
    const base = (process as any)?.env?.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
    const url = base.replace(/\/$/, '') + `/users/${encodeURIComponent(String(id))}/export`;
    try { await WebBrowser.openBrowserAsync(url); } catch {}
  };

  const ads = detail?.ads || [];
  const datesByAd = detail?.datesByAd || {};

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Admin · User Detail' }} />
      {loading ? <View style={{ padding: 24, alignItems: 'center' }}><ActivityIndicator /></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && detail ? (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>{detail.user?.display_name || '(no name)'}</Text>
            <Text style={styles.meta}>{detail.user?.email}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              <View style={styles.badge}><Text style={styles.badgeText}>{detail.user?.email_verified ? 'VERIFIED' : 'UNVERIFIED'}</Text></View>
              {detail.user?.banned ? <View style={[styles.badge, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}><Text style={[styles.badgeText, { color: '#991B1B' }]}>BANNED</Text></View> : null}
            </View>
            <Pressable style={styles.btn} onPress={onDownload}><Text style={styles.btnText}>Download Ads CSV</Text></Pressable>
          </View>
          <FlatList
            data={ads}
            keyExtractor={(a) => String(a.id)}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.business_name || '(no business)'}</Text>
                <Text style={styles.meta}>Status: {item.status || 'draft'} · Payment: {item.payment_status || 'unpaid'}</Text>
                <Text style={styles.meta}>Zip {item.target_zip_code || ''}</Text>
                <Text style={styles.meta}>Dates: {(datesByAd[item.id] || []).join(', ') || '—'}</Text>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { padding: 16, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  title: { fontWeight: '800', fontSize: 18 },
  meta: { color: '#6b7280' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: '#D1D5DB', backgroundColor: '#E5E7EB' },
  badgeText: { fontWeight: '800', fontSize: 10 },
  btn: { alignSelf: 'flex-start', backgroundColor: '#111827', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8 },
  btnText: { color: 'white', fontWeight: '800' },
  card: { padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  cardTitle: { fontWeight: '800' },
  error: { color: '#b91c1c', padding: 12 },
});

