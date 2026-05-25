import { User } from '@/api/entities';
import SwipeBackContainer from '@/components/SwipeBackContainer';
import { Avatar } from '@/components/ui/avatar';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { safeGoBack } from '@/utils/navigation';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type FollowRequest = {
  id: string;
  follower: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  created_at: string;
};

export default function FollowRequestsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await User.followRequests();
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to load follow requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const handleAccept = async (userId: string) => {
    setActingId(userId);
    try {
      await User.acceptFollow(userId);
      setRequests(prev => prev.filter(r => r.id !== userId));
    } catch {
      Alert.alert('Error', 'Failed to accept follow request. Please try again.');
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (userId: string) => {
    setActingId(userId);
    try {
      await User.rejectFollow(userId);
      setRequests(prev => prev.filter(r => r.id !== userId));
    } catch {
      Alert.alert('Error', 'Failed to decline follow request. Please try again.');
    } finally {
      setActingId(null);
    }
  };

  const renderItem = ({ item }: { item: FollowRequest }) => {
    const name = item.follower.display_name || item.follower.username || 'Unknown';
    const handle = item.follower.username ? `@${item.follower.username}` : null;
    const isActing = actingId === item.id;

    return (
      <View style={[styles.row, { borderBottomColor: theme.border ?? '#E5E7EB' }]}>
        <Pressable
          onPress={() => router.push({ pathname: '/user-profile', params: { id: item.follower.id } })}
          style={styles.userInfo}
        >
          <Avatar
            uri={item.follower.avatar_url ?? undefined}
            size={44}
          />
          <View style={styles.nameBlock}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {name}
            </Text>
            {handle ? (
              <Text style={[styles.handle, { color: theme.mutedText }]} numberOfLines={1}>
                {handle}
              </Text>
            ) : null}
          </View>
        </Pressable>

        <View style={styles.actions}>
          {isActing ? (
            <ActivityIndicator size="small" color={theme.tint} />
          ) : (
            <>
              <Pressable
                style={[styles.acceptBtn, { backgroundColor: theme.tint }]}
                onPress={() => void handleAccept(item.id)}
              >
                <Text style={styles.acceptText}>Accept</Text>
              </Pressable>
              <Pressable
                style={[styles.rejectBtn, { borderColor: theme.mutedText }]}
                onPress={() => void handleReject(item.id)}
              >
                <Text style={[styles.rejectText, { color: theme.mutedText }]}>Decline</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <SwipeBackContainer>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border ?? '#E5E7EB' }]}>
          <Pressable onPress={() => safeGoBack(router)} style={styles.backBtn}>
            <MaterialIcons name="chevron-left" size={28} color={theme.tint} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Follow Requests</Text>
          {requests.length > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.tint }]}>
              <Text style={styles.badgeText}>{requests.length}</Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.tint} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <MaterialIcons name="error-outline" size={48} color={theme.mutedText} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>{error}</Text>
            <Pressable onPress={() => void loadRequests()} style={styles.retryBtn}>
              <Text style={[styles.retryText, { color: theme.tint }]}>Try Again</Text>
            </Pressable>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.center}>
            <MaterialIcons name="person-add-disabled" size={56} color={theme.mutedText} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No pending requests</Text>
            <Text style={[styles.emptySubtitle, { color: theme.mutedText }]}>
              When someone requests to follow you, they'll appear here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={requests}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
          />
        )}
      </SafeAreaView>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', marginLeft: 4 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  list: { paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameBlock: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600' },
  handle: { fontSize: 13, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  acceptBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  acceptText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  rejectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  rejectText: { fontSize: 13, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn: { marginTop: 8 },
  retryText: { fontSize: 15, fontWeight: '600' },
});
