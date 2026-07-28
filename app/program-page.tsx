import { useProgramScreenSummary } from '@/hooks/useProgramScreenSummary';
// @ts-ignore JS exports
import { Program } from '@/api/entities';
import { useAuth } from '@/context/AuthProvider';
import { Colors } from '@/constants/Colors';
import { buildProgramSubTeams, formatProgramLabel } from '@/constants/programs';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { gameRowTitle } from '@/utils/eventTitle';
import { optimizeImageUrl } from '@/utils/imageUrl';
import { replaceAsRedirect, safeGoBack } from '@/utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type ProgramLevel = {
  level: string | null;
  team: Record<string, any>;
  games: Record<string, any>[];
};

function ProgramScreen() {
  const { user: currentUser } = useAuth();
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const programId = params.id?.trim() || undefined;

  const query = useProgramScreenSummary(programId);
  const queryClient = useQueryClient();
  const data = query.data;

  // Optimistic follow state, re-seeded from the server whenever fresh data lands
  // (including after invalidation), so the server stays the source of truth.
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  useEffect(() => {
    if (!data?.program) return;
    setIsFollowing(!!data.program.is_following);
    setFollowersCount(data.program.followers_count ?? 0);
  }, [data]);

  // A sport with exactly ONE (visible) team is not a "program" — it's that
  // single team. Redirect to its team page so the org never shows both an empty
  // program wrapper AND a team page for the same thing (owner's no-duplicates
  // rule). from=program stops the team page bouncing back here. Latched so it
  // fires once. Multi-team sports and all-hidden (0-team) programs stay put.
  const redirectedToTeamRef = useRef(false);
  useEffect(() => {
    if (redirectedToTeamRef.current) return;
    const levels = data?.levels;
    if (!Array.isArray(levels) || levels.length !== 1) return;
    const soleTeam = levels[0]?.team as { id?: string | number; name?: string } | undefined;
    const teamId = soleTeam?.id;
    if (teamId == null || String(teamId).length === 0) return;
    redirectedToTeamRef.current = true;
    replaceAsRedirect(router, {
      pathname: '/team-page',
      params: { id: String(teamId), name: soleTeam?.name ?? '', from: 'program' },
    } as any); // nav-safe: a single-team sport IS the team; canonical page is the team page, from=program stops the reverse redirect
  }, [data, router]);

  // ONE page per sport: the sub-teams (Boys Varsity, Girls JV, …) are a tappable
  // list; picking one shows just that sub-team's upcoming events. There are no
  // separate per-sub-team public pages — everything lives on this page.
  const subTeams = useMemo(
    () => buildProgramSubTeams((data?.levels ?? []) as ProgramLevel[]),
    [data?.levels]
  );
  const [selectedTeamOverride, setSelectedTeamOverride] = useState<string | null>(null);
  const activeSubTeam =
    subTeams.find(s => s.teamId === selectedTeamOverride) ?? subTeams[0] ?? null;

  const handleFollow = async () => {
    if (!programId || followLoading) return;
    if (!currentUser) {
      router.push('/sign-in' as any);
      return;
    }
    const prevFollowing = isFollowing;
    const prevCount = followersCount;
    setFollowLoading(true);
    setIsFollowing(!prevFollowing);
    setFollowersCount(prevFollowing ? Math.max(0, prevCount - 1) : prevCount + 1);
    try {
      if (prevFollowing) {
        await Program.unfollow(programId);
      } else {
        await Program.follow(programId);
      }
    } catch (err: any) {
      // Roll back the optimistic toggle and surface the failure — never silent.
      setIsFollowing(prevFollowing);
      setFollowersCount(prevCount);
      const serverMsg = err?.data?.error || err?.data?.message || err?.message || 'Unknown error';
      if (__DEV__) console.error('[program-page] follow/unfollow failed:', serverMsg);
      Alert.alert('Follow Failed', `${serverMsg} (status: ${err?.status || 'unknown'})`);
    } finally {
      setFollowLoading(false);
      void queryClient.invalidateQueries({ queryKey: ['program-page', programId] });
    }
  };

  const renderBackButton = () => (
    <Pressable
      testID="program-page-back-button"
      onPress={() => safeGoBack(router, '/(tabs)/feed')}
      style={[
        styles.controlButton,
        {
          backgroundColor:
            colorScheme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.9)',
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons name="arrow-back" size={18} color={theme.text} />
    </Pressable>
  );

  const renderGameRow = (g: any, viewedTeamId: string, levelTag?: string | null) => {
    const rawDate = g.scheduled_date || g.date;
    const dateStr = rawDate
      ? new Date(rawDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'TBD';
    const isAwaySide = g.away_team_id != null && String(g.away_team_id) === viewedTeamId;
    const opponent = isAwaySide
      ? g.home_team || g.opponent_name || 'TBD'
      : g.opponent_name || g.away_team || g.awayTeam || g.away_team_name || 'TBD';
    const gameType = g.game_type || 'Game';
    // Level tag replaces per-level folders: rows stay attributable inside the
    // single merged feed. Single-level programs skip the tag (nothing to tell apart).
    const subtitle = levelTag ? `${levelTag} · ${gameType}` : gameType;
    const hasScore = g.home_score != null || g.away_score != null;
    const gameId = g.id ? String(g.id) : null;
    const rowTitle = gameRowTitle({ ...g, opponent });
    return (
      <Pressable
        key={gameId ?? `${viewedTeamId}-${rowTitle}-${dateStr}`}
        disabled={!gameId}
        onPress={() =>
          gameId && router.push({ pathname: '/game/[id]', params: { id: gameId } } as any)
        }
        accessibilityRole="button"
        accessibilityLabel={`Open event ${rowTitle} on ${dateStr}`}
        style={({ pressed }) => [
          styles.eventRow,
          { backgroundColor: theme.card, borderColor: theme.border },
          pressed && gameId ? { opacity: 0.6 } : null,
        ]}
      >
        <View style={[styles.eventDateBadge, { backgroundColor: theme.tint + '22' }]}>
          <Text style={[styles.eventDate, { color: theme.tint }]}>{dateStr}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.eventTitle, { color: theme.text }]} numberOfLines={1}>
            {rowTitle}
          </Text>
          <Text style={[styles.eventTypeText, { color: theme.mutedText }]}>{subtitle}</Text>
        </View>
        {hasScore && (
          <Text style={[styles.eventScore, { color: theme.text }]}>
            {g.home_score ?? '-'} - {g.away_score ?? '-'}
          </Text>
        )}
      </Pressable>
    );
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (programId && query.isPending) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <Stack.Screen options={{ title: 'Program', headerShown: false }} />
        <View style={[styles.topBar, { paddingTop: Math.max(8, insets.top) }]}>
          {renderBackButton()}
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (!programId || query.isError) {
    const message = !programId
      ? 'No program ID provided'
      : (query.error as any)?.message || 'Failed to load program';
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <Stack.Screen options={{ title: 'Program', headerShown: false }} />
        <View style={[styles.topBar, { paddingTop: Math.max(8, insets.top) }]}>
          {renderBackButton()}
        </View>
        <View style={styles.center}>
          <Text style={[styles.error, { color: theme.text }]}>{message}</Text>
          {programId && (
            <Pressable onPress={() => void query.refetch()} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const program = data?.program;
  if (!program) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <Stack.Screen options={{ title: 'Program', headerShown: false }} />
        <View style={[styles.topBar, { paddingTop: Math.max(8, insets.top) }]}>
          {renderBackButton()}
        </View>
        <View style={styles.center}>
          <Text style={[styles.error, { color: theme.text }]}>Program not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const levels = (data?.levels ?? []) as ProgramLevel[];
  const counts = data?.counts ?? { levels: 0, teams: 0, games: 0 };
  // A one-team sport reads as a plain schedule, not a multi-team "program":
  // the PROGRAM badge only adds meaning (and the doubled "Soccer / PROGRAM"
  // look the owner flagged) when the program actually aggregates >1 team.
  const isSingleTeam = levels.length <= 1;
  const title = formatProgramLabel({
    id: program.id,
    sport: program.sport,
    name: program.name,
  });
  const logoUrl = program.logo_url || levels[0]?.team?.logo_url || null;
  const orgName =
    (typeof program.organization?.name === 'string' && program.organization.name.trim()) || '';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen options={{ title, headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: Math.max(32, insets.bottom + 16) }}>
        {/* Banner */}
        <View style={styles.headerContainer}>
          <LinearGradient
            colors={['#1e3a8a', '#0f172a']}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={[styles.headerControls, { top: Math.max(12, insets.top) }]}>
            {renderBackButton()}
          </View>
          <View style={styles.profileContent}>
            <View style={styles.avatarContainer}>
              {logoUrl ? (
                <Image
                  source={{ uri: optimizeImageUrl(String(logoUrl), 160) }}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.surface }]}>
                  <Ionicons name="trophy" size={44} color={theme.mutedText} />
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Title + follow */}
        <View style={styles.detailsContainer}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextWrap}>
              <Text style={[styles.programName, { color: theme.text }]} numberOfLines={2}>
                {title}
              </Text>
              {!isSingleTeam && (
                <View style={[styles.programBadge]}>
                  <Text style={styles.programBadgeText}>PROGRAM</Text>
                </View>
              )}
            </View>
            <Pressable
              testID="program-page-follow-button"
              onPress={handleFollow}
              disabled={followLoading}
              style={[
                styles.followButton,
                { backgroundColor: isFollowing ? '#10B981' : '#FFD600' },
                followLoading && { opacity: 0.5 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={isFollowing ? 'Unfollow program' : 'Follow program'}
            >
              {isFollowing ? (
                // audit: fixed white on the fixed green button (theme-independent bg)
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              ) : (
                // audit: fixed dark glyph on the fixed yellow button — theme.text was
                // near-white in dark mode (~1.2:1 on #FFD600, near-invisible)
                <Ionicons name="person-add" size={16} color="#1A1A1A" />
              )}
            </Pressable>
          </View>

          {/* Organization link */}
          <Pressable
            testID="program-page-org-button"
            style={[styles.orgButton, { borderColor: theme.border, backgroundColor: theme.card }]}
            onPress={() =>
              program.organization_id &&
              router.push({
                pathname: '/organization',
                params: { id: program.organization_id, tab: 'overview' },
              } as any)
            }
            disabled={!program.organization_id}
          >
            <Ionicons
              name="business-outline"
              size={16}
              color={program.organization_id ? theme.text : theme.mutedText}
            />
            <Text
              style={[
                styles.orgButtonText,
                { color: program.organization_id ? theme.text : theme.mutedText },
              ]}
              numberOfLines={1}
            >
              {orgName || 'Organization'}
            </Text>
            {program.organization_id && (
              <Ionicons name="chevron-forward" size={14} color={theme.text} />
            )}
          </Pressable>

          {/* Stats */}
          <View style={styles.statsRow}>
            <Text style={[styles.statNumber, { color: theme.text }]}>{counts.teams}</Text>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}> Teams </Text>
            <Text style={[styles.statNumber, { color: theme.text }]}>{followersCount}</Text>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}> Followers </Text>
            <Text style={[styles.statNumber, { color: theme.text }]}>{counts.games}</Text>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}> Games</Text>
          </View>
        </View>

        {/* One page per sport: gender toggle + level chips + one merged feed.
            Controls render only when they disambiguate — a single-team program
            is just a plain schedule. Level teams have no public page; the
            level tag on each row keeps games attributable. */}
        {levels.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={40} color={theme.mutedText} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No teams in this program yet
            </Text>
          </View>
        ) : (
          <View style={styles.feedSection}>
            {/* Sub-team picker: the whole sport is ONE page — tap a sub-team
                (Boys Varsity, Girls JV, …) to see just its upcoming events.
                Hidden when there's only one sub-team (nothing to pick). */}
            {subTeams.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.subTeamRow}
              >
                {subTeams.map(st => {
                  const selected = st.teamId === activeSubTeam?.teamId;
                  return (
                    <Pressable
                      key={st.teamId}
                      testID={`program-subteam-${st.teamId}`}
                      onPress={() => setSelectedTeamOverride(st.teamId)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Show ${st.label} events`}
                      style={[
                        styles.subTeamChip,
                        {
                          borderColor: selected ? theme.tint : theme.border,
                          backgroundColor: selected ? theme.tint : theme.card,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.subTeamChipText,
                          // audit: fixed white on the selected theme.tint chip
                          { color: selected ? '#FFFFFF' : theme.text },
                        ]}
                      >
                        {st.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {!activeSubTeam || activeSubTeam.games.length === 0 ? (
              <Text style={[styles.folderEmpty, { color: theme.mutedText }]}>
                No upcoming events
              </Text>
            ) : (
              activeSubTeam.games.map(g => renderGameRow(g, activeSubTeam.teamId, null))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  topBar: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row' },
  error: { textAlign: 'center', marginBottom: 16, fontSize: 15 },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  retryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },

  headerContainer: {
    position: 'relative',
    width: '100%',
    height: 180,
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  headerGradient: { ...StyleSheet.absoluteFillObject, height: 180 },
  headerControls: {
    position: 'absolute',
    left: 16,
    zIndex: 200,
    elevation: 200,
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  profileContent: { position: 'absolute', bottom: -40, left: 16, zIndex: 100 },
  avatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    borderColor: '#ffffff',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 41 },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsContainer: { paddingHorizontal: 16, paddingTop: 52 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleTextWrap: { flex: 1, minWidth: 0, gap: 6 },
  programName: { fontSize: 22, fontWeight: '700' },
  programBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
  },
  programBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  followButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  orgButtonText: { fontSize: 14, fontWeight: '500', flexShrink: 1 },
  statsRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 12 },
  statNumber: { fontSize: 15, fontWeight: '700' },
  statLabel: { fontSize: 15, fontWeight: '400' },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },

  feedSection: { marginTop: 16, paddingHorizontal: 16 },
  subTeamRow: { flexDirection: 'row', gap: 8, paddingBottom: 10 },
  subTeamChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  subTeamChipText: { fontSize: 14, fontWeight: '600' },
  folderEmpty: { fontSize: 14, paddingVertical: 12, paddingHorizontal: 4 },

  eventRow: {
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventDateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  eventDate: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  eventTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  eventTypeText: { fontSize: 13 },
  eventScore: { fontSize: 16, fontWeight: '700', marginLeft: 12 },
});

export default ProgramScreen;
