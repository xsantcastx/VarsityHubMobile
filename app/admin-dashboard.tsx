import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeGoBack } from '@/utils/navigation';
import { getApiBaseUrl } from '../api/http';

interface DashboardStats {
  totalUsers: number;
  verifiedUsers: number;
  bannedUsers: number;
  totalTeams: number;
  totalAds: number;
  pendingAds: number;
  totalPosts: number;
  totalMessages: number;
  recentActivity: Array<{
    id: string;
    action: string;
    description: string;
    timestamp: string;
  }>;
}

export default function AdminDashboardScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { isAdmin, loading: adminLoading } = useRequireAdmin();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reportSpike, setReportSpike] = useState<{ isSpike: boolean; pendingCount: number; recentCount: number } | null>(null);

  const loadStats = useCallback(async (showRefreshing = false) => {
    if (!isAdmin) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError(null);
    
    try {
      const _token = await (await import('@/api/auth')).loadToken();
      const _apiUrl = getApiBaseUrl();
      
      // Use API client instead of direct fetch
      const { httpGet } = await import('@/api/http');
      const [data, spike] = await Promise.all([
        httpGet('/admin/dashboard'),
        httpGet('/admin/report-spike').catch(() => null),
      ]);
      setStats(data);
      setReportSpike(spike);
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const onRefresh = () => {
    void loadStats(true);
  };

  const StatCard = ({ title, value, subtitle, icon, color, onPress }: any) => (
    <Pressable 
      style={[styles.statCard, { 
        backgroundColor: colorScheme === 'dark' ? '#1F2937' : 'white',
        borderColor: colorScheme === 'dark' ? '#374151' : '#D1D5DB',
      }]}
      onPress={onPress}
      android_ripple={{ color: colorScheme === 'dark' ? '#374151' : '#F3F4F6' }}
    >
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <MaterialIcons name={icon} size={24} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statValue, { color: colorScheme === 'dark' ? '#ECEDEE' : '#111827' }]}>
          {value.toLocaleString()}
        </Text>
        <Text style={[styles.statTitle, { color: colorScheme === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.statSubtitle, { color: colorScheme === 'dark' ? '#6B7280' : '#9CA3AF' }]}>
            {subtitle}
          </Text>
        )}
      </View>
      <MaterialIcons 
        name="chevron-right" 
        size={20} 
        color={colorScheme === 'dark' ? '#6B7280' : '#9CA3AF'} 
      />
    </Pressable>
  );

  const ActivityItem = ({ item }: any) => (
    <View style={[styles.activityItem, { 
      backgroundColor: colorScheme === 'dark' ? '#1F2937' : '#F9FAFB',
      borderColor: colorScheme === 'dark' ? '#374151' : '#D1D5DB',
    }]}>
      <View style={styles.activityDot} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.activityAction, { color: colorScheme === 'dark' ? '#ECEDEE' : '#111827' }]}>
          {item.action}
        </Text>
        <Text style={[styles.activityDesc, { color: colorScheme === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
          {item.description}
        </Text>
        <Text style={[styles.activityTime, { color: colorScheme === 'dark' ? '#6B7280' : '#9CA3AF' }]}>
          {new Date(item.timestamp).toLocaleString()}
        </Text>
      </View>
    </View>
  );

  if (adminLoading) {
    return <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></SafeAreaView>;
  }
  if (!isAdmin) {
    return <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Admin access required</Text></SafeAreaView>;
  }

  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} 
      edges={['top']}
    >
      <Stack.Screen
        options={{
          title: 'Admin Dashboard',
          headerShown: true,
          headerStyle: { backgroundColor: colorScheme === 'dark' ? '#1F2937' : 'white' },
          headerTintColor: colorScheme === 'dark' ? '#ECEDEE' : '#111827',
          headerLeft: () => (
            <Pressable onPress={() => { safeGoBack(router); }} style={{ paddingRight: 8 }}>
              <MaterialIcons name="chevron-left" size={28} color="#007AFF" />
            </Pressable>
          ),
        }}
      />

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="warning-amber" size={48} color="#EF4444" />
          <Text style={[styles.errorText, { color: '#EF4444' }]}>{error}</Text>
          <Pressable 
            style={[styles.retryButton, { backgroundColor: Colors[colorScheme].tint }]} 
            onPress={() => { void loadStats(); }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors[colorScheme].tint}
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.headerTitle, { color: colorScheme === 'dark' ? '#ECEDEE' : '#111827' }]}>
                🛡️ Admin Dashboard
              </Text>
              <Text style={[styles.headerSubtitle, { color: colorScheme === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                Platform overview and moderation tools
              </Text>
            </View>
            <MaterialIcons 
              name="refresh" 
              size={24} 
              color={colorScheme === 'dark' ? '#9CA3AF' : '#6B7280'} 
            />
          </View>

          {/* Report Spike Alert */}
          {reportSpike?.isSpike && (
            <Pressable
              style={[styles.spikeAlert, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}
              onPress={() => void router.push('/admin-reports')}
            >
              <MaterialIcons name="warning" size={24} color="#DC2626" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontWeight: '800', color: '#991B1B', fontSize: 14 }}>
                  Report Spike Detected
                </Text>
                <Text style={{ color: '#B91C1C', fontSize: 12, marginTop: 2 }}>
                  {reportSpike.pendingCount} pending reports ({reportSpike.recentCount} recent). Tap to review.
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#DC2626" />
            </Pressable>
          )}

          {/* Stats Grid */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colorScheme === 'dark' ? '#ECEDEE' : '#111827' }]}>
              Platform Statistics
            </Text>
            
            <StatCard
              title="Total Users"
              value={stats?.totalUsers || 0}
              subtitle={`${stats?.verifiedUsers || 0} verified • ${stats?.bannedUsers || 0} banned`}
              icon="people"
              color="#3B82F6"
              onPress={() => void router.push('/admin-users')}
            />
            
            <StatCard
              title="Teams"
              value={stats?.totalTeams || 0}
              subtitle="All teams across platform"
              icon="shield"
              color="#10B981"
              onPress={() => void router.push('/admin-teams')}
            />
            
            <StatCard
              title="Advertisements"
              value={stats?.totalAds || 0}
              subtitle={`${stats?.pendingAds || 0} pending review`}
              icon="megaphone"
              color="#F59E0B"
              onPress={() => void router.push('/admin-ads')}
            />
            
            <StatCard
              title="Posts"
              value={stats?.totalPosts || 0}
              subtitle="User-generated content"
              icon="document-text"
              color="#8B5CF6"
              onPress={() => void router.push('/admin-reports')}
            />

            <StatCard
              title="Messages"
              value={stats?.totalMessages || 0}
              subtitle="Platform-wide messages"
              icon="chatbubbles"
              color="#EC4899"
              onPress={() => void router.push('/admin-messages')}
            />
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colorScheme === 'dark' ? '#ECEDEE' : '#111827' }]}>
              Quick Actions
            </Text>
            
            <View style={styles.actionsGrid}>
              <Pressable 
                style={[styles.actionButton, { 
                  backgroundColor: colorScheme === 'dark' ? '#1F2937' : 'white',
                  borderColor: colorScheme === 'dark' ? '#374151' : '#D1D5DB',
                }]}
                onPress={() => void router.push('/admin-users')}
              >
                <MaterialIcons name="group" size={28} color="#3B82F6" />
                <Text style={[styles.actionText, { color: colorScheme === 'dark' ? '#ECEDEE' : '#111827' }]}>
                  Manage Users
                </Text>
              </Pressable>

              <Pressable 
                style={[styles.actionButton, { 
                  backgroundColor: colorScheme === 'dark' ? '#1F2937' : 'white',
                  borderColor: colorScheme === 'dark' ? '#374151' : '#D1D5DB',
                }]}
                onPress={() => void router.push('/admin-teams')}
              >
                <MaterialIcons name="shield" size={28} color="#10B981" />
                <Text style={[styles.actionText, { color: colorScheme === 'dark' ? '#ECEDEE' : '#111827' }]}>
                  Manage Teams
                </Text>
              </Pressable>

              <Pressable 
                style={[styles.actionButton, { 
                  backgroundColor: colorScheme === 'dark' ? '#1F2937' : 'white',
                  borderColor: colorScheme === 'dark' ? '#374151' : '#D1D5DB',
                }]}
                onPress={() => void router.push('/admin-ads')}
              >
                <MaterialIcons name="campaign" size={28} color="#F59E0B" />
                <Text style={[styles.actionText, { color: colorScheme === 'dark' ? '#ECEDEE' : '#111827' }]}>
                  Review Ads
                </Text>
              </Pressable>

              <Pressable 
                style={[styles.actionButton, { 
                  backgroundColor: colorScheme === 'dark' ? '#1F2937' : 'white',
                  borderColor: colorScheme === 'dark' ? '#374151' : '#D1D5DB',
                }]}
                onPress={() => void router.push('/admin-reports')}
              >
                <MaterialIcons name="error" size={28} color="#EF4444" />
                <Text style={[styles.actionText, { color: colorScheme === 'dark' ? '#ECEDEE' : '#111827' }]}>
                  Abuse Reports
                </Text>
              </Pressable>

              <Pressable
                style={[styles.actionButton, {
                  backgroundColor: colorScheme === 'dark' ? '#1F2937' : 'white',
                  borderColor: colorScheme === 'dark' ? '#374151' : '#D1D5DB',
                }]}
                onPress={() => void router.push('/admin-activity-log')}
              >
                <MaterialIcons name="list" size={28} color="#8B5CF6" />
                <Text style={[styles.actionText, { color: colorScheme === 'dark' ? '#ECEDEE' : '#111827' }]}>
                  Activity Log
                </Text>
              </Pressable>

              <Pressable
                style={[styles.actionButton, {
                  backgroundColor: colorScheme === 'dark' ? '#1F2937' : 'white',
                  borderColor: colorScheme === 'dark' ? '#374151' : '#D1D5DB',
                }]}
                onPress={() => void router.push('/admin-create-event')}
              >
                <MaterialIcons name="event" size={28} color="#06B6D4" />
                <Text style={[styles.actionText, { color: colorScheme === 'dark' ? '#ECEDEE' : '#111827' }]}>
                  Events
                </Text>
              </Pressable>

              <Pressable
                style={[styles.actionButton, {
                  backgroundColor: colorScheme === 'dark' ? '#1F2937' : 'white',
                  borderColor: colorScheme === 'dark' ? '#374151' : '#D1D5DB',
                }]}
                onPress={() => void router.push('/admin-transactions' as any)}
              >
                <MaterialIcons name="receipt-long" size={28} color="#059669" />
                <Text style={[styles.actionText, { color: colorScheme === 'dark' ? '#ECEDEE' : '#111827' }]}>
                  Transactions
                </Text>
              </Pressable>

              <Pressable
                style={[styles.actionButton, {
                  backgroundColor: colorScheme === 'dark' ? '#1F2937' : 'white',
                  borderColor: colorScheme === 'dark' ? '#374151' : '#D1D5DB',
                }]}
                onPress={() => void router.push('/admin-metrics' as any)}
              >
                <MaterialIcons name="trending-up" size={28} color="#7C3AED" />
                <Text style={[styles.actionText, { color: colorScheme === 'dark' ? '#ECEDEE' : '#111827' }]}>
                  Metrics
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Recent Activity */}
          {stats?.recentActivity && stats.recentActivity.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colorScheme === 'dark' ? '#ECEDEE' : '#111827' }]}>
                  Recent Activity
                </Text>
                <Pressable onPress={() => void router.push('/admin-activity-log')}>
                  <Text style={[styles.viewAll, { color: Colors[colorScheme].tint }]}>
                    View All
                  </Text>
                </Pressable>
              </View>
              
              {stats.recentActivity.slice(0, 5).map((item) => (
                <ActivityItem key={item.id} item={item} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  viewAll: {
    fontSize: 14,
    fontWeight: '600',
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  statSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  activityItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginRight: 12,
    marginTop: 6,
  },
  activityAction: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  activityDesc: {
    fontSize: 13,
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 11,
  },
  spikeAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
});
