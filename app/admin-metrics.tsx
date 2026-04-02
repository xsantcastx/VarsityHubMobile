// GATED — restore when ADMIN is ready to test
export { default } from '@/components/ComingSoon';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeGoBack } from '@/utils/navigation';
import { httpGet } from '@/api/http';

type DayRange = 7 | 14 | 30;

function AdminMetricsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { isAdmin, loading: adminLoading } = useRequireAdmin();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [days, setDays] = useState<DayRange>(7);
  const [error, setError] = useState<string | null>(null);

  const palette = Colors[colorScheme];
  const cardBg = colorScheme === 'dark' ? '#1F2937' : 'white';
  const cardBorder = colorScheme === 'dark' ? '#374151' : '#D1D5DB';

  const loadMetrics = useCallback(async (showRefreshing = false) => {
    if (!isAdmin) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await httpGet(`/admin/metrics?days=${days}`);
      setReport(data?.report || data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, days]);

  useEffect(() => { void loadMetrics(); }, [loadMetrics]);

  const summary = report?.summary;
  const daily = report?.daily;

  // Calculate max for bar chart scaling
  const maxDaily = Math.max(
    1,
    ...(daily?.users || []).map((d: any) => d.count),
    ...(daily?.reports || []).map((d: any) => d.count),
    ...(daily?.messages || []).map((d: any) => d.count),
  );

  const growthPct = (current: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((current / total) * 100);
  };

  if (adminLoading) {
    return <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></SafeAreaView>;
  }
  if (!isAdmin) {
    return <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Admin access required</Text></SafeAreaView>;
  }

  const StatCard = ({ title, total, recent, color, icon }: { title: string; total: number; recent: number; color: string; icon: string }) => {
    const pct = growthPct(recent, total);
    return (
      <View style={[styles.statCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
            <MaterialIcons name={icon as any} size={20} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statTitle, { color: palette.mutedText }]}>{title}</Text>
            <Text style={[styles.statValue, { color: palette.text }]}>{total.toLocaleString()}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <MaterialIcons
                name={recent > 0 ? 'trending-up' : 'trending-flat'}
                size={16}
                color={recent > 0 ? '#10B981' : '#9CA3AF'}
              />
              <Text style={{ color: recent > 0 ? '#10B981' : '#9CA3AF', fontWeight: '700', fontSize: 13 }}>
                +{recent}
              </Text>
            </View>
            <Text style={{ color: palette.mutedText, fontSize: 10 }}>last {days}d</Text>
          </View>
        </View>
      </View>
    );
  };

  const BarRow = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <View style={styles.barRow}>
      <Text style={[styles.barLabel, { color: palette.mutedText }]}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(2, (value / maxDaily) * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.barValue, { color: palette.text }]}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top']}>
      <Stack.Screen options={{
        title: 'Platform Metrics',
        headerShown: true,
        headerStyle: { backgroundColor: colorScheme === 'dark' ? '#1F2937' : 'white' },
        headerTintColor: palette.text,
        headerLeft: () => (
          <Pressable onPress={() => { safeGoBack(router); }} style={{ paddingRight: 8 }}>
            <MaterialIcons name="chevron-left" size={28} color="#007AFF" />
          </Pressable>
        ),
      }} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadMetrics(true)} tintColor={palette.tint} />}
      >
        {/* Time Range Selector */}
        <View style={styles.rangeRow}>
          {([7, 14, 30] as DayRange[]).map(d => (
            <Pressable
              key={d}
              style={[styles.rangeChip, {
                backgroundColor: days === d ? palette.tint : 'transparent',
                borderColor: days === d ? palette.tint : cardBorder,
              }]}
              onPress={() => setDays(d)}
            >
              <Text style={{ color: days === d ? 'white' : palette.text, fontWeight: '700', fontSize: 13 }}>
                {d} Days
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator size="large" /></View>
        ) : error ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: '#EF4444', fontWeight: '600' }}>{error}</Text>
            <Pressable style={[styles.retryBtn, { backgroundColor: palette.tint }]} onPress={() => void loadMetrics()}>
              <Text style={{ color: 'white', fontWeight: '700' }}>Retry</Text>
            </Pressable>
          </View>
        ) : summary ? (
          <>
            {/* Summary Cards */}
            <View style={{ marginBottom: 20 }}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Overview</Text>
              <StatCard title="Users" total={summary.totalUsers} recent={summary.newUsersLastDays || 0} color="#3B82F6" icon="people" />
              <StatCard title="Reports" total={summary.totalReports} recent={summary.reportsLastDays || 0} color="#EF4444" icon="flag" />
              <StatCard title="Messages" total={summary.totalMessages} recent={summary.messagesLastDays || 0} color="#8B5CF6" icon="chat" />
            </View>

            {/* Today's Activity */}
            <View style={[styles.todayCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: palette.text, marginBottom: 8 }]}>Today</Text>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={[styles.todayValue, { color: '#3B82F6' }]}>{summary.newUsersToday || 0}</Text>
                  <Text style={[styles.todayLabel, { color: palette.mutedText }]}>New Users</Text>
                </View>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={[styles.todayValue, { color: '#EF4444' }]}>{summary.reportsToday || 0}</Text>
                  <Text style={[styles.todayLabel, { color: palette.mutedText }]}>Reports</Text>
                </View>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={[styles.todayValue, { color: '#8B5CF6' }]}>{summary.messagesToday || 0}</Text>
                  <Text style={[styles.todayLabel, { color: palette.mutedText }]}>Messages</Text>
                </View>
              </View>
            </View>

            {/* Daily Charts */}
            {daily?.users && daily.users.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Daily New Users</Text>
                <View style={[styles.chartCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  {daily.users.map((d: any) => (
                    <BarRow
                      key={d.date}
                      label={new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      value={d.count}
                      color="#3B82F6"
                    />
                  ))}
                </View>
              </View>
            )}

            {daily?.messages && daily.messages.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Daily Messages</Text>
                <View style={[styles.chartCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  {daily.messages.map((d: any) => (
                    <BarRow
                      key={d.date}
                      label={new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      value={d.count}
                      color="#8B5CF6"
                    />
                  ))}
                </View>
              </View>
            )}

            {daily?.reports && daily.reports.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Daily Reports</Text>
                <View style={[styles.chartCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  {daily.reports.map((d: any) => (
                    <BarRow
                      key={d.date}
                      label={new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      value={d.count}
                      color="#EF4444"
                    />
                  ))}
                </View>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  rangeChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  sectionTitle: { fontWeight: '800', fontSize: 16, marginBottom: 10 },
  statCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  statIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statTitle: { fontSize: 12 },
  statValue: { fontSize: 22, fontWeight: '800' },
  todayCard: { padding: 16, borderRadius: 12, borderWidth: 1 },
  todayValue: { fontSize: 28, fontWeight: '800' },
  todayLabel: { fontSize: 12, marginTop: 2 },
  chartCard: { padding: 12, borderRadius: 12, borderWidth: 1 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  barLabel: { width: 50, fontSize: 11 },
  barTrack: { flex: 1, height: 16, backgroundColor: '#E5E7EB20', borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { width: 30, textAlign: 'right', fontSize: 12, fontWeight: '700' },
  retryBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
});
