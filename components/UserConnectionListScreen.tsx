import { User } from '@/api/entities';
import SwipeBackContainer from '@/components/SwipeBackContainer';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { safeGoBack } from '@/utils/navigation';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type UserConnectionMode = 'followers' | 'following';

type UserConnectionListScreenProps = {
  mode: UserConnectionMode;
  userId?: string;
  username?: string;
};

export function UserConnectionListScreen({
  mode,
  userId,
  username,
}: UserConnectionListScreenProps) {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [followLoading, setFollowLoading] = useState<string | null>(null);

  const screenTitle = useMemo(() => {
    if (mode === 'followers') {
      return username ? `${username}'s Followers` : 'Followers';
    }
    return username ? `${username} is Following` : 'Following';
  }, [mode, username]);

  const emptyTitle = mode === 'followers' ? 'No followers yet' : 'Not following anyone';
  const emptySubtitle =
    mode === 'followers'
      ? "When people follow this account, they'll appear here."
      : "When this account follows people, they'll appear here.";
  const emptyIcon = mode === 'followers' ? 'group' : 'person-add';

  const loadUsers = useCallback(
    async (cursor?: string) => {
      if (!userId) {
        setError('User ID is required.');
        setLoading(false);
        return;
      }

      if (!cursor) setError(null);
      setLoadMoreError(false);
      setLoading(true);
      try {
        const response =
          mode === 'followers'
            ? await User.followers(userId, cursor)
            : await User.following(userId, cursor);
        const items = Array.isArray(response?.items) ? response.items : [];
        setUsers(prev => (cursor ? [...prev, ...items] : items));
        setNextCursor(response?.nextCursor ?? null);
      } catch (loadError) {
        if (__DEV__) console.error(`Failed to load ${mode}`, loadError);
        if (!cursor) {
          setError(`Failed to load ${mode}. Pull down to refresh.`);
        } else {
          setLoadMoreError(true);
        }
      } finally {
        setLoading(false);
      }
    },
    [mode, userId]
  );

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleFollow = async (targetUserId: string, isFollowing: boolean) => {
    if (followLoading) return;
    if (!currentUser) {
      void router.push('/sign-in');
      return;
    }
    setFollowLoading(targetUserId);
    try {
      if (isFollowing) {
        await User.unfollow(targetUserId);
      } else {
        await User.follow(targetUserId);
      }
      setUsers(prev =>
        prev.map(user =>
          user.id === targetUserId ? { ...user, is_following: !isFollowing } : user
        )
      );
    } catch (followError) {
      if (__DEV__) console.error('Follow/unfollow failed', followError);
      Alert.alert(
        'Error',
        isFollowing
          ? 'Failed to unfollow. Please try again.'
          : 'Failed to follow. Please try again.'
      );
    } finally {
      setFollowLoading(null);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!search) return users;
    const lowered = search.toLowerCase();
    return users.filter(
      user =>
        user.display_name?.toLowerCase().includes(lowered) ||
        user.username?.toLowerCase().includes(lowered)
    );
  }, [search, users]);

  return (
    <SwipeBackContainer>
      <SafeAreaView
        style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}
        edges={['top']}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <Pressable onPress={() => safeGoBack(router)} style={styles.backButton}>
            <MaterialIcons name="chevron-left" size={28} color={Colors[colorScheme].tint} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]}>
            {screenTitle}
          </Text>
          <View style={{ width: 36 }} />
        </View>
        <Input
          placeholder={`Search ${mode}...`}
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
        {error && !loading ? (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={() => {
                setError(null);
                void loadUsers();
              }}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {!error && loading && users.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : null}
        {!error ? (
          <FlatList
            data={filteredUsers}
            renderItem={({ item }) => (
              <View style={styles.userRow}>
                <Pressable
                  style={styles.userInfo}
                  onPress={() => void router.push(`/user-profile?id=${item.id}`)}
                >
                  <Avatar uri={item.avatar_url} />
                  <View style={styles.userNameCol}>
                    <Text style={[styles.userName, { color: Colors[colorScheme].text }]}>
                      {item.username ? `@${item.username}` : 'User'}
                    </Text>
                    {item.is_following_viewer ? (
                      <View style={styles.followsYouBadge}>
                        <Text style={styles.followsYouText}>Follows You</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
                <Button
                  variant={item.is_following ? 'outline' : 'default'}
                  onPress={() => void handleFollow(item.id, item.is_following)}
                  disabled={followLoading === item.id}
                >
                  {followLoading === item.id
                    ? 'Loading...'
                    : item.is_following
                      ? 'Following'
                      : 'Follow'}
                </Button>
              </View>
            )}
            keyExtractor={item => item.id}
            onEndReached={() => {
              if (nextCursor && !loadMoreError) {
                void loadUsers(nextCursor);
              }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loading ? (
                <ActivityIndicator />
              ) : loadMoreError ? (
                <View style={styles.loadMoreError}>
                  <Text
                    style={[styles.loadMoreErrorText, { color: Colors[colorScheme].mutedText }]}
                  >
                    Failed to load more.
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setLoadMoreError(false);
                      if (nextCursor) void loadUsers(nextCursor);
                    }}
                  >
                    <Text style={[styles.retryText, { color: Colors[colorScheme].tint }]}>
                      Retry
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null
            }
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyContainer}>
                  <MaterialIcons name={emptyIcon} size={48} color={Colors[colorScheme].mutedText} />
                  <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>
                    {emptyTitle}
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: Colors[colorScheme].mutedText }]}>
                    {emptySubtitle}
                  </Text>
                </View>
              ) : null
            }
          />
        ) : null}
      </SafeAreaView>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  backButton: { width: 36, alignItems: 'flex-start' },
  searchInput: { margin: 16 },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#1e3a5f',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '600' },
  loadMoreError: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  loadMoreErrorText: { fontSize: 14 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  userName: { fontWeight: '600', fontSize: 15 },
  userHandle: { fontSize: 13, marginTop: 1 },
  userNameCol: { flex: 1, justifyContent: 'center' },
  followsYouBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#E8F0FE',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  followsYouText: { fontSize: 11, fontWeight: '600', color: '#3B5BDB' },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
