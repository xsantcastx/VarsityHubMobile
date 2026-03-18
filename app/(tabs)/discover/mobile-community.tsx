import { useAuth } from '@/context/AuthProvider';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useDeviceLocation } from '@/hooks/useDeviceLocation';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { Game, Organization, Post, Search, Team, User } from '@/api/entities';
import EventMap, { EventMapData } from '@/components/EventMap';
import PostCard from '@/components/PostCard';
import QuickAddGameModal, { QuickGameData } from '@/components/QuickAddGameModal';
import { Calendar } from 'react-native-calendars';
import SwipeBackContainer from '@/components/SwipeBackContainer';
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
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { location: _location, loading: _locLoading, error: _locError, permissionGranted, requestPermission, needsPreciseAccuracy, openSettings } = useDeviceLocation();
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
  const [createEventModalOpen, setCreateEventModalOpen] = useState(false);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  // Vertical viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerPosts, setViewerPosts] = useState<FeedPost[]>([]);
  const [precisionBannerDismissed, setPrecisionBannerDismissed] = useState(false);
  const [personalizationNotice, setPersonalizationNotice] = useState<string | null>(null);
  const showPrecisionBanner = Platform.OS === 'android' && permissionGranted && needsPreciseAccuracy && !precisionBannerDismissed;
  // Unified search (users, teams, organizations) - uses same query as zip search
  const [unifiedSearchResults, setUnifiedSearchResults] = useState<{ users: any[]; teams: any[]; organizations: any[] } | null>(null);
  const [unifiedSearchLoading, setUnifiedSearchLoading] = useState(false);

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

  const _openVerticalViewer = useCallback((selected: any, pool: any[]) => {
    const list = Array.isArray(pool) ? pool.map(toFeedPost).filter((f) => !!f && (!!f.media_url || !!f.collage)) : [];
    const idx = list.findIndex((it) => String(it.id) === String(selected?.id));
    setViewerPosts(list);
    setViewerIndex(Math.max(0, idx));
    setViewerOpen(true);
  }, [toFeedPost]);

  const loadGames = useCallback(async (user: any) => {
    try {
      const gamesData = await Game.list('-date');
      let normalizedGames = Array.isArray(gamesData) ? gamesData : (gamesData?.games || gamesData?.items || []);
      
      // Filter out past events by default
      const now = new Date();
      normalizedGames = normalizedGames.filter((g: any) => {
        if (!g.date) return true; // Keep games without dates
        const gameDate = new Date(g.date);
        return !isNaN(gameDate.getTime()) && gameDate >= now;
      });
      
      const zip = user?.preferences?.zip_code ? String(user.preferences.zip_code).trim() : '';
      if (zip) {
        // Normalize zip code (remove dashes, spaces)
        const normalizedZip = zip.replace(/[-\s]/g, '').toLowerCase();
        const withZip: GameItem[] = [];
        const withoutZip: GameItem[] = [];
        normalizedGames.forEach((g: GameItem) => {
          const hay = `${(g as any)?.location || ''} ${(g as any)?.address || ''} ${(g as any)?.city || ''}`.toLowerCase();
          // Extract zip codes from location string and check if any match
          const zipMatches = hay.match(/\b\d{5}(?:-\d{4})?\b/g);
          const hasMatchingZip = zipMatches?.some(z => z.replace(/[-\s]/g, '').startsWith(normalizedZip.slice(0, 5)));
          if (hasMatchingZip || hay.includes(normalizedZip)) {
            withZip.push(g);
          } else {
            withoutZip.push(g);
          }
        });
        normalizedGames = [...withZip, ...withoutZip];
      }
      setGames(normalizedGames);
      setZipDirectory(buildZipDirectory(normalizedGames));
    } catch (gameError) {
      if (__DEV__) console.error('Discover load: failed to fetch games', gameError);
      const errorMsg = gameError instanceof Error ? gameError.message : 'Unknown error';
      if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError('Unable to load events right now. Pull to refresh to retry.');
      }
      setGames([]);
      setZipDirectory([]);
    }
  }, []);

  const loadPersonalization = useCallback(async (user: any) => {
    setPersonalizationNotice(null);
    try {
      let items: any[] = [];
      try {
        const trending = await Post.trendingPage(undefined, 20);
        items = Array.isArray(trending.items) ? trending.items : [];
      } catch {
        const postsPage = await Post.listPage(undefined, 20, '-created_date');
        items = Array.isArray(postsPage.items) ? postsPage.items : [];
      }
      if (items.length === 0) {
        try {
          const fallback = await Post.list('-created_at', 20);
          items = Array.isArray(fallback) ? fallback : [];
        } catch {
          items = [];
        }
      }
      const followingOnly = items.filter((p: any) => p && (p.is_following_author || p.is_following));
      const nonFollowing = items.filter((p: any) => !(p && (p.is_following_author || p.is_following)));
      setFollowingPosts(followingOnly.slice(0, 12));
      setDiscoverPosts((nonFollowing.length ? nonFollowing : items).slice(0, 12));

      // Nearby people: prefer school/league if present, else zip
      try {
        const school = user?.preferences?.school || user?.school || null;
        const league = user?.preferences?.league || user?.league || null;
        const zipQ = user?.preferences?.zip_code ? String(user.preferences.zip_code).trim() : '';
        
        if (school || league) {
          const q = String(school || league);
          try {
            const members = await Team.allMembers(q);
            const arr = Array.isArray(members) ? members : (Array.isArray((members as any)?.items) ? (members as any).items : []);
            setNearbyPeople(arr.slice(0, 20));
          } catch (teamError) {
            if (__DEV__) console.warn('Discover load: team members failed', teamError);
            // Fallback to zip code if team members fails
            if (zipQ) {
              try {
                const users = await User.listAll(zipQ, 30);
                const arr = Array.isArray(users) ? users : (Array.isArray((users as any)?.items) ? (users as any).items : []);
                setNearbyPeople(arr.slice(0, 20));
              } catch {
                setNearbyPeople([]);
              }
            } else {
              setNearbyPeople([]);
            }
          }
        } else if (zipQ) {
          // Note: User.listAll is admin-only, so this will return empty array for regular users
          // This is handled gracefully in api/entities.ts
          const users = await User.listAll(zipQ, 30);
          const arr = Array.isArray(users) ? users : (Array.isArray((users as any)?.items) ? (users as any).items : []);
          setNearbyPeople(arr.slice(0, 20));
        } else {
          setNearbyPeople([]);
        }
      } catch (peopleError) {
        if (__DEV__) console.warn('Discover load: nearby people failed', peopleError);
        setNearbyPeople([]);
      }
    } catch (personalizationError) {
      if (__DEV__) console.warn('Discover load: personalization failed', personalizationError);
      setPersonalizationNotice('Personalized suggestions are temporarily unavailable. Pull to refresh to try again.');
      try {
        const fallback = await Post.list('-created_at', 20);
        const items = Array.isArray(fallback) ? fallback : [];
        setFollowingPosts([]);
        setDiscoverPosts(items.slice(0, 12));
      } catch {
        setFollowingPosts([]);
        setDiscoverPosts([]);
      }
    }
  }, []);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    setPersonalizationNotice(null);

    let user: any = null;
    try {
      user = await User.me();
      setMe(user);
    } catch (err) {
      if (__DEV__) console.warn('Discover load: unable to fetch user', err);
      setMe(null);
    }

    await Promise.allSettled([
      loadGames(user),
      loadPersonalization(user),
    ]);

    if (!silent) setLoading(false);
  }, [loadGames, loadPersonalization]);

  useEffect(() => {
    void load().catch(() => {});
  }, [load]);

  // Debounced unified search (users, teams, organizations)
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setUnifiedSearchResults(null);
      return;
    }
    const t = setTimeout(async () => {
      setUnifiedSearchLoading(true);
      try {
        const res = await Search.unified(trimmed, 10);
        setUnifiedSearchResults({
          users: res?.users ?? [],
          teams: res?.teams ?? [],
          organizations: res?.organizations ?? [],
        });
      } catch {
        setUnifiedSearchResults({ users: [], teams: [], organizations: [] });
      } finally {
        setUnifiedSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load({ silent: true }); } finally { setRefreshing(false); }
  }, [load]);

  const handleManageOrg = useCallback(async () => {
    try {
      const orgs = await Organization.mine();
      const list = Array.isArray(orgs) ? orgs : [];
      if (list.length > 0) {
        router.push({ pathname: '/organization', params: { id: list[0].id } } as any);
      } else {
        Alert.alert('No Organization', 'You are not linked to any organization yet.');
      }
    } catch {
      Alert.alert('Error', 'Could not load your organization.');
    }
  }, [router]);

  const handleTeamSchedule = useCallback(async () => {
    try {
      const teams = await Team.managed();
      const arr = Array.isArray(teams) ? teams : (Array.isArray((teams as any)?.items) ? (teams as any).items : []);
      if (arr.length === 1) {
        router.push(`/manage-season?teamId=${arr[0].id}` as any);
      } else if (arr.length > 1) {
        router.push('/manage-season' as any);
      } else {
        Alert.alert('No Teams', 'Create a team first to manage your schedule.', [
          { text: 'Create Team', onPress: () => router.push('/create-team') },
          { text: 'Close', style: 'cancel' },
        ]);
      }
    } catch {
      Alert.alert('Error', 'Could not load teams. Please try again.');
    }
  }, [router]);

  const handleQuickGameSave = useCallback(async (data: QuickGameData) => {
    if (isCreatingGame) return; // Prevent duplicate submissions
    setIsCreatingGame(true);
    try {
      // Validate date format
      if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
        throw new Error('Invalid date format. Please use YYYY-MM-DD format.');
      }

      // Parse date and time
      const [year, month, day] = data.date.split('-').map(Number);
      
      // Validate date values
      if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        throw new Error('Invalid date values.');
      }
      if (month < 1 || month > 12 || day < 1 || day > 31) {
        throw new Error('Invalid date values. Month must be 1-12, day must be 1-31.');
      }

      // Parse time with more flexible regex
      const timeParts = data.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!timeParts) {
        throw new Error('Invalid time format. Please use HH:MM AM/PM format.');
      }
      
      let hours = parseInt(timeParts[1], 10);
      const minutes = parseInt(timeParts[2], 10);
      const isPM = timeParts[3].toUpperCase() === 'PM';
      
      // Validate time values
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        throw new Error('Invalid time values.');
      }
      if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
        throw new Error('Invalid time values. Hours must be 1-12, minutes must be 0-59.');
      }
      
      // Convert to 24-hour format
      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
      
      const gameDateTime = new Date(Date.UTC(year, month - 1, day, hours, minutes));
      
      // Validate resulting date
      if (isNaN(gameDateTime.getTime())) {
        throw new Error('Invalid date. Please check the date and time values.');
      }
      
      // Check if date is in the past
      if (gameDateTime < new Date()) {
        throw new Error('Cannot create events in the past. Please select a future date and time.');
      }

      // Create game payload
      const gamePayload: Record<string, any> = {
        title: data.isCompetitive 
          ? `${data.currentTeam} vs ${data.opponent}`
          : `${data.currentTeam} Event`,
        date: gameDateTime.toISOString(),
        description: data.description || (data.isCompetitive
          ? `${data.type === 'home' ? 'Home' : 'Away'} game: ${data.currentTeam} vs ${data.opponent}`
          : `Event for ${data.currentTeam}`),
      };

      // Only add team fields if this is a competitive game
      if (data.isCompetitive) {
        gamePayload.home_team = data.type === 'home' ? data.currentTeam : data.opponent;
        gamePayload.away_team = data.type === 'home' ? data.opponent : data.currentTeam;
        
        if (data.currentTeamId) gamePayload.home_team_id = data.type === 'home' ? data.currentTeamId : null;
        if (data.opponentTeamId) {
          gamePayload.away_team_id = data.type === 'home' ? data.opponentTeamId : data.currentTeamId;
        } else if (data.opponent) {
          gamePayload.away_team_name = data.opponent;
        }
      } else {
        // For non-competitive events, still send home_team_id for approval workflow
        if (data.currentTeamId) {
          gamePayload.home_team_id = data.currentTeamId;
        }
      }

      // Add expected attendance if provided
      if (data.expectedAttendance) {
        gamePayload.expected_attendance = data.expectedAttendance;
      }

      // Add event type
      if (data.eventType) {
        gamePayload.event_type = data.eventType;
      }
      
      // Add event type-specific fields
      if (data.donationGoal) {
        gamePayload.donation_goal = data.donationGoal;
      }
      if (data.watchLocation) {
        gamePayload.watch_location = data.watchLocation;
        if (data.watchLocationLat) gamePayload.watch_location_lat = data.watchLocationLat;
        if (data.watchLocationLng) gamePayload.watch_location_lng = data.watchLocationLng;
        if (data.watchLocationPlaceId) gamePayload.watch_location_place_id = data.watchLocationPlaceId;
      }
      if (data.destination) {
        gamePayload.destination = data.destination;
      }

      if (data.banner_url) {
        gamePayload.banner_url = data.banner_url;
        gamePayload.cover_image_url = data.banner_url;
      } else if (data.cover_image_url) {
        gamePayload.cover_image_url = data.cover_image_url;
      }

      if (data.appearance) {
        gamePayload.appearance = data.appearance;
      }

      // Validate required fields before API call
      if (!gamePayload.title || gamePayload.title.trim().length === 0) {
        throw new Error('Event title is required.');
      }
      if (!gamePayload.date) {
        throw new Error('Event date is required.');
      }

      // Create game using the API
      await Game.create(gamePayload);

      setCreateEventModalOpen(false);
      
      // Refresh the games list
      await load({ silent: true });
      
      // Show success message - use native alert
      if (typeof alert !== 'undefined') {
        alert(data.isCompetitive ? 'Game added successfully!' : 'Event added successfully!');
      }
    } catch (error: any) {
      if (__DEV__) console.error('Error adding quick game:', error);
      
      const code = error?.data?.code || error?.code;
      if (code === 'APPROVAL_REQUIRED') {
        Alert.alert('Approval Required', 'Your coach account is pending approval. You can create games once a league admin approves your application.');
      } else if (code === 'PAYMENT_REQUIRED') {
        Alert.alert('Checkout Required', 'Please complete your subscription checkout before creating games.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Billing', onPress: () => router.push('/settings/manage-subscription') },
        ]);
      } else {
        const errorMessage = error?.data?.error || error?.message || 'Failed to add event.';
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsCreatingGame(false);
    }
  }, [load, isCreatingGame, router]);

  const filtered = useMemo(() => {
    if (!query) return games;
    
    // Sanitize and limit query length
    const q = query.trim().slice(0, 100).toLowerCase();
    if (q.length === 0) return games;
    
    // Check for zip code (5 digits, optionally with dash and 4 more digits)
    const zipMatch = q.match(/\b\d{5}(?:-\d{4})?\b/);
    if (zipMatch) {
      const zip = zipMatch[0].replace(/[-\s]/g, '').slice(0, 5);
      return games.filter((g) => {
        const location = `${g.location || ''} ${(g as any)?.address || ''} ${(g as any)?.city || ''}`.toLowerCase();
        // Extract zip codes from location and check if any match
        const locationZips = location.match(/\b\d{5}(?:-\d{4})?\b/g);
        return locationZips?.some(lz => lz.replace(/[-\s]/g, '').startsWith(zip)) || location.includes(zip);
      });
    }
    
    // Regular keyword search
    return games.filter((g) => {
      const title = (g.title || '').toLowerCase();
      const location = (g.location || '').toLowerCase();
      return title.includes(q) || location.includes(q);
    });
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

  const handleToggleViewMode = useCallback(async () => {
    const newMode: typeof viewMode = viewMode === 'list' ? 'map' : 'list';
    if (newMode === 'map') {
      if (!permissionGranted) {
        const granted = await requestPermission();
        if (!granted) {
          Alert.alert('Location Permission', 'Enable location to view the map and see nearby events.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => openSettings() },
          ]);
          return;
        }
      }
      if (Platform.OS === 'android' && needsPreciseAccuracy) {
        Alert.alert(
          'Enable Precise Location',
          'Map view needs precise location to show you accurate distances.',
          [
            { text: 'Not now', style: 'cancel', onPress: () => {} },
            { text: 'Open settings', onPress: () => { setPrecisionBannerDismissed(true); void openSettings(); } },
          ],
        );
        return;
      }
    }
    setViewMode(newMode);
  }, [viewMode, permissionGranted, requestPermission, needsPreciseAccuracy, openSettings]);

  const ListHeader = (
    <View>
      {showPrecisionBanner ? (
        <View style={[styles.precisionBanner, { backgroundColor: '#FEF9C3', borderColor: '#FACC15' }]}>
          <MaterialIcons name="near-me" size={18} color="#B45309" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.precisionBannerText, { color: '#92400E' }]}>
              Precise location is off. Nearby recommendations will be less accurate on Android.
            </Text>
            <View style={styles.precisionActions}>
              <Pressable onPress={() => setPrecisionBannerDismissed(true)} accessibilityRole="button" accessibilityLabel="Dismiss precision location banner">
                <Text style={[styles.precisionActionLink, { color: '#92400E' }]}>Dismiss</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setPrecisionBannerDismissed(true);
                  void openSettings();
                }}
                accessibilityRole="button"
                accessibilityLabel="Open location settings"
              >
                <Text style={[styles.precisionActionLink, { color: Colors[colorScheme].tint, fontWeight: '700' }]}>
                  Open settings
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
      {/* Search Bar - At the very top */}
      <View style={{flexDirection: 'row', gap: 8, alignItems: 'center'}}>
        <View style={[styles.searchBox, { flex: 1, backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
          <MaterialIcons name="search" size={20} color={Colors[colorScheme].mutedText} />
          <TextInput
            placeholder="Search people, teams, organizations, or zip..."
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
            accessibilityLabel="Search people, teams, organizations, or zip code"
          />
        </View>

        {/* Map/List Toggle */}
        <Pressable
          onPress={() => { void handleToggleViewMode(); }}
          style={[styles.viewToggle, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}
          accessibilityRole="button"
          accessibilityLabel={viewMode === 'list' ? 'Switch to map view' : 'Switch to list view'}
        >
          <MaterialIcons 
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
              accessibilityRole="button"
              accessibilityLabel={`Search zip code ${entry.zip}, ${entry.count} ${entry.count === 1 ? 'game' : 'games'}`}
            >
              <Text style={[styles.zipSuggestionZip, { color: Colors[colorScheme].text }]}>{entry.zip}</Text>
              <Text style={[styles.zipSuggestionCount, { color: Colors[colorScheme].mutedText }]}>{entry.count === 1 ? '1 game' : `${entry.count} games`}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Unified search results - People, Teams, Organizations */}
      {unifiedSearchLoading ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={Colors[colorScheme].tint} />
        </View>
      ) : unifiedSearchResults ? (
        <View style={[styles.unifiedSearchResults, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
          {unifiedSearchResults.users.length > 0 ? (
            <View style={styles.searchSection}>
              <Text style={[styles.searchSectionTitle, { color: Colors[colorScheme].mutedText }]}>People</Text>
              {unifiedSearchResults.users.map((u) => (
                <Pressable
                  key={u.id}
                  style={[styles.searchResultRow, { borderBottomColor: Colors[colorScheme].border }]}
                  onPress={() => { setQuery(''); setUnifiedSearchResults(null); void router.push(`/user-profile?id=${u.id}`); }}
                  accessibilityRole="button"
                  accessibilityLabel={`View profile of ${u.display_name || u.username || 'User'}`}
                >
                  <View style={styles.searchResultLeft}>
                    {u.avatar_url ? (
                      <Image source={{ uri: u.avatar_url }} style={styles.searchResultAvatar} contentFit="cover" />
                    ) : (
                      <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.searchResultAvatar} />
                    )}
                    <View>
                      <Text style={[styles.searchResultName, { color: Colors[colorScheme].text }]} numberOfLines={1}>{u.display_name || u.username || 'User'}</Text>
                      <Text style={[styles.searchResultSub, { color: Colors[colorScheme].mutedText }]} numberOfLines={1}>@{u.username || 'user'}</Text>
                    </View>
                  </View>
                  {me?.id !== u.id ? (
                    <Pressable
                      onPress={async (e) => { e.stopPropagation(); const next = !u.is_following; setUnifiedSearchResults((prev) => prev ? { ...prev, users: prev.users.map((x) => x.id === u.id ? { ...x, is_following: next } : x) } : null); try { if (next) await User.follow(u.id); else await User.unfollow(u.id); } catch { setUnifiedSearchResults((prev) => prev ? { ...prev, users: prev.users.map((x) => x.id === u.id ? { ...x, is_following: !next } : x) } : null); } }}
                      style={[styles.searchFollowBtn, { backgroundColor: u.is_following ? Colors[colorScheme].border : Colors[colorScheme].tint }]}
                      accessibilityRole="button"
                      accessibilityLabel={u.is_following ? `Unfollow ${u.display_name || u.username || 'user'}` : `Follow ${u.display_name || u.username || 'user'}`}
                    >
                      <Text style={[styles.searchFollowBtnText, { color: u.is_following ? Colors[colorScheme].text : Colors[colorScheme].background }]}>{u.is_following ? 'Following' : 'Follow'}</Text>
                    </Pressable>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}
          {unifiedSearchResults.teams.length > 0 ? (
            <View style={styles.searchSection}>
              <Text style={[styles.searchSectionTitle, { color: Colors[colorScheme].mutedText }]}>Teams</Text>
              {unifiedSearchResults.teams.map((t) => (
                <Pressable
                  key={t.id}
                  style={[styles.searchResultRow, { borderBottomColor: Colors[colorScheme].border }]}
                  onPress={() => { setQuery(''); setUnifiedSearchResults(null); void router.push(`/team-profile?id=${t.id}`); }}
                  accessibilityRole="button"
                  accessibilityLabel={`View team ${t.name}`}
                >
                  <View style={styles.searchResultLeft}>
                    {t.logo_url || t.avatar_url ? (
                      <Image source={{ uri: t.logo_url || t.avatar_url }} style={styles.searchResultAvatar} contentFit="cover" />
                    ) : (
                      <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.searchResultAvatar} />
                    )}
                    <View>
                      <Text style={[styles.searchResultName, { color: Colors[colorScheme].text }]} numberOfLines={1}>{t.name}</Text>
                      <Text style={[styles.searchResultSub, { color: Colors[colorScheme].mutedText }]} numberOfLines={1}>{t.sport ? `${t.sport} • ${t.members || 0} members` : `${t.members || 0} members`}</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={async (e) => { e.stopPropagation(); const next = !t.is_following; setUnifiedSearchResults((prev) => prev ? { ...prev, teams: prev.teams.map((x) => x.id === t.id ? { ...x, is_following: next } : x) } : null); try { if (next) await Team.follow(t.id); else await Team.unfollow(t.id); } catch { setUnifiedSearchResults((prev) => prev ? { ...prev, teams: prev.teams.map((x) => x.id === t.id ? { ...x, is_following: !next } : x) } : null); } }}
                    style={[styles.searchFollowBtn, { backgroundColor: t.is_following ? Colors[colorScheme].border : Colors[colorScheme].tint }]}
                    accessibilityRole="button"
                    accessibilityLabel={t.is_following ? `Unfollow team ${t.name}` : `Follow team ${t.name}`}
                  >
                    <Text style={[styles.searchFollowBtnText, { color: t.is_following ? Colors[colorScheme].text : Colors[colorScheme].background }]}>{t.is_following ? 'Following' : 'Follow'}</Text>
                  </Pressable>
                </Pressable>
              ))}
            </View>
          ) : null}
          {unifiedSearchResults.organizations.length > 0 ? (
            <View style={styles.searchSection}>
              <Text style={[styles.searchSectionTitle, { color: Colors[colorScheme].mutedText }]}>Organizations</Text>
              {unifiedSearchResults.organizations.map((o) => (
                <Pressable
                  key={o.id}
                  style={[styles.searchResultRow, { borderBottomColor: Colors[colorScheme].border }]}
                  onPress={() => { setQuery(''); setUnifiedSearchResults(null); void router.push(`/organization?id=${o.id}`); }}
                  accessibilityRole="button"
                  accessibilityLabel={`View organization ${o.name}`}
                >
                  <View style={styles.searchResultLeft}>
                    <LinearGradient colors={['#1e293b', '#0f172a']} style={[styles.searchResultAvatar, { borderRadius: 8 }]} />
                    <View>
                      <Text style={[styles.searchResultName, { color: Colors[colorScheme].text }]} numberOfLines={1}>{o.name}</Text>
                      <Text style={[styles.searchResultSub, { color: Colors[colorScheme].mutedText }]} numberOfLines={1}>{o.sport ? `${o.sport} • ${o.members || 0} members` : `${o.members || 0} members`}</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={async (e) => { e.stopPropagation(); const next = !o.is_following; setUnifiedSearchResults((prev) => prev ? { ...prev, organizations: prev.organizations.map((x) => x.id === o.id ? { ...x, is_following: next } : x) } : null); try { if (next) await Organization.follow(o.id); else await Organization.unfollow(o.id); } catch { setUnifiedSearchResults((prev) => prev ? { ...prev, organizations: prev.organizations.map((x) => x.id === o.id ? { ...x, is_following: !next } : x) } : null); } }}
                    style={[styles.searchFollowBtn, { backgroundColor: o.is_following ? Colors[colorScheme].border : Colors[colorScheme].tint }]}
                    accessibilityRole="button"
                    accessibilityLabel={o.is_following ? `Unfollow organization ${o.name}` : `Follow organization ${o.name}`}
                  >
                    <Text style={[styles.searchFollowBtnText, { color: o.is_following ? Colors[colorScheme].text : Colors[colorScheme].background }]}>{o.is_following ? 'Following' : 'Follow'}</Text>
                  </Pressable>
                </Pressable>
              ))}
            </View>
          ) : null}
          {unifiedSearchResults.users.length === 0 && unifiedSearchResults.teams.length === 0 && unifiedSearchResults.organizations.length === 0 ? (
            <Text style={[styles.searchEmpty, { color: Colors[colorScheme].mutedText }]}>No results found</Text>
          ) : null}
        </View>
      ) : null}

      {/* Calendar - Right below search */}
      <View style={[styles.calendarSection, { backgroundColor: colorScheme === 'light' ? '#FFFFFF' : Colors[colorScheme].background }]}>
        <Calendar
          onDayPress={(day) => {
            setSelectedDate(day.dateString);
          }}
          markedDates={useMemo(() => {
            const marked: Record<string, any> = {};
            const now = new Date();
            // Mark only future dates with events
            games.forEach(game => {
              if (game.date) {
                const gameDate = new Date(game.date);
                // Only mark future events
                if (!isNaN(gameDate.getTime()) && gameDate >= now) {
                  const dateKey = gameDate.toISOString().split('T')[0];
                  if (!marked[dateKey]) {
                    marked[dateKey] = { marked: true, dotColor: Colors[colorScheme].tint };
                  }
                }
              }
            });
            // Highlight selected date
            if (selectedDate) {
              marked[selectedDate] = {
                ...marked[selectedDate],
                selected: true,
                selectedColor: Colors[colorScheme].tint,
              };
            }
            return marked;
          }, [games, selectedDate, colorScheme])}
          style={{ backgroundColor: colorScheme === 'light' ? '#FFFFFF' : Colors[colorScheme].background }}
          theme={{
            backgroundColor: colorScheme === 'light' ? '#FFFFFF' : Colors[colorScheme].background,
            calendarBackground: colorScheme === 'light' ? '#FFFFFF' : Colors[colorScheme].background,
            textSectionTitleColor: Colors[colorScheme].text,
            selectedDayBackgroundColor: Colors[colorScheme].tint,
            selectedDayTextColor: '#FFFFFF',
            todayTextColor: Colors[colorScheme].tint,
            dayTextColor: Colors[colorScheme].text,
            textDisabledColor: Colors[colorScheme].mutedText,
            arrowColor: Colors[colorScheme].tint,
            monthTextColor: Colors[colorScheme].text,
            textDayFontWeight: '500',
            textMonthFontWeight: '800',
            textDayHeaderFontWeight: '600',
            // @ts-ignore - headerStyle not in TS types but supported by react-native-calendars
            'stylesheet.calendar.header': {
              header: {
                backgroundColor: colorScheme === 'light' ? '#FFFFFF' : Colors[colorScheme].background,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 10,
                paddingVertical: 10,
              },
            },
          }}
        />
      </View>

      {/* Games on Selected Date */}
      {selectedDate && (() => {
        const gamesOnDate = games.filter(g => {
          if (!g.date) return false;
          const gameDate = new Date(g.date);
          // Only show future events on selected date
          if (isNaN(gameDate.getTime()) || gameDate < new Date()) return false;
          return gameDate.toISOString().split('T')[0] === selectedDate;
        });
        
        if (gamesOnDate.length === 0) return null;

        return (
          <View style={[styles.selectedDateSection, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
            <Text style={[styles.selectedDateTitle, { color: Colors[colorScheme].text }]}>
              Events on {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
            {gamesOnDate.map((game) => {
              const labels = deriveTeamLabels(game);
              const time = game.date ? new Date(game.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'TBD';
              return (
                <Pressable
                  key={game.id}
                  style={[styles.dateGameCard, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border }]}
                  onPress={() => void router.push({ pathname: '/game/[id]', params: { id: String(game.id) } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${game.title || `${labels.teamA} vs ${labels.teamB}`} at ${time}`}
                >
                  <View style={styles.dateGameTime}>
                    <MaterialIcons name="access-time" size={16} color={Colors[colorScheme].tint} />
                    <Text style={[styles.dateGameTimeText, { color: Colors[colorScheme].tint }]}>{time}</Text>
                  </View>
                  <Text style={[styles.dateGameTitle, { color: Colors[colorScheme].text }]} numberOfLines={1}>
                    {game.title || `${labels.teamA} vs ${labels.teamB}`}
                  </Text>
                  {game.location && (
                    <View style={styles.dateGameLocation}>
                      <MaterialIcons name="location-on" size={14} color={Colors[colorScheme].mutedText} />
                      <Text style={[styles.dateGameLocationText, { color: Colors[colorScheme].mutedText }]} numberOfLines={1}>
                        {game.location}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        );
      })()}

      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Discover</Text>

      {/* Quick Actions Dashboard */}
      <View style={[styles.coachDashboard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
        <Text style={[styles.coachTitle, { color: Colors[colorScheme].text }]}>Quick Actions</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          {/* Role-based actions */}
          {me?.preferences?.role === 'coach' && (me as any)?.approval_status === 'APPROVED' ? (
            <>
              <Pressable
                style={[styles.coachActionCard, { backgroundColor: Colors[colorScheme].tint + '10', borderColor: Colors[colorScheme].tint + '30' }]}
                onPress={() => void router.push('/manage-teams')}
                accessibilityRole="button"
                accessibilityLabel="Manage Teams"
              >
                <MaterialIcons name="group" size={24} color={Colors[colorScheme].tint} />
                <Text style={[styles.coachActionTitle, { color: Colors[colorScheme].tint }]}>Manage Teams</Text>
                <Text style={[styles.coachActionDesc, { color: Colors[colorScheme].mutedText }]}>Create and manage your teams</Text>
              </Pressable>
              <Pressable
                style={[styles.coachActionCard, { backgroundColor: Colors[colorScheme].tint + '10', borderColor: Colors[colorScheme].tint + '30', marginLeft: 12 }]}
                onPress={() => void handleTeamSchedule()}
                accessibilityRole="button"
                accessibilityLabel="Team Schedule"
              >
                <MaterialIcons name="event" size={24} color={Colors[colorScheme].tint} />
                <Text style={[styles.coachActionTitle, { color: Colors[colorScheme].tint }]}>Team Schedule</Text>
                <Text style={[styles.coachActionDesc, { color: Colors[colorScheme].mutedText }]}>Manage games and season</Text>
              </Pressable>
              <Pressable
                style={[styles.coachActionCard, { backgroundColor: Colors[colorScheme].tint + '10', borderColor: Colors[colorScheme].tint + '30', marginLeft: 12 }]}
                onPress={() => void router.push('/event-approvals')}
                accessibilityRole="button"
                accessibilityLabel="Review pending event approvals"
              >
                <MaterialIcons name="done-all" size={24} color={Colors[colorScheme].tint} />
                <Text style={[styles.coachActionTitle, { color: Colors[colorScheme].tint }]}>Approvals</Text>
                <Text style={[styles.coachActionDesc, { color: Colors[colorScheme].mutedText }]}>Review pending events</Text>
              </Pressable>
              <Pressable
                style={[styles.coachActionCard, { backgroundColor: '#1E3A5F15', borderColor: '#1E3A5F30', marginLeft: 12 }]}
                onPress={() => void handleManageOrg()}
                accessibilityRole="button"
                accessibilityLabel="Manage your organization"
              >
                <MaterialIcons name="business" size={24} color="#1E3A5F" />
                <Text style={[styles.coachActionTitle, { color: '#1E3A5F' }]}>Manage Org</Text>
                <Text style={[styles.coachActionDesc, { color: Colors[colorScheme].mutedText }]}>Your organization</Text>
              </Pressable>
            </>
          ) : (
            <>
              {/* Organizer-only card (shown before fan actions for organizer role) */}
              {me?.preferences?.role === 'organizer' && (
                <Pressable
                  style={[styles.coachActionCard, { backgroundColor: '#1E3A5F15', borderColor: '#1E3A5F30' }]}
                  onPress={() => void handleManageOrg()}
                  accessibilityRole="button"
                  accessibilityLabel="Manage your organization"
                >
                  <MaterialIcons name="business" size={24} color="#1E3A5F" />
                  <Text style={[styles.coachActionTitle, { color: '#1E3A5F' }]}>Manage Org</Text>
                  <Text style={[styles.coachActionDesc, { color: Colors[colorScheme].mutedText }]}>Your organization</Text>
                </Pressable>
              )}
              {/* Fan actions */}
              <Pressable
                style={[styles.coachActionCard, { backgroundColor: Colors[colorScheme].tint + '10', borderColor: Colors[colorScheme].tint + '30', marginLeft: me?.preferences?.role === 'organizer' ? 12 : 0 }]}
                onPress={() => void router.push('/create-fan-event')}
                accessibilityRole="button"
                accessibilityLabel="Create a fan event"
              >
                <MaterialIcons name="group" size={24} color={Colors[colorScheme].tint} />
                <Text style={[styles.coachActionTitle, { color: Colors[colorScheme].tint }]}>Fan Event</Text>
                <Text style={[styles.coachActionDesc, { color: Colors[colorScheme].mutedText }]}>Watch parties & meetups</Text>
              </Pressable>
              <Pressable
                style={[styles.coachActionCard, { backgroundColor: Colors[colorScheme].tint + '10', borderColor: Colors[colorScheme].tint + '30', marginLeft: 12 }]}
                onPress={() => void router.push('/create-post')}
                accessibilityRole="button"
                accessibilityLabel="Share a moment"
              >
                <MaterialIcons name="camera-alt" size={24} color={Colors[colorScheme].tint} />
                <Text style={[styles.coachActionTitle, { color: Colors[colorScheme].tint }]}>Share Moment</Text>
                <Text style={[styles.coachActionDesc, { color: Colors[colorScheme].mutedText }]}>Post photos and videos</Text>
              </Pressable>
              <Pressable
                style={[styles.coachActionCard, { backgroundColor: Colors[colorScheme].tint + '10', borderColor: Colors[colorScheme].tint + '30', marginLeft: 12 }]}
                onPress={() => void router.push('/favorites')}
                accessibilityRole="button"
                accessibilityLabel="View saved posts"
              >
                <MaterialIcons name="bookmark" size={24} color={Colors[colorScheme].tint} />
                <Text style={[styles.coachActionTitle, { color: Colors[colorScheme].tint }]}>Saved Post</Text>
                <Text style={[styles.coachActionDesc, { color: Colors[colorScheme].mutedText }]}>Saved posts</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>

      {me && me._count?.following ? (
        <View style={[styles.followingCard, { backgroundColor: '#1e3a8a22', borderColor: '#1e3a8a55' }]}>
          <MaterialIcons name="group" size={18} color="#2563EB" />
          <Text style={[styles.followingText, { color: Colors[colorScheme].text }]}>{`Following ${me._count.following} people`}</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => void router.push(`/following?id=${me.id}&username=${me.display_name || me.username || 'You'}`)} style={styles.followingBtn} accessibilityRole="button" accessibilityLabel="Manage who you follow">
            <Text style={styles.followingBtnText}>Manage</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.followingCardMuted, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
          <MaterialIcons name="group" size={18} color={Colors[colorScheme].mutedText} />
          <Text style={[styles.followingMutedText, { color: Colors[colorScheme].mutedText }]}>Follow people to see their posts here.</Text>
        </View>
      )}

      {/* Segmented tabs for posts */}
      <View style={[styles.tabsWrap, { backgroundColor: Colors[colorScheme].border }]}>
        <Pressable onPress={() => setTab('discover')} style={[styles.tab, tab === 'discover' && [styles.tabOn, { backgroundColor: Colors[colorScheme].card }]]} accessibilityRole="tab" accessibilityLabel="Discover posts">
          <Text style={[styles.tabLabel, tab === 'discover' && styles.tabLabelOn, { color: Colors[colorScheme].text }]}>Discover</Text>
        </Pressable>
        <Pressable onPress={() => setTab('following')} style={[styles.tab, tab === 'following' && [styles.tabOn, { backgroundColor: Colors[colorScheme].card }]]} accessibilityRole="tab" accessibilityLabel="Posts from people you follow">
          <Text style={[styles.tabLabel, tab === 'following' && styles.tabLabelOn, { color: Colors[colorScheme].text }]}>Following</Text>
        </Pressable>
      </View>

      {personalizationNotice ? (
        <Text style={[styles.noticeText, { color: Colors[colorScheme].mutedText }]}>{personalizationNotice}</Text>
      ) : null}

      <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>{tab === 'following' ? 'From people you follow' : 'Discover new posts'}</Text>
      {(tab === 'following' ? followingPosts : discoverPosts).length === 0 ? (
        <Text style={[styles.mutedSmall, { color: Colors[colorScheme].mutedText }]}>{tab === 'following' ? 'Follow people to see their posts here.' : 'New posts will appear here soon.'}</Text>
      ) : (
        <View style={{ marginBottom: 12, gap: 10 }}>
          {(tab === 'following' ? followingPosts : discoverPosts).map((p, _i, _arr) => {
            const author = p?.author || null;
            const authorId = author?.id ? String(author.id) : null;
            return (
              <View key={String(p.id)}>
                <View style={styles.postHeaderRow}>
                  <Pressable
                    style={styles.postHeaderLeft}
                    onPress={() => {
                      if (!authorId) return;
                      // Navigate to the specific user's profile, not own profile
                      void router.push(`/user-profile?id=${authorId}`);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`View profile of ${author?.display_name || 'User'}`}
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
                        } catch {
                          // Revert on failure
                          setFollowingPosts((prev) => prev.map((item) => item.id === p.id ? { ...item, is_following_author: !nextVal } : item));
                          setDiscoverPosts((prev) => prev.map((item) => item.id === p.id ? { ...item, is_following_author: !nextVal } : item));
                        }
                      }}
                      style={[
                        styles.followBtn,
                        { backgroundColor: p.is_following_author ? Colors[colorScheme].border : Colors[colorScheme].tint }
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={p.is_following_author ? `Unfollow ${author?.display_name || 'user'}` : `Follow ${author?.display_name || 'user'}`}
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
                  onPress={() => {
                    const posts = tab === 'following' ? followingPosts : discoverPosts;
                    const postIds = posts.map((post: any) => String(post.id)).join(',');
                    const index = posts.findIndex((post: any) => String(post.id) === String(p.id));
                    void router.push(`/post-detail?id=${p.id}&postIds=${encodeURIComponent(postIds)}&index=${Math.max(0, index)}`);
                  }}
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
              <Pressable key={String(u.id)} style={styles.personTile} onPress={() => void router.push(`/user-profile?id=${u.id}`)} accessibilityRole="button" accessibilityLabel={`View profile of ${u.display_name || u.username || 'User'}`}>
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
  <SwipeBackContainer>
  <View style={[styles.container, { paddingTop: 12 + insets.top, backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen options={{ title: 'Discover', headerShown: false }} />
      <View style={{ alignItems: 'center', paddingHorizontal: 12, paddingBottom: 4 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: Colors[colorScheme].text, textAlign: 'center' }}>Discover</Text>
      </View>
      
      {viewMode === 'map' ? (
        /* Map View - Simplified without ListHeader */
        <View style={{ flex: 1 }}>
          {/* Just the search and toggle button */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <View style={{flexDirection: 'row', gap: 8, alignItems: 'center'}}>
              <View style={[styles.searchBox, { flex: 1, backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }] }>
                <MaterialIcons name="search" size={20} color={Colors[colorScheme].mutedText} />
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
                  // In map view branch, viewMode is 'map'; toggling goes to 'list'
                  const newMode: 'list' | 'map' = 'list';
                  setViewMode(newMode);
                }}
                style={[styles.viewToggle, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}
              >
                <MaterialIcons 
                  name={'list'} 
                  size={24} 
                  color={Colors[colorScheme].tint} 
                />
              </Pressable>
            </View>
          </View>

          {/* Full Map View */}
          {(() => {
            // Show ALL games, not just filtered ones
            const allGamesWithCoords = games.filter(g => typeof g.latitude === 'number' && typeof g.longitude === 'number');
            
            return (
              <EventMap
                events={allGamesWithCoords.map((game): EventMapData => ({
                  id: String(game.id),
                  title: String(game.title || 'Game'),
                  date: String(game.date || new Date().toISOString()),
                  location: String(game.location || ''),
                  latitude: Number(game.latitude as number),
                  longitude: Number(game.longitude as number),
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
              style={[styles.card, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}
              onPress={() => void router.push({ pathname: '/game/[id]', params: { id: String(item.id) } })}
            >
              <View style={[styles.hero, { backgroundColor: Colors[colorScheme].surface }]}>
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
                <Text style={[styles.cardTitle, { color: Colors[colorScheme].text }]}>{item.title ? String(item.title) : 'Game'}</Text>
                <Text style={[styles.cardMeta, { color: Colors[colorScheme].mutedText }]}>{item.location ? String(item.location) : 'TBD'}</Text>
                {(() => {
                  const labels = deriveTeamLabels(item);
                  return (
                    <View style={styles.teamRow}>
                      <View style={[styles.teamPill, { backgroundColor: colorScheme === 'dark' ? 'rgba(99,102,241,0.15)' : '#EEF2FF', borderColor: colorScheme === 'dark' ? 'rgba(99,102,241,0.3)' : '#C7D2FE' }]}><Text style={[styles.teamPillText, { color: colorScheme === 'dark' ? '#A5B4FC' : '#1E3A8A' }]}>{labels.teamA}</Text></View>
                      <Text style={[styles.vsText, { color: Colors[colorScheme].mutedText }]}>vs</Text>
                      <View style={[styles.teamPillAlt, { backgroundColor: colorScheme === 'dark' ? 'rgba(239,68,68,0.15)' : undefined, borderColor: colorScheme === 'dark' ? 'rgba(239,68,68,0.3)' : undefined }]}><Text style={[styles.teamPillAltText, { color: colorScheme === 'dark' ? '#FCA5A5' : undefined }]}>{labels.teamB}</Text></View>
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

      <QuickAddGameModal
        visible={createEventModalOpen}
        onClose={() => setCreateEventModalOpen(false)}
        onSave={handleQuickGameSave}
        currentTeamName={me?.team?.name}
        currentTeamId={me?.team?.id}
        userRole={((me?.preferences?.role === 'coach' || me?.role === 'coach') && (me as any)?.approval_status === 'APPROVED') || me?.preferences?.role === 'admin' || me?.role === 'admin' ? 'coach' : 'fan'}
      />
    </View>
  </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 28, fontWeight: '900', marginBottom: 8 },
  center: { paddingVertical: 24, alignItems: 'center' },
  helper: { color: '#6b7280', marginBottom: 10 },
  mutedSmall: { color: '#6b7280', marginBottom: 10, fontSize: 12 },
  noticeText: { fontSize: 13, marginBottom: 4 },
  sectionTitle: { fontWeight: '800', marginTop: 8 },
  error: { color: '#b91c1c', marginBottom: 8 },
  calendarSection: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    padding: 4,
  },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: 12, paddingHorizontal: 12, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth },
  searchInput: { flex: 1, height: 44 },
  viewToggle: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  precisionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  precisionBannerText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  precisionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  precisionActionLink: {
    fontSize: 13,
  },
  zipSuggestionList: { marginTop: 6, marginBottom: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  zipSuggestionItem: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  zipSuggestionZip: { fontWeight: '700', fontSize: 15 },
  zipSuggestionCount: { color: '#6b7280', fontSize: 12 },
  unifiedSearchResults: { marginTop: 6, marginBottom: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', maxHeight: 360 },
  searchSection: { paddingTop: 8 },
  searchSectionTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 12, paddingBottom: 6 },
  searchResultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  searchResultLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  searchResultAvatar: { width: 40, height: 40, borderRadius: 20 },
  searchResultName: { fontWeight: '700', fontSize: 15 },
  searchResultSub: { fontSize: 12, marginTop: 1 },
  searchFollowBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  searchFollowBtnText: { fontWeight: '800', fontSize: 13 },
  searchEmpty: { padding: 16, textAlign: 'center', fontSize: 14 },
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
  tabLabel: { fontWeight: '700' },
  tabLabelOn: {},
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
  personName: { marginTop: 6, fontSize: 12, maxWidth: 84 },
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
  // Section Tabs
  sectionTabBar: {
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  sectionTabContent: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  sectionTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  sectionTabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Selected Date Section
  selectedDateSection: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  selectedDateTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  dateGameCard: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  dateGameTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  dateGameTimeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dateGameTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  dateGameLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateGameLocationText: {
    fontSize: 12,
  },
});
