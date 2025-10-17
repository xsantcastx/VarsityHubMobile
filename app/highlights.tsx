import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore legacy export shape
import { Highlights, User } from '@/api/entities';
import RankingBadge from '../components/RankingBadge';
import { calculateRanking, HighlightItem } from '../utils/rankingUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32; // Single column with margins
const CARD_HEIGHT = 220; // Larger cards for sports app feel

type TabType = 'trending' | 'recent' | 'top';

const mapHighlightItem = (input: any): HighlightItem | null => {
  if (!input) return null;
  const idValue = input.id ?? input.post_id ?? input.highlight_id;
  if (!idValue) return null;
  const authorId = input.author_id ?? input.author?.id ?? '';
  if (!authorId) return null; // Required for ranking calculations
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
    _score: typeof input._score === 'number' ? input._score : undefined,
  };
};

const timeAgo = (value?: string | Date | null) => {
  if (!value) return '';
  const ts = typeof value === 'string' ? new Date(value).getTime() : new Date(value).getTime();
  const diff = Math.max(0, Date.now() - ts) / 1000;
  const days = Math.floor(diff / 86400);
  if (days >= 30) return '1 month ago';
  if (days >= 7) return `${Math.floor(days / 7)}w ago`;
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(diff / 3600);
  if (hours >= 1) return `${hours}h ago`;
  const minutes = Math.floor(diff / 60);
  if (minutes >= 1) return `${minutes}m ago`;
  return 'now';
};

const formatCount = (value?: number | null) => {
  if (!value) return '0';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(value);
};

const getCountryFlag = (countryCode?: string | null) => {
  const flags: { [key: string]: string } = {
    'US': '🇺🇸', 'CA': '🇨🇦', 'GB': '🇬🇧', 'AU': '🇦🇺', 'DE': '🇩🇪',
    'FR': '🇫🇷', 'IT': '🇮🇹', 'ES': '🇪🇸', 'BR': '🇧🇷', 'MX': '🇲🇽',
  };
  return flags[countryCode || ''] || '🌍';
};

const getSportCategory = (title?: string | null, content?: string | null) => {
  const text = (title + ' ' + content || '').toLowerCase();
  if (text.includes('football') || text.includes('nfl')) return { name: 'Football', icon: '🏈', color: '#8B5A2B' };
  if (text.includes('basketball') || text.includes('nba')) return { name: 'Basketball', icon: '🏀', color: '#FF6B35' };
  if (text.includes('baseball') || text.includes('mlb')) return { name: 'Baseball', icon: '⚾', color: '#2E8B57' };
  if (text.includes('soccer') || text.includes('fifa')) return { name: 'Soccer', icon: '⚽', color: '#4169E1' };
  if (text.includes('hockey') || text.includes('nhl')) return { name: 'Hockey', icon: '🏒', color: '#1C1C1C' };
  if (text.includes('tennis')) return { name: 'Tennis', icon: '🎾', color: '#228B22' };
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
  onTeamPress,
  onEventPress,
  colorScheme 
}: { 
  item: HighlightItem; 
  index?: number;
  currentTab?: string;
  nationalTop?: HighlightItem[];
  ranked?: HighlightItem[];
  userLocation?: { lat: number; lng: number };
  onPress: (item: HighlightItem) => void;
  onAuthorPress?: (authorId: string) => void;
  onTeamPress?: (teamId: string) => void;
  onEventPress?: (eventId: string) => void;
  colorScheme: 'light' | 'dark' 
}) => {
  const isVideo = item.media_url ? /\.(mp4|mov|webm|m4v|avi)$/i.test(item.media_url) : false;
  const category = getSportCategory(item.title, item.content);
  const hasMedia = !!item.media_url;
  
  // Calculate ranking for this item
  const ranking = calculateRanking(item, index, currentTab, nationalTop, ranked, userLocation);
  
  return (
    <Pressable style={[styles.card, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]} onPress={() => onPress(item)}>
      <View style={styles.cardContainer}>
        {/* Media Section */}
        <View style={styles.mediaSection}>
          {hasMedia ? (
            <View style={styles.mediaContainer}>
              <ExpoImage source={{ uri: item.media_url }} style={styles.mediaImage} contentFit="cover" />
              {isVideo && (
                <View style={styles.videoOverlay}>
                  <View style={styles.playButton}>
                    <Ionicons name="play" size={24} color="#fff" />
                  </View>
                </View>
              )}
              {/* Ranking Badge */}
              {ranking.show && (
                <RankingBadge 
                  type={ranking.type} 
                  position={ranking.position}
                />
              )}
              {/* Live badge for recent posts */}
              {item.created_at && new Date(item.created_at).getTime() > Date.now() - 3600000 && (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveText}>LIVE</Text>
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
              {/* Ranking Badge for text posts */}
              {ranking.show && (
                <RankingBadge 
                  type={ranking.type} 
                  position={ranking.position}
                />
              )}
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
            {item.title || item.caption || item.content || 'Sports Update'}
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
            <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
          </Pressable>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <Pressable 
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                // Handle upvote action
                Alert.alert('Upvote', 'Feature coming soon!');
              }}
            >
              <Ionicons name="arrow-up" size={18} color="#2563EB" />
              <Text style={[styles.statText, { color: '#2563EB', fontWeight: '700' }]}>{formatCount(item.upvotes_count || 0)}</Text>
            </Pressable>
            
            <Pressable 
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                onPress(item); // Navigate to post detail to see comments
              }}
            >
              <Ionicons name="chatbubble" size={16} color="#6B7280" />
              <Text style={[styles.statText, { fontWeight: '600' }]}>{formatCount(item._count?.comments || 0)}</Text>
            </Pressable>
            
            <Pressable 
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                // Handle share action
                Alert.alert('Share', 'Share this highlight!');
              }}
            >
              <Ionicons name="share-outline" size={16} color="#10B981" />
              <Text style={[styles.statText, { fontWeight: '600' }]}>Share</Text>
            </Pressable>
            
            {item._score && (
              <View style={[styles.actionButton, { opacity: 0.7 }]}>
                <Ionicons name="trending-up" size={16} color="#10B981" />
                <Text style={styles.statText}>{Math.round(item._score)}</Text>
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me: any = await User.me().catch(() => null);
      const country = (me?.preferences?.country_code || 'US').toUpperCase();
      const lat = me?.lat;
      const lng = me?.lng;
      
      // Store user location for ranking calculations
      if (lat && lng) {
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
      console.error('Highlights load failed', e);
      console.error('Error details:', e?.response?.data || e?.message || e);
      setError('Unable to load highlights.');
      setHighlights([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  const handleHighlightPress = useCallback((item: HighlightItem) => {
    // Navigate to post detail screen
    router.push(`/post-detail?id=${item.id}`);
  }, [router]);

  const handleAuthorPress = useCallback((authorId: string) => {
    // Navigate to user profile
    router.push(`/user-profile?id=${authorId}`);
  }, [router]);

  const handleTeamPress = useCallback((teamId: string) => {
    // Navigate to team page
    router.push(`/team-profile?id=${teamId}`);
  }, [router]);

  const handleEventPress = useCallback((eventId: string) => {
    // Navigate to event page
    router.push(`/event-detail?id=${eventId}`);
  }, [router]);

  const getFilteredHighlights = useCallback(() => {
    let filtered = [...highlights];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        const title = (item.title || '').toLowerCase();
        const caption = (item.caption || '').toLowerCase();
        const content = (item.content || '').toLowerCase();
        const authorName = (item.author?.display_name || '').toLowerCase();
        return title.includes(query) || caption.includes(query) || content.includes(query) || authorName.includes(query);
      });
    }
    
    switch (activeTab) {
      case 'trending':
        // TRENDING: Top 3 posts with highest engagement, then rest sorted by algorithm
        filtered.sort((a, b) => {
          // Calculate engagement score (upvotes + comments * 2)
          const aEngagement = (a.upvotes_count || 0) + ((a._count?.comments || 0) * 2);
          const bEngagement = (b.upvotes_count || 0) + ((b._count?.comments || 0) * 2);
          
          // If scores exist, use them; otherwise use engagement
          const aScore = a._score || aEngagement;
          const bScore = b._score || bEngagement;
          
          return bScore - aScore;
        });
        
        // Top 3 are pinned, rest follow algorithm
        const top3 = filtered.slice(0, 3);
        const rest = filtered.slice(3);
        
        // Sort rest by recency boost + engagement
        rest.sort((a, b) => {
          const aRecency = new Date(a.created_at || 0).getTime() > Date.now() - 86400000 ? 5 : 0;
          const bRecency = new Date(b.created_at || 0).getTime() > Date.now() - 86400000 ? 5 : 0;
          const aTotal = (a._score || 0) + aRecency;
          const bTotal = (b._score || 0) + bRecency;
          return bTotal - aTotal;
        });
        
        return [...top3, ...rest];
        
      case 'recent':
        // RECENT: Most recent posts nationwide, pure chronological
        filtered.sort((a, b) => {
          const aTime = new Date(a.created_at || 0).getTime();
          const bTime = new Date(b.created_at || 0).getTime();
          return bTime - aTime; // Newest first
        });
        break;
        
      case 'top':
        // TOP: Top 10 posts with most interaction (upvotes + comments)
        filtered.sort((a, b) => {
          const aInteraction = (a.upvotes_count || 0) + ((a._count?.comments || 0) * 1.5);
          const bInteraction = (b.upvotes_count || 0) + ((b._count?.comments || 0) * 1.5);
          return bInteraction - aInteraction;
        });
        return filtered.slice(0, 10); // Top 10 only
    }
    
    return filtered;
  }, [highlights, activeTab, searchQuery]);

  const renderHighlight = ({ item, index }: { item: HighlightItem; index: number }) => (
    <HighlightCard 
      item={item} 
      index={index}
      currentTab={activeTab}
      nationalTop={nationalTop}
      ranked={ranked}
      userLocation={userLocation}
      onPress={handleHighlightPress}
      onAuthorPress={handleAuthorPress}
      onTeamPress={handleTeamPress}
      onEventPress={handleEventPress}
      colorScheme={colorScheme} 
    />
  );

  const statusBarHeight = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

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
    <SafeAreaView style={[styles.screen, { backgroundColor: Colors[colorScheme].background }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? "light-content" : "dark-content"} backgroundColor={Colors[colorScheme].background} />
      <Stack.Screen options={{ title: 'Highlights', headerShown: false }} />
      
      {/* Custom Header */}
      <View style={[styles.header, { paddingTop: statusBarHeight, backgroundColor: Colors[colorScheme].card, borderBottomColor: Colors[colorScheme].border }]}>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]}>Highlights</Text>
        </View>
        
        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border }]}>
          <Ionicons name="search" size={20} color={Colors[colorScheme].tabIconDefault} />
          <TextInput
            style={[styles.searchInput, { color: Colors[colorScheme].text }]}
            placeholder="Search teams, events, users..."
            placeholderTextColor={Colors[colorScheme].tabIconDefault}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={Colors[colorScheme].tabIconDefault} />
            </Pressable>
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

      {filteredHighlights.length === 0 ? (
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
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor="#2563EB"
              colors={['#2563EB']}
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
  },
  mediaContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
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
    color: '#9CA3AF',
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
    color: '#6B7280',
  },
});