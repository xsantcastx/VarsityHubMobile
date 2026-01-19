import { Game, Organization, Post, Team, User } from '@/api/entities';
import PostCard from '@/components/PostCard';
import { GameCard } from '@/components/ui/GameCard';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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

export default function OrganizationScreen() {
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'upvotes'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [me, setMe] = useState<any>(null);
  const [organization, setOrganization] = useState<any>(null);

  const loadOrganization = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const orgId = params.id;
      if (!orgId) {
        setError('No organization ID provided');
        setLoading(false);
        return;
      }

      setOrganizationId(orgId);

      // Load current user to check permissions
      try {
        const currentUser = await User.me();
        setMe(currentUser);
        
        // Check if user is organization admin
        if (currentUser && orgId) {
          try {
            const orgData = await Organization.get(orgId);
            setOrganization(orgData);
            
            // Check if user is admin
            if (orgData?.memberships && Array.isArray(orgData.memberships)) {
              const membership = orgData.memberships.find((m: any) => {
                const memberUserId = m.user?.id || m.user_id;
                if (memberUserId !== currentUser.id) return false;
                const role = String(m.role || '').toLowerCase();
                return ['owner', 'manager', 'administrator', 'admin'].includes(role);
              });
              setIsOrgAdmin(!!membership);
            } else {
              setIsOrgAdmin(false);
            }
          } catch {
            setIsOrgAdmin(false);
          }
        }
      } catch {
        // Not logged in or error loading user
        setMe(null);
        setIsOrgAdmin(false);
      }
      
      // Try to load organization data
      try {
        const orgData = await Organization.get(orgId);
        setOrganization(orgData);
      } catch {
        // Continue without org data if it fails
      }

      // Fetch all teams in this organization with fallback
      let allTeams: any[] = [];
      try {
        allTeams = await Team.list();
      } catch (err) {
        console.error('Failed to load teams list:', err);
        // Continue with empty teams list - the org might not have any teams yet
        allTeams = [];
      }
      const orgTeams = allTeams.filter((t: any) => t.organization_id === orgId);

      // Fetch games for all teams in organization
      const [gamesResult, postsResult] = await Promise.all([
        (async () => {
          try {
            const allGames = await Game.list('-date');
            const teamNames = orgTeams.map((t: any) => t.name?.toLowerCase() || '');
            return allGames
              .filter((g: any) => {
                const homeTeam = (g.home_team || '').toLowerCase();
                const awayTeam = (g.away_team || '').toLowerCase();
                return teamNames.some(name => 
                  homeTeam.includes(name) || awayTeam.includes(name)
                );
              })
              .sort((a, b) => {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                return dateA - dateB;
              });
          } catch (err) {
            console.error('Failed to load games:', err);
            return [];
          }
        })(),
        (async () => {
          try {
            const allPosts = await Post.list('-created_at');
            const teamHashtags = orgTeams.map((t: any) => `#${(t.name || '').toLowerCase().replace(/\s+/g, '')}`);
            return allPosts.filter((p: any) => {
              const content = (p.content || '').toLowerCase();
              const hasTeamHashtag = teamHashtags.some(tag => content.includes(tag));
              return hasTeamHashtag;
            });
          } catch (err) {
            console.error('Failed to load posts:', err);
            return [];
          }
        })(),
      ]).catch(err => {
        console.error('Failed to load games or posts:', err);
        return [[], []];
      });

      setTeams(orgTeams);
      setGames(gamesResult || []);
      setPosts(postsResult || []);
    } catch (err: any) {
      console.error('Failed to load organization:', err);
      setError(err?.message || 'Failed to load organization data');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrganization();
    setRefreshing(false);
  }, [loadOrganization]);

  useEffect(() => {
    void loadOrganization();
  }, [loadOrganization]);

  const handleTeamPress = (teamId: string) => {
    router.push(`/team-page?id=${teamId}` as any);
  };

  const handleFollowPress = () => {
    setIsFollowing(!isFollowing);
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
          {item._count?.members !== undefined && (
            <Text style={[styles.teamMeta, { color: theme.mutedText }]} numberOfLines={1}>
              {item._count.members} members
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.mutedText} />
      </View>
    </Pressable>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'teams':
        if (teams.length === 0) {
          return (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={theme.mutedText} />
              <Text style={[styles.emptyStateText, { color: theme.mutedText }]}>
                No teams in this organization
              </Text>
            </View>
          );
        }
        return (
          <View style={styles.teamsList}>
            {teams.map((team) => (
              <View key={team.id}>
                {renderTeamCard({ item: team })}
              </View>
            ))}
          </View>
        );

      case 'schedule':
        if (games.length === 0) {
          return (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={theme.mutedText} />
              <Text style={[styles.emptyStateText, { color: theme.mutedText }]}>
                No games scheduled
              </Text>
            </View>
          );
        }
        return (
          <View style={styles.gamesList}>
            {games.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                onPress={() => void router.push(`/game-details?id=${game.id}` as any)}
              />
            ))}
          </View>
        );

      case 'feed':
        if (posts.length === 0) {
          return (
            <View style={styles.emptyState}>
              <Ionicons name="newspaper-outline" size={48} color={theme.mutedText} />
              <Text style={[styles.emptyStateText, { color: theme.mutedText }]}>
                No posts yet
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
                onPress={() => void router.push(`/post-detail?id=${post.id}` as any)}
              />
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
        <Stack.Screen options={{ 
          title: 'Organization', 
          headerShown: true,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ paddingLeft: 8 }}>
              <Ionicons name="chevron-back" size={24} color="#3B82F6" />
            </Pressable>
          ),
        }} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <Stack.Screen options={{ 
          title: 'Organization', 
          headerShown: true,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ paddingLeft: 8 }}>
              <Ionicons name="chevron-back" size={24} color="#3B82F6" />
            </Pressable>
          ),
        }} />
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: theme.mutedText }]}>{error}</Text>
          <Pressable onPress={loadOrganization} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const orgName = organization?.name || organization?.display_name || 'Organization';
  const orgHandle = `@${(orgName || 'organization').toLowerCase().replace(/\s+/g, '')}`;
  const orgDescription = organization?.description || '';
  const orgAvatarUrl = organization?.avatar_url || organization?.logo_url;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen options={{ title: orgName, headerShown: false }} />
      
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
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </Pressable>
            
            {/* Settings Icon (Top Right) - Only for org admins */}
            {isOrgAdmin && (
              <Pressable 
                style={[styles.settingsButton, { top: 12 + insets.top }]}
                onPress={() => router.push('/settings')}
              >
                <Ionicons name="settings-outline" size={18} color="#ffffff" />
              </Pressable>
            )}
            
            {/* Profile Picture Overlay - Circular, Overlapping Banner */}
            <View style={styles.profilePictureOverlay}>
              {orgAvatarUrl ? (
                <Image source={{ uri: orgAvatarUrl }} style={styles.profilePicture} contentFit="cover" />
              ) : (
                <View style={styles.profilePicturePlaceholder}>
                  <Ionicons name="business" size={36} color="#ffffff" />
                </View>
              )}
            </View>
            
            {/* Organization Name and Edit Button Overlay */}
            <View style={styles.headerInfoOverlay}>
              <Text style={styles.headerOrgName}>{orgName}</Text>
              {isOrgAdmin && (
                <Pressable 
                  style={styles.editProfileButton}
                  onPress={() => router.push(`/create-organization?id=${organizationId}` as any)}
                >
                  <Text style={styles.editProfileButtonText}>Edit profile</Text>
                </Pressable>
              )}
            </View>
          </LinearGradient>
        </View>
        
        {/* Organization Details Section - Below Banner */}
        <View style={styles.orgDetailsSection}>
          <Text style={[styles.orgHandle, { color: theme.mutedText }]}>
            {orgHandle}
          </Text>
          {orgDescription && (
            <Text style={[styles.orgBio, { color: theme.text }]}>
              {orgDescription}
            </Text>
          )}
          <View style={styles.orgMetaRow}>
            {organization?.created_at && (
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={14} color={theme.mutedText} />
                <Text style={[styles.metaText, { color: theme.mutedText }]}>
                  Created {new Date(organization.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Text style={[styles.metaText, { color: theme.mutedText }]}>
                {teams.length} Teams {games.length} Games
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
              <View style={styles.postsList}>
                {posts.map((post, index) => (
                  <PostCard
                    key={`${post.id}-${index}`}
                    post={post}
                    onPress={() => router.push(`/post-detail?id=${post.id}` as any)}
                  />
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
  scrollView: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Header Banner - Matching Profile Design
  headerBannerContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  headerBanner: {
    height: 200,
    width: '100%',
    position: 'relative',
    paddingTop: 12,
  },
  backButtonBanner: {
    position: 'absolute',
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  settingsButton: {
    position: 'absolute',
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  profilePictureOverlay: {
    position: 'absolute',
    left: 16,
    bottom: -40,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  profilePicture: {
    width: '100%',
    height: '100%',
    borderRadius: 37,
  },
  profilePicturePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 37,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfoOverlay: {
    position: 'absolute',
    left: 16,
    bottom: 12,
    right: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerOrgName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  editProfileButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
  },
  editProfileButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  orgDetailsSection: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
  },
  orgHandle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  orgBio: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  orgMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '400',
  },
  // Tab Styles
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
  tabText: {
    fontSize: 14,
    fontWeight: '400',
  },
  tabContentContainer: {
    paddingHorizontal: 16,
  },
  teamsList: {
    gap: 12,
    marginBottom: 16,
  },
  gamesList: {
    gap: 12,
    marginBottom: 16,
  },
  postsList: {
    gap: 12,
    marginBottom: 16,
  },
  teamCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  teamCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  teamLogo: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  teamLogoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  teamMeta: {
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptyStateSubtext: {
    fontSize: 13,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Old styles (keeping for reference)
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  organizationCard: {
    borderRadius: 12,
    padding: 16,
  },
  organizationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  organizationInfo: {
    flex: 1,
  },
  organizationName: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  organizationId: {
    fontSize: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 0,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
