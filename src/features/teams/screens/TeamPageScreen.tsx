import { Game, Post, Team } from '@/api/entities';
import PostCard from '@/components/PostCard';
import { EmptyState } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
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

export default function TeamPageScreen() {
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [team, setTeam] = useState<LeagueTeam | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'feed' | 'schedule' | 'roster'>('feed');
  const [isFollowing, setIsFollowing] = useState(false);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const teamId = params.id;
      const teamName = params.name;
      
      if (!teamId && !teamName) {
        throw new Error('No team ID or name provided');
      }

      let teamData: LeagueTeam | null = null;

      // Try to fetch from Team API
      try {
        const allTeams = await Team.list();
        const teamsList = Array.isArray(allTeams) ? allTeams : [];
        
        // Try to find by ID first
        if (teamId) {
          teamData = teamsList.find((t: any) => t.id === teamId) || null;
        }
        
        // If not found by ID, try by name
        if (!teamData && teamName) {
          teamData = teamsList.find((t: any) => 
            t.name?.toLowerCase() === teamName.toLowerCase()
          ) || null;
        }
      } catch (apiErr) {
        console.error('Failed to fetch teams from API:', apiErr);
        // Continue without team data from API
      }

      // If we couldn't find a team in the API, create a minimal team object from the name/id
      if (!teamData && teamName) {
        teamData = {
          id: teamId || `temp-${teamName}`,
          name: teamName,
          logo_url: undefined,
        };
      }

      if (!teamData) {
        throw new Error(`Could not load team (ID: ${teamId}, Name: ${teamName})`);
      }

      setTeam(teamData);

      // Fetch games, posts, and members for THIS SPECIFIC TEAM only
      const [gamesResult, postsResult, membersResult] = await Promise.all([
        // Load games where this team plays
        Game.list('-date')
          .then(allGames => {
            const teamNameLower = (teamData!.name || '').toLowerCase();
            return Array.isArray(allGames) 
              ? allGames.filter((g: any) => {
                  const homeTeam = (g.home_team || g.homeTeam || '').toLowerCase();
                  const awayTeam = (g.away_team || g.awayTeam || '').toLowerCase();
                  return homeTeam.includes(teamNameLower) || awayTeam.includes(teamNameLower);
                })
                // Sort with today/most recent in middle: past games go up, future games go down
                .sort((a, b) => {
                  const dateA = new Date(a.date || a.created_at || 0).getTime();
                  const dateB = new Date(b.date || b.created_at || 0).getTime();
                  return dateA - dateB; // Oldest first (for middle positioning)
                })
              : [];
          })
          .catch(err => {
            console.error('Failed to load games:', err);
            return [];
          }),
        
        // Load posts from games this team plays in
        (async () => {
          try {
            const allPosts: any[] = [];
            const teamNameLower = (teamData!.name || '').toLowerCase();
            
            const gameIds = await Game.list('-date')
              .then(allGames => {
                const filtered = Array.isArray(allGames) 
                  ? allGames.filter((g: any) => {
                      const homeTeam = (g.home_team || g.homeTeam || '').toLowerCase();
                      const awayTeam = (g.away_team || g.awayTeam || '').toLowerCase();
                      return homeTeam.includes(teamNameLower) || awayTeam.includes(teamNameLower);
                    })
                  : [];
                return filtered.map(g => g.id);
              })
              .catch(() => []);

            // Batch fetch posts for games
            if (gameIds.length > 0) {
              const postPromises = gameIds.slice(0, 20).map(gameId =>
                Post.filter({ game_id: gameId }, '-created_date', 20).catch(() => [])
              );
              const postBatches = await Promise.all(postPromises);
              postBatches.forEach(batch => {
                if (Array.isArray(batch)) {
                  allPosts.push(...batch);
                }
              });
            }

            // Filter by team hashtags and deduplicate
            const teamHashtag = `#${(teamData!.name || '').toLowerCase().replace(/\s+/g, '')}`;
            const uniquePosts = Array.from(
              new Map(allPosts.map(p => [p.id, p])).values()
            ).filter(p => {
              const content = (p.caption || p.description || '').toLowerCase();
              const tags = (p.tags || []);
              return content.includes(teamHashtag) || 
                     tags.some((t: string) => t.toLowerCase().includes(teamData!.name!.toLowerCase())) ||
                     p.game_id; // Include posts from team games
            })
            .sort((a, b) => {
              const dateA = new Date(a.created_at || a.created_date || 0).getTime();
              const dateB = new Date(b.created_at || b.created_date || 0).getTime();
              return dateB - dateA;
            });
            return uniquePosts;
          } catch (err) {
            console.error('Failed to load posts:', err);
            return [];
          }
        })(),
        
        // Load members - ONLY THIS TEAM'S MEMBERS
        (async () => {
          try {
            if (!teamData?.id) return [];
            
            const teamMembers = await Team.members(teamData.id);
            const memberList = Array.isArray(teamMembers) ? teamMembers : [];
            
            // Filter to only members of THIS team (not all teams)
            return memberList
              .filter((m: any) => m.team_id === teamData!.id)
              .sort((a: any, b: any) => {
                // Sort by jersey number, then by name
                const aJersey = parseInt(String(a.jersey_number || 999), 10);
                const bJersey = parseInt(String(b.jersey_number || 999), 10);
                if (aJersey !== bJersey) return aJersey - bJersey;
                const aName = a.user?.display_name || '';
                const bName = b.user?.display_name || '';
                return aName.localeCompare(bName);
              });
          } catch (err) {
            console.error('Failed to load members:', err);
            return [];
          }
        })(),
      ]);

      // Use real data only
      setGames(gamesResult);
      setPosts(postsResult);
      setMembers(membersResult);
    } catch (err: any) {
      console.error('Failed to load team:', err);
      setError(err?.message || 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  }, [params.id, params.name]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTeam();
    setRefreshing(false);
  }, [loadTeam]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const handleFollowPress = () => {
    setIsFollowing(!isFollowing);
    Alert.alert(
      isFollowing ? 'Unfollowed' : 'Following!', 
      `You ${isFollowing ? 'unfollowed' : 'are now following'} ${team?.name || 'this team'}`
    );
  };

  const renderMemberCard = ({ item }: { item: TeamMember & { team_name?: string } }) => {
    const displayName = item.user?.display_name || item.user?.full_name || 'Player';
    const teamName = (item as any).team_name || 'Team';
    const position = item.position || item.role || '';
    const jersey = item.jersey_number ? `#${item.jersey_number}` : '';
    
    return (
      <Pressable
        style={[styles.memberCard, { 
          backgroundColor: theme.card,
          borderColor: theme.border,
        }]}
        onPress={() => {
          if (item.user?.id || item.user_id) {
            router.push(`/profile?id=${item.user?.id || item.user_id}` as any);
          }
        }}
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
      </Pressable>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <Stack.Screen options={{ title: 'Team', headerShown: true }} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <Stack.Screen options={{ title: 'Team', headerShown: true }} />
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: theme.mutedText }]}>{error}</Text>
          <Pressable onPress={loadTeam} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: team?.name || 'Team', headerShown: false }} />
      
      {/* Cover Photo - Extends to top */}
      <LinearGradient
        colors={colorScheme === 'dark' ? ['#1e293b', '#334155'] : ['#e2e8f0', '#cbd5e1']}
        style={styles.coverContainerFull}
      >
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          {/* Custom Header */}
          <View style={[styles.header, { 
            backgroundColor: 'transparent',
            borderBottomWidth: 0,
          }]}>
            <Pressable 
              onPress={() => void router.back()} 
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={colorScheme === 'dark' ? '#fff' : '#000'} />
            </Pressable>
          </View>
        </SafeAreaView>
        
        {team?.logo_url ? (
          <Image source={{ uri: team.logo_url }} style={styles.coverImage} contentFit="cover" />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.coverPlaceholderText}>{team?.name || 'Team'}</Text>
          </View>
        )}
      </LinearGradient>

      {/* Profile Section */}
      <View style={styles.profileSection}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {team?.logo_url ? (
            <Image source={{ uri: team.logo_url }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.surface }]}>
              <Text style={[styles.avatarPlaceholderText, { color: theme.text }]}>
                {team?.name?.charAt(0).toUpperCase() || 'T'}
              </Text>
            </View>
          )}
        </View>

        {/* Team Info */}
        <View style={styles.infoSection}>
          <Text style={[styles.teamName, { color: theme.text }]}>
            {team?.name || 'Team Name'}
          </Text>
          
          {/* Handle and Organization Button Row */}
          <View style={styles.handleOrgRow}>
            <Text style={[styles.teamHandle, { color: theme.mutedText }]}>
              @{(team?.name || 'team').toLowerCase().replace(/\s+/g, '')}
            </Text>
            <Pressable
              onPress={() => router.push(`/organization?id=${team?.organization_id || team?.id}` as any)}
            >
              <Text style={styles.orgEmojiButton}>🏢</Text>
            </Pressable>
          </View>

          {team?.description && (
            <Text style={[styles.teamBio, { color: theme.text }]}>
              {team.description}
            </Text>
          )}
          {/* Coach Contact */}
          <Text style={[styles.coachContact, { color: theme.mutedText }]}>
            📧 Coach contact available in roster
          </Text>
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

        {/* Small Organization Button - Emoji Only */}
        {/* Moved above to handle row */}
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

      {/* Content - FlatList for all tabs */}
      <FlatList
        key={activeTab}
        data={activeTab === 'feed' ? posts : activeTab === 'schedule' ? games : members}
        numColumns={activeTab === 'feed' ? 2 : 1}
        columnWrapperStyle={activeTab === 'feed' ? styles.gridRow : undefined}
        keyExtractor={(item, idx) => `${item.id}-${idx}`}
        renderItem={({ item, index }) => {
          if (activeTab === 'feed') {
            // Feed: 2-column grid with PostCard
            return (
              <View style={styles.gridItem}>
                <PostCard
                  post={item}
                  showAuthorHeader={false}
                  onPress={() => void router.push(`/post-detail?id=${item.id}` as any)}
                />
              </View>
            );
          } else if (activeTab === 'schedule') {
            // Schedule: EXACT UI from feed.tsx - full-width game cards with cover images
            const gameItem = item as any;
            const banner = gameItem.cover_image_url || gameItem.banner_url || null;
            const hasBanner = typeof banner === 'string' && banner.length > 0;
            const gradient: [string, string] = index % 2 === 0 ? ['#1e293b', '#0f172a'] : ['#0f172a', '#1e293b'];
            const eventDate = gameItem.date ? format(new Date(gameItem.date), 'MMM d') : 'TBD';
            const eventTime = gameItem.date ? format(new Date(gameItem.date), 'h:mm a') : '';
            const locationText = gameItem.location ? String(gameItem.location).split(',')[0] : 'Location TBD';
            
            return (
              <Pressable
                key={String(gameItem.id)}
                style={styles.singleEventCard}
                onPress={() => void router.push({ pathname: '/(tabs)/feed/game/[id]', params: { id: String(gameItem.id) } })}
                accessibilityRole="button"
              >
                {hasBanner ? (
                  <Image source={{ uri: banner }} style={styles.singleEventImage} contentFit="cover" />
                ) : (
                  <LinearGradient colors={gradient} style={styles.singleEventImage} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                )}
                <LinearGradient
                  colors={colorScheme === 'dark' ? ['rgba(15,23,42,0.1)', 'rgba(15,23,42,0.9)'] : ['rgba(15,23,42,0.05)', 'rgba(15,23,42,0.85)']}
                  style={styles.gridShade}
                  pointerEvents="none"
                />
                <View style={styles.gridContent}>
                  <View style={styles.gridDateChip}>
                    <Ionicons name="calendar-outline" size={12} color="#FFFFFF" />
                    <Text style={styles.gridDateText}>{eventDate}</Text>
                  </View>
                  <Text style={styles.gridTitle} numberOfLines={2}>
                    {gameItem.title ? String(gameItem.title) : 'Game'}
                  </Text>
                  <Text style={styles.gridMeta} numberOfLines={1}>
                    {eventTime ? `${eventTime} • ${locationText}` : locationText}
                  </Text>
                </View>
              </Pressable>
            );
          } else {
            // Roster: member cards
            return renderMemberCard({ item: item as any });
          }
        }}
        ListEmptyComponent={
          <EmptyState
            icon={activeTab === 'feed' ? 'newspaper-outline' : activeTab === 'schedule' ? 'calendar-outline' : 'people-outline'}
            title={activeTab === 'feed' ? 'No posts yet' : activeTab === 'schedule' ? 'No scheduled games' : 'No roster members found'}
            subtitle={
              activeTab === 'feed'
                ? 'Posts from team games and team mentions will appear here'
                : activeTab === 'schedule'
                  ? 'Upcoming games from all teams will appear here'
                  : 'Players from all teams will appear here'
            }
            style={styles.emptyStateContainer}
          />
        }
        contentContainerStyle={{ 
          paddingHorizontal: activeTab === 'feed' ? 6 : activeTab === 'roster' ? 16 : 12, 
          paddingVertical: 12, 
          paddingBottom: insets.bottom + 20 
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.tint}
          />
        }
      />
    </View>
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
    height: 50,
    width: '100%',
  },
  coverContainerFull: {
    height: 130,
    width: '100%',
    position: 'relative',
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
  teamName: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  teamHandle: {
    fontSize: 13,
    marginBottom: 6,
  },
  teamBio: {
    fontSize: 13,
    lineHeight: 18,
  },
  handleOrgRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orgEmojiButton: {
    fontSize: 24,
  },
  coachContact: {
    fontSize: 12,
    marginTop: 8,
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
  teamCardName: {
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
  gridRow: {
    gap: 6,
    paddingHorizontal: 0,
  },
  gridItem: {
    flex: 1,
    aspectRatio: 1,
  },
  scheduleCardWrapper: {
    marginHorizontal: 0,
    marginBottom: 12,
  },
  emptyStateContainer: {
    width: '100%',
    paddingVertical: 48,
    paddingHorizontal: 24,
    marginTop: 80,
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
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  tabContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  // Game card styles from feed.tsx
  singleEventCard: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 12,
    marginHorizontal: 0,
  },
  singleEventImage: {
    width: '100%',
    height: '100%',
  },
  gridShade: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  gridContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    zIndex: 2,
  },
  gridDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
    gap: 4,
  },
  gridDateText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  gridTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    lineHeight: 20,
  },
  gridMeta: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.9,
  },
});
