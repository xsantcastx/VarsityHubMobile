import { User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/shared/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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
      // Keep legacy ProfileScreen UI; no redirect
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
        let merged = list;
        // Prefetch next page once if available (helps pagination and tests)
        if (res?.nextCursor) {
          try {
            const next = await User.postsForProfile(user.id, { limit: 20, sort: 'newest', cursor: res.nextCursor });
            const nextItems = next?.items || next || [];
            merged = [...merged, ...nextItems];
          } catch (err) {
            console.warn('Unable to prefetch next page of posts:', err);
          }
        }
        setItems(merged);
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

  // Render legacy profile page directly

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

      {/* Back Button: Always show at top left */}
      <View style={{ position: 'absolute', top: insets.top + 8, left: 8, zIndex: 20 }}>
        <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', padding: 6 }} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={28} color={theme.tint} />
          <Text style={{ color: theme.tint, fontSize: 17, fontWeight: '600', marginLeft: 2 }}>Back</Text>
        </Pressable>
      </View>

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
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80' }}
              style={styles.bannerImage}
              contentFit="cover"
            />
          )}
          {/* Background Image Upload Button */}
          <Pressable
            testID="background-upload-button"
            style={{
              position: 'absolute',
              right: 16,
              bottom: 16,
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderRadius: 20,
              padding: 8,
              zIndex: 10,
            }}
            accessibilityRole="button"
            onPress={() => {/* TODO: Implement background upload logic */}}
          >
            <Ionicons name="image-outline" size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Profile Content */}
        <View style={styles.profileContent}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 4 }}>
            <Pressable 
              style={[
                styles.avatarWrapper,
                hasActiveStory && styles.avatarWithStory,
                { borderColor: '#000' }
              ]}
              testID="avatar-upload-button"
              accessibilityRole="button"
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
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginLeft: 12 }}>
              <View>
                <Text style={[styles.displayName, { color: '#fff', textShadowColor: '#000', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 2 }]}>{name}</Text>
                <Pressable 
                  style={[styles.editButton, { borderColor: '#fff', marginTop: 4, backgroundColor: 'rgba(0,0,0,0.25)' }]}
                  onPress={() => router.push('/edit-profile')}
                >
                  <Text style={[styles.editButtonText, { color: '#fff', textShadowColor: '#000', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 2 }]}>Edit profile</Text>
                </Pressable>
              </View>
              <Pressable 
                style={[styles.settingsIconButton, { borderColor: '#fff', marginLeft: 16, backgroundColor: 'rgba(0,0,0,0.15)' }]}
                onPress={() => router.push('/settings')}
              >
                <Ionicons name="settings-outline" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>

          {/* User Info */}
          <View style={styles.userInfoSection}>
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
    bannerImage: {
      width: '100%',
      height: '100%',
    },
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
    height: 220,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  profileContent: {
    paddingHorizontal: 12,
    marginTop: -80, // Overlap avatar with banner, but show banner
  },
  avatarSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start', // Move edit button up to top of avatar
    marginTop: 0,
    marginBottom: 4,
  },
  actionsColumn: {
    alignItems: 'flex-end',
    gap: 32, // Move settings wheel further down, but keep avatar compact
    marginTop: 24,
  },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: '#ffffff',
    padding: 2,
  },
  avatarWithStory: {
    borderWidth: 3,
    borderColor: '#1d9bf0', // Blue ring for active story
    shadowColor: '#1d9bf0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
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
