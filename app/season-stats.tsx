import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  points: number;
  avgPoints: number;
  rebounds?: number;
  assists?: number;
  goals?: number;
  saves?: number;
  // Sport-specific stats can be added
}

export default function SeasonStatsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'team' | 'players' | 'games'>('team');

  // Mock team stats - replace with real API data
  const teamStats: TeamStats = {
    gamesPlayed: 12,
    wins: 8,
    losses: 3,
    ties: 1,
    winPercentage: 0.708,
    pointsFor: 245,
    pointsAgainst: 189,
    pointDifferential: 56,
    avgPointsFor: 20.4,
    avgPointsAgainst: 15.8,
    homeRecord: '5-1-0',
    awayRecord: '3-2-1',
    streak: 'W2',
    lastFiveGames: 'W-W-L-W-W',
  };

  // Mock player stats - replace with real API data
  const playerStats: PlayerStat[] = [
    {
      id: '1',
      name: 'John Smith',
      position: 'Forward',
      gamesPlayed: 12,
      points: 84,
      avgPoints: 7.0,
      goals: 12,
      assists: 8,
    },
    {
      id: '2',
      name: 'Mike Johnson',
      position: 'Midfielder',
      gamesPlayed: 11,
      points: 72,
      avgPoints: 6.5,
      goals: 8,
      assists: 12,
    },
    {
      id: '3',
      name: 'David Wilson',
      position: 'Defender',
      gamesPlayed: 12,
      points: 45,
      avgPoints: 3.8,
      goals: 3,
      assists: 6,
    },
    {
      id: '4',
      name: 'Chris Brown',
      position: 'Goalkeeper',
      gamesPlayed: 10,
      points: 20,
      avgPoints: 2.0,
      saves: 45,
      goals: 0,
    },
  ].sort((a, b) => b.points - a.points);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Load real stats data here
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    } finally {
      setRefreshing(false);
    }
  }, []);

  const getStreakColor = (streak: string) => {
    if (streak.startsWith('W')) return '#10B981';
    if (streak.startsWith('L')) return '#EF4444';
    return '#6B7280';
  };

  const formatRecord = (wins: number, losses: number, ties: number) => {
    return `${wins}-${losses}${ties > 0 ? `-${ties}` : ''}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen 
        options={{ 
          title: 'Season Statistics',
          headerStyle: { backgroundColor: Colors[colorScheme].background },
          headerTintColor: Colors[colorScheme].text,
        }} 
      />

      {/* Header Stats Overview */}
      <View style={[styles.headerCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
        <LinearGradient
          colors={[Colors[colorScheme].tint, Colors[colorScheme].tint + '80']}
          style={styles.statsGradient}
        >
          <View style={styles.seasonHeader}>
            <View style={styles.seasonInfo}>
              <Text style={styles.seasonTitle}>2024-25 Season Stats</Text>
              <Text style={styles.recordText}>
                {formatRecord(teamStats.wins, teamStats.losses, teamStats.ties)} • {(teamStats.winPercentage * 100).toFixed(1)}% Win Rate
              </Text>
            </View>
            <View style={[styles.streakBadge, { backgroundColor: getStreakColor(teamStats.streak) }]}>
              <Text style={styles.streakText}>{teamStats.streak}</Text>
            </View>
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
              <Text style={styles.quickStatNumber}>+{teamStats.pointDifferential}</Text>
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
      <View style={styles.tabContainer}>
        {(['team', 'players', 'games'] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[
              styles.tab,
              { backgroundColor: selectedTab === tab ? Colors[colorScheme].tint : 'transparent' }
            ]}
            onPress={() => setSelectedTab(tab)}
          >
            <Text style={[
              styles.tabText,
              { color: selectedTab === tab ? '#fff' : Colors[colorScheme].text }
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
            colors={[Colors[colorScheme].tint]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {selectedTab === 'team' && (
          <View style={styles.tabContent}>
            {/* Overall Record */}
            <View style={[styles.sectionCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                Overall Record
              </Text>
              
              <View style={styles.recordGrid}>
                <View style={styles.recordItem}>
                  <Text style={[styles.recordValue, { color: '#10B981' }]}>{teamStats.wins}</Text>
                  <Text style={[styles.recordLabel, { color: Colors[colorScheme].text }]}>Wins</Text>
                </View>
                <View style={styles.recordItem}>
                  <Text style={[styles.recordValue, { color: '#EF4444' }]}>{teamStats.losses}</Text>
                  <Text style={[styles.recordLabel, { color: Colors[colorScheme].text }]}>Losses</Text>
                </View>
                <View style={styles.recordItem}>
                  <Text style={[styles.recordValue, { color: '#6B7280' }]}>{teamStats.ties}</Text>
                  <Text style={[styles.recordLabel, { color: Colors[colorScheme].text }]}>Ties</Text>
                </View>
                <View style={styles.recordItem}>
                  <Text style={[styles.recordValue, { color: Colors[colorScheme].text }]}>{teamStats.gamesPlayed}</Text>
                  <Text style={[styles.recordLabel, { color: Colors[colorScheme].text }]}>Played</Text>
                </View>
              </View>

              <View style={styles.percentageBar}>
                <View style={styles.percentageTrack}>
                  <View 
                    style={[
                      styles.percentageFill, 
                      { 
                        width: `${teamStats.winPercentage * 100}%`,
                        backgroundColor: Colors[colorScheme].tint 
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.percentageText, { color: Colors[colorScheme].text }]}>
                  {(teamStats.winPercentage * 100).toFixed(1)}% Win Rate
                </Text>
              </View>
            </View>

            {/* Home vs Away */}
            <View style={[styles.sectionCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                Home vs Away Performance
              </Text>
              
              <View style={styles.homeAwayGrid}>
                <View style={[styles.homeAwayItem, { backgroundColor: Colors[colorScheme].background }]}>
                  <Ionicons name="home" size={20} color={Colors[colorScheme].tint} />
                  <Text style={[styles.homeAwayLabel, { color: Colors[colorScheme].text }]}>Home</Text>
                  <Text style={[styles.homeAwayRecord, { color: Colors[colorScheme].text }]}>
                    {teamStats.homeRecord}
                  </Text>
                </View>
                
                <View style={[styles.homeAwayItem, { backgroundColor: Colors[colorScheme].background }]}>
                  <Ionicons name="airplane" size={20} color={Colors[colorScheme].tint} />
                  <Text style={[styles.homeAwayLabel, { color: Colors[colorScheme].text }]}>Away</Text>
                  <Text style={[styles.homeAwayRecord, { color: Colors[colorScheme].text }]}>
                    {teamStats.awayRecord}
                  </Text>
                </View>
              </View>
            </View>

            {/* Scoring Stats */}
            <View style={[styles.sectionCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                Scoring Statistics
              </Text>
              
              <View style={styles.scoringStats}>
                <View style={styles.scoringStat}>
                  <View style={styles.scoringStatHeader}>
                    <Ionicons name="trending-up" size={16} color="#10B981" />
                    <Text style={[styles.scoringStatLabel, { color: Colors[colorScheme].text }]}>
                      Points For
                    </Text>
                  </View>
                  <Text style={[styles.scoringStatValue, { color: Colors[colorScheme].text }]}>
                    {teamStats.pointsFor}
                  </Text>
                  <Text style={[styles.scoringStatAvg, { color: Colors[colorScheme].mutedText }]}>
                    {teamStats.avgPointsFor.toFixed(1)} per game
                  </Text>
                </View>

                <View style={styles.scoringStat}>
                  <View style={styles.scoringStatHeader}>
                    <Ionicons name="trending-down" size={16} color="#EF4444" />
                    <Text style={[styles.scoringStatLabel, { color: Colors[colorScheme].text }]}>
                      Points Against
                    </Text>
                  </View>
                  <Text style={[styles.scoringStatValue, { color: Colors[colorScheme].text }]}>
                    {teamStats.pointsAgainst}
                  </Text>
                  <Text style={[styles.scoringStatAvg, { color: Colors[colorScheme].mutedText }]}>
                    {teamStats.avgPointsAgainst.toFixed(1)} per game
                  </Text>
                </View>
              </View>

              <View style={[styles.differentialCard, { backgroundColor: Colors[colorScheme].background }]}>
                <Text style={[styles.differentialLabel, { color: Colors[colorScheme].text }]}>
                  Point Differential
                </Text>
                <Text style={[
                  styles.differentialValue, 
                  { color: teamStats.pointDifferential > 0 ? '#10B981' : '#EF4444' }
                ]}>
                  {teamStats.pointDifferential > 0 ? '+' : ''}{teamStats.pointDifferential}
                </Text>
              </View>
            </View>

            {/* Recent Form */}
            <View style={[styles.sectionCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                Recent Form
              </Text>
              
              <View style={styles.formContainer}>
                <View style={styles.formStat}>
                  <Text style={[styles.formLabel, { color: Colors[colorScheme].text }]}>
                    Current Streak
                  </Text>
                  <View style={[styles.formBadge, { backgroundColor: getStreakColor(teamStats.streak) }]}>
                    <Text style={styles.formBadgeText}>{teamStats.streak}</Text>
                  </View>
                </View>

                <View style={styles.formStat}>
                  <Text style={[styles.formLabel, { color: Colors[colorScheme].text }]}>
                    Last 5 Games
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
              </View>
            </View>
          </View>
        )}

        {selectedTab === 'players' && (
          <View style={styles.tabContent}>
            <View style={[styles.sectionCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                Player Statistics
              </Text>
              
              {playerStats.map((player, index) => (
                <View key={player.id} style={[styles.playerCard, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border }]}>
                  <View style={styles.playerHeader}>
                    <View style={styles.playerInfo}>
                      <View style={styles.playerRank}>
                        <Text style={[styles.rankNumber, { color: Colors[colorScheme].mutedText }]}>
                          {index + 1}
                        </Text>
                      </View>
                      <View style={styles.playerDetails}>
                        <Text style={[styles.playerName, { color: Colors[colorScheme].text }]}>
                          {player.name}
                        </Text>
                        <Text style={[styles.playerPosition, { color: Colors[colorScheme].mutedText }]}>
                          {player.position}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.playerMainStat}>
                      <Text style={[styles.playerPoints, { color: Colors[colorScheme].text }]}>
                        {player.points}
                      </Text>
                      <Text style={[styles.playerPointsLabel, { color: Colors[colorScheme].mutedText }]}>
                        pts
                      </Text>
                    </View>
                  </View>

                  <View style={styles.playerStats}>
                    <View style={styles.playerStatItem}>
                      <Text style={[styles.playerStatValue, { color: Colors[colorScheme].text }]}>
                        {player.gamesPlayed}
                      </Text>
                      <Text style={[styles.playerStatLabel, { color: Colors[colorScheme].mutedText }]}>
                        GP
                      </Text>
                    </View>
                    <View style={styles.playerStatItem}>
                      <Text style={[styles.playerStatValue, { color: Colors[colorScheme].text }]}>
                        {player.avgPoints.toFixed(1)}
                      </Text>
                      <Text style={[styles.playerStatLabel, { color: Colors[colorScheme].mutedText }]}>
                        AVG
                      </Text>
                    </View>
                    {player.goals !== undefined && (
                      <View style={styles.playerStatItem}>
                        <Text style={[styles.playerStatValue, { color: Colors[colorScheme].text }]}>
                          {player.goals}
                        </Text>
                        <Text style={[styles.playerStatLabel, { color: Colors[colorScheme].mutedText }]}>
                          {player.position === 'Goalkeeper' ? 'SV' : 'GOALS'}
                        </Text>
                      </View>
                    )}
                    {player.assists !== undefined && (
                      <View style={styles.playerStatItem}>
                        <Text style={[styles.playerStatValue, { color: Colors[colorScheme].text }]}>
                          {player.assists}
                        </Text>
                        <Text style={[styles.playerStatLabel, { color: Colors[colorScheme].mutedText }]}>
                          AST
                        </Text>
                      </View>
                    )}
                    {player.saves !== undefined && (
                      <View style={styles.playerStatItem}>
                        <Text style={[styles.playerStatValue, { color: Colors[colorScheme].text }]}>
                          {player.saves}
                        </Text>
                        <Text style={[styles.playerStatLabel, { color: Colors[colorScheme].mutedText }]}>
                          SAVES
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {selectedTab === 'games' && (
          <View style={styles.tabContent}>
            <View style={[styles.sectionCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                Game Statistics
              </Text>
              
              <Text style={[styles.comingSoon, { color: Colors[colorScheme].mutedText }]}>
                Detailed game statistics and analytics coming soon. This will include game-by-game breakdowns, performance trends, and opponent analysis.
              </Text>
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
    backgroundColor: '#F8FAFC' 
  },
  headerCard: {
    margin: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
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
    backgroundColor: '#E5E7EB',
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
    borderWidth: StyleSheet.hairlineWidth,
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
    backgroundColor: '#E5E7EB',
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
    borderWidth: StyleSheet.hairlineWidth,
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
    backgroundColor: '#F3F4F6',
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
});