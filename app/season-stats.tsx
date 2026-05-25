import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { safeGoBack } from '@/utils/navigation';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

// @ts-ignore JS exports
import { Game as GameAPI, Team as TeamAPI } from '@/api/entities';

interface TeamStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  winPercentage: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
  avgPointsFor: number;
  avgPointsAgainst: number;
  homeRecord: string;
  awayRecord: string;
  streak: string;
  lastFiveGames: string;
}

interface PlayerStat {
  id: string;
  name: string;
  position: string;
  gamesPlayed: number;
  role: string;
}

interface GameResult {
  id: string;
  title: string;
  date: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  result: 'W' | 'L' | 'T' | null; // from team's perspective
  status: string;
  isHome: boolean;
}

function computeTeamStats(games: any[], teamId: string): TeamStats {
  const completed = games.filter((g: any) => g.status === 'completed' && g.winner);

  let wins = 0, losses = 0, ties = 0;
  let pointsFor = 0, pointsAgainst = 0;
  let homeWins = 0, homeLosses = 0, homeTies = 0;
  let awayWins = 0, awayLosses = 0, awayTies = 0;

  for (const g of completed) {
    const isHome = g.home_team_id === teamId;
    const teamScore = isHome ? (g.home_score ?? 0) : (g.away_score ?? 0);
    const oppScore = isHome ? (g.away_score ?? 0) : (g.home_score ?? 0);

    pointsFor += teamScore;
    pointsAgainst += oppScore;

    if (g.winner === 'tie') {
      ties++;
      if (isHome) homeTies++; else awayTies++;
    } else if ((g.winner === 'home' && isHome) || (g.winner === 'away' && !isHome)) {
      wins++;
      if (isHome) homeWins++; else awayWins++;
    } else {
      losses++;
      if (isHome) homeLosses++; else awayLosses++;
    }
  }

  const gamesPlayed = wins + losses + ties;
  const winPercentage = gamesPlayed > 0 ? wins / gamesPlayed : 0;

  // Streak: count consecutive same results from most recent
  const sorted = [...completed].filter((g: any) => g.date).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  let streak = '-';
  if (sorted.length > 0) {
    const getOutcome = (g: any) => {
      const isHome = g.home_team_id === teamId;
      if (g.winner === 'tie') return 'T';
      if ((g.winner === 'home' && isHome) || (g.winner === 'away' && !isHome)) return 'W';
      return 'L';
    };
    const firstOutcome = getOutcome(sorted[0]);
    let count = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (getOutcome(sorted[i]) === firstOutcome) count++;
      else break;
    }
    streak = `${firstOutcome}${count}`;
  }

  // Last 5
  const last5 = sorted.slice(0, 5).map((g: any) => {
    const isHome = g.home_team_id === teamId;
    if (g.winner === 'tie') return 'T';
    if ((g.winner === 'home' && isHome) || (g.winner === 'away' && !isHome)) return 'W';
    return 'L';
  });

  const formatRec = (w: number, l: number, t: number) => `${w}-${l}${t > 0 ? `-${t}` : ''}`;

  return {
    gamesPlayed,
    wins,
    losses,
    ties,
    winPercentage,
    pointsFor,
    pointsAgainst,
    pointDifferential: pointsFor - pointsAgainst,
    avgPointsFor: gamesPlayed > 0 ? pointsFor / gamesPlayed : 0,
    avgPointsAgainst: gamesPlayed > 0 ? pointsAgainst / gamesPlayed : 0,
    homeRecord: formatRec(homeWins, homeLosses, homeTies),
    awayRecord: formatRec(awayWins, awayLosses, awayTies),
    streak,
    lastFiveGames: last5.join('-') || '-',
  };
}

function buildGameResults(games: any[], teamId: string): GameResult[] {
  return games
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((g: any) => {
      const isHome = g.home_team_id === teamId;
      let result: 'W' | 'L' | 'T' | null = null;
      if (g.status === 'completed' && g.winner) {
        if (g.winner === 'tie') result = 'T';
        else if ((g.winner === 'home' && isHome) || (g.winner === 'away' && !isHome)) result = 'W';
        else result = 'L';
      }
      return {
        id: g.id,
        title: g.title || '',
        date: g.date,
        homeTeamName: g.homeTeam?.name || (isHome ? 'Your Team' : 'Opponent'),
        awayTeamName: g.awayTeam?.name || (!isHome ? 'Your Team' : 'Opponent'),
        homeScore: g.home_score ?? null,
        awayScore: g.away_score ?? null,
        result,
        status: g.status,
        isHome,
      };
    });
}

// TODO v1.1: Wire up navigation from manage-season
function SeasonStatsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const params = useLocalSearchParams<{ teamId?: string }>();
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'team' | 'players' | 'games'>('team');
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [gameResults, setGameResults] = useState<GameResult[]>([]);
  const [teamName, setTeamName] = useState<string>('');
  const [activeTeamId, setActiveTeamId] = useState<string | null>(params.teamId ?? null);
  const [managedTeams, setManagedTeams] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (teamIdToLoad?: string | null) => {
    try {
      setError(null);
      let tid = teamIdToLoad ?? activeTeamId;

      // If no teamId, pick first managed team
      if (!tid) {
        try {
          const teams = await TeamAPI.managed();
          const teamList = Array.isArray(teams) ? teams : (teams?.teams ?? []);
          setManagedTeams(teamList);
          if (teamList.length > 0) {
            tid = teamList[0].id;
            setActiveTeamId(tid);
            setTeamName(teamList[0].name || '');
          } else {
            setLoading(false);
            setError('No managed teams found');
            return;
          }
        } catch {
          setLoading(false);
          setError('Could not load teams');
          return;
        }
      }

      // Fetch team details, games, and members in parallel
      const resolvedTid = tid!;
      const [gamesRes, membersRes] = await Promise.all([
        GameAPI.list('-date', { limit: 100, teamId: resolvedTid }),
        TeamAPI.members(resolvedTid).catch(() => []),
      ]);

      // If we don't have team name yet, fetch it
      if (!teamName && tid) {
        try {
          const team = await TeamAPI.get(tid);
          setTeamName(team?.name || '');
        } catch {
          // non-critical
        }
      }

      // Normalize games list
      const allGames: any[] = Array.isArray(gamesRes) ? gamesRes : (gamesRes?.games ?? gamesRes?.items ?? []);

      // Filter to games this team played in
      const teamGames = allGames.filter(
        (g: any) => g.home_team_id === tid || g.away_team_id === tid
      );

      // Compute stats
      const stats = computeTeamStats(teamGames, tid!);
      setTeamStats(stats);

      // Build game results
      setGameResults(buildGameResults(teamGames, tid!));

      // Build player list from members
      const membersList = Array.isArray(membersRes) ? membersRes : (membersRes?.members ?? []);
      const players: PlayerStat[] = membersList.map((m: any) => ({
        id: m.id || m.user_id || String(Math.random()),
        name: m.display_name || m.name || m.email || 'Unknown',
        position: m.custom_position || m.position || '-',
        gamesPlayed: stats.gamesPlayed, // team-level games played (no per-player tracking)
        role: m.role || 'player',
      }));
      setPlayerStats(players);
    } catch (err: any) {
      if (__DEV__) console.error('[SeasonStats] Error loading data:', err);
      setError(err?.message || 'Failed to load stats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTeamId, teamName]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadData(params.teamId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadData is stable; only re-run on teamId change
    }, [params.teamId])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
  }, [loadData]);

  const getStreakColor = (streak: string) => {
    if (streak.startsWith('W')) return '#10B981';
    if (streak.startsWith('L')) return '#EF4444';
    return '#6B7280';
  };

  const formatRecord = (wins: number, losses: number, ties: number) => {
    return `${wins}-${losses}${ties > 0 ? `-${ties}` : ''}`;
  };

  const getResultColor = (result: 'W' | 'L' | 'T' | null) => {
    if (result === 'W') return '#10B981';
    if (result === 'L') return '#EF4444';
    if (result === 'T') return '#6B7280';
    return theme.mutedText;
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const screenOptions = {
    title: 'Season Statistics',
    headerShown: true,
    headerStyle: { backgroundColor: theme.background },
    headerTintColor: theme.text,
    headerLeft: () => (
      <Pressable onPress={() => { safeGoBack(router); }} style={{ paddingLeft: 8 }}>
        <MaterialIcons name="chevron-left" size={24} color={theme.tint} />
      </Pressable>
    ),
  } as const;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={screenOptions} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.tint} />
          <Text style={[styles.loadingText, { color: theme.mutedText }]}>
            Loading stats...
          </Text>
        </View>
      </View>
    );
  }

  if (error || !teamStats) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={screenOptions} />
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.tint]} />
          }
        >
          <MaterialIcons name="bar-chart" size={48} color={theme.mutedText} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No Stats Available
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.mutedText }]}>
            {error || 'No team data found. Pull to refresh.'}
          </Text>
        </ScrollView>
      </View>
    );
  }

  // Team selector when multiple managed teams and no explicit teamId param
  const showTeamSelector = !params.teamId && managedTeams.length > 1;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={screenOptions} />

      {/* Team Selector */}
      {showTeamSelector && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.teamSelectorContainer} contentContainerStyle={styles.teamSelectorContent}>
          {managedTeams.map((t: any) => (
            <Pressable
              key={t.id}
              style={[
                styles.teamSelectorChip,
                {
                  backgroundColor: activeTeamId === t.id ? theme.tint : theme.surface,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => {
                setActiveTeamId(t.id);
                setTeamName(t.name || '');
                setLoading(true);
                void loadData(t.id);
              }}
            >
              <Text
                style={[
                  styles.teamSelectorText,
                  { color: activeTeamId === t.id ? '#fff' : theme.text },
                ]}
                numberOfLines={1}
              >
                {t.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Header Stats Overview */}
      <View style={[styles.headerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <LinearGradient
          colors={[theme.tint, theme.tint + '80']}
          style={styles.statsGradient}
        >
          <View style={styles.seasonHeader}>
            <View style={styles.seasonInfo}>
              <Text style={styles.seasonTitle}>{teamName || 'Season Stats'}</Text>
              <Text style={styles.recordText}>
                {formatRecord(teamStats.wins, teamStats.losses, teamStats.ties)} • {(teamStats.winPercentage * 100).toFixed(1)}% Win Rate
              </Text>
            </View>
            {teamStats.streak !== '-' && (
              <View style={[styles.streakBadge, { backgroundColor: getStreakColor(teamStats.streak) }]}>
                <Text style={styles.streakText}>{teamStats.streak}</Text>
              </View>
            )}
          </View>

          <View style={styles.quickStatsGrid}>
            <View style={styles.quickStat}>
              <Text style={styles.quickStatNumber}>{teamStats.pointsFor}</Text>
              <Text style={styles.quickStatLabel}>Points For</Text>
            </View>
            <View style={styles.quickStat}>
              <Text style={styles.quickStatNumber}>{teamStats.pointsAgainst}</Text>
              <Text style={styles.quickStatLabel}>Points Against</Text>
            </View>
            <View style={styles.quickStat}>
              <Text style={styles.quickStatNumber}>{teamStats.pointDifferential > 0 ? '+' : ''}{teamStats.pointDifferential}</Text>
              <Text style={styles.quickStatLabel}>Differential</Text>
            </View>
            <View style={styles.quickStat}>
              <Text style={styles.quickStatNumber}>{teamStats.avgPointsFor.toFixed(1)}</Text>
              <Text style={styles.quickStatLabel}>Avg/Game</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Tab Navigation */}
      <View style={[styles.tabContainer, { backgroundColor: theme.surface }]}>
        {(['team', 'players', 'games'] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[
              styles.tab,
              { backgroundColor: selectedTab === tab ? theme.tint : 'transparent' }
            ]}
            onPress={() => setSelectedTab(tab)}
          >
            <Text style={[
              styles.tabText,
              { color: selectedTab === tab ? '#fff' : theme.text }
            ]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.tint]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {selectedTab === 'team' && (
          <View style={styles.tabContent}>
            {teamStats.gamesPlayed === 0 ? (
              <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.emptyTabText, { color: theme.mutedText }]}>
                  No completed games yet. Stats will appear once games have been played and results recorded.
                </Text>
              </View>
            ) : (
              <>
                {/* Overall Record */}
                <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Overall Record
                  </Text>

                  <View style={styles.recordGrid}>
                    <View style={styles.recordItem}>
                      <Text style={[styles.recordValue, { color: '#10B981' }]}>{teamStats.wins}</Text>
                      <Text style={[styles.recordLabel, { color: theme.text }]}>Wins</Text>
                    </View>
                    <View style={styles.recordItem}>
                      <Text style={[styles.recordValue, { color: '#EF4444' }]}>{teamStats.losses}</Text>
                      <Text style={[styles.recordLabel, { color: theme.text }]}>Losses</Text>
                    </View>
                    <View style={styles.recordItem}>
                      <Text style={[styles.recordValue, { color: theme.mutedText }]}>{teamStats.ties}</Text>
                      <Text style={[styles.recordLabel, { color: theme.text }]}>Ties</Text>
                    </View>
                    <View style={styles.recordItem}>
                      <Text style={[styles.recordValue, { color: theme.text }]}>{teamStats.gamesPlayed}</Text>
                      <Text style={[styles.recordLabel, { color: theme.text }]}>Played</Text>
                    </View>
                  </View>

                  <View style={styles.percentageBar}>
                    <View style={[styles.percentageTrack, { backgroundColor: theme.border }]}>
                      <View
                        style={[
                          styles.percentageFill,
                          {
                            width: `${teamStats.winPercentage * 100}%`,
                            backgroundColor: theme.tint
                          }
                        ]}
                      />
                    </View>
                    <Text style={[styles.percentageText, { color: theme.text }]}>
                      {(teamStats.winPercentage * 100).toFixed(1)}% Win Rate
                    </Text>
                  </View>
                </View>

                {/* Home vs Away */}
                <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Home vs Away Performance
                  </Text>

                  <View style={styles.homeAwayGrid}>
                    <View style={[styles.homeAwayItem, { backgroundColor: theme.background }]}>
                      <MaterialIcons name="home" size={20} color={theme.tint} />
                      <Text style={[styles.homeAwayLabel, { color: theme.text }]}>Home</Text>
                      <Text style={[styles.homeAwayRecord, { color: theme.text }]}>
                        {teamStats.homeRecord}
                      </Text>
                    </View>

                    <View style={[styles.homeAwayItem, { backgroundColor: theme.background }]}>
                      <MaterialIcons name="flight" size={20} color={theme.tint} />
                      <Text style={[styles.homeAwayLabel, { color: theme.text }]}>Away</Text>
                      <Text style={[styles.homeAwayRecord, { color: theme.text }]}>
                        {teamStats.awayRecord}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Scoring Stats */}
                <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Scoring Statistics
                  </Text>

                  <View style={styles.scoringStats}>
                    <View style={styles.scoringStat}>
                      <View style={styles.scoringStatHeader}>
                        <MaterialIcons name="trending-up" size={16} color="#10B981" />
                        <Text style={[styles.scoringStatLabel, { color: theme.text }]}>
                          Points For
                        </Text>
                      </View>
                      <Text style={[styles.scoringStatValue, { color: theme.text }]}>
                        {teamStats.pointsFor}
                      </Text>
                      <Text style={[styles.scoringStatAvg, { color: theme.mutedText }]}>
                        {teamStats.avgPointsFor.toFixed(1)} per game
                      </Text>
                    </View>

                    <View style={styles.scoringStat}>
                      <View style={styles.scoringStatHeader}>
                        <MaterialIcons name="trending-down" size={16} color="#EF4444" />
                        <Text style={[styles.scoringStatLabel, { color: theme.text }]}>
                          Points Against
                        </Text>
                      </View>
                      <Text style={[styles.scoringStatValue, { color: theme.text }]}>
                        {teamStats.pointsAgainst}
                      </Text>
                      <Text style={[styles.scoringStatAvg, { color: theme.mutedText }]}>
                        {teamStats.avgPointsAgainst.toFixed(1)} per game
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.differentialCard, { backgroundColor: theme.background }]}>
                    <Text style={[styles.differentialLabel, { color: theme.text }]}>
                      Point Differential
                    </Text>
                    <Text style={[
                      styles.differentialValue,
                      { color: teamStats.pointDifferential >= 0 ? '#10B981' : '#EF4444' }
                    ]}>
                      {teamStats.pointDifferential > 0 ? '+' : ''}{teamStats.pointDifferential}
                    </Text>
                  </View>
                </View>

                {/* Recent Form */}
                <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Recent Form
                  </Text>

                  <View style={styles.formContainer}>
                    <View style={styles.formStat}>
                      <Text style={[styles.formLabel, { color: theme.text }]}>
                        Current Streak
                      </Text>
                      <View style={[styles.formBadge, { backgroundColor: getStreakColor(teamStats.streak) }]}>
                        <Text style={styles.formBadgeText}>{teamStats.streak}</Text>
                      </View>
                    </View>

                    {teamStats.lastFiveGames !== '-' && (
                      <View style={styles.formStat}>
                        <Text style={[styles.formLabel, { color: theme.text }]}>
                          Last {teamStats.lastFiveGames.split('-').length} Games
                        </Text>
                        <View style={styles.formHistory}>
                          {teamStats.lastFiveGames.split('-').map((result, index) => (
                            <View
                              key={index}
                              style={[
                                styles.formResult,
                                { backgroundColor: result === 'W' ? '#10B981' : result === 'L' ? '#EF4444' : '#6B7280' }
                              ]}
                            >
                              <Text style={styles.formResultText}>{result}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              </>
            )}
          </View>
        )}

        {selectedTab === 'players' && (
          <View style={styles.tabContent}>
            <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Team Members
              </Text>

              {playerStats.length === 0 ? (
                <Text style={[styles.emptyTabText, { color: theme.mutedText }]}>
                  No team members found. Invite players to your team to see them here.
                </Text>
              ) : (
                playerStats.map((player, index) => (
                  <View key={player.id} style={[styles.playerCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <View style={styles.playerHeader}>
                      <View style={styles.playerInfo}>
                        <View style={[styles.playerRank, { backgroundColor: theme.card }]}>
                          <Text style={[styles.rankNumber, { color: theme.mutedText }]}>
                            {index + 1}
                          </Text>
                        </View>
                        <View style={styles.playerDetails}>
                          <Text style={[styles.playerName, { color: theme.text }]}>
                            {player.name}
                          </Text>
                          <Text style={[styles.playerPosition, { color: theme.mutedText }]}>
                            {player.position}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.playerMainStat}>
                        <Text style={[styles.playerPoints, { color: theme.text }]}>
                          {player.gamesPlayed}
                        </Text>
                        <Text style={[styles.playerPointsLabel, { color: theme.mutedText }]}>
                          GP
                        </Text>
                      </View>
                    </View>

                    <View style={styles.playerStats}>
                      <View style={styles.playerStatItem}>
                        <Text style={[styles.playerStatValue, { color: theme.text }]}>
                          {player.role}
                        </Text>
                        <Text style={[styles.playerStatLabel, { color: theme.mutedText }]}>
                          ROLE
                        </Text>
                      </View>
                      <View style={styles.playerStatItem}>
                        <Text style={[styles.playerStatValue, { color: theme.text }]}>
                          {player.position}
                        </Text>
                        <Text style={[styles.playerStatLabel, { color: theme.mutedText }]}>
                          POS
                        </Text>
                      </View>
                      <View style={styles.playerStatItem}>
                        <Text style={[styles.playerStatValue, { color: theme.text }]}>
                          {player.gamesPlayed}
                        </Text>
                        <Text style={[styles.playerStatLabel, { color: theme.mutedText }]}>
                          GAMES
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {selectedTab === 'games' && (
          <View style={styles.tabContent}>
            <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Game Results
              </Text>

              {gameResults.length === 0 ? (
                <Text style={[styles.emptyTabText, { color: theme.mutedText }]}>
                  No games found for this team yet.
                </Text>
              ) : (
                gameResults.map((game) => (
                  <View key={game.id} style={[styles.gameCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <View style={styles.gameCardHeader}>
                      <Text style={[styles.gameDate, { color: theme.mutedText }]}>
                        {formatDate(game.date)}
                      </Text>
                      {game.result ? (
                        <View style={[styles.gameResultBadge, { backgroundColor: getResultColor(game.result) }]}>
                          <Text style={styles.gameResultBadgeText}>{game.result}</Text>
                        </View>
                      ) : (
                        <View style={[styles.gameResultBadge, { backgroundColor: theme.mutedText }]}>
                          <Text style={styles.gameResultBadgeText}>
                            {game.status === 'upcoming' ? 'TBD' : game.status === 'cancelled' ? 'CAN' : '-'}
                          </Text>
                        </View>
                      )}
                    </View>

                    {game.title ? (
                      <Text style={[styles.gameTitle, { color: theme.text }]} numberOfLines={1}>
                        {game.title}
                      </Text>
                    ) : null}

                    <View style={styles.gameScoreLine}>
                      <View style={styles.gameTeam}>
                        <Text style={[
                          styles.gameTeamName,
                          { color: theme.text, fontWeight: game.isHome ? '800' : '500' }
                        ]} numberOfLines={1}>
                          {game.homeTeamName}
                        </Text>
                        {game.isHome && <Text style={[styles.homeIndicator, { color: theme.tint }]}>(H)</Text>}
                      </View>
                      <Text style={[styles.gameScore, { color: theme.text }]}>
                        {game.homeScore !== null ? game.homeScore : '-'} - {game.awayScore !== null ? game.awayScore : '-'}
                      </Text>
                      <View style={[styles.gameTeam, { alignItems: 'flex-end' }]}>
                        <Text style={[
                          styles.gameTeamName,
                          { color: theme.text, fontWeight: !game.isHome ? '800' : '500' }
                        ]} numberOfLines={1}>
                          {game.awayTeamName}
                        </Text>
                        {!game.isHome && <Text style={[styles.homeIndicator, { color: theme.tint }]}>(A)</Text>}
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyTabText: {
    fontSize: 15,
    textAlign: 'center',
    padding: 24,
    fontStyle: 'italic',
  },
  teamSelectorContainer: {
    maxHeight: 48,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  teamSelectorContent: {
    gap: 8,
    alignItems: 'center',
  },
  teamSelectorChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  teamSelectorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  headerCard: {
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  statsGradient: {
    padding: 20,
  },
  seasonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  seasonInfo: {
    flex: 1,
  },
  seasonTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  recordText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.9,
  },
  streakBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  streakText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  quickStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickStat: {
    alignItems: 'center',
  },
  quickStatNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.8,
    textTransform: 'uppercase',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  recordGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  recordItem: {
    alignItems: 'center',
  },
  recordValue: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 4,
  },
  recordLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  percentageBar: {
    alignItems: 'center',
  },
  percentageTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  percentageFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 16,
    fontWeight: '700',
  },
  homeAwayGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  homeAwayItem: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  homeAwayLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  homeAwayRecord: {
    fontSize: 18,
    fontWeight: '800',
  },
  scoringStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  scoringStat: {
    flex: 1,
    alignItems: 'center',
  },
  scoringStatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  scoringStatLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  scoringStatValue: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  scoringStatAvg: {
    fontSize: 12,
    fontWeight: '500',
  },
  differentialCard: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  differentialLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  differentialValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  formContainer: {
    gap: 16,
  },
  formStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  formBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  formBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  formHistory: {
    flexDirection: 'row',
    gap: 4,
  },
  formResult: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formResultText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  playerCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playerRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: '800',
  },
  playerDetails: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  playerPosition: {
    fontSize: 12,
    fontWeight: '500',
  },
  playerMainStat: {
    alignItems: 'center',
  },
  playerPoints: {
    fontSize: 24,
    fontWeight: '800',
  },
  playerPointsLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  playerStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  playerStatItem: {
    alignItems: 'center',
  },
  playerStatValue: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  playerStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  comingSoon: {
    fontSize: 15,
    textAlign: 'center',
    padding: 24,
    fontStyle: 'italic',
  },
  // Game card styles
  gameCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  gameCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gameDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  gameResultBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameResultBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  gameTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  gameScoreLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gameTeam: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gameTeamName: {
    fontSize: 14,
    flexShrink: 1,
  },
  homeIndicator: {
    fontSize: 11,
    fontWeight: '600',
  },
  gameScore: {
    fontSize: 18,
    fontWeight: '800',
    marginHorizontal: 12,
  },
});

export default SeasonStatsScreen;
