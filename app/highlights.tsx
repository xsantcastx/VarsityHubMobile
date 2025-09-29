import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Platform,
    Pressable,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
// @ts-ignore legacy export shape
import { Highlights, User } from '@/api/entities';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32; // Single column with margins
const CARD_HEIGHT = 220; // Larger cards for sports app feel

type HighlightItem = {
  id: string;
  title?: string | null;
  caption?: string | null;
  content?: string | null;
  media_url?: string | null;
  upvotes_count?: number | null;
  created_at?: string | null;
  author?: { 
    id?: string;
    display_name?: string | null; 
    avatar_url?: string | null;
  } | null;
  _count?: { comments?: number | null } | null;
  lat?: number | null;
  lng?: number | null;
  country_code?: string | null;
  _score?: number;
};

type TabType = 'trending' | 'recent' | 'top';

const mapHighlightItem = (input: any): HighlightItem | null => {
  if (!input) return null;
  const idValue = input.id ?? input.post_id ?? input.highlight_id;
  if (!idValue) return null;
  return {
    id: String(idValue),
    title: input.title ?? input.caption ?? null,
    caption: input.caption ?? null,
    content: input.content ?? null,
    media_url: typeof input.media_url === 'string' ? input.media_url : null,
    upvotes_count: typeof input.upvotes_count === 'number' ? input.upvotes_count : null,
    created_at: typeof input.created_at === 'string' ? input.created_at : null,
    author: input.author ?? null,
    _count: input._count ?? null,
    lat: typeof input.lat === 'number' ? input.lat : null,
    lng: typeof input.lng === 'number' ? input.lng : null,
    country_code: typeof input.country_code === 'string' ? input.country_code : null,
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

const HighlightCard = ({ item, onPress }: { item: HighlightItem; onPress: (item: HighlightItem) => void }) => {
  const isVideo = item.media_url ? /\.(mp4|mov|webm|m4v|avi)$/i.test(item.media_url) : false;
  const category = getSportCategory(item.title, item.content);
  const hasMedia = !!item.media_url;
  
  return (
    <Pressable style={styles.card} onPress={() => onPress(item)}>
      <View style={styles.cardContainer}>
        {/* Media Section */}
        <View style={styles.mediaSection}>
          {hasMedia ? (
            <View style={styles.mediaContainer}>
              <Image source={{ uri: item.media_url }} style={styles.mediaImage} contentFit="cover" />
              {isVideo && (
                <View style={styles.videoOverlay}>
                  <View style={styles.playButton}>
                    <Ionicons name="play" size={24} color="#fff" />
                  </View>
                </View>
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
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title || item.caption || item.content || 'Sports Update'}
          </Text>

          {/* Author & Time */}
          <View style={styles.authorRow}>
            <View style={styles.authorInfo}>
              {item.author?.avatar_url ? (
                <Image source={{ uri: item.author.avatar_url }} style={styles.authorAvatar} />
              ) : (
                <View style={[styles.authorAvatar, styles.defaultAvatar]}>
                  <Ionicons name="person" size={12} color="#fff" />
                </View>
              )}
              <Text style={styles.authorName} numberOfLines={1}>
                {item.author?.display_name || 'Anonymous'}
              </Text>
            </View>
            <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="arrow-up" size={16} color="#2563EB" />
              <Text style={styles.statText}>{formatCount(item.upvotes_count || 0)}</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="chatbubble-outline" size={16} color="#6B7280" />
              <Text style={styles.statText}>{formatCount(item._count?.comments || 0)}</Text>
            </View>
            {item._score && (
              <View style={styles.stat}>
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

const TabButton = ({ title, active, onPress }: { title: string; active: boolean; onPress: () => void }) => (
  <Pressable style={[styles.tabButton, active && styles.activeTab]} onPress={onPress}>
    <Text style={[styles.tabText, active && styles.activeTabText]}>{title}</Text>
  </Pressable>
);

export default function HighlightsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('trending');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me: any = await User.me().catch(() => null);
      const country = (me?.preferences?.country_code || 'US').toUpperCase();
      const lat = me?.lat;
      const lng = me?.lng;
      
      // Request better data with more posts
      const payload = await Highlights.fetch({ 
        country, 
        limit: 50,
        lat,
        lng
      });
      
      // Merge all highlights from different buckets
      const allHighlights = [
        ...(Array.isArray(payload?.nationalTop) ? payload.nationalTop : []),
        ...(Array.isArray(payload?.ranked) ? payload.ranked : [])
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

  const getFilteredHighlights = useCallback(() => {
    let filtered = [...highlights];
    
    switch (activeTab) {
      case 'trending':
        // Sort by score (if available) or upvotes + recency
        filtered.sort((a, b) => {
          if (a._score && b._score) return b._score - a._score;
          const aScore = (a.upvotes_count || 0) + (new Date(a.created_at || 0).getTime() > Date.now() - 86400000 ? 10 : 0);
          const bScore = (b.upvotes_count || 0) + (new Date(b.created_at || 0).getTime() > Date.now() - 86400000 ? 10 : 0);
          return bScore - aScore;
        });
        break;
      case 'recent':
        // Sort by creation time
        filtered.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        break;
      case 'top':
        // Sort by upvotes only
        filtered.sort((a, b) => (b.upvotes_count || 0) - (a.upvotes_count || 0));
        break;
    }
    
    return filtered;
  }, [highlights, activeTab]);

  const renderHighlight = ({ item }: { item: HighlightItem }) => (
    <HighlightCard item={item} onPress={handleHighlightPress} />
  );

  const statusBarHeight = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <Stack.Screen options={{ title: 'Sports Central', headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading sports highlights...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <Stack.Screen options={{ title: 'Sports Central', headerShown: false }} />
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
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <Stack.Screen options={{ title: 'Sports Central', headerShown: false }} />
      
      {/* Custom Header */}
      <View style={[styles.header, { paddingTop: statusBarHeight }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Sports Central</Text>
          <View style={styles.headerStats}>
            <Ionicons name="trophy" size={16} color="#FFB800" />
            <Text style={styles.headerStatsText}>{filteredHighlights.length} highlights</Text>
          </View>
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
          />
          <TabButton 
            title="🕐 Recent" 
            active={activeTab === 'recent'} 
            onPress={() => setActiveTab('recent')} 
          />
          <TabButton 
            title="👑 Top" 
            active={activeTab === 'top'} 
            onPress={() => setActiveTab('top')} 
          />
        </ScrollView>
      </View>

      {filteredHighlights.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="trophy-outline" size={64} color="#9CA3AF" />
          <Text style={styles.emptyText}>No highlights available</Text>
          <Text style={styles.emptySubtext}>Check back later for amazing sports moments</Text>
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
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
    color: '#111827',
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
    backgroundColor: '#F3F4F6',
  },
  activeTab: {
    backgroundColor: '#2563EB',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#fff',
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
    color: '#374151',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
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
    color: '#111827',
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
    color: '#374151',
    flex: 1,
  },
  timeText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
});