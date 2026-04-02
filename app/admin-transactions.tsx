import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeGoBack } from '@/utils/navigation';
import { httpGet } from '@/api/http';

type StatusFilter = 'all' | 'COMPLETED' | 'PENDING' | 'FAILED';

function AdminTransactionsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { isAdmin, loading: adminLoading } = useRequireAdmin();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const limit = 30;

  const palette = Colors[colorScheme];
  const cardBg = colorScheme === 'dark' ? '#1F2937' : 'white';
  const cardBorder = colorScheme === 'dark' ? '#374151' : '#D1D5DB';

  const loadData = useCallback(async (reset = false, showRefreshing = false) => {
    if (!isAdmin) return;
    if (showRefreshing) setRefreshing(true);
    else if (reset) setLoading(true);
    setError(null);

    try {
      const newOffset = reset ? 0 : offset;
      const statusParam = filter !== 'all' ? `&status=${filter}` : '';
      const [txRes, sumRes] = await Promise.all([
        httpGet(`/admin/transactions?limit=${limit}&offset=${newOffset}${statusParam}`),
        reset || !summary ? httpGet('/admin/transactions/summary') : Promise.resolve({ summary }),
      ]);

      const newTx = txRes?.transactions || [];
      if (reset) {
        setTransactions(newTx);
        setOffset(newTx.length);
      } else {
        setTransactions(prev => [...prev, ...newTx]);
        setOffset(newOffset + newTx.length);
      }
      setHasMore(newTx.length >= limit);
      if (sumRes?.summary) setSummary(sumRes.summary);
    } catch (e: any) {
      setError(e?.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, filter, offset, summary]);

  useEffect(() => { void loadData(true); }, [isAdmin, filter]);

  const statusColor = (status: string) => {
    if (status === 'COMPLETED') return '#10B981';
    if (status === 'PENDING') return '#F59E0B';
    if (status === 'FAILED') return '#EF4444';
    return '#6B7280';
  };

  const formatAmount = (amount: number | string | null) => {
    if (!amount) return '$0.00';
    const n = typeof amount === 'string' ? parseFloat(amount) : amount;
    return '$' + (n / 100).toFixed(2);
  };

  const filters: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Failed', value: 'FAILED' },
  ];

  if (adminLoading) {
    return <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></SafeAreaView>;
  }
  if (!isAdmin) {
    return <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Admin access required</Text></SafeAreaView>;
  }

  const SummaryCard = ({ title, value, color, icon }: { title: string; value: string | number; color: string; icon: string }) => (
    <View style={[styles.summaryCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={[styles.summaryIcon, { backgroundColor: color + '20' }]}>
        <MaterialIcons name={icon as any} size={20} color={color} />
      </View>
      <Text style={[styles.summaryValue, { color: palette.text }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: palette.mutedText }]}>{title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top']}>
      <Stack.Screen options={{
        title: 'Transactions',
        headerShown: true,
        headerStyle: { backgroundColor: colorScheme === 'dark' ? '#1F2937' : 'white' },
        headerTintColor: palette.text,
        headerLeft: () => (
          <Pressable onPress={() => { safeGoBack(router); }} style={{ paddingRight: 8 }}>
            <MaterialIcons name="chevron-left" size={28} color="#007AFF" />
          </Pressable>
        ),
      }} />

      <FlatList
        data={transactions}
        keyExtractor={(item, i) => item.id || String(i)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadData(true, true)} tintColor={palette.tint} />
        }
        ListHeaderComponent={() => (
          <View style={{ padding: 16 }}>
            {/* Summary Cards */}
            {summary && (
              <View style={styles.summaryRow}>
                <SummaryCard title="Revenue" value={formatAmount(summary.totalRevenue || summary.total_revenue || 0)} color="#10B981" icon="attach-money" />
                <SummaryCard title="Completed" value={summary.completedCount || summary.completed_count || 0} color="#3B82F6" icon="check-circle" />
                <SummaryCard title="Pending" value={summary.pendingCount || summary.pending_count || 0} color="#F59E0B" icon="schedule" />
                <SummaryCard title="Failed" value={summary.failedCount || summary.failed_count || 0} color="#EF4444" icon="error" />
              </View>
            )}

            {/* Filter Chips */}
            <View style={styles.filterRow}>
              {filters.map(f => (
                <Pressable
                  key={f.value}
                  style={[styles.filterChip, {
                    backgroundColor: filter === f.value ? palette.tint : 'transparent',
                    borderColor: filter === f.value ? palette.tint : cardBorder,
                  }]}
                  onPress={() => setFilter(f.value)}
                >
                  <Text style={{ color: filter === f.value ? 'white' : palette.text, fontSize: 13, fontWeight: '600' }}>
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {error && <Text style={{ color: '#EF4444', marginTop: 8 }}>{error}</Text>}
          </View>
        )}
        renderItem={({ item }) => (
          <View style={[styles.txCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.txType, { color: palette.text }]}>
                  {(item.transaction_type || item.transactionType || 'UNKNOWN').replace(/_/g, ' ')}
                </Text>
                {item.user_email && (
                  <Text style={[styles.txMeta, { color: palette.mutedText }]}>{item.user_email}</Text>
                )}
              </View>
              <Text style={[styles.txAmount, { color: palette.text }]}>
                {formatAmount(item.amount_cents || item.amount)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '20', borderColor: statusColor(item.status) }]}>
                <Text style={{ color: statusColor(item.status), fontSize: 10, fontWeight: '800' }}>{item.status}</Text>
              </View>
              <Text style={[styles.txMeta, { color: palette.mutedText }]}>
                {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
              </Text>
            </View>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 1 }} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={() => !loading ? (
          <Text style={{ textAlign: 'center', color: palette.mutedText, padding: 32 }}>
            No transactions found.
          </Text>
        ) : null}
        ListFooterComponent={() => (
          <>
            {loading && <ActivityIndicator style={{ padding: 16 }} />}
            {hasMore && !loading && transactions.length > 0 && (
              <Pressable style={[styles.loadMore, { borderColor: cardBorder }]} onPress={() => void loadData(false)}>
                <Text style={{ color: palette.tint, fontWeight: '600' }}>Load More</Text>
              </Pressable>
            )}
          </>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  summaryCard: { flex: 1, minWidth: '45%', padding: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  summaryIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  summaryValue: { fontSize: 18, fontWeight: '800' },
  summaryLabel: { fontSize: 11, marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  txCard: { marginHorizontal: 16, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  txType: { fontWeight: '700', fontSize: 14 },
  txAmount: { fontWeight: '800', fontSize: 16 },
  txMeta: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  loadMore: { marginHorizontal: 16, padding: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center', marginTop: 8 },
});
