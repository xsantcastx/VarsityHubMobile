import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeGoBack } from '@/utils/navigation';
import { getApiBaseUrl } from '../api/http';

interface ActivityLogItem {
  id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string;
  description: string;
  metadata: any;
  timestamp: string;
}

export default function AdminActivityLogScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { isAdmin, loading: adminLoading } = useRequireAdmin();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ActivityLogItem[]>([]);
  const [filter, setFilter] = useState('all'); // all, user, team, ad, post
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    
    try {
      const _token = await (await import('@/api/auth')).loadToken();
      const _apiUrl = getApiBaseUrl();

      const params = new URLSearchParams();
      if (filter !== 'all') params.append('type', filter);
      if (searchQuery) params.append('q', searchQuery);
      
      // Use API client instead of direct fetch
      const { httpGet } = await import('@/api/http');
      const data = await httpGet(`/admin/activity-log?${params}`);
      setItems(Array.isArray(data?.activities) ? data.activities : Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load activity log');
    } finally {
      setLoading(false);
    }
  }, [filter, isAdmin, searchQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const getActionColor = (action: string) => {
    if (action.includes('ban') || action.includes('delete')) return '#EF4444';
    if (action.includes('create')) return '#10B981';
    if (action.includes('update') || action.includes('edit')) return '#F59E0B';
    return '#3B82F6';
  };

  const getActionIcon = (targetType: string) => {
    switch (targetType) {
      case 'user': return 'person';
      case 'team': return 'shield';
      case 'ad': return 'megaphone';
      case 'post': return 'document-text';
      case 'message': return 'chatbubble';
      default: return 'flash';
    }
  };

  const FilterChip = ({ label, value }: { label: string; value: string }) => (
    <Pressable
      style={[
        styles.filterChip,
        {
          backgroundColor: filter === value
            ? (colorScheme === 'dark' ? '#3B82F6' : '#3B82F6')
            : (colorScheme === 'dark' ? '#1F2937' : '#F3F4F6'),
          borderColor: filter === value
            ? '#3B82F6'
            : (colorScheme === 'dark' ? '#374151' : '#D1D5DB'),
        },
      ]}
      onPress={() => setFilter(value)}
    >
      <Text
        style={[
          styles.filterChipText,
          {
            color: filter === value
              ? 'white'
              : (colorScheme === 'dark' ? '#ECEDEE' : '#111827'),
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  const renderItem = ({ item }: { item: ActivityLogItem }) => (
    <View
      style={[
        styles.logItem,
        {
          backgroundColor: colorScheme === 'dark' ? '#1F2937' : 'white',
          borderColor: colorScheme === 'dark' ? '#374151' : '#D1D5DB',
        },
      ]}
    >
      <View style={styles.logHeader}>
        <View style={[styles.iconCircle, { backgroundColor: getActionColor(item.action) + '20' }]}>
          <MaterialIcons name={getActionIcon(item.target_type) as any} size={20} color={getActionColor(item.action)} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.logAction, { color: colorScheme === 'dark' ? '#ECEDEE' : '#111827' }]}>
            {item.action}
          </Text>
          <Text style={[styles.logAdmin, { color: colorScheme === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
            by {item.admin_email}
          </Text>
        </View>
        <Text style={[styles.logTime, { color: colorScheme === 'dark' ? '#6B7280' : '#9CA3AF' }]}>
          {new Date(item.timestamp).toLocaleTimeString()}
        </Text>
      </View>
      <Text style={[styles.logDesc, { color: colorScheme === 'dark' ? '#D1D5DB' : '#374151' }]}>
        {item.description}
      </Text>
      <View style={styles.logMeta}>
        <View style={[styles.badge, { backgroundColor: colorScheme === 'dark' ? '#374151' : '#F3F4F6' }]}>
          <Text style={[styles.badgeText, { color: colorScheme === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
            {item.target_type.toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.logDate, { color: colorScheme === 'dark' ? '#6B7280' : '#9CA3AF' }]}>
          {new Date(item.timestamp).toLocaleDateString()}
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
          title: 'Activity Log',
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

      {/* Search and Filters */}
      <View style={styles.header}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search activities..."
          placeholderTextColor={colorScheme === 'dark' ? '#6B7280' : '#9CA3AF'}
          style={[
            styles.searchInput,
            {
              backgroundColor: colorScheme === 'dark' ? '#1F2937' : 'white',
              borderColor: colorScheme === 'dark' ? '#374151' : '#D1D5DB',
              color: colorScheme === 'dark' ? '#ECEDEE' : '#111827',
            },
          ]}
        />
        <View style={styles.filterRow}>
          <FilterChip label="All" value="all" />
          <FilterChip label="Users" value="user" />
          <FilterChip label="Teams" value="team" />
          <FilterChip label="Ads" value="ad" />
          <FilterChip label="Posts" value="post" />
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="warning-amber" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="content-paste" size={64} color={colorScheme === 'dark' ? '#374151' : '#D1D5DB'} />
          <Text style={[styles.emptyText, { color: colorScheme === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
            No activity found
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
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
  header: {
    padding: 16,
  },
  searchInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginBottom: 12,
    fontSize: 16,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  logItem: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logAction: {
    fontSize: 16,
    fontWeight: '700',
  },
  logAdmin: {
    fontSize: 12,
    marginTop: 2,
  },
  logTime: {
    fontSize: 11,
  },
  logDesc: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  logMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  logDate: {
    fontSize: 11,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
});
