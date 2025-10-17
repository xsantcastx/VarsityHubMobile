import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { Advertisement, Event, Game, Highlights, Message, Notification as NotificationApi, User } from '@/api/entities';
import { BannerAd } from '@/components/BannerAd';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import GameVerticalFeedScreen from './game-details/GameVerticalFeedScreen';

type GameItem = { id: string; title?: string; date?: string; location?: string; cover_image_url?: string; banner_url?: string | null; event_id?: string | null };

type ZipDirectoryEntry = { zip: string; count: number };

const ZIP_REGEX = /\b\d{5}\b/g;

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
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [me, setMe] = useState<any>(null);
  const emailVerified = !!me?.email_verified;

  const [verticalFeedModalVisible, setVerticalFeedModalVisible] = useState(false);
  const [activeVerticalFeedGameId, setActiveVerticalFeedGameId] = useState<string | null>(null);

  const [zipDirectory, setZipDirectory] = useState<ZipDirectoryEntry[]>([]);
  const [zipSuggestionsOpen, setZipSuggestionsOpen] = useState(false);
  const [highlightPreview, setHighlightPreview] = useState<any | null>(null);
  const [sponsoredAds, setSponsoredAds] = useState<any[]>([]);
  const [sponsoredIndex, setSponsoredIndex] = useState(0);
  const voteSummariesRef = useRef<Record<string, VotePreviewEntry>>({});
  const [voteSummaries, setVoteSummaries] = useState<Record<string, VotePreviewEntry>>({});
  const [hasUnreadAlerts, setHasUnreadAlerts] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [notificationsMenuOpen, setNotificationsMenuOpen] = useState(false);
  const [activeMenuTab, setActiveMenuTab] = useState<'notifications' | 'messages'>('notifications');
  
  // State for notifications and messages in modal
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [messagesList, setMessagesList] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

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
      
      setGames(normalizedGames);
      setGamesCursor(cursor);
      setHasMoreGames(!!cursor);
      setZipDirectory(buildZipDirectory(normalizedGames));
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
        setSponsoredIndex(0);
      } else {
        setSponsoredAds([]);
        setSponsoredIndex(0);
      }
    } catch (e: any) {
      console.error('Failed to load feed', e);
      setError('Unable to load games. Sign in may be required.');
      setGames([]);
      setZipDirectory([]);
      setHighlightPreview(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
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
      setZipDirectory(prev => [...prev, ...buildZipDirectory(normalizedGames)]);
    } catch (e: any) {
      console.error('Failed to load more games', e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMoreGames, gamesCursor]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  useEffect(() => {
    if (!games.length) return;
    preloadVoteSummaries(games.slice(0, 12));
  }, [games, preloadVoteSummaries]);

  useFocusEffect(
    useCallback(() => {
      load({ silent: true });
      // Check for unread notifications when feed gains focus
      (async () => {
        try {
          const page = await NotificationApi.listPage(null, 1, true);
          setHasUnreadAlerts(Array.isArray(page.items) && page.items.length > 0);
        } catch {}
      })();
      // Check for unread messages when feed gains focus
      (async () => {
        try {
          const result = await (Message.list ? Message.list('-created_at', 50) : Message.filter({}, '-created_at'));
          if (result && !('_isNotModified' in result)) {
            const msgs = Array.isArray(result) ? result : [];
            const user = await User.me();
            // Count unread messages (messages where I'm the recipient and read is false)
            const unreadCount = msgs.filter((msg: any) => {
              return msg.recipient_id === user.id && !msg.read;
            }).length;
            setHasUnreadMessages(unreadCount > 0);
          }
        } catch {}
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
        
        // Also check messages
        const result = await (Message.list ? Message.list('-created_at', 50) : Message.filter({}, '-created_at'));
        if (result && !('_isNotModified' in result)) {
          const msgs = Array.isArray(result) ? result : [];
          const user = await User.me();
          const unreadCount = msgs.filter((msg: any) => {
            return msg.recipient_id === user.id && !msg.read;
          }).length;
          setHasUnreadMessages(unreadCount > 0);
        }
      } catch {}
    };
    const id = setInterval(tick, 30000); // ~30s
    return () => { mounted = false; clearInterval(id); };
  }, []);

  // Load notifications and messages when modal opens OR when tab changes
  useEffect(() => {
    if (!notificationsMenuOpen) {
      // When modal closes, refresh unread counts
      (async () => {
        try {
          const result = await (Message.list ? Message.list('-created_at', 50) : Message.filter({}, '-created_at'));
          if (result && !('_isNotModified' in result)) {
            const msgs = Array.isArray(result) ? result : [];
            const user = await User.me();
            const unreadCount = msgs.filter((msg: any) => {
              return msg.recipient_id === user.id && !msg.read;
            }).length;
            setHasUnreadMessages(unreadCount > 0);
          }
        } catch {}
      })();
      return;
    }
    
    const loadModalData = async () => {
      if (activeMenuTab === 'notifications') {
        setLoadingNotifications(true);
        try {
          const page = await NotificationApi.listPage(null, 20, false);
          setNotificationsList(Array.isArray(page.items) ? page.items : []);
        } catch (e) {
          console.error('Failed to load notifications', e);
        } finally {
          setLoadingNotifications(false);
        }
      } else {
        setLoadingMessages(true);
        try {
          const result = await (Message.list
            ? Message.list('-created_at', 20)
            : Message.filter({}, '-created_at'));
          setMessagesList(Array.isArray(result) && !('_isNotModified' in result) ? result : []);
          
          // Also update unread count
          if (result && !('_isNotModified' in result)) {
            const msgs = Array.isArray(result) ? result : [];
            const user = await User.me();
            const unreadCount = msgs.filter((msg: any) => {
              return msg.recipient_id === user.id && !msg.read;
            }).length;
            setHasUnreadMessages(unreadCount > 0);
          }
        } catch (e) {
          console.error('Failed to load messages', e);
        } finally {
          setLoadingMessages(false);
        }
      }
    };
    
    loadModalData();
  }, [notificationsMenuOpen, activeMenuTab]);

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
    const adInterval = 8; // Show ad every 8 events (reduced frequency)
    const hasAds = sponsoredAds && sponsoredAds.length > 0;
    
    // If no events exist, show promotional ad card alone
    if (upcomingEvents.length === 0) {
      result.push({ type: 'ad', ad: null });
      return result;
    }
    
    // Always add a promotional card at the start if we have events
    if (hasAds) {
      const randomAdIndex = Math.floor(Math.random() * sponsoredAds.length);
      result.push({ type: 'ad', ad: sponsoredAds[randomAdIndex] });
    } else {
      result.push({ type: 'ad', ad: null });
    }
    
    upcomingEvents.forEach((event, index) => {
      result.push(event);
      
      // Insert ad or promotional card after every adInterval events (starting from the first interval)
      if ((index + 1) % adInterval === 0) {
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

  const zipSuggestions = useMemo(() => {
    if (!zipSuggestionsOpen) return [] as ZipDirectoryEntry[];
    const digits = query.replace(/[^0-9]/g, '');
    if (digits.length < 2) return [] as ZipDirectoryEntry[];
    return zipDirectory
      .filter((entry) => entry.zip.startsWith(digits))
      .slice(0, 6);
  }, [zipSuggestionsOpen, query, zipDirectory]);

  const shouldShowZipSuggestions = zipSuggestionsOpen && zipSuggestions.length > 0;

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    const digits = value.replace(/[^0-9]/g, '');
    setZipSuggestionsOpen(digits.length >= 2);
  }, []);

  const handleZipSelect = useCallback((zip: string) => {
    setQuery(zip);
    setZipSuggestionsOpen(false);
    Keyboard.dismiss();
  }, []);

  const handleSearchFocus = useCallback(() => {
    const digits = query.replace(/[^0-9]/g, '');
    setZipSuggestionsOpen(digits.length >= 2);
  }, [query]);

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
        onPress={() => router.push('/verify-email')}
        style={{
          padding: 10,
          borderRadius: 10,
          backgroundColor: '#FEF9C3',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: '#FDE68A',
          marginBottom: 12,
        }}
      >
        <Text style={{ color: '#92400E', fontWeight: '700' }}>
          Verify your email to unlock posting and ads. Tap to verify.
        </Text>
      </Pressable>
    );
  }, [emailVerified, me, router]);

  const renderGameTile = useCallback(
    ({ item, index }: { item: GameItem; index: number }) => {
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
          : typeof raw?._count?.reviews === 'number'
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
          style={styles.gridItem}
          onPress={() => router.push({ pathname: '/(tabs)/feed/game/[id]', params: { id: String(item.id) } })}
          accessibilityRole="button"
        >
          {hasBanner ? (
            <Image source={{ uri: banner }} style={styles.gridImage} contentFit="cover" />
          ) : (
            <LinearGradient colors={gradient} style={styles.gridImage} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
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
    },
    [onRefresh, router, voteSummaries],
  );

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      {/* Navbar title intentionally swapped to show Feed in the stack and VarsityHub in the UI header */}
      <Stack.Screen options={{ title: 'Feed' }} />
      
      {/* Enhanced header with gradient background and safe area */}
      <LinearGradient
        colors={colorScheme === 'dark' ? ['#1e293b', '#0f172a'] : ['#ffffff', '#f8fafc']}
        style={[styles.headerGradient, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }} />
          <View style={styles.brandRow}>
            <Image source={require('../assets/images/logo.png')} style={styles.logoImage} />
            <Text style={[styles.brand, { color: Colors[colorScheme].text }]}>Varsity Hub</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable 
              onPress={() => setNotificationsMenuOpen(true)} 
              style={styles.iconButton} 
              accessibilityRole="button" 
              accessibilityLabel="Open notifications and messages"
            >
              <View>
                <Ionicons name="apps-outline" size={24} color={Colors[colorScheme].text} />
                {(hasUnreadAlerts || hasUnreadMessages) ? (
                  <View style={styles.alertDot} />
                ) : null}
              </View>
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.contentContainer}>

      {error && (
        <View style={{ marginBottom: 8 }}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => router.push('/sign-in')} style={{ paddingVertical: 8 }}>
            <Text style={{ color: '#0a7ea4', fontWeight: '600' }}>Sign in to load personalized feed</Text>
          </Pressable>
        </View>
      )}
      <View style={[styles.searchBox, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
        <Ionicons name="search" size={20} color={Colors[colorScheme].mutedText} />
        <TextInput
          placeholder="Search by Zip Code..."
          placeholderTextColor={Colors[colorScheme].mutedText}
          value={query}
          onChangeText={handleQueryChange}
          onFocus={handleSearchFocus}
          style={styles.searchInput}
          returnKeyType="search"
          onBlur={() => setZipSuggestionsOpen(false)}
        />
      </View>

      {shouldShowZipSuggestions ? (
        <View style={styles.zipSuggestionList}>
          {zipSuggestions.map((entry) => (
            <Pressable
              key={entry.zip}
              style={styles.zipSuggestionItem}
              onPress={() => handleZipSelect(entry.zip)}
            >
              <Text style={styles.zipSuggestionZip}>{entry.zip}</Text>
              <Text style={styles.zipSuggestionCount}>{entry.count === 1 ? '1 game' : `${entry.count} games`}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

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
                            backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#EFF6FF',
                            borderColor: colorScheme === 'dark' ? '#334155' : '#BFDBFE',
                          }
                        ]}
                        onPress={() => router.push('/submit-ad')}
                        accessibilityRole="button"
                      >
                        <Ionicons name="megaphone" size={48} color={colorScheme === 'dark' ? '#60A5FA' : '#2563EB'} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.promoTitle, { color: colorScheme === 'dark' ? '#93C5FD' : '#1E40AF' }]}>
                            Reserve Your Ad Space Now
                          </Text>
                          <Text style={[styles.promoSubtitle, { color: colorScheme === 'dark' ? '#94A3B8' : '#475569' }]}>
                            Get your business in front of thousands of athletes, coaches & fans
                          </Text>
                        </View>
                        <View style={styles.promoteCtaBanner}>
                          <Ionicons name="arrow-forward" size={18} color="#ffffff" />
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
                        onPress={() => router.push('/submit-ad')}
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
                  onPress={() => router.push({ pathname: '/(tabs)/feed/game/[id]', params: { id: String(gameItem.id) } })}
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
                    onPress={() => router.push({ pathname: '/(tabs)/feed/game/[id]', params: { id: String(item.id) } })}
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

          {/* Tabs */}
          <View style={[styles.menuTabs, { borderBottomColor: Colors[colorScheme].border }]}>
            <Pressable 
              style={[styles.menuTab, activeMenuTab === 'notifications' && styles.menuTabActive]} 
              onPress={() => setActiveMenuTab('notifications')}
            >
              <Ionicons 
                name={activeMenuTab === 'notifications' ? 'notifications' : 'notifications-outline'} 
                size={20} 
                color={activeMenuTab === 'notifications' ? '#2563EB' : Colors[colorScheme].mutedText} 
              />
              <Text style={[
                styles.menuTabText, 
                { color: activeMenuTab === 'notifications' ? '#2563EB' : Colors[colorScheme].mutedText }
              ]}>
                Notifications
              </Text>
              {hasUnreadAlerts && <View style={styles.menuTabBadge} />}
            </Pressable>
            <Pressable 
              style={[styles.menuTab, activeMenuTab === 'messages' && styles.menuTabActive]} 
              onPress={() => setActiveMenuTab('messages')}
            >
              <Ionicons 
                name={activeMenuTab === 'messages' ? 'chatbubbles' : 'chatbubbles-outline'} 
                size={20} 
                color={activeMenuTab === 'messages' ? '#2563EB' : Colors[colorScheme].mutedText} 
              />
              <Text style={[
                styles.menuTabText, 
                { color: activeMenuTab === 'messages' ? '#2563EB' : Colors[colorScheme].mutedText }
              ]}>
                Messages
              </Text>
              {hasUnreadMessages && <View style={styles.menuTabBadge} />}
            </Pressable>
          </View>

          {/* Content */}
          <View style={{ flex: 1 }}>
            {activeMenuTab === 'notifications' ? (
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
                            if (item.type === 'FOLLOW' && item.actor?.id) {
                              router.push(`/user-profile?id=${encodeURIComponent(item.actor.id)}`);
                            } else if ((item.type === 'UPVOTE' || item.type === 'COMMENT') && item.post?.id) {
                              router.push(`/post-detail?id=${encodeURIComponent(item.post.id)}`);
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
            ) : (
              <View style={{ flex: 1 }}>
                {loadingMessages ? (
                  <View style={styles.center}><ActivityIndicator /></View>
                ) : messagesList.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Ionicons name="chatbubbles-outline" size={48} color={Colors[colorScheme].mutedText} />
                    <Text style={[styles.emptyText, { color: Colors[colorScheme].mutedText }]}>No messages</Text>
                  </View>
                ) : (
                  <FlatList
                    data={(() => {
                      // Group messages by conversation
                      const convMap = new Map<string, any>();
                      messagesList.forEach(msg => {
                        const mine = msg.sender_id === me?.id;
                        const other = mine ? msg.recipient : msg.sender;
                        if (!other?.id) return;
                        
                        const convKey = msg.conversation_id || `user-${other.id}`;
                        if (!convMap.has(convKey)) {
                          convMap.set(convKey, {
                            id: convKey,
                            other,
                            lastMessage: msg,
                            unreadCount: (!mine && !msg.read) ? 1 : 0,
                          });
                        } else {
                          const conv = convMap.get(convKey)!;
                          if (!mine && !msg.read) conv.unreadCount++;
                          if (new Date(msg.created_at) > new Date(conv.lastMessage.created_at)) {
                            conv.lastMessage = msg;
                          }
                        }
                      });
                      return Array.from(convMap.values()).sort((a, b) => 
                        new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
                      );
                    })()}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item: conv }) => {
                      const hasUnread = conv.unreadCount > 0;
                      return (
                        <Pressable 
                          style={[styles.listRow, hasUnread && styles.listRowUnread, { borderBottomColor: Colors[colorScheme].border }]}
                          onPress={() => {
                            setNotificationsMenuOpen(false);
                            if (conv.lastMessage.conversation_id) {
                              router.push(`/message-thread?conversation_id=${encodeURIComponent(conv.lastMessage.conversation_id)}`);
                            } else {
                              router.push(`/message-thread?with=${encodeURIComponent(conv.other.id)}`);
                            }
                          }}
                        >
                          <View style={styles.listAvatarWrap}>
                            {conv.other.avatar_url ? (
                              <Image source={{ uri: conv.other.avatar_url }} style={styles.listAvatar} />
                            ) : (
                              <View style={[styles.listAvatar, { backgroundColor: Colors[colorScheme].border }]}>
                                <Ionicons name="person" size={20} color={Colors[colorScheme].mutedText} />
                              </View>
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.listTitle, { color: Colors[colorScheme].text }]}>
                              {conv.other.display_name || conv.other.email || 'User'}
                            </Text>
                            <Text numberOfLines={1} style={[styles.listSubtitle, { color: Colors[colorScheme].mutedText }]}>
                              {conv.lastMessage.content || 'Message'}
                            </Text>
                          </View>
                          {hasUnread && (
                            <View style={styles.unreadBadge}>
                              <Text style={styles.unreadBadgeText}>{conv.unreadCount}</Text>
                            </View>
                          )}
                        </Pressable>
                      );
                    }}
                  />
                )}
              </View>
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
  muted: { color: '#6b7280' },
  helper: { color: '#6b7280', marginBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#F3F4F6', marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, height: 44 },
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
    aspectRatio: 3.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  promoSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  promoteCtaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#2563EB',
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
    fontWeight: '700',
    fontSize: 14,
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
  alertDot: { position: 'absolute', right: -1, top: -1, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
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
    backgroundColor: '#EF4444',
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


