import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Game as GameAPI, Team as TeamAPI } from '@/api/entities';

interface TeamMember {
  id: string;
  display_name: string;
  username: string;
  email?: string;
  avatar_url?: string;
  role: string;
  status: string;
  position?: string;
  jersey_number?: string;
}

interface Game {
  id: string;
  opponent: string;
  homeTeam?: string;
  awayTeam?: string;
  date: string;
  time: string;
  location: string;
  type: 'home' | 'away' | 'neutral';
  status: 'upcoming' | 'completed' | 'cancelled';
  score?: {
    team: number;
    opponent: number;
  };
}

interface Team {
  id: string;
  name: string;
  description?: string;
  sport?: string;
  season?: string;
  logo_url?: string;
  created_at: string;
  status: string;
}

export default function TeamViewerScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'members' | 'schedule'>('overview');
  const [error, setError] = useState<string | null>(null);

  const loadTeamData = useCallback(async (options?: { silent?: boolean }) => {
    if (!params.id) {
      setError('Team ID is required');
      setLoading(false);
      return;
    }

    if (!options?.silent) setLoading(true);
    setError(null);

    try {
      // Load team info, members, and games in parallel
      const [teamData, membersData, gamesData] = await Promise.all([
        TeamAPI.get(params.id),
        TeamAPI.members(params.id),
        GameAPI.list('-date') // Get all games, we'll filter for this team
      ]);

      setTeam(teamData);
      setMembers(Array.isArray(membersData) ? membersData : []);
      
      // Filter games for this team (simplified - in real app you'd have team-specific endpoint)
      const teamGames: Game[] = Array.isArray(gamesData) ? gamesData.map((game: any) => ({
        id: game.id,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        opponent: game.away_team || game.home_team || 'TBD',
        date: game.date ? new Date(game.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        time: game.date ? new Date(game.date).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }) : '7:00 PM',
        location: game.location || 'TBD',
        type: game.home_team ? 'home' : 'away',
        status: 'upcoming',
      })) : [];
      
      setGames(teamGames);
    } catch (error: any) {
      console.error('Failed to load team data:', error);
      setError(error?.message || 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadTeamData({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [loadTeamData]);

  const handleGamePress = (game: Game) => {
    router.push({
      pathname: '/game-detail',
      params: { id: game.id }
    });
  };

  const handleMemberPress = (member: TeamMember) => {
    router.push({
      pathname: '/user-profile',
      params: { id: member.id }
    });
  };

  const getUpcomingGames = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return games.filter(game => {
      const gameDate = new Date(game.date);
      return gameDate >= today && game.status === 'upcoming';
    }).slice(0, 3); // Show next 3 games
  };

  const getRecentGames = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return games.filter(game => {
      const gameDate = new Date(game.date);
      return gameDate < today || game.status === 'completed';
    }).slice(0, 3); // Show last 3 games
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'owner':
        return '#EF4444';
      case 'manager':
      case 'coach':
        return '#F59E0B';
      case 'assistant_coach':
        return '#10B981';
      case 'captain':
        return '#8B5CF6';
      default:
        return Colors[colorScheme].mutedText;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'owner':
        return 'crown';
      case 'manager':
      case 'coach':
        return 'person-circle';
      case 'assistant_coach':
        return 'person';
      case 'captain':
        return 'star';
      default:
        return 'people';
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: Colors[colorScheme].background }]}>
        <Stack.Screen options={{ title: 'Loading Team...' }} />
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        <Text style={[styles.loadingText, { color: Colors[colorScheme].mutedText }]}>
          Loading team details...
        </Text>
      </View>
    );
  }

  if (error || !team) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: Colors[colorScheme].background }]}>
        <Stack.Screen options={{ title: 'Team Not Found' }} />
        <Ionicons name="alert-circle-outline" size={64} color={Colors[colorScheme].mutedText} />
        <Text style={[styles.errorTitle, { color: Colors[colorScheme].text }]}>
          {error || 'Team not found'}
        </Text>
        <Text style={[styles.errorSubtitle, { color: Colors[colorScheme].mutedText }]}>
          This team may not exist or you don't have permission to view it.
        </Text>
        <Pressable 
          style={[styles.retryButton, { backgroundColor: Colors[colorScheme].tint }]}
          onPress={() => loadTeamData()}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen 
        options={{ 
          title: team.name,
          headerStyle: { backgroundColor: Colors[colorScheme].background },
          headerTintColor: Colors[colorScheme].text,
        }} 
      />

      {/* Team Header */}
      <View style={[styles.headerCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
        <LinearGradient
          colors={[Colors[colorScheme].tint, Colors[colorScheme].tint + '80']}
          style={styles.headerGradient}
        >
          <View style={styles.teamHeader}>
            <View style={styles.teamLogoContainer}>
              {team.logo_url ? (
                <Image 
                  source={{ uri: team.logo_url }} 
                  style={styles.teamLogo}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.teamLogoPlaceholder, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <Text style={styles.teamLogoText}>
                    {team.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.teamInfo}>
              <Text style={styles.teamName}>{team.name}</Text>
              {team.sport && (
                <Text style={styles.teamSport}>{team.sport}</Text>
              )}
              {team.season && (
                <Text style={styles.teamSeason}>{team.season}</Text>
              )}
            </View>
          </View>

          {team.description && (
            <Text style={styles.teamDescription}>{team.description}</Text>
          )}

          <View style={styles.teamStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{members.length}</Text>
              <Text style={styles.statLabel}>Members</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{getUpcomingGames().length}</Text>
              <Text style={styles.statLabel}>Upcoming</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{games.length}</Text>
              <Text style={styles.statLabel}>Total Games</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {(['overview', 'members', 'schedule'] as const).map((tab) => (
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
        {selectedTab === 'overview' && (
          <View style={styles.tabContent}>
            {/* Quick Stats */}
            <View style={[styles.sectionCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                Team Overview
              </Text>
              
              <View style={styles.overviewGrid}>
                <View style={[styles.overviewItem, { backgroundColor: Colors[colorScheme].background }]}>
                  <Ionicons name="people" size={24} color={Colors[colorScheme].tint} />
                  <Text style={[styles.overviewValue, { color: Colors[colorScheme].text }]}>
                    {members.length}
                  </Text>
                  <Text style={[styles.overviewLabel, { color: Colors[colorScheme].mutedText }]}>
                    Team Members
                  </Text>
                </View>
                
                <View style={[styles.overviewItem, { backgroundColor: Colors[colorScheme].background }]}>
                  <Ionicons name="calendar" size={24} color={Colors[colorScheme].tint} />
                  <Text style={[styles.overviewValue, { color: Colors[colorScheme].text }]}>
                    {getUpcomingGames().length}
                  </Text>
                  <Text style={[styles.overviewLabel, { color: Colors[colorScheme].mutedText }]}>
                    Upcoming Games
                  </Text>
                </View>
              </View>
            </View>

            {/* Upcoming Games Preview */}
            <View style={[styles.sectionCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                  Next Games
                </Text>
                <Pressable onPress={() => setSelectedTab('schedule')}>
                  <Text style={[styles.seeAllText, { color: Colors[colorScheme].tint }]}>
                    See All
                  </Text>
                </Pressable>
              </View>

              {getUpcomingGames().length === 0 ? (
                <Text style={[styles.emptyText, { color: Colors[colorScheme].mutedText }]}>
                  No upcoming games scheduled
                </Text>
              ) : (
                getUpcomingGames().map((game) => (
                  <Pressable 
                    key={game.id}
                    style={[styles.gamePreviewCard, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border }]}
                    onPress={() => handleGamePress(game)}
                  >
                    <View style={styles.gamePreviewInfo}>
                      <Text style={[styles.gameOpponent, { color: Colors[colorScheme].text }]}>
                        vs {game.opponent}
                      </Text>
                      <Text style={[styles.gameDate, { color: Colors[colorScheme].mutedText }]}>
                        {game.date} • {game.time}
                      </Text>
                      <Text style={[styles.gameLocation, { color: Colors[colorScheme].mutedText }]}>
                        {game.location}
                      </Text>
                    </View>
                    <View style={[
                      styles.gameTypeIndicator,
                      { backgroundColor: game.type === 'home' ? '#10B981' : '#F59E0B' }
                    ]}>
                      <Text style={styles.gameTypeText}>
                        {game.type.toUpperCase()}
                      </Text>
                    </View>
                  </Pressable>
                ))
              )}
            </View>

            {/* Team Members Preview */}
            <View style={[styles.sectionCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                  Team Members
                </Text>
                <Pressable onPress={() => setSelectedTab('members')}>
                  <Text style={[styles.seeAllText, { color: Colors[colorScheme].tint }]}>
                    See All
                  </Text>
                </Pressable>
              </View>

              {members.slice(0, 4).map((member) => (
                <Pressable 
                  key={member.id}
                  style={[styles.memberPreviewCard, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border }]}
                  onPress={() => handleMemberPress(member)}
                >
                  <View style={styles.memberPreviewInfo}>
                    {member.avatar_url ? (
                      <Image 
                        source={{ uri: member.avatar_url }} 
                        style={styles.memberAvatar}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.memberAvatarPlaceholder, { backgroundColor: Colors[colorScheme].border }]}>
                        <Text style={[styles.memberAvatarText, { color: Colors[colorScheme].text }]}>
                          {member.display_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    
                    <View style={styles.memberDetails}>
                      <Text style={[styles.memberName, { color: Colors[colorScheme].text }]}>
                        {member.display_name}
                      </Text>
                      <Text style={[styles.memberUsername, { color: Colors[colorScheme].mutedText }]}>
                        @{member.username}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.memberRoleContainer}>
                    <Ionicons 
                      name={getRoleIcon(member.role) as any} 
                      size={16} 
                      color={getRoleColor(member.role)} 
                    />
                    <Text style={[styles.memberRole, { color: getRoleColor(member.role) }]}>
                      {member.role}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {selectedTab === 'members' && (
          <View style={styles.tabContent}>
            <View style={[styles.sectionCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                All Members ({members.length})
              </Text>
              
              {members.map((member) => (
                <Pressable 
                  key={member.id}
                  style={[styles.fullMemberCard, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border }]}
                  onPress={() => handleMemberPress(member)}
                >
                  <View style={styles.fullMemberInfo}>
                    {member.avatar_url ? (
                      <Image 
                        source={{ uri: member.avatar_url }} 
                        style={styles.fullMemberAvatar}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.fullMemberAvatarPlaceholder, { backgroundColor: Colors[colorScheme].border }]}>
                        <Text style={[styles.fullMemberAvatarText, { color: Colors[colorScheme].text }]}>
                          {member.display_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    
                    <View style={styles.fullMemberDetails}>
                      <Text style={[styles.fullMemberName, { color: Colors[colorScheme].text }]}>
                        {member.display_name}
                      </Text>
                      <Text style={[styles.fullMemberUsername, { color: Colors[colorScheme].mutedText }]}>
                        @{member.username}
                      </Text>
                      {member.position && (
                        <Text style={[styles.memberPosition, { color: Colors[colorScheme].mutedText }]}>
                          Position: {member.position}
                        </Text>
                      )}
                      {member.jersey_number && (
                        <Text style={[styles.memberJersey, { color: Colors[colorScheme].mutedText }]}>
                          Jersey: #{member.jersey_number}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.fullMemberMeta}>
                    <View style={styles.memberRoleContainer}>
                      <Ionicons 
                        name={getRoleIcon(member.role) as any} 
                        size={16} 
                        color={getRoleColor(member.role)} 
                      />
                      <Text style={[styles.memberRole, { color: getRoleColor(member.role) }]}>
                        {member.role}
                      </Text>
                    </View>
                    
                    <View style={[
                      styles.memberStatus,
                      { backgroundColor: member.status === 'active' ? '#10B981' : '#6B7280' }
                    ]}>
                      <Text style={styles.memberStatusText}>
                        {member.status}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {selectedTab === 'schedule' && (
          <View style={styles.tabContent}>
            {/* Upcoming Games */}
            <View style={[styles.sectionCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                Upcoming Games ({getUpcomingGames().length})
              </Text>
              
              {getUpcomingGames().length === 0 ? (
                <Text style={[styles.emptyText, { color: Colors[colorScheme].mutedText }]}>
                  No upcoming games scheduled
                </Text>
              ) : (
                getUpcomingGames().map((game) => (
                  <Pressable 
                    key={game.id}
                    style={[styles.fullGameCard, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border }]}
                    onPress={() => handleGamePress(game)}
                  >
                    <View style={styles.gameCardHeader}>
                      <Text style={[styles.gameCardOpponent, { color: Colors[colorScheme].text }]}>
                        vs {game.opponent}
                      </Text>
                      <View style={[
                        styles.gameCardType,
                        { backgroundColor: game.type === 'home' ? '#10B981' : game.type === 'away' ? '#F59E0B' : '#6B7280' }
                      ]}>
                        <Text style={styles.gameCardTypeText}>
                          {game.type.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    
                    <Text style={[styles.gameCardDate, { color: Colors[colorScheme].mutedText }]}>
                      {new Date(game.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })} • {game.time}
                    </Text>
                    
                    <Text style={[styles.gameCardLocation, { color: Colors[colorScheme].mutedText }]}>
                      📍 {game.location}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>

            {/* Recent Games */}
            {getRecentGames().length > 0 && (
              <View style={[styles.sectionCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
                <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                  Recent Games
                </Text>
                
                {getRecentGames().map((game) => (
                  <Pressable 
                    key={game.id}
                    style={[styles.fullGameCard, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border }]}
                    onPress={() => handleGamePress(game)}
                  >
                    <View style={styles.gameCardHeader}>
                      <Text style={[styles.gameCardOpponent, { color: Colors[colorScheme].text }]}>
                        vs {game.opponent}
                      </Text>
                      {game.score && (
                        <View style={[
                          styles.gameScore,
                          { backgroundColor: game.score.team > game.score.opponent ? '#10B981' : '#EF4444' }
                        ]}>
                          <Text style={styles.gameScoreText}>
                            {game.score.team > game.score.opponent ? 'W' : 'L'} {game.score.team}-{game.score.opponent}
                          </Text>
                        </View>
                      )}
                    </View>
                    
                    <Text style={[styles.gameCardDate, { color: Colors[colorScheme].mutedText }]}>
                      {new Date(game.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </Text>
                    
                    <Text style={[styles.gameCardLocation, { color: Colors[colorScheme].mutedText }]}>
                      📍 {game.location}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerCard: {
    margin: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  headerGradient: {
    padding: 20,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  teamLogoContainer: {
    marginRight: 16,
  },
  teamLogo: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  teamLogoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamLogoText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  teamSport: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.9,
    marginBottom: 2,
  },
  teamSeason: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    opacity: 0.8,
  },
  teamDescription: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    lineHeight: 20,
    marginBottom: 16,
  },
  teamStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    padding: 24,
    fontStyle: 'italic',
  },
  overviewGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  overviewItem: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    gap: 8,
  },
  overviewValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  overviewLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  gamePreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  gamePreviewInfo: {
    flex: 1,
  },
  gameOpponent: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  gameDate: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  gameLocation: {
    fontSize: 12,
    fontWeight: '500',
  },
  gameTypeIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  gameTypeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  memberPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  memberPreviewInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  memberAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  memberUsername: {
    fontSize: 14,
    fontWeight: '500',
  },
  memberRoleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberRole: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  fullMemberCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  fullMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  fullMemberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
  },
  fullMemberAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  fullMemberAvatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  fullMemberDetails: {
    flex: 1,
  },
  fullMemberName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  fullMemberUsername: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  memberPosition: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  memberJersey: {
    fontSize: 12,
    fontWeight: '500',
  },
  fullMemberMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  memberStatusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  fullGameCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  gameCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gameCardOpponent: {
    fontSize: 18,
    fontWeight: '700',
  },
  gameCardType: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  gameCardTypeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  gameScore: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  gameScoreText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  gameCardDate: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  gameCardLocation: {
    fontSize: 12,
    fontWeight: '500',
  },
});