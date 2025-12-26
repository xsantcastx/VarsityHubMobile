import { User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [hasActiveStory, setHasActiveStory] = useState(false);
  const [userStories, setUserStories] = useState<any[]>([]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await User.me();
      setUser(me);
      
      // Check if user has active stories (posted within last 24 hours)
      try {
        const postsResponse = await User.postsForProfile(me.id, { limit: 50, sort: 'newest' });
        const posts = postsResponse?.items || postsResponse || [];
        
        // Filter for story posts created in last 24 hours
        const now = Date.now();
        const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
        
        const activeStories = posts.filter((post: any) => {
          if (!post.media_url) return false;
          const createdAt = new Date(post.created_at).getTime();
          return createdAt > twentyFourHoursAgo;
        }).map((post: any) => ({
          id: post.id,
          media_url: post.media_url,
          media_type: post.media_url?.match(/\.(mp4|mov|webm|m4v|avi)$/i) ? 'video' : 'image',
          created_at: post.created_at,
          author: {
            id: me.id,
            display_name: me.display_name || me.username,
            avatar_url: me.avatar_url,
          },
        }));
        
        setUserStories(activeStories);
        setHasActiveStory(activeStories.length > 0);
      } catch (storyError) {
        console.error('Failed to load stories:', storyError);
        setHasActiveStory(false);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load profile');
      console.error('Profile load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centerContent}>
          <Text style={[styles.errorText, { color: '#ef4444' }]}>{error}</Text>
          <Pressable 
            style={[styles.retryButton, { backgroundColor: theme.tint }]}
            onPress={loadProfile}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centerContent}>
          <Text style={{ color: theme.text }}>User not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const name = user?.display_name || user?.username || 'User';
  const username = user?.username || 'user';
  const bio = user?.bio || '';
  const role = user?.preferences?.role || user?.role || null;
  const verified = user?.verified || false;
  const headerImageUrl = user?.preferences?.header_image_url || null;
  const joinedDate = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently';

  // Determine role badge
  const getRoleBadge = () => {
    const userRole = (role || '').toLowerCase();
    if (userRole === 'coach') return { icon: '🏆', text: 'Coach', color: '#1d4ed8' };
    if (userRole === 'athlete' || userRole === 'player') return { icon: '⚡', text: 'Athlete', color: '#059669' };
    if (userRole === 'staff') return { icon: '👔', text: 'Staff', color: '#7c3aed' };
    return null;
  };

  const roleBadge = getRoleBadge();

  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top']}
    >
      <Stack.Screen 
        options={{ 
          headerShown: false,
        }} 
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: Math.max(24, insets.bottom + 16) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Banner Section */}
        <View style={styles.headerBanner}>
          {headerImageUrl ? (
            <Image 
              source={{ uri: headerImageUrl }} 
              style={styles.bannerImage}
              contentFit="cover"
            />
          ) : (
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.bannerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          )}
          
          {/* Settings Button */}
          <Pressable 
            style={[styles.settingsButton, { top: insets.top + 8 }]}
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="settings-outline" size={22} color="#ffffff" />
          </Pressable>
        </View>

        {/* Profile Content */}
        <View style={styles.profileContent}>
          {/* Avatar with Story Ring */}
          <View style={styles.avatarSection}>
            <Pressable 
              style={[
                styles.avatarWrapper,
                hasActiveStory && styles.avatarWithStory,
                { borderColor: hasActiveStory ? theme.tint : '#ffffff' }
              ]}
              onPress={() => {
                if (hasActiveStory && userStories.length > 0) {
                  router.push({
                    pathname: '/story-viewer',
                    params: {
                      stories: JSON.stringify(userStories),
                      currentIndex: '0',
                    },
                  });
                }
              }}
              disabled={!hasActiveStory}
            >
              {user?.avatar_url ? (
                <Image 
                  source={{ uri: user.avatar_url }} 
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.tint }]}>
                  <Ionicons name="person" size={40} color="#ffffff" />
                </View>
              )}
            </Pressable>

            {/* Edit Profile Button */}
            <Pressable 
              style={[styles.editButton, { borderColor: theme.border }]}
              onPress={() => router.push('/edit-profile')}
            >
              <Text style={[styles.editButtonText, { color: theme.text }]}>Edit profile</Text>
            </Pressable>
          </View>

          {/* User Info */}
          <View style={styles.userInfoSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.displayName, { color: theme.text }]}>{name}</Text>
              {verified && (
                <Ionicons name="checkmark-circle" size={20} color={theme.tint} />
              )}
            </View>
            
            <Text style={[styles.usernameText, { color: theme.mutedText }]}>@{username}</Text>

            {/* Role Badge */}
            {roleBadge && (
              <View style={[styles.roleBadgeContainer, { backgroundColor: roleBadge.color }]}>
                <Text style={styles.roleBadgeText}>{roleBadge.icon} {roleBadge.text}</Text>
              </View>
            )}

            {/* Bio */}
            {bio && (
              <Text style={[styles.bioText, { color: theme.text }]}>{bio}</Text>
            )}

            {/* Joined Date */}
            <View style={styles.joinedRow}>
              <Ionicons name="calendar-outline" size={16} color={theme.mutedText} />
              <Text style={[styles.joinedText, { color: theme.mutedText }]}>
                Joined {joinedDate}
              </Text>
            </View>

            {/* Followers/Following */}
            <View style={styles.followStats}>
              <Pressable 
                onPress={() => router.push(`/following?id=${user.id}&username=${name}`)}
                style={styles.followStatItem}
              >
                <Text style={[styles.followNumber, { color: theme.text }]}>
                  {user?._count?.following ?? 0}
                </Text>
                <Text style={[styles.followLabel, { color: theme.mutedText }]}>Following</Text>
              </Pressable>

              <Pressable 
                onPress={() => router.push(`/followers?id=${user.id}&username=${name}`)}
                style={styles.followStatItem}
              >
                <Text style={[styles.followNumber, { color: theme.text }]}>
                  {user?._count?.followers ?? 0}
                </Text>
                <Text style={[styles.followLabel, { color: theme.mutedText }]}>Followers</Text>
              </Pressable>
            </View>
          </View>

          {/* Tabs Section (Posts, Replies, Highlights, etc.) */}
          <View style={[styles.tabsContainer, { borderTopColor: theme.border, borderBottomColor: theme.border }]}>
            <Pressable style={[styles.tab, styles.activeTab]}>
              <Text style={[styles.tabText, styles.activeTabText, { color: theme.text }]}>Posts</Text>
            </Pressable>
            <Pressable style={styles.tab}>
              <Text style={[styles.tabText, { color: theme.mutedText }]}>Replies</Text>
            </Pressable>
            <Pressable style={styles.tab}>
              <Text style={[styles.tabText, { color: theme.mutedText }]}>Highlights</Text>
            </Pressable>
            <Pressable style={styles.tab}>
              <Text style={[styles.tabText, { color: theme.mutedText }]}>Media</Text>
            </Pressable>
            <Pressable style={styles.tab}>
              <Text style={[styles.tabText, { color: theme.mutedText }]}>Likes</Text>
            </Pressable>
          </View>

          {/* Posts Section (Empty State) */}
          <View style={styles.postsEmptyState}>
            <Text style={[styles.emptyStateText, { color: theme.mutedText }]}>
              No posts yet
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },

  // Header Banner
  headerBanner: {
    height: 200,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerGradient: {
    width: '100%',
    height: '100%',
  },
  settingsButton: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Profile Content
  profileContent: {
    paddingHorizontal: 16,
  },
  avatarSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: -40,
    marginBottom: 12,
  },
  avatarWrapper: {
    width: 134,
    height: 134,
    borderRadius: 67,
    borderWidth: 4,
    borderColor: '#ffffff',
    backgroundColor: '#ffffff',
    padding: 4,
  },
  avatarWithStory: {
    borderWidth: 3,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 63,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 63,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // User Info
  userInfoSection: {
    marginTop: 4,
    gap: 8,
  },
  displayName: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  usernameText: {
    fontSize: 15,
  },
  roleBadgeContainer: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  roleBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  bioText: {
    fontSize: 15,
    lineHeight: 20,
    marginTop: 4,
  },
  joinedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  joinedText: {
    fontSize: 15,
  },
  followStats: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 8,
  },
  followStatItem: {
    flexDirection: 'row',
    gap: 4,
  },
  followNumber: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  followLabel: {
    fontSize: 15,
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginTop: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#1d9bf0',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
  },
  activeTabText: {
    fontWeight: '700',
  },

  // Posts
  postsEmptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 15,
  },
});
