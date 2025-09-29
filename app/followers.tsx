import { User } from '@/api/entities';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FollowersScreen() {
  const router = useRouter();
  const { id, username } = useLocalSearchParams<{ id: string; username?: string }>();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadFollowers = async (cursor?: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const { items, nextCursor: newCursor } = await User.followers(id, cursor);
      setUsers(prev => (cursor ? [...prev, ...items] : items));
      setNextCursor(newCursor);
    } catch (error) {
      console.error('Failed to load followers', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFollowers();
  }, [id]);

  const handleFollow = async (userId: string, isFollowing: boolean) => {
    try {
      if (isFollowing) {
        await User.unfollow(userId);
      } else {
        await User.follow(userId);
      }
      setUsers(users.map(u => u.id === userId ? { ...u, is_following: !isFollowing } : u));
    } catch (error) {
      console.error('Follow/unfollow failed', error);
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
        onPress={() => router.push(`/user-profile?id=${item.id}`)}
      >
        <Avatar uri={item.avatar_url} />
        <Text style={styles.userName}>{item.display_name}</Text>
      </Pressable>
      <Button
        variant={item.is_following ? 'outline' : 'default'}
        onPress={() => handleFollow(item.id, item.is_following)}
      >
        {item.is_following ? 'Following' : 'Follow'}
      </Button>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: `${username}'s Followers` }} />
      <Input
        placeholder="Search followers..."
        value={search}
        onChangeText={setSearch}
        style={styles.searchInput}
      />
      {loading && users.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          onEndReached={() => nextCursor && loadFollowers(nextCursor)}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loading ? <ActivityIndicator /> : null}
          ListEmptyComponent={<Text style={styles.emptyText}>No followers yet.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
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
  emptyText: { textAlign: 'center', marginTop: 32, color: '#6B7280' },
});
