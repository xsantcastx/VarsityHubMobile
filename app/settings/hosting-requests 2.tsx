import { HostingRequests } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type HostingRequest = {
  id: string;
  organization_name: string;
  contact_name?: string | null;
  contact_email?: string | null;
  venue?: string | null;
  requested_dates?: string | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const statusLabel: Record<string, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  denied: 'Denied',
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function HostingRequestsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<HostingRequest[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await HostingRequests.listMine();
      setItems(Array.isArray(res) ? res : []);
    } catch {
      setError('Failed to load hosting requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const renderItem = ({ item }: { item: HostingRequest }) => {
    const status = (item.status || 'pending').toLowerCase();
    const statusText = statusLabel[status] || status;
    const statusColor =
      status === 'approved' ? colors.success : status === 'denied' ? colors.danger : colors.warning;

    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.title, { color: colors.text }]}>{item.organization_name || 'Organization'}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
          </View>
        </View>
        {item.venue ? <Text style={[styles.muted, { color: colors.mutedText }]}>Venue: {item.venue}</Text> : null}
        {item.requested_dates ? (
          <Text style={[styles.muted, { color: colors.mutedText }]}>Dates: {item.requested_dates}</Text>
        ) : null}
        <Text style={[styles.muted, { color: colors.mutedText }]}>
          Submitted {formatDate(item.created_at)} • Contact {item.contact_name || 'You'}
        </Text>
        {item.notes ? <Text style={[styles.notes, { color: colors.text }]}>Notes: {item.notes}</Text> : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'My Hosting Requests' }} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: 24 }]}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.title, { color: colors.text }]}>No requests yet</Text>
              <Text style={[styles.muted, { color: colors.mutedText }]}>
                Submit a request to host an event to see it tracked here.
              </Text>
              <Text
                style={[styles.link, { color: colors.tint }]}
                onPress={() => router.push('/settings/request-host-event')}
              >
                New hosting request
              </Text>
            </View>
          }
          ListHeaderComponent={
            error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 16, gap: 10 },
  card: {
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontWeight: '800', fontSize: 16 },
  muted: { fontSize: 14 },
  notes: { fontSize: 14, marginTop: 4 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontWeight: '700', fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  error: { marginHorizontal: 16, marginBottom: 8, fontWeight: '700' },
  link: { fontWeight: '700', marginTop: 4 },
});
