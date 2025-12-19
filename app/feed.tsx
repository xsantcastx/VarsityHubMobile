import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { Advertisement, Event, Game, Highlights, Notification as NotificationApi, User } from '@/api/entities';
import { BannerAd } from '@/components/BannerAd';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';

import GameVerticalFeedScreen from './game-details/GameVerticalFeedScreen';

type GameItem = { id: string; title?: string; date?: string; location?: string; cover_image_url?: string; banner_url?: string | null; event_id?: string | null };

// RSVP Badge Component
const RSVPBadge = ({ gameItem, onRSVPChange }: { gameItem: any, onRSVPChange?: () => void }) => {
  const colorScheme = useColorScheme();
  const [isRsvped, setIsRsvped] = useState(false);
  const [rsvpCount, setRsvpCount] = useState((gameItem as any).rsvpCount || 0);
  const [isLoading, setIsLoading] = useState(false);

  // Check initial RSVP status when component mounts
  useEffect(() => {
    if (gameItem.event_id) {
      Event.rsvpStatus(gameItem.event_id)
        .then((status: any) => {
          setIsRsvped(status.going || status.attending || false);
          setRsvpCount(status.count || 0);
        })
        .catch(() => {
          // Handle error silently, keep default states
        });
    }
  }, [gameItem.event_id]);

  const handleRSVP = async () => {
    if (isLoading || !gameItem.event_id) return;
    
    setIsLoading(true);
    try {
      const newRsvpState = !isRsvped;
      const response: any = await Event.rsvp(gameItem.event_id, newRsvpState);
      
      setIsRsvped(response.going || response.attending || false);
      setRsvpCount(response.count || 0);
      
      Alert.alert(
        newRsvpState ? 'RSVP Confirmed' : 'RSVP Removed',
        newRsvpState ? 'You are now attending this game!' : 'You are no longer attending this game.'
      );
      
      onRSVPChange?.();
    } catch (error) {
      console.error('RSVP error:', error);
      Alert.alert('Error', 'Failed to update RSVP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Pressable
      onPress={handleRSVP}
      style={{
        position: 'absolute',
        right: 14,
        bottom: 14,
        backgroundColor: isRsvped ? 'rgba(34, 197, 94, 0.9)' : (colorScheme === 'dark' ? 'rgba(30,41,59,0.85)' : 'rgba(0,0,0,0.75)'),
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        shadowColor: colorScheme === 'dark' ? '#000' : '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 1000,
        opacity: isLoading ? 0.6 : 1,
      }}
      accessibilityRole="button"
      accessibilityLabel={isRsvped ? `${rsvpCount} going - Tap to remove RSVP` : 'Tap to RSVP'}
    >
      <Text style={{
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
      }}>
        {isRsvped ? `${rsvpCount} going` : '+'}
      </Text>
    </Pressable>
  );
};

const deriveTeamLabels = (game: GameItem): { teamA: string; teamB: string } => {
  const title = typeof game.title === 'string' ? game.title : '';
  if (title) {
    const parts = title.split(/\s+vs\.?\s+/i).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return { teamA: parts[0], teamB: parts[1] };
    }
  }
  return { teamA: 'Team A', teamB: 'Team B' };
};

type VotePreviewEntry = {
  teamA: number;
  teamB: number;
  total: number;
  pctA: number;
  pctB: number;
  teamALabel: string;
  teamBLabel: string;
  teamALabelShort: string;
  teamBLabelShort: string;
};

const shortenLabel = (label: string) => {
  if (!label) return '';
  const firstWord = label.split(/\s+/)[0] || label;
  const trimmed = firstWord.trim();
  if (trimmed.length <= 10) return trimmed;
  return `${trimmed.slice(0, 9)}...`;
};

const buildVotePreviewEntry = (payload: any, labels: { teamA: string; teamB: string }): VotePreviewEntry => {
  const toNumber = (value: any) => (typeof value === 'number' ? value : 0);
  const teamA = Math.max(0, toNumber(payload?.teamA ?? payload?.team_a));
  const teamB = Math.max(0, toNumber(payload?.teamB ?? payload?.team_b));
  const total = teamA + teamB;
  const pctA = total ? Math.round((teamA / total) * 100) : 0;
  const pctB = total ? 100 - pctA : 0;
  const fullLabelA = payload?.teamALabel ?? payload?.team_a_label ?? labels.teamA;
  const fullLabelB = payload?.teamBLabel ?? payload?.team_b_label ?? labels.teamB;
  return {
    teamA,
    teamB,
    total,
    pctA,
    pctB,
    teamALabel: fullLabelA,
    teamBLabel: fullLabelB,
    teamALabelShort: shortenLabel(fullLabelA),
    teamBLabelShort: shortenLabel(fullLabelB),
  };
};


export default function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<GameItem[]>([]);
  const [gamesCursor, setGamesCursor] = useState<string | null>(null);
  const [hasMoreGames, setHasMoreGames] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [me, setMe] = useState<any>(null);
  const emailVerified = !!me?.email_verified;

  const [verticalFeedModalVisible, setVerticalFeedModalVisible] = useState(false);
  const [activeVerticalFeedGameId, setActiveVerticalFeedGameId] = useState<string | null>(null);

  const [highlightPreview, setHighlightPreview] = useState<any | null>(null);
  const [sponsoredAds, setSponsoredAds] = useState<any[]>([]);
  const voteSummariesRef = useRef<Record<string, VotePreviewEntry>>({});
  const [voteSummaries, setVoteSummaries] = useState<Record<string, VotePreviewEntry>>({});
  const [hasUnreadAlerts, setHasUnreadAlerts] = useState(false);
  const [notificationsMenuOpen, setNotificationsMenuOpen] = useState(false);
  
  // State for notifications in modal
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const preloadVoteSummaries = useCallback(async (gameList: GameItem[]) => {
    const candidates = gameList
      .map((game) => ({ id: String(game.id), labels: deriveTeamLabels(game) }))
      .filter((entry) => entry.id && !voteSummariesRef.current[entry.id]);
    if (!candidates.length) return;
    const limited = candidates.slice(0, 12);
    const results = await Promise.allSettled(limited.map((entry) => Game.votesSummary(entry.id)));
    const next = { ...voteSummariesRef.current };
    limited.forEach((entry, index) => {
      const result = results[index];
      if (result.status === 'fulfilled' && result.value) {
        try {
          next[entry.id] = buildVotePreviewEntry(result.value, entry.labels);
        } catch (err) {
          if (__DEV__) console.warn('Vote summary parse failed', err);
        }
      }
    });
    if (Object.keys(next).length !== Object.keys(voteSummariesRef.current).length) {
      voteSummariesRef.current = next;
      setVoteSummaries(next);
    }
  }, []);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      let user: any = null;
      try {
        user = await User.me();
        setMe(user);
      } catch (err) {
        if (__DEV__) console.warn('Feed load: unable to fetch user', err);
      }
      const countryCode = typeof user?.preferences?.country_code === 'string'
        ? String(user.preferences.country_code).toUpperCase()
        : undefined;
      const todayISO = new Date().toISOString().slice(0, 10);
      const [gamesData, highlightsData, forFeedAds] = await Promise.all([
        Game.list('-date'),
        Highlights.fetch(countryCode ? { country: countryCode, limit: 20 } : { limit: 20 }).catch((err) => {
          if (__DEV__) console.warn('Highlights preview load failed', err);
          return null;
        }),
        Advertisement.forFeed(todayISO, undefined, 5).catch(() => null),
      ]);
      
      // Handle cursor-based response or array
      let normalizedGames = [];
      let cursor = null;
      if (gamesData && typeof gamesData === 'object' && 'items' in gamesData) {
        normalizedGames = Array.isArray(gamesData.items) ? gamesData.items : [];
        cursor = gamesData.nextCursor || null;
      } else {
        normalizedGames = Array.isArray(gamesData) ? gamesData : [];
      }
      
      // If no games returned, inject sample events for Warriors, Duke, Patriots
      if (!normalizedGames || normalizedGames.length === 0) {
        const now = new Date();
        const addDays = (d: number) => new Date(now.getTime() + d * 86400000).toISOString();
        normalizedGames = [
          {
            id: 'sample-warriors-cavaliers',
            title: 'Golden State Warriors vs. Cleveland Cavaliers',
            date: addDays(2),
            location: 'Chase Center, San Francisco, CA 94158',
            cover_image_url: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=1280&auto=format&fit=crop',
          },
          {
            id: 'sample-duke-unc',
            title: 'Duke Blue Devils vs. North Carolina Tar Heels',
            date: addDays(5),
            location: 'Cameron Indoor Stadium, Durham, NC 27708',
            cover_image_url: 'https://images.unsplash.com/photo-1518655048521-f130df041f66?q=80&w=1280&auto=format&fit=crop',
          },
          {
            id: 'sample-patriots-jets',
            title: 'New England Patriots vs. New York Jets',
            date: addDays(7),
            location: 'Gillette Stadium, Foxborough, MA 02035',
            cover_image_url: 'https://images.unsplash.com/photo-1504457049873-30ffae0d3d31?q=80&w=1280&auto=format&fit=crop',
          },
        ];
      }
      setGames(normalizedGames);
      setGamesCursor(cursor);
      setHasMoreGames(!!cursor);
      if (highlightsData) {
        const merged: any[] = [];
        if (Array.isArray(highlightsData.nationalTop)) merged.push(...highlightsData.nationalTop);
        if (Array.isArray(highlightsData.ranked)) merged.push(...highlightsData.ranked);
        const firstWithMedia = merged.find((item) => typeof item?.media_url === 'string' && item.media_url);
        setHighlightPreview(firstWithMedia || null);
      } else {
        setHighlightPreview(null);
      }
      if (forFeedAds && Array.isArray((forFeedAds as any).ads)) {
        const list = ((forFeedAds as any).ads as any[]).filter((a) => !!a); // Allow ads with or without banners
        // Shuffle order for fairness
        for (let i = list.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [list[i], list[j]] = [list[j], list[i]];
        }
        setSponsoredAds(list);
      } else {
        setSponsoredAds([]);
      }
    } catch (e: any) {
      console.error('Failed to load feed', e);
      setError('Unable to load games. Sign in may be required.');
      setGames([]);
      setHighlightPreview(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const _loadMore = useCallback(async () => {
    if (loadingMore || !hasMoreGames || !gamesCursor) return;

    setLoadingMore(true);
    try {
      const nextData = await Game.list('-date');
      
      // Handle cursor-based response or array
      let normalizedGames = [];
      let cursor = null;
      if (nextData && typeof nextData === 'object' && 'items' in nextData) {
        normalizedGames = Array.isArray(nextData.items) ? nextData.items : [];
        cursor = nextData.nextCursor || null;
      } else {
        normalizedGames = Array.isArray(nextData) ? nextData : [];
      }

      setGames(prev => [...prev, ...normalizedGames]);
      setGamesCursor(cursor);
      setHasMoreGames(!!cursor);
    } catch (e: any) {
      console.error('Failed to load more games', e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMoreGames, gamesCursor]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  useEffect(() => {
    if (!games.length) return;
    void preloadVoteSummaries(games.slice(0, 12));
  }, [games, preloadVoteSummaries]);

  useFocusEffect(
    useCallback(() => {
      void load({ silent: true });
      // Check for unread notifications when feed gains focus
      void (async () => {
        try {
          const page = await NotificationApi.listPage(null, 1, true);
          setHasUnreadAlerts(Array.isArray(page.items) && page.items.length > 0);
        } catch {
          // ignore notification poll errors
        }
      })();
    }, [load]),
  );

  // Lightweight polling to keep unread dots fresh while on the Feed
  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      try {
        const page = await NotificationApi.listPage(null, 1, true);
        if (!mounted) return;
        setHasUnreadAlerts(Array.isArray(page.items) && page.items.length > 0);
      } catch {
        // ignore notification poll errors
      }
    };
    const id = setInterval(tick, 30000); // ~30s
    return () => { mounted = false; clearInterval(id); };
  }, []);

  // Load notifications when modal opens
  useEffect(() => {
    if (!notificationsMenuOpen) return;
    
    const loadModalData = async () => {
      setLoadingNotifications(true);
      try {
        const page = await NotificationApi.listPage(null, 20, false);
        setNotificationsList(Array.isArray(page.items) ? page.items : []);
      } catch (e) {
        console.error('Failed to load notifications', e);
      } finally {
        setLoadingNotifications(false);
      }
    };
    
    void loadModalData();
  }, [notificationsMenuOpen]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load({ silent: true });
    } finally {
      setRefreshing(false);
    }
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

  // Separate upcoming and past events
  const { upcomingEvents, pastEvents } = useMemo(() => {
    const now = new Date();
    const upcoming: GameItem[] = [];
    const past: GameItem[] = [];
    
    filtered.forEach((game) => {
      if (game.date) {
        const gameDate = new Date(game.date);
        if (gameDate >= now) {
          upcoming.push(game);
        } else {
          past.push(game);
        }
      } else {
        // Games without dates go to upcoming by default
        upcoming.push(game);
      }
    });
    
    return { upcomingEvents: upcoming, pastEvents: past };
  }, [filtered]);

  // Insert sponsored ads into upcoming events feed (Instagram-style)
  const upcomingWithAds = useMemo(() => {
    const result: Array<GameItem | { type: 'ad'; ad: any }> = [];
    const adInterval = 8; // Show ad every 8 events
    const hasAds = sponsoredAds && sponsoredAds.length > 0;
    
    // If no events exist, show promotional ad card alone
    if (upcomingEvents.length === 0) {
      result.push({ type: 'ad', ad: null });
      return result;
    }
    
    upcomingEvents.forEach((event, index) => {
      result.push(event);
      
      // Insert first ad AFTER the first event (index 0)
      if (index === 0) {
        if (hasAds) {
          const randomAdIndex = Math.floor(Math.random() * sponsoredAds.length);
          result.push({ type: 'ad', ad: sponsoredAds[randomAdIndex] });
        } else {
          result.push({ type: 'ad', ad: null });
        }
      }
      // Insert subsequent ads after every adInterval events (starting from the first interval)
      else if ((index + 1) % adInterval === 0) {
        if (hasAds) {
          // Pick a random ad from available ads
          const randomAdIndex = Math.floor(Math.random() * sponsoredAds.length);
          result.push({ type: 'ad', ad: sponsoredAds[randomAdIndex] });
        } else {
          // No ads available, show promotional card
          result.push({ type: 'ad', ad: null });
        }
      }
    });
    
    return result;
  }, [upcomingEvents, sponsoredAds]);

  const verticalFeedTitle = 'All Highlights';
  const verticalFeedPreviewImage = typeof highlightPreview?.media_url === 'string' ? highlightPreview.media_url : null;
  const verticalFeedSubtitleText = highlightPreview?.title
    ? `Featured: ${highlightPreview.title}`
    : 'Tap to watch top plays from every game.';
  const verticalFeedAuthorText = highlightPreview?.author?.display_name
    ? `By ${highlightPreview.author.display_name}`
    : null;

  const openInstagram = useCallback(async () => {
    const instagramUrl = 'https://instagram.com/varsityhub_';
    try {
      const canOpen = await Linking.canOpenURL(instagramUrl);
      if (canOpen) {
        await Linking.openURL(instagramUrl);
      } else {
        Alert.alert('Error', 'Unable to open Instagram. Please try again.');
      }
    } catch (error) {
      console.error('Error opening Instagram:', error);
      Alert.alert('Error', 'Failed to open Instagram link.');
    }
  }, []);

  const userCountryCode = typeof me?.preferences?.country_code === 'string'
    ? String(me.preferences.country_code).toUpperCase()
    : undefined;

  const openVerticalFeed = useCallback(() => {
    setActiveVerticalFeedGameId(null);
    setVerticalFeedModalVisible(true);
  }, []);

  const closeVerticalFeed = useCallback(() => {
    setVerticalFeedModalVisible(false);
    setActiveVerticalFeedGameId(null);
  }, []);

  const renderEmailReminder = useCallback(() => {
    if (!me || emailVerified) return null;
    return (
      <Pressable
        onPress={() => void router.push('/verify-email')}
        style={{
          padding: 10,
          borderRadius: 10,
          backgroundColor: Colors[colorScheme].surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: Colors[colorScheme].border,
          marginBottom: 12,
        }}
      >
        <Text style={{ color: Colors[colorScheme].text, fontWeight: '700' }}>
          Verify your email to unlock posting and ads. Tap to verify.
        </Text>
      </Pressable>
    );
  }, [emailVerified, me, router, colorScheme]);

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      {/* Navbar title intentionally swapped to show Feed in the stack and VarsityHub in the UI header */}
      <Stack.Screen options={{ title: 'Feed' }} />
      
      {/* Enhanced header with gradient background and safe area */}
      <LinearGradient
        colors={[Colors[colorScheme].card, Colors[colorScheme].background]}
        style={[styles.headerGradient, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          {/* Notifications on LEFT */}
          <View style={styles.headerActions}>
            <Pressable 
              onPress={() => setNotificationsMenuOpen(true)} 
              style={styles.iconButton} 
              accessibilityRole="button" 
              accessibilityLabel="Open notifications"
            >
              <View>
                <Ionicons name="notifications-outline" size={24} color={Colors[colorScheme].text} />
                {hasUnreadAlerts ? (
                  <View style={styles.alertDot} />
                ) : null}
              </View>
            </Pressable>
          </View>
          <View style={{ flex: 1 }} />
          <Pressable 
            style={styles.brandRow} 
            onPress={openInstagram}
            accessibilityRole="button"
            accessibilityLabel="Open VarsityHub Instagram"
          >
            <Image source={require('../assets/images/logo.svg')} style={styles.logoImage} />
            <Text style={[styles.brand, { color: Colors[colorScheme].text }]}>Varsity Hub</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          {/* Messages on RIGHT */}
          <View style={styles.headerActions}>
            <Pressable 
              onPress={() => void router.push('/messages')} 
              style={styles.iconButton} 
              accessibilityRole="button" 
              accessibilityLabel="Open messages"
            >
              <Ionicons name="chatbubbles-outline" size={24} color={Colors[colorScheme].text} />
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.contentContainer}>

      {error && (
        <View style={{ marginBottom: 8 }}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void router.push('/sign-in')} style={{ paddingVertical: 8 }}>
            <Text style={{ color: Colors[colorScheme].tint, fontWeight: '600' }}>Sign in to load personalized feed</Text>
          </Pressable>
        </View>
      )}
      {/* Maps Button - Navigate to nearby games/teams/events */}
      <Pressable 
        style={[styles.mapsButton, { backgroundColor: Colors[colorScheme].tint }]}
        onPress={async () => {
          // Get user's current location and navigate to game map view
          try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
              const location = await Location.getCurrentPositionAsync({});
              // Navigate to game map with current location
              router.push({
                pathname: '/game-map',
                params: { 
                  lat: location.coords.latitude.toString(),
                  lng: location.coords.longitude.toString()
                }
              });
            } else {
              // Still navigate to map, it will request permission there
              router.push('/game-map');
            }
          } catch (error) {
            console.error('Error getting location:', error);
            // Navigate anyway, map screen will handle location
            router.push('/game-map');
          }
        }}
        accessibilityRole="button"
        accessibilityLabel="View nearby games on map"
      >
        <Ionicons name="map" size={24} color={'white'} />
        <Text style={styles.mapsButtonText}>View Nearby Games on Map</Text>
        <Ionicons name="chevron-forward" size={20} color={'white'} />
      </Pressable>

      <Text style={[styles.helper, { color: Colors[colorScheme].mutedText }]}>Showing upcoming and recent games in your area.</Text>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      )}
      {!loading && upcomingEvents.length === 0 && pastEvents.length === 0 && !error && (
  <Text style={[styles.muted, { color: Colors[colorScheme].mutedText }]}>No games found.</Text>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingVertical: 12,
          paddingBottom: Math.max(28, insets.bottom + 16),
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors[colorScheme].tint}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderEmailReminder()}
        
        {/* Upcoming Events with Ads */}
        {upcomingWithAds.length > 0 && (
          <View style={{ gap: 20 }}>
            {upcomingWithAds.map((item, index) => {
              // Check if this is an ad
              if ('type' in item && item.type === 'ad') {
                const adData = item.ad;
                
                // If no ad data, show promotional card
                if (!adData) {
                  return (
                    <View key={`promo-${index}`} style={[
                      styles.sponsoredFeedCard,
                      {
                        backgroundColor: Colors[colorScheme].card,
                        borderColor: Colors[colorScheme].border,
                      }
                    ]}>
                      <Text style={[styles.sponsoredLabel, { color: Colors[colorScheme].mutedText }]}>
                        AD SPACE AVAILABLE
                      </Text>
                      <Pressable 
                        style={[
                          styles.promoPlaceholder,
                          {
                            backgroundColor: colorScheme === 'dark' ? '#111827' : '#F5F9FF',
                            borderColor: colorScheme === 'dark' ? '#1F2937' : '#C7DBFF',
                          }
                        ]}
                        onPress={() => void router.push('/submit-ad')}
                        accessibilityRole="button"
                      >
                        <View style={[
                          styles.promoIcon,
                          { borderColor: colorScheme === 'dark' ? '#60A5FA' : '#2563EB', justifyContent: 'center', alignItems: 'center' },
                        ]}>
                          <Ionicons name="image-outline" size={24} color={colorScheme === 'dark' ? '#60A5FA' : '#2563EB'} />
                        </View>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <Text style={[
                            styles.promoTitle,
                            { color: colorScheme === 'dark' ? '#BFDBFE' : '#1E3A8A' },
                          ]}>
                            Reserve Your Ad Space Now
                          </Text>
                          <Text style={[
                            styles.promoSubtitle,
                            { color: colorScheme === 'dark' ? '#94A3B8' : '#64748B' },
                          ]}>
                            Promote your program, fundraiser, or business to local fans.
                          </Text>
                        </View>
                        <View style={[
                          styles.promoteCtaBanner,
                          { backgroundColor: colorScheme === 'dark' ? '#2563EB' : '#2563EB' },
                        ]}>
                          <View style={[
                            styles.promoteCtaIcon,
                            { borderColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
                          ]}>
                            <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
                          </View>
                          <Text style={styles.promoteCtaText}>Click Here</Text>
                        </View>
                      </Pressable>
                    </View>
                  );
                }
                
                // Otherwise show actual ad
                return (
                  <View key={`ad-${index}`} style={[
                    styles.sponsoredFeedCard,
                    {
                      backgroundColor: Colors[colorScheme].card,
                      borderColor: Colors[colorScheme].border,
                    }
                  ]}>
                    <Text style={[styles.sponsoredLabel, { color: Colors[colorScheme].mutedText }]}>
                      SPONSORED
                    </Text>
                    {adData.banner_url ? (
                      <BannerAd
                        bannerUrl={adData.banner_url}
                        fitMode={adData.banner_fit_mode || 'fill'}
                        targetUrl={adData.target_url}
                        businessName={adData.business_name}
                        description={adData.description}
                        aspectRatio={3.5}
                      />
                    ) : (
                      <View style={[styles.adPlaceholder, { backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#F3F4F6' }]}>
                        <Ionicons name="megaphone-outline" size={48} color={colorScheme === 'dark' ? '#64748B' : '#9CA3AF'} />
                      </View>
                    )}
                    <View style={styles.adInfo}>
                      <Text style={[styles.adBusinessName, { color: Colors[colorScheme].text }]} numberOfLines={1}>
                        {adData.business_name || 'Local Sponsor'}
                      </Text>
                      {adData.description ? (
                        <Text style={[styles.adDescription, { color: Colors[colorScheme].mutedText }]} numberOfLines={2}>
                          {String(adData.description)}
                        </Text>
                      ) : null}
                      {/* Promote your program CTA */}
                      <Pressable
                        style={styles.promoteCta}
                        onPress={() => void router.push('/submit-ad')}
                        accessibilityRole="button"
                      >
                        <Ionicons name="megaphone-outline" size={16} color="#ffffff" />
                        <Text style={styles.promoteCtaText}>Promote your program</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }

              // Otherwise it's a regular event
              const gameItem = item as GameItem;
              const raw = gameItem as any;
              const banner = gameItem.cover_image_url || raw?.banner_url || null;
              const hasBanner = typeof banner === 'string' && banner.length > 0;
              const gradient: [string, string] = index % 2 === 0 ? ['#1e293b', '#0f172a'] : ['#0f172a', '#1e293b'];
              const eventDate = gameItem.date ? format(new Date(gameItem.date), 'MMM d') : 'TBD';
              const eventTime = gameItem.date ? format(new Date(gameItem.date), 'h:mm a') : '';
              const locationText = gameItem.location ? String(gameItem.location).split(',')[0] : 'Location TBD';
              const reviewsCount =
                typeof raw?.reviews_count === 'number'
                  ? raw.reviews_count
                  : Array.isArray(raw?.reviews)
                    ? raw.reviews.length
                    : raw?._count && typeof raw._count.reviews === 'number'
                      ? raw._count.reviews
                      : 0;
              const mediaCount =
                typeof raw?.media_count === 'number'
                  ? raw.media_count
                  : Array.isArray(raw?.media)
                    ? raw.media.length
                    : 0;
              const summary = voteSummaries[String(gameItem.id)] || null;
              const voteText = summary
                ? `${summary.teamALabelShort} ${summary.pctA}% | ${summary.teamBLabelShort} ${summary.pctB}%`
                : null;

              return (
                <Pressable
                  key={String(gameItem.id)}
                  style={styles.singleEventCard}
                  onPress={() => void router.push({ pathname: '/(tabs)/feed/game/[id]', params: { id: String(gameItem.id) } })}
                  accessibilityRole="button"
                >
                  {hasBanner ? (
                    <Image source={{ uri: banner }} style={styles.singleEventImage} contentFit="cover" />
                  ) : (
                    <LinearGradient colors={gradient} style={styles.singleEventImage} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                  )}
                  <LinearGradient
                    colors={colorScheme === 'dark' ? ['rgba(15,23,42,0.1)', 'rgba(15,23,42,0.9)'] : ['rgba(15,23,42,0.05)', 'rgba(15,23,42,0.85)']}
                    style={styles.gridShade}
                    pointerEvents="none"
                  />
                  <View style={styles.gridContent}>
                    <View style={styles.gridDateChip}>
                      <Ionicons name="calendar-outline" size={12} color="#FFFFFF" />
                      <Text style={styles.gridDateText}>{eventDate}</Text>
                    </View>
                    <Text style={styles.gridTitle} numberOfLines={2}>
                      {gameItem.title ? String(gameItem.title) : 'Game'}
                    </Text>
                    <Text style={styles.gridMeta} numberOfLines={1}>
                      {eventTime ? `${eventTime} • ${locationText}` : locationText}
                    </Text>
                    <View style={styles.gridStatsRow}>
                      <View style={styles.gridStat}>
                        <Ionicons name="chatbubble-ellipses-outline" size={12} color="#F9FAFB" />
                        <Text style={styles.gridStatText}>{reviewsCount}</Text>
                      </View>
                      <View style={styles.gridStat}>
                        <Ionicons name="image-outline" size={12} color="#F9FAFB" />
                        <Text style={styles.gridStatText}>{mediaCount}</Text>
                      </View>
                    </View>
                    {voteText ? (
                      <Text style={styles.gridVoteText} numberOfLines={1}>
                        {voteText}
                      </Text>
                    ) : null}
                  </View>
                  <RSVPBadge gameItem={gameItem} onRSVPChange={onRefresh} />
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Past Events Section */}
        {pastEvents.length > 0 && (
          <View style={{ marginTop: 32 }}>
            <Text style={[styles.sectionHeader, { color: Colors[colorScheme].mutedText }]}>
              Past Events
            </Text>
            <View style={{ gap: 20, marginTop: 12 }}>
              {pastEvents.map((item, index) => {
                const raw = item as any;
                const banner = item.cover_image_url || raw?.banner_url || null;
                const hasBanner = typeof banner === 'string' && banner.length > 0;
                const gradient: [string, string] = index % 2 === 0 ? ['#1e293b', '#0f172a'] : ['#0f172a', '#1e293b'];
                const eventDate = item.date ? format(new Date(item.date), 'MMM d') : 'TBD';
                const eventTime = item.date ? format(new Date(item.date), 'h:mm a') : '';
                const locationText = item.location ? String(item.location).split(',')[0] : 'Location TBD';
                const reviewsCount =
                  typeof raw?.reviews_count === 'number'
                    ? raw.reviews_count
                    : Array.isArray(raw?.reviews)
                      ? raw.reviews.length
                      : raw?._count && typeof raw._count.reviews === 'number'
                        ? raw._count.reviews
                        : 0;
                const mediaCount =
                  typeof raw?.media_count === 'number'
                    ? raw.media_count
                    : Array.isArray(raw?.media)
                      ? raw.media.length
                      : 0;
                const summary = voteSummaries[String(item.id)] || null;
                const voteText = summary
                  ? `${summary.teamALabelShort} ${summary.pctA}% | ${summary.teamBLabelShort} ${summary.pctB}%`
                  : null;

                return (
                  <Pressable
                    key={String(item.id)}
                    style={styles.singleEventCard}
                    onPress={() => void router.push({ pathname: '/(tabs)/feed/game/[id]', params: { id: String(item.id) } })}
                    accessibilityRole="button"
                  >
                    {hasBanner ? (
                      <Image source={{ uri: banner }} style={styles.singleEventImage} contentFit="cover" />
                    ) : (
                      <LinearGradient colors={gradient} style={styles.singleEventImage} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                    )}
                    <LinearGradient
                      colors={colorScheme === 'dark' ? ['rgba(15,23,42,0.1)', 'rgba(15,23,42,0.9)'] : ['rgba(15,23,42,0.05)', 'rgba(15,23,42,0.85)']}
                      style={styles.gridShade}
                      pointerEvents="none"
                    />
                    <View style={styles.gridContent}>
                      <View style={styles.gridDateChip}>
                        <Ionicons name="calendar-outline" size={12} color="#FFFFFF" />
                        <Text style={styles.gridDateText}>{eventDate}</Text>
                      </View>
                      <Text style={styles.gridTitle} numberOfLines={2}>
                        {item.title ? String(item.title) : 'Game'}
                      </Text>
                      <Text style={styles.gridMeta} numberOfLines={1}>
                        {eventTime ? `${eventTime} • ${locationText}` : locationText}
                      </Text>
                      <View style={styles.gridStatsRow}>
                        <View style={styles.gridStat}>
                          <Ionicons name="chatbubble-ellipses-outline" size={12} color="#F9FAFB" />
                          <Text style={styles.gridStatText}>{reviewsCount}</Text>
                        </View>
                        <View style={styles.gridStat}>
                          <Ionicons name="image-outline" size={12} color="#F9FAFB" />
                          <Text style={styles.gridStatText}>{mediaCount}</Text>
                        </View>
                      </View>
                      {voteText ? (
                        <Text style={styles.gridVoteText} numberOfLines={1}>
                          {voteText}
                        </Text>
                      ) : null}
                    </View>
                    <RSVPBadge gameItem={item} onRSVPChange={onRefresh} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        
        {/* Footer Content */}
        <View style={styles.gridFooter}>
          {/* Removed static sponsored card - ads now appear in feed */}

          <View style={styles.verticalFeedSection}>
            <Text style={styles.sectionTitle}>{verticalFeedTitle}</Text>
            <Pressable
              onPress={openVerticalFeed}
              style={styles.verticalFeedCard}
              accessibilityRole="button"
              accessibilityLabel="Open highlights reel"
            >
              {verticalFeedPreviewImage ? (
                <Image source={{ uri: verticalFeedPreviewImage }} style={styles.verticalFeedImage} contentFit="cover" />
              ) : (
                <LinearGradient
                  colors={colorScheme === 'dark' ? ['#1e293b', '#0f172a'] : ['#1e293b', '#0f172a']}
                  style={styles.verticalFeedImage}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              )}
              <LinearGradient
                colors={colorScheme === 'dark' ? ['rgba(15,23,42,0.2)', 'rgba(15,23,42,0.9)'] : ['rgba(15,23,42,0.1)', 'rgba(15,23,42,0.85)']}
                style={styles.verticalFeedShade}
              />
              <View style={styles.verticalFeedContent}>
                <View style={styles.verticalFeedBadge}>
                  <Ionicons name="play" size={18} color="#fff" />
                </View>
                <Text style={styles.verticalFeedTitleText}>Watch Highlights</Text>
                {verticalFeedAuthorText ? (
                  <Text style={styles.verticalFeedCaption} numberOfLines={1}>{verticalFeedAuthorText}</Text>
                ) : null}
                <Text style={styles.verticalFeedSubtitle} numberOfLines={2}>
                  {verticalFeedSubtitleText}
                </Text>
              </View>
            </Pressable>
          </View>

          {loadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={Colors[colorScheme].tint} />
            </View>
          ) : null}
        </View>
      </ScrollView>
      </View>

      {/* Notifications & Messages Menu Modal */}
      <Modal
        visible={notificationsMenuOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setNotificationsMenuOpen(false)}
      >
        <View style={[styles.menuModal, { backgroundColor: Colors[colorScheme].background, paddingTop: insets.top }]}>
          {/* Header */}
          <View style={[styles.menuHeader, { borderBottomColor: Colors[colorScheme].border }]}>
            <Text style={[styles.menuTitle, { color: Colors[colorScheme].text }]}>Updates</Text>
            <Pressable onPress={() => setNotificationsMenuOpen(false)} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={Colors[colorScheme].text} />
            </Pressable>
          </View>

          {/* No tabs needed - only showing notifications */}

          {/* Content */}
          <View style={{ flex: 1 }}>
            {loadingNotifications ? (
              <View style={styles.center}><ActivityIndicator /></View>
            ) : notificationsList.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Ionicons name="notifications-off-outline" size={48} color={Colors[colorScheme].mutedText} />
                <Text style={[styles.emptyText, { color: Colors[colorScheme].mutedText }]}>No notifications</Text>
              </View>
            ) : (
              <FlatList
                    data={notificationsList}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => {
                      const title = item.type === 'FOLLOW'
                        ? `${item.actor?.display_name || 'Someone'} followed you`
                        : item.type === 'UPVOTE'
                        ? `${item.actor?.display_name || 'Someone'} upvoted your post`
                        : item.type === 'COMMENT'
                        ? `${item.actor?.display_name || 'Someone'} commented on your post`
                        : item.type === 'TEAM_INVITE'
                        ? `${item.actor?.display_name || 'Someone'} invited you to join ${item.meta?.team_name || 'a team'}`
                        : 'Notification';
                      
                      return (
                        <Pressable 
                          style={[styles.listRow, !item.read_at && styles.listRowUnread, { borderBottomColor: Colors[colorScheme].border }]}
                          onPress={async () => {
                            // Mark notification as read
                            if (!item.read_at) {
                              try {
                                await NotificationApi.markRead(item.id);
                                // Update local state to remove unread indicator immediately
                                setNotificationsList(prev => 
                                  prev.map(n => n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)
                                );
                                // Refresh unread count
                                const page = await NotificationApi.listPage(null, 1, true);
                                setHasUnreadAlerts(Array.isArray(page.items) && page.items.length > 0);
                              } catch (e) {
                                console.error('Failed to mark notification as read', e);
                              }
                            }
                            
                            setNotificationsMenuOpen(false);
                            // Always navigate to the actor's profile if available
                            if (item.actor?.id) {
                              router.push(`/user-profile?id=${encodeURIComponent(item.actor.id)}`);
                            } else if (item.type === 'TEAM_INVITE') {
                              router.push('/team-invites');
                            }
                          }}
                        >
                          <View style={styles.listAvatarWrap}>
                            {item.actor?.avatar_url ? (
                              <Image source={{ uri: item.actor.avatar_url }} style={styles.listAvatar} />
                            ) : (
                              <View style={[styles.listAvatar, { backgroundColor: Colors[colorScheme].border }]} />
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.listTitle, { color: Colors[colorScheme].text }]}>{title}</Text>
                            {item.post?.content && (
                              <Text numberOfLines={1} style={[styles.listSubtitle, { color: Colors[colorScheme].mutedText }]}>
                                {item.post.content}
                              </Text>
                            )}
                          </View>
                          {!item.read_at && <View style={styles.unreadDot} />}
                        </Pressable>
                      );
                    }}
                  />
                )}
              </View>
        </View>
      </Modal>

      <Modal
        visible={verticalFeedModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeVerticalFeed}
      >
  <View style={[styles.verticalFeedModal, { backgroundColor: Colors[colorScheme].background }]}>
          {verticalFeedModalVisible ? (
            <GameVerticalFeedScreen
              key={activeVerticalFeedGameId || 'all-highlights'}
              gameId={activeVerticalFeedGameId}
              onClose={closeVerticalFeed}
              countryCode={userCountryCode}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  contentContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  logoImage: { width: 36, height: 36, borderRadius: 8 },
  headerActions: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  iconButton: { padding: 8, borderRadius: 8 },
  center: { paddingVertical: 24, alignItems: 'center' },
  error: { color: '#b91c1c', marginBottom: 8 },
  muted: { fontSize: 14 },
  helper: { fontSize: 14, marginBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#F3F4F6', marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, height: 44 },
  mapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 56,
    borderRadius: 12,
    paddingHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  gridRow: { gap: 6, paddingHorizontal: 4, marginBottom: 6 },
  masonryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  masonryItem: {
    width: '49%',
    margin: '0.5%',
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0f172a',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  singleEventCard: {
    width: '100%',
    aspectRatio: 4/5, // More Instagram-like (taller, similar to 4:5 Instagram posts)
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0f172a',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  singleEventImage: { width: '100%', height: '100%' },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Sponsored ad styles for feed
  sponsoredFeedCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sponsoredLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  adPlaceholder: {
    width: '100%',
    aspectRatio: 3.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoPlaceholder: {
    width: '100%',
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'solid',
  },
  promoIcon: {
    width: 40,
    height: 40,
    borderWidth: 2,
    borderRadius: 10,
    flexShrink: 0,
  },
  promoTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  promoSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  promoteCtaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 100,
    flexShrink: 0,
  },
  promoteCtaIcon: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderRadius: 3,
  },
  adInfo: {
    padding: 16,
    gap: 6,
  },
  adBusinessName: {
    fontSize: 16,
    fontWeight: '700',
  },
  adDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  promoteCta: {
    marginTop: 12,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
  promoteCtaText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  gridItem: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0f172a',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  gridImage: { width: '100%', height: '100%' },
  gridShade: { ...StyleSheet.absoluteFillObject },
  gridContent: { position: 'absolute', left: 12, right: 12, bottom: 12, gap: 6 },
  gridDateChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.65)',
  },
  gridDateText: { color: '#F9FAFB', fontWeight: '700', fontSize: 12 },
  gridTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, lineHeight: 18 },
  gridMeta: { color: '#E5E7EB', fontSize: 12 },
  gridStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gridStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gridStatText: { color: '#F9FAFB', fontSize: 11, fontWeight: '600' },
  gridVoteText: { color: '#E0F2FE', fontSize: 11, fontWeight: '600' },
  gridFooter: { width: '100%', marginTop: 12, gap: 24, paddingHorizontal: 8 },
  sponsoredGridCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  sponsoredGridLabel: { color: '#6b7280', fontWeight: '800', fontSize: 11, letterSpacing: 1.2 },
  sponsoredGridImageWrapper: { height: 140, borderRadius: 14, overflow: 'hidden' },
  sponsoredGridImage: { width: '100%', height: '100%' },
  sponsoredGridTitle: { fontWeight: '800', fontSize: 16 },
  sponsoredGridDescription: { fontSize: 13, lineHeight: 18 },
  sponsoredGridCta: {
    marginTop: 4,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
  sponsoredGridCtaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  adInviteCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 6,
  },
  adInviteTitle: { fontWeight: '800', fontSize: 18, textTransform: 'uppercase', letterSpacing: 0.8 },
  adInviteSubtitle: { fontSize: 13, lineHeight: 18 },
  loadingMore: { paddingVertical: 16, alignItems: 'center' },
  sectionTitle: { fontWeight: '800', marginBottom: 8 },
  zipSuggestionList: { marginTop: 6, marginBottom: 8, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E2E8F0', overflow: 'hidden', shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  zipSuggestionItem: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  zipSuggestionZip: { fontWeight: '700', color: '#111827', fontSize: 15 },
  zipSuggestionCount: { color: '#6b7280', fontSize: 12 },
  verticalFeedSection: { marginTop: 32, marginBottom: 24 },
  verticalFeedCard: { marginTop: 12, borderRadius: 20, overflow: 'hidden', backgroundColor: '#0f172a', minHeight: 220, aspectRatio: 1, justifyContent: 'flex-end' },
  verticalFeedImage: { ...StyleSheet.absoluteFillObject },
  verticalFeedShade: { ...StyleSheet.absoluteFillObject },
  verticalFeedContent: { position: 'absolute', left: 20, right: 20, bottom: 20, gap: 8 },
  verticalFeedBadge: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(37,99,235,0.95)', shadowColor: '#0f172a', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  verticalFeedTitleText: { color: '#ffffff', fontWeight: '800', fontSize: 20 },
  verticalFeedCaption: { color: '#bfdbfe', fontWeight: '600', fontSize: 12 },
  verticalFeedSubtitle: { color: '#cbd5f5', fontWeight: '600', fontSize: 13 },
  verticalFeedModal: { flex: 1, backgroundColor: '#020617' },
  alertDot: { position: 'absolute', right: -1, top: -1, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.dark.danger },
  // Menu Modal Styles
  menuModal: { 
    flex: 1,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  menuTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  menuTabActive: {
    borderBottomColor: '#2563EB',
  },
  menuTabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  menuTabBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.danger,
    marginLeft: 4,
  },
  menuContent: {
    flex: 1,
    padding: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.05)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  menuItemSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  // List items for notifications and messages
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listRowUnread: {
    backgroundColor: 'rgba(37, 99, 235, 0.03)',
  },
  listAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  listAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  listSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
