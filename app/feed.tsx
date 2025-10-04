import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { Advertisement, Event, Game, Highlights, Notification as NotificationApi, User } from '@/api/entities';
import MessagesTabIcon from '@/components/ui/MessagesTabIcon';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { findBestMatch } from '../utils/teamMatch';
import MatchBanner from './components/MatchBanner';

import GameVerticalFeedScreen from './game-details/GameVerticalFeedScreen';

type GameItem = { id: string; title?: string; date?: string; location?: string; cover_image_url?: string; banner_url?: string | null; event_id?: string | null };

type ZipDirectoryEntry = { zip: string; count: number };

const ZIP_REGEX = /\b\d{5}\b/g;

// RSVP Badge Component
const RSVPBadge = ({ gameItem, onRSVPChange }: { gameItem: any, onRSVPChange?: () => void }) => {
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
        backgroundColor: isRsvped ? 'rgba(34, 197, 94, 0.9)' : 'rgba(0,0,0,0.75)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        shadowColor: '#000',
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
  const [teams, setTeams] = useState<Array<{ id: string; name: string; avatarUrl?: string | null }>>([]);

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
      const normalizedGames = Array.isArray(gamesData) ? gamesData : [];
      setGames(normalizedGames);
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
      // load teams for logo resolution
      try {
        const teamsData: any = await (await import('@/api/entities')).Team.list();
        const mapped = Array.isArray(teamsData) ? teamsData.map((t: any) => ({ id: String(t.id), name: t.name, avatarUrl: t.logo_url || t.avatar_url || null })) : [];
        setTeams(mapped);
      } catch (err) {
        if (__DEV__) console.warn('Failed to load teams for feed', err);
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
    }, [load]),
  );

  // Lightweight polling to keep unread dot fresh while on the Feed
  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      try {
        const page = await NotificationApi.listPage(null, 1, true);
        if (!mounted) return;
        setHasUnreadAlerts(Array.isArray(page.items) && page.items.length > 0);
      } catch {}
    };
    const id = setInterval(tick, 30000); // ~30s
    return () => { mounted = false; clearInterval(id); };
  }, []);

  // Rotate sponsored ads every ~8s
  useEffect(() => {
    if (!sponsoredAds || sponsoredAds.length <= 1) return;
    // Rotate less frequently to reduce re-renders and image churn
    const id = setInterval(() => {
      setSponsoredIndex((i) => (i + 1) % sponsoredAds.length);
    }, 20000);
    return () => clearInterval(id);
  }, [sponsoredAds]);

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

  return (
    <View style={[styles.container, { paddingTop: 12 + insets.top, backgroundColor: Colors[colorScheme].background }]}>
      {/* Navbar title intentionally swapped to show Feed in the stack and VarsityHub in the UI header */}
      <Stack.Screen options={{ title: 'Feed' }} />
      {/* Top bar with brand and messages quick link */}
      <View style={styles.headerRow}>
        <View style={styles.brandRow}>
          <Image source={require('../assets/images/logo.png')} style={{ width: 28, height: 28 }} />
          <Text style={[styles.brand, { color: Colors[colorScheme].text }]}>VarsityHub</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.push('/messages')} style={{ padding: 8 }}>
            <MessagesTabIcon color={Colors[colorScheme].text} />
          </Pressable>
          <Pressable onPress={() => router.push('/notifications')} style={{ padding: 8, marginLeft: 4 }} accessibilityRole="button" accessibilityLabel="Open alerts">
            <View>
              <Ionicons name="notifications-outline" size={24} color={Colors[colorScheme].text} />
              {hasUnreadAlerts ? (
                <View style={styles.alertDot} />
              ) : null}
            </View>
          </Pressable>
        </View>
      </View>

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
      {!loading && filtered.length === 0 && !error && (
  <Text style={[styles.muted, { color: Colors[colorScheme].mutedText }]}>No games found.</Text>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={() => (me && !emailVerified ? (
          <Pressable onPress={() => router.push('/verify-email')} style={{ padding: 10, borderRadius: 10, backgroundColor: '#FEF9C3', borderWidth: StyleSheet.hairlineWidth, borderColor: '#FDE68A', marginBottom: 10 }}>
            <Text style={{ color: '#92400E', fontWeight: '700' }}>Verify your email to unlock posting and ads. Tap to verify.</Text>
          </Pressable>
        ) : null)}
        renderItem={({ item, index }) => {
          const raw = item as any;
          const reviewsCount = typeof raw?.reviews_count === 'number'
            ? raw.reviews_count
            : (typeof raw?._count?.reviews === 'number' ? raw._count.reviews : null);
          const mediaCount = typeof raw?.media_count === 'number'
            ? raw.media_count
            : (Array.isArray(raw?.media) ? raw.media.length : null);
          const summary = voteSummaries[String(item.id)] || null;

          return (
            <>
              <Pressable
                style={[styles.card, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}
                onPress={() => router.push({ pathname: '/(tabs)/feed/game/[id]', params: { id: String(item.id) } })}
              >
                <View style={styles.hero}>
                  {(() => {
                    // Attempt to render compact MatchBanner when both team logos can be resolved
                    const labels = deriveTeamLabels(item as GameItem);
                    const findTeamMatch = (teamName: string) => {
                      const matched = findBestMatch(teamName, teams as any);
                      return matched || null;
                    };
                    const leftMatch = findTeamMatch(labels.teamA);
                    const rightMatch = findTeamMatch(labels.teamB);
                    const leftLogo = leftMatch?.avatarUrl || null;
                    const rightLogo = rightMatch?.avatarUrl || null;
                    if (leftLogo && rightLogo) {
                      return (
                        <View style={{ position: 'relative' }}>
                          <MatchBanner
                            leftImage={leftLogo}
                            rightImage={rightLogo}
                            leftName={labels.teamA}
                            rightName={labels.teamB}
                            height={100}
                            leftColor={(leftMatch as any)?.color}
                            rightColor={(rightMatch as any)?.color}
                            hero={true}
                            onPress={() => router.push({ pathname: '/(tabs)/feed/game/[id]', params: { id: String(item.id) } })}
                          />
                          {/* RSVP Badge Component */}
                          <RSVPBadge gameItem={item} />
                        </View>
                      );
                    }

                    const banner = item.cover_image_url || (item as any).banner_url || null;
                    return banner ? (
                      <Image source={{ uri: banner }} style={styles.heroImage} contentFit="cover" />
                    ) : (
                      <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.heroImage} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                    );
                  })()}
                </View>
                <View style={styles.cardContent}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardInfoColumn}>
                      {item.date ? (
                        <Text style={[styles.cardDate, { color: '#60A5FA' }]}>{format(new Date(item.date), 'EEE, MMM d, yyyy')}</Text>
                      ) : null}
                      <Text style={[styles.cardTitle, { color: Colors[colorScheme].text }]}>{item.title ? String(item.title) : 'Game'}</Text>
                      <Text style={[styles.cardMeta, { color: Colors[colorScheme].mutedText }]}>{item.location ? String(item.location) : 'TBD'}</Text>
                      <View style={styles.tagRow}>
                        <View style={[styles.tag, { backgroundColor: Colors[colorScheme].surface }]}>
                          <Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors[colorScheme].mutedText} />
                          <Text style={[styles.tagText, { color: Colors[colorScheme].mutedText }]}>{reviewsCount === null ? 'Reviews' : `${reviewsCount} Reviews`}</Text>
                        </View>
                        <View style={[styles.tag, { backgroundColor: Colors[colorScheme].surface }]}>
                          <Ionicons name="camera-outline" size={14} color={Colors[colorScheme].mutedText} />
                          <Text style={[styles.tagText, { color: Colors[colorScheme].mutedText }]}>{mediaCount === null ? 'Photos & Videos' : `${mediaCount} Media`}</Text>
                        </View>
                      </View>
                    </View>
                    {summary ? (
                      <View style={styles.voteChip}>
                        <View style={styles.voteChipBar}>
                          <View style={[styles.voteChipSegmentA, { flex: Math.max(summary.pctA, 1) }]}>
                            <Text style={styles.voteChipText} numberOfLines={1}>{`${summary.teamALabelShort} ${summary.pctA}%`}</Text>
                          </View>
                          <View style={[styles.voteChipSegmentB, { flex: Math.max(summary.pctB, 1) }]}>
                            <Text style={styles.voteChipText} numberOfLines={1}>{`${summary.teamBLabelShort} ${summary.pctB}%`}</Text>
                          </View>
                        </View>
                        <Text style={styles.voteChipHint}>Tap to vote</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
              {index === 0 && sponsoredAds.length > 0 ? (
                <View style={styles.sponsored}>
                  <Text style={[styles.sponsoredBadge, { color: Colors[colorScheme].mutedText }]}>SPONSORED</Text>
                  {sponsoredAds[sponsoredIndex]?.banner_url ? (
                    <View style={{ height: 120, borderRadius: 10, overflow: 'hidden', marginTop: 8, marginBottom: 8 }}>
                      <Image source={{ uri: String(sponsoredAds[sponsoredIndex].banner_url) }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    </View>
                  ) : null}
                  <Text style={[styles.cardTitle, { marginTop: 4, color: Colors[colorScheme].text }]}>{sponsoredAds[sponsoredIndex]?.business_name || 'Local Sponsor'}</Text>
                  {sponsoredAds[sponsoredIndex]?.description ? (
                    <Text style={[styles.cardMeta, { color: Colors[colorScheme].mutedText }]} numberOfLines={2}>{String(sponsoredAds[sponsoredIndex].description)}</Text>
                  ) : null}
                </View>
              ) : null}
              {index === 0 ? (
                <Pressable style={{ padding: 16, borderRadius: 14, backgroundColor: Colors[colorScheme].card, borderWidth: 2, borderStyle: 'dashed', borderColor: Colors[colorScheme].border, alignItems: 'center', justifyContent: 'center' }} onPress={() => router.push('/submit-ad')}>
                  <Text style={{ fontWeight: '800', fontSize: 18, marginBottom: 4, color: Colors[colorScheme].text }}>Your Ad Here</Text>
                  <Text style={[styles.muted, { color: Colors[colorScheme].mutedText }]}>Click to submit a local ad</Text>
                </Pressable>
              ) : null}
            </>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListFooterComponent={() => (
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
                  colors={['#1e293b', '#0f172a']}
                  style={styles.verticalFeedImage}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              )}
              <LinearGradient
                colors={['rgba(15,23,42,0.1)', 'rgba(15,23,42,0.85)']}
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
        )}
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: 24 }}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />

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
  container: { flex: 1, padding: 16 },
  center: { paddingVertical: 24, alignItems: 'center' },
  error: { color: '#b91c1c', marginBottom: 8 },
  muted: { color: '#6b7280' },
  helper: { color: '#6b7280', marginBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { fontSize: 28, fontWeight: '900' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#F3F4F6', marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, height: 44 },
  card: { padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  hero: { height: 140, borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  heroImage: { width: '100%', height: '100%' },
  cardDate: { color: '#2563EB', fontWeight: '700', marginBottom: 4 },
  cardTitle: { fontWeight: '800', fontSize: 18, marginBottom: 2 },
  cardMeta: { color: '#6b7280' },
  tagRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F3F4F6' },
  tagText: { color: '#6b7280', fontWeight: '700', fontSize: 12 },
  sponsored: { padding: 14, borderRadius: 14, backgroundColor: '#F1F5F9', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E2E8F0' },
  sponsoredBadge: { color: '#6b7280', fontWeight: '800', fontSize: 10, letterSpacing: 1 },
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
  cardContent: { paddingHorizontal: 16, paddingVertical: 14 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  cardInfoColumn: { flex: 1, gap: 6 },
  voteBarTrack: { flexDirection: 'row', flex: 1, height: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: '#E5E7EB' },
  voteBarSegmentA: { backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8, minWidth: 40 },
  voteBarSegmentB: { backgroundColor: '#A5B4FC', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8, minWidth: 40 },
  voteChip: { marginLeft: 12, alignItems: 'flex-end', gap: 4 },
  voteChipBar: { flexDirection: 'row', width: 160, height: 26, borderRadius: 999, overflow: 'hidden', backgroundColor: '#E5E7EB' },
  voteChipSegmentA: { backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  voteChipSegmentB: { backgroundColor: '#A5B4FC', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  voteChipText: { color: '#ffffff', fontWeight: '700', fontSize: 11 },
  voteChipHint: { color: '#6b7280', fontSize: 10 },
  verticalFeedModal: { flex: 1, backgroundColor: '#020617' },
  alertDot: { position: 'absolute', right: -1, top: -1, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
});


