import { Game, Post, Team } from '@/api/entities';
import PostCard from '@/components/PostCard';
import { GameCard } from '@/components/ui/GameCard';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type LeagueTeam = {
  id: string;
  name: string;
  sport?: string;
  season?: string;
  logo_url?: string;
  description?: string;
  organization_id?: string;
  _count?: {
    members?: number;
    games?: number;
  };
};

type TeamMember = {
  id: string;
  user_id?: string;
  team_id?: string;
  role?: string;
  jersey_number?: string | number;
  position?: string;
  user?: {
    id: string;
    display_name?: string;
    full_name?: string;
    avatar_url?: string;
  };
};

type LeagueData = {
  id: string;
  name: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  cover_url?: string;
  contact_info?: string;
};

export default function LeagueScreen() {
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [league, setLeague] = useState<LeagueData | null>(null);
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'feed' | 'schedule' | 'roster'>('roster');
  const [isFollowing, setIsFollowing] = useState(false);

  const loadLeague = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // In real implementation, you'd fetch league/organization data
      // For now, using URL params to set league info
      const leagueId = params.id || 'default';
      const leagueName = params.name || 'Athletic Organization';
      
      setLeague({
        id: leagueId,
        name: leagueName,
        display_name: leagueName,
        bio: 'Home of champions',
      });

      // Fetch all teams for this organization/league
      const teamsData = await Team.list();
      const teamsList = Array.isArray(teamsData) ? teamsData : [];
      
      // Filter teams by matching the league/org name in the team name
      // For example: "SHS Men's Soccer" matches league "SHS"
      const filteredTeams = teamsList.filter((t: any) => {
        // First try organization_id if available
        if (params.id && t.organization_id === params.id) {
          return true;
        }
        // Otherwise match by name prefix (e.g., "SHS" in "SHS Men's Soccer")
        if (leagueName && t.name) {
          const teamNameParts = String(t.name).split(/\s+/);
          const firstPart = teamNameParts[0] || '';
          return firstPart.toLowerCase() === leagueName.toLowerCase() ||
                 String(t.name).toLowerCase().includes(leagueName.toLowerCase());
        }
        return false;
      });
      
      setTeams(filteredTeams);
      console.log(`Filtered ${filteredTeams.length} teams for league: ${leagueName}`, filteredTeams.map((t: any) => t.name));

      // Fetch all games from all teams in this league
      let leagueGames: any[] = [];
      try {
        const allGames = await Game.list('-date');
        const teamNames = filteredTeams.map(t => t.name);
        
        // Filter games where either home or away team matches one of the league's team names
        leagueGames = Array.isArray(allGames) 
          ? allGames.filter((g: any) => {
              const homeTeam = g.home_team || g.homeTeam || '';
              const awayTeam = g.away_team || g.awayTeam || '';
              return teamNames.some(teamName => 
                homeTeam.toLowerCase().includes(teamName.toLowerCase()) ||
                awayTeam.toLowerCase().includes(teamName.toLowerCase())
              );
            })
          : [];
        
        setGames(leagueGames);
        console.log(`Found ${leagueGames.length} games for league teams`);
      } catch (err) {
        console.error('Failed to load games:', err);
        setGames([]);
      }

      // Fetch all posts related to this league's games and teams
      try {
        const allPosts: any[] = [];
        const gameIds = leagueGames.map(g => g.id);
        const teamNames = filteredTeams.map(t => t.name.toLowerCase());
        
        // Fetch posts for each game in this league
        for (const gameId of gameIds) {
          try {
            const gamePosts = await Post.filter({ game_id: gameId }, '-created_date', 50);
            if (Array.isArray(gamePosts)) {
              allPosts.push(...gamePosts);
            }
          } catch (err) {
            console.error(`Failed to load posts for game ${gameId}:`, err);
          }
        }
        
        // Also get recent posts and filter by team mentions as fallback
        try {
          const recentPosts = await Post.list('-created_date', 100);
          if (Array.isArray(recentPosts)) {
            recentPosts.forEach((p: any) => {
              // Only add if not already in our list and mentions a team
              const alreadyAdded = allPosts.some(existing => existing.id === p.id);
              if (!alreadyAdded) {
                const content = (p.content || p.caption || '').toLowerCase();
                if (teamNames.some(teamName => content.includes(teamName))) {
                  allPosts.push(p);
                }
              }
            });
          }
        } catch (err) {
          console.error('Failed to load recent posts:', err);
        }
        
        // Remove duplicates and sort by date
        const uniquePosts = Array.from(
          new Map(allPosts.map(p => [p.id, p])).values()
        ).sort((a, b) => {
          const dateA = new Date(a.created_at || a.created_date || 0).getTime();
          const dateB = new Date(b.created_at || b.created_date || 0).getTime();
          return dateB - dateA; // Most recent first
        });
        
        setPosts(uniquePosts);
        console.log(`Found ${uniquePosts.length} posts for league (${gameIds.length} games)`);
      } catch (err) {
        console.error('Failed to load posts:', err);
        setPosts([]);
      }

      // Fetch all members from all teams in this league
      try {
        const allMembers: TeamMember[] = [];
        
        // Only fetch members if we have filtered teams for this league
        if (filteredTeams.length > 0) {
          for (const team of filteredTeams) {
            const teamMembers = await Team.members(team.id).catch(() => []);
            if (Array.isArray(teamMembers)) {
              allMembers.push(...teamMembers.map((m: any) => ({
                ...m,
                team_id: team.id,
                team_name: team.name,
              })));
            }
          }
        }
        
        setMembers(allMembers);
      } catch (err) {
        console.error('Failed to load members:', err);
        setMembers([]);
      }
    } catch (err: any) {
      console.error('Failed to load league:', err);
      setError(err?.message || 'Failed to load league data');
    } finally {
      setLoading(false);
    }
  }, [params.id, params.name]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLeague();
    setRefreshing(false);
  }, [loadLeague]);

  useEffect(() => {
    loadLeague();
  }, [loadLeague]);

  const handleTeamPress = (teamId: string) => {
    router.push(`/my-team?id=${teamId}` as any);
  };

  const handleFollowPress = () => {
    setIsFollowing(!isFollowing);
    Alert.alert(
      isFollowing ? 'Unfollowed' : 'Following!', 
      `You ${isFollowing ? 'unfollowed' : 'are now following'} ${league?.display_name || 'this league'}`
    );
  };

  const renderTeamCard = ({ item }: { item: LeagueTeam }) => (
    <Pressable
      style={[styles.teamCard, { 
        backgroundColor: theme.card,
        borderColor: theme.border,
      }]}
      onPress={() => handleTeamPress(item.id)}
    >
      <View style={styles.teamCardContent}>
        {item.logo_url ? (
          <Image source={{ uri: item.logo_url }} style={styles.teamLogo} contentFit="cover" />
        ) : (
          <View style={[styles.teamLogoPlaceholder, { backgroundColor: theme.surface }]}>
            <Ionicons name="people" size={24} color={theme.mutedText} />
          </View>
        )}
        <View style={styles.teamInfo}>
          <Text style={[styles.teamName, { color: theme.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          {item.sport && (
            <Text style={[styles.teamMeta, { color: theme.mutedText }]} numberOfLines={1}>
              {item.sport}{item.season ? ` • ${item.season}` : ''}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.mutedText} />
      </View>
    </Pressable>
  );

  const renderMemberCard = ({ item }: { item: TeamMember & { team_name?: string } }) => {
    const displayName = item.user?.display_name || item.user?.full_name || 'Player';
    const teamName = (item as any).team_name || 'Team';
    const position = item.position || item.role || '';
    const jersey = item.jersey_number ? `#${item.jersey_number}` : '';
    
    return (
      <View
        style={[styles.memberCard, { 
          backgroundColor: theme.card,
          borderColor: theme.border,
        }]}
      >
        <View style={styles.memberCardContent}>
          {item.user?.avatar_url ? (
            <Image source={{ uri: item.user.avatar_url }} style={styles.memberAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.memberAvatarPlaceholder, { backgroundColor: theme.surface }]}>
              <Ionicons name="person" size={20} color={theme.mutedText} />
            </View>
          )}
          <View style={styles.memberInfo}>
            <View style={styles.memberNameRow}>
              <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>
                {displayName}
              </Text>
              {jersey ? (
                <Text style={[styles.memberJersey, { color: theme.tint }]}>{jersey}</Text>
              ) : null}
            </View>
            <Text style={[styles.memberTeam, { color: theme.mutedText }]} numberOfLines={1}>
              {teamName}{position ? ` • ${position}` : ''}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'feed':
        if (posts.length === 0) {
          return (
            <View style={styles.emptyState}>
              <Ionicons name="newspaper-outline" size={48} color={theme.mutedText} />
              <Text style={[styles.emptyStateText, { color: theme.mutedText }]}>
                No posts yet
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: theme.mutedText }]}>
                Posts from league games and team mentions will appear here
              </Text>
            </View>
          );
        }
        return (
          <View style={styles.postsList}>
            {posts.map((post, index) => (
              <PostCard
                key={`${post.id}-${index}`}
                post={post}
                onPress={() => router.push(`/post-detail?id=${post.id}` as any)}
              />
            ))}
          </View>
        );
      
      case 'schedule':
        if (games.length === 0) {
          return (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={theme.mutedText} />
              <Text style={[styles.emptyStateText, { color: theme.mutedText }]}>
                No scheduled games
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: theme.mutedText }]}>
                Upcoming games from all teams will appear here
              </Text>
            </View>
          );
        }
        return (
          <View style={styles.gamesList}>
            {games.map((game, index) => (
              <GameCard
                key={`${game.id}-${index}`}
                game={game}
                onPress={(g) => router.push(`/game-detail?id=${g.id}` as any)}
              />
            ))}
          </View>
        );
      
      case 'roster':
        if (members.length === 0) {
          return (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={theme.mutedText} />
              <Text style={[styles.emptyStateText, { color: theme.mutedText }]}>
                No roster members found
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: theme.mutedText }]}>
                Players from all teams will appear here
              </Text>
            </View>
          );
        }
        return (
          <View style={styles.membersList}>
            {members.map((member, index) => (
              <View key={`${member.id}-${index}`}>
                {renderMemberCard({ item: member as any })}
              </View>
            ))}
          </View>
        );
      
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <Stack.Screen options={{ title: 'League', headerShown: true }} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <Stack.Screen options={{ title: 'League', headerShown: true }} />
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: theme.mutedText }]}>{error}</Text>
          <Pressable onPress={loadLeague} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen options={{ title: league?.display_name || 'Team', headerShown: false }} />
      
      {/* Custom Header */}
      <View style={[styles.header, { 
        backgroundColor: theme.card,
        borderBottomColor: theme.border,
        paddingTop: insets.top,
      }]}>
        <Pressable 
          onPress={() => router.back()} 
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {league?.display_name || league?.name || 'Team'}
        </Text>
        <View style={styles.headerRight} />
      </View>
      
      {/* Cover Photo */}
      <LinearGradient
        colors={colorScheme === 'dark' ? ['#1e293b', '#334155'] : ['#e2e8f0', '#cbd5e1']}
        style={styles.coverContainer}
      >
        {league?.cover_url ? (
          <Image source={{ uri: league.cover_url }} style={styles.coverImage} contentFit="cover" />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.coverPlaceholderText}>{league?.display_name || 'League'}</Text>
          </View>
        )}
      </LinearGradient>

      {/* Profile Section */}
      <View style={styles.profileSection}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {league?.avatar_url ? (
            <Image source={{ uri: league.avatar_url }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.surface }]}>
              <Text style={[styles.avatarPlaceholderText, { color: theme.text }]}>
                {league?.display_name?.charAt(0).toUpperCase() || 'L'}
              </Text>
            </View>
          )}
        </View>

        {/* League Info */}
        <View style={styles.infoSection}>
          <Text style={[styles.leagueName, { color: theme.text }]}>
            {league?.display_name || league?.name || 'League Name'}
          </Text>
          <Text style={[styles.leagueHandle, { color: theme.mutedText }]}>
            @{(league?.name || 'league').toLowerCase().replace(/\s+/g, '')}
          </Text>
          {league?.bio && (
            <Text style={[styles.leagueBio, { color: theme.text }]}>
              {league.bio}
            </Text>
          )}
        </View>

        {/* Contact Info Card */}
        <View style={[styles.contactCard, { 
          backgroundColor: theme.card,
          borderColor: theme.border,
        }]}>
          <View style={styles.contactRow}>
            <Ionicons name="person-outline" size={16} color={theme.mutedText} />
            <Text style={[styles.contactLabel, { color: theme.mutedText }]}>
              Contact: {league?.contact_info || 'Not set'}
            </Text>
          </View>
        </View>

        {/* Follow Button */}
        <Pressable
          style={[styles.followButton, { backgroundColor: isFollowing ? theme.border : theme.tint }]}
          onPress={handleFollowPress}
        >
          {isFollowing ? (
            <>
              <Ionicons name="checkmark" size={20} color={theme.text} />
              <Text style={[styles.followButtonText, { color: theme.text }]}>Following</Text>
            </>
          ) : (
            <>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.followButtonText}>Follow</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: theme.border }]}>
        <Pressable 
          style={[styles.tabButton, activeTab === 'feed' && styles.tabButtonActive]}
          onPress={() => setActiveTab('feed')}
        >
          <Text style={[styles.tabText, { color: theme.mutedText }, activeTab === 'feed' && styles.tabTextActive, activeTab === 'feed' && { color: theme.text }]}>
            Feed
          </Text>
        </Pressable>
        <Pressable 
          style={[styles.tabButton, activeTab === 'schedule' && styles.tabButtonActive]}
          onPress={() => setActiveTab('schedule')}
        >
          <Text style={[styles.tabText, { color: theme.mutedText }, activeTab === 'schedule' && styles.tabTextActive, activeTab === 'schedule' && { color: theme.text }]}>
            Schedule
          </Text>
        </Pressable>
        <Pressable 
          style={[styles.tabButton, activeTab === 'roster' && styles.tabButtonActive]}
          onPress={() => setActiveTab('roster')}
        >
          <Text style={[styles.tabText, { color: theme.mutedText }, activeTab === 'roster' && styles.tabTextActive, activeTab === 'roster' && { color: theme.text }]}>
            Roster
          </Text>
        </Pressable>
      </View>

      {/* Tab Content - Scrollable */}
      <ScrollView
        contentContainerStyle={styles.tabContentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.tint}
          />
        }
      >
        {renderTabContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  coverContainer: {
    height: 120,
    width: '100%',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPlaceholderText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    opacity: 0.5,
  },
  profileSection: {
    paddingHorizontal: 16,
    marginTop: -30,
  },
  avatarContainer: {
    marginBottom: 8,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 24,
    fontWeight: '700',
  },
  infoSection: {
    marginBottom: 12,
  },
  leagueName: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  leagueHandle: {
    fontSize: 13,
    marginBottom: 6,
  },
  leagueBio: {
    fontSize: 13,
    lineHeight: 18,
  },
  contactCard: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactLabel: {
    fontSize: 14,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    gap: 6,
    marginBottom: 12,
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '400',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  teamsSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  teamsList: {
    gap: 12,
  },
  teamCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  teamCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  teamLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  teamLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  teamMeta: {
    fontSize: 13,
  },
  membersList: {
    gap: 8,
  },
  postsList: {
    gap: 16,
  },
  gamesList: {
    gap: 12,
  },
  memberCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  memberCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
  },
  memberJersey: {
    fontSize: 13,
    fontWeight: '700',
  },
  memberTeam: {
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  headerRight: {
    width: 40,
  },
  tabContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
});
