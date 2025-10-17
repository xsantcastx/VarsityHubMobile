import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { Game, Post, Team, User } from '@/api/entities';
import EventMap, { EventMapData } from '@/components/EventMap';
import PostCard from '@/components/PostCard';
import { Calendar } from 'react-native-calendars';
import GameVerticalFeedScreen, { type FeedPost } from '../../game-details/GameVerticalFeedScreen';


type GameItem = { id: string; title?: string; date?: string; location?: string; latitude?: number | null; longitude?: number | null; cover_image_url?: string; banner_url?: string | null };

type ZipDirectoryEntry = { zip: string; count: number };

const ZIP_REGEX = /\b\d{5}\b/g;

const buildZipDirectory = (items: GameItem[]): ZipDirectoryEntry[] => {
  const counts = new Map<string, number>();
  items.forEach((game) => {
    if (!game) return;
    const bucket: string[] = [];
    const maybeLocation = (game as any)?.location;
    if (typeof maybeLocation === 'string') bucket.push(maybeLocation);
    const maybeAddress = (game as any)?.address;
    if (typeof maybeAddress === 'string') bucket.push(maybeAddress);
    const maybeCity = (game as any)?.city;
    if (typeof maybeCity === 'string') bucket.push(maybeCity);
    const explicit = (game as any)?.zip || (game as any)?.postal_code;
    if (explicit) bucket.push(String(explicit));
    bucket.forEach((entry) => {
      if (typeof entry !== 'string') return;
      const matches = entry.match(ZIP_REGEX);
      if (!matches) return;
      matches.forEach((zip) => {
        const normalized = zip.slice(0, 5);
        if (!normalized) return;
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      });
    });
  });
  return Array.from(counts.entries())
    .map(([zip, count]) => ({ zip, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.zip.localeCompare(b.zip);
    });
};

const deriveTeamLabels = (game: GameItem): { teamA: string; teamB: string } => {
  const g: any = game as any;
  if (Array.isArray(g.teams) && g.teams.length >= 2) {
    return { teamA: String(g.teams[0]?.name || 'Team A'), teamB: String(g.teams[1]?.name || 'Team B') };
  }
  const a = g.team_a?.name || g.teamA?.name || g.team_a_name || g.teamAName;
  const b = g.team_b?.name || g.teamB?.name || g.team_b_name || g.teamBName;
  if (a || b) return { teamA: String(a || 'Team A'), teamB: String(b || 'Team B') };
  const title = typeof game.title === 'string' ? game.title : '';
  if (title) {
    const parts = title.split(/\s+vs\.?\s+/i).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return { teamA: parts[0], teamB: parts[1] };
    }
  }
  return { teamA: 'Team A', teamB: 'Team B' };
};

export default function CommunityDiscoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<GameItem[]>([]);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [me, setMe] = useState<any>(null);
  const [zipDirectory, setZipDirectory] = useState<ZipDirectoryEntry[]>([]);
  const [zipSuggestionsOpen, setZipSuggestionsOpen] = useState(false);
  const [followingPosts, setFollowingPosts] = useState<any[]>([]);
  const [discoverPosts, setDiscoverPosts] = useState<any[]>([]);
  const [tab, setTab] = useState<'discover' | 'following'>('discover');
  const [nearbyPeople, setNearbyPeople] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedDate, setSelectedDate] = useState<string>('');
  // Vertical viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerPosts, setViewerPosts] = useState<FeedPost[]>([]);

  const toFeedPost = useCallback((p: any): FeedPost => {
    const mediaUrl: string | null = typeof p?.media_url === 'string' ? p.media_url : (typeof p?.media?.url === 'string' ? p.media.url : null);
    const explicitType = typeof p?.media_type === 'string' ? String(p.media_type).toLowerCase() : null;
    const isVideo = explicitType ? explicitType === 'video' : (typeof mediaUrl === 'string' ? /\.(mp4|mov|webm|m4v|avi)$/i.test(mediaUrl) : false);
    const author = p?.author || null;
    const authorId = author?.id ?? author?.user_id ?? null;
    return {
      id: String(p?.id ?? p?.post_id ?? Date.now()),
      media_url: mediaUrl,
      media_type: isVideo ? 'video' : 'image',
      caption: p?.caption ?? p?.title ?? null,
      upvotes_count: typeof p?.upvotes_count === 'number' ? p.upvotes_count : (typeof p?.likes === 'number' ? p.likes : 0),
      comments_count: typeof p?._count?.comments === 'number' ? p._count.comments : (typeof p?.comments_count === 'number' ? p.comments_count : 0),
      bookmarks_count: typeof p?.bookmarks_count === 'number' ? p.bookmarks_count : 0,
      created_at: p?.created_at ?? p?.createdAt ?? null,
      author: author ? {
        id: String(authorId ?? ''),
        display_name: author?.display_name ?? author?.name ?? author?.username ?? null,
        avatar_url: author?.avatar_url ?? author?.avatarUrl ?? null,
      } : null,
      has_upvoted: Boolean(p?.has_upvoted ?? p?.liked),
      has_bookmarked: Boolean(p?.has_bookmarked ?? p?.bookmarked),
      is_following_author: Boolean(p?.is_following_author ?? p?.is_following),
      type: p?.type ?? null,
      collage: p?.collage ?? null,
      preview_url: p?.preview_url ?? null,
    };
  }, []);

  const openVerticalViewer = useCallback((selected: any, pool: any[]) => {
    const list = Array.isArray(pool) ? pool.map(toFeedPost).filter((f) => !!f && (!!f.media_url || !!f.collage)) : [];
    const idx = list.findIndex((it) => String(it.id) === String(selected?.id));
    setViewerPosts(list);
    setViewerIndex(Math.max(0, idx));
    setViewerOpen(true);
  }, [toFeedPost]);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      let user: any = null;
      try {
        user = await User.me();
        setMe(user);
      } catch (err) {
        if (__DEV__) console.warn('Discover load: unable to fetch user', err);
      }
      const gamesData = await Game.list('-date');
      let normalizedGames = Array.isArray(gamesData) ? gamesData : [];
      // If user has a zip, prioritize games that mention it in location metadata
      const zip = user?.preferences?.zip_code ? String(user.preferences.zip_code) : '';
      if (zip) {
        const withZip: GameItem[] = [];
        const withoutZip: GameItem[] = [];
        normalizedGames.forEach((g) => {
          const hay = `${(g as any)?.location || ''} ${(g as any)?.address || ''} ${(g as any)?.city || ''}`.toLowerCase();
          if (hay.includes(zip.toLowerCase())) withZip.push(g); else withoutZip.push(g);
        });
        normalizedGames = [...withZip, ...withoutZip];
      }
      setGames(normalizedGames);
      setZipDirectory(buildZipDirectory(normalizedGames));

      // Lightweight personalization: following posts preview and nearby people
      try {
        // Use trending for Discover; fallback to latest on error
        let items: any[] = [];
        try {
          const trending = await Post.trendingPage(undefined, 20);
          items = Array.isArray(trending.items) ? trending.items : [];
        } catch {
          const postsPage = await Post.listPage(undefined, 20, '-created_date');
          items = Array.isArray(postsPage.items) ? postsPage.items : [];
        }
        const followingOnly = items.filter((p: any) => p && (p.is_following_author || p.is_following));
        const nonFollowing = items.filter((p: any) => !(p && (p.is_following_author || p.is_following)));
        setFollowingPosts(followingOnly.slice(0, 12));
        setDiscoverPosts((nonFollowing.length ? nonFollowing : items).slice(0, 12));
      } catch {}
      try {
        // Nearby people: prefer school/league if present, else zip
        const school = user?.preferences?.school || user?.school || null;
        const league = user?.preferences?.league || user?.league || null;
        const zipQ = user?.preferences?.zip_code ? String(user.preferences.zip_code) : '';
        if (school || league) {
          const q = String(school || league);
          // Use Team API allMembers as a proxy for school/league members if supported
          const members = await Team.allMembers(q);
          const arr = Array.isArray(members) ? members : (Array.isArray((members as any)?.items) ? (members as any).items : []);
          setNearbyPeople(arr.slice(0, 20));
        } else if (zipQ) {
          const users = await User.listAll(zipQ, 30);
          const arr = Array.isArray(users) ? users : (Array.isArray((users as any)?.items) ? (users as any).items : []);
          setNearbyPeople(arr.slice(0, 20));
        } else {
          setNearbyPeople([]);
        }
      } catch {}
    } catch (e: any) {
      console.error('Failed to load discover data', e);
      setError('Unable to load discover. Sign in may be required.');
      setGames([]);
      setZipDirectory([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load({ silent: true }); } finally { setRefreshing(false); }
  }, [load]);

  const filtered = useMemo(() => {
    if (!query) return games;
    const q = query.toLowerCase().trim();
    const zip = q.match(/\b\d{5}\b/);
    if (zip) {
      return games.filter((g) => (g.location || '').toLowerCase().includes(zip[0]));
    }
    return games.filter((g) => (g.title || '').toLowerCase().includes(q) || (g.location || '').toLowerCase().includes(q));
  }, [games, query]);

  const zipSuggestions = useMemo(() => {
    if (!zipSuggestionsOpen) return [] as ZipDirectoryEntry[];
    const digits = query.replace(/[^0-9]/g, '');
    if (digits.length < 2) return [] as ZipDirectoryEntry[];
    return zipDirectory
      .filter((entry) => entry.zip.startsWith(digits))
      .slice(0, 6);
  }, [zipSuggestionsOpen, query, zipDirectory]);

  const shouldShowZipSuggestions = zipSuggestionsOpen && zipSuggestions.length > 0;

  const ListHeader = (
    <View>
      {/* Search Bar - At the very top */}
      <View style={{flexDirection: 'row', gap: 8, alignItems: 'center'}}>
        <View style={[styles.searchBox, { flex: 1, backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
          <Ionicons name="search" size={20} color={Colors[colorScheme].mutedText} />
          <TextInput
            placeholder="Search by keyword or Zip Code..."
            placeholderTextColor={Colors[colorScheme].mutedText}
            value={query}
            onChangeText={(v) => {
              setQuery(v);
              const digits = v.replace(/[^0-9]/g, '');
              setZipSuggestionsOpen(digits.length >= 2);
            }}
            style={styles.searchInput}
            returnKeyType="search"
            onBlur={() => setZipSuggestionsOpen(false)}
          />
        </View>

        {/* Map/List Toggle */}
        <Pressable
          onPress={() => {
            const newMode: typeof viewMode = viewMode === 'list' ? 'map' : 'list';
            console.log('🗺️ Switching view mode from', viewMode, 'to', newMode);
            console.log('📍 Filtered games count:', filtered.length);
            console.log('📍 Games with coordinates:', filtered.filter(g => g.latitude && g.longitude).length);
            setViewMode(newMode);
          }}
          style={[styles.viewToggle, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}
        >
          <Ionicons 
            name={viewMode === 'list' ? 'map' : 'list'} 
            size={24} 
            color={Colors[colorScheme].tint} 
          />
        </Pressable>
      </View>

      {shouldShowZipSuggestions ? (
        <View style={[styles.zipSuggestionList, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }] }>
          {zipSuggestions.map((entry) => (
            <Pressable
              key={entry.zip}
              style={styles.zipSuggestionItem}
              onPress={() => { setQuery(entry.zip); setZipSuggestionsOpen(false); }}
            >
              <Text style={[styles.zipSuggestionZip, { color: Colors[colorScheme].text }]}>{entry.zip}</Text>
              <Text style={[styles.zipSuggestionCount, { color: Colors[colorScheme].mutedText }]}>{entry.count === 1 ? '1 game' : `${entry.count} games`}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Calendar - Right below search */}
      <View style={styles.calendarSection}>
        <Calendar
          onDayPress={(day) => setSelectedDate(day.dateString)}
          markedDates={{
            [selectedDate]: { selected: true, selectedColor: Colors[colorScheme].tint }
          }}
          theme={{
            backgroundColor: Colors[colorScheme].background,
            calendarBackground: Colors[colorScheme].background,
            textSectionTitleColor: Colors[colorScheme].text,
            selectedDayBackgroundColor: Colors[colorScheme].tint,
            selectedDayTextColor: Colors[colorScheme].background,
            todayTextColor: Colors[colorScheme].tint,
            dayTextColor: Colors[colorScheme].text,
            textDisabledColor: Colors[colorScheme].mutedText,
            arrowColor: Colors[colorScheme].tint,
            monthTextColor: Colors[colorScheme].text,
            textDayFontWeight: '500',
            textMonthFontWeight: '800',
            textDayHeaderFontWeight: '600',
          }}
        />
      </View>

      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Discover</Text>

      {/* Coach Dashboard Section */}
      {me?.preferences?.role === 'coach' && (
        <View style={[styles.coachDashboard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
          <Text style={[styles.coachTitle, { color: Colors[colorScheme].text }]}>Coach Dashboard</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
            <Pressable 
              style={[styles.coachActionCard, { backgroundColor: Colors[colorScheme].tint + '10', borderColor: Colors[colorScheme].tint + '30' }]}
              onPress={() => router.push('/manage-teams')}
            >
              <Ionicons name="people" size={24} color={Colors[colorScheme].tint} />
              <Text style={[styles.coachActionTitle, { color: Colors[colorScheme].tint }]}>Manage Teams</Text>
              <Text style={[styles.coachActionDesc, { color: Colors[colorScheme].mutedText }]}>Create and manage your teams</Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      {me && me._count?.following ? (
        <View style={[styles.followingCard, { backgroundColor: '#1e3a8a22', borderColor: '#1e3a8a55' }]}>
          <Ionicons name="people" size={18} color="#2563EB" />
          <Text style={[styles.followingText, { color: Colors[colorScheme].text }]}>{`Following ${me._count.following} people`}</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => router.push(`/following?id=${me.id}&username=${me.display_name || me.username || 'You'}`)} style={styles.followingBtn}>
            <Text style={styles.followingBtnText}>Manage</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.followingCardMuted, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
          <Ionicons name="people-outline" size={18} color={Colors[colorScheme].mutedText} />
          <Text style={[styles.followingMutedText, { color: Colors[colorScheme].mutedText }]}>Follow people to see their posts here.</Text>
        </View>
      )}

      {/* Segmented tabs for posts */}
      <View style={[styles.tabsWrap, { backgroundColor: Colors[colorScheme].border }]}>
        <Pressable onPress={() => setTab('discover')} style={[styles.tab, tab === 'discover' && [styles.tabOn, { backgroundColor: Colors[colorScheme].card }]]}>
          <Text style={[styles.tabLabel, tab === 'discover' && styles.tabLabelOn, { color: Colors[colorScheme].text }]}>Discover</Text>
        </Pressable>
        <Pressable onPress={() => setTab('following')} style={[styles.tab, tab === 'following' && [styles.tabOn, { backgroundColor: Colors[colorScheme].card }]]}>
          <Text style={[styles.tabLabel, tab === 'following' && styles.tabLabelOn, { color: Colors[colorScheme].text }]}>Following</Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>{tab === 'following' ? 'From people you follow' : 'Discover new posts'}</Text>
      {(tab === 'following' ? followingPosts : discoverPosts).length === 0 ? (
        <Text style={[styles.mutedSmall, { color: Colors[colorScheme].mutedText }]}>{tab === 'following' ? 'Follow people to see their posts here.' : 'New posts will appear here soon.'}</Text>
      ) : (
        <View style={{ marginBottom: 12, gap: 10 }}>
          {(tab === 'following' ? followingPosts : discoverPosts).map((p, i, arr) => {
            const author = p?.author || null;
            const authorId = author?.id ? String(author.id) : null;
            return (
              <View key={String(p.id)}>
                <View style={styles.postHeaderRow}>
                  <Pressable
                    style={styles.postHeaderLeft}
                    onPress={() => {
                      if (!authorId) return;
                      console.log('Profile clicked for user:', authorId, author?.username);
                      // Navigate to the specific user's profile, not own profile
                      router.push(`/user-profile?id=${authorId}`);
                    }}
                  >
                    <View style={styles.postAvatarWrap}>
                      {author?.avatar_url ? (
                        <Image source={{ uri: String(author.avatar_url) }} style={styles.postAvatar} contentFit="cover" />
                      ) : (
                        <LinearGradient colors={["#1e293b", "#0f172a"]} style={styles.postAvatar} />
                      )}
                    </View>
                    <Text style={[styles.postAuthorName, { color: Colors[colorScheme].text }]} numberOfLines={1}>{author?.display_name || 'User'}</Text>
                  </Pressable>
                  {authorId && me?.id !== authorId ? (
                    <Pressable
                      onPress={async () => {
                        // Optimistic toggle
                        const nextVal = !p.is_following_author;
                        setFollowingPosts((prev) => prev.map((item) => item.id === p.id ? { ...item, is_following_author: nextVal } : item));
                        setDiscoverPosts((prev) => prev.map((item) => item.id === p.id ? { ...item, is_following_author: nextVal } : item));
                        try {
                          if (nextVal) {
                            await User.follow(authorId);
                          } else {
                            await User.unfollow(authorId);
                          }
                        } catch (e) {
                          // Revert on failure
                          setFollowingPosts((prev) => prev.map((item) => item.id === p.id ? { ...item, is_following_author: !nextVal } : item));
                          setDiscoverPosts((prev) => prev.map((item) => item.id === p.id ? { ...item, is_following_author: !nextVal } : item));
                        }
                      }}
                      style={[
                        styles.followBtn, 
                        { backgroundColor: p.is_following_author ? Colors[colorScheme].border : Colors[colorScheme].tint }
                      ]}
                    >
                      <Text style={[
                        styles.followBtnText, 
                        { color: p.is_following_author ? Colors[colorScheme].text : Colors[colorScheme].background }
                      ]}>
                        {p.is_following_author ? 'Following' : 'Follow'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <PostCard
                  post={p}
                  onPress={() => router.push(`/post-detail?id=${p.id}`)}
                  showAuthorHeader={false}
                  onDeleted={(postId) => {
                    // Remove deleted post from both arrays
                    setFollowingPosts(prev => prev.filter(post => String(post.id) !== postId));
                    setDiscoverPosts(prev => prev.filter(post => String(post.id) !== postId));
                  }}
                  onUpdated={(updatedPost) => {
                    // Update post in both arrays if it exists
                    setFollowingPosts(prev => prev.map(post => 
                      String(post.id) === String(updatedPost.id) ? { ...post, ...updatedPost } : post
                    ));
                    setDiscoverPosts(prev => prev.map(post => 
                      String(post.id) === String(updatedPost.id) ? { ...post, ...updatedPost } : post
                    ));
                  }}
                />
              </View>
            );
          })}
        </View>
      )}

      {nearbyPeople.length > 0 ? (
        <View style={{ marginBottom: 16 }}>
          <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>Nearby people</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ paddingRight: 8 }}>
            {nearbyPeople.map((u) => (
              <Pressable key={String(u.id)} style={styles.personTile} onPress={() => router.push(`/user-profile?id=${u.id}`)}>
                <View style={styles.personAvatar}>
                  {u.avatar_url ? (
                    <Image source={{ uri: String(u.avatar_url) }} style={styles.personAvatar} contentFit="cover" />
                  ) : (
                    <LinearGradient colors={["#1e293b", "#0f172a"]} style={styles.personAvatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                  )}
                </View>
                <Text numberOfLines={1} style={[styles.personName, { color: Colors[colorScheme].text }]}>{u.display_name || u.username || 'User'}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

  <Text style={[styles.helper, { color: Colors[colorScheme].mutedText }]}>Upcoming and recent games near you</Text>

      {loading ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}
    </View>
  );

  return (
  <View style={[styles.container, { paddingTop: 12 + insets.top, backgroundColor: Colors[colorScheme].background }]}>      
      <Stack.Screen options={{ title: 'Discover' }} />
      
      {viewMode === 'map' ? (
        /* Map View - Simplified without ListHeader */
        <View style={{ flex: 1 }}>
          {/* Just the search and toggle button */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <View style={{flexDirection: 'row', gap: 8, alignItems: 'center'}}>
              <View style={[styles.searchBox, { flex: 1, backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }] }>
                <Ionicons name="search" size={20} color={Colors[colorScheme].mutedText} />
                <TextInput
                  placeholder="Search by Zip Code..."
                  placeholderTextColor={Colors[colorScheme].mutedText}
                  value={query}
                  onChangeText={(v) => {
                    setQuery(v);
                    const digits = v.replace(/[^0-9]/g, '');
                    setZipSuggestionsOpen(digits.length >= 2);
                  }}
                  style={styles.searchInput}
                  returnKeyType="search"
                  onBlur={() => setZipSuggestionsOpen(false)}
                />
              </View>

              {/* Map/List Toggle */}
              <Pressable
                onPress={() => {
                  const newMode = viewMode === 'list' ? 'map' : 'list';
                  console.log('🗺️ Switching view mode from', viewMode, 'to', newMode);
                  console.log('📍 Filtered games count:', filtered.length);
                  console.log('📍 Games with coordinates:', filtered.filter(g => g.latitude && g.longitude).length);
                  setViewMode(newMode as 'list' | 'map');
                }}
                style={[styles.viewToggle, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}
              >
                <Ionicons 
                  name={viewMode === 'list' ? 'map' : 'list'} 
                  size={24} 
                  color={Colors[colorScheme].tint} 
                />
              </Pressable>
            </View>
          </View>

          {/* Full Map View */}
          {(() => {
            const eventsWithCoords = filtered.filter(g => g.latitude && g.longitude);
            console.log('🗺️ MAP VIEW RENDERING');
            console.log('📍 Total filtered games:', filtered.length);
            console.log('📍 Games with coordinates:', eventsWithCoords.length);
            console.log('📍 First game with coords:', eventsWithCoords[0] ? {
              title: eventsWithCoords[0].title,
              lat: eventsWithCoords[0].latitude,
              lng: eventsWithCoords[0].longitude
            } : 'none');
            
            // Show ALL games, not just filtered ones
            const allGamesWithCoords = games.filter(g => g.latitude && g.longitude);
            console.log('📍 ALL games with coordinates:', allGamesWithCoords.length);
            
            return (
              <EventMap
                events={allGamesWithCoords.map((game): EventMapData => ({
                  id: String(game.id),
                  title: String(game.title || 'Game'),
                  date: String(game.date || new Date().toISOString()),
                  location: String(game.location || ''),
                  latitude: game.latitude ?? undefined,
                  longitude: game.longitude ?? undefined,
                  type: 'game',
                }))}
                onEventPress={(eventId) => {
                  router.push({ pathname: '/(tabs)/feed/game/[id]', params: { id: eventId } });
                }}
                showUserLocation={true}
              />
            );
          })()}
        </View>
      ) : (
        /* List View */
        <FlatList
          style={{ flex: 1 }}
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={ListHeader}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push({ pathname: '/(tabs)/feed/game/[id]', params: { id: String(item.id) } })}
            >
              <View style={styles.hero}>
                {(() => {
                  const banner = item.cover_image_url || (item as any).banner_url || null;
                  return banner ? (
                    <Image source={{ uri: banner }} style={styles.heroImage} contentFit="cover" />
                  ) : (
                    <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.heroImage} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                  );
                })()}
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item.title ? String(item.title) : 'Game'}</Text>
                <Text style={styles.cardMeta}>{item.location ? String(item.location) : 'TBD'}</Text>
                {(() => {
                  const labels = deriveTeamLabels(item);
                  return (
                    <View style={styles.teamRow}>
                      <View style={styles.teamPill}><Text style={styles.teamPillText}>{labels.teamA}</Text></View>
                      <Text style={styles.vsText}>vs</Text>
                      <View style={styles.teamPillAlt}><Text style={styles.teamPillAltText}>{labels.teamB}</Text></View>
                    </View>
                  );
                })()}
              </View>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 24 }}
          refreshing={refreshing}
          onRefresh={onRefresh}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <Modal visible={viewerOpen} animationType="slide" onRequestClose={() => setViewerOpen(false)}>
        <GameVerticalFeedScreen
          onClose={() => setViewerOpen(false)}
          initialPosts={viewerPosts}
          startIndex={viewerIndex}
          title={tab === 'following' ? 'Following' : 'Discover'}
          showHeader
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 28, fontWeight: '900', marginBottom: 8 },
  center: { paddingVertical: 24, alignItems: 'center' },
  helper: { color: '#6b7280', marginBottom: 10 },
  mutedSmall: { color: '#6b7280', marginBottom: 10, fontSize: 12 },
  sectionTitle: { fontWeight: '800', marginTop: 8 },
  error: { color: '#b91c1c', marginBottom: 8 },
  calendarSection: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: 12, paddingHorizontal: 12, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth },
  searchInput: { flex: 1, height: 44 },
  viewToggle: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  zipSuggestionList: { marginTop: 6, marginBottom: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  zipSuggestionItem: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  zipSuggestionZip: { fontWeight: '700', color: '#111827', fontSize: 15 },
  zipSuggestionCount: { color: '#6b7280', fontSize: 12 },
  followingCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, marginTop: 4, marginBottom: 10 },
  followingText: { color: '#1e3a8a', fontWeight: '700' },
  followingBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#1D4ED8' },
  followingBtnText: { color: 'white', fontWeight: '800' },
  followingCardMuted: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, marginTop: 4, marginBottom: 10 },
  followingMutedText: { color: '#6B7280', fontWeight: '600' },
  // Segmented tabs
  tabsWrap: { flexDirection: 'row', borderRadius: 10, marginTop: 4, marginBottom: 8, padding: 4, gap: 6, height: 40 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  tabOn: {},
  tabLabel: { fontWeight: '700', color: '#374151' },
  tabLabelOn: { color: '#111827' },
  // Post header (avatar + follow button)
  postHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 6 },
  postHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postAvatarWrap: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden' },
  postAvatar: { width: 28, height: 28, borderRadius: 14 },
  postAuthorName: { fontWeight: '700', maxWidth: 200 },
  followBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  followBtnOn: {},
  followBtnText: { fontWeight: '800' },
  followBtnTextOn: {},
  card: { padding: 14, borderRadius: 14, backgroundColor: 'white', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  hero: { height: 140, borderRadius: 12, backgroundColor: '#F1F5F9', marginBottom: 12, overflow: 'hidden' },
  heroImage: { width: '100%', height: '100%' },
  cardTitle: { fontWeight: '800', fontSize: 18, marginBottom: 2 },
  cardMeta: { color: '#6b7280' },
  cardContent: { paddingHorizontal: 4, paddingBottom: 8 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  teamPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#EEF2FF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#C7D2FE' },
  teamPillText: { fontWeight: '700', color: '#1E3A8A' },
  vsText: { marginHorizontal: 4, color: '#6b7280', fontWeight: '800' },
  teamPillAlt: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#DCFCE7', borderWidth: StyleSheet.hairlineWidth, borderColor: '#A7F3D0' },
  teamPillAltText: { fontWeight: '700', color: '#065F46' },
  personTile: { width: 84, marginRight: 10, alignItems: 'center' },
  personAvatar: { width: 64, height: 64, borderRadius: 32 },
  personName: { marginTop: 6, fontSize: 12, color: '#111827', maxWidth: 84 },
  // Coach Dashboard Styles
  coachDashboard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  coachTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  coachActionCard: {
    width: 140,
    padding: 12,
    borderRadius: 12,
    marginRight: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  coachActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  coachActionDesc: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 14,
  },
});
