import { TeamMemberships } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { safeGoBack } from '@/utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type JoinRequest = {
  id: string;
  status: string;
  message?: string;
  created_at: string;
  user: {
    id: string;
    display_name: string;
    username?: string;
    avatar_url?: string;
  };
};

export default function TeamJoinRequestsScreen() {
  const { teamId, teamName } = useLocalSearchParams<{ teamId: string; teamName?: string }>();
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null); // requestId being actioned

  const loadRequests = useCallback(
    async (silent = false) => {
      if (!teamId) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const data = await TeamMemberships.getJoinRequests(teamId);
        setRequests(Array.isArray(data) ? (data as JoinRequest[]) : []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load requests');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [teamId]
  );

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadRequests(true);
  }, [loadRequests]);

  const handleApprove = useCallback(async (request: JoinRequest) => {
    setActing(request.id);
    try {
      await TeamMemberships.approveJoinRequest(request.id);
      setRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to approve request');
    } finally {
      setActing(null);
    }
  }, []);

  const handleReject = useCallback((request: JoinRequest) => {
    Alert.alert('Decline Request', `Decline ${request.user.display_name}'s request to join?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setActing(request.id);
          try {
            await TeamMemberships.rejectJoinRequest(request.id);
            setRequests(prev => prev.filter(r => r.id !== request.id));
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to decline request');
          } finally {
            setActing(null);
          }
        },
      },
    ]);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: JoinRequest }) => {
      const isActing = acting === item.id;
      const initials = item.user.display_name?.slice(0, 2).toUpperCase() || '??';

      return (
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface || theme.background, borderColor: theme.border },
          ]}
        >
          <View style={styles.cardHeader}>
            {item.user.avatar_url ? (
              <Image source={{ uri: item.user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.tint }]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.userInfo}>
              <Text style={[styles.displayName, { color: theme.text }]}>
                {item.user.display_name}
              </Text>
              {item.user.username ? (
                <Text style={[styles.username, { color: theme.mutedText }]}>
                  @{item.user.username}
                </Text>
              ) : null}
            </View>
          </View>

          {item.message ? (
            <Text style={[styles.message, { color: theme.text }]}>"{item.message}"</Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              style={[
                styles.approveButton,
                { backgroundColor: '#16A34A' },
                isActing && styles.disabledButton,
              ]}
              onPress={() => void handleApprove(item)}
              disabled={isActing}
              accessibilityRole="button"
              accessibilityLabel={`Approve ${item.user.display_name}`}
            >
              {isActing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={styles.buttonText}>Approve</Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={[
                styles.declineButton,
                { borderColor: theme.border },
                isActing && styles.disabledButton,
              ]}
              onPress={() => handleReject(item)}
              disabled={isActing}
              accessibilityRole="button"
              accessibilityLabel={`Decline ${item.user.display_name}`}
            >
              <Ionicons name="close" size={16} color={theme.text} />
              <Text style={[styles.declineText, { color: theme.text }]}>Decline</Text>
            </Pressable>
          </View>
        </View>
      );
    },
    [acting, handleApprove, handleReject, theme]
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['bottom']}
    >
      <Stack.Screen
        options={{
          title: 'Join Requests',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerLeft: () => (
            <Pressable
              onPress={() => safeGoBack(router)}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={{ paddingHorizontal: 8 }}
            >
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Pressable>
          ),
        }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
          <Pressable
            style={[styles.retryButton, { backgroundColor: theme.tint }]}
            onPress={() => void loadRequests()}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons
                name="people-outline"
                size={48}
                color={theme.mutedText}
                style={{ marginBottom: 12 }}
              />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No pending requests</Text>
              <Text style={[styles.emptySubtitle, { color: theme.mutedText }]}>
                When athletes request to join {teamName || 'this team'}, they'll appear here.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  list: { padding: 16, flexGrow: 1 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: { color: '#fff', fontWeight: '700', fontSize: 16 },
  userInfo: { flex: 1 },
  displayName: { fontSize: 16, fontWeight: '600' },
  username: { fontSize: 13, marginTop: 2 },
  gradYear: { fontSize: 12, marginTop: 2 },
  message: { fontSize: 14, fontStyle: 'italic', marginBottom: 12, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10 },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  declineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  declineText: { fontWeight: '600', fontSize: 14 },
  disabledButton: { opacity: 0.5 },
  errorText: { fontSize: 15, textAlign: 'center', marginBottom: 16 },
  retryButton: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  emptyTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
