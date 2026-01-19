import { Game, Post, Team, User } from '@/api/entities';
import PostCard from '@/components/PostCard';
import { GameCard } from '@/components/ui/GameCard';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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

export default function TeamScreen() {
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
  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'upvotes'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isTeamAdmin, setIsTeamAdmin] = useState(false);
  const [me, setMe] = useState<any>(null);

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

      // Load current user to check permissions (if not already loaded)
      if (!me) {
        try {
          const currentUser = await User.me();
          setMe(currentUser);
          
          // Check if user is team owner/admin
          if (currentUser && teamData.id) {
            try {
              const memberships = await Team.members(teamData.id);
              const memberList = Array.isArray(memberships) ? memberships : [];
              const membership = memberList.find((m: any) => {
                const memberUserId = m.user_id || m.user?.id;
                if (memberUserId !== currentUser.id) return false;
                const role = String(m.role || '').toLowerCase();
                return ['owner', 'coach', 'admin'].includes(role);
              });
              setIsTeamAdmin(!!membership);
            } catch {
              setIsTeamAdmin(false);
            }
          }
        } catch {
          setMe(null);
          setIsTeamAdmin(false);
        }
      } else if (me && teamData.id) {
        // Re-check admin status if user is already loaded
        try {
          const memberships = await Team.members(teamData.id);
          const memberList = Array.isArray(memberships) ? memberships : [];
          const membership = memberList.find((m: any) => {
            const memberUserId = m.user_id || m.user?.id;
            if (memberUserId !== me.id) return false;
            const role = String(m.role || '').toLowerCase();
            return ['owner', 'coach', 'admin'].includes(role);
          });
          setIsTeamAdmin(!!membership);
        } catch {
          setIsTeamAdmin(false);
        }
      }

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
        // Feed handled separately in main render
        return null;
      
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen options={{ title: team?.name || 'Team', headerShown: false }} />
      
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
      >
        {/* Header Banner with Gradient - Matching Profile Design */}
        <View style={styles.headerBannerContainer}>
          <LinearGradient
            colors={colorScheme === 'dark' ? ['#1e293b', '#334155'] : ['#3B82F6', '#2563EB']}
            style={styles.headerBanner}
          >
            {/* Back Button */}
            <Pressable 
              style={[styles.backButtonBanner, { top: 12 + insets.top }]}
              onPress={() => void router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </Pressable>
            
            {/* Settings Icon (Top Right) - Only for team admins */}
            {isTeamAdmin && (
              <Pressable 
                style={[styles.settingsButton, { top: 12 + insets.top }]}
                onPress={() => router.push('/settings')}
              >
                <Ionicons name="settings-outline" size={18} color="#ffffff" />
              </Pressable>
            )}
            
            {/* Profile Picture Overlay - Circular, Overlapping Banner */}
            <View style={styles.profilePictureOverlay}>
              {team?.logo_url ? (
                <Image source={{ uri: team.logo_url }} style={styles.profilePicture} contentFit="cover" />
              ) : (
                <View style={styles.profilePicturePlaceholder}>
                  <Ionicons name="people" size={36} color="#ffffff" />
                </View>
              )}
            </View>
            
            {/* Team Name and Edit Button Overlay */}
            <View style={styles.headerInfoOverlay}>
              <Text style={styles.headerTeamName}>{team?.name || 'Team Name'}</Text>
              {isTeamAdmin && (
                <Pressable 
                  style={styles.editProfileButton}
                  onPress={() => router.push(`/create-team?id=${team?.id}` as any)}
                >
                  <Text style={styles.editProfileButtonText}>Edit profile</Text>
                </Pressable>
              )}
            </View>
          </LinearGradient>
        </View>
        
        {/* Team Details Section - Below Banner */}
        <View style={styles.teamDetailsSection}>
          <Text style={[styles.teamHandle, { color: theme.mutedText }]}>
            @{(team?.name || 'team').toLowerCase().replace(/\s+/g, '')}
          </Text>
          {team?.description && (
            <Text style={[styles.teamBio, { color: theme.text }]}>
              {team.description}
            </Text>
          )}
          <View style={styles.teamMetaRow}>
            {team?.created_at && (
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={14} color={theme.mutedText} />
                <Text style={[styles.metaText, { color: theme.mutedText }]}>
                  Created {new Date(team.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Text style={[styles.metaText, { color: theme.mutedText }]}>
                {members.length} Members {games.length} Games
              </Text>
            </View>
          </View>
        </View>

        {/* Tabs - Matching Profile Design */}
        <View style={[styles.tabsContainer, { borderBottomColor: theme.border }]}>
          <Pressable 
            style={[styles.tabButton, activeTab === 'posts' && { borderBottomWidth: 2, borderBottomColor: theme.tint }]}
            onPress={() => setActiveTab('posts')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'posts' ? theme.tint : theme.mutedText }]}>
              Posts
            </Text>
          </Pressable>
          <Pressable 
            style={[styles.tabButton, activeTab === 'replies' && { borderBottomWidth: 2, borderBottomColor: theme.tint }]}
            onPress={() => setActiveTab('replies')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'replies' ? theme.tint : theme.mutedText }]}>
              Replies
            </Text>
          </Pressable>
          <Pressable 
            style={[styles.tabButton, activeTab === 'upvotes' && { borderBottomWidth: 2, borderBottomColor: theme.tint }]}
            onPress={() => setActiveTab('upvotes')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'upvotes' ? theme.tint : theme.mutedText }]}>
              Upvotes
            </Text>
          </Pressable>
        </View>

        {/* Tab Content */}
        <View style={[styles.tabContentContainer, { paddingBottom: insets.bottom + 20 }]}>
          {activeTab === 'posts' && (
            posts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="newspaper-outline" size={48} color={theme.mutedText} />
                <Text style={[styles.emptyStateText, { color: theme.mutedText }]}>
                  No posts yet
                </Text>
              </View>
            ) : (
              <View style={styles.postsGrid}>
                {posts.map((item, idx) => (
                  <View key={`${item.id}-${idx}`} style={styles.gridItem}>
                    <PostCard
                      post={item}
                      onPress={() => void router.push(`/post-detail?id=${item.id}` as any)}
                    />
                  </View>
                ))}
              </View>
            )
          )}
          {activeTab === 'replies' && (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-outline" size={48} color={theme.mutedText} />
              <Text style={[styles.emptyStateText, { color: theme.mutedText }]}>
                No replies yet
              </Text>
            </View>
          )}
          {activeTab === 'upvotes' && (
            <View style={styles.emptyState}>
              <Ionicons name="arrow-up-outline" size={48} color={theme.mutedText} />
              <Text style={[styles.emptyStateText, { color: theme.mutedText }]}>
                No upvotes yet
              </Text>
            </View>
          )}
        </View>
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
  gridRow: {
    gap: 6,
    paddingHorizontal: 0,
  },
  gridItem: {
    flex: 1,
    aspectRatio: 1,
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
