import { Game, Post, Team } from '@/api/entities';
import PostCard from '@/components/PostCard';
import { GameCard } from '@/components/ui/GameCard';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
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
  const [activeTab, setActiveTab] = useState<'teams' | 'schedule' | 'feed'>('teams');
  const [isFollowing, setIsFollowing] = useState(false);

  // Swipe gesture handler
  const translateX = useSharedValue(0);
  const swipeGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Only allow positive swipes (left to right)
      if (event.translationX > 0) {
        translateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      // If swipe distance is > 100px, go back
      if (event.translationX > 100) {
        router.back();
      } else {
        // Snap back to original position
        translateX.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

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
    loadOrganization();
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

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
          <Stack.Screen options={{ 
            title: `Organization`, 
            headerShown: true,
            headerLeft: () => (
              <Pressable onPress={() => router.back()} style={{ paddingLeft: 8 }}>
                <Ionicons name="chevron-back" size={24} color="#3B82F6" />
              </Pressable>
            ),
          }} />
          
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {/* Hero Header with Gradient */}
            <View style={[styles.heroHeader, { backgroundColor: theme.tint }]}>
              <View style={styles.heroContent}>
                <View style={styles.heroIcon}>
                  <Ionicons name="business" size={56} color="#ffffff" />
                </View>
                <View style={styles.heroText}>
                  <Text style={styles.heroTitle}>Organization</Text>
                  <Text style={styles.heroSubtitle}>ID: {organizationId?.substring(0, 8)}...</Text>
                </View>
              </View>
              
              {/* Floating Stats Cards */}
              <View style={styles.floatingStats}>
                <View style={[styles.floatingStat, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                  <Text style={styles.floatingStatValue}>{teams.length}</Text>
                  <Text style={styles.floatingStatLabel}>Teams</Text>
                </View>
                <View style={[styles.floatingStat, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                  <Text style={styles.floatingStatValue}>{games.length}</Text>
                  <Text style={styles.floatingStatLabel}>Games</Text>
                </View>
                <View style={[styles.floatingStat, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                  <Text style={styles.floatingStatValue}>{posts.length}</Text>
                  <Text style={styles.floatingStatLabel}>Posts</Text>
                </View>
              </View>
            </View>

            {/* Tabs with Modern Design */}
            <View style={[styles.tabsContainer, { borderBottomColor: theme.border }]}>
              {(['teams', 'schedule', 'feed'] as const).map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[
                    styles.modernTab,
                    activeTab === tab && [
                      styles.modernTabActive,
                      { backgroundColor: theme.tint }
                    ],
                  ]}
                >
                  <Text
                    style={[
                      styles.modernTabLabel,
                      { color: activeTab === tab ? '#ffffff' : theme.mutedText },
                    ]}
                  >
                    {tab === 'teams' && <Ionicons name="people" size={16} />}
                    {tab === 'schedule' && <Ionicons name="calendar" size={16} />}
                    {tab === 'feed' && <Ionicons name="newspaper" size={16} />}
                    {' '}{tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Tab Content */}
            <View style={[styles.contentContainer, { paddingBottom: insets.bottom + 20 }]}>
              {renderTabContent()}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </GestureDetector>
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
  // Hero Header Styles
  heroHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 60,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 24,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroText: {
    flex: 1,
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  floatingStats: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: -5,
  },
  floatingStat: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(10px)',
  },
  floatingStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 2,
  },
  floatingStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  // Modern Tab Styles
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  modernTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  modernTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  modernTabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  contentContainer: {
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
