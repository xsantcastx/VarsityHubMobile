import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { format } from 'date-fns';

// @ts-ignore JS exports
import { Game, Event } from '@/api/entities';
import { uploadFile } from '@/api/upload';
import PostCard from '@/components/PostCard';
import VideoPlayer from '@/components/VideoPlayer';

const PLACEHOLDER_GRADIENT = ['#1e293b', '#1d4ed8', '#38bdf8'];
const VIDEO_EXT = /\.(mp4|mov|webm|m4v|avi)$/i;

type MediaItem = {
  id: string;
  url: string;
  kind: 'photo' | 'video';
  created_at?: string;
  caption?: string | null;
};

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
  return vm.bannerUrl || vm.coverImageUrl || media[0]?.url || null;
};

const GameDetailsScreen = () => {
  const { id, eventId } = useLocalSearchParams<{ id?: string; eventId?: string }>();
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<{ media: number; posts: number }>({ media: 0, posts: 0 });

  const [vm, setVm] = useState<GameVM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>('overview');
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [viewer, setViewer] = useState<{ visible: boolean; url: string | null; kind: 'photo' | 'video' } | null>(null);
  const [storyBusy, setStoryBusy] = useState(false);

  const [voteSummary, setVoteSummary] = useState<VoteSummary | null>(null);
  const [voteBusy, setVoteBusy] = useState(false);
  const canonicalGameId = vm?.gameId;
  const displayDate = formatDateLabel(vm?.date);
  const displayTime = formatTimeLabel(vm?.date);
  const goingCount = capCount(vm?.rsvpCount, vm?.capacity);
  const bannerUrl = useMemo(() => pickBannerFromArrays(vm ?? {}, vm?.media ?? []), [vm]);
  const showRsvp = !!vm?.eventId && !vm?.isPast;

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
      const routeBase = Array.isArray(segments) && segments.includes('discover') ? '/(tabs)/discover/game/[id]' : '/(tabs)/feed/game/[id]';
      router.replace({ pathname: routeBase, params: { id: gameIdValue } });
    },
    [router, segments],
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
        gameRecord = await Game.get(gameIdValue);
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
    try {
      setStoryBusy(true);
      const pickerOptions: any = {
        quality: 0.9,
      };
      if ('MediaType' in ImagePicker) {
        pickerOptions.mediaTypes = [ImagePicker.MediaType.image, ImagePicker.MediaType.video];
      } else {
        pickerOptions.mediaTypes = ImagePicker.MediaTypeOptions.All;
      }
      const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
      if (!result || result.canceled || !result.assets || !result.assets.length) return;
      const asset = result.assets[0];
      const base =
        (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_URL) ||
        (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000');
      const name = (asset as any).fileName || ((asset as any).duration ? 'story.mp4' : 'story.jpg');
      const mime = asset.mimeType || ((asset as any).duration ? 'video/mp4' : 'image/jpeg');
      const uploaded = await uploadFile(base, asset.uri, name, mime);
      const mediaUrl = uploaded?.url || uploaded?.path;
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

  useFocusEffect(
    useCallback(() => {
      refreshVotes();
      const interval = setInterval(() => {
        refreshVotes();
      }, 10000);
      return () => clearInterval(interval);
    }, [refreshVotes]),
  );

  const onRefresh = useCallback(() => {
    load(true);
  }, [load]);

  const onToggleRsvp = useCallback(async () => {
    if (!vm?.eventId || rsvpBusy) return;
    setRsvpBusy(true);
    try {
      const nextDesired = !vm.userRsvped;
      const res: any = await Event.rsvp(vm.eventId, nextDesired);
      setVm((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          userRsvped: typeof res?.going === 'boolean' ? res.going : nextDesired,
          rsvpCount: typeof res?.count === 'number' ? res.count : prev.rsvpCount,
          capacity: typeof res?.capacity === 'number' ? res.capacity : prev.capacity,
        };
      });
    } catch (err) {
      console.error('Failed to toggle RSVP', err);
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
        scrollRef.current?.scrollTo({ y: Math.max(0, offset - 64), animated: true });
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

  const renderVoteSection = () => {
    if (!vm?.gameId) return null;
    const summary = voteSummary;
    const hasVotes = !!summary && summary.total > 0;
    const pctA = hasVotes ? summary.pctA : 50;
    const pctB = hasVotes ? summary.pctB : 50;
    const percentALabel = summary ? ${summary.pctA}% : '--';
    const percentBLabel = summary ? ${summary.pctB}% : '--';
    const totalLabel = summary ? ${summary.total} vote : '0 votes';
    const statusLabel = summary
      ? summary.userVote
        ? Your pick: 
        : "You haven't voted"
      : 'Loading votes...';
    const caption = summary ? ${totalLabel} •  : statusLabel;
    const pressDisabled = Boolean(vm?.isPast) || voteBusy;
    const selectedTeam = summary?.userVote ?? null;
    const trackFlexA = pctA === 0 && pctB === 0 ? 1 : Math.max(pctA, 0.1);
    const trackFlexB = pctA === 0 && pctB === 0 ? 1 : Math.max(pctB, 0.1);

    return (
      <View style={styles.voteSection}>
        <View style={styles.voteChipRow}>
          <Pressable
            style={[
              styles.voteChip,
              selectedTeam === 'A' ? styles.voteChipSelected : null,
              pressDisabled ? styles.voteChipDisabled : null,
            ]}
            onPress={() => handleVote('A')}
            onLongPress={selectedTeam === 'A' ? handleClearVote : undefined}
            delayLongPress={300}
            disabled={pressDisabled}
          >
            <View style={styles.voteChipContent}>
              <Text style={[styles.voteChipLabel, selectedTeam === 'A' ? styles.voteChipLabelSelected : null]}>{teamALabel}</Text>
              <Text style={[styles.voteChipPercent, selectedTeam === 'A' ? styles.voteChipLabelSelected : null]}>{percentALabel}</Text>
            </View>
          </Pressable>
          <Pressable
            style={[
              styles.voteChip,
              selectedTeam === 'B' ? styles.voteChipSelected : null,
              pressDisabled ? styles.voteChipDisabled : null,
            ]}
            onPress={() => handleVote('B')}
            onLongPress={selectedTeam === 'B' ? handleClearVote : undefined}
            delayLongPress={300}
            disabled={pressDisabled}
          >
            <View style={styles.voteChipContent}>
              <Text style={[styles.voteChipLabel, selectedTeam === 'B' ? styles.voteChipLabelSelected : null]}>{teamBLabel}</Text>
              <Text style={[styles.voteChipPercent, selectedTeam === 'B' ? styles.voteChipLabelSelected : null]}>{percentBLabel}</Text>
            </View>
          </Pressable>
        </View>
        <View style={styles.voteBar}>
          <View style={[styles.voteBarFillA, { flex: trackFlexA }]} />
          <View style={[styles.voteBarFillB, { flex: trackFlexB }]} />
        </View>
        <Text style={styles.voteCaption}>{caption}</Text>
      </View>
    );
  };

  const renderBanner = () => {
    const content = bannerUrl ? (
      <Image source={{ uri: bannerUrl }} style={styles.bannerImage} contentFit="cover" />
    ) : (
      <LinearGradient colors={PLACEHOLDER_GRADIENT} style={styles.bannerImage} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
    );
    return (
      <View style={styles.bannerWrapper}>
        {content}
        <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.75)']} style={styles.bannerShade} />
        <View style={[styles.bannerTopRow, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.circleButton}>
            <Ionicons name="chevron-back" size={20} color="#111827" />
          </Pressable>
          <Pressable onPress={onShare} accessibilityRole="button" style={styles.circleButton}>
            <Ionicons name="share-outline" size={18} color="#111827" />
          </Pressable>
        </View>
        <View style={styles.bannerBottomRow}>
          <View style={styles.dateChip}>
            <Ionicons name="calendar" size={14} color="#2563EB" />
            <Text style={styles.dateChipText}>{displayDate || 'Upcoming Game'}</Text>
            {displayTime ? <Text style={styles.dateChipTime}>{displayTime}</Text> : null}
          </View>
          {showRsvp ? (
            <Pressable
              onPress={onToggleRsvp}
              disabled={rsvpBusy}
              style={[styles.rsvpChip, vm?.userRsvped ? styles.rsvpOn : null, rsvpBusy ? styles.rsvpDisabled : null]}
            >
              <Ionicons
                name={vm?.userRsvped ? 'checkmark-circle' : 'add-circle-outline'}
                size={18}
                color={vm?.userRsvped ? '#0f172a' : '#2563EB'}
              />
              <Text style={[styles.rsvpText, vm?.userRsvped ? styles.rsvpTextOn : null]}>
                {vm?.userRsvped ? 'Going' : 'RSVP'}
              </Text>
            </Pressable>
          ) : vm?.isPast ? (
            <View style={styles.finalChip}>
              <Ionicons name="flag" size={14} color="#EF4444" />
              <Text style={styles.finalText}>Final</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const renderStats = () => {
    const stats = [
      { key: 'going', label: 'Going', value: goingCount != null ? String(goingCount) : '—' },
      { key: 'reviews', label: 'Reviews', value: vm?.reviewsCount != null ? String(vm.reviewsCount) : '—' },
      { key: 'media', label: 'Media', value: vm?.media?.length ? String(vm.media.length) : '0' },
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
      return <Text style={styles.muted}>Teams will appear here once linked.</Text>;
    }
    return (
      <View style={styles.teamList}>
        {vm.teams.map((team) => (
          <View key={team.id} style={styles.teamPill}>
            <Ionicons name="people" size={16} color="#2563EB" />
            <Text style={styles.teamPillText}>{team.name}</Text>
          </View>
        ))}
      </View>
    );
  };

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
                  <Ionicons name="play" size={24} color="#fff" />
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

  const renderPosts = () => {
    if (!vm?.posts?.length) {
      return <Text style={styles.muted}>Be the first to post a highlight for this game.</Text>;
    }
    return vm.posts.map((post) => <PostCard key={String(post.id)} post={post} />);
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      {renderBanner()}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
      >
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
              <Text style={styles.title}>{vm.title}</Text>
              {vm.location ? (
                <Pressable style={styles.locationRow} onPress={onPressLocation}>
                  <Ionicons name="location" size={16} color="#2563EB" />
                  <Text style={styles.locationText}>{vm.location}</Text>
                </Pressable>
              ) : null}

              <View style={styles.actionsRow}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => {
                    if (!vm.gameId) return;
                    router.push({ pathname: '/game-reviews', params: { game_id: vm.gameId } });
                  }}
                  disabled={!vm.gameId}
                >
                  <Ionicons name="star" size={16} color="#111827" />
                  <Text style={styles.actionText}>Reviews</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => scrollToSection('media')}>
                  <Ionicons name="images" size={16} color="#111827" />
                  <Text style={styles.actionText}>Photos & Videos</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={onShare}>
                  <Ionicons name="arrow-redo" size={16} color="#111827" />
                  <Text style={styles.actionText}>Share</Text>
                </Pressable>
              </View>

              <View style={styles.tabRow}>
                {(['overview', 'media', 'posts'] as SectionKey[]).map((key) => (
                  <Pressable
                    key={key}
                    style={[styles.tabBtn, activeSection === key ? styles.tabBtnOn : null]}
                    onPress={() => {
                      if (key === 'overview') setActiveSection('overview');
                      else scrollToSection(key);
                    }}
                  >
                    <Text style={[styles.tabText, activeSection === key ? styles.tabTextOn : null]}>
                      {key === 'overview' ? 'Overview' : key === 'media' ? 'Media' : 'Posts'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.section}>
                {vm.description ? <Text style={styles.bodyText}>{vm.description}</Text> : <Text style={styles.muted}>No description yet.</Text>}
                {renderStats()}
                <Text style={styles.sectionTitle}>Teams</Text>
                {renderTeams()}
              </View>

              <View
                style={styles.section}
                onLayout={(e) => {
                  sectionOffsets.current.media = e.nativeEvent.layout.y;
                }}
              >
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Media</Text>
                  <Text style={styles.sectionSubtitle}>{vm.media.length ? `${vm.media.length} items` : 'Add highlights'}</Text>
                </View>
                {renderMediaGrid()}
              </View>

              <View
                style={styles.section}
                onLayout={(e) => {
                  sectionOffsets.current.posts = e.nativeEvent.layout.y;
                }}
              >
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Posts</Text>
                  <Text style={styles.sectionSubtitle}>
                    {vm.posts.length ? `${vm.posts.length} posts` : 'No posts yet'}
                  </Text>
                </View>
                {renderPosts()}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

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
    </View>
  );
};

export default GameDetailsScreen;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  bannerWrapper: { position: 'relative', height: 260, backgroundColor: '#eff6ff' },
  bannerImage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  bannerShade: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 },
  bannerTopRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerBottomRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
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
  actionText: { fontWeight: '700', color: '#0f172a' },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    backgroundColor: '#eef2ff',
    borderRadius: 999,
    padding: 4,
  },
  tabBtn: { flex: 1, borderRadius: 999, alignItems: 'center', paddingVertical: 8 },
  tabBtnOn: { backgroundColor: 'white', borderWidth: StyleSheet.hairlineWidth, borderColor: '#c7d2fe' },
  tabText: { fontWeight: '600', color: '#475569' },
  tabTextOn: { color: '#1e3a8a' },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 8 },
  sectionSubtitle: { color: '#64748b', fontWeight: '600' },
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
  viewerBackDrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.9)', alignItems: 'center', justifyContent: 'center' },
  viewerContent: { width: '90%', aspectRatio: 3 / 4, maxHeight: '80%' },
  viewerMedia: { width: '100%', height: '100%', borderRadius: 16 },
});






