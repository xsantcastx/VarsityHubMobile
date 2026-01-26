import { Organization, Team, User } from '@/api/entities';
import uploadFile from '@/api/upload';
import { JerseyBadge, Sport } from '@/components/JerseyBadge';
import { Button } from '@/components/ui/button';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/context/AuthProvider';
import events from '@/utils/events';
import { pickerMediaTypesProp } from '@/utils/picker';
import { getGradientForColor } from '@/utils/theme';
import { calculateContrastRatio } from '@/utils/accessibility';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import GameVerticalFeedScreen, { FeedPost } from './game-details/GameVerticalFeedScreen';

type ProfilePreferences = {
  role?: string | null;
  plan?: string | null;
  position?: string | null;
  jersey_number?: string | number | null;
  grade_level?: string | null;
  graduation_year?: string | number | null;
  accolades?: string | null;
  primary_sport?: Sport | string | null;
  sport?: string | null;
  header_image_url?: string | null;
  header_image_focus_y?: number | null;
  location?: string | null;
};
const uploadAvatar = uploadFile.uploadFile;

const VIDEO_EXT = /\.(mp4|mov|webm|m4v|avi)$/i;
const HEADER_IMAGE_DRAG_LIMIT = 120;
const clampValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Get sport emoji based on sport type
 */
const getSportEmoji = (sport: string): string => {
  const emojiMap: Record<string, string> = {
    basketball: '🏀',
    football: '🏈',
    baseball: '⚾',
    soccer: '⚽',
    volleyball: '🏐',
    other: '🏆',
  };
  return emojiMap[sport.toLowerCase()] || '🏆';
};

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
    author: item?.author ? { id: String(item.author.id ?? id), username: item.author.username ?? null, avatar_url: item.author.avatar_url ?? null } : null,
    has_upvoted: Boolean(item?.has_upvoted),
    has_bookmarked: Boolean(item?.has_bookmarked),
    is_following_author: Boolean(item?.is_following_author),
  };
};

type CurrentUser = {
  id?: string | number;
  username?: string; // Only username (with @) - no display_name
  email?: string;
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
  const { user: userFromHook, refresh: refreshUserFromHook } = useUser(false); // Get user from hook but don't auto-load
  const { user: userFromAuth } = useAuth(); // Get user from AuthProvider
  const [loading, setLoading] = useState(false); // Start as false - only show loading when actually loading
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const hasLoadedOnce = useRef(false);
  const isInitialMount = useRef(true);
  const lastUsernameRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'upvotes'>(() => {
    try { return (globalThis?.localStorage?.getItem('profile.activeTab') as any) || 'posts'; } catch (error) { console.warn('[profile] Failed to read activeTab from localStorage:', error); return 'posts'; }
  });
  const [posts, setPosts] = useState<any[]>([]);
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [postsHasMore, setPostsHasMore] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const postsRequestInFlight = useRef(false);

  const [replies, setReplies] = useState<any[]>([]);
  const [repliesCursor, setRepliesCursor] = useState<string | null>(null);
  const [repliesHasMore, setRepliesHasMore] = useState(true);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const repliesRequestInFlight = useRef(false);
  
  const [upvotes, setUpvotes] = useState<any[]>([]);
  const [upvotesCursor, setUpvotesCursor] = useState<string | null>(null);
  const [upvotesHasMore, setUpvotesHasMore] = useState(true);
  const [upvotesLoading, setUpvotesLoading] = useState(false);
  const upvotesRequestInFlight = useRef(false);
  const [sort, setSort] = useState<'newest' | 'most_upvoted' | 'most_commented'>('newest');
  const [counts, setCounts] = useState<{ posts: number; likes: number; comments: number; reposts: number; saves: number } | null>(null);
  const _rememberingTab = useRef(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [userThemeColor, setUserThemeColor] = useState<string>('#3B82F6'); // Default color
  const profileRequestInFlight = useRef(false);

  const setIfDifferent = useCallback((setter: any, next: any) => {
    setter((prev: any) => {
      try {
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
      } catch (error) {
        // Silently fail - localStorage is optional
        if (__DEV__) console.warn('[profile] localStorage error:', error);
      }
      return next;
    });
  }, []);

  const refreshPosts = useCallback(async (userId: string) => {
    if (postsRequestInFlight.current) return;
    postsRequestInFlight.current = true;
    setPostsLoading(true);
    try {
      const page = await User.postsForProfile(String(userId), { limit: 10, sort });
      setIfDifferent(setPosts, page.items || []);
      setPostsCursor(page.nextCursor || null);
      setPostsHasMore(Boolean(page.nextCursor));
      if (page.counts) setCounts(page.counts);
    } finally {
      postsRequestInFlight.current = false;
      setPostsLoading(false);
    }
  }, [sort, setIfDifferent]);

  const refreshReplies = useCallback(async (userId: string) => {
    if (repliesRequestInFlight.current) return;
    repliesRequestInFlight.current = true;
    setRepliesLoading(true);
    try {
      const page = await User.interactionsForProfile(String(userId), { limit: 10, type: 'comment', sort });
      setIfDifferent(setReplies, page.items || []);
      setRepliesCursor(page.nextCursor || null);
      setRepliesHasMore(Boolean(page.nextCursor));
      if (page.counts) setCounts(page.counts);
    } finally {
      repliesRequestInFlight.current = false;
      setRepliesLoading(false);
    }
  }, [sort, setIfDifferent]);

  const refreshUpvotes = useCallback(async (userId: string) => {
    if (upvotesRequestInFlight.current) return;
    upvotesRequestInFlight.current = true;
    setUpvotesLoading(true);
    try {
      const page = await User.interactionsForProfile(String(userId), { limit: 10, type: 'like', sort });
      setIfDifferent(setUpvotes, page.items || []);
      setUpvotesCursor(page.nextCursor || null);
      setUpvotesHasMore(Boolean(page.nextCursor));
      if (page.counts) setCounts(page.counts);
    } finally {
      upvotesRequestInFlight.current = false;
      setUpvotesLoading(false);
    }
  }, [sort, setIfDifferent]);

  // Vertical viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerItems, setViewerItems] = useState<FeedPost[]>([]);
  const _profileResetCount = useRef(0);
  
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

      const { uri, fileName, _mimeType } = pickerResult.assets[0] as any;
      const manipulated = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 800 } }], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
      const name = (fileName && String(fileName).includes('.')) ? String(fileName) : `avatar_${Date.now()}.jpg`;
      
      // Use shared upload helper with consistent auth/retry logic
      const { url } = await uploadAvatar(null, manipulated.uri, name);
      await User.updateMe({ avatar_url: url });
      setMe((prev) => (prev ? { ...prev, avatar_url: url } : null));

  } catch (error) {
    console.error('[profile] Avatar upload failed:', error);
    // Avatar upload failed - error handled via Alert below
    Alert.alert("Upload failed", "Could not upload your new profile picture. Please try again.");
  } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleBackgroundImagePress = async () => {
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
        aspect: [16, 9],
        selectionLimit: 1,
        quality: 0.9,
        exif: false,
      } as any);

      if (pickerResult.canceled) {
        return;
      }

      const { uri, fileName, _mimeType } = pickerResult.assets[0] as any;
      const manipulated = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1200 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
      const name = (fileName && String(fileName).includes('.')) ? String(fileName) : `background_${Date.now()}.jpg`;
      
      const { url } = await uploadAvatar(null, manipulated.uri, name);
      const preferences = me?.preferences || {};
      const updatedPreferences = { ...preferences, header_image_url: url };
      await User.updateMe({ preferences: updatedPreferences });
      setMe((prev) => (prev ? { ...prev, preferences: updatedPreferences } : null));

  } catch (error) {
    console.error('[profile] Background image upload failed:', error);
    Alert.alert("Upload failed", "Could not upload your background image. Please try again.");
  } finally {
      setIsUploadingAvatar(false);
    }
  };

  const loadProfile = useCallback(async (options?: { silent?: boolean }) => {
    if (profileRequestInFlight.current) return;
    profileRequestInFlight.current = true;
    
    // Only show loading skeleton on very first load (initial mount with no data)
    const isInitialLoad = isInitialMount.current && !hasLoadedOnce.current && !me;
    if (!options?.silent && isInitialLoad) {
      setLoading(true);
    }
    // If silent refresh or already loaded, ensure loading is false
    if (options?.silent || hasLoadedOnce.current) {
      setLoading(false);
    }
    setError(null);
    
    try {
      // Step 1: ensure session is valid
      // Force fresh data by adding cache-busting header
      const u: any = await User.me();
      if (__DEV__) console.warn('[profile] Loaded user data:', { id: u?.id, username: u?.username });
      if (u && !u._isNotModified) {
        setMe(u ?? null);
        if (__DEV__) console.warn('[profile] Updated me state with username:', u?.username);
      }
      if (!u?.id) { 
        setError('You need to sign in to view your profile.');
        setLoading(false);
        return;
      }

      // Mark as loaded and not initial mount anymore
      hasLoadedOnce.current = true;
      isInitialMount.current = false;

      // Extract theme color from preferences - only for coach/organization accounts
      const userRole = (u?.preferences?.role || u?.role || '').toLowerCase();
      const isCoachOrOrg = userRole === 'coach' || userRole === 'admin' || userRole === 'organization';
      const themeColor = isCoachOrOrg ? (u?.preferences?.theme_color || '#3B82F6') : '#6B7280'; // Default gray for fans
      setUserThemeColor(themeColor);

      // Load first page for active tab (only if initial load or tab changed)
      if (isInitialLoad || !options?.silent) {
        if (activeTab === 'posts') {
          await refreshPosts(u.id);
        } else if (activeTab === 'replies') {
          await refreshReplies(u.id);
        } else if (activeTab === 'upvotes') {
          await refreshUpvotes(u.id);
        }
      }
    } catch (e: any) {
      console.error('[Profile] Failed to load profile:', e);
      // Only show error if not silent refresh
      if (!options?.silent) {
        if (e && e.status === 401) {
          setError('You need to sign in to view your profile.');
        } else if (e?.isNetworkError || e?.status === 0) {
          setError('Unable to connect to server. Please check your internet connection.');
        } else {
          setError(e?.message ? `Unable to load profile: ${e.message}` : 'Unable to load profile. Please try again.');
        }
        // Clear me on error to prevent stale data
        setMe(null);
      }
    } finally {
      profileRequestInFlight.current = false;
      setLoading(false);
    }
  }, [activeTab, refreshPosts, refreshReplies, refreshUpvotes, me]);

  // Initial load on mount - only once
  useEffect(() => {
    if (isInitialMount.current) {
      void loadProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  // Sync with user data from hooks/AuthProvider when username changes
  useEffect(() => {
    const currentUsername = userFromHook?.username || userFromAuth?.username;
    const previousUsername = lastUsernameRef.current;
    const currentMeUsername = me?.username;
    
    if (__DEV__) console.warn('[profile] Username sync check:', { 
      currentUsername, 
      previousUsername, 
      currentMeUsername,
      userFromHookUsername: userFromHook?.username,
      userFromAuthUsername: userFromAuth?.username
    });
    
    // If username changed and we have a new username, refresh profile
    if (currentUsername && currentUsername !== previousUsername) {
      if (__DEV__) console.warn('[profile] Username changed, refreshing profile:', { previous: previousUsername, current: currentUsername });
      lastUsernameRef.current = currentUsername;
      void loadProfile({ silent: true });
    } else if (currentUsername && currentUsername !== currentMeUsername && hasLoadedOnce.current) {
      // Username in hooks doesn't match profile - force refresh
      if (__DEV__) console.warn('[profile] Username mismatch detected, forcing refresh:', { hook: currentUsername, profile: currentMeUsername });
      lastUsernameRef.current = currentUsername;
      void loadProfile({ silent: true });
    } else if (currentUsername) {
      lastUsernameRef.current = currentUsername;
    }
  }, [userFromHook?.username, userFromAuth?.username, me?.username, loadProfile, hasLoadedOnce]);

  // Silent refresh on focus - NEVER show skeleton after first load
  useFocusEffect(
    useCallback(() => {
      if (__DEV__) console.warn('[profile] Screen focused, checking if refresh needed');
      // Refresh user data from hooks first, then refresh profile
      if (hasLoadedOnce.current) {
        if (__DEV__) console.warn('[profile] Refreshing user hooks and profile on focus (silent)');
        // Refresh hooks first to get latest username
        Promise.all([
          refreshUserFromHook().catch(() => {}),
          loadProfile({ silent: true })
        ]).catch(() => {});
      } else if (isInitialMount.current && !profileRequestInFlight.current) {
        // Only do full load if this is the initial mount and nothing is in flight
        if (__DEV__) console.warn('[profile] Initial load on mount');
        void loadProfile();
      }
    }, [loadProfile, refreshUserFromHook])
  );

  // Load organizations separately to avoid blocking profile render
  useEffect(() => {
    if (!me?.id) return;
    
    const loadOrganizations = async () => {
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
              Organization.get(id).catch((_err: any) => null)
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
              Organization.list(name, 5).catch((_err: any) => [])
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
    };
    
    void loadOrganizations();
  }, [me?.id]);

  // Refresh when switching tabs
  useEffect(() => {
    if (!me?.id) return;
    setError(null); // Clear any stale errors
    if (activeTab === 'posts') {
      void refreshPosts(String(me.id));
    } else if (activeTab === 'replies') {
      void refreshReplies(String(me.id));
    } else if (activeTab === 'upvotes') {
      void refreshUpvotes(String(me.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, me?.id]);

  // When sort changes while on Replies or Upvotes tab, refresh
  useEffect(() => {
    if (!me?.id) return;
    if (activeTab === 'replies') {
      setError(null);
      void refreshReplies(String(me.id));
    } else if (activeTab === 'upvotes') {
      setError(null);
      void refreshUpvotes(String(me.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, me?.id]);

  // Refresh replies when a new comment is created from the viewer
  useEffect(() => {
    if (!me?.id) return;
    const off = events.on('comment:created', () => {
      if (activeTab === 'replies') {
        void refreshReplies(String(me.id));
      }
    });
    return () => { off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, me?.id]);

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

  const loadMoreReplies = useCallback(async (userId: string) => {
    if (repliesLoading || !repliesHasMore) return;
    setRepliesLoading(true);
    try {
      const page = await User.interactionsForProfile(String(userId), { limit: 10, sort, type: 'comment', cursor: repliesCursor || undefined });
      setReplies((prev) => [...prev, ...(page.items || [])]);
      setRepliesCursor(page.nextCursor || null);
      setRepliesHasMore(Boolean(page.nextCursor));
      if (page.counts) setCounts(page.counts);
    } finally {
      setRepliesLoading(false);
    }
  }, [repliesCursor, repliesHasMore, repliesLoading, sort]);

  const loadMoreUpvotes = useCallback(async (userId: string) => {
    if (upvotesLoading || !upvotesHasMore) return;
    setUpvotesLoading(true);
    try {
      const page = await User.interactionsForProfile(String(userId), { limit: 10, sort, type: 'like', cursor: upvotesCursor || undefined });
      setUpvotes((prev) => [...prev, ...(page.items || [])]);
      setUpvotesCursor(page.nextCursor || null);
      setUpvotesHasMore(Boolean(page.nextCursor));
      if (page.counts) setCounts(page.counts);
    } finally {
      setUpvotesLoading(false);
    }
  }, [upvotesCursor, upvotesHasMore, upvotesLoading, sort]);

  const preferences = me?.preferences ? (me.preferences as ProfilePreferences) : null;
  const rawRole = preferences?.role ?? (me as any)?.role ?? '';
  const roleRaw = typeof rawRole === 'string' ? rawRole.toLowerCase() : '';
  const roleLabel = roleRaw === 'coach' ? 'Coach / Organizer' : roleRaw === 'fan' ? 'Fan' : null;
  // Use ONLY username (with @) - no display_name
  const displayUsername = me?.username ? `@${me.username}` : 'User';
  
  // Athlete-specific data from preferences
  const isAthlete = Boolean(preferences?.position || preferences?.jersey_number);
  const jerseyNumber = preferences?.jersey_number || me?.jersey_number;
  const position = preferences?.position || me?.position;
  const gradeLevel = preferences?.grade_level;
  const graduationYear = preferences?.graduation_year;
  const accolades = preferences?.accolades;
  const primarySport = (preferences?.primary_sport || preferences?.sport || 'other') as Sport;
  const headerBackgroundImage = preferences?.header_image_url || null;
  const headerImageFocusY = clampValue(typeof preferences?.header_image_focus_y === 'number' ? preferences.header_image_focus_y : 0, -1, 1);
  const heroGradientColors: [string, string, ...string[]] = headerBackgroundImage
    ? ['rgba(4,7,20,0.85)', 'rgba(15,23,42,0.45)']
    : (getGradientForColor(userThemeColor) as [string, string, ...string[]]);
  
  // Helper function to determine text color based on background contrast
  // White is default, but switches to black if white has insufficient contrast
  const getTextColorForBackground = (bgColor: string): string => {
    // Convert rgba to hex if needed
    let hexColor = bgColor;
    if (bgColor.startsWith('rgba')) {
      const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const r = parseInt(match[1], 10);
        const g = parseInt(match[2], 10);
        const b = parseInt(match[3], 10);
        hexColor = `#${[r, g, b].map(x => {
          const hex = x.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        }).join('')}`;
      }
    }
    
    // Calculate contrast ratio for white text (default)
    const whiteContrast = calculateContrastRatio('#FFFFFF', hexColor);
    
    // If white has sufficient contrast (>= 3.0 for large text), use white
    // Otherwise, use black
    if (whiteContrast && whiteContrast >= 3.0) {
      return '#FFFFFF';
    }
    return '#000000';
  };
  
  // Get the first gradient color to determine text color
  const firstGradientColor = heroGradientColors[0] || userThemeColor;
  const userNameTextColor = getTextColorForBackground(firstGradientColor);
  
  const stats = [
    { label: 'posts', value: me?._count?.posts ?? 0 },
    { label: 'followers', value: me?._count?.followers ?? 0 },
    { label: 'following', value: me?._count?.following ?? 0 },
  ];

  const renderHeader = () => (
    <>
      {/* Banner Header - Exact Match to Reference */}
      <View style={[styles.headerContainer, { backgroundColor: theme.background }]}>
        {/* Background Image / Gradient */}
        <Pressable 
          onPress={handleBackgroundImagePress} 
          style={styles.headerBackgroundPressable}
          disabled={isUploadingAvatar}
        >
          {headerBackgroundImage ? (
            <Image
              source={{ uri: headerBackgroundImage }}
              style={[
                styles.headerBackgroundImage,
                { transform: [{ translateY: headerImageFocusY * HEADER_IMAGE_DRAG_LIMIT }] },
              ]}
              contentFit="cover"
            />
          ) : (
            <View style={styles.headerBackgroundImage} />
          )}
        </Pressable>
        {!headerBackgroundImage && (
          <LinearGradient
            colors={heroGradientColors}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}
        
        {/* Settings Button - Top Right */}
        <View style={[styles.headerControls, { top: Math.max(12, insets.top) }]}>
          <Pressable onPress={() => void router.push('/settings')} style={[styles.controlButton, { backgroundColor: colorScheme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.9)' }]}>
            <Ionicons name="settings-outline" size={18} color={colorScheme === 'dark' ? '#FFFFFF' : '#333'} />
          </Pressable>
        </View>
        
        {/* Profile Content - Avatar on Bottom-Left of Banner */}
        <View style={styles.profileContent}>
          {/* Large Avatar - Overlapping Banner */}
          <Pressable onPress={handleAvatarPress} disabled={isUploadingAvatar} style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              {me?.avatar_url ? (
                <Image source={{ uri: String(me?.avatar_url) }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colorScheme === 'dark' ? theme.surface || '#374151' : '#E5E7EB' }]}>
                  <Ionicons name="person" size={48} color={theme.mutedText} />
                </View>
              )}
              {isUploadingAvatar && (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color="white" size="small" />
                </View>
              )}
            </View>
          </Pressable>

          {/* User Info - Next to Avatar ON BANNER */}
          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.userName, { color: userNameTextColor }]}>{displayUsername}</Text>
              {roleLabel && (
                <View style={[styles.roleBadge, 
                  roleRaw === 'coach' && styles.coachBadge,
                  roleRaw === 'player' && styles.playerBadge,
                  roleRaw === 'fan' && styles.fanBadge
                ]}>
                  <Text style={styles.roleText}>{roleRaw === 'coach' ? 'COACH' : roleRaw.toUpperCase()}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Content Below Banner */}
      <View style={styles.profileDetailsContainer}>
        {/* Edit Profile Button Row */}
        <View style={styles.usernameRow}>
          <Pressable style={[styles.editButtonBelowBanner, { backgroundColor: theme.surface || theme.background, borderColor: theme.border }]} onPress={() => void router.push('/edit-profile')}>
            <Text style={[styles.editButtonBelowBannerText, { color: theme.text }]}>Edit profile</Text>
          </Pressable>
        </View>

        {/* User Details - Left aligned with avatar */}
        <View style={styles.userDetails}>
          {me?.bio && (
            <Text style={[styles.userBio, { color: theme.text }]}>{me.bio}</Text>
          )}
          
          {/* Joined Date */}
          {me?.created_at && (
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color={colorScheme === 'dark' ? theme.mutedText : '#4B5563'} />
              <Text style={[styles.metaText, { color: colorScheme === 'dark' ? theme.mutedText : '#4B5563' }]}>
                Joined {new Date(me.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
            </View>
          )}
          
          {/* Following/Followers - Separate with Bold Numbers, tight spacing */}
          <View style={styles.statsRow}>
            <Text style={[styles.statNumber, { color: theme.text }]}>
              {me?._count?.following ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: colorScheme === 'dark' ? theme.mutedText : '#4B5563' }]}> Following </Text>
            <Text style={[styles.statNumber, { color: theme.text }]}>
              {me?._count?.followers ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: colorScheme === 'dark' ? theme.mutedText : '#4B5563' }]}> Followers</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: theme.border }]}>
        <Pressable
          onPress={() => { setActiveTab('posts'); try { globalThis?.localStorage?.setItem('profile.activeTab','posts'); } catch (error) { if (__DEV__) console.warn('[profile] localStorage error:', error); } }}
          style={[styles.tab, activeTab === 'posts' && { borderBottomWidth: 2, borderBottomColor: theme.tint }]}
        >
          <Text style={[styles.tabText, { color: activeTab === 'posts' ? theme.tint : theme.mutedText }]}>Posts</Text>
        </Pressable>
        <Pressable
          onPress={() => { setActiveTab('replies'); try { globalThis?.localStorage?.setItem('profile.activeTab','replies'); } catch (error) { if (__DEV__) console.warn('[profile] localStorage error:', error); } }}
          style={[styles.tab, activeTab === 'replies' && { borderBottomWidth: 2, borderBottomColor: theme.tint }]}
        >
          <Text style={[styles.tabText, { color: activeTab === 'replies' ? theme.tint : theme.mutedText }]}>Replies</Text>
        </Pressable>
        <Pressable
          onPress={() => { setActiveTab('upvotes'); try { globalThis?.localStorage?.setItem('profile.activeTab','upvotes'); } catch (error) { if (__DEV__) console.warn('[profile] localStorage error:', error); } }}
          style={[styles.tab, activeTab === 'upvotes' && { borderBottomWidth: 2, borderBottomColor: theme.tint }]}
        >
          <Text style={[styles.tabText, { color: activeTab === 'upvotes' ? theme.tint : theme.mutedText }]}>Upvotes</Text>
        </Pressable>
      </View>
    </>
  );

  const renderEmptyPosts = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>No posts yet</Text>
      <Text style={[styles.emptySubtitle, { 
        color: colorScheme === 'dark' ? theme.mutedText : '#4B5563' // Darker grey for better contrast in light mode
      }]}>Share your first moment with the community!</Text>
      <Pressable 
        onPress={() => void router.push('/create-post')} 
        style={({ pressed }) => [
          styles.createPostButton, 
          { 
            backgroundColor: theme.tint,
            borderColor: theme.tint,
            opacity: pressed ? 0.9 : 1,
          }
        ]}
      >
        <Text style={[styles.createPostButtonText, { color: '#FFFFFF', fontWeight: '700' }]}>Create Your First Post</Text>
      </Pressable>
    </View>
  );

  const renderEmptyReplies = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>No replies yet</Text>
    </View>
  );

  const renderEmptyUpvotes = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>No upvotes yet</Text>
    </View>
  );

  const onEndReachedPosts = useCallback(() => { if (me?.id) void loadMorePosts(String(me.id)); }, [me?.id, loadMorePosts]);
  const onEndReachedReplies = useCallback(() => { if (me?.id) void loadMoreReplies(String(me.id)); }, [me?.id, loadMoreReplies]);
  const onEndReachedUpvotes = useCallback(() => { if (me?.id) void loadMoreUpvotes(String(me.id)); }, [me?.id, loadMoreUpvotes]);

  // Some interaction items may wrap a post (e.g., { type, post, created_at })
  const unwrapPost = useCallback((item: any) => {
    return item?.post || item?.target?.post || item?.target || item;
  }, []);

  const SkeletonList = ({ count = 8 }: { count?: number }) => (
    <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ height: 100, backgroundColor: theme.surface || '#F3F4F6', borderRadius: 12, marginBottom: 12 }} />
      ))}
    </View>
  );

  // Only show loading skeleton on initial load when we have no data
  if (loading && !me && !hasLoadedOnce.current) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <Stack.Screen options={{ title: 'Profile' }} />
        <SkeletonList count={8} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <Stack.Screen options={{ title: 'Profile' }} />
        <View style={[styles.center, { flex: 1, justifyContent: 'center', padding: 24 }]}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.mutedText} style={{ marginBottom: 16 }} />
          <Text style={[styles.error, { color: theme.text, textAlign: 'center', marginBottom: 8 }]}>{error}</Text>
          <View style={{ height: 16 }} />
          {error.includes('sign in') ? (
            <Button onPress={() => void router.push('/sign-in')}>
              <Text style={{ color: '#fff' }}>Sign In</Text>
            </Button>
          ) : (
            <Button onPress={() => void loadProfile()}>
              <Text style={{ color: '#fff' }}>Retry</Text>
            </Button>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (!me) {
    // Show error state instead of blank screen
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <Stack.Screen options={{ title: 'Profile' }} />
        <View style={[styles.center, { flex: 1, justifyContent: 'center', padding: 24 }]}>
          <Ionicons name="person-outline" size={48} color={theme.mutedText} style={{ marginBottom: 16 }} />
          <Text style={[styles.error, { color: theme.text, textAlign: 'center', marginBottom: 8 }]}>
            Unable to load profile
          </Text>
          <View style={{ height: 16 }} />
          <Button onPress={() => void loadProfile()}>
            <Text style={{ color: '#fff' }}>Retry</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen options={{ title: 'Profile' }} />
      {activeTab === 'posts' ? (
        <FlatList
          data={posts}
          key={`${activeTab}-grid-2cols`}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyPosts}
          contentContainerStyle={{ paddingBottom: Math.max(32, insets.bottom + 16), paddingHorizontal: 8 }}
          onEndReachedThreshold={0.5}
          onEndReached={onEndReachedPosts}
          renderItem={({ item, index }) => {
            const thumb = item.media_url;
            const _isVideo = !!thumb && VIDEO_EXT.test(thumb);
            const likes = item.upvotes_count ?? 0;
            const comments = item.comments_count ?? item?._count?.comments ?? 0;
            return (
              <Pressable
                style={styles.gridItem}
                onPress={() => {
                  const mapped = (posts || []).map(toFeedPost);
                  const items = mapped.filter(Boolean) as FeedPost[];
                  const targetId = mapped[index]?.id;
                  const targetIdx = targetId ? items.findIndex((p) => p.id === targetId) : index;
                  // Debug: Profile opening viewer
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
      ) : activeTab === 'replies' ? (
        <FlatList
          data={replies}
          key={`${activeTab}-grid-2cols`}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          keyExtractor={(item, index) => {
            const postItem = unwrapPost(item);
            return postItem?.id ?? item?.id ?? `reply-${index}`;
          }}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyReplies}
          contentContainerStyle={{ paddingBottom: Math.max(32, insets.bottom + 16), paddingHorizontal: 8 }}
          onEndReachedThreshold={0.5}
          onEndReached={onEndReachedReplies}
          renderItem={({ item, index }) => {
            const postItem = unwrapPost(item);
            const thumb = postItem?.media_url;
            const _isVideo = !!thumb && VIDEO_EXT.test(thumb);
            const likes = postItem?.upvotes_count ?? 0;
            const comments = postItem?.comments_count ?? postItem?._count?.comments ?? 0;
            return (
              <Pressable
                style={styles.gridItem}
                onPress={() => {
                  const mapped = (replies || []).map(unwrapPost).map(toFeedPost);
                  const items = mapped.filter(Boolean) as FeedPost[];
                  const targetId = unwrapPost(replies[index])?.id;
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
          ListFooterComponent={repliesLoading ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
        />
      ) : (
        <FlatList
          data={upvotes}
          key={`${activeTab}-grid-2cols`}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          keyExtractor={(item, index) => {
            const postItem = unwrapPost(item);
            return postItem?.id ?? item?.id ?? `upvote-${index}`;
          }}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyUpvotes}
          contentContainerStyle={{ paddingBottom: Math.max(32, insets.bottom + 16), paddingHorizontal: 8 }}
          onEndReachedThreshold={0.5}
          onEndReached={onEndReachedUpvotes}
          renderItem={({ item, index }) => {
            const postItem = unwrapPost(item);
            const thumb = postItem?.media_url;
            const _isVideo = !!thumb && VIDEO_EXT.test(thumb);
            const likes = postItem?.upvotes_count ?? 0;
            const comments = postItem?.comments_count ?? postItem?._count?.comments ?? 0;
            return (
              <Pressable
                style={styles.gridItem}
                onPress={() => {
                  const mapped = (upvotes || []).map(unwrapPost).map(toFeedPost);
                  const items = mapped.filter(Boolean) as FeedPost[];
                  const targetId = unwrapPost(upvotes[index])?.id;
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
          ListFooterComponent={upvotesLoading ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
        />
      )}

      <Modal visible={viewerOpen} animationType="slide" onRequestClose={() => setViewerOpen(false)}>
        <GameVerticalFeedScreen
          onClose={() => setViewerOpen(false)}
          showHeader
          initialPosts={viewerItems}
          startIndex={viewerIndex}
          title={activeTab === 'posts' ? 'Your posts' : activeTab === 'replies' ? 'Your replies' : 'Your upvotes'}
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
  
  // Header Styles - Exact Match to Reference
  headerContainer: {
    position: 'relative',
    width: '100%',
    overflow: 'visible', // Allow avatar to extend beyond banner
    backgroundColor: 'transparent', // Will use theme.background from component
  },
  headerBackgroundPressable: {
    position: 'relative',
    height: 200, // Match reference image
    width: '100%',
  },
  headerBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    height: 200,
    width: '100%',
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
    height: 200,
  },
  headerControls: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  profileContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    zIndex: 100, // Ensure profile content is above banner but below avatar
    elevation: 100, // For Android
  },
  avatarSection: {
    marginBottom: -40, // Overlap into content area to close gap
    zIndex: 99999, // Highest z-index to ensure avatar is always on top
    elevation: 99999, // Highest elevation for Android
    position: 'relative',
    marginRight: 0, // Ensure no right margin pushes text
    flexShrink: 0, // Prevent avatar from shrinking
  },
  avatarContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 99999, // Highest elevation for Android
    backgroundColor: '#ffffff',
    zIndex: 99999, // Highest z-index to ensure avatar is always on top
    overflow: 'visible', // Ensure full circle is visible
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
    backgroundColor: 'transparent', // Will be overridden with theme color if needed
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 0, // Removed margin to close gap
    flexShrink: 1, // Allow wrapping if needed
  },
  userInfo: {
    flex: 1,
    paddingBottom: 0, // Removed padding to close gap
    minWidth: 0, // Allow flex to work properly
    marginLeft: 8, // Ensure spacing from avatar
    paddingRight: 8, // Prevent text from touching screen edge
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff', // Default, will be overridden dynamically
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    flexShrink: 1, // Allow text to shrink if needed
    maxWidth: '100%', // Prevent overflow
  },
  editButtonBelowBanner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'transparent', // Will be overridden with theme color
    borderWidth: 1,
    borderColor: 'transparent', // Will be overridden with theme color
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonBelowBannerText: {
    color: 'transparent', // Will be overridden with theme color
    fontSize: 14,
    fontWeight: '600',
  },
  // Profile Details Below Banner - Tight spacing to match reference
  profileDetailsContainer: {
    backgroundColor: 'transparent',
    paddingTop: 8, // Reduced space for overlapping avatar - close the gap
    marginBottom: 0, // No gap before tabs
    paddingBottom: 0, // No padding at bottom
  },
  editButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  userDetails: {
    paddingHorizontal: 16,
    paddingTop: 4, // Reduced top padding to close gap
    paddingBottom: 4,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 0, // Removed padding to close gap
    gap: 12,
  },
  userHandle: {
    fontSize: 15,
    fontWeight: '500', // Slightly bolder for better readability
    flex: 1,
  },
  userBio: {
    fontSize: 15,
    fontWeight: '400',
    marginBottom: 2, // Reduced margin to close gap
    lineHeight: 20,
    // Color will be set inline with theme.text
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 0, // Removed margin to close gap
    marginTop: 2, // Small top margin instead
  },
  metaText: {
    fontSize: 14,
    fontWeight: '500', // Slightly bolder for better readability
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
    gap: 0, // No gap between number and label
  },
  statNumber: {
    fontSize: 15,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 15,
    fontWeight: '500', // Slightly bolder for better readability
  },
  athleteCredentialsCompact: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  positionBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 2,
  },
  credentialsTextCompact: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
  },
  bioSectionCompact: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  userBioCompact: {
    fontSize: 14,
    fontWeight: '400',
    color: '#374151',
    lineHeight: 20,
  },
  badgesRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    marginTop: 4,
    flexWrap: 'wrap',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    gap: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
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
  
  // Athletic Stats Card
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 0,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
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
  tabsContainer: { 
    flexDirection: 'row', 
    borderBottomWidth: 1, 
    backgroundColor: 'transparent',
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' }, // Reduced padding
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
  emptyTitle: { fontSize: 20, fontWeight: '800', color: 'transparent' }, // Will be overridden with theme.text
  emptySubtitle: { 
    color: 'transparent', // Will be overridden with better contrast color
    textAlign: 'center', 
    marginBottom: 20, 
    fontSize: 15, 
    lineHeight: 22,
    fontWeight: '500', // Slightly bolder for better readability
  },
  createPostButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'transparent', // Will be overridden with theme.tint
    borderWidth: 1,
    borderColor: 'transparent', // Will be overridden with theme.tint
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createPostButtonText: {
    fontSize: 16,
    fontWeight: '700', // Bolder for better readability
    color: '#FFFFFF', // White text for good contrast on tint background - always white
  },
  activityItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  gridRow: { 
    gap: 12, // Spacing between cards like event page
    paddingHorizontal: 0,
    marginBottom: 12, // Vertical spacing between rows
  },
  gridItem: { 
    flex: 1, 
    aspectRatio: 1, 
    margin: 0,
    borderRadius: 14, // Rounded corners like event page
    overflow: 'hidden', 
    backgroundColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
