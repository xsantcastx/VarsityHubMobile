import { useProgramScreenSummary } from '@/hooks/useProgramScreenSummary';
// @ts-ignore JS exports
import { Program } from '@/api/entities';
import { useAuth } from '@/context/AuthProvider';
import { Colors } from '@/constants/Colors';
import { formatLevelLabel, formatProgramLabel } from '@/constants/programs';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { gameRowTitle } from '@/utils/eventTitle';
import { safeGoBack } from '@/utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

  // Collapse state per folder index. A folder is expanded when its override is
  // set; otherwise the first folder (index 0) is expanded by default.
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});
  const isExpanded = (idx: number) => (idx in overrides ? overrides[idx] : idx === 0);
  const toggleFolder = (idx: number) =>
    setOverrides(prev => ({ ...prev, [idx]: !(idx in prev ? prev[idx] : idx === 0) }));

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

  const renderGameRow = (g: any, viewedTeamId: string) => {
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
          <Text style={[styles.eventTypeText, { color: theme.mutedText }]}>{gameType}</Text>
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
  const title = formatProgramLabel({
    id: program.id,
    sport: program.sport,
    gender: program.gender,
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
                  source={{ uri: String(logoUrl) }}
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
              <View style={[styles.programBadge]}>
                <Text style={styles.programBadgeText}>PROGRAM</Text>
              </View>
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
                <Ionicons name="checkmark" size={18} color={theme.text} />
              ) : (
                <Ionicons name="person-add" size={16} color={theme.text} />
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

        {/* Level folders */}
        {levels.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={40} color={theme.mutedText} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No teams in this program yet
            </Text>
          </View>
        ) : (
          levels.map((lvl, idx) => {
            const expanded = isExpanded(idx);
            const levelLabel = formatLevelLabel(lvl.level) ?? 'Team';
            const teamId = String(lvl.team?.id ?? '');
            const games = Array.isArray(lvl.games) ? lvl.games : [];
            return (
              <View key={teamId || `level-${idx}`} style={styles.folder}>
                <Pressable
                  testID={`program-folder-header-${idx}`}
                  onPress={() => toggleFolder(idx)}
                  style={[
                    styles.folderHeader,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`${levelLabel}, ${games.length} games`}
                >
                  <Ionicons
                    name={expanded ? 'chevron-down' : 'chevron-forward'}
                    size={18}
                    color={theme.mutedText}
                  />
                  <View style={styles.folderTitleWrap}>
                    <Text style={[styles.folderTitle, { color: theme.text }]} numberOfLines={1}>
                      {levelLabel}
                    </Text>
                    <Text style={[styles.folderCount, { color: theme.mutedText }]}>
                      {games.length} {games.length === 1 ? 'game' : 'games'}
                    </Text>
                  </View>
                  <Pressable
                    testID={`program-folder-teampage-${idx}`}
                    hitSlop={8}
                    onPress={() =>
                      teamId &&
                      router.push(`/team-page?id=${encodeURIComponent(teamId)}&from=program` as any)
                    }
                    disabled={!teamId}
                    accessibilityRole="button"
                    accessibilityLabel="Open team page"
                    style={styles.teamPageLink}
                  >
                    <Text style={[styles.teamPageLinkText, { color: theme.tint }]}>Team page</Text>
                    <Ionicons name="open-outline" size={14} color={theme.tint} />
                  </Pressable>
                </Pressable>

                {expanded &&
                  (games.length === 0 ? (
                    <Text style={[styles.folderEmpty, { color: theme.mutedText }]}>
                      No games scheduled
                    </Text>
                  ) : (
                    games.map(g => renderGameRow(g, teamId))
                  ))}
              </View>
            );
          })
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

  folder: { marginTop: 12, paddingHorizontal: 16 },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  folderTitleWrap: { flex: 1, minWidth: 0 },
  folderTitle: { fontSize: 16, fontWeight: '700' },
  folderCount: { fontSize: 13, marginTop: 2 },
  teamPageLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  teamPageLinkText: { fontSize: 13, fontWeight: '600' },
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
