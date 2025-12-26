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
  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'upvotes'>('posts');
  const [items, setItems] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

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

  const fetchList = useCallback(async () => {
    if (!user?.id) return;
    setListLoading(true);
    setListError(null);
    try {
      if (activeTab === 'posts') {
        const res = await User.postsForProfile(user.id, { limit: 20, sort: 'newest' });
        const list = res?.items || res || [];
        setItems(list);
      } else {
        const type = activeTab === 'replies' ? 'comment' : 'like';
        const res = await User.interactionsForProfile(user.id, { limit: 20, sort: 'newest', type });
        const list = (res?.items || res || []).map((it: any) => {
          const post = it?.post || it?.target?.post || it?.target || it;
          return { ...post, __interaction: it };
        });
        setItems(list);
      }
    } catch (e: any) {
      setListError(e?.message || 'Failed to load');
    } finally {
      setListLoading(false);
    }
  }, [activeTab, user?.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

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
        </View>

        {/* Profile Content */}
        <View style={styles.profileContent}>
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

            <View style={styles.actionsColumn}>
              <Pressable 
                style={[styles.editButton, { borderColor: theme.border }]}
                onPress={() => router.push('/edit-profile')}
              >
                <Text style={[styles.editButtonText, { color: theme.text }]}>Edit profile</Text>
              </Pressable>

              <Pressable 
                style={[styles.settingsIconButton, { borderColor: theme.border }]}
                onPress={() => router.push('/settings')}
              >
                <Ionicons name="settings-outline" size={18} color={theme.text} />
              </Pressable>
            </View>
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

          {/* Tabs Section */}
          <View style={[styles.tabsContainer, { borderTopColor: theme.border, borderBottomColor: theme.border }]}>
            <Pressable
              style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
              onPress={() => setActiveTab('posts')}
            >
              <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText, { color: activeTab === 'posts' ? theme.text : theme.mutedText }]}>Posts</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'replies' && styles.activeTab]}
              onPress={() => setActiveTab('replies')}
            >
              <Text style={[styles.tabText, activeTab === 'replies' && styles.activeTabText, { color: activeTab === 'replies' ? theme.text : theme.mutedText }]}>Replies</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'upvotes' && styles.activeTab]}
              onPress={() => setActiveTab('upvotes')}
            >
              <Text style={[styles.tabText, activeTab === 'upvotes' && styles.activeTabText, { color: activeTab === 'upvotes' ? theme.text : theme.mutedText }]}>Upvotes</Text>
            </Pressable>
          </View>

          {/* Content Section */}
          {listLoading ? (
            <View style={styles.listState}><ActivityIndicator color={theme.tint} /></View>
          ) : listError ? (
            <View style={styles.listState}>
              <Text style={[styles.emptyStateText, { color: '#b91c1c' }]}>{listError}</Text>
              <Pressable style={[styles.retryButton, { backgroundColor: theme.tint }]} onPress={() => void fetchList()}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.postsEmptyState}>
              <Text style={[styles.emptyStateText, { color: theme.mutedText }]}>
                {activeTab === 'posts' ? 'No posts yet' : activeTab === 'replies' ? 'No replies yet' : 'No upvotes yet'}
              </Text>
            </View>
          ) : (
            <View style={styles.cardList}>
              {items.map((item, idx) => {
                const title = item?.title || item?.caption || item?.content || 'Post';
                const subtitle = item?.created_at ? new Date(item.created_at).toLocaleDateString() : '';
                return (
                  <View key={item?.id || idx} style={[styles.card, { borderColor: theme.border }]}> 
                    <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>{title}</Text>
                    {subtitle ? <Text style={[styles.cardSubtitle, { color: theme.mutedText }]}>{subtitle}</Text> : null}
                    {activeTab !== 'posts' && item?.__interaction?.type ? (
                      <Text style={[styles.cardBadge, { color: theme.mutedText }]}>{item.__interaction.type}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
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
    height: 120,
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

  // Profile Content
  profileContent: {
    paddingHorizontal: 12,
  },
  avatarSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: -24,
    marginBottom: 12,
  },
  actionsColumn: {
    alignItems: 'flex-end',
    gap: 8,
  },
  avatarWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
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
    borderRadius: 58,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 58,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingsIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // User Info
  userInfoSection: {
    marginTop: 2,
    gap: 6,
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
    marginTop: 2,
  },
  joinedText: {
    fontSize: 15,
  },
  followStats: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 6,
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
    marginTop: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
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
    paddingVertical: 36,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 15,
  },
  listState: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 8,
  },
  cardList: {
    paddingVertical: 12,
    gap: 10,
  },
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fff',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
  },
  cardBadge: {
    fontSize: 12,
    marginTop: 6,
  },
});
