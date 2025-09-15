import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView, FlatList } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { User, Post } from '@/api/entities';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import PostCard from '@/components/PostCard';
import { SimpleLineIcons } from '@expo/vector-icons';

type CurrentUser = {
  id?: string | number;
  username?: string;
  email?: string;
  full_name?: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  _count?: {
    posts?: number;
    followers?: number;
    following?: number;
  };
  [key: string]: any;
};

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('posts');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const u: any = await User.me();
      setMe(u ?? null);
      if (u?.id) {
        const userPosts = await Post.filter({ user_id: String(u.id) });
        setPosts(Array.isArray(userPosts) ? userPosts : []);
      }
    } catch (e: any) {
      console.error('Failed to load profile', e);
      setError('Unable to load profile. You may need to sign in.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const name = me?.display_name || me?.username || 'User';
  const stats = [
    { label: 'posts', value: me?._count?.posts ?? 0 },
    { label: 'followers', value: me?._count?.followers ?? 0 },
    { label: 'following', value: me?._count?.following ?? 0 },
  ];

  const renderHeader = () => (
    <>
      <View style={styles.header}>
        <Avatar uri={me.avatar_url} size={80} />
        <View style={styles.statsContainer}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statItem}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.bioContainer}>
        <Text style={styles.name}>{name}</Text>
        {me.bio ? <Text style={styles.bio}>{me.bio}</Text> : null}
      </View>
      <View style={styles.actionsContainer}>
        <Button style={{ flex: 1 }} onPress={() => router.push('/edit-profile')}>Edit Profile</Button>
        <Button variant="outline" size="icon" onPress={() => router.push('/settings')}>
          <SimpleLineIcons name="settings" size={20} color="black" />
        </Button>
      </View>
      <View style={styles.tabsContainer}>
        <Pressable onPress={() => setActiveTab('posts')} style={[styles.tab, activeTab === 'posts' && styles.activeTab]}>
          <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>Posts</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab('activity')} style={[styles.tab, activeTab === 'activity' && styles.activeTab]}>
          <Text style={[styles.tabText, activeTab === 'activity' && styles.activeTabText]}>Activity</Text>
        </Pressable>
      </View>
    </>
  );

  const renderEmptyPosts = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No posts yet</Text>
      <Text style={styles.emptySubtitle}>Share your first moment with the community!</Text>
      <Button onPress={() => router.push('/create-post')}>Create Your First Post</Button>
    </View>
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <View style={{ height: 8 }} />
        <Button onPress={() => router.push('/sign-in')}>Sign In</Button>
      </View>
    );
  }

  if (!me) {
    return null; // Or some other placeholder
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Profile' }} />
      {activeTab === 'posts' ? (
        <FlatList
          data={posts}
          renderItem={({ item }) => <PostCard post={item} onPress={() => router.push(`/post-detail?id=${item.id}`)} />}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyPosts}
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      ) : (
        <ScrollView>
          {renderHeader()}
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No recent activity</Text>
            <Button variant="outline" onPress={() => router.push('/rsvp-history')}>View RSVP History</Button>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  center: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#b91c1c', textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  statsContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 14, color: '#6B7280' },
  bioContainer: { paddingHorizontal: 16, paddingBottom: 16 },
  name: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  bio: { fontSize: 14, color: '#4B5563' },
  actionsContainer: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, paddingBottom: 16 },
  tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: 'black' },
  tabText: { color: '#6B7280', fontWeight: '600' },
  activeTabText: { color: 'black' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold' },
  emptySubtitle: { color: '#6B7280', textAlign: 'center', marginBottom: 16 },
});
