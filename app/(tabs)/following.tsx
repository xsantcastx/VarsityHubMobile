import { User } from '@/api/entities';
import { useAuth } from '@/context/AuthProvider';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import SwipeBackContainer from '@/components/SwipeBackContainer';
import { safeGoBack } from '@/utils/navigation';

export default function FollowingScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { id, username } = useLocalSearchParams<{ id: string; username?: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadFollowing = useCallback(async (cursor?: string) => {
    if (!id) return;
    if (!cursor) setError(null);
    setLoading(true);
    try {
      const { items, nextCursor: newCursor } = await User.following(id, cursor);
      setUsers(prev => (cursor ? [...prev, ...items] : items));
      setNextCursor(newCursor);
    } catch (error) {
      if (__DEV__) console.error('Failed to load following', error);
      if (!cursor) setError('Failed to load following. Pull down to refresh.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadFollowing();
  }, [id, loadFollowing]);

  const [followLoading, setFollowLoading] = useState<string | null>(null);

  const handleFollow = async (userId: string, isFollowing: boolean) => {
    if (followLoading) return;
    setFollowLoading(userId);
    try {
      if (isFollowing) {
        await User.unfollow(userId);
      } else {
        await User.follow(userId);
      }
      setUsers(users.map(u => u.id === userId ? { ...u, is_following: !isFollowing } : u));
    } catch (error) {
      if (__DEV__) console.error('Follow/unfollow failed', error);
      Alert.alert('Error', isFollowing ? 'Failed to unfollow. Please try again.' : 'Failed to follow. Please try again.');
    } finally {
      setFollowLoading(null);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!search) return users;
    return users.filter(u => u.display_name?.toLowerCase().includes(search.toLowerCase()));
  }, [users, search]);

  const renderUser = ({ item }: { item: any }) => (
    <View style={styles.userRow}>
      <Pressable 
        style={styles.userInfo}
        onPress={() => void router.push(`/user-profile?id=${item.id}`)}
      >
        <Avatar uri={item.avatar_url} />
        <Text style={styles.userName}>{item.display_name}</Text>
      </Pressable>
      <Button
        variant={item.is_following ? 'outline' : 'default'}
        onPress={() => handleFollow(item.id, item.is_following)}
        disabled={followLoading === item.id}
      >
        {followLoading === item.id ? 'Loading...' : item.is_following ? 'Following' : 'Follow'}
      </Button>
    </View>
  );

  return (
    <SwipeBackContainer>
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top']}>
      <Stack.Screen options={{
        title: `${username} is Following`,
        headerLeft: () => (
          <Pressable onPress={() => safeGoBack(router)} style={styles.backButton}>
            <MaterialIcons name="chevron-left" size={24} color={Colors[colorScheme].tint} />
          </Pressable>
        ),
      }} />
      <Input
        placeholder="Search following..."
        value={search}
        onChangeText={setSearch}
        style={styles.searchInput}
      />
      {error && !loading && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: '#ff4444', fontSize: 16, textAlign: 'center', marginBottom: 16 }}>{error}</Text>
          <TouchableOpacity onPress={() => { setError(null); void loadFollowing(); }} style={{ backgroundColor: '#1e3a5f', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      {!error && loading && users.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : !error && (
        <FlatList
          data={filteredUsers}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          onEndReached={() => nextCursor && void loadFollowing(nextCursor)}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loading ? <ActivityIndicator /> : null}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="person-add" size={48} color={Colors[colorScheme].mutedText} />
              <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>Not following anyone</Text>
              <Text style={[styles.emptySubtitle, { color: Colors[colorScheme].mutedText }]}>
                When this account follows people, they'll appear here.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' }, // Will be overridden with Colors[colorScheme].background
  backButton: { paddingLeft: 8 },
  searchInput: { margin: 16 },
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
  userName: { flex: 1, fontWeight: '600' },
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
