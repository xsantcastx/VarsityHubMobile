import { User, Organization, Team } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import events from '@/utils/events';
import { pickerMediaTypesProp } from '@/utils/picker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import GameVerticalFeedScreen, { FeedPost } from './game-details/GameVerticalFeedScreen';

const VIDEO_EXT = /\.(mp4|mov|webm|m4v|avi)$/i;

const toFeedPost = (item: any): FeedPost | null => {
  const id = item?.id ? String(item.id) : null;
  if (!id) return null;
  const media = typeof item?.media_url === 'string' ? item.media_url : null;
  const explicit = typeof item?.media_type === 'string' ? String(item.media_type).toLowerCase() : null;
  const media_type: 'video' | 'image' = media
    ? (explicit === 'video' || explicit === 'image' ? (explicit as any) : (VIDEO_EXT.test(media) ? 'video' : 'image'))
    : 'image';
  return {
    id,
    media_url: media,
    media_type,
    caption: item?.caption ?? item?.content ?? '',
    upvotes_count: item?.upvotes_count ?? 0,
    comments_count: item?.comments_count ?? item?._count?.comments ?? 0,
    bookmarks_count: item?.bookmarks_count ?? 0,
    created_at: item?.created_at ?? null,
    author: item?.author ? { id: String(item.author.id ?? id), display_name: item.author.display_name ?? null, avatar_url: item.author.avatar_url ?? null } : null,
    has_upvoted: Boolean(item?.has_upvoted),
    has_bookmarked: Boolean(item?.has_bookmarked),
    is_following_author: Boolean(item?.is_following_author),
  };
};

type CurrentUser = {
  id?: string | number;
  username?: string;
  email?: string;
  full_name?: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  preferences?: {
    role?: 'fan' | 'coach' | string | null;
    plan?: string | null;
    [key: string]: any;
  } | null;
  _count?: {
    posts?: number;
    followers?: number;
    following?: number;
  };
  [key: string]: any;
};

export default function ProfileScreen() {
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'interactions'>(() => {
    try { return (globalThis?.localStorage?.getItem('profile.activeTab') as any) || 'posts'; } catch { return 'posts'; }
  });
  const [posts, setPosts] = useState<any[]>([]);
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [postsHasMore, setPostsHasMore] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);

  const [interactions, setInteractions] = useState<any[]>([]);
  const [interCursor, setInterCursor] = useState<string | null>(null);
  const [interHasMore, setInterHasMore] = useState(true);
  const [interLoading, setInterLoading] = useState(false);
  const [interType, setInterType] = useState<'all' | 'like' | 'comment' | 'repost' | 'save'>('all');
  const [sort, setSort] = useState<'newest' | 'most_upvoted' | 'most_commented'>('newest');
  const [counts, setCounts] = useState<{ posts: number; likes: number; comments: number; reposts: number; saves: number } | null>(null);
  const rememberingTab = useRef(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);

  // Vertical viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerItems, setViewerItems] = useState<FeedPost[]>([]);
  const _profileResetCount = useRef(0);
  const setIfDifferent = useCallback((setter: any, next: any) => {
    setter((prev: any) => {
      try {
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
      } catch {}
      return next;
    });
  }, []);

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
        exif: false,
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

      // Load organizations - get user's teams and extract their organizations
      try {
        const myTeams = await Team.list('', true); // mine=true
        
        if (Array.isArray(myTeams) && myTeams.length > 0) {
          // Extract unique organization IDs from teams
          const orgIds = new Set<string>();
          const orgNames = new Set<string>();
          
          myTeams.forEach((team: any) => {
            if (team.organization_id) {
              orgIds.add(team.organization_id);
            }
            // Also try to extract organization from team name (e.g., "SHS Men's Soccer" -> "SHS")
            if (team.name) {
              const nameParts = String(team.name).split(/\s+/);
              if (nameParts.length > 0) {
                orgNames.add(nameParts[0]);
              }
            }
          });

          // Try to fetch by ID first
          if (orgIds.size > 0) {
            const orgPromises = Array.from(orgIds).map(id => 
              Organization.get(id).catch(err => null)
            );
            
            const orgsData = await Promise.all(orgPromises);
            const validOrgs = orgsData.filter(org => org !== null);
            
            if (validOrgs.length > 0) {
              setOrganizations(validOrgs);
            }
          }
          
          // If no orgs found by ID, try searching by name
          if (orgIds.size === 0 && orgNames.size > 0) {
            const searchPromises = Array.from(orgNames).map(name => 
              Organization.list(name, 5).catch(err => [])
            );
            
            const searchResults = await Promise.all(searchPromises);
            const flatResults = searchResults.flat();
            
            // Deduplicate by ID
            const uniqueOrgs = flatResults.filter((org: any, index: number, self: any[]) => 
              org && org.id && self.findIndex((o: any) => o?.id === org.id) === index
            );
            
            setOrganizations(uniqueOrgs);
          }
        }
      } catch (err) {
        console.error('Failed to load organizations', err);
      }

      // Load first page for active tab
      if (activeTab === 'posts') {
        await refreshPosts(u.id);
      } else {
        await refreshInteractions(u.id);
      }
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

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // Refresh when screen regains focus (after creating a post, etc.)
  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

  // Refresh when switching tabs
  useEffect(() => {
    if (!me?.id) return;
    if (activeTab === 'posts') {
      refreshPosts(String(me.id));
    } else {
      refreshInteractions(String(me.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // When interactions filters/sort change while on Interactions tab, refresh
  useEffect(() => {
    if (!me?.id) return;
    if (activeTab === 'interactions') {
      refreshInteractions(String(me.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interType, sort]);

  // Refresh interactions when a new comment is created from the viewer
  useEffect(() => {
    if (!me?.id) return;
    const off = events.on('comment:created', () => {
      if (activeTab === 'interactions') {
        refreshInteractions(String(me.id));
      }
    });
    return () => { off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, me?.id]);

  const refreshPosts = useCallback(async (userId: string) => {
    setPostsLoading(true);
    try {
      const page = await User.postsForProfile(String(userId), { limit: 10, sort });
      setPosts(page.items || []);
      setPostsCursor(page.nextCursor || null);
      setPostsHasMore(Boolean(page.nextCursor));
      if (page.counts) setCounts(page.counts);
    } finally {
      setPostsLoading(false);
    }
  }, [sort]);

  const loadMorePosts = useCallback(async (userId: string) => {
    if (postsLoading || !postsHasMore) return;
    setPostsLoading(true);
    try {
      const page = await User.postsForProfile(String(userId), { limit: 10, sort, cursor: postsCursor || undefined });
      setPosts((prev) => [...prev, ...(page.items || [])]);
      setPostsCursor(page.nextCursor || null);
      setPostsHasMore(Boolean(page.nextCursor));
      if (page.counts) setCounts(page.counts);
    } finally {
      setPostsLoading(false);
    }
  }, [postsCursor, postsHasMore, postsLoading, sort]);

  const refreshInteractions = useCallback(async (userId: string) => {
    setInterLoading(true);
    try {
      const page = await User.interactionsForProfile(String(userId), { limit: 10, sort, type: interType });
      setInteractions(page.items || []);
      setInterCursor(page.nextCursor || null);
      setInterHasMore(Boolean(page.nextCursor));
      if (page.counts) setCounts(page.counts);
    } finally {
      setInterLoading(false);
    }
  }, [interType, sort]);

  const loadMoreInteractions = useCallback(async (userId: string) => {
    if (interLoading || !interHasMore) return;
    setInterLoading(true);
    try {
      const page = await User.interactionsForProfile(String(userId), { limit: 10, sort, type: interType, cursor: interCursor || undefined });
      setInteractions((prev) => [...prev, ...(page.items || [])]);
      setInterCursor(page.nextCursor || null);
      setInterHasMore(Boolean(page.nextCursor));
      if (page.counts) setCounts(page.counts);
    } finally {
      setInterLoading(false);
    }
  }, [interCursor, interHasMore, interLoading, interType, sort]);

  const preferences = me?.preferences as { role?: string | null; plan?: string | null } | null;
  const rawRole = preferences?.role ?? (me as any)?.role ?? '';
  const roleRaw = typeof rawRole === 'string' ? rawRole.toLowerCase() : '';
  const roleLabel = roleRaw === 'coach' ? 'Coach / Organizer' : roleRaw === 'fan' ? 'Fan' : null;
  const planLabel = typeof preferences?.plan === 'string' ? preferences.plan : null;
  const formattedPlan = planLabel ? `${planLabel.charAt(0).toUpperCase()}${planLabel.slice(1)}` : null;
  const name = me?.display_name || me?.username || 'User';
  const stats = [
    { label: 'posts', value: me?._count?.posts ?? 0 },
    { label: 'followers', value: me?._count?.followers ?? 0 },
    { label: 'following', value: me?._count?.following ?? 0 },
  ];

  const renderHeader = () => (
    <>
      {/* Modern Sport-Inspired Header */}
      <View style={styles.headerContainer}>
        {/* Background Gradient */}
        <LinearGradient
          colors={['#1e3a8a', '#3b82f6', '#60a5fa']}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        
        {/* Settings Button */}
        <Pressable onPress={() => router.push('/settings')} style={[styles.settingsButtonTopRight, { top: 20 + insets.top }]}>
          <Ionicons name="settings-outline" size={20} color="#ffffff" />
        </Pressable>
        
        {/* Profile Content */}
        <View style={styles.profileContent}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <Pressable onPress={handleAvatarPress} disabled={isUploadingAvatar}>
              <View style={styles.avatarContainer}>
                {me.avatar_url ? (
                  <Image source={{ uri: String(me.avatar_url) }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={36} color="#ffffff" />
                  </View>
                )}
                {isUploadingAvatar && (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator color="white" />
                  </View>
                )}
              </View>
            </Pressable>
          </View>

          {/* User Info */}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{name}</Text>
            
            {/* Role and Plan Badges Row */}
            {(roleLabel || formattedPlan) && (
              <View style={styles.badgesRow}>
                {roleLabel && (
                  <View style={[styles.roleBadge, 
                    roleRaw === 'coach' && styles.coachBadge,
                    roleRaw === 'player' && styles.playerBadge,
                    roleRaw === 'fan' && styles.fanBadge
                  ]}>
                    <Ionicons 
                      name={roleRaw === 'coach' ? 'flag' : roleRaw === 'player' ? 'american-football' : 'heart'} 
                      size={12} 
                      color="#ffffff" 
                    />
                    <Text style={styles.roleText}>{roleRaw === 'coach' ? 'COACH' : roleRaw.toUpperCase()}</Text>
                  </View>
                )}
                {formattedPlan && (
                  <View style={[styles.planBadge, 
                    formattedPlan.toLowerCase() === 'rookie' && styles.rookieBadge,
                    formattedPlan.toLowerCase() === 'veteran' && styles.veteranBadge,
                    formattedPlan.toLowerCase() === 'legend' && styles.legendBadge
                  ]}>
                    <Ionicons 
                      name={formattedPlan.toLowerCase() === 'rookie' ? 'shield' : 
                           formattedPlan.toLowerCase() === 'veteran' ? 'medal' : 'trophy'} 
                      size={12} 
                      color="#ffffff" 
                    />
                    <Text style={styles.planBadgeText}>{formattedPlan.toUpperCase()}</Text>
                  </View>
                )}
              </View>
            )}
            
            {me?.bio && <Text style={styles.userBio}>{me.bio}</Text>}
          </View>

          {/* Edit Profile Button */}
          <View style={styles.actionsContainer}>
            <Pressable style={styles.editButton} onPress={() => router.push('/edit-profile')}>
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Athletic Stats Card */}
      <View style={[styles.statsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {stats.map((stat, index) => (
          <React.Fragment key={stat.label}>
            <Pressable 
              style={styles.statItem} 
              onPress={() => {
                if (stat.label === 'followers') {
                  router.push(`/followers?id=${me.id}&username=${name}`);
                } else if (stat.label === 'following') {
                  router.push(`/following?id=${me.id}&username=${name}`);
                }
              }}
            >
              <Text style={[styles.statNumber, { color: theme.text }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: theme.mutedText }]}>{stat.label}</Text>
            </Pressable>
            {index < stats.length - 1 && <View style={styles.statDivider} />}
          </React.Fragment>
        ))}
      </View>

      {/* Organizations Section */}
      {organizations.length > 0 && (
        <View style={[styles.organizationsSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.orgHeader}>
            <Ionicons name="business-outline" size={20} color={theme.tint} />
            <Text style={[styles.orgTitle, { color: theme.text }]}>Organizations</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.orgList}>
            {organizations.map((org) => (
              <Pressable
                key={org.id}
                style={[styles.orgCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => router.push({ pathname: '/league', params: { id: org.id, name: org.name } })}
              >
                {org.avatar_url ? (
                  <Image
                    source={{ uri: org.avatar_url }}
                    style={styles.orgLogo}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.orgLogoPlaceholder, { backgroundColor: theme.border }]}>
                    <Ionicons name="shield-outline" size={20} color={theme.mutedText} />
                  </View>
                )}
                <Text style={[styles.orgName, { color: theme.text }]} numberOfLines={2}>
                  {org.display_name || org.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={[styles.tabsContainer, { borderBottomColor: theme.border }] }>
        <Pressable
          onPress={() => { setActiveTab('posts'); try { globalThis?.localStorage?.setItem('profile.activeTab','posts'); } catch {} }}
          style={[styles.tab, activeTab === 'posts' && { borderBottomWidth: 2, borderBottomColor: theme.tint }]}
        >
          <Text style={[styles.tabText, { color: theme.mutedText }, activeTab === 'posts' && { color: theme.text } ]}>Posts{counts ? ` (${counts.posts})` : ''}</Text>
        </Pressable>
        <Pressable
          onPress={() => { setActiveTab('interactions'); try { globalThis?.localStorage?.setItem('profile.activeTab','interactions'); } catch {} }}
          style={[styles.tab, activeTab === 'interactions' && { borderBottomWidth: 2, borderBottomColor: theme.tint }]}
        >
          <Text style={[styles.tabText, { color: theme.mutedText }, activeTab === 'interactions' && { color: theme.text }]}>Interactions</Text>
        </Pressable>
      </View>

      {activeTab === 'interactions' && (
        <View style={styles.filtersBar}>
          <View style={styles.segmentedRow}>
            {(['all','like','comment','save'] as const).map((t) => {
              const label = t === 'all'
                ? 'All'
                : t === 'like'
                ? `Upvotes${counts ? ` (${counts.likes})` : ''}`
                : t === 'comment'
                ? `Comments${counts ? ` (${counts.comments})` : ''}`
                : `Saves${counts ? ` (${counts.saves})` : ''}`;
              return (
                <Pressable key={t} onPress={() => setInterType(t)} style={[styles.segment, { backgroundColor: theme.surface }, interType === t && [styles.segmentActive, { backgroundColor: theme.tint }]]}>
                  <Text style={[styles.segmentText, { color: theme.text }, interType === t && styles.segmentTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.sortRow}>
            {(['newest','most_upvoted','most_commented'] as const).map(s => (
              <Pressable key={s} onPress={() => setSort(s)} style={[styles.sortPill, { backgroundColor: theme.surface }, sort === s && [styles.sortPillActive, { backgroundColor: theme.tint }]]}>
                <Text style={[styles.sortText, { color: theme.text }, sort === s && styles.sortTextActive]}>
                  {s === 'newest' ? 'Newest' : s === 'most_upvoted' ? 'Most upvoted' : 'Most commented'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </>
  );

  const renderEmptyPosts = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No posts yet</Text>
      <Text style={styles.emptySubtitle}>Share your first moment with the community!</Text>
    <Button onPress={() => router.push('/create-post')}>Create Your First Post</Button>
    </View>
  );

  const onEndReachedPosts = useCallback(() => { if (me?.id) loadMorePosts(String(me.id)); }, [me?.id, loadMorePosts]);
  const onEndReachedInteractions = useCallback(() => { if (me?.id) loadMoreInteractions(String(me.id)); }, [me?.id, loadMoreInteractions]);

  // Some interaction items may wrap a post (e.g., { type, post, created_at })
  const unwrapPost = useCallback((item: any) => {
    return item?.post || item?.target?.post || item?.target || item;
  }, []);

  const SkeletonList = ({ count = 8 }: { count?: number }) => (
    <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ height: 100, backgroundColor: '#F3F4F6', borderRadius: 12, marginBottom: 12 }} />
      ))}
    </View>
  );

  if (loading) return <SkeletonList count={8} />;

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <View style={{ height: 8 }} />
  <Button onPress={() => router.push('/sign-in')}><Text>Sign In</Text></Button>
      </View>
    );
  }

  if (!me) {
    return null; // Or some other placeholder
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen options={{ title: 'Profile' }} />
      {activeTab === 'posts' ? (
        <FlatList
          data={posts}
          key={activeTab + '-grid'}
          numColumns={3}
          columnWrapperStyle={styles.gridRow}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyPosts}
          contentContainerStyle={{ paddingBottom: Math.max(32, insets.bottom + 16), paddingHorizontal: 2 }}
          onEndReachedThreshold={0.5}
          onEndReached={onEndReachedPosts}
          renderItem={({ item, index }) => {
            const thumb = item.media_url;
            const isVideo = !!thumb && VIDEO_EXT.test(thumb);
            const likes = item.upvotes_count ?? 0;
            const comments = item.comments_count ?? item._count?.comments ?? 0;
            return (
              <Pressable
                style={styles.gridItem}
                onPress={() => {
                  const mapped = (posts || []).map(toFeedPost);
                  const items = mapped.filter(Boolean) as FeedPost[];
                  const targetId = mapped[index]?.id;
                  const targetIdx = targetId ? items.findIndex((p) => p.id === targetId) : index;
                  if (__DEV__) console.debug('Profile opening viewer', { index, targetIdx, total: items.length });
                  setViewerItems(items);
                  setViewerIndex(Math.max(0, targetIdx));
                  setViewerOpen(true);
                }}
              >
                {thumb ? (
                  <View style={styles.gridImageContainer}>
                    <Image source={{ uri: thumb }} style={styles.gridImage} contentFit="cover" />
                    <View style={styles.gridImageOverlay} />
                  </View>
                ) : (
                  <View style={[styles.gridImage, styles.gridImageFallback]}>
                    <LinearGradient 
                      colors={["#667eea", "#764ba2", "#f093fb"]} 
                      style={StyleSheet.absoluteFillObject as any} 
                      start={{ x: 0, y: 0 }} 
                      end={{ x: 1, y: 1 }}
                    />
                    <View style={styles.textPostOverlay}>
                      <Text numberOfLines={4} style={styles.gridTextOnly}>{String(item.caption || item.content || '').trim() || 'Post'}</Text>
                    </View>
                  </View>
                )}
                {/* Counts overlay (shown for both media and text tiles) */}
                <View style={styles.gridCounts}>
                  <View style={styles.gridCountItem}>
                    <Ionicons name="arrow-up" size={12} color="#fff" />
                    <Text style={styles.gridCountText}>{likes}</Text>
                  </View>
                  <View style={styles.gridCountItem}>
                    <Ionicons name="chatbubble-ellipses" size={12} color="#fff" />
                    <Text style={styles.gridCountText}>{comments}</Text>
                  </View>
                </View>
                {/* Bottom-right badge: camera for media, text icon for text-only */}
                <View style={styles.gridIconBadge}>
                  <Ionicons name={thumb ? 'camera-outline' : 'text'} size={14} color="#fff" />
                </View>
              </Pressable>
            );
          }}
          ListFooterComponent={postsLoading ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
        />
      ) : (
        <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={{ paddingBottom: Math.max(32, insets.bottom + 16) }}>
          {renderHeader()}
          {interactions.length === 0 ? (
            <View style={styles.emptyContainer}><Text style={[styles.emptyTitle, { color: theme.text }]}>No activity yet</Text></View>
          ) : (
            <View style={styles.masonryContainer}>
              {interactions.map((item, index) => {
                const postItem = unwrapPost(item);
                const thumb = postItem?.media_url;
                const likes = postItem?.upvotes_count ?? 0;
                const comments = postItem?.comments_count ?? postItem?._count?.comments ?? 0;
                
                // Create varied aspect ratios for dynamic look
                const aspectRatios = [1, 1.2, 0.8, 1.5, 0.75, 1.1, 0.9, 1.3];
                const aspectRatio = aspectRatios[index % aspectRatios.length];
                
                return (
                  <Pressable
                    key={`${postItem?.id ?? item?.id ?? index}-${index}`}
                    style={[styles.masonryItem, { aspectRatio }]}
                    onPress={() => {
                      const mapped = (interactions || []).map(unwrapPost).map(toFeedPost);
                      const items = mapped.filter(Boolean) as FeedPost[];
                      const targetId = unwrapPost(interactions[index])?.id;
                      const targetIdx = targetId ? items.findIndex((p) => p.id === targetId) : index;
                      setViewerItems(items);
                      setViewerIndex(Math.max(0, targetIdx));
                      setViewerOpen(true);
                    }}
                  >
                    {thumb ? (
                      <View style={styles.gridImageContainer}>
                        <Image source={{ uri: thumb }} style={styles.gridImage} contentFit="cover" />
                        <View style={styles.gridImageOverlay} />
                      </View>
                    ) : (
                      <View style={[styles.gridImage, styles.gridImageFallback]}>
                        <LinearGradient 
                          colors={["#667eea", "#764ba2", "#f093fb"]} 
                          style={StyleSheet.absoluteFillObject as any} 
                          start={{ x: 0, y: 0 }} 
                          end={{ x: 1, y: 1 }}
                        />
                        <View style={styles.textPostOverlay}>
                          <Text numberOfLines={4} style={styles.gridTextOnly}>{String(postItem?.caption || postItem?.content || '').trim() || 'Post'}</Text>
                        </View>
                      </View>
                    )}
                    <View style={styles.gridCounts}>
                      <View style={styles.gridCountItem}>
                        <Ionicons name="arrow-up" size={12} color="#fff" />
                        <Text style={styles.gridCountText}>{likes}</Text>
                      </View>
                      <View style={styles.gridCountItem}>
                        <Ionicons name="chatbubble-ellipses" size={12} color="#fff" />
                        <Text style={styles.gridCountText}>{comments}</Text>
                      </View>
                    </View>
                    <View style={styles.gridIconBadge}>
                      <Ionicons name={thumb ? 'camera-outline' : 'text'} size={14} color="#fff" />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
          {interLoading && <ActivityIndicator style={{ marginVertical: 16 }} />}
        </ScrollView>
      )}

      <Modal visible={viewerOpen} animationType="slide" onRequestClose={() => setViewerOpen(false)}>
        <GameVerticalFeedScreen
          onClose={() => setViewerOpen(false)}
          showHeader
          initialPosts={viewerItems}
          startIndex={viewerIndex}
          title={activeTab === 'posts' ? 'Your posts' : 'Your interactions'}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1
  },
  center: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#b91c1c', textAlign: 'center' },
  
  // Modern Sport Header Styles
  headerContainer: {
    position: 'relative',
    paddingBottom: 20,
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  profileContent: {
    paddingHorizontal: 20,
    paddingTop: 20, // Safe area is handled by SafeAreaView
    paddingBottom: 30,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 46,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 46,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 46,
  },
  settingsButtonTopRight: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  userBio: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    paddingHorizontal: 20,
  },
  badgesRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginTop: 8, 
    marginBottom: 4,
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f59e0b',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  coachBadge: { backgroundColor: '#1d4ed8' },
  playerBadge: { backgroundColor: '#dc2626' },
  fanBadge: { backgroundColor: '#7c3aed' },
  roleText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#111827',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  rookieBadge: { backgroundColor: '#22c55e' },
  veteranBadge: { backgroundColor: '#f59e0b' },
  legendBadge: { backgroundColor: '#dc2626' },
  planBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  actionsContainer: {
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  
  // Athletic Stats Card
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: -10,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1e293b',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 16,
  },
  
  // Legacy styles kept for existing components
  statValue: { fontSize: 20, fontWeight: '800', color: '#1f2937' },
  name: { fontSize: 18, fontWeight: '800', marginBottom: 4, color: '#111827' },
  bio: { fontSize: 15, color: '#4B5563', lineHeight: 20, marginTop: 8 },
  editProfileButton: { 
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center'
  },
  masonryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingBottom: 32,
  },
  masonryItem: {
    width: '32%',
    margin: '0.66%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, backgroundColor: 'transparent' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: 'black' },
  tabText: { color: '#6B7280', fontWeight: '600', fontSize: 15 },
  activeTabText: { color: 'black' },
  filtersBar: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 12, backgroundColor: 'transparent' },
  segmentedRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  segment: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  segmentActive: {},
  segmentText: { fontWeight: '600', fontSize: 13 },
  segmentTextActive: { color: 'white' },
  sortRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  sortPill: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 16 },
  sortPillActive: {},
  sortText: { fontWeight: '600', fontSize: 12 },
  sortTextActive: { color: 'white' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1f2937' },
  emptySubtitle: { color: '#6B7280', textAlign: 'center', marginBottom: 20, fontSize: 15, lineHeight: 22 },
  activityItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  gridRow: { gap: 3 },
  gridItem: { 
    flex: 1, 
    aspectRatio: 1, 
    margin: 1.5, 
    borderRadius: 12, 
    overflow: 'hidden', 
    backgroundColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  gridImageContainer: { width: '100%', height: '100%', position: 'relative' },
  gridImage: { width: '100%', height: '100%' },
  gridImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  gridImageFallback: { alignItems: 'center', justifyContent: 'center', padding: 12, position: 'relative' },
  textPostOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    margin: 8,
    backdropFilter: 'blur(10px)'
  },
  gridTextOnly: { 
    textAlign: 'center', 
    color: '#ffffff', 
    fontWeight: '700', 
    fontSize: 12, 
    lineHeight: 16,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  },
  gridIconBadge: { 
    position: 'absolute', 
    bottom: 8, 
    right: 8, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    borderRadius: 14, 
    width: 28, 
    height: 28, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2
  },
  gridCounts: { 
    position: 'absolute', 
    left: 8, 
    bottom: 8, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    borderRadius: 14, 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2
  },
  gridCountItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  gridCountText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  
  // Organizations Section
  organizationsSection: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  orgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  orgTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  orgList: {
    gap: 12,
    paddingRight: 16,
  },
  orgCard: {
    width: 100,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  orgLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  orgLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

