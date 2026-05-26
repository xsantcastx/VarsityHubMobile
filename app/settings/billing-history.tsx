// v1.0.2: Billing history screen — lists the current user's TransactionLog rows.
// Replaces the matrix row that claimed this existed.
import { Subscriptions } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { safeGoBack } from '@/utils/navigation';

type Transaction = {
  id: string;
  type: string;
  status: string;
  amount_cents: number;
  currency: string;
  promo_code: string | null;
  promo_discount_cents: number;
  created_at: string;
};

function formatMoney(cents: number, currency: string): string {
  const dollars = cents / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency || 'usd').toUpperCase() }).format(dollars);
  } catch {
    return `$${dollars.toFixed(2)}`;
  }
}

function formatType(t: string): string {
  return t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusColor(status: string, isDark: boolean): string {
  if (status === 'COMPLETED') return isDark ? '#34D399' : '#059669';
  if (status === 'REFUNDED') return isDark ? '#FBBF24' : '#D97706';
  if (status === 'FAILED') return isDark ? '#F87171' : '#DC2626';
  return isDark ? '#9CA3AF' : '#6B7280';
}

export default function BillingHistory() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const router = useRouter();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res: any = await Subscriptions.history(100);
      setRows(Array.isArray(res?.transactions) ? res.transactions : []);
    } catch (e: any) {
      setError(e?.data?.error || e?.message || 'Failed to load billing history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { borderBottomColor: isDark ? '#1F2937' : '#E5E7EB' }]}>
        <View style={[styles.headerInner, isLargeScreen ? styles.headerInnerLarge : null]}>
          <Pressable onPress={() => safeGoBack(router)} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
            <MaterialIcons name="chevron-left" size={28} color={Colors[colorScheme].text} />
          </Pressable>
          <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Billing History</Text>
          <View style={{ width: 28 }} />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: isDark ? '#F87171' : '#DC2626' }]}>{error}</Text>
          <Pressable onPress={load} style={[styles.retryBtn, { backgroundColor: Colors[colorScheme].tint }]}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="receipt-long" size={56} color={Colors[colorScheme].mutedText} />
          <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>No transactions yet</Text>
          <Text style={[styles.emptySub, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            Subscription and ad-booking receipts will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors[colorScheme].tint} />}
          contentContainerStyle={[
            styles.listContent,
            isLargeScreen ? styles.listContentLarge : null,
          ]}
          renderItem={({ item }) => (
            <View style={[styles.row, { borderBottomColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowType, { color: Colors[colorScheme].text }]}>{formatType(item.type)}</Text>
                <Text style={[styles.rowDate, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  {new Date(item.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </Text>
                {item.promo_code ? (
                  <Text style={[styles.rowPromo, { color: isDark ? '#60A5FA' : '#2563EB' }]}>
                    Promo: {item.promo_code} (-{formatMoney(item.promo_discount_cents, item.currency)})
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.rowAmount, { color: Colors[colorScheme].text }]}>
                  {formatMoney(item.amount_cents, item.currency)}
                </Text>
                <Text style={[styles.rowStatus, { color: statusColor(item.status, isDark) }]}>{item.status}</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  headerInnerLarge: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  backBtn: { width: 28, alignItems: 'flex-start' },
  title: { fontSize: 18, fontWeight: '700' },
  listContent: { paddingVertical: 8 },
  listContentLarge: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 12 },
  emptySub: { fontSize: 14, textAlign: 'center', marginTop: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowType: { fontSize: 15, fontWeight: '600' },
  rowDate: { fontSize: 13, marginTop: 2 },
  rowPromo: { fontSize: 13, marginTop: 4 },
  rowAmount: { fontSize: 15, fontWeight: '700' },
  rowStatus: { fontSize: 12, fontWeight: '700', marginTop: 4, letterSpacing: 0.4 },
});
