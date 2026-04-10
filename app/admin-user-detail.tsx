import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getApiBaseUrl } from '../api/http';
// @ts-ignore
import { User } from '@/api/entities';
import { httpPost } from '@/api/http';

export default function AdminUserDetailScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { isAdmin, loading: adminLoading } = useRequireAdmin();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [moderationReason, setModerationReason] = useState('');
  const [moderationOrgId, setModerationOrgId] = useState('');
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const d = await User.getFull(String(id));
      setDetail(d);
      const prefs = (d?.user?.preferences || {}) as any;
      setModerationOrgId(typeof prefs.organization_id === 'string' ? prefs.organization_id : '');
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
  const prefs = (detail?.user?.preferences || {}) as Record<string, any>;
  const offenseCount = Number.isFinite(Number(prefs.offense_count)) ? Number(prefs.offense_count) : 0;

  const runModerationAction = async (action: string, fallbackReason: string) => {
    if (!id) return;
    const reason = moderationReason.trim() || fallbackReason;
    setSubmittingAction(action);
    try {
      await httpPost(`/admin/users/${encodeURIComponent(String(id))}/moderation`, {
        action,
        reason,
        organization_id: moderationOrgId.trim() || undefined,
      });
      await load();
      Alert.alert('Updated', `Moderation action "${action}" applied.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to apply moderation action');
    } finally {
      setSubmittingAction(null);
    }
  };

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
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)' as any)} style={{ paddingLeft: 8 }}>
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
            <Text style={[styles.meta, { color: Colors[colorScheme].mutedText }]}>Username: {detail.user?.username || '—'}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              <View style={[styles.badge, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
                <Text style={[styles.badgeText, { color: Colors[colorScheme].text }]}>{detail.user?.email_verified ? 'VERIFIED' : 'UNVERIFIED'}</Text>
              </View>
              {detail.user?.banned ? <View style={[styles.badge, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}><Text style={[styles.badgeText, { color: '#991B1B' }]}>BANNED</Text></View> : null}
            </View>
            <Text style={[styles.meta, { color: Colors[colorScheme].mutedText }]}>Offenses: {offenseCount}</Text>
            <Text style={[styles.meta, { color: Colors[colorScheme].mutedText }]}>
              Coach Approval: {typeof prefs.approval_status === 'string' ? prefs.approval_status : '—'}
            </Text>
            <Text style={[styles.meta, { color: Colors[colorScheme].mutedText }]}>
              Suspension Until: {typeof prefs.suspension_until === 'string' ? prefs.suspension_until : '—'}
            </Text>
            <Pressable style={[styles.btn, { backgroundColor: Colors[colorScheme].tint }]} onPress={onDownload}><Text style={styles.btnText}>Download Ads CSV</Text></Pressable>
            <View style={[styles.moderationBox, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>Moderation</Text>
              <TextInput
                value={moderationReason}
                onChangeText={setModerationReason}
                placeholder="Reason for action"
                placeholderTextColor={Colors[colorScheme].mutedText}
                style={[styles.input, { borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text }]}
              />
              <TextInput
                value={moderationOrgId}
                onChangeText={setModerationOrgId}
                placeholder="Coach organization id (optional)"
                placeholderTextColor={Colors[colorScheme].mutedText}
                style={[styles.input, { borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text }]}
              />
              <View style={styles.actionRow}>
                <Pressable style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]} onPress={() => void runModerationAction('warning', 'Admin warning')} disabled={!!submittingAction}>
                  <Text style={styles.actionBtnText}>{submittingAction === 'warning' ? '...' : 'Warn'}</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, { backgroundColor: '#F97316' }]} onPress={() => void runModerationAction('suspend_7_days', '7-day suspension')} disabled={!!submittingAction}>
                  <Text style={styles.actionBtnText}>{submittingAction === 'suspend_7_days' ? '...' : 'Suspend 7d'}</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, { backgroundColor: '#DC2626' }]} onPress={() => void runModerationAction('suspend_45_days', '45-day suspension')} disabled={!!submittingAction}>
                  <Text style={styles.actionBtnText}>{submittingAction === 'suspend_45_days' ? '...' : 'Suspend 45d'}</Text>
                </Pressable>
              </View>
              <View style={styles.actionRow}>
                <Pressable style={[styles.actionBtn, { backgroundColor: '#10B981' }]} onPress={() => void runModerationAction('approve_coach', 'Coach account approved')} disabled={!!submittingAction}>
                  <Text style={styles.actionBtnText}>{submittingAction === 'approve_coach' ? '...' : 'Approve Coach'}</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, { backgroundColor: '#6B7280' }]} onPress={() => void runModerationAction('reject_coach', 'Coach account rejected')} disabled={!!submittingAction}>
                  <Text style={styles.actionBtnText}>{submittingAction === 'reject_coach' ? '...' : 'Reject Coach'}</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, { backgroundColor: '#334155' }]} onPress={() => void runModerationAction('clear_suspension', 'Suspension cleared')} disabled={!!submittingAction}>
                  <Text style={styles.actionBtnText}>{submittingAction === 'clear_suspension' ? '...' : 'Clear Hold'}</Text>
                </Pressable>
              </View>
            </View>
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
  moderationBox: { marginTop: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  actionBtnText: { color: 'white', fontWeight: '800', fontSize: 12 },
  card: { padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  cardTitle: { fontWeight: '800' },
  error: { color: '#b91c1c', padding: 12 },
});
