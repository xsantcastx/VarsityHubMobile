import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useDeviceLocation } from '@/hooks/useDeviceLocation';
import { useShareLink } from '@/hooks/useShareLink';
import { useThemeColor } from '@/hooks/useThemeColor';
import { retryWithBackoff } from '@/utils/retryWithBackoff';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { AccessibilityInfo, ActivityIndicator, Alert, Animated, Linking, Modal, Platform, Pressable, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiBaseUrl } from '../../api/http';
import MatchBanner from '../components/MatchBanner';

// @ts-ignore JS exports
import { Event, Game, Team, User } from '@/api/entities';
import { uploadFile } from '@/api/upload';
import VideoPlayer from '@/components/VideoPlayer';
import GameVerticalFeedScreen from './GameVerticalFeedScreen';

import type { ColorValue } from 'react-native';
const PLACEHOLDER_GRADIENT: readonly [ColorValue, ColorValue, ...ColorValue[]] = ['#1e293b', '#1d4ed8', '#38bdf8'];
const VIDEO_EXT = /\.(mp4|mov|webm|m4v|avi)$/i;
const GAME_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours live window
const isSampleId = (id?: string | null) => !!id && /^sample-/i.test(String(id));

type MediaItem = {
  id: string;
  url: string;
  kind: 'photo' | 'video';
  created_at?: string;
  caption?: string | null;
  user_id?: string | null;
};

type StoriesViewerProps = {
  visible: boolean;
  items: MediaItem[];
  index: number;
  onClose: () => void;
  onSeen: (id: string) => void;
  onDelete?: (id: string) => void;
  gameId?: string | null;
};

function StoriesViewer({ visible, items, index, onClose, onSeen, onDelete, gameId }: StoriesViewerProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const styles = useMemo(() => createStyles(colorScheme), [colorScheme]);
  const [current, setCurrent] = useState(index);
  const w = useWindowDimensions().width;
  const progress = useRef(new Animated.Value(0)).current;
  const [paused, setPaused] = useState(false);
  const progressFracRef = useRef(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Get current user ID
  useEffect(() => {
    if (visible) {
      User.me().then((user: any) => {
        setCurrentUserId(user?.id || null);
      }).catch(() => setCurrentUserId(null));
    }
  }, [visible]);

  // Sync starting index when viewer opens or caller changes it
  useEffect(() => {
    if (visible) setCurrent(index);
  }, [visible, index]);

  const goNext = useCallback(() => {
    setCurrent((prev) => {
      const next = prev + 1;
      if (next >= items.length) {
        // Defer onClose to avoid setState during render
        setTimeout(() => onClose(), 0);
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

  // Handle delete story
  const handleDelete = useCallback(async () => {
    const item = items[current];
    if (!item || !gameId || deleting) {
      return;
    }

    Alert.alert(
      'Delete Story',
      'Are you sure you want to delete this story? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await Game.deleteMedia(gameId, item.id);
              // Call parent's onDelete callback if provided
              if (onDelete) {
                onDelete(item.id);
              }
              // If this was the last item, close the viewer
              if (items.length === 1) {
                // Defer onClose to avoid setState during render
                setTimeout(() => onClose(), 0);
              } else {
                // Move to next item or previous if at the end
                if (current >= items.length - 1) {
                  goPrev();
                } else {
                  goNext();
                }
              }
            } catch (err) {
              console.error('Failed to delete story', err);
              Alert.alert('Error', 'Unable to delete story. Please try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [items, current, gameId, deleting, onDelete, onClose, goPrev, goNext]);

  // Reset progress when current changes and autoplay videos
  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
  }, [current, progress, items]);

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
  
  // Check if user can delete this story
  const canDelete = currentUserId && item?.user_id && currentUserId === item.user_id;
  
  // TEMP: Show delete button for all stories during testing
  const showDeleteButton = __DEV__ || canDelete;
  
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
          <View style={styles.storyTopRight}>
            <Text style={styles.storyTopLabel}>{current + 1} / {items.length}</Text>
            {showDeleteButton && (
              <Pressable 
                onPress={(e) => {
                  e?.stopPropagation?.();
                  void handleDelete();
                }}
                style={({ pressed }) => [
                  styles.storyDeleteBtn, 
                  { 
                    zIndex: 9999,
                    opacity: pressed ? 0.7 : 1,
                    transform: pressed ? [{ scale: 0.95 }] : [{ scale: 1 }]
                  }
                ]} 
                accessibilityLabel="Delete story"
                disabled={deleting}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="trash-outline" size={22} color={deleting ? '#9CA3AF' : '#EF4444'} />
              </Pressable>
            )}
            <Pressable 
              onPress={onClose} 
              style={styles.storyCloseBtn} 
              accessibilityLabel="Close stories"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={Colors[colorScheme].text} />
            </Pressable>
          </View>
        </View>

        <View
          style={styles.storyStage}
          needsOffscreenAlphaCompositing
          renderToHardwareTextureAndroid
          collapsable={false}
        >
            {isVideo ? (
              // Videos autoplay when story opens - no controls, just video
              <View style={{ width: w, aspectRatio: 9 / 16, backgroundColor: Colors[colorScheme].surface, alignItems: 'center', justifyContent: 'center' }}>
                <VideoPlayer 
                  key={item.id} 
                  uri={item.url} 
                  autoPlay={!paused} 
                  onEnd={goNext} 
                  nativeControls={false} 
                  paused={paused} 
                  style={{ width: '100%', height: '100%' }} 
                />
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

        <View style={styles.storyTouchLayer} pointerEvents="box-none">
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
  appearance?: string | null;
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

const canAddStory = (eventIso?: string | null) => {
  // Stories can only be added within 24 hours before the event starts
  if (!eventIso) return false;
  const eventDate = new Date(eventIso);
  if (Number.isNaN(eventDate.getTime())) return false;
  
  const now = Date.now();
  const eventTime = eventDate.getTime();
  const twentyFourHoursBeforeEvent = eventTime - (24 * 60 * 60 * 1000);
  
  // Can add story if we're within 24 hours before the event and event hasn't passed
  return now >= twentyFourHoursBeforeEvent && now <= eventTime;
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

// Special-case marquee matchup artwork for Warriors vs Cavaliers - local SVG data URI
const FINALS_HEADER_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1568' height='882'%3E%3Cdefs%3E%3ClinearGradient id='grad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%231e40af;stop-opacity:1' /%3E%3Cstop offset='50%25' style='stop-color:%23dc2626;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%23fbbf24;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1568' height='882' fill='url(%23grad)'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='80' font-weight='bold' fill='white' font-family='Arial'%3EWarriors vs Cavaliers%3C/text%3E%3Ctext x='50%25' y='60%25' dominant-baseline='middle' text-anchor='middle' font-size='60' fill='white' font-family='Arial'%3ENBA Finals%3C/text%3E%3C/svg%3E`;
const finalsBannerForTeams = (home?: string | null, away?: string | null, title?: string | null) => {
  const h = (home || '').trim().toLowerCase();
  const a = (away || '').trim().toLowerCase();
  const t = (title || '').trim().toLowerCase();

  const hasWarriors = h.includes('warriors') || a.includes('warriors') || /warriors/.test(t);
  const hasCavs = h.includes('cav') || a.includes('cav') || /cavaliers?/.test(t) || /cavs/.test(t);

  return hasWarriors && hasCavs ? FINALS_HEADER_SVG : null;
};

const pickBannerFromArrays = (vm: Partial<GameVM>, media: MediaItem[]) => {
  const finalsBanner = finalsBannerForTeams(vm.homeTeam, vm.awayTeam, vm.title as any);
  const result = vm.bannerUrl || vm.coverImageUrl || finalsBanner || media[0]?.url || null;
  return result;
};

const GameDetailsScreen = () => {
  const { id, eventId } = useLocalSearchParams<{ id: string; teamId?: string; eventId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const { location, loading: _locLoading, error: _locError, permissionGranted, requestPermission, needsPreciseAccuracy, openSettings } = useDeviceLocation();
  const scrollRef = useRef<any>(null);
  const sectionOffsets = useRef<{ media: number; posts: number }>({ media: 0, posts: 0 });

  const [vm, setVm] = useState<GameVM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [viewer, setViewer] = useState<{ visible: boolean; url: string | null; kind: 'photo' | 'video' } | null>(null);
  const [storyBusy, setStoryBusy] = useState(false);
  const [verticalFeedOpen, setVerticalFeedOpen] = useState(false);
  const [storiesViewer, setStoriesViewer] = useState<{ visible: boolean; items: MediaItem[]; index: number } | null>(null);
  const viewerOpenRef = useRef(false);
  const [seenStories, setSeenStories] = useState<Record<string, true>>({});
  const [nowTs, setNowTs] = useState(() => Date.now());
  const livePulse = useRef(new Animated.Value(0)).current;

  const [_voteSummary, setVoteSummary] = useState<VoteSummary | null>(null);
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
  const [preciseBannerDismissed, setPreciseBannerDismissed] = useState(false);
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

  // Dynamic styles based on color scheme
  const styles = useMemo(() => createStyles(colorScheme), [colorScheme]);

  // Banner for precise location on Android
  const showPreciseBanner = Platform.OS === 'android' && permissionGranted && needsPreciseAccuracy && !preciseBannerDismissed;

  useEffect(() => {
    showTopFabRef.current = false;
    setShowTopFab(false);
  }, [headerH]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => setPrefersReducedMotion(!!v)).catch(() => {});
    const ev = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setPrefersReducedMotion(!!v));
    return () => { try { ev?.remove?.(); } catch {} };
  }, []);

  // update display percentages from animated numeric values
  useEffect(() => {
    const idA = numAnimA.addListener(({ value }) => setDisplayPctA(Math.round(value)));
    const idB = numAnimB.addListener(({ value }) => setDisplayPctB(Math.round(value)));
    // initialize
    numAnimA.setValue(displayPctA);
    numAnimB.setValue(displayPctB);
    return () => {
      try { numAnimA.removeListener(idA); } catch {}
      try { numAnimB.removeListener(idB); } catch {}
    };
  }, [displayPctA, displayPctB, numAnimA, numAnimB]);

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

  const displayDate = formatDateLabel(vm?.date);
  const displayTime = formatTimeLabel(vm?.date);
  const goingCount = capCount(vm?.rsvpCount, vm?.capacity);
  // Force the Finals artwork whenever this matchup is detected, even if API banner/cover is missing
  const finalsBannerUrl = useMemo(() => {
    const title = (vm?.title || '').replace(/\s+/g, ' ').trim();
    let home = vm?.homeTeam || null;
    let away = vm?.awayTeam || null;

    if ((!home || !away) && title) {
      const parts = title.split(/\s+vs\.?\s+/i).map((part) => part.trim()).filter(Boolean);
      if (!home && parts[0]) home = parts[0];
      if (!away && parts[1]) away = parts[1];
    }

    return finalsBannerForTeams(home, away, title);
  }, [vm?.homeTeam, vm?.awayTeam, vm?.title]);

  const bannerUrl = useMemo(() => {
    if (finalsBannerUrl) return finalsBannerUrl;
    return pickBannerFromArrays(vm ?? {}, vm?.media ?? []);
  }, [vm, finalsBannerUrl]);

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
    // Prefer vm.teams (from backend payload) for accurate avatars
    const fromVm = vm?.teams?.find((t) => String(t.name || '').toLowerCase() === String(teamName || '').toLowerCase());
    if (fromVm && fromVm.avatarUrl) return fromVm.avatarUrl;
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
      void router.replace({ pathname: routeBase, params: { id: gameIdValue } });
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
      // Handle sample slugs locally to avoid noisy 404s
      if (/^sample-/i.test(gameIdValue)) {
        const parts = gameIdValue.replace(/^sample-/i, '').split(/[-_]+/).filter(Boolean);
        const toTitle = (s: string) => s ? s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
        const home = toTitle(parts[0] || 'Team A');
        const away = toTitle(parts[1] || 'Team B');
        const dateIso = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
        
        // Sample media/stories for demo carousel
        const sampleMedia = [
          {
            id: 'story-1',
            url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400',
            kind: 'photo' as const,
            created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            caption: 'Pre-game warmups 🔥',
            user_id: 'sample-user-1',
          },
          {
            id: 'story-2',
            url: 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=400',
            kind: 'photo' as const,
            created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
            caption: 'Crowd getting hyped! 🏀',
            user_id: 'sample-user-2',
          },
          {
            id: 'story-3',
            url: 'https://images.unsplash.com/photo-1515523110800-9415d13b84a8?w=400',
            kind: 'photo' as const,
            created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
            caption: 'Starting lineup announced',
            user_id: 'sample-user-3',
          },
          {
            id: 'story-4',
            url: 'https://images.unsplash.com/photo-1608245449230-4ac19066d2d0?w=400',
            kind: 'photo' as const,
            created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            caption: 'Arena is packed tonight! 🎉',
            user_id: 'sample-user-4',
          },
          {
            id: 'story-5',
            url: 'https://images.unsplash.com/photo-1519861531473-9200262188bf?w=400',
            kind: 'photo' as const,
            created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            caption: 'Let\'s go! Game time!',
            user_id: 'sample-user-5',
          },
        ];
        
        const vmPayload: GameVM = {
          id: gameIdValue,
          gameId: gameIdValue,
          eventId: null,
          title: `${home} vs ${away}`,
          date: dateIso,
          location: null,
          description: null,
          bannerUrl: null,
          coverImageUrl: null,
          homeTeam: home,
          awayTeam: away,
          capacity: null,
          rsvpCount: null,
          userRsvped: false,
          teams: [],
          posts: [],
          media: sampleMedia,
          reviewsCount: null,
          isPast: false,
        };
        setVm(vmPayload);
        return;
      }

      try {
        const summary: any = await retryWithBackoff(() => Game.summary(gameIdValue), {
          maxRetries: 2,
          initialDelayMs: 800,
          maxDelayMs: 4000,
        }).catch((err: any) => {
          // Treat 404 as missing summary without escalating
          if (err && err.status === 404) return null;
          throw err;
        });
        let gameRecord: any = null;
        let postsData: any = [];
        let mediaData: any = [];
        if (!summary) {
          // Only attempt record fetch if summary missing; suppress 404 noise
          gameRecord = await retryWithBackoff(() => Game.get(gameIdValue), {
            maxRetries: 2,
            initialDelayMs: 800,
            maxDelayMs: 4000,
          }).catch((err: any) => {
            if (err && err.status === 404) return null;
            console.warn('Game record fetch failed:', err?.message || err);
            return null;
          });
        }
        // If neither summary nor record exists, bail out to show error UI
        if (!summary && !gameRecord) {
          throw new Error('Game not found');
        }
        if (summary || gameRecord) {
          // Posts/media only fetched when a real game exists to avoid extra 404 logs
          [postsData, mediaData] = await Promise.all([
            Game.posts(gameIdValue, { limit: 100 }).catch(() => summary?.posts || []),
            Game.media(gameIdValue).catch(() => summary?.media || []),
          ]);
          // Ensure mediaData is always an array
          if (!Array.isArray(mediaData)) {
            mediaData = (mediaData as any)?.items || [];
          }
          // Ensure postsData is always an array
          if (!Array.isArray(postsData)) {
            postsData = (postsData as any)?.items || [];
          }
        }

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
      let appearance: string | null = null;

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
        // Extract team names - handle both string and object formats
        const summaryHome = summary.homeTeam ?? summary.home_team ?? null;
        const summaryAway = summary.awayTeam ?? summary.away_team ?? null;
        homeTeam = typeof summaryHome === 'string' ? summaryHome : (summaryHome as any)?.name || null;
        awayTeam = typeof summaryAway === 'string' ? summaryAway : (summaryAway as any)?.name || null;
        // Appearance field surfaced from backend
        appearance = (summary as any)?.appearance ?? (summary.event as any)?.appearance ?? null;
      }

      if (!summary && gameRecord) {
        eventIdValue = (gameRecord as any).event_id ?? null;
        location = gameRecord.location || null;
        description = gameRecord.description || null;
        bannerCandidate = gameRecord.banner_url || null; // Check game banner_url first
        cover = gameRecord.cover_image_url || null;
        dateIso = ensureIso(gameRecord.date) ?? null;
        title = gameRecord.title || '';
        isPast = computeIsPast(dateIso);
        // Extract team names - handle both string and object formats
        homeTeam = typeof gameRecord.home_team === 'string' 
          ? gameRecord.home_team 
          : (gameRecord.home_team as any)?.name || null;
        awayTeam = typeof gameRecord.away_team === 'string'
          ? gameRecord.away_team
          : (gameRecord.away_team as any)?.name || null;
        
        // Build teams array from homeTeam and awayTeam relations
        const teamsArray: TeamInfo[] = [];
        if (gameRecord.homeTeam && typeof gameRecord.homeTeam === 'object') {
          teamsArray.push({
            id: gameRecord.homeTeam.id,
            name: gameRecord.homeTeam.name,
            avatarUrl: (gameRecord.homeTeam as any).avatar_url || null,
          });
        }
        if (gameRecord.awayTeam && typeof gameRecord.awayTeam === 'object') {
          teamsArray.push({
            id: gameRecord.awayTeam.id,
            name: gameRecord.awayTeam.name,
            avatarUrl: (gameRecord.awayTeam as any).avatar_url || null,
          });
        }
        teams = teamsArray;
        // Appearance from game record if present
        appearance = (gameRecord as any)?.appearance ?? null;
      }

      if (!title) title = 'Game';
      if (!dateIso && gameRecord?.date) dateIso = ensureIso(gameRecord.date);
      if (!isPast) isPast = computeIsPast(dateIso);
      if (!bannerCandidate && summary?.event?.banner_url) bannerCandidate = summary.event.banner_url;
      if (!bannerCandidate && gameRecord?.banner_url) bannerCandidate = gameRecord.banner_url; // Fallback to game banner

      let eventDetails: any = null;
      if (eventIdValue) {
        eventDetails = await retryWithBackoff(() => Event.get(eventIdValue), {
          maxRetries: 2,
          initialDelayMs: 800,
          maxDelayMs: 4000,
        }).catch(() => null);
        if (eventDetails) {
          if (!location) location = eventDetails.location || null;
          if (!bannerCandidate) bannerCandidate = eventDetails.banner_url || null;
          if (!appearance) appearance = (eventDetails as any)?.appearance ?? null;
          if (typeof eventDetails.capacity === 'number' && capacity == null) capacity = eventDetails.capacity;
          if (typeof eventDetails.attendees_count === 'number' && rsvpCount == null) rsvpCount = eventDetails.attendees_count;
        }
        const rsvp = await retryWithBackoff(() => Event.rsvpStatus(eventIdValue), {
          maxRetries: 2,
          initialDelayMs: 800,
          maxDelayMs: 4000,
        }).catch(() => null);
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
        appearance,
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

      setVm(vmPayload);
      } catch (error) {
        console.error('Error in loadGameById:', error);
        throw error; // Re-throw to be caught by outer try-catch
      }
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
        bannerUrl: event?.banner_url || event?.cover_image_url || null,
        coverImageUrl: event?.cover_image_url || null,
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
    },
    [replaceToCanonicalGame],
  );

  const handleAddStory = useCallback(async () => {
    if (!vm?.gameId || storyBusy) return;

    // Request permissions first
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
      Alert.alert(
        'Permission Required',
        'You need to grant camera and photo library permissions to add a story.'
      );
      return;
    }

    // Request location permission for story tagging
    if (!permissionGranted || (Platform.OS === 'android' && needsPreciseAccuracy)) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Location Permission',
          'Stories can still post without location, but pins and discovery will be less accurate until you enable it.',
        );
      }
      if (Platform.OS === 'android' && needsPreciseAccuracy) {
        Alert.alert(
          'Enable Precise Location',
          'To tag stories to this game automatically, allow precise location in Android settings.',
          [
            { text: 'Skip', style: 'cancel', onPress: () => {} },
            {
              text: 'Open settings',
              onPress: () => {
                setPreciseBannerDismissed(true);
                void openSettings();
              },
            },
          ],
        );
      }
    }
    
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
                allowsEditing: false,
                exif: false,
                // On iOS, use the PhotoPicker (not the deprecated deprecated UIImagePickerController)
                // which returns proper file:// URIs instead of ph:// asset references
                legacy: false,
              };
              const result = await ImagePicker.launchCameraAsync(pickerOptions);
              if (!result || result.canceled || !result.assets || !result.assets.length) return;
              
              const asset = result.assets[0];
              const base = getApiBaseUrl();
              let uri = asset.uri;
              const mimeType = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
              const fileName = asset.fileName || uri.split('/').pop() || (mimeType.startsWith('video') ? 'story.mp4' : 'story.jpg');
              const ensured = await (await import('../../utils/ensureUploadableUri')).ensureUploadableUri(uri, mimeType);
              uri = ensured.uri; // use uploadable local file path when available

              const uploaded = await uploadFile(base, uri, fileName, mimeType);
              const mediaUrl = uploaded?.path || uploaded?.url;
              if (!mediaUrl) {
                throw new Error('Upload failed');
              }
              if (isSampleId(vm.gameId)) {
                // Local-only story for sample games; do not call backend
                setVm((prev) => {
                  if (!prev) return prev;
                  const newItem: MediaItem = { id: String(Date.now()), url: mediaUrl, kind: (mimeType?.startsWith('video') ? 'video' : 'photo') as any };
                  return { ...prev, media: [newItem, ...(prev.media || [])] } as GameVM;
                });
              } else {
                const storyPayload: any = { media_url: mediaUrl };
                if (location?.latitude && location?.longitude) {
                  storyPayload.location = { lat: location.latitude, lng: location.longitude, source: 'device' };
                }
                await Game.addStory(vm.gameId, storyPayload);
                try {
                  await loadGameById(vm.gameId);
                  Alert.alert('Added', isSampleId(vm.gameId) ? 'Story added (demo only).' : 'Story added to this game.');
                } catch (reloadErr: any) {
                  console.warn('[story] Camera - reload failed but story was uploaded:', reloadErr);
                  Alert.alert('Added', 'Story added to this game. Refresh to see it.');
                }
              }
            } catch (err: any) {
              console.error('Story upload error:', err);
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
                allowsEditing: false,
                exif: false,
                // On iOS, use the PhotoPicker (not the deprecated deprecated UIImagePickerController)
                // which returns proper file:// URIs instead of ph:// asset references
                legacy: false,
              };
              const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
              if (!result || result.canceled || !result.assets || !result.assets.length) return;
              
              const asset = result.assets[0];
              const base = getApiBaseUrl();
              let uri = asset.uri;
              const mimeType = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
              const fileName = asset.fileName || uri.split('/').pop() || (mimeType.startsWith('video') ? 'story.mp4' : 'story.jpg');
              const ensured = await (await import('../../utils/ensureUploadableUri')).ensureUploadableUri(uri, mimeType);
              uri = ensured.uri;
              
              const uploaded = await uploadFile(base, uri, fileName, mimeType);
              const mediaUrl = uploaded?.path || uploaded?.url;
              if (!mediaUrl) {
                throw new Error('Upload failed');
              }
              if (isSampleId(vm.gameId)) {
                setVm((prev) => {
                  if (!prev) return prev;
                  const newItem: MediaItem = { id: String(Date.now()), url: mediaUrl, kind: (mimeType?.startsWith('video') ? 'video' : 'photo') as any };
                  return { ...prev, media: [newItem, ...(prev.media || [])] } as GameVM;
                });
              } else {
                const storyPayload: any = { media_url: mediaUrl };
                if (location?.latitude && location?.longitude) {
                  storyPayload.location = { lat: location.latitude, lng: location.longitude, source: 'device' };
                }
                await Game.addStory(vm.gameId, storyPayload);
                try {
                  await loadGameById(vm.gameId);
                  Alert.alert('Added', isSampleId(vm.gameId) ? 'Story added (demo only).' : 'Story added to this game.');
                } catch (reloadErr: any) {
                  console.warn('[story] Gallery - reload failed but story was uploaded:', reloadErr);
                  Alert.alert('Added', 'Story added to this game. Refresh to see it.');
                }
              }
            } catch (err: any) {
              console.error('Story upload error:', err);
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
  }, [loadGameById, storyBusy, vm?.gameId, location?.latitude, location?.longitude, permissionGranted, requestPermission, needsPreciseAccuracy, openSettings]);

  const _refreshVotes = useCallback(async () => {
    // Event-only pages (no gameId) get local vote state
    if (!vm?.gameId) {
      // If we have an eventId, show poll with local state
      if (vm?.eventId) {
        setVoteSummary(buildVoteSummary(0, 0, null));
      } else {
        setVoteSummary(null);
      }
      return;
    }
    // For sample games, don't make API call
    if (isSampleId(vm.gameId)) {
      setVoteSummary(buildVoteSummary(0, 0, null));
      return;
    }
    try {
      const res: any = await retryWithBackoff(() => Game.votesSummary(vm.gameId!), {
        maxRetries: 2,
        initialDelayMs: 800,
        maxDelayMs: 4000,
      });
      setVoteSummary(parseVoteSummary(res));
    } catch (err) {
      console.warn('Failed to load game votes', err);
    }
  }, [vm?.gameId, vm?.eventId]);

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
    void load();
  }, [load]);

  useEffect(() => {
    void _refreshVotes();
  }, [_refreshVotes]);

  useEffect(() => {
    setVoteSummary(null);
  }, [vm?.gameId]);

  useFocusEffect(
    useCallback(() => {
      void _refreshVotes();
      const interval = setInterval(() => {
        void _refreshVotes();
      }, 10000);
      return () => clearInterval(interval);
    }, [_refreshVotes]),
  );

  useEffect(() => {
    const total = _voteSummary?.total ?? 0;
    const hasVotes = total > 0;
    // Allow true 0%/100% edges so a single vote can fully own the bar or split evenly for large volumes
    const targetA = hasVotes ? Math.max(0, Math.min(100, _voteSummary?.pctA ?? 0)) : 50;
    const targetB = hasVotes ? Math.max(0, Math.min(100, _voteSummary?.pctB ?? 0)) : 50;
    const dur = prefersReducedMotion ? 0 : 400;
    Animated.parallel([
      Animated.timing(voteAnimated.A, { toValue: targetA, duration: prefersReducedMotion ? 0 : 200, useNativeDriver: false }),
      Animated.timing(voteAnimated.B, { toValue: targetB, duration: prefersReducedMotion ? 0 : 200, useNativeDriver: false }),
      Animated.timing(pctAnimA, { toValue: targetA, duration: dur, useNativeDriver: false }),
      Animated.timing(pctAnimB, { toValue: targetB, duration: dur, useNativeDriver: false }),
      Animated.timing(numAnimA, { toValue: targetA, duration: dur, useNativeDriver: false }),
      Animated.timing(numAnimB, { toValue: targetB, duration: dur, useNativeDriver: false }),
    ]).start();
  }, [numAnimA, numAnimB, pctAnimA, pctAnimB, prefersReducedMotion, voteAnimated.A, voteAnimated.B, _voteSummary?.pctA, _voteSummary?.pctB, _voteSummary?.total]);

  const onRefresh = useCallback(() => {
    void load(true);
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
      const res: any = await retryWithBackoff(() => Event.rsvp(vm.eventId!, nextDesired), {
        maxRetries: 2,
        initialDelayMs: 800,
        maxDelayMs: 4000,
      });
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

  const shareContextLines = useMemo(() => {
    if (!vm) return [];
    const lines: string[] = [];
    if (vm.homeTeam && vm.awayTeam) {
      lines.push(`${vm.homeTeam} vs ${vm.awayTeam}`);
    }
    if (displayDate) {
      lines.push(`When: ${displayDate}`);
    }
    if (vm.location) {
      lines.push(`Location: ${vm.location}`);
    }
    return lines;
  }, [displayDate, vm]);

  const { share: shareGameLink } = useShareLink({
    kind: vm?.gameId ? 'game' : 'event',
    id: vm?.gameId ?? vm?.eventId,
    title:
      vm?.title ||
      (vm?.homeTeam && vm?.awayTeam ? `${vm.homeTeam} vs ${vm.awayTeam}` : 'VarsityHub Game'),
    contextLines: shareContextLines,
  });

  const onShare = useCallback(() => {
    void shareGameLink();
  }, [shareGameLink]);

  const onPressLocation = useCallback(() => {
    if (vm?.location) openMaps(vm.location);
  }, [vm?.location]);

  const handleVote = useCallback(
    async (team: VoteOption) => {
      if (vm?.isPast) return;
      // Event-only pages (no gameId) only update local state
      const isEventOnly = !vm?.gameId && vm?.eventId;

      let rollback: VoteSummary | null = null;
      setVoteSummary((prev) => {
        rollback = prev ? { ...prev } : null;
        const baseline = prev ?? buildVoteSummary(0, 0, null);
        if (baseline.userVote === team) {
          return baseline; // No change
        }
        let nextA = baseline.teamA;
        let nextB = baseline.teamB;
        if (baseline.userVote === 'A') nextA = Math.max(0, nextA - 1);
        if (baseline.userVote === 'B') nextB = Math.max(0, nextB - 1);
        if (team === 'A') nextA += 1; else nextB += 1;
        return buildVoteSummary(nextA, nextB, team);
      });

      // For event-only or sample games, just update local state and don't call API
      if (isEventOnly || (vm?.gameId && isSampleId(vm.gameId))) {
        setVoteBusy(false);
        return;
      }

      if (!vm?.gameId) return; // Safety check

      setVoteBusy(true);
      try {
        const res: any = await retryWithBackoff(() => Game.castVote(vm.gameId!, team), {
          maxRetries: 2,
          initialDelayMs: 800,
          maxDelayMs: 4000,
        });
        // The response from the server is the latest truth
        setVoteSummary(parseVoteSummary(res));
        // We can also refresh votes as a secondary measure if needed
        // _refreshVotes(); 
      } catch (err: any) {
        if (rollback) setVoteSummary(rollback); else setVoteSummary(null);
        if (err?.status === 401) {
          void router.push('/sign-in');
        } else {
          console.error('Failed to submit vote', err);
          Alert.alert('Vote', 'Unable to update your vote right now. Please try again.');
        }
      } finally {
        setVoteBusy(false);
      }
    },
    [vm?.gameId, vm?.eventId, vm?.isPast, router],
  );

  const handleClearVote = useCallback(async () => {
    if (vm?.isPast) return;
    // Event-only pages (no gameId) only update local state
    const isEventOnly = !vm?.gameId && vm?.eventId;

    let rollback: VoteSummary | null = null;
    setVoteSummary((prev) => {
      if (!prev?.userVote) return prev; // Nothing to clear
      rollback = { ...prev };
      const nextA = prev.userVote === 'A' ? Math.max(0, prev.teamA - 1) : prev.teamA;
      const nextB = prev.userVote === 'B' ? Math.max(0, prev.teamB - 1) : prev.teamB;
      return buildVoteSummary(nextA, nextB, null);
    });

    // For event-only or sample games, just update local state and don't call API
    if (isEventOnly || (vm?.gameId && isSampleId(vm.gameId))) {
      setVoteBusy(false);
      return;
    }

    if (!vm?.gameId) return; // Safety check

    setVoteBusy(true);
    try {
      const res: any = await retryWithBackoff(() => Game.clearVote(vm.gameId!), {
        maxRetries: 2,
        initialDelayMs: 800,
        maxDelayMs: 4000,
      });
      setVoteSummary(parseVoteSummary(res));
    } catch (err: any) {
      if (rollback) setVoteSummary(rollback);
      if (err?.status === 401) {
        void router.push('/sign-in');
      } else {
        console.error('Failed to clear vote', err);
        Alert.alert('Vote', 'Unable to update your vote right now. Please try again.');
      }
    } finally {
      setVoteBusy(false);
    }
  }, [vm?.gameId, vm?.eventId, vm?.isPast, router]);

  const renderStoriesCarousel = () => {
    const mediaItems = (vm?.media ?? []).map((m) => ({ 
      id: m.id, 
      url: m.url, 
      kind: m.kind, 
      user_id: m.user_id,
      created_at: m.created_at,
      caption: m.caption,
    }));
    if (!mediaItems.length) return null;
    return (
      <View style={styles.storiesWrap}>
        <Animated.ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.storiesRow}
          decelerationRate="fast"
          snapToInterval={132} // Snap to each card (120px width + 12px gap)
          snapToAlignment="center"
        >
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
                      <Ionicons name="play" size={32} color={Colors[colorScheme].background} />
                    </View>
                  ) : (
                    <Image source={{ uri: it.url }} style={styles.storyThumb} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey={it.url}
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
<<<<<<< HEAD
  // Show poll if we have a gameId OR an eventId
  if (!vm?.gameId && !vm?.eventId) return null;
  const summary = _voteSummary ?? buildVoteSummary(0, 0, null);
=======
  if (!vm?.gameId) return null;

  const usingPlaceholderLabels = teamALabel === 'Team A' && teamBLabel === 'Team B';
  if (usingPlaceholderLabels) {
    return (
      <View style={[styles.voteWrapper, styles.voteEmptyState]}>
        <Ionicons name="alert-circle-outline" size={18} color={Colors[colorScheme].mutedText} />
        <View style={styles.voteEmptyCopy}>
          <Text style={styles.voteEmptyTitle}>Link teams to enable fan voting</Text>
          <Text style={styles.voteEmptySubtitle}>Add home and away teams when editing this game so supporters see real matchup names.</Text>
        </View>
      </View>
    );
  }

  const summary = voteSummary ?? buildVoteSummary(0, 0, null);
>>>>>>> 19009a9 (fix: add runtimeVersion to align with Expo.plist for EAS build)
  const total = summary.total ?? 0;
  const hasVotes = total > 0;
  const pctA = hasVotes ? Math.max(0, Math.min(100, summary.pctA ?? 0)) : 50;
  const pctB = hasVotes ? Math.max(0, Math.min(100, summary.pctB ?? 0)) : 50;
  const pressDisabled = Boolean(vm?.isPast) || voteBusy;
  const selectedTeam = summary.userVote ?? null;
  const votesWord = total === 1 ? 'vote' : 'votes';
  const pickLabel = (
    selectedTeam === 'A'
      ? teamALabel
      : selectedTeam === 'B'
      ? teamBLabel
      : null
  );
  const caption = _voteSummary
    ? `${total} ${votesWord} ${pickLabel ? `• Your pick: ${pickLabel}` : "• You haven't voted"}`
    : 'Loading votes...';

  return (
    <View style={styles.voteWrapper}>
      <View
        style={[
          styles.voteBar,
          pressDisabled ? styles.voteBarDisabled : null,
        ]}
      >
        <Animated.View
          style={[styles.voteFill, styles.voteFillA, { width: `${pctA}%` }]}
        >
          {/* Removed white gradient overlay to avoid washout */}
          <LinearGradient
            colors={['transparent', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.voteFillHighlight}
          />
          {pctA > 15 && (
            <Text style={styles.voteTextInside}>
              {teamALabel} {Math.round(pctA)}%
            </Text>
          )}
        </Animated.View>
        <Animated.View
          style={[styles.voteFill, styles.voteFillB, { width: `${pctB}%` }]}
        >
          {/* Removed white gradient overlay to avoid washout */}
          <LinearGradient
            colors={['transparent', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.voteFillHighlight}
          />
          {pctB > 15 && (
            <Text style={styles.voteTextInside}>
              {teamBLabel} {Math.round(pctB)}%
            </Text>
          )}
        </Animated.View>

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
      <Text style={styles.voteCaptionBelow}>{caption}</Text>
    </View>
  );
};

const renderBanner = () => {
  // Prefer a full MatchBanner hero if both teams have logos available
  const leftLogo = vm?.homeTeam ? getTeamLogo(vm.homeTeam) : null;
  const rightLogo = vm?.awayTeam ? getTeamLogo(vm.awayTeam) : null;
  const finalsBanner = finalsBannerUrl;
  const bannerImageUrl = finalsBanner || bannerUrl;
  const bannerImageKey = bannerImageUrl ? `${bannerImageUrl}-${vm?.gameId || vm?.id || vm?.title || ''}` : 'banner-fallback';
  const isHero = Boolean(leftLogo && rightLogo) && !finalsBanner;
  const bannerHeight = isHero ? 320 : 240;

  // attempt to pull team color accents from vm.teams if present
  const homeTeamObj = vm?.teams?.find((t: any) => t.name === vm?.homeTeam)
  const awayTeamObj = vm?.teams?.find((t: any) => t.name === vm?.awayTeam)
  
  const heroBanner = bannerImageUrl && !isHero ? (
    <Image
      key={bannerImageKey}
      source={{ uri: bannerImageUrl }}
      style={styles.bannerImage}
      contentFit="cover"
      cachePolicy="memory-disk"
    />
    ) : leftLogo && rightLogo ? (
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
        onLeftPress={() => {
          // Navigate to home team profile if team object exists
          if (homeTeamObj?.id) {
            void router.push(`/team-profile?id=${homeTeamObj.id}`);
          }
        }}
        onRightPress={() => {
          // Navigate to away team profile if team object exists
          if (awayTeamObj?.id) {
            void router.push(`/team-profile?id=${awayTeamObj.id}`);
          }
        }}
        leftColor={(homeTeamObj as any)?.color}
        rightColor={(awayTeamObj as any)?.color}
        goingCount={goingCount}
        onGoingPress={onToggleRsvp}
      />
    ) : (
      <LinearGradient colors={PLACEHOLDER_GRADIENT} style={styles.bannerImage} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
    );

      return (
        <View style={[styles.bannerWrapper, { height: bannerHeight }]}>
          {heroBanner}
    {/* Shade the banner less when this is a hero image so logos are visible */}
    <LinearGradient pointerEvents="none" colors={isHero ? ['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.35)'] : ['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.75)']} style={styles.bannerShade} />
        
        <View style={[styles.bannerTopRow, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => void router.back()} accessibilityRole="button" style={styles.circleButton}>
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
                  color={gamePhase === 'upcoming' ? (vm?.userRsvped ? Colors[colorScheme].text : Colors[colorScheme].tint) : Colors[colorScheme].mutedText}
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

  const _renderStats = () => {
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
    // Extract organization name from team name (e.g., "SHS Men's Soccer" -> "SHS")
    const _getOrganizationFromTeamName = (teamName: string) => {
      const parts = teamName.split(/\s+/);
      if (parts.length > 1) {
        // Check if first part looks like an abbreviation (SHS, NHS, etc.)
        const firstPart = parts[0];
        if (firstPart.length <= 5 && firstPart === firstPart.toUpperCase()) {
          return firstPart;
        }
        // Otherwise use first word
        return parts[0];
      }
      return teamName;
    };

    // If we have teams array with IDs, use that
    if (vm?.teams?.length) {
      return (
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', gap: 10, marginVertical: 12 }}>
          {vm.teams.slice(0, 2).map((team) => (
            <Pressable
              key={team.id}
              style={({ pressed }) => [
                styles.teamLinkButton,
                { 
                  backgroundColor: pressed ? Colors[colorScheme].surface : Colors[colorScheme].background,
                  borderColor: Colors[colorScheme].border,
                }
              ]}
              onPress={() => void router.push({ pathname: '/team-page', params: { id: team.id, name: team.name } } as any)}
            >
              {team.avatarUrl ? (
                <Image source={{ uri: team.avatarUrl }} style={styles.teamLinkAvatar} contentFit="cover" />
              ) : (
                <Ionicons name="people-outline" size={20} color={Colors[colorScheme].text} />
              )}
              <Text style={styles.teamLinkName} numberOfLines={1}>{team.name}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors[colorScheme].mutedText} />
            </Pressable>
          ))}
        </View>
      );
    }

    // Otherwise use homeTeam and awayTeam strings if available
    const homeTeam = vm?.homeTeam?.trim();
    const awayTeam = vm?.awayTeam?.trim();
    
    if (!homeTeam && !awayTeam) {
      return (
        <View style={{ paddingVertical: 12 }}>
          <Text style={{ color: Colors[colorScheme].mutedText, textAlign: 'center' }}>No teams linked to this game yet.</Text>
          <Text style={{ color: Colors[colorScheme].mutedText, textAlign: 'center', fontSize: 12, marginTop: 4 }}>Teams can be added when editing the game.</Text>
        </View>
      );
    }

    const teams = [homeTeam, awayTeam].filter(Boolean);
    
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', gap: 12, marginVertical: 16, paddingHorizontal: 12 }}>
        {teams.map((teamName, index) => {
          const teamLogo = getTeamLogo(teamName!);
          
          return (
            <Pressable
              key={index}
              style={({ pressed }) => [
                {
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 16,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: Colors[colorScheme].surface,
                  borderWidth: 1,
                  borderColor: Colors[colorScheme].border,
                  minHeight: 160,
                  opacity: pressed ? 0.7 : 1,
                  transform: pressed ? [{ scale: 0.95 }] : [{ scale: 1 }],
                }
              ]}
              onPress={() => void router.push({ pathname: '/team-page', params: { name: teamName } } as any)}
              accessibilityRole="button"
              accessibilityLabel={`View ${teamName} team`}
            >
              <View style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: Colors[colorScheme].background,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8,
                borderWidth: 2,
                borderColor: Colors[colorScheme].tint,
              }}>
                {teamLogo ? (
                  <Image source={{ uri: teamLogo }} style={{ width: 68, height: 68, borderRadius: 34 }} contentFit="cover" />
                ) : (
                  <View style={{ width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors[colorScheme].tint + '20' }}>
                    <Ionicons name="shield" size={32} color={Colors[colorScheme].tint} />
                  </View>
                )}
              </View>
              <Text style={{ fontWeight: '700', fontSize: 16, textAlign: 'center', color: Colors[colorScheme].text, marginHorizontal: 4 }} numberOfLines={2}>{teamName}</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors[colorScheme].tint} style={{ marginTop: 8 }} />
            </Pressable>
          );
        })}
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

  const _renderMediaGrid = () => {
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
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <LinearGradient
        colors={['rgba(0,0,0,0.2)', 'transparent']}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: insets.top + 20,
          zIndex: 100,
        }}
        pointerEvents="none"
      />

      <Animated.View
        style={[styles.headerWrap, { top: insets.top, transform: [{ translateY: headerTranslateY }], opacity: headerOpacity }]}
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
        <View style={{ height: headerH + 32 }} />
        <View style={styles.content}>
          {loading && !refreshing ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={Colors[colorScheme].tint} />
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
<<<<<<< HEAD
              {/* Tabs removed - keeping Overview only as default view */}
              <Text style={styles.title}>{vm.title}</Text>
=======
              <View style={styles.titleContainer}>
                <Text style={styles.title}>{vm.title}</Text>
              </View>
              {renderVoteSection()}
>>>>>>> 19009a9 (fix: add runtimeVersion to align with Expo.plist for EAS build)
              {vm.location ? (
                <Pressable style={styles.locationRow} onPress={onPressLocation}>
                  <Ionicons name="location" size={16} color={Colors[colorScheme].tint} />
                  <Text style={styles.locationText}>{vm.location}</Text>
                </Pressable>
              ) : null}

              {/* Add Story Section */}
              <View style={styles.secondaryActionsRow}>
                <Pressable
                  style={[styles.actionBtn, (!vm?.gameId || storyBusy || !canAddStory(vm?.date)) ? styles.actionBtnDisabled : null]}
                  onPress={handleAddStory}
                  disabled={!vm?.gameId || storyBusy || !canAddStory(vm?.date)}
                >
                  <Ionicons 
                    name={storyBusy ? "checkmark-circle-outline" : "add-circle-outline"} 
                    size={16} 
                    color={Colors[colorScheme].tint} 
                  />
                  <Text style={styles.actionText}>
                    Add Story
                  </Text>
                </Pressable>
              </View>
              {showPreciseBanner ? (
                <View style={[styles.preciseBanner, { backgroundColor: '#FEF9C3', borderColor: '#FACC15' }]}>
                  <Ionicons name="navigate" size={16} color="#B45309" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.preciseBannerTitle}>Precise location is off</Text>
                    <Text style={styles.preciseBannerText}>
                      Android is sharing an approximate location, so story pins may be less accurate.
                    </Text>
                    <View style={styles.preciseBannerActions}>
                      <Pressable onPress={() => setPreciseBannerDismissed(true)}>
                        <Text style={styles.preciseBannerLink}>Dismiss</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setPreciseBannerDismissed(true);
                          void openSettings();
                        }}
                      >
                        <Text style={[styles.preciseBannerLink, { color: Colors[colorScheme].tint, fontWeight: '700' }]}>
                          Open settings
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ) : null}
              {/* Stories carousel (only stories section). Also anchor the Stories tab to this position */}
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

              {renderVoteSection()}

              {/* Posts Section */}
              <View
                style={styles.section}
                onLayout={(e) => {
                  sectionOffsets.current.posts = e.nativeEvent.layout.y;
                }}
              >
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Posts</Text>
                    <Text style={styles.sectionSubtitle}>{postsSubtitle}</Text>
                  </View>
                  <Pressable 
                    style={styles.addPostButton}
                    onPress={() => {
                      const targetGameId = vm?.gameId || vm?.eventId;
                      if (!targetGameId) {
                        Alert.alert('Create Post', 'Reload this event before creating a post.');
                        return;
                      }
                      void router.push({
                        pathname: '/create-post',
                        params: { gameId: String(targetGameId), type: 'highlight' },
                      } as any);
                    }}
                  >
                    <Ionicons name="add-circle" size={28} color={Colors[colorScheme].tint} />
                  </Pressable>
                </View>
                {postsCount > 0 ? (
                   <View style={styles.postsGridContainer}>
                   <View style={styles.postsMasonryGrid}>
                     {/* Column 1 */}
                     <View style={styles.masonryColumn}>
                       {(vm?.posts || [])
                         .filter((_: any, index: number) => index % 2 === 0)
                         .map((post: any, index: number) => {
                           const thumb = post.media_url;
                           const isVideo = !!thumb && VIDEO_EXT.test(thumb);
                           const likes = post.upvotes_count ?? 0;
                           const comments = post.comments_count ?? post._count?.comments ?? 0;
                           // Vary heights: alternate between tall, medium, and short
                           const heightVariant = index % 3;
                           const itemHeight = heightVariant === 0 ? 280 : heightVariant === 1 ? 200 : 240;
                           return (
                             <Pressable
                               key={post.id || index}
                               style={[styles.masonryItem, { height: itemHeight }]}
                               onPress={() => { void router.push(`/post-detail?id=${post.id}`); }}
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
                                     <Text numberOfLines={6} style={styles.gridTextOnly}>
                                       {String(post.caption || post.content || '').trim() || 'Post'}
                                     </Text>
                                   </View>
                                 </View>
                               )}
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
                               <View style={styles.gridIconBadge}>
                                 {isVideo ? (
                                   <Ionicons name="videocam-outline" size={16} color="#fff" />
                                 ) : (
                                   <Ionicons name="camera-outline" size={16} color="#fff" />
                                 )}
                               </View>
                             </Pressable>
                           );
                         })}
                     </View>
                     
                     {/* Column 2 */}
                     <View style={styles.masonryColumn}>
                       {(vm?.posts || [])
                         .filter((_: any, index: number) => index % 2 === 1)
                         .map((post: any, index: number) => {
                           const thumb = post.media_url;
                           const isVideo = !!thumb && VIDEO_EXT.test(thumb);
                           const likes = post.upvotes_count ?? 0;
                           const comments = post.comments_count ?? post._count?.comments ?? 0;
                           // Offset the height pattern for visual variety
                           const heightVariant = (index + 1) % 3;
                           const itemHeight = heightVariant === 0 ? 240 : heightVariant === 1 ? 280 : 200;
                           return (
                             <Pressable
                               key={post.id || index}
                               style={[styles.masonryItem, { height: itemHeight }]}
                               onPress={() => { void router.push(`/post-detail?id=${post.id}`); }}
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
                                     <Text numberOfLines={6} style={styles.gridTextOnly}>
                                       {String(post.caption || post.content || '').trim() || 'Post'}
                                     </Text>
                                   </View>
                                 </View>
                               )}
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
                               <View style={styles.gridIconBadge}>
                                 {isVideo ? (
                                   <Ionicons name="videocam-outline" size={16} color="#fff" />
                                 ) : (
                                   <Ionicons name="camera-outline" size={16} color="#fff" />
                                 )}
                               </View>
                             </Pressable>
                           );
                         })}
                     </View>
                   </View>
                 </View>
                ) : (
                  <View>
                    <Text style={[styles.muted, styles.sectionHelper]}>Be the first to share a highlight for this game.</Text>
                    <View style={styles.postsMasonryGrid}>
                      <View style={styles.masonryColumn}>
                        <View style={[styles.masonryItem, styles.gridItemEmpty, { height: 240 }]}>
                          <Ionicons name="image-outline" size={32} color={Colors[colorScheme].border} />
                        </View>
                        <View style={[styles.masonryItem, styles.gridItemEmpty, { height: 200 }]}>
                          <Ionicons name="image-outline" size={32} color={Colors[colorScheme].border} />
                        </View>
                      </View>
                      <View style={styles.masonryColumn}>
                        <View style={[styles.masonryItem, styles.gridItemEmpty, { height: 180 }]}>
                          <Ionicons name="image-outline" size={32} color={Colors[colorScheme].border} />
                        </View>
                        <View style={[styles.masonryItem, styles.gridItemEmpty, { height: 220 }]}>
                          <Ionicons name="image-outline" size={32} color={Colors[colorScheme].border} />
                        </View>
                      </View>
                    </View>
                  </View>
                )}
                {postsCount > 0 && (
                  <Pressable style={styles.viewAllButton} onPress={() => setVerticalFeedOpen(true)}>
                    <Text style={styles.viewAllButtonText}>View All Posts</Text>
                    <Ionicons name="arrow-forward" size={14} color={Colors[colorScheme].text} />
                  </Pressable>
                )}
              </View>

              {/* Teams Section (moved after Posts) */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Teams</Text>
                {renderTeams()}
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
                const summary = _voteSummary ?? buildVoteSummary(0, 0, null);
                const _pctA = summary.total ? Math.round(summary.pctA) : 50;
                const _pctB = summary.total ? Math.round(summary.pctB) : 50;
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
                            void handleClearVote();
                            if (!prefersReducedMotion) Animated.spring(vsScaleA, { toValue: 1, useNativeDriver: true }).start();
                          } else {
                            void handleVote('A');
                            if (!prefersReducedMotion) Animated.sequence([
                              Animated.spring(vsScaleA, { toValue: 1.06, useNativeDriver: true }),
                              Animated.spring(vsScaleA, { toValue: 1, useNativeDriver: true }),
                            ]).start();
                          }
                        }}
                        disabled={disabled}
                      >
                        <Text style={[styles.vsTeamName, { color: selected === 'A' ? (colorScheme === 'dark' ? Colors.dark.text : '#fff') : textColor }]}>{teamALabel}</Text>
                        <Text style={[styles.vsTeamPct, { color: selected === 'A' ? (colorScheme === 'dark' ? Colors.dark.text : '#fff') : textColor }]}>{displayPctA}%</Text>
                        <Text style={[styles.vsTeamVotes, { color: selected === 'A' ? (colorScheme === 'dark' ? 'rgba(241,245,249,0.9)' : 'rgba(255,255,255,0.9)') : Colors[colorScheme].mutedText }]}>{String(summary.teamA)} votes</Text>

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
                            void handleClearVote();
                            if (!prefersReducedMotion) Animated.spring(vsScaleB, { toValue: 1, useNativeDriver: true }).start();
                          } else {
                            void handleVote('B');
                            if (!prefersReducedMotion) Animated.sequence([
                              Animated.spring(vsScaleB, { toValue: 1.06, useNativeDriver: true }),
                              Animated.spring(vsScaleB, { toValue: 1, useNativeDriver: true }),
                            ]).start();
                          }
                        }}
                        disabled={disabled}
                      >
                        <Text style={[styles.vsTeamName, { color: selected === 'B' ? (colorScheme === 'dark' ? Colors.dark.text : '#fff') : textColor }]}>{teamBLabel}</Text>
                        <Text style={[styles.vsTeamPct, { color: selected === 'B' ? (colorScheme === 'dark' ? Colors.dark.text : '#fff') : textColor }]}>{displayPctB}%</Text>
                        <Text style={[styles.vsTeamVotes, { color: selected === 'B' ? (colorScheme === 'dark' ? 'rgba(241,245,249,0.9)' : 'rgba(255,255,255,0.9)') : Colors[colorScheme].mutedText }]}>{String(summary.teamB)} votes</Text>

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
          onDelete={(id) => {
            // Remove deleted item from the viewer's items array
            setStoriesViewer((prev) => {
              if (!prev) return null;
              const updatedItems = prev.items.filter((item) => item.id !== id);
              if (updatedItems.length === 0) return null;
              return { ...prev, items: updatedItems };
            });
            // Also update the main vm.media array
            setVm((prev) => {
              if (!prev) return prev;
              return { ...prev, media: prev.media.filter((item) => item.id !== id) };
            });
          }}
          gameId={vm?.gameId}
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
            <Ionicons name="people" size={18} color={Colors[colorScheme].tint} />
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
    </SafeAreaView>
  );
};

export default GameDetailsScreen;

const createStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors[colorScheme].background },
  bannerWrapper: { position: 'relative', height: 260, backgroundColor: colorScheme === 'dark' ? '#1e293b' : '#eff6ff' },
  bannerImage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  bannerShade: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 },
  headerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    backgroundColor: 'transparent',
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
<<<<<<< HEAD
    marginTop: -16,
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 0,
    marginBottom: 24,
=======
    marginTop: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colorScheme === 'dark' ? 'rgba(15,23,42,0.8)' : '#fff',
    shadowColor: '#000',
    shadowOpacity: colorScheme === 'dark' ? 0.25 : 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  voteEmptyState: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  voteEmptyCopy: { flex: 1 },
  voteEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors[colorScheme].text,
    marginBottom: 2,
  },
  voteEmptySubtitle: {
    fontSize: 13,
    color: Colors[colorScheme].mutedText,
    lineHeight: 18,
>>>>>>> 19009a9 (fix: add runtimeVersion to align with Expo.plist for EAS build)
  },
  voteBar: {
    position: 'relative',
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors[colorScheme].border,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    marginBottom: 8,
  },
  voteBarDisabled: { opacity: 0.65 },
  // RSVP sheet styles
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors[colorScheme].card,
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
    backgroundColor: Colors[colorScheme].border,
    marginBottom: 10,
  },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: Colors[colorScheme].text },
  sheetPrimaryBtn: {
    marginTop: 4,
    backgroundColor: Colors[colorScheme].tint,
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
  sheetNote: { marginTop: 10, color: Colors[colorScheme].mutedText },
  sheetStatsRow: { marginTop: 16, flexDirection: 'row', gap: 10 },
  sheetStatCard: {
    flex: 1,
    backgroundColor: Colors[colorScheme].surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors[colorScheme].border,
  },
  sheetStatValue: { fontSize: 18, fontWeight: '800', color: Colors[colorScheme].text },
  sheetStatLabel: { marginTop: 2, fontSize: 12, color: Colors[colorScheme].mutedText, fontWeight: '600' },
  voteFill: { 
    height: '100%', 
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  voteTextInside: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },
  voteLabelsAbove: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 8,
    minHeight: 32,
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
  voteLabelWinning: {
    borderWidth: 2,
    borderColor: Colors[colorScheme].tint,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: `${Colors[colorScheme].tint}10`,
  },
  voteLabelAboveText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 12,
  },
  voteLabelWinningText: {
    color: Colors[colorScheme].tint,
    fontWeight: '700',
  },
  voteCaptionInline: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
  },
  voteCaptionBelow: {
    marginTop: 0,
    marginBottom: 16,
    textAlign: 'center',
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 13,
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

  teamLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderRadius: 8,
    marginVertical: 4,
  },
  teamLinkAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  teamLinkName: {
    flex: 1,
    fontWeight: '600',
  },

  // Enhanced team card styles for bottom section (now using inline styles)
  teamLinkButtonEnhanced: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 160,
  },
  teamAvatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
  },
  teamLinkAvatarLarge: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  teamIconPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamNameLarge: {
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 4,
  },
  viewAllButton: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  viewAllButtonText: {
    fontWeight: '600',
  },

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
    backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dateChipText: { fontWeight: '700', color: Colors[colorScheme].text, fontSize: 13 },
  dateChipTime: { fontWeight: '600', color: Colors[colorScheme].tint, fontSize: 13 },
  statusChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.92)',
  },
  statusUpcoming: { backgroundColor: colorScheme === 'dark' ? 'rgba(59,130,246,0.3)' : 'rgba(219,234,254,0.95)', borderWidth: StyleSheet.hairlineWidth, borderColor: colorScheme === 'dark' ? 'rgba(59,130,246,0.5)' : '#bfdbfe' },
  statusLive: { backgroundColor: colorScheme === 'dark' ? 'rgba(239,68,68,0.3)' : 'rgba(254,226,226,0.95)', borderWidth: StyleSheet.hairlineWidth, borderColor: colorScheme === 'dark' ? 'rgba(239,68,68,0.5)' : '#fecaca' },
  statusFinal: { backgroundColor: colorScheme === 'dark' ? 'rgba(107,114,128,0.3)' : 'rgba(229,231,235,0.95)', borderWidth: StyleSheet.hairlineWidth, borderColor: colorScheme === 'dark' ? 'rgba(107,114,128,0.5)' : '#d1d5db' },
  statusText: { fontWeight: '800', color: Colors[colorScheme].text },
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
    backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 24 },
  loadingBox: { paddingVertical: 24, alignItems: 'center' },
  errorBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: colorScheme === 'dark' ? 'rgba(239,68,68,0.2)' : '#fee2e2',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colorScheme === 'dark' ? 'rgba(239,68,68,0.4)' : '#fecaca',
    marginBottom: 16,
  },
  errorText: { color: colorScheme === 'dark' ? '#fca5a5' : '#991b1b', fontWeight: '600', marginBottom: 8 },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: { color: 'white', fontWeight: '700' },
<<<<<<< HEAD
  title: { fontSize: 28, fontWeight: '900', color: Colors[colorScheme].text, marginTop: 8, marginBottom: 6 },
=======
  titleContainer: {
    paddingTop: 16,
    marginBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '900', color: Colors[colorScheme].text, marginBottom: 6 },
>>>>>>> 19009a9 (fix: add runtimeVersion to align with Expo.plist for EAS build)
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  locationText: { color: Colors[colorScheme].text, fontWeight: '600', textDecorationLine: 'underline' },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  secondaryActionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' },
  storyHelpText: { 
    fontSize: 12, 
    color: Colors[colorScheme].mutedText, 
    fontWeight: '600', 
    marginTop: 4,
    width: '100%',
    textAlign: 'center'
  },
  preciseBanner: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  preciseBannerTitle: { fontWeight: '700', fontSize: 14, color: '#92400E' },
  preciseBannerText: { fontSize: 13, color: '#92400E', marginTop: 2, marginBottom: 8 },
  preciseBannerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  preciseBannerLink: { fontSize: 13, color: '#92400E' },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: Colors[colorScheme].surface,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors[colorScheme].border,
  },
  actionBtnDisabled: { opacity: 0.6 },
  actionText: { fontWeight: '700', color: Colors[colorScheme].text },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    backgroundColor: colorScheme === 'dark' ? Colors[colorScheme].surface : '#eef2ff',
    borderRadius: 999,
    padding: 4,
  },
  tabRowWrap: { marginBottom: 12, paddingHorizontal: 8 },
  tabRowCapsule: { flexDirection: 'row', backgroundColor: colorScheme === 'dark' ? Colors[colorScheme].surface : '#eef2ff', borderRadius: 999, padding: 6, alignItems: 'center', justifyContent: 'center' },
  tabBtnCapsule: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, marginHorizontal: 4 },
  tabBtnCapsuleOn: { backgroundColor: Colors[colorScheme].card, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors[colorScheme].tint },
  tabBtn: { flex: 1, borderRadius: 999, alignItems: 'center', paddingVertical: 8 },
  tabBtnOn: { backgroundColor: Colors[colorScheme].card, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors[colorScheme].tint },
  tabText: { fontWeight: '600', color: Colors[colorScheme].mutedText },
  tabTextOn: { color: Colors[colorScheme].tint },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  addPostButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: Colors[colorScheme].surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: Colors[colorScheme].text, marginBottom: 8 },
  sectionSubtitle: { color: Colors[colorScheme].mutedText, fontWeight: '600' },
  sectionHelper: { marginBottom: 12 },
  bodyText: { color: Colors[colorScheme].text, fontSize: 16, lineHeight: 24 },
  muted: { color: Colors[colorScheme].mutedText, fontStyle: 'italic' },
  statRow: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: Colors[colorScheme].surface,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: Colors[colorScheme].text },
  statLabel: { color: Colors[colorScheme].mutedText, fontWeight: '600' },
  teamList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  teamPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e0f2fe', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  teamPillText: { fontWeight: '700', color: '#0c4a6e' },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mediaThumb: { width: '31%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#e2e8f0' },
  mediaThumbContent: { flex: 1 },
  mediaVideo: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  storiesWrap: { marginTop: 16, marginBottom: 8 },
  storiesRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  storyItem: { 
    width: 120, 
    height: 200, 
    borderRadius: 16, 
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  storyItemGap: { marginLeft: 0 },
  storyTile: { 
    flex: 1, 
    borderRadius: 16, 
    overflow: 'hidden', 
    backgroundColor: '#0f172a',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  storyItemSeen: { opacity: 0.5, transform: [{ scale: 0.95 }] },
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
  storyViewerRoot: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  storyViewerTopBar: { position: 'absolute', left: 12, right: 12, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, zIndex: 1000 },
  storyTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 1001 },
  storyTopLabel: { color: '#fff', fontWeight: '800' },
  storyDeleteBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: 'rgba(239,68,68,0.25)', 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(239,68,68,0.5)',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
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
    backgroundColor: Colors[colorScheme].card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  vsModalTitle: { fontSize: 18, fontWeight: '800', color: Colors[colorScheme].text, marginBottom: 8, textAlign: 'center' },
  vsModalBody: { color: Colors[colorScheme].mutedText, textAlign: 'center', marginBottom: 12 },
  vsModalClose: { backgroundColor: Colors[colorScheme].tint, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  vsPollRow: { flexDirection: 'row', width: '100%', gap: 8, marginVertical: 8 },
  vsTeamCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: Colors[colorScheme].surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors[colorScheme].border,
  },
  vsTeamCardOn: { backgroundColor: Colors[colorScheme].tint, borderColor: Colors[colorScheme].tint },
  vsTeamName: { fontWeight: '800', color: Colors[colorScheme].text, marginBottom: 4, textAlign: 'center' },
  vsTeamPct: { fontSize: 18, fontWeight: '900', color: Colors[colorScheme].text },
  vsTeamVotes: { fontSize: 12, color: Colors[colorScheme].mutedText, marginTop: 4 },
  vsDivider: { width: 12 },
  vsPctBarWrap: { 
    width: '100%', 
    height: 8, 
    backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(37,99,235,0.15)', 
    borderRadius: 6, 
    overflow: 'hidden', 
    marginTop: 8 
  },
  vsPctBarFill: { 
    height: '100%', 
    backgroundColor: colorScheme === 'dark' ? '#60a5fa' : '#2563eb', 
    width: '0%' 
  },
  // Posts Grid Styles
  postsGridContainer: {
    marginTop: 12,
  },
  postsMasonryGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  masonryColumn: {
    flex: 1,
    gap: 8,
  },
  masonryItem: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors[colorScheme].surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -1.5,
  },
  gridItem: {
    width: '32%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors[colorScheme].surface,
    marginBottom: '2%',
  },
  gridItemEmpty: {
    backgroundColor: Colors[colorScheme].surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors[colorScheme].border,
  },
  gridImageContainer: {
    width: '100%',
    height: '100%',
  },
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
  viewAllPostsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors[colorScheme].surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  viewAllPostsText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors[colorScheme].text,
    marginRight: 8,
  },
});
<<<<<<< HEAD
=======




>>>>>>> 19009a9 (fix: add runtimeVersion to align with Expo.plist for EAS build)
