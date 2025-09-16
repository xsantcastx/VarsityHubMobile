import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { pickerMediaTypesProp } from '@/utils/picker';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { User, Post, Event } from '@/api/entities';
import { uploadFile } from '@/api/upload';
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
  const [activity, setActivity] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('posts');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handleAvatarPress = async () => {
    setIsUploadingAvatar(true);
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert("Permission required", "You've refused to allow this app to access your photos.");
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        ...pickerMediaTypesProp(),
        allowsEditing: true,
        aspect: [1, 1],
        selectionLimit: 1,
        quality: 0.9,
      } as any);

      if (pickerResult.canceled) {
        return;
      }

      const { uri, fileName, mimeType } = pickerResult.assets[0] as any;
      const manipulated = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 800 } }], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
      const fd = new FormData();
      const name = (fileName && String(fileName).includes('.')) ? String(fileName) : `avatar_${Date.now()}.jpg`;
      fd.append('file', { uri: manipulated.uri, name, type: 'image/jpeg' } as any);
      const token = await (await import('@/api/auth')).loadToken();
      const baseUrl = String((process as any).env?.EXPO_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
      const resp = await fetch(`${baseUrl}/upload/avatar`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } as any : undefined, body: fd as any });
      if (!resp.ok) throw new Error(await resp.text());
      const { url } = await resp.json();
      await User.updateMe({ avatar_url: url });
      setMe((prev) => (prev ? { ...prev, avatar_url: url } : null));

    } catch (error) {
      console.error("Avatar upload failed", error);
      Alert.alert("Upload failed", "Could not upload your new profile picture. Please try again.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: ensure session is valid
      const u: any = await User.me();
      if (u && !u._isNotModified) setMe(u ?? null);
      if (!u?.id) { setLoading(false); return; }

      // Step 2: load posts (non-auth endpoint)
      let userPosts: any[] = [];
      try {
        const p = await Post.filter({ user_id: String(u.id) });
        userPosts = Array.isArray(p) ? p : [];
        setPosts(userPosts);
      } catch (e) {
        // Don't fail the whole profile if posts fail
        console.warn('Posts load failed', e);
        setPosts([]);
      }

      // Step 3: load RSVPs (auth required) but don’t force logout if it fails
      let rsvps: any[] = [];
      try {
        const r = await Event.myRsvps();
        rsvps = Array.isArray(r) ? r : [];
      } catch (e: any) {
        console.warn('RSVPs load failed', e);
        // Keep UI working even if RSVPs endpoint returns 401/403
      }

      const postsAsActivity = userPosts.map(p => ({ ...p, type: 'post', date: p.created_at }));
      const rsvpsAsActivity = rsvps.map(r => ({ ...r, type: 'rsvp', date: r.created_at }));
      const combinedActivity = [...postsAsActivity, ...rsvpsAsActivity].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivity(combinedActivity);
    } catch (e: any) {
      console.error('Failed to load profile', e);
      // Only show sign-in if the session itself is invalid from /me.
      if (e && e.status === 401) {
        setError('You need to sign in to view your profile.');
      } else {
        setError(e?.message ? `Unable to load profile: ${e.message}` : 'Unable to load profile.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Refresh when screen regains focus (after creating a post, etc.)
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const name = me?.display_name || me?.username || 'User';
  const stats = [
    { label: 'posts', value: me?._count?.posts ?? 0 },
    { label: 'followers', value: me?._count?.followers ?? 0 },
    { label: 'following', value: me?._count?.following ?? 0 },
  ];

  const renderHeader = () => (
    <>
      <View style={styles.header}>
        <Pressable onPress={handleAvatarPress} disabled={isUploadingAvatar}>
          <Avatar uri={me.avatar_url} size={80} />
          {isUploadingAvatar && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color="white" />
            </View>
          )}
        </Pressable>
        <View style={styles.statsContainer}>
          {stats.map((stat) => (
            <Pressable
              key={stat.label}
              style={styles.statItem}
              onPress={() => {
                if (stat.label === 'followers') {
                  router.push(`/followers?id=${me.id}&username=${name}`);
                } else if (stat.label === 'following') {
                  router.push(`/following?id=${me.id}&username=${name}`);
                }
              }}
            >
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </Pressable>
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

  const renderActivityItem = ({ item }: { item: any }) => {
    if (item.type === 'post') {
      return <PostCard post={item} onPress={() => router.push(`/post-detail?id=${item.id}`)} />;
    }
    if (item.type === 'rsvp') {
      return (
        <View style={styles.activityItem}>
          <Text>RSVP'd to event: {item.event?.title || 'Unknown Event'}</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
        <FlatList
          data={activity}
          renderItem={renderActivityItem}
          keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No recent activity</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </SafeAreaView>
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
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 40,
  },
  activityItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
});
