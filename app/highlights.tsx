import { Colors } from '@/constants/Colors';
import { usePostCache } from '@/context/PostCacheContext';
import { sanitizeTitle } from '@/lib/sanitizeTitle';
import { useColorScheme } from '@/hooks/useColorScheme';
import AppLinks from '@/utils/links';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore legacy export shape
import { Event, Highlights, Organization, Post, Team, User } from '@/api/entities';
// Clipboard is dynamically imported only when needed to avoid crashes
// if the dev client wasn't built with the native module.
import { formatCount, getCountryFlag, timeAgo } from '@/utils/format';
import { calculateRanking, HighlightItem } from '../utils/rankingUtils';

type TabType = 'trending' | 'recent' | 'top';
const CARD_HEIGHT = 220;
const SCREEN_WIDTH = Dimensions.get('window').width;

const mapHighlightItem = (input: any): HighlightItem | null => {
  if (!input) return null;
  const idValue = input.id ?? input.post_id ?? input.highlight_id;
  if (!idValue) return null;
  const authorId = String(input.author_id ?? input.author?.id ?? '');
  return {
    id: String(idValue),
    title: input.title ?? input.caption ?? undefined,
    caption: input.caption ?? undefined,
    content: input.content ?? undefined,
    media_url: typeof input.media_url === 'string' ? input.media_url : undefined,
    upvotes_count: typeof input.upvotes_count === 'number' ? input.upvotes_count : undefined,
    created_at: typeof input.created_at === 'string' ? input.created_at : new Date().toISOString(),
    author_id: String(authorId),
    author: input.author ? {
      id: String(input.author.id || authorId),
      display_name: String(input.author.display_name || 'Anonymous'),
      avatar_url: input.author.avatar_url || undefined,
    } : undefined,
    _count: input._count ? {
      comments: typeof input._count.comments === 'number' ? input._count.comments : 0
    } : undefined,
    lat: typeof input.lat === 'number' ? input.lat : undefined,
    lng: typeof input.lng === 'number' ? input.lng : undefined,
    country_code: typeof input.country_code === 'string' ? input.country_code : undefined,
    sport: typeof input.sport === 'string' ? input.sport : undefined,
    _score: typeof input._score === 'number' ? input._score : undefined,
  };
};


const getSportCategory = (sport?: string, title?: string | null, content?: string | null) => {
  // First, check if sport is explicitly provided from backend
  if (sport) {
    const sportLower = sport.toLowerCase();
    if (sportLower.includes('football')) return { name: 'Football', icon: '🏈', color: '#8B5A2B' };
    if (sportLower.includes('basketball')) return { name: 'Basketball', icon: '🏀', color: '#FF6B35' };
    if (sportLower.includes('baseball')) return { name: 'Baseball', icon: '⚾', color: '#2E8B57' };
    if (sportLower.includes('soccer')) return { name: 'Soccer', icon: '⚽', color: '#4169E1' };
    if (sportLower.includes('hockey')) return { name: 'Hockey', icon: '🏒', color: '#1C1C1C' };
    if (sportLower.includes('tennis')) return { name: 'Tennis', icon: '🎾', color: '#228B22' };
    if (sportLower.includes('volleyball')) return { name: 'Volleyball', icon: '🏐', color: '#FF1744' };
    if (sportLower.includes('wrestling')) return { name: 'Wrestling', icon: '🤼', color: '#7B1FA2' };
    if (sportLower.includes('track')) return { name: 'Track & Field', icon: '🏃', color: '#FF9800' };
    if (sportLower.includes('swimming')) return { name: 'Swimming', icon: '🏊', color: '#0288D1' };
    if (sportLower.includes('golf')) return { name: 'Golf', icon: '⛳', color: '#558B2F' };
    if (sportLower.includes('lacrosse')) return { name: 'Lacrosse', icon: '🥍', color: '#D32F2F' };
    // Return the sport name as-is if it doesn't match known patterns
    return { name: sport, icon: '🏆', color: '#FF6B35' };
  }

  // Fallback: Parse from title/content
  const text = ((title || '') + ' ' + (content || '')).toLowerCase();
  if (text.includes('football') || text.includes('nfl')) return { name: 'Football', icon: '🏈', color: '#8B5A2B' };
  if (text.includes('basketball') || text.includes('nba')) return { name: 'Basketball', icon: '🏀', color: '#FF6B35' };
  if (text.includes('baseball') || text.includes('mlb')) return { name: 'Baseball', icon: '⚾', color: '#2E8B57' };
  if (text.includes('soccer') || text.includes('fifa')) return { name: 'Soccer', icon: '⚽', color: '#4169E1' };
  if (text.includes('hockey') || text.includes('nhl')) return { name: 'Hockey', icon: '🏒', color: '#1C1C1C' };
  if (text.includes('tennis')) return { name: 'Tennis', icon: '🎾', color: '#228B22' };
  if (text.includes('volleyball')) return { name: 'Volleyball', icon: '🏐', color: '#FF1744' };
  if (text.includes('wrestling')) return { name: 'Wrestling', icon: '🤼', color: '#7B1FA2' };
  if (text.includes('track')) return { name: 'Track & Field', icon: '🏃', color: '#FF9800' };
  if (text.includes('swimming')) return { name: 'Swimming', icon: '🏊', color: '#0288D1' };
  if (text.includes('golf')) return { name: 'Golf', icon: '⛳', color: '#558B2F' };
  if (text.includes('lacrosse')) return { name: 'Lacrosse', icon: '🥍', color: '#D32F2F' };

  return { name: 'Sports', icon: '🏆', color: '#FF6B35' };
};

const HighlightCard = ({ 
  item, 
  index = 0,
  currentTab = 'trending',
  nationalTop = [],
  ranked = [],
  userLocation,
  onPress,
  onAuthorPress,
  colorScheme,
  onUpvote
}: { 
  item: HighlightItem; 
  index?: number;
  currentTab?: string;
  nationalTop?: HighlightItem[];
  ranked?: HighlightItem[];
  userLocation?: { lat: number; lng: number };
  onPress: (item: HighlightItem) => void;
  onAuthorPress?: (authorId: string) => void;
  colorScheme: 'light' | 'dark';
  onUpvote?: (item: HighlightItem) => void;
}) => {
  const isVideo = item.media_url ? /\.(mp4|mov|webm|m4v|avi)$/i.test(item.media_url) : false;
  const category = getSportCategory(item.sport, item.title, item.content);
  const hasMedia = !!item.media_url;
  
  // Calculate ranking for this item
  const _ranking = calculateRanking(item, index, currentTab, nationalTop, ranked, userLocation);
  
  // Show numbered ranking for Trending (top 3) and Top (1-10)
  const showNumberedRank = (currentTab === 'trending' && index < 3) || (currentTab === 'top' && index < 10);
  const rankNumber = index + 1;
  
  return (
    <Pressable style={[styles.card, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]} onPress={() => onPress(item)}>
      <View style={styles.cardContainer}>
        {/* Media Section */}
        <View style={styles.mediaSection}>
          {/* Numbered Ranking Badge for Top 3 (Trending) or Top 10 - positioned relative to media */}
          {showNumberedRank && (
            <View style={[
              styles.numberBadge, 
              { 
                backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#2563EB'
              }
            ]}>
              <Text style={styles.numberBadgeText}>#{rankNumber}</Text>
            </View>
          )}
          {hasMedia ? (
            <View style={styles.mediaContainer}>
              <ExpoImage source={{ uri: item.media_url }} style={styles.mediaImage} contentFit="contain" />
              {isVideo && (
                <View style={styles.videoOverlay}>
                  <View style={styles.playButton}>
                    <Ionicons name="play" size={24} color="#fff" />
                  </View>
                </View>
              )}
              {/* "NEW" badge for very recent posts (< 10 minutes) — rank badge takes priority */}
              {!showNumberedRank && item.created_at && new Date(item.created_at).getTime() > Date.now() - 600000 && (
                <View style={[styles.liveBadge, { backgroundColor: '#3b82f6' }]}>
                  <Text style={styles.liveText}>NEW</Text>
                </View>
              )}
            </View>
          ) : (
            <LinearGradient 
              colors={[category.color + '80', category.color + '40']} 
              style={styles.mediaContainer}
            >
              <View style={styles.noMediaContent}>
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <Text style={styles.noMediaText}>Text Post</Text>
              </View>
            </LinearGradient>
          )}
        </View>

        {/* Content Section */}
        <View style={styles.contentSection}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={[styles.categoryBadge, { backgroundColor: category.color }]}>
              <Text style={styles.categoryText}>{category.name}</Text>
            </View>
            <Text style={styles.countryFlag}>{getCountryFlag(item.country_code)}</Text>
          </View>

          {/* Title */}
          <Text style={[styles.cardTitle, { color: Colors[colorScheme].text }]} numberOfLines={2}>
            {sanitizeTitle(item.title) || item.caption || ''}
          </Text>

          {/* Author & Time */}
          <Pressable 
            style={styles.authorRow}
            onPress={(e) => {
              e.stopPropagation();
              if (item.author_id && onAuthorPress) {
                onAuthorPress(item.author_id);
              }
            }}
          >
            <View style={styles.authorInfo}>
              {item.author?.avatar_url ? (
                <ExpoImage source={{ uri: item.author.avatar_url }} style={styles.authorAvatar} />
              ) : (
                <View style={[styles.authorAvatar, styles.defaultAvatar]}>
                  <Ionicons name="person" size={12} color="#fff" />
                </View>
              )}
              <Text style={[styles.authorName, { color: Colors[colorScheme].text }]} numberOfLines={1}>
                {item.author?.display_name || 'Anonymous'}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={Colors[colorScheme].tabIconDefault} />
            </View>
            <Text style={[styles.timeText, { color: Colors[colorScheme].mutedText }]}>{timeAgo(item.created_at)}</Text>
          </Pressable>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <Pressable
              style={[styles.actionButton, item.has_upvoted && { backgroundColor: 'rgba(37, 99, 235, 0.2)' }]}
              onPress={(e) => {
                e.stopPropagation();
                onUpvote?.(item);
              }}
            >
              <Ionicons name={item.has_upvoted ? 'arrow-up' : 'arrow-up-outline'} size={18} color="#2563EB" />
              <Text style={[styles.statText, { color: '#2563EB', fontWeight: '700' }]}>{formatCount(item.upvotes_count || 0)}</Text>
            </Pressable>
            
            <Pressable 
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                onPress(item); // Navigate to post detail to see comments
              }}
            >
              <Ionicons name="chatbubble" size={16} color={Colors[colorScheme].mutedText} />
              <Text style={[styles.statText, { color: Colors[colorScheme].mutedText, fontWeight: '600' }]}>{formatCount(item._count?.comments || 0)}</Text>
            </Pressable>
            
            <Pressable 
              style={styles.actionButton}
              onPress={async (e) => {
                e.stopPropagation();
                try {
                  const link = AppLinks.post(String(item.id), item.caption || (sanitizeTitle(item.title) ?? undefined));
                  await Share.share({ message: link.shareMessage, url: link.webUrl, title: sanitizeTitle(item.title) || 'VarsityHub Highlight' });
                } catch {
                  try {
                    const mod = await import('expo-clipboard').catch(() => null);
                    const setStringAsync = mod?.setStringAsync || (mod && (mod as any).default?.setStringAsync);
                    if (typeof setStringAsync === 'function') {
                      const fallback = AppLinks.post(String(item.id), item.caption).webUrl;
                      await setStringAsync(fallback);
                      Alert.alert('Link Copied', 'Share link copied to clipboard!');
                    } else {
                      Alert.alert('Share Failed', 'Clipboard unavailable in this build.');
                    }
                  } catch (error) {
                    // Silently fail - instrumentation is optional
                    if (__DEV__) console.warn('[highlights] Instrumentation error:', error);
                  }
                }
              }}
            >
              <Ionicons name="share-outline" size={16} color="#10B981" />
              <Text style={[styles.statText, { color: Colors[colorScheme].mutedText, fontWeight: '600' }]}>Share</Text>
            </Pressable>
            
            {item._score && (
              <View style={[styles.actionButton, { opacity: 0.7 }]}>
                <Ionicons name="trending-up" size={16} color="#10B981" />
                <Text style={[styles.statText, { color: Colors[colorScheme].mutedText }]}>{Math.round(item._score)}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
};

const TabButton = ({ title, active, onPress, colorScheme }: { title: string; active: boolean; onPress: () => void; colorScheme: 'light' | 'dark' }) => (
  <Pressable style={[styles.tabButton, active && [styles.activeTab, { backgroundColor: Colors[colorScheme].tint }], !active && { backgroundColor: Colors[colorScheme].surface }]} onPress={onPress}>
    <Text style={[styles.tabText, active && [styles.activeTabText, { color: Colors[colorScheme].background }], !active && { color: Colors[colorScheme].text, opacity: 0.7 }]}>{title}</Text>
  </Pressable>
);

export default function HighlightsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [nationalTop, setNationalTop] = useState<HighlightItem[]>([]);
  const [ranked, setRanked] = useState<HighlightItem[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | undefined>();
  const [activeTab, setActiveTab] = useState<TabType>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    teams: any[];
    events: any[];
    users: any[];
    organizations: any[];
    posts: HighlightItem[];
  }>({ teams: [], events: [], users: [], organizations: [], posts: [] });
  const [searching, setSearching] = useState(false);
  const postCache = usePostCache();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me: any = await User.me().catch((error: any) => {
        if (__DEV__) {
          console.warn('[Highlights] Failed to load user:', error?.message || error);
        }
        return null;
      });
      
      const country = (me?.preferences?.country_code || 'US').toUpperCase();
      
      // Location preference lookup: coordinates live under me.preferences
      // Guard against undefined and ensure both lat/lng are valid numbers
      const lat = typeof me?.preferences?.lat === 'number' ? me.preferences.lat : (typeof me?.lat === 'number' ? me.lat : undefined);
      const lng = typeof me?.preferences?.lng === 'number' ? me.preferences.lng : (typeof me?.lng === 'number' ? me.lng : undefined);
      
      // Store user location for ranking calculations only if both coordinates are valid
      if (typeof lat === 'number' && typeof lng === 'number' && lat !== 0 && lng !== 0) {
        setUserLocation({ lat, lng });
      }
      
      // Request better data with more posts
      const payload = await Highlights.fetch({ 
        country, 
        limit: 50,
        lat,
        lng
      });
      
      // Store raw ranking data for badge calculations
      const rawNationalTop = Array.isArray(payload?.nationalTop) ? payload.nationalTop : [];
      const rawRanked = Array.isArray(payload?.ranked) ? payload.ranked : [];
      
      // Cache all the raw posts for faster loading when navigating to post detail
      postCache.setBatch([...rawNationalTop, ...rawRanked]);
      
      setNationalTop(rawNationalTop.map(mapHighlightItem).filter(Boolean) as HighlightItem[]);
      setRanked(rawRanked.map(mapHighlightItem).filter(Boolean) as HighlightItem[]);
      
      // Merge all highlights from different buckets
      const allHighlights = [
        ...rawNationalTop,
        ...rawRanked
      ];
      
      const mapped = allHighlights
        .map(mapHighlightItem)
        .filter(Boolean) as HighlightItem[];
      
      // Remove duplicates by ID
      const uniqueHighlights = Array.from(
        new Map(mapped.map(item => [item.id, item])).values()
      );
      
      setHighlights(uniqueHighlights);
    } catch (e: any) {
      if (__DEV__) {
        console.error('[Highlights] Load failed:', e);
        console.error('[Highlights] Error details:', e?.response?.data || e?.message || e);
      }
      setError('Unable to load highlights.');
      setHighlights([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [postCache]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      await load();
      if (!mounted) return;
    };
    void loadData();
    return () => { mounted = false; };
  }, [load]);

  // Global search function for teams, events, users, and posts
  const performGlobalSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults({ teams: [], events: [], users: [], organizations: [], posts: [] });
      setSearching(false);
      return;
    }

    setSearching(true);
    try {
      const [teamsRes, eventsRes, usersRes, orgsRes] = await Promise.all([
        Team.list(query, false, { limit: 5 }).catch((error: any) => {
          if (__DEV__) console.warn('[Highlights] Team search failed:', error?.message || error);
          return [];
        }),
        Event.filter({ q: query, approval_status: 'approved' }, 'date', 5).catch((error: any) => {
          if (__DEV__) console.warn('[Highlights] Event search failed:', error?.message || error);
          return [];
        }),
        User.listAll(query, 5).catch((error: any) => {
          if (__DEV__) console.warn('[Highlights] User search failed:', error?.message || error);
          return [];
        }),
        Organization.list(query, 5).catch((error: any) => {
          if (__DEV__) console.warn('[Highlights] Organization search failed:', error?.message || error);
          return [];
        }),
      ]);

      const teams = Array.isArray(teamsRes) ? teamsRes.slice(0, 5) : [];
      const events = Array.isArray(eventsRes) ? eventsRes.slice(0, 5) : [];
      const users = Array.isArray(usersRes) ? usersRes.slice(0, 5) : [];
      const organizations = Array.isArray(orgsRes) ? orgsRes.slice(0, 5) : [];

      // Filter posts
      const posts = highlights.filter(item => {
        const title = (item.title || '').toLowerCase();
        const caption = (item.caption || '').toLowerCase();
        const content = (item.content || '').toLowerCase();
        const authorName = (item.author?.display_name || '').toLowerCase();
        const queryLower = query.toLowerCase();
        return title.includes(queryLower) || caption.includes(queryLower) || 
               content.includes(queryLower) || authorName.includes(queryLower);
      }).slice(0, 10);

      setSearchResults({ teams, events, users, organizations, posts });
    } catch (err: any) {
      if (__DEV__) {
        console.error('[Highlights] Search failed:', err?.message || err);
      }
      setSearchResults({ teams: [], events: [], users: [], organizations: [], posts: [] });
    } finally {
      setSearching(false);
    }
  }, [highlights]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      void performGlobalSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, performGlobalSearch]);

  const getFilteredHighlights = useCallback(() => {
    let filtered = [...highlights];
    
    // Don't filter by search query here - that's handled by search results view
    
    switch (activeTab) {
      case 'trending':
        // TRENDING: Top 3 posts first (numbered #1, #2, #3), then algorithm
        filtered.sort((a, b) => {
          // Calculate engagement score (upvotes + comments * 2)
          const aEngagement = (a.upvotes_count || 0) + ((a._count?.comments || 0) * 2);
          const bEngagement = (b.upvotes_count || 0) + ((b._count?.comments || 0) * 2);
          
          // If scores exist, use them; otherwise use engagement
          const aScore = a._score || aEngagement;
          const bScore = b._score || bEngagement;
          
          return bScore - aScore;
        });
        
        // Top 3 are explicitly shown first
        const top3 = filtered.slice(0, 3);
        const rest = filtered.slice(3);
        
        // Sort rest by trending algorithm (recency boost + engagement)
        rest.sort((a, b) => {
          const aRecency = new Date(a.created_at || 0).getTime() > Date.now() - 86400000 ? 5 : 0;
          const bRecency = new Date(b.created_at || 0).getTime() > Date.now() - 86400000 ? 5 : 0;
          const aTotal = (a._score || 0) + aRecency;
          const bTotal = (b._score || 0) + bRecency;
          return bTotal - aTotal;
        });
        
        return [...top3, ...rest];
        
      case 'recent':
        // RECENT: Most recent posts globally, pure chronological
        filtered.sort((a, b) => {
          const aTime = new Date(a.created_at || 0).getTime();
          const bTime = new Date(b.created_at || 0).getTime();
          return bTime - aTime; // Newest first
        });
        return filtered; // All posts, ordered by time
        
      case 'top':
        // TOP: Top 10 posts with most engagement, numbered #1-#10
        filtered.sort((a, b) => {
          const aInteraction = (a.upvotes_count || 0) + ((a._count?.comments || 0) * 1.5);
          const bInteraction = (b.upvotes_count || 0) + ((b._count?.comments || 0) * 1.5);
          return bInteraction - aInteraction;
        });
        return filtered.slice(0, 10); // Limit to top 10 only
    }
    
  }, [highlights, activeTab]);

  const handleHighlightPress = useCallback((item: HighlightItem, _index?: number) => {
    // Navigate to post-detail with the tapped post's ID.
    // Previously passed all filtered IDs + index, but re-computing the filtered
    // list at tap-time could yield a different sort order (e.g. after an upvote),
    // causing the index to point to the wrong post.
    router.push(`/post-detail?id=${item.id}&from=highlights`);
  }, [router]);

  const handleAuthorPress = useCallback((authorId: string) => {
    // Navigate to user profile
    router.push(`/user-profile?id=${authorId}`);
  }, [router]);

  const handleEventPress = useCallback((event: any) => {
    const gameId = event?.game_id || event?.gameId;
    if (gameId) {
      void router.push({ pathname: '/(tabs)/feed/game/[id]', params: { id: String(gameId) } });
      return;
    }

    const eventId = event?.id || event?.event_id;
    if (eventId) {
      void router.push({ pathname: '/(tabs)/feed/game', params: { eventId: String(eventId) } } as any);
      return;
    }

    Alert.alert('Event unavailable', 'This event is missing an identifier and cannot be opened.');
  }, [router]);

  const handleUpvote = useCallback(async (item: HighlightItem) => {
    // Optimistic update: toggle immediately for responsiveness
    const optimisticNext = !item.has_upvoted;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setHighlights((prev) =>
      prev.map((h) =>
        h.id === item.id
          ? {
              ...h,
              has_upvoted: optimisticNext,
              upvotes_count: Math.max(0, (h.upvotes_count || 0) + (optimisticNext ? 1 : -1)),
            }
          : h
      )
    );
    try {
      const r: any = await Post.toggleUpvote(item.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Reconcile with server values
      setHighlights((prev) =>
        prev.map((h) =>
          h.id === item.id
            ? {
                ...h,
                has_upvoted: typeof r?.has_upvoted === 'boolean' ? r.has_upvoted : Boolean(r?.upvoted),
                upvotes_count: typeof r?.count === 'number' ? r.count : typeof r?.upvotes_count === 'number' ? r.upvotes_count : h.upvotes_count,
              }
            : h
        )
      );
    } catch (error) {
      // Revert optimistic update on failure
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setHighlights((prev) =>
        prev.map((h) =>
          h.id === item.id
            ? {
                ...h,
                has_upvoted: item.has_upvoted,
                upvotes_count: Math.max(0, (h.upvotes_count || 0) + (optimisticNext ? -1 : 1)),
              }
            : h
        )
      );
      if (__DEV__) console.warn('[Highlights] Failed to toggle upvote:', error);
    }
  }, []);

  const renderHighlight = ({ item, index }: { item: HighlightItem; index: number }) => (
    <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
      <HighlightCard
        item={item}
        index={index}
        currentTab={activeTab}
        nationalTop={nationalTop}
        ranked={ranked}
        userLocation={userLocation}
        onPress={() => handleHighlightPress(item, index)}
        // onAuthorPress intentionally omitted to disable profile navigation from highlights feed
        colorScheme={colorScheme}
        onUpvote={handleUpvote}
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: Colors[colorScheme].background }]}>
        <StatusBar barStyle={colorScheme === 'dark' ? "light-content" : "dark-content"} backgroundColor={Colors[colorScheme].background} />
        <Stack.Screen options={{ title: 'Highlights', headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading sports highlights...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: Colors[colorScheme].background }]}>
        <StatusBar barStyle={colorScheme === 'dark' ? "light-content" : "dark-content"} backgroundColor={Colors[colorScheme].background} />
        <Stack.Screen options={{ title: 'Highlights', headerShown: false }} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const filteredHighlights = getFilteredHighlights();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: Colors[colorScheme].background }]} edges={['bottom', 'left', 'right']}>
      <StatusBar barStyle={colorScheme === 'dark' ? "light-content" : "dark-content"} backgroundColor={Colors[colorScheme].background} />
      <Stack.Screen options={{ title: 'Highlights', headerShown: false }} />
      
      {/* Custom Header */}
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: Colors[colorScheme].card, borderBottomColor: Colors[colorScheme].border }]}>
        {/* Back button and title */}
        <View style={styles.headerRow}>
          <Pressable style={styles.headerSpacer} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={Colors[colorScheme].text} />
          </Pressable>
          <Text style={[styles.headerTitleText, { color: Colors[colorScheme].text }]} numberOfLines={1}>
            Highlights
          </Text>
          <Pressable style={styles.headerSpacer} onPress={onRefresh} hitSlop={8}>
            <Ionicons name="refresh" size={22} color={refreshing ? Colors[colorScheme].tint : Colors[colorScheme].text} style={{ opacity: refreshing ? 0.5 : 1 }} />
          </Pressable>
        </View>
        {/* Search Bar */}
        <View style={{ zIndex: 10 }}>
          <View style={[styles.searchContainer, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border }]}> 
            <Ionicons name="search" size={20} color={Colors[colorScheme].tabIconDefault} />
            <TextInput
              style={[styles.searchInput, { color: Colors[colorScheme].text }]}
              placeholder="Search users, teams, or organizations by name or username..."
              placeholderTextColor={Colors[colorScheme].tabIconDefault}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={Colors[colorScheme].tabIconDefault} />
              </Pressable>
            )}
          </View>
          {/* Dropdown recommendations */}
          {searchQuery.length > 0 && !searching && (
            <View style={{
              position: 'absolute',
              top: 48,
              left: 0,
              right: 0,
              backgroundColor: Colors[colorScheme].background,
              borderColor: Colors[colorScheme].border,
              borderWidth: 1,
              borderTopWidth: 0,
              borderRadius: 8,
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 2,
              zIndex: 20,
              maxHeight: 180,
            }}>
              {/* Users */}
              {searchResults.users.slice(0, 2).map((user) => (
                <Pressable
                  key={user.id}
                  style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border }}
                  onPress={() => setSearchQuery(user.display_name || user.username || user.email)}
                >
                  <Text style={{ color: Colors[colorScheme].text }}>
                    👤 {user.display_name || user.username || user.email}
                  </Text>
                </Pressable>
              ))}
              {/* Teams */}
              {searchResults.teams.slice(0, 2).map((team) => (
                <Pressable
                  key={team.id}
                  style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border }}
                  onPress={() => setSearchQuery(team.name)}
                >
                  <Text style={{ color: Colors[colorScheme].text }}>
                    🏫 {team.name}
                  </Text>
                </Pressable>
              ))}
              {/* Organizations */}
              {searchResults.organizations.slice(0, 2).map((org) => (
                <Pressable
                  key={org.id}
                  style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border }}
                  onPress={() => setSearchQuery(org.name)}
                >
                  <Text style={{ color: Colors[colorScheme].text }}>
                    🏆 {org.name}
                  </Text>
                </Pressable>
              ))}
              {/* No recommendations */}
              {searchResults.users.length === 0 && searchResults.teams.length === 0 && searchResults.organizations.length === 0 && (
                <View style={{ padding: 12 }}>
                  <Text style={{ color: Colors[colorScheme].tabIconDefault }}>No recommendations</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.tabsContainer}
          contentContainerStyle={styles.tabsContent}
        >
          <TabButton 
            title="🔥 Trending" 
            active={activeTab === 'trending'} 
            onPress={() => setActiveTab('trending')} 
            colorScheme={colorScheme}
          />
          <TabButton 
            title="🕐 Recent" 
            active={activeTab === 'recent'} 
            onPress={() => setActiveTab('recent')} 
            colorScheme={colorScheme}
          />
          <TabButton 
            title="👑 Top" 
            active={activeTab === 'top'} 
            onPress={() => setActiveTab('top')} 
            colorScheme={colorScheme}
          />
        </ScrollView>
      </View>

      {/* Show search results when searching */}
      {searchQuery.trim() ? (
        searching ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={[styles.loadingText, { color: Colors[colorScheme].text }]}>Searching...</Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.searchResultsContainer}>
            {/* Teams */}
            {searchResults.teams.length > 0 && (
              <View style={styles.searchSection}>
                <Text style={[styles.searchSectionTitle, { color: Colors[colorScheme].text }]}>🏫 Teams</Text>
                {searchResults.teams.map((team: any) => (
                  <Pressable
                    key={team.id}
                    style={[styles.searchResultItem, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}
                    onPress={() => { void router.push(`/team-profile?id=${team.id}`); }}
                  >
                    <Text style={[styles.searchResultTitle, { color: Colors[colorScheme].text }]}>{team.name}</Text>
                    <Text style={[styles.searchResultSubtitle, { color: Colors[colorScheme].tabIconDefault }]}>
                      {team.school_name || team.city || 'Team'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Events */}
            {searchResults.events.length > 0 && (
              <View style={styles.searchSection}>
                <Text style={[styles.searchSectionTitle, { color: Colors[colorScheme].text }]}>📅 Events</Text>
                {searchResults.events.map((event: any) => (
                  <Pressable
                    key={event.id}
                    style={[styles.searchResultItem, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}
                    onPress={() => handleEventPress(event)}
                  >
                    <Text style={[styles.searchResultTitle, { color: Colors[colorScheme].text }]}>{event.title}</Text>
                    <Text style={[styles.searchResultSubtitle, { color: Colors[colorScheme].tabIconDefault }]}>
                      {event.description || 'Event'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Users */}
            {searchResults.users.length > 0 && (
              <View style={styles.searchSection}>
                <Text style={[styles.searchSectionTitle, { color: Colors[colorScheme].text }]}>👤 Users</Text>
                {searchResults.users.map((user: any) => (
                  <Pressable
                    key={user.id}
                    style={[styles.searchResultItem, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}
                    onPress={() => { void router.push(`/user-profile?id=${user.id}`); }}
                  >
                    <Text style={[styles.searchResultTitle, { color: Colors[colorScheme].text }]}>{user.display_name}</Text>
                    <Text style={[styles.searchResultSubtitle, { color: Colors[colorScheme].tabIconDefault }]}>
                      @{user.username || user.email}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Organizations */}
            {searchResults.organizations.length > 0 && (
              <View style={styles.searchSection}>
                <Text style={[styles.searchSectionTitle, { color: Colors[colorScheme].text }]}>🏆 Organizations</Text>
                {searchResults.organizations.map((org: any) => (
                  <Pressable
                    key={org.id}
                    style={[styles.searchResultItem, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}
                    onPress={() => { void router.push(`/league?id=${org.id}`); }}
                  >
                    <Text style={[styles.searchResultTitle, { color: Colors[colorScheme].text }]}>{org.name}</Text>
                    <Text style={[styles.searchResultSubtitle, { color: Colors[colorScheme].tabIconDefault }]}>
                      {org.sport || 'Organization'} {org.description ? `• ${org.description}` : ''}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Posts */}
            {searchResults.posts.length > 0 && (
              <View style={styles.searchSection}>
                <Text style={[styles.searchSectionTitle, { color: Colors[colorScheme].text }]}>📝 Posts</Text>
                {searchResults.posts.map((post, idx) => (
                  <HighlightCard 
                    key={post.id}
                    item={post} 
                    index={idx}
                    currentTab={activeTab}
                    nationalTop={nationalTop}
                    ranked={ranked}
                    userLocation={userLocation}
                    onPress={handleHighlightPress}
                    onAuthorPress={handleAuthorPress}
                    colorScheme={colorScheme}
                    onUpvote={handleUpvote}
                  />
                ))}
              </View>
            )}

            {/* No results */}
            {searchResults.teams.length === 0 && searchResults.events.length === 0 && 
             searchResults.users.length === 0 && searchResults.organizations.length === 0 && 
             searchResults.posts.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={64} color={Colors[colorScheme].tabIconDefault} />
                <Text style={[styles.emptyText, { color: Colors[colorScheme].text }]}>No results found</Text>
                <Text style={[styles.emptySubtext, { color: Colors[colorScheme].tabIconDefault }]}>
                  Try a different search term
                </Text>
              </View>
            )}
          </ScrollView>
        )
      ) : filteredHighlights.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="trophy-outline" size={64} color={Colors[colorScheme].tabIconDefault} />
          <Text style={[styles.emptyText, { color: Colors[colorScheme].text }]}>No highlights available</Text>
          <Text style={[styles.emptySubtext, { color: Colors[colorScheme].tabIconDefault }]}>Check back later for amazing sports moments</Text>
        </View>
      ) : (
        <FlatList
            data={filteredHighlights}
            renderItem={renderHighlight}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 8 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors[colorScheme].tint}
              />
            }
          />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    borderBottomWidth: 1,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -12,
  },
  headerTitleText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  headerStatsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  calendarContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  calendarHint: {
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },
  tabsContainer: {
    paddingHorizontal: 16,
  },
  tabsContent: {
    gap: 8,
    paddingVertical: 4,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  activeTab: {},
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {},
  pageIndicator: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  pageIndicatorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardContainer: {
    flexDirection: 'row',
    height: CARD_HEIGHT,
  },
  mediaSection: {
    width: '40%',
    position: 'relative',
  },
  mediaContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#000', // Black background for images to show properly with contain mode
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  noMediaContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  categoryIcon: {
    fontSize: 32,
  },
  noMediaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2, // Slight offset for visual centering
  },
  liveBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  contentSection: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  countryFlag: {
    fontSize: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 8,
  },
  authorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  defaultAvatar: {
    backgroundColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  timeText: {
    fontSize: 11,
    // color: Uses dynamic color in JSX
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
    // color: Uses dynamic color in JSX
  },
  numberBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  numberBadgeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  searchResultsContainer: {
    padding: 16,
  },
  searchSection: {
    marginBottom: 24,
  },
  searchSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  searchResultItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  searchResultTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  searchResultSubtitle: {
    fontSize: 14,
  },
});
