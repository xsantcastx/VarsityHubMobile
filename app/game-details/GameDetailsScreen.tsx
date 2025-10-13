import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { AccessibilityInfo, ActivityIndicator, Alert, Animated, Linking, Modal, Platform, Pressable, RefreshControl, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MatchBanner from '../components/MatchBanner';

// @ts-ignore JS exports
import { Event, Game, Team } from '@/api/entities';
import { uploadFile } from '@/api/upload';
import VideoPlayer from '@/components/VideoPlayer';
import GameVerticalFeedScreen from './GameVerticalFeedScreen';

import type { ColorValue } from 'react-native';
const PLACEHOLDER_GRADIENT: readonly [ColorValue, ColorValue, ...ColorValue[]] = ['#1e293b', '#1d4ed8', '#38bdf8'];
const VIDEO_EXT = /\.(mp4|mov|webm|m4v|avi)$/i;
const GAME_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours live window

type MediaItem = {
  id: string;
  url: string;
  kind: 'photo' | 'video';
  created_at?: string;
  caption?: string | null;
};

type StoriesViewerProps = {
  visible: boolean;
  items: MediaItem[];
  index: number;
  onClose: () => void;
  onSeen: (id: string) => void;
};

function StoriesViewer({ visible, items, index, onClose, onSeen }: StoriesViewerProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const [current, setCurrent] = useState(index);
  const w = useWindowDimensions().width;
  const progress = useRef(new Animated.Value(0)).current;
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const progressFracRef = useRef(0);

  // Sync starting index when viewer opens or caller changes it
  useEffect(() => {
    if (visible) setCurrent(index);
  }, [visible, index]);

  const goNext = useCallback(() => {
    setCurrent((prev) => {
      const next = prev + 1;
      if (next >= items.length) {
        onClose();
        return prev;
      }
      return next;
    });
  }, [items.length, onClose]);

  const goPrev = useCallback(() => {
    setCurrent((prev) => Math.max(0, prev - 1));
  }, []);

  // Guard taps right after long-press to avoid accidental nav
  const skipTapUntil = useRef<number>(0);
  const onLongPress = useCallback(() => {
    setPaused(true);
    skipTapUntil.current = Date.now() + 120;
  }, []);
  const onPressOut = useCallback(() => {
    setPaused(false);
  }, []);
  const onNavLeft = useCallback(() => {
    if (Date.now() < skipTapUntil.current) return;
    goPrev();
  }, [goPrev]);
  const onNavRight = useCallback(() => {
    if (Date.now() < skipTapUntil.current) return;
    goNext();
  }, [goNext]);

  // Reset progress when current changes
  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    setPlaying(false);
  }, [current, progress]);

  // Auto-advance for photos every 5s (pausable). Also mark seen on enter.
  useEffect(() => {
    const item = items[current];
    if (!item) return;
    onSeen(item.id);
    if (item.kind === 'photo') {
      const duration = 5000;
      let startTime = Date.now();
      let raf: number;
      let advanced = false;
      const tick = () => {
        if (!paused) {
          const elapsed = Date.now() - startTime;
          const ratio = Math.min(1, elapsed / duration);
          progressFracRef.current = ratio;
          progress.setValue(ratio);
          if (ratio >= 1 && !advanced) {
            advanced = true;
            goNext();
            return;
          }
        } else {
          startTime = Date.now() - progressFracRef.current * duration;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
  }, [current, items, goNext, paused, onSeen, progress]);

  if (!visible) return null;
  const item = items[current];
  const isVideo = item?.kind === 'video' || (item?.url && VIDEO_EXT.test(item.url));
  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      hardwareAccelerated
      statusBarTranslucent
    >
      <View
        style={styles.storyViewerRoot}
        needsOffscreenAlphaCompositing
        renderToHardwareTextureAndroid
      >
        <View style={[styles.storyViewerTopBar, { paddingTop: insets.top + 8 }]}> 
          <View style={styles.storyProgressRow}>
            {items.map((_, i) => {
              const isPast = i < current;
              const isFuture = i > current;
              const isActive = i === current;
              return (
                <View key={i} style={styles.storyProgressSegment}>
                  <View style={styles.storyProgressTrack} />
                  {isPast ? (
                    <View style={[styles.storyProgressFillAbs, { transform: [{ scaleX: 1 }] }]} />
                  ) : isFuture ? (
                    <View style={[styles.storyProgressFillAbs, { transform: [{ scaleX: 0 }] }]} />
                  ) : isActive ? (
                    <Animated.View style={[styles.storyProgressFillAbs, { transform: [{ scaleX: progress }] }]} />
                  ) : null}
                </View>
              );
            })}
          </View>
          <Text style={styles.storyTopLabel}>{current + 1} / {items.length}</Text>
          <Pressable onPress={onClose} style={styles.storyCloseBtn} accessibilityLabel="Close stories">
            <Ionicons name="close" size={22} color={Colors[colorScheme].text} />
          </Pressable>
        </View>

        <View
          style={styles.storyStage}
          needsOffscreenAlphaCompositing
          renderToHardwareTextureAndroid
          collapsable={false}
        >
            {isVideo ? (
              // start videos paused to avoid unexpected audio/looping; user can tap to play
              <View style={{ width: w, aspectRatio: 9 / 16, backgroundColor: Colors[colorScheme].surface, alignItems: 'center', justifyContent: 'center' }}>
                <VideoPlayer uri={item.url} autoPlay={false} onEnd={goNext} nativeControls paused={!playing} style={{ width: '100%', height: '100%' }} />
                {!playing ? (
                  <Pressable onPress={() => setPlaying(true)} style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }} accessibilityLabel="Play video">
                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="play" size={28} color={Colors[colorScheme].text} />
                    </View>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => setPlaying(false)} style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }} accessibilityLabel="Pause video" />
                )}
              </View>
            ) : (
              <Image
                source={{ uri: item.url }}
                style={{ width: w, aspectRatio: 9 / 16, backgroundColor: Colors[colorScheme].surface }}
                contentFit="cover"
                transition={0}
                cachePolicy="memory-disk"
                recyclingKey={item.url}
              />
            )}
        </View>

        {/* Preload next photo to minimize flicker on advance */}
        {(() => {
          const nextIndex = current + 1;
          const next = nextIndex < items.length ? items[nextIndex] : null;
          if (!next || next.kind === 'video') return null;
          return (
            <Image
              source={{ uri: next.url }}
              style={{ width: 1, height: 1, position: 'absolute', left: -1000, top: -1000, opacity: 0 }}
              contentFit="cover"
              transition={0}
              cachePolicy="memory-disk"
              recyclingKey={next.url}
            />
          );
        })()}

        <View style={styles.storyTouchLayer}>
          <Pressable
            style={styles.storyTouchHalf}
            onPress={onNavLeft}
            onLongPress={onLongPress}
            onPressOut={onPressOut}
            delayLongPress={150}
          />
          <Pressable
            style={styles.storyTouchHalf}
            onPress={onNavRight}
            onLongPress={onLongPress}
            onPressOut={onPressOut}
            delayLongPress={150}
          />
        </View>
      </View>
    </Modal>
  );
}

type TeamInfo = { id: string; name: string; avatarUrl?: string | null };

type GameVM = {
  id: string;
  gameId: string | null;
  eventId: string | null;
  title: string;
  date: string;
  location: string | null;
  description?: string | null;
  bannerUrl?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  coverImageUrl?: string | null;
  capacity?: number | null;
  rsvpCount?: number | null;
  userRsvped?: boolean;
  teams: TeamInfo[];
  posts: any[];
  media: MediaItem[];
  reviewsCount?: number | null;
  isPast: boolean;
};

type SectionKey = 'overview' | 'media' | 'posts';

type VoteSummary = {
  teamA: number;
  teamB: number;
  total: number;
  pctA: number;
  pctB: number;
  userVote: "A" | "B" | null;
};

type VoteOption = 'A' | 'B';

const buildVoteSummary = (teamA: number, teamB: number, userVote: VoteOption | null): VoteSummary => {
  const safeA = Math.max(0, teamA);
  const safeB = Math.max(0, teamB);
  const total = safeA + safeB;
  const pctA = total ? Math.round((safeA / total) * 100) : 0;
  const pctB = total ? 100 - pctA : 0;
  return { teamA: safeA, teamB: safeB, total, pctA, pctB, userVote };
};

const parseVoteSummary = (payload: any): VoteSummary => {
  const teamA = typeof payload?.teamA === 'number' ? payload.teamA : 0;
  const teamB = typeof payload?.teamB === 'number' ? payload.teamB : 0;
  const userVote: VoteOption | null = payload?.userVote === 'A' || payload?.userVote === 'B' ? payload.userVote : null;
  return buildVoteSummary(teamA, teamB, userVote);
};

const ensureIso = (value: any) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return null;
};

const formatDateLabel = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'EEE, MMM d, yyyy');
};

const formatTimeLabel = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'h:mm a');
};

const computeIsPast = (iso?: string | null) => {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
};

const capCount = (count?: number | null, capacity?: number | null) => {
  if (typeof count !== 'number') return null;
  if (typeof capacity === 'number' && capacity >= 0) return Math.min(count, capacity);
  return count;
};

const openMaps = (location: string) => {
  const query = encodeURIComponent(location);
  const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
  Linking.openURL(url).catch(() => {});
};

const pickBannerFromArrays = (vm: Partial<GameVM>, media: MediaItem[]) => {
  const result = vm.bannerUrl || vm.coverImageUrl || media[0]?.url || null;
  console.log('pickBannerFromArrays:', { bannerUrl: vm.bannerUrl, coverImageUrl: vm.coverImageUrl, firstMediaUrl: media[0]?.url, result });
  return result;
};

const GameDetailsScreen = () => {
  const { id, eventId } = useLocalSearchParams<{ id?: string; eventId?: string }>();
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<any>(null);
  const sectionOffsets = useRef<{ media: number; posts: number }>({ media: 0, posts: 0 });

  const [vm, setVm] = useState<GameVM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>('overview');
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [viewer, setViewer] = useState<{ visible: boolean; url: string | null; kind: 'photo' | 'video' } | null>(null);
  const [storyBusy, setStoryBusy] = useState(false);
  const [verticalFeedOpen, setVerticalFeedOpen] = useState(false);
  const [storiesViewer, setStoriesViewer] = useState<{ visible: boolean; items: MediaItem[]; index: number } | null>(null);
  const viewerOpenRef = useRef(false);
  const [seenStories, setSeenStories] = useState<Record<string, true>>({});
  const [nowTs, setNowTs] = useState(() => Date.now());
  const livePulse = useRef(new Animated.Value(0)).current;

  const [voteSummary, setVoteSummary] = useState<VoteSummary | null>(null);
  const [voteBusy, setVoteBusy] = useState(false);
  const voteAnimated = useRef({ A: new Animated.Value(50), B: new Animated.Value(50) }).current;
  // micro-animation values for VS modal cards
  const vsScaleA = useRef(new Animated.Value(1)).current;
  const vsScaleB = useRef(new Animated.Value(1)).current;
  const pctAnimA = useRef(new Animated.Value(0)).current;
  const pctAnimB = useRef(new Animated.Value(0)).current;
  // animated numeric counters
  const numAnimA = useRef(new Animated.Value(0)).current;
  const numAnimB = useRef(new Animated.Value(0)).current;
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [displayPctA, setDisplayPctA] = useState(0);
  const [displayPctB, setDisplayPctB] = useState(0);
  // theme colors for VS modal
  const themeBgA = useThemeColor({ light: '#f8fafc', dark: '#0b1220' }, 'background');
  const themeBgOn = useThemeColor({ light: '#2563EB', dark: '#1f6feb' }, 'tint');
  const themeTextColor = useThemeColor({ light: '#0f172a', dark: '#e6eefc' }, 'text');
  const feedY = useRef(new Animated.Value(0)).current;
  const [headerH, setHeaderH] = useState(0);
  const THRESHOLD = useMemo(() => Math.max(24, headerH * 0.6), [headerH]);
  const [showTopFab, setShowTopFab] = useState(false);
  const [vsModalOpen, setVsModalOpen] = useState(false);
  const showTopFabRef = useRef(false);
  const headerTranslateY = useMemo(() => feedY.interpolate({
    inputRange: [0, headerH || 1],
    outputRange: [0, -(headerH || 1)],
    extrapolate: 'clamp',
  }), [feedY, headerH]);
  const headerOpacity = useMemo(() => feedY.interpolate({
    inputRange: [0, (headerH || 1) * 0.7],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  }), [feedY, headerH]);

  useEffect(() => {
    showTopFabRef.current = false;
    setShowTopFab(false);
  }, [headerH]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => setPrefersReducedMotion(!!v));
    const ev = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setPrefersReducedMotion(!!v));
    return () => { try { ev?.remove?.(); } catch (e) {} };
  }, []);

  // update display percentages from animated numeric values
  useEffect(() => {
    const idA = numAnimA.addListener(({ value }) => setDisplayPctA(Math.round(value)));
    const idB = numAnimB.addListener(({ value }) => setDisplayPctB(Math.round(value)));
    // initialize
    numAnimA.setValue(displayPctA);
    numAnimB.setValue(displayPctB);
    return () => {
      try { numAnimA.removeListener(idA); } catch (e) {}
      try { numAnimB.removeListener(idB); } catch (e) {}
    };
  }, [numAnimA, numAnimB]);

  // Track if the stories viewer is open to avoid unnecessary re-renders that can cause flicker on some devices
  useEffect(() => {
    viewerOpenRef.current = !!storiesViewer?.visible;
  }, [storiesViewer?.visible]);

  // Tick every second to update countdown/live status (paused while stories viewer is open)
  useEffect(() => {
    const t = setInterval(() => {
      if (!viewerOpenRef.current) {
        setNowTs(Date.now());
      }
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    if (THRESHOLD <= 0) return;
    if (!showTopFabRef.current && y >= THRESHOLD) {
      showTopFabRef.current = true;
      setShowTopFab(true);
    } else if (showTopFabRef.current && y < THRESHOLD) {
      showTopFabRef.current = false;
      setShowTopFab(false);
    }
  }, [THRESHOLD]);

  const canonicalGameId = vm?.gameId;
  const displayDate = formatDateLabel(vm?.date);
  const displayTime = formatTimeLabel(vm?.date);
  const goingCount = capCount(vm?.rsvpCount, vm?.capacity);
  const bannerUrl = useMemo(() => pickBannerFromArrays(vm ?? {}, vm?.media ?? []), [vm]);

  // Load teams data
  const loadTeams = async () => {
    try {
      const teamsData = await Team.list();
      const teamInfo: TeamInfo[] = teamsData.map((team: any) => ({
        id: team.id,
        name: team.name,
        avatarUrl: team.logo_url || team.avatar_url,
      }));
      setTeams(teamInfo);
    } catch (error) {
      console.error('Failed to load teams:', error);
    }
  };

  // Get team logo by name
  const { findBestMatch } = require('../../utils/teamMatch');
  const getTeamLogo = (teamName: string) => {
    if (!teamName) return null;
    // try exact case-insensitive match first
    const exact = (teams || []).find((t: any) => String(t.name || '').toLowerCase() === String(teamName || '').toLowerCase());
    if (exact && exact.avatarUrl) return exact.avatarUrl;
    const matched = findBestMatch(teamName, teams as any);
    return matched?.avatarUrl || null;
  };

  // Derive game phase from date and now
  const { phase: gamePhase, diffMs: startsInMs } = useMemo(() => {
    const iso = vm?.date;
    if (!iso) return { phase: 'final' as 'upcoming' | 'live' | 'final', diffMs: 0 };
    const startMs = new Date(iso).getTime();
    if (!Number.isFinite(startMs)) return { phase: 'final' as const, diffMs: 0 };
    const diff = startMs - nowTs;
    if (diff > 0) return { phase: 'upcoming' as const, diffMs: diff };
    const elapsed = nowTs - startMs;
    if (elapsed < GAME_WINDOW_MS) return { phase: 'live' as const, diffMs: 0 };
    return { phase: 'final' as const, diffMs: 0 };
  }, [vm?.date, nowTs]);

  // RSVP only shown before the game starts
  const hasEvent = !!vm?.eventId;
  const canRsvpNow = hasEvent && gamePhase === 'upcoming';
  // Smart RSVP bottom sheet state
  const [rsvpSheetOpen, setRsvpSheetOpen] = useState(false);

  const rsvpChipLabel = useMemo(() => {
    if (!hasEvent) return null;
    const n = goingCount != null ? goingCount : 0;
    if (gamePhase === 'upcoming') return vm?.userRsvped ? `Going • ${n}` : `RSVP • ${n}`;
    if (gamePhase === 'live') return `${n} going`;
    return `${n} went`;
  }, [hasEvent, goingCount, gamePhase, vm?.userRsvped]);

  const openRsvpSheet = useCallback(() => {
    if (!hasEvent) return;
    setRsvpSheetOpen(true);
  }, [hasEvent]);

  const closeRsvpSheet = useCallback(() => setRsvpSheetOpen(false), []);

  // Start/stop pulse when LIVE
  useEffect(() => {
    if (gamePhase !== 'live') {
      livePulse.stopAnimation();
      livePulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(livePulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [gamePhase, livePulse]);

  const formatCountdown = useCallback((ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const two = (n: number) => n.toString().padStart(2, '0');
    if (days >= 1) {
      return `${days}d ${two(hours)}:${two(minutes)}:${two(seconds)}`;
    }
    return `${two(hours)}:${two(minutes)}:${two(seconds)}`;
  }, []);

  const postsCount = Array.isArray(vm?.posts) ? vm.posts.length : 0;
  const postsSubtitle = postsCount ? `${postsCount} highlight${postsCount === 1 ? '' : 's'}` : 'No highlights yet';
  const previewImage = useMemo(() => {
    if (!vm) return bannerUrl;
    const posts = Array.isArray(vm.posts) ? vm.posts : [];
    const firstWithMedia = posts.find((post: any) => typeof post?.media_url === 'string' && post.media_url);
    if (firstWithMedia?.media_url) return String(firstWithMedia.media_url);
    const mediaItems = Array.isArray(vm.media) ? vm.media : [];
    const firstMedia = mediaItems.find((item) => typeof item?.url === 'string' && item.url);
    if (firstMedia?.url) return String(firstMedia.url);
    return bannerUrl;
  }, [vm, bannerUrl]);

  const { teamALabel, teamBLabel } = useMemo(() => {
    const home = vm?.homeTeam?.trim();
    const away = vm?.awayTeam?.trim();
    if (home && away) return { teamALabel: home, teamBLabel: away };
    const title = (vm?.title || '').replace(/\s+/g, ' ').trim();
    if (title) {
      const parts = title.split(/\s+vs\.?\s+/i).map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return { teamALabel: parts[0], teamBLabel: parts[1] };
      }
    }
    return { teamALabel: 'Team A', teamBLabel: 'Team B' };
  }, [vm?.homeTeam, vm?.awayTeam, vm?.title]);

  const replaceToCanonicalGame = useCallback(
    (gameIdValue: string) => {
      const routeBase = '/(tabs)/feed/game/[id]';
      router.replace({ pathname: routeBase, params: { id: gameIdValue } });
    },
    [router],
  );

  const mapTeams = (input: any): TeamInfo[] => {
    if (!Array.isArray(input)) return [];
    return input
      .map((team: any) => ({ id: String(team.id ?? team.team_id ?? ''), name: String(team.name ?? team.team_name ?? 'Team'), avatarUrl: team.avatarUrl ?? team.avatar_url ?? null }))
      .filter((team) => team.id);
  };

  const loadGameById = useCallback(
    async (gameIdValue: string) => {
      const summary: any = await Game.summary(gameIdValue).catch(() => null);
      let gameRecord: any = null;
      if (!summary) {
        console.log('Loading game details for ID:', gameIdValue);
        gameRecord = await Game.get(gameIdValue);
        console.log('Loaded game record:', gameRecord);
      }
      const [postsData, mediaData] = await Promise.all([
        Game.posts(gameIdValue, { limit: 100 }).catch(() => summary?.posts || []),
        Game.media(gameIdValue).catch(() => summary?.media || []),
      ]);

      let eventIdValue: string | null = null;
      let location: string | null = null;
      let description: string | null = null;
      let bannerCandidate: string | null = null;
      let cover: string | null = null;
      let capacity: number | null = null;
      let rsvpCount: number | null = null;
      let userRsvped = false;
      let reviewsCount: number | null = null;
      let isPast = false;
      let teams: TeamInfo[] = [];
      let dateIso: string | null = null;
      let title = '';
      let homeTeam: string | null = null;
      let awayTeam: string | null = null;

      if (summary) {
        eventIdValue = summary.eventId ?? summary.event_id ?? summary.event?.id ?? null;
        location = summary.location ?? summary.event?.location ?? null;
        description = summary.description ?? null;
        bannerCandidate = summary.bannerUrl ?? null;
        cover = summary.coverImageUrl ?? null;
        capacity = typeof summary.capacity === 'number' ? summary.capacity : summary.event?.capacity ?? null;
        rsvpCount = typeof summary.rsvpCount === 'number' ? summary.rsvpCount : null;
        userRsvped = Boolean(summary.userRsvped);
        reviewsCount = typeof summary.reviewsCount === 'number' ? summary.reviewsCount : null;
        isPast = Boolean(summary.isPast);
        teams = mapTeams(summary.teams);
        dateIso = ensureIso(summary.date);
        title = summary.title ?? '';
        homeTeam = summary.homeTeam ?? summary.home_team ?? null;
        awayTeam = summary.awayTeam ?? summary.away_team ?? null;
      }

      if (!summary && gameRecord) {
        eventIdValue = (gameRecord as any).event_id ?? null;
        location = gameRecord.location || null;
        description = gameRecord.description || null;
        bannerCandidate = gameRecord.banner_url || null; // Check game banner_url first
        console.log('Game record banner_url:', gameRecord.banner_url);
        console.log('Banner candidate set to:', bannerCandidate);
        cover = gameRecord.cover_image_url || null;
        dateIso = ensureIso(gameRecord.date) ?? null;
        title = gameRecord.title || '';
        isPast = computeIsPast(dateIso);
        homeTeam = gameRecord.home_team || null;
        awayTeam = gameRecord.away_team || null;
      }

      if (!title) title = 'Game';
      if (!dateIso && gameRecord?.date) dateIso = ensureIso(gameRecord.date);
      if (!isPast) isPast = computeIsPast(dateIso);
      if (!bannerCandidate && summary?.event?.banner_url) bannerCandidate = summary.event.banner_url;
      if (!bannerCandidate && gameRecord?.banner_url) bannerCandidate = gameRecord.banner_url; // Fallback to game banner

      let eventDetails: any = null;
      if (eventIdValue) {
        eventDetails = await Event.get(eventIdValue).catch(() => null);
        if (eventDetails) {
          if (!location) location = eventDetails.location || null;
          if (!bannerCandidate) bannerCandidate = eventDetails.banner_url || null;
          if (typeof eventDetails.capacity === 'number' && capacity == null) capacity = eventDetails.capacity;
          if (typeof eventDetails.attendees_count === 'number' && rsvpCount == null) rsvpCount = eventDetails.attendees_count;
        }
        const rsvp = await Event.rsvpStatus(eventIdValue).catch(() => null);
        if (rsvp) {
          rsvpCount = typeof rsvp.count === 'number' ? rsvp.count : rsvpCount;
          capacity = typeof rsvp.capacity === 'number' ? rsvp.capacity : capacity;
          userRsvped = 'going' in rsvp ? Boolean(rsvp.going) : Boolean((rsvp as any).attending);
        }
      }

      const vmPayload: GameVM = {
        id: gameIdValue,
        gameId: gameIdValue,
        eventId: eventIdValue,
        title,
        date: dateIso ?? new Date().toISOString(),
        location,
        description,
        bannerUrl: bannerCandidate,
        coverImageUrl: cover,
        homeTeam,
        awayTeam,
        capacity: capacity ?? null,
        rsvpCount: rsvpCount ?? null,
        userRsvped,
        teams,
        posts: Array.isArray(postsData) ? postsData : postsData?.items || [],
        media: Array.isArray(mediaData) ? mediaData : [],
        reviewsCount,
        isPast,
      };

      console.log('Final game view model banner URL:', bannerCandidate);
      console.log('Final game view model created');
      setVm(vmPayload);
      setActiveSection('overview');
    },
    [],
  );

  const loadVirtualFromEvent = useCallback(
    async (eventIdValue: string) => {
      const event = await Event.get(eventIdValue);
      if (event?.game_id) {
        replaceToCanonicalGame(String(event.game_id));
        return;
      }
      const rsvp = await Event.rsvpStatus(eventIdValue).catch(() => null);
      const dateIso = ensureIso(event?.date) ?? new Date().toISOString();
      const vmPayload: GameVM = {
        id: `event-${eventIdValue}`,
        gameId: null,
        eventId: eventIdValue,
        title: event?.title || 'Event',
        date: dateIso,
        location: event?.location || null,
        description: null,
        bannerUrl: event?.banner_url || null,
        coverImageUrl: event?.game?.cover_image_url || null,
        homeTeam: null,
        awayTeam: null,
        capacity: event?.capacity ?? (typeof rsvp?.capacity === 'number' ? rsvp?.capacity : null),
        rsvpCount: typeof rsvp?.count === 'number' ? rsvp?.count : event?.attendees_count ?? null,
        userRsvped: rsvp ? Boolean(rsvp.going ?? rsvp.attending) : false,
        teams: [],
        posts: [],
        media: [],
        reviewsCount: null,
        isPast: computeIsPast(dateIso),
      };
      setVm(vmPayload);
      setActiveSection('overview');
    },
    [replaceToCanonicalGame],
  );

  const handleCreatePost = useCallback(() => {
    if (!vm?.gameId) return;
    router.push({ pathname: '/create-post', params: { gameId: vm.gameId, type: 'post' } });
  }, [router, vm?.gameId]);

  const handleCreateHighlight = useCallback(() => {
    if (!vm?.gameId) return;
    router.push({ pathname: '/create-post', params: { gameId: vm.gameId, type: 'highlight' } });
  }, [router, vm?.gameId]);

  const handleAddStory = useCallback(async () => {
    if (!vm?.gameId || storyBusy) return;
    
    // Show action sheet with camera first, then gallery
    Alert.alert(
      'Add Story', 
      'Choose how you want to add your story',
      [
        {
          text: 'Take Photo/Video',
          onPress: async () => {
            try {
              setStoryBusy(true);
              const pickerOptions: any = {
                quality: 0.9,
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                allowsEditing: true,
              };
              const result = await ImagePicker.launchCameraAsync(pickerOptions);
              if (!result || result.canceled || !result.assets || !result.assets.length) return;
              
              const asset = result.assets[0];
              const base =
                (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_URL) ||
                (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000');
              const name = (asset as any).fileName || ((asset as any).duration ? 'story.mp4' : 'story.jpg');
              const mime = asset.mimeType || ((asset as any).duration ? 'video/mp4' : 'image/jpeg');
              const uploaded = await uploadFile(base, asset.uri, name, mime);
              const mediaUrl = uploaded?.path || uploaded?.url;
              if (!mediaUrl) {
                throw new Error('Upload failed');
              }
              await Game.addStory(vm.gameId, { media_url: mediaUrl });
              await loadGameById(vm.gameId);
              Alert.alert('Added', 'Story added to this game.');
            } catch (err: any) {
              Alert.alert('Unable to add story', err?.message || 'Please try again.');
            } finally {
              setStoryBusy(false);
            }
          }
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            try {
              setStoryBusy(true);
              const pickerOptions: any = {
                quality: 0.9,
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                allowsEditing: true,
              };
              const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
              if (!result || result.canceled || !result.assets || !result.assets.length) return;
              
              const asset = result.assets[0];
              const base =
                (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_URL) ||
                (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000');
              const name = (asset as any).fileName || ((asset as any).duration ? 'story.mp4' : 'story.jpg');
              const mime = asset.mimeType || ((asset as any).duration ? 'video/mp4' : 'image/jpeg');
              const uploaded = await uploadFile(base, asset.uri, name, mime);
              const mediaUrl = uploaded?.path || uploaded?.url;
              if (!mediaUrl) {
                throw new Error('Upload failed');
              }
              await Game.addStory(vm.gameId, { media_url: mediaUrl });
              await loadGameById(vm.gameId);
              Alert.alert('Added', 'Story added to this game.');
            } catch (err: any) {
              Alert.alert('Unable to add story', err?.message || 'Please try again.');
            } finally {
              setStoryBusy(false);
            }
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  }, [loadGameById, storyBusy, vm?.gameId]);

  const refreshVotes = useCallback(async () => {
    if (!vm?.gameId) {
      setVoteSummary(null);
      return;
    }
    try {
      const res: any = await Game.votesSummary(vm.gameId);
      setVoteSummary(parseVoteSummary(res));
    } catch (err) {
      console.warn('Failed to load game votes', err);
    }
  }, [vm?.gameId]);

  const load = useCallback(
    async (isRefresh = false) => {
      const gameIdValue = id ? String(id) : null;
      const eventIdValue = eventId ? String(eventId) : null;
      if (!gameIdValue && !eventIdValue) {
        setError('Missing game or event id.');
        setVm(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (isRefresh) setRefreshing(true); else setLoading(true);
      setError(null);
      
      // Load teams data
      await loadTeams();
      
      try {
        if (gameIdValue) {
          await loadGameById(gameIdValue);
        } else if (eventIdValue) {
          await loadVirtualFromEvent(eventIdValue);
        }
      } catch (err) {
        console.error('Failed to load game details', err);
        setError('Unable to load game details. Please try again.');
        setVm(null);
      } finally {
        if (isRefresh) setRefreshing(false); else setLoading(false);
      }
    },
    [eventId, id, loadGameById, loadVirtualFromEvent],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    refreshVotes();
  }, [refreshVotes]);

  useEffect(() => {
    setVoteSummary(null);
  }, [vm?.gameId]);

  useFocusEffect(
    useCallback(() => {
      refreshVotes();
      const interval = setInterval(() => {
        refreshVotes();
      }, 10000);
      return () => clearInterval(interval);
    }, [refreshVotes]),
  );

  useEffect(() => {
    const total = voteSummary?.total ?? 0;
    const hasVotes = total > 0;
    const targetA = hasVotes ? Math.max(1, Math.min(100, voteSummary?.pctA ?? 0)) : 50;
    const targetB = hasVotes ? Math.max(1, Math.min(100, voteSummary?.pctB ?? 0)) : 50;
    const dur = prefersReducedMotion ? 0 : 400;
    Animated.parallel([
      Animated.timing(voteAnimated.A, { toValue: targetA, duration: prefersReducedMotion ? 0 : 200, useNativeDriver: false }),
      Animated.timing(voteAnimated.B, { toValue: targetB, duration: prefersReducedMotion ? 0 : 200, useNativeDriver: false }),
      Animated.timing(pctAnimA, { toValue: targetA, duration: dur, useNativeDriver: false }),
      Animated.timing(pctAnimB, { toValue: targetB, duration: dur, useNativeDriver: false }),
      Animated.timing(numAnimA, { toValue: targetA, duration: dur, useNativeDriver: false }),
      Animated.timing(numAnimB, { toValue: targetB, duration: dur, useNativeDriver: false }),
    ]).start();
  }, [voteSummary?.pctA, voteSummary?.pctB, voteSummary?.total, prefersReducedMotion]);

  const onRefresh = useCallback(() => {
    load(true);
  }, [load]);

  const onToggleRsvp = useCallback(async () => {
    if (!vm?.eventId || rsvpBusy) return;
    // snapshot current vm for potential rollback
    const snapshot = vm;
    const nextDesired = !vm.userRsvped;

    // optimistic local update so UI feels instant
    setVm((prev) => {
      if (!prev) return prev;
      const prevCount = typeof prev.rsvpCount === 'number' ? prev.rsvpCount : 0;
      const newCount = nextDesired ? prevCount + 1 : Math.max(0, prevCount - 1);
      return {
        ...prev,
        userRsvped: nextDesired,
        rsvpCount: typeof prev.rsvpCount === 'number' ? newCount : prev.rsvpCount,
      };
    });

    setRsvpBusy(true);
    try {
      const res: any = await Event.rsvp(vm.eventId, nextDesired);
      // reconcile with authoritative server response
      setVm((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          userRsvped: typeof res?.going === 'boolean' ? res.going : nextDesired,
          rsvpCount: typeof res?.count === 'number' ? res.count : prev.rsvpCount,
          capacity: typeof res?.capacity === 'number' ? res.capacity : prev.capacity,
        };
      });
      // notify user of success
      Alert.alert('RSVP updated', nextDesired ? 'You are marked as going.' : 'You are no longer marked as going.');
    } catch (err) {
      console.error('Failed to toggle RSVP', err);
      // rollback optimistic update
      setVm(snapshot);
      Alert.alert('RSVP', 'Unable to update RSVP right now. Please try again.');
    } finally {
      setRsvpBusy(false);
    }
  }, [vm, rsvpBusy]);

  const onShare = useCallback(async () => {
    if (!vm) return;
    try {
      await Share.share({ message: `${vm.title} on VarsityHub`, url: bannerUrl ?? undefined });
    } catch {}
  }, [vm, bannerUrl]);

  const onPressLocation = useCallback(() => {
    if (vm?.location) openMaps(vm.location);
  }, [vm?.location]);

  const scrollToSection = useCallback(
    (key: SectionKey) => {
      setActiveSection(key);
      requestAnimationFrame(() => {
        const offset = sectionOffsets.current[key === 'media' ? 'media' : 'posts'];
        const node = scrollRef.current as any;
        if (node?.scrollTo) {
          node.scrollTo({ y: Math.max(0, offset - 64), animated: true });
        } else if (node?.getNode) {
          node.getNode().scrollTo({ y: Math.max(0, offset - 64), animated: true });
        }
      });
    },
    [],
  );

  const handleVote = useCallback(
    async (team: VoteOption) => {
      if (!vm?.gameId || vm.isPast || voteBusy) return;
      const previous = voteSummary ? { ...voteSummary } : null;
      const baseline = voteSummary ?? buildVoteSummary(0, 0, null);
      if (baseline.userVote === team) {
        return;
      }
      let nextA = baseline.teamA;
      let nextB = baseline.teamB;
      if (baseline.userVote === 'A') nextA = Math.max(0, nextA - 1);
      if (baseline.userVote === 'B') nextB = Math.max(0, nextB - 1);
      if (team === 'A') nextA += 1; else nextB += 1;
      setVoteSummary(buildVoteSummary(nextA, nextB, team));
      setVoteBusy(true);
      try {
        const res: any = await Game.castVote(vm.gameId, team);
        setVoteSummary(parseVoteSummary(res));
      } catch (err: any) {
        if (previous) setVoteSummary(previous); else setVoteSummary(null);
        if (err?.status === 401) {
          router.push('/sign-in');
        } else {
          console.error('Failed to submit vote', err);
          Alert.alert('Vote', 'Unable to update your vote right now. Please try again.');
        }
      } finally {
        setVoteBusy(false);
      }
    },
    [vm?.gameId, vm?.isPast, voteBusy, voteSummary, router],
  );

  const handleClearVote = useCallback(async () => {
    if (!vm?.gameId || vm.isPast || voteBusy || !voteSummary?.userVote) return;
    const previous = { ...voteSummary };
    const nextA = voteSummary.userVote === 'A' ? Math.max(0, voteSummary.teamA - 1) : voteSummary.teamA;
    const nextB = voteSummary.userVote === 'B' ? Math.max(0, voteSummary.teamB - 1) : voteSummary.teamB;
    setVoteSummary(buildVoteSummary(nextA, nextB, null));
    setVoteBusy(true);
    try {
      const res: any = await Game.clearVote(vm.gameId);
      setVoteSummary(parseVoteSummary(res));
    } catch (err: any) {
      setVoteSummary(previous);
      if (err?.status === 401) {
        router.push('/sign-in');
      } else {
        console.error('Failed to clear vote', err);
        Alert.alert('Vote', 'Unable to update your vote right now. Please try again.');
      }
    } finally {
      setVoteBusy(false);
    }
  }, [vm?.gameId, vm?.isPast, voteBusy, voteSummary, router]);

  const renderStoriesCarousel = () => {
    const mediaItems = (vm?.media ?? []).map((m) => ({ id: m.id, url: m.url, kind: m.kind }));
    if (!mediaItems.length) return null;
    return (
      <View style={styles.storiesWrap}>
        <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
          {mediaItems.map((it, idx) => {
            const isVideo = it.kind === 'video' || (typeof it.url === 'string' && VIDEO_EXT.test(it.url));
            const wasSeen = !!seenStories[it.id];
            return (
              <Pressable
                key={`${it.id}-${idx}`}
                style={[styles.storyItem, styles.storyItemGap, wasSeen ? styles.storyItemSeen : null]}
                onPress={() => setStoriesViewer({ visible: true, items: mediaItems as any, index: idx })}
              >
                <View style={styles.storyTile}>
                  {isVideo ? (
                    <View style={[styles.storyThumb, styles.storyThumbVideo]}>
                      <Ionicons name="play" size={18} color="#fff" />
                    </View>
                  ) : (
                    <Image source={{ uri: it.url }} style={styles.storyThumb} contentFit="cover" transition={0} cachePolicy="memory-disk" recyclingKey={it.url}
                    />
                  )}
                  {wasSeen ? <View style={styles.storySeenOverlay} /> : null}
                </View>
              </Pressable>
            );
          })}
        </Animated.ScrollView>
      </View>
    );
  };

  // inline StoriesViewer removed; using top-level component below


const renderVoteSection = () => {
  if (!vm?.gameId) return null;
  const summary = voteSummary ?? buildVoteSummary(0, 0, null);
  const total = summary.total ?? 0;
  const hasVotes = total > 0;
  const pctA = hasVotes ? Math.max(0, Math.min(100, summary.pctA ?? 0)) : 50;
  const pctB = hasVotes ? Math.max(0, Math.min(100, summary.pctB ?? 0)) : 50;
  const leftLabel = `${teamALabel} � ${Math.round(pctA)}%`;
  const rightLabel = `${teamBLabel} � ${Math.round(pctB)}%`;
  const pressDisabled = Boolean(vm?.isPast) || voteBusy;
  const selectedTeam = summary.userVote ?? null;
  const showFloatLabelA = pctA < 12;
  const showFloatLabelB = pctB < 12;
  const votesWord = total === 1 ? 'vote' : 'votes';
  const pickLabel = (
    selectedTeam === 'A'
      ? teamALabel
      : selectedTeam === 'B'
      ? teamBLabel
      : null
  );
  const caption = voteSummary
    ? `${total} ${votesWord} � ${pickLabel ? `Your pick: ${pickLabel}` : "You haven't voted"}`
    : 'Loading votes...';
  const showInlineCaption =
    caption !== 'Loading votes...' &&
    !showFloatLabelA &&
    !showFloatLabelB &&
    windowWidth - 32 >= 280;

  return (
    <View style={styles.voteWrapper}>
      {/* Labels above the voting bars */}
      <View style={styles.voteLabelsAbove}>
        {!showFloatLabelA ? (
          <View style={styles.voteLabelAboveLeft}>
            <Text
              style={[
                styles.voteLabelAboveText,
                selectedTeam === 'A' ? null : styles.voteLabelTextDim,
              ]}
              numberOfLines={1}
            >
              {leftLabel}
            </Text>
          </View>
        ) : (
          <View style={styles.voteLabelAboveLeft} />
        )}
        {!showFloatLabelB ? (
          <View style={styles.voteLabelAboveRight}>
            <Text
              style={[
                styles.voteLabelAboveText,
                selectedTeam === 'B' ? null : styles.voteLabelTextDim,
              ]}
              numberOfLines={1}
            >
              {rightLabel}
            </Text>
          </View>
        ) : (
          <View style={styles.voteLabelAboveRight} />
        )}
      </View>
      
      <View
        style={[
          styles.voteBar,
          pressDisabled ? styles.voteBarDisabled : null,
        ]}
      >
        <Animated.View
          style={[styles.voteFill, styles.voteFillA, { flex: voteAnimated.A }]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.voteFillHighlight}
          />
        </Animated.View>
        <Animated.View
          style={[styles.voteFill, styles.voteFillB, { flex: voteAnimated.B }]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.voteFillHighlight}
          />
        </Animated.View>

        {showInlineCaption ? (
          <View style={styles.voteLabelCenter}>
            <Text style={styles.voteCaptionInline}>{caption}</Text>
          </View>
        ) : null}
        <View
          style={styles.voteTouchLayer}
          pointerEvents={pressDisabled ? 'none' : 'auto'}
        >
          <Pressable
            style={styles.voteTouchHalf}
            disabled={pressDisabled}
            accessibilityRole="button"
            accessibilityLabel={`Vote for ${teamALabel}`}
            onPress={() => handleVote('A')}
            onLongPress={selectedTeam === 'A' ? handleClearVote : undefined}
            delayLongPress={300}
          />
          <Pressable
            style={styles.voteTouchHalf}
            disabled={pressDisabled}
            accessibilityRole="button"
            accessibilityLabel={`Vote for ${teamBLabel}`}
            onPress={() => handleVote('B')}
            onLongPress={selectedTeam === 'B' ? handleClearVote : undefined}
            delayLongPress={300}
          />
        </View>
      </View>
      {showFloatLabelA ? (
        <View style={[styles.voteFloatPill, styles.voteFloatLeft]}>
          <Text style={styles.voteFloatText}>{leftLabel}</Text>
        </View>
      ) : null}
      {showFloatLabelB ? (
        <View style={[styles.voteFloatPill, styles.voteFloatRight]}>
          <Text style={styles.voteFloatText}>{rightLabel}</Text>
        </View>
      ) : null}
      {showInlineCaption ? null : (
        <Text style={styles.voteCaptionBelow}>{caption}</Text>
      )}
    </View>
  );
};




  const renderBanner = () => {
  // Prefer a full MatchBanner hero if both teams have logos available
  const leftLogo = vm?.homeTeam ? getTeamLogo(vm.homeTeam) : null;
  const rightLogo = vm?.awayTeam ? getTeamLogo(vm.awayTeam) : null;
  const isHero = Boolean(leftLogo && rightLogo);
  const bannerHeight = isHero ? 320 : 200;

    // attempt to pull team color accents from vm.teams if present
    const homeTeamObj = vm?.teams?.find((t: any) => t.name === vm?.homeTeam)
    const awayTeamObj = vm?.teams?.find((t: any) => t.name === vm?.awayTeam)
    const heroBanner = leftLogo && rightLogo ? (
      <MatchBanner
        leftImage={leftLogo}
        rightImage={rightLogo}
        leftName={vm?.homeTeam ?? ''}
        rightName={vm?.awayTeam ?? ''}
        height={bannerHeight}
        variant="full"
        hero={true}
        appearance={(vm as any)?.appearance || 'classic'}
        headerFade={headerOpacity}
        onVsPress={() => setVsModalOpen(true)}
        leftColor={(homeTeamObj as any)?.color}
        rightColor={(awayTeamObj as any)?.color}
        goingCount={goingCount}
        onGoingPress={onToggleRsvp}
      />
    ) : (
      bannerUrl ? (
        <>
          {console.log('Rendering banner image with URL:', bannerUrl)}
          <Image source={{ uri: bannerUrl }} style={styles.bannerImage} contentFit="cover" />
        </>
      ) : (
        <>
          {console.log('No banner URL found, showing gradient placeholder')}
          <LinearGradient colors={PLACEHOLDER_GRADIENT} style={styles.bannerImage} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        </>
      )
    );

      return (
        <View style={[styles.bannerWrapper, { height: bannerHeight }]}>
          {heroBanner}
    {/* Shade the banner less when this is a hero image so logos are visible */}
    <LinearGradient pointerEvents="none" colors={isHero ? ['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.35)'] : ['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.75)']} style={styles.bannerShade} />

        {/* Team Logos Overlay (kept for cases where only one team has a logo) */}
        {(!leftLogo || !rightLogo) && (vm?.homeTeam || vm?.awayTeam) && (
          <View style={styles.teamLogosOverlay}>
            <View style={styles.teamMatchup}>
              {/* Home Team Logo */}
              <View style={styles.teamSideInBanner}>
                <View style={styles.teamLogoInBanner}>
                  {getTeamLogo(vm?.homeTeam || '') ? (
                    <Image 
                      source={{ uri: getTeamLogo(vm?.homeTeam || '') }} 
                      style={styles.teamLogoImage}
                    />
                  ) : (
                    <Text style={styles.teamLogoEmojiInBanner}>🏠</Text>
                  )}
                </View>
              </View>
              {/* VS Divider */}
              <View style={styles.vsDividerInBanner}>
                <View style={styles.vsCircleInBanner}>
                  <Text style={styles.vsTextInBanner}>VS</Text>
                </View>
              </View>
              {/* Away Team Logo */}
              <View style={styles.teamSideInBanner}>
                <View style={styles.teamLogoInBanner}>
                  {getTeamLogo(vm?.awayTeam || '') ? (
                    <Image 
                      source={{ uri: getTeamLogo(vm?.awayTeam || '') }} 
                      style={styles.teamLogoImage}
                    />
                  ) : (
                    <Text style={styles.teamLogoEmojiInBanner}>✈️</Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}
        
        <View style={[styles.bannerTopRow, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.circleButton}>
            <Ionicons name="chevron-back" size={20} color={Colors[colorScheme].text} />
          </Pressable>
          <View style={styles.bannerTopRightRow}>
            {hasEvent ? (
              <Pressable
                onPress={openRsvpSheet}
                style={[
                  styles.circleButton,
                  gamePhase !== 'upcoming' ? styles.rsvpDisabled : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Event RSVP"
                accessibilityHint={rsvpChipLabel}
              >
                <Ionicons
                  name={gamePhase === 'upcoming' ? (vm?.userRsvped ? 'checkmark-circle' : 'add-circle-outline') : 'lock-closed'}
                  size={18}
                  color={gamePhase === 'upcoming' ? (vm?.userRsvped ? '#0f172a' : '#2563EB') : '#6B7280'}
                />
              </Pressable>
            ) : null}
            <Pressable onPress={onShare} accessibilityRole="button" style={styles.circleButton}>
              <Ionicons name="share-outline" size={18} color={Colors[colorScheme].text} />
            </Pressable>
          </View>
        </View>
        <View style={styles.bannerBottomRow}>
          <View style={styles.bannerBottomLeft}>
            <View style={styles.dateChip}>
              <Ionicons name="calendar" size={14} color={Colors[colorScheme].tint} />
              <Text style={styles.dateChipText}>{displayDate || 'Upcoming Game'}</Text>
              {displayTime ? <Text style={styles.dateChipTime}>{displayTime}</Text> : null}
            </View>
            {gamePhase === 'upcoming' ? (
              <View style={[styles.statusChip, styles.statusUpcoming]}>
                <Text style={styles.statusText}>Starts in {formatCountdown(startsInMs)}</Text>
              </View>
            ) : gamePhase === 'live' ? (
              <View style={[styles.statusChip, styles.statusLive]}>
                <Animated.View
                  style={[
                    styles.liveDot,
                    {
                      transform: [
                        {
                          scale: livePulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.25] }),
                        },
                      ],
                      opacity: livePulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }),
                    },
                  ]}
                />
                <Text style={styles.statusText}>LIVE</Text>
              </View>
            ) : (
              <View style={[styles.statusChip, styles.statusFinal]}>
                <Text style={styles.statusText}>FINAL</Text>
              </View>
            )}
          </View>
          {/* RSVP moved to top bar */}
        </View>
      </View>
    );
  };

  const renderStats = () => {
    const stats = [
      { key: 'going', label: 'Going', value: goingCount != null ? String(goingCount) : '\u2014' },
      { key: 'reviews', label: 'Reviews', value: vm?.reviewsCount != null ? String(vm.reviewsCount) : '\u2014' },
      { key: 'media', label: 'Stories', value: vm?.media?.length ? String(vm.media.length) : '0' },
    ];
    return (
      <View style={styles.statRow}>
        {stats.map((stat) => (
          <View key={stat.key} style={styles.statCard}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderTeams = () => {
    if (!vm?.teams?.length) {
      return (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginVertical: 12 }}>
          {[0, 1].map((i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 18, padding: 18, minHeight: 120, opacity: 0.7 }}>
              <Ionicons name="people" size={32} color={Colors[colorScheme].mutedText} style={{ marginBottom: 8 }} />
              <Text style={{ color: Colors[colorScheme].mutedText, fontWeight: '700', fontSize: 16, marginBottom: 4 }}>Team {i === 0 ? 'A' : 'B'}</Text>
              <Text style={{ color: Colors[colorScheme].mutedText, fontSize: 13 }}>No team linked</Text>
            </View>
          ))}
        </View>
      );
    }
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginVertical: 12 }}>
        {vm.teams.slice(0, 2).map((team) => (
          <Pressable
            key={team.id}
            style={{ flex: 1, alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 18, padding: 18, minHeight: 120, elevation: 2 }}
            onPress={() => router.push({ pathname: '/team-viewer', params: { id: team.id } })}
            accessibilityRole="button"
            accessibilityLabel={`View team ${team.name}`}
          >
            {team.avatarUrl ? (
              <Image source={{ uri: team.avatarUrl }} style={{ width: 48, height: 48, borderRadius: 24, marginBottom: 8 }} contentFit="cover" />
            ) : (
              <Ionicons name="people" size={32} color={Colors[colorScheme].tint} style={{ marginBottom: 8 }} />
            )}
            <Text style={{ color: Colors[colorScheme].text, fontWeight: '700', fontSize: 16, marginBottom: 4 }}>{team.name}</Text>
            <Text style={{ color: Colors[colorScheme].mutedText, fontSize: 13 }}>Tap for details</Text>
          </Pressable>
        ))}
      </View>
    );
  };

  // Sanitize generic placeholder descriptions
  const displayDescription = useMemo(() => {
    const s = (vm?.description || '').replace(/\s+/g, ' ').trim();
    if (!s) return null;
    if (/^friendly match$/i.test(s)) return null;
    return s;
  }, [vm?.description]);

  const renderMediaGrid = () => {
    if (!vm?.media?.length) {
      return <Text style={styles.muted}>Add photos & videos to showcase this game.</Text>;
    }
    return (
      <View style={styles.mediaGrid}>
        {vm.media.map((item) => {
          const isVideo = item.kind === 'video' || VIDEO_EXT.test(item.url);
          return (
            <Pressable
              key={item.id}
              style={styles.mediaThumb}
              onPress={() => setViewer({ visible: true, url: item.url, kind: isVideo ? 'video' : 'photo' })}
            >
              {isVideo ? (
                <View style={[styles.mediaThumbContent, styles.mediaVideo]}>
                  <Ionicons name="play" size={24} color={Colors[colorScheme].text} />
                </View>
              ) : (
                <Image source={{ uri: item.url }} style={styles.mediaThumbContent} contentFit="cover" />
              )}
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <Animated.View
        style={[styles.headerWrap, { transform: [{ translateY: headerTranslateY }], opacity: headerOpacity }]}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h && Math.abs(h - headerH) > 1) setHeaderH(h);
        }}
      >
        {vm ? (
          <>
            {renderBanner()}
          </>
        ) : null}
      </Animated.View>

      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors[colorScheme].tint} />}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: feedY } } }], { useNativeDriver: true, listener: handleScroll })}
        scrollEventThrottle={16}
      >
        <View style={{ height: headerH }} />
        <View style={styles.content}>
          {loading && !refreshing ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#2563EB" />
            </View>
          ) : null}
          {error && !loading ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryBtn} onPress={() => load()}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : null}
          {vm && !loading ? (
            <>
              <View style={styles.tabRowWrap}>
                <View style={styles.tabRowCapsule}>
                  {(['overview', 'media', 'posts'] as SectionKey[]).map((key) => (
                    <Pressable
                      key={key}
                      style={({ pressed }) => [
                        styles.tabBtnCapsule,
                        activeSection === key ? styles.tabBtnCapsuleOn : null,
                        pressed ? { opacity: 0.85 } : null,
                      ]}
                      onPress={() => {
                        if (key === 'overview') setActiveSection('overview');
                        else scrollToSection(key);
                      }}
                    >
                      <Text style={[styles.tabText, activeSection === key ? styles.tabTextOn : null]}>
                        {key === 'overview' ? 'Overview' : key === 'media' ? 'Stories' : 'Posts'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <Text style={styles.title}>{vm.title}</Text>
              {renderVoteSection()}
              {vm.location ? (
                <Pressable style={styles.locationRow} onPress={onPressLocation}>
                  <Ionicons name="location" size={16} color="#2563EB" />
                  <Text style={styles.locationText}>{vm.location}</Text>
                </Pressable>
              ) : null}

              {/* Removed the under-game actions row (Reviews, Stories, Share) per request */}
              <View style={styles.secondaryActionsRow}>
                <Pressable
                  style={[styles.actionBtn, !vm?.gameId ? styles.actionBtnDisabled : null]}
                  onPress={handleAddStory}
                  disabled={!vm?.gameId}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#2563EB" />
                  <Text style={styles.actionText}>Add Story</Text>
                </Pressable>
              </View>
              {/* Stories carousel (only stories section). Also anchor the Stories tab to this position. */}
              <View
                onLayout={(e) => {
                  sectionOffsets.current.media = e.nativeEvent.layout.y;
                }}
              >
                {renderStoriesCarousel()}
              </View>

              <View style={styles.section}>
                {displayDescription ? <Text style={styles.bodyText}>{displayDescription}</Text> : <Text style={styles.muted}>No description yet.</Text>}
              </View>

              {/* Removed the secondary stories grid section to avoid duplication. */}

              <View
                style={styles.section}
                onLayout={(e) => {
                  sectionOffsets.current.posts = e.nativeEvent.layout.y;
                }}
              >
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Posts</Text>
                  <Text style={styles.sectionSubtitle}>{postsSubtitle}</Text>
                </View>
                {postsCount ? null : (
                  <Text style={[styles.muted, styles.sectionHelper]}>Be the first to share a highlight for this game.</Text>
                )}


                <Pressable
                  style={styles.verticalFeedPreview}
                  onPress={() => setVerticalFeedOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Open vertical highlights"
                >
                  {previewImage ? (
                    <Image source={{ uri: previewImage }} style={styles.verticalFeedImage} contentFit="cover" />
                  ) : (
                    <LinearGradient
                      colors={['#1e293b', '#0f172a']}
                      style={styles.verticalFeedImage}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />
                  )}
                  <LinearGradient
                    colors={['rgba(15,23,42,0.15)', 'rgba(15,23,42,0.85)']}
                    style={styles.verticalFeedShade}
                  />
                  <View style={styles.verticalFeedContent}>
                    <View style={styles.verticalFeedBadge}>
                      <Ionicons name="play" size={18} color="#fff" />
                    </View>
                    <Text style={styles.verticalFeedTitle}>Open vertical highlights</Text>
                    <Text style={styles.verticalFeedSubtitle}>{postsCount ? `${postsCount} fan highlight${postsCount === 1 ? '' : 's'} ready to watch` : 'Swipe through game-day clips'}</Text>
                  </View>
                </Pressable>
                <View style={styles.verticalFeedActions}>
                  <Pressable
                    style={[styles.postCtaBtn, !vm?.gameId ? styles.postCtaBtnDisabled : null]}
                    onPress={handleCreatePost}
                    disabled={!vm?.gameId}
                    accessibilityRole="button"
                    accessibilityLabel="Create a new post for this game"
                  >
                    <Ionicons name="create-outline" size={16} color="#fff" />
                    <Text style={styles.postCtaText}>Share a post</Text>
                  </Pressable>
                </View>
              </View>
            </>
          ) : null}
        </View>
      </Animated.ScrollView>

      <Modal
        visible={!!viewer?.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setViewer(null)}
      >
        <Pressable style={styles.viewerBackDrop} onPress={() => setViewer(null)}>
          <View style={styles.viewerContent}>
            {viewer?.url ? (
              viewer.kind === 'video' ? (
                <VideoPlayer uri={viewer.url} style={styles.viewerMedia} />
              ) : (
                <Image source={{ uri: viewer.url }} style={styles.viewerMedia} contentFit="contain" />
              )
            ) : null}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={verticalFeedOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setVerticalFeedOpen(false)}
      >
        <View style={styles.verticalFeedModal}>
          <GameVerticalFeedScreen
            onClose={() => setVerticalFeedOpen(false)}
            gameId={vm?.gameId || null}
            excludeMediaUrls={(vm?.media || []).map((m) => m.url).filter(Boolean) as string[]}
          />
        </View>
      </Modal>

      {/* VS quick modal - interactive quick poll */}
      <Modal visible={vsModalOpen} animationType="fade" transparent onRequestClose={() => setVsModalOpen(false)}>
        <Pressable style={styles.vsModalBackdrop} onPress={() => setVsModalOpen(false)}>
          <Pressable style={styles.vsModalCard} onPress={() => {}}>
            <Text style={styles.vsModalTitle}>{vm?.homeTeam && vm?.awayTeam ? `${vm.homeTeam} vs ${vm.awayTeam}` : 'Matchup'}</Text>

            {/* Poll row */}
            <View style={styles.vsPollRow}>
              {(() => {
                const summary = voteSummary ?? buildVoteSummary(0, 0, null);
                const pctA = summary.total ? Math.round(summary.pctA) : 50;
                const pctB = summary.total ? Math.round(summary.pctB) : 50;
                const selected = summary.userVote;
                const disabled = Boolean(vm?.isPast) || voteBusy;
                const bgA = themeBgA;
                const bgOn = themeBgOn;
                const textColor = themeTextColor;
                return (
                  <>
                    <Animated.View style={{ flex: 1, transform: [{ scale: vsScaleA }] }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${teamALabel} vote`}
                        accessibilityHint={selected === 'A' ? 'Tap to clear your vote' : 'Tap to vote for this team'}
                        style={[styles.vsTeamCard, { backgroundColor: selected === 'A' ? bgOn : bgA } as any]}
                        onPress={() => {
                          if (selected === 'A') {
                            handleClearVote();
                            if (!prefersReducedMotion) Animated.spring(vsScaleA, { toValue: 1, useNativeDriver: true }).start();
                          } else {
                            handleVote('A');
                            if (!prefersReducedMotion) Animated.sequence([
                              Animated.spring(vsScaleA, { toValue: 1.06, useNativeDriver: true }),
                              Animated.spring(vsScaleA, { toValue: 1, useNativeDriver: true }),
                            ]).start();
                          }
                        }}
                        disabled={disabled}
                      >
                        <Text style={[styles.vsTeamName, { color: selected === 'A' ? '#fff' : textColor }]}>{teamALabel}</Text>
                        <Text style={[styles.vsTeamPct, { color: selected === 'A' ? '#fff' : textColor }]}>{displayPctA}%</Text>
                        <Text style={[styles.vsTeamVotes, { color: selected === 'A' ? 'rgba(255,255,255,0.9)' : '#64748b' }]}>{String(summary.teamA)} votes</Text>

                        <View style={styles.vsPctBarWrap} accessibilityElementsHidden>
                          <Animated.View
                            style={[
                              styles.vsPctBarFill,
                              {
                                width: pctAnimA.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) as any,
                                backgroundColor: selected === 'A' ? bgOn : undefined,
                              },
                            ]}
                          />
                        </View>
                      </Pressable>
                    </Animated.View>

                    <View style={styles.vsDivider} />

                    <Animated.View style={{ flex: 1, transform: [{ scale: vsScaleB }] }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${teamBLabel} vote`}
                        accessibilityHint={selected === 'B' ? 'Tap to clear your vote' : 'Tap to vote for this team'}
                        style={[styles.vsTeamCard, { backgroundColor: selected === 'B' ? bgOn : bgA } as any]}
                        onPress={() => {
                          if (selected === 'B') {
                            handleClearVote();
                            if (!prefersReducedMotion) Animated.spring(vsScaleB, { toValue: 1, useNativeDriver: true }).start();
                          } else {
                            handleVote('B');
                            if (!prefersReducedMotion) Animated.sequence([
                              Animated.spring(vsScaleB, { toValue: 1.06, useNativeDriver: true }),
                              Animated.spring(vsScaleB, { toValue: 1, useNativeDriver: true }),
                            ]).start();
                          }
                        }}
                        disabled={disabled}
                      >
                        <Text style={[styles.vsTeamName, { color: selected === 'B' ? '#fff' : textColor }]}>{teamBLabel}</Text>
                        <Text style={[styles.vsTeamPct, { color: selected === 'B' ? '#fff' : textColor }]}>{displayPctB}%</Text>
                        <Text style={[styles.vsTeamVotes, { color: selected === 'B' ? 'rgba(255,255,255,0.9)' : '#64748b' }]}>{String(summary.teamB)} votes</Text>

                        <View style={styles.vsPctBarWrap} accessibilityElementsHidden>
                          <Animated.View
                            style={[
                              styles.vsPctBarFill,
                              {
                                width: pctAnimB.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) as any,
                                backgroundColor: selected === 'B' ? bgOn : undefined,
                              },
                            ]}
                          />
                        </View>
                      </Pressable>
                    </Animated.View>
                  </>
                );
              })()}
            </View>

            <Text style={styles.vsModalBody}>{vm?.isPast ? 'Game finished' : 'Tap a side to vote or tap again to clear your vote.'}</Text>

            <Pressable style={styles.vsModalClose} onPress={() => setVsModalOpen(false)}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {storiesViewer?.visible ? (
        <StoriesViewer
          visible={storiesViewer.visible}
          items={storiesViewer.items}
          index={storiesViewer.index}
          onClose={() => setStoriesViewer(null)}
          onSeen={(id) => setSeenStories((prev) => (prev[id] ? prev : { ...prev, [id]: true }))}
        />
      ) : null}
      {/* RSVP Bottom Sheet */}
      <Modal
        visible={rsvpSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRsvpSheetOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={closeRsvpSheet}>
          <View />
        </Pressable>
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHandleBar} />
          <View style={styles.sheetHeaderRow}>
            <Ionicons name="people" size={18} color="#2563EB" />
            <Text style={styles.sheetTitle}>{rsvpChipLabel || 'Event RSVP'}</Text>
          </View>

          {gamePhase === 'upcoming' ? (
            <>
              <Pressable
                onPress={async () => { await onToggleRsvp(); setRsvpSheetOpen(false); }}
                disabled={rsvpBusy || !canRsvpNow}
                style={[styles.sheetPrimaryBtn, vm?.userRsvped ? styles.sheetBtnOn : null, (rsvpBusy || !canRsvpNow) ? styles.rsvpDisabled : null]}
                accessibilityRole="button"
                accessibilityLabel={vm?.userRsvped ? 'Mark not going' : 'RSVP going'}
              >
                <Ionicons name={vm?.userRsvped ? 'close-circle' : 'checkmark-circle'} size={18} color="#fff" />
                <Text style={styles.sheetPrimaryBtnText}>{vm?.userRsvped ? 'Mark not going' : 'I am going'}</Text>
              </Pressable>
              <Text style={styles.sheetNote}>You can change this anytime before kickoff.</Text>
            </>
          ) : (
            <Text style={styles.sheetNote}>RSVP is closed for this event.</Text>
          )}

          <View style={styles.sheetStatsRow}>
            <View style={styles.sheetStatCard}>
              <Text style={styles.sheetStatValue}>{goingCount != null ? String(goingCount) : '0'}</Text>
              <Text style={styles.sheetStatLabel}>{gamePhase === 'final' ? 'Went' : 'Going'}</Text>
            </View>
            {vm?.capacity ? (
              <View style={styles.sheetStatCard}>
                <Text style={styles.sheetStatValue}>{String(vm.capacity)}</Text>
                <Text style={styles.sheetStatLabel}>Capacity</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
      {showTopFab ? (
        <Pressable
          style={styles.fab}
          onPress={() => {
            const node = scrollRef.current as any;
            if (node?.scrollTo) {
              node.scrollTo({ y: 0, animated: true });
            } else if (node?.getNode) {
              node.getNode().scrollTo({ y: 0, animated: true });
            }
          }}
          accessibilityLabel="Back to top"
        >
          <Ionicons name="arrow-up" size={20} color="#fff" />
          <Text style={styles.fabText}>Top</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

export default GameDetailsScreen;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  bannerWrapper: { position: 'relative', height: 260, backgroundColor: '#eff6ff' },
  bannerImage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  bannerShade: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 },
  headerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
  backgroundColor: '#000',
  paddingBottom: 8,
  marginBottom: 12,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: 'rgba(17,24,39,0.92)',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 40,
  },
  fabText: { color: '#fff', fontWeight: '700' },


  voteWrapper: {
    marginTop: -2,
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 8,
    marginBottom: 12,
  },
  voteBar: {
    position: 'relative',
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  voteBarDisabled: { opacity: 0.65 },
  // RSVP sheet styles
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  sheetHandleBar: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    marginBottom: 10,
  },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  sheetPrimaryBtn: {
    marginTop: 4,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sheetBtnOn: { backgroundColor: '#ef4444' },
  sheetPrimaryBtnText: { color: '#fff', fontWeight: '700' },
  sheetNote: { marginTop: 10, color: '#6B7280' },
  sheetStatsRow: { marginTop: 16, flexDirection: 'row', gap: 10 },
  sheetStatCard: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  sheetStatValue: { fontSize: 18, fontWeight: '800', color: '#111827' },
  sheetStatLabel: { marginTop: 2, fontSize: 12, color: '#6B7280', fontWeight: '600' },
  voteFill: { height: '100%', overflow: 'hidden' },
  voteFillA: {
    backgroundColor: '#2563EB',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  voteFillB: {
    backgroundColor: '#10B981',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  voteFillHighlight: { ...StyleSheet.absoluteFillObject, pointerEvents: 'none' },
  voteLabelLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  voteLabelCell: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  voteLabelCellLeft: { alignItems: 'center', marginRight: 16 },
  voteLabelCellRight: { alignItems: 'center', marginLeft: 16 },
  voteLabelCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voteLabelText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  voteLabelTextDim: { opacity: 0.7 },
  voteLabelsAbove: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  voteLabelAboveLeft: {
    flex: 1,
    alignItems: 'flex-start',
    marginRight: 16,
  },
  voteLabelAboveRight: {
    flex: 1,
    alignItems: 'flex-end',
    marginLeft: 16,
  },
  voteLabelAboveText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 12,
  },
  voteCaptionInline: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
  },
  voteCaptionBelow: {
    marginTop: 6,
    textAlign: 'center',
    color: '#6B7280',
    fontWeight: '600',
    paddingHorizontal: 12,
  },
  voteTouchLayer: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  voteTouchHalf: { flex: 1 },
  voteFloatPill: {
    position: 'absolute',
    top: -18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  voteFloatLeft: { left: 28 },
  voteFloatRight: { right: 28 },
  voteFloatText: { color: '#0f172a', fontWeight: '700', fontSize: 12, textAlign: 'center' },

  bannerTopRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerTopRightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerBottomRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerBottomLeft: { flexDirection: 'column', gap: 8, maxWidth: '70%' },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dateChipText: { fontWeight: '700', color: '#111827', fontSize: 13 },
  dateChipTime: { fontWeight: '600', color: '#2563EB', fontSize: 13 },
  statusChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  statusUpcoming: { backgroundColor: 'rgba(219,234,254,0.95)', borderWidth: StyleSheet.hairlineWidth, borderColor: '#bfdbfe' },
  statusLive: { backgroundColor: 'rgba(254,226,226,0.95)', borderWidth: StyleSheet.hairlineWidth, borderColor: '#fecaca' },
  statusFinal: { backgroundColor: 'rgba(229,231,235,0.95)', borderWidth: StyleSheet.hairlineWidth, borderColor: '#d1d5db' },
  statusText: { fontWeight: '800', color: '#0f172a' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  rsvpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#BFDBFE',
  },
  rsvpOn: { backgroundColor: '#c7d2fe', borderColor: '#818cf8' },
  rsvpDisabled: { opacity: 0.6 },
  rsvpText: { fontWeight: '700', color: '#2563EB' },
  rsvpTextOn: { color: '#0f172a' },
  rsvpTopInline: { paddingHorizontal: 10, paddingVertical: 6 },
  rsvpTextInline: { fontSize: 13 },
  finalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(254,226,226,0.9)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  finalText: { color: '#991b1b', fontWeight: '700' },
  circleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  loadingBox: { paddingVertical: 24, alignItems: 'center' },
  errorBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#fecaca',
    marginBottom: 16,
  },
  errorText: { color: '#991b1b', fontWeight: '600', marginBottom: 8 },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: { color: 'white', fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '900', color: '#0f172a', marginBottom: 6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  locationText: { color: '#1f2937', fontWeight: '600', textDecorationLine: 'underline' },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  secondaryActionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    marginHorizontal: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
  },
  actionBtnDisabled: { opacity: 0.6 },
  actionText: { fontWeight: '700', color: '#0f172a' },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    backgroundColor: '#eef2ff',
    borderRadius: 999,
    padding: 4,
  },
  tabRowWrap: { marginBottom: 12, paddingHorizontal: 8 },
  tabRowCapsule: { flexDirection: 'row', backgroundColor: '#eef2ff', borderRadius: 999, padding: 6, alignItems: 'center', justifyContent: 'center' },
  tabBtnCapsule: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, marginHorizontal: 4 },
  tabBtnCapsuleOn: { backgroundColor: '#fff', borderWidth: StyleSheet.hairlineWidth, borderColor: '#c7d2fe' },
  tabBtn: { flex: 1, borderRadius: 999, alignItems: 'center', paddingVertical: 8 },
  tabBtnOn: { backgroundColor: 'white', borderWidth: StyleSheet.hairlineWidth, borderColor: '#c7d2fe' },
  tabText: { fontWeight: '600', color: '#475569' },
  tabTextOn: { color: '#1e3a8a' },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 8 },
  sectionSubtitle: { color: '#64748b', fontWeight: '600' },
  sectionHelper: { marginBottom: 12 },
  bodyText: { color: '#334155', fontSize: 16, lineHeight: 24 },
  muted: { color: '#94a3b8', fontStyle: 'italic' },
  statRow: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  statLabel: { color: '#64748b', fontWeight: '600' },
  teamList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  teamPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e0f2fe', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  teamPillText: { fontWeight: '700', color: '#0c4a6e' },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mediaThumb: { width: '31%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#e2e8f0' },
  mediaThumbContent: { flex: 1 },
  mediaVideo: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  storiesWrap: { marginTop: 12 },
  storiesRow: { paddingHorizontal: 4, paddingVertical: 6 },
  storyItem: { width: 88, height: 140, borderRadius: 14, overflow: 'hidden' },
  storyItemGap: { marginLeft: 8 },
  storyTile: { flex: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: '#0f172a' },
  storyItemSeen: { opacity: 0.6 },
  storyTileCountdown: { alignItems: 'center', justifyContent: 'center', padding: 8, backgroundColor: '#0f172a' },
  storyTileLabel: { color: '#cbd5e1', fontWeight: '700', fontSize: 12, marginBottom: 6 },
  storyTileTime: { color: '#ffffff', fontWeight: '900', fontSize: 16 },
  storyLiveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  storyLiveText: { color: '#ffffff', fontWeight: '900' },
  storyFinalText: { color: '#e5e7eb', fontWeight: '800' },
  storyThumb: { flex: 1 },
  storyThumbVideo: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(2,6,23,0.85)' },
  storySeenOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,6,23,0.25)' },
  verticalFeedPreview: {
    marginTop: 16,
    borderRadius: 20,
    overflow: 'hidden',
    minHeight: 220,
    backgroundColor: '#0f172a',
  },
  verticalFeedImage: { ...StyleSheet.absoluteFillObject },
  verticalFeedShade: { ...StyleSheet.absoluteFillObject },
  verticalFeedContent: { position: 'absolute', left: 24, right: 24, bottom: 24, gap: 6, maxWidth: 260 },
  verticalFeedBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37,99,235,0.9)',
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 4,
  },
  verticalFeedTitle: { color: '#ffffff', fontWeight: '800', fontSize: 20, marginBottom: 6 },
  verticalFeedSubtitle: { color: '#cbd5f5', fontWeight: '600', fontSize: 13, marginTop: 2 },
  verticalFeedActions: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' },
  postCtaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2563EB', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, shadowColor: '#1e3a8a', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  postCtaBtnDisabled: { opacity: 0.6 },
  postCtaText: { color: '#ffffff', fontWeight: '700' },
  verticalFeedModal: { flex: 1, backgroundColor: '#020617' },
  viewerBackDrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.9)', alignItems: 'center', justifyContent: 'center' },
  viewerContent: { width: '90%', aspectRatio: 3 / 4, maxHeight: '80%' },
  viewerMedia: { width: '100%', height: '100%', borderRadius: 16 },
  // Story viewer styles
  storyViewerRoot: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  storyViewerTopBar: { position: 'absolute', left: 12, right: 12, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  storyTopLabel: { color: '#fff', fontWeight: '800' },
  storyCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  storyStage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  storyTouchLayer: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  storyTouchHalf: { flex: 1 },
  storyProgressRow: { flex: 1, flexDirection: 'row', gap: 4, marginRight: 8 },
  storyProgressSegment: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: 'transparent' },
  storyProgressTrack: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.35)' },
  storyProgressFillAbs: { ...StyleSheet.absoluteFillObject, backgroundColor: '#fff', transformOrigin: 'left center' as any },
  // Team logos banner overlay styles
  teamLogosOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 120,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  teamMatchup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  teamSideInBanner: {
    alignItems: 'center',
    gap: 4,
    minWidth: 80,
  },
  teamLogoInBanner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    overflow: 'hidden',
  },
  teamLogoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  teamLogoEmojiInBanner: {
    fontSize: 28,
  },
  teamNameInBanner: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  teamLabelInBanner: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  vsDividerInBanner: {
    alignItems: 'center',
    gap: 4,
    minWidth: 60,
  },
  vsCircleInBanner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(37,99,235,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  vsTextInBanner: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  // VS quick-modal styles
  vsModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  vsModalCard: {
    width: '86%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  vsModalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 8, textAlign: 'center' },
  vsModalBody: { color: '#6B7280', textAlign: 'center', marginBottom: 12 },
  vsModalClose: { backgroundColor: '#2563EB', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  vsPollRow: { flexDirection: 'row', width: '100%', gap: 8, marginVertical: 8 },
  vsTeamCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  vsTeamCardOn: { backgroundColor: '#2563EB', borderColor: '#1e40af' },
  vsTeamName: { fontWeight: '800', color: '#0f172a', marginBottom: 4, textAlign: 'center' },
  vsTeamPct: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  vsTeamVotes: { fontSize: 12, color: '#64748b', marginTop: 4 },
  vsDivider: { width: 12 },
  vsPctBarWrap: { width: '100%', height: 6, backgroundColor: '#e6eefc', borderRadius: 6, overflow: 'hidden', marginTop: 8 },
  vsPctBarFill: { height: '100%', backgroundColor: '#1e40af', width: '0%' },
});








