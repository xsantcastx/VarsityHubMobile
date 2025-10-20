import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const loadStats = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError(null);
    
    try {
      const token = await (await import('@/api/auth')).loadToken();
      const apiUrl = (process as any).env?.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000';
      
      const response = await fetch(`${apiUrl}/admin/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 403) {
        throw new Error('Access denied (admin only)');
      }

      if (!response.ok) {
        throw new Error('Failed to load dashboard');
      }

      const data = await response.json();
      setStats(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const onRefresh = () => {
    loadStats(true);
  };

  const StatCard = ({ title, value, subtitle, icon, color, onPress }: any) => (
    <Pressable 
      style={[styles.statCard, { 
        backgroundColor: colorScheme === 'dark' ? '#1F2937' : 'white',
        borderColor: colorScheme === 'dark' ? '#374151' : '#E5E7EB',
      }]}
      onPress={onPress}
      android_ripple={{ color: colorScheme === 'dark' ? '#374151' : '#F3F4F6' }}
    >
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
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
      <Ionicons 
        name="chevron-forward" 
        size={20} 
        color={colorScheme === 'dark' ? '#6B7280' : '#9CA3AF'} 
      />
    </Pressable>
  );

  const ActivityItem = ({ item }: any) => (
    <View style={[styles.activityItem, { 
      backgroundColor: colorScheme === 'dark' ? '#1F2937' : '#F9FAFB',
      borderColor: colorScheme === 'dark' ? '#374151' : '#E5E7EB',
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

  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#0B1120' : '#F3F4F6' }]} 
      edges={['top']}
    >
      <Stack.Screen 
        options={{ 
          title: 'Admin Dashboard',
          headerStyle: { backgroundColor: colorScheme === 'dark' ? '#1F2937' : 'white' },
          headerTintColor: colorScheme === 'dark' ? '#ECEDEE' : '#111827',
        }} 
      />

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="warning-outline" size={48} color="#EF4444" />
          <Text style={[styles.errorText, { color: '#EF4444' }]}>{error}</Text>
          <Pressable 
            style={[styles.retryButton, { backgroundColor: Colors[colorScheme].tint }]} 
            onPress={() => loadStats()}
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
            <Ionicons 
              name="refresh" 
              size={24} 
              color={colorScheme === 'dark' ? '#9CA3AF' : '#6B7280'} 
            />
          </View>

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
              onPress={() => router.push('/admin-users')}
            />
            
            <StatCard
              title="Teams"
              value={stats?.totalTeams || 0}
              subtitle="All teams across platform"
              icon="shield"
              color="#10B981"
              onPress={() => router.push('/admin-teams')}
            />
            
            <StatCard
              title="Advertisements"
              value={stats?.totalAds || 0}
              subtitle={`${stats?.pendingAds || 0} pending review`}
              icon="megaphone"
              color="#F59E0B"
              onPress={() => router.push('/admin-ads')}
            />
            
            <StatCard
              title="Posts"
              value={stats?.totalPosts || 0}
              subtitle="User-generated content"
              icon="document-text"
              color="#8B5CF6"
              onPress={() => {}}
            />
            
            <StatCard
              title="Messages"
              value={stats?.totalMessages || 0}
              subtitle="Platform-wide messages"
              icon="chatbubbles"
              color="#EC4899"
              onPress={() => router.push('/admin-messages')}
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
                  borderColor: colorScheme === 'dark' ? '#374151' : '#E5E7EB',
                }]}
                onPress={() => router.push('/admin-users')}
              >
                <Ionicons name="people" size={28} color="#3B82F6" />
                <Text style={[styles.actionText, { color: colorScheme === 'dark' ? '#ECEDEE' : '#111827' }]}>
                  Manage Users
                </Text>
              </Pressable>

              <Pressable 
                style={[styles.actionButton, { 
                  backgroundColor: colorScheme === 'dark' ? '#1F2937' : 'white',
                  borderColor: colorScheme === 'dark' ? '#374151' : '#E5E7EB',
                }]}
                onPress={() => router.push('/admin-teams')}
              >
                <Ionicons name="shield" size={28} color="#10B981" />
                <Text style={[styles.actionText, { color: colorScheme === 'dark' ? '#ECEDEE' : '#111827' }]}>
                  Manage Teams
                </Text>
              </Pressable>

              <Pressable 
                style={[styles.actionButton, { 
                  backgroundColor: colorScheme === 'dark' ? '#1F2937' : 'white',
                  borderColor: colorScheme === 'dark' ? '#374151' : '#E5E7EB',
                }]}
                onPress={() => router.push('/admin-ads')}
              >
                <Ionicons name="megaphone" size={28} color="#F59E0B" />
                <Text style={[styles.actionText, { color: colorScheme === 'dark' ? '#ECEDEE' : '#111827' }]}>
                  Review Ads
                </Text>
              </Pressable>

              <Pressable 
                style={[styles.actionButton, { 
                  backgroundColor: colorScheme === 'dark' ? '#1F2937' : 'white',
                  borderColor: colorScheme === 'dark' ? '#374151' : '#E5E7EB',
                }]}
                onPress={() => router.push('/admin-activity-log')}
              >
                <Ionicons name="list" size={28} color="#8B5CF6" />
                <Text style={[styles.actionText, { color: colorScheme === 'dark' ? '#ECEDEE' : '#111827' }]}>
                  Activity Log
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
                <Pressable onPress={() => router.push('/admin-activity-log')}>
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
    borderWidth: StyleSheet.hairlineWidth,
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
    borderWidth: StyleSheet.hairlineWidth,
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
    borderWidth: StyleSheet.hairlineWidth,
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
