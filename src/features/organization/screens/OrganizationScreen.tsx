import { Game, Organization, Post, Team, User } from '@/api/entities';
import PostCard from '@/components/PostCard';
import { GameCard } from '@/components/ui/GameCard';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/shared/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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

export default function OrganizationScreen() {
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organization, setOrganization] = useState<any | null>(null);
  const [fallbackTeam, setFallbackTeam] = useState<any | null>(null);
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'teams' | 'schedule' | 'feed'>('teams');
  const [isFollowing, setIsFollowing] = useState(false);
  const [currentRole, setCurrentRole] = useState<string | null>(null);

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
    setFallbackTeam(null);
    try {
      const orgId = params.id;
      if (!orgId) {
        setError('No organization ID provided');
        setLoading(false);
        return;
      }

      let resolvedOrgId = orgId;
      setOrganizationId(resolvedOrgId);

      // Identify current user role for privilege-gated UI
      let me: any = null;
      try {
        me = await User.me();
        const role = (me?.preferences?.role || me?.role || '').toLowerCase();
        if (role) setCurrentRole(role);
      } catch {}

      // Load organization details (name, teams, memberships)
      let orgData: any | null = null;
      const normalizedQuery = String(resolvedOrgId).replace(/[-_]+/g, ' ').trim();

      try {
        orgData = await Organization.get(resolvedOrgId);
        setOrganization(orgData);
      } catch (err: any) {
        // Attempt to resolve by name/slug if ID lookup fails
        try {
          const candidates = await Organization.list(normalizedQuery, 1);
          if (Array.isArray(candidates) && candidates.length > 0) {
            resolvedOrgId = String(candidates[0].id);
            setOrganizationId(resolvedOrgId);
            orgData = await Organization.get(resolvedOrgId);
            setOrganization(orgData);
          }
        } catch {}

        // If still no org, attempt team resolution (by id then by name)
        if (!orgData) {
          try {
            let team: any = null;
            try {
              team = await Team.get(resolvedOrgId);
            } catch {
              const teamCandidates = await Team.list(normalizedQuery, false, { limit: 5 });
              if (Array.isArray(teamCandidates) && teamCandidates.length > 0) {
                team = teamCandidates[0];
              }
            }

            if (team?.organization_id) {
              resolvedOrgId = String(team.organization_id);
              setOrganizationId(resolvedOrgId);
              orgData = await Organization.get(resolvedOrgId);
              setOrganization(orgData);
            } else if (team) {
              // No linked org; use team data as fallback view
              setFallbackTeam(team);
              setLoading(false);
              return;
            } else {
              // Neither org nor team could be resolved
              setError('Organization not found. Please verify the link or ID.');
              setLoading(false);
              return;
            }
          } catch (teamErr: any) {
            // Quietly handle and present a concise error
            setError('Organization not found. Please verify the link or ID.');
            setLoading(false);
            return;
          }
        }
      }

      if (!orgData) {
        setError('Organization not found.');
        setLoading(false);
        return;
      }

      // Normalize teams and hydrate counts
      let orgTeams: LeagueTeam[] = Array.isArray(orgData.teams)
        ? orgData.teams.map((team: any) => ({
            id: team.id,
            name: team.name,
            sport: team.sport,
            season: team.season ?? team.season_start ?? undefined,
            logo_url: team.logo_url || team.avatar_url,
            description: team.description,
            organization_id: orgId,
            _count: { members: team._count?.memberships ?? team._count?.members ?? 0 },
          }))
        : [];

      // Fallback: fetch teams via directory endpoint if org payload lacks teams
      if (orgTeams.length === 0) {
        try {
          const allTeams = await Team.list(undefined, undefined, { limit: 200 });
          orgTeams = (allTeams || [])
            .filter((t: any) => t.organization_id === orgId)
            .map((team: any) => ({
              id: team.id,
              name: team.name,
              sport: team.sport,
              season: team.season,
              logo_url: team.logo_url || team.avatar_url,
              description: team.description,
              organization_id: team.organization_id,
              _count: { members: team._count?.members ?? 0 },
            }));
        } catch (err) {
          console.error('[Organization] Failed to load teams list:', err);
        }
      }

      const teamIds = new Set(orgTeams.map((t) => String(t.id).toLowerCase()));
      const teamNames = orgTeams.map((t) => (t.name || '').toLowerCase()).filter(Boolean);

      // Fetch games and posts scoped to this organization
      const [gamesResult, postsResult] = await Promise.all([
        (async () => {
          try {
            const allGames = await Game.list('-date', { limit: 100, showPending: true });
            return (allGames || [])
              .filter((g: any) => {
                const homeId = String(g.home_team_id || g.team_id || '').toLowerCase();
                const awayId = String(g.away_team_id || '').toLowerCase();
                const homeName = (g.home_team || g.home_team_name || g.title || '').toLowerCase();
                const awayName = (g.away_team || g.away_team_name || g.opponent || g.opponent_name || '').toLowerCase();
                const idMatch = (homeId && teamIds.has(homeId)) || (awayId && teamIds.has(awayId));
                const nameMatch = teamNames.some((name) => homeName.includes(name) || awayName.includes(name));
                return idMatch || nameMatch;
              })
              .sort((a: any, b: any) => {
                const dateA = new Date(a.date || a.scheduled_date || a.created_at || 0).getTime();
                const dateB = new Date(b.date || b.scheduled_date || b.created_at || 0).getTime();
                return dateA - dateB;
              });
          } catch (err) {
            console.error('Failed to load games:', err);
            return [];
          }
        })(),
        (async () => {
          try {
            const allPosts = await Post.list('-created_at', 50);
            return (allPosts || []).filter((p: any) => {
              const content = (p.content || p.caption || '').toLowerCase();
              const game = p.game || {};
              const homeId = String(game.home_team_id || '').toLowerCase();
              const awayId = String(game.away_team_id || '').toLowerCase();
              const homeName = (game.home_team || '').toLowerCase();
              const awayName = (game.away_team || '').toLowerCase();
              const idMatch = (homeId && teamIds.has(homeId)) || (awayId && teamIds.has(awayId));
              const nameMatch = teamNames.some((name) =>
                homeName.includes(name) || awayName.includes(name) || content.includes(`#${name.replace(/\s+/g, '')}`) || content.includes(name)
              );
              return idMatch || nameMatch;
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

      // Detect membership so the follow button reflects reality
      const isMember = Array.isArray(orgData.memberships)
        ? orgData.memberships.some((m: any) => {
            const memberUserId = m.user_id || m.user?.id;
            const status = (m.status || 'active').toLowerCase();
            return memberUserId && memberUserId === me?.id && status === 'active';
          })
        : false;
      if (typeof isMember === 'boolean') {
        setIsFollowing(isMember);
      }

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
    void router.push({ pathname: '/(tabs)/team-page', params: { id: teamId } });
  };

  const handleGamePress = (gameId: string) => {
    void router.push({ pathname: '/game-detail', params: { id: gameId } });
  };

  const handlePostPress = (postId: string) => {
    void router.push({ pathname: '/post-detail', params: { id: postId } });
  };

  const handleFollowPress = () => {
    setIsFollowing((prev) => {
      const next = !prev;
      Alert.alert(
        next ? 'Following' : 'Unfollowed',
        next
          ? `You will see updates from ${orgName || 'this organization'}.`
          : `You will stop receiving updates from ${orgName || 'this organization'}.`
      );
      return next;
    });
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
                onPress={() => handleGamePress(game.id)}
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
                onPress={() => handlePostPress(post.id)}
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

  if (error && !fallbackTeam) {
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

  if (fallbackTeam) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <Stack.Screen options={{ title: fallbackTeam?.name || 'Team', headerShown: false }} />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}> 
            <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Pressable>
            <Text style={[styles.topBarTitle, { color: theme.text }]}>Team</Text>
            <View style={{ width: 40 }} />
          </View>

          <LinearGradient
            colors={['#0ea5e9', '#2563eb']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroHeader}
          >
            <View style={styles.heroContent}>
              <View style={styles.heroIcon}>
                <Ionicons name="people" size={56} color="#ffffff" />
              </View>
              <View style={styles.heroText}>
                <Text style={styles.heroTitle}>{fallbackTeam?.name || 'Team'}</Text>
                {fallbackTeam?.sport ? (
                  <Text style={styles.heroSubtitle}>{fallbackTeam.sport}</Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => handleTeamPress(fallbackTeam.id)}
                style={[styles.followButton, { backgroundColor: '#fff', borderColor: 'rgba(255,255,255,0.35)' }]}
              >
                <Ionicons name="chevron-forward" size={18} color={theme.tint} />
                <Text style={[styles.followButtonText, { color: theme.tint }]}>Open Team</Text>
              </Pressable>
            </View>
          </LinearGradient>

          <View style={[styles.fallbackCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.fallbackTitle, { color: theme.text }]}>No linked organization</Text>
            <Text style={[styles.fallbackBody, { color: theme.mutedText }]}>This team is not linked to an organization yet.</Text>
            <Pressable onPress={() => handleTeamPress(fallbackTeam.id)} style={[styles.primaryButton, { backgroundColor: theme.tint }]}>
              <Text style={styles.primaryButtonText}>Go to Team Page</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const orgName = organization?.name
    || (typeof params.id === 'string' && params.id.length > 6
      ? `Organization ${params.id.slice(0, 6)}`
      : 'Organization');
  const teamCount = teams.length;
  const gameCount = games.length;
  const postCount = posts.length;
  const heroSubtitle = organization?.location
    || (['coach', 'organizer', 'admin'].includes((currentRole || '').toLowerCase()) && organizationId
      ? `ID: ${organizationId.substring(0, 8)}...`
      : null);

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
          <Stack.Screen options={{ 
            title: `Organization`, 
            headerShown: false,
          }} />
          
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}> 
              <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="chevron-back" size={24} color={theme.text} />
              </Pressable>
              <Text style={[styles.topBarTitle, { color: theme.text }]}>Organization</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Hero Header with Gradient */}
            <LinearGradient
              colors={['#0ea5e9', '#2563eb']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroHeader}
            >
              <View style={styles.heroContent}>
                <View style={styles.heroIcon}>
                  <Ionicons name="business" size={56} color="#ffffff" />
                </View>
                <View style={styles.heroText}>
                  <Text style={styles.heroTitle}>{orgName}</Text>
                  {heroSubtitle ? (
                    <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={handleFollowPress}
                  style={[
                    styles.followButton,
                    {
                      backgroundColor: isFollowing ? '#fff' : 'rgba(255,255,255,0.15)',
                      borderColor: 'rgba(255,255,255,0.35)',
                    },
                  ]}
                >
                  <Ionicons
                    name={isFollowing ? 'checkmark-circle' : 'person-add'}
                    size={18}
                    color={isFollowing ? theme.tint : '#fff'}
                  />
                  <Text
                    style={[
                      styles.followButtonText,
                      { color: isFollowing ? theme.tint : '#fff' },
                    ]}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </Pressable>
              </View>
            </LinearGradient>

            {/* Stats Card */}
            <View style={styles.statsCard}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.text }]}>{teamCount}</Text>
                <Text style={[styles.statLabel, { color: theme.mutedText }]}>Teams</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.text }]}>{gameCount}</Text>
                <Text style={[styles.statLabel, { color: theme.mutedText }]}>Games</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.text }]}>{postCount}</Text>
                <Text style={[styles.statLabel, { color: theme.mutedText }]}>Posts</Text>
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
  scrollContent: {
    paddingBottom: 32,
  },
  topBar: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Hero Header Styles
  heroHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  followButtonText: {
    fontWeight: '700',
  },
  fallbackCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  fallbackBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 6,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
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
  statsCard: {
    marginHorizontal: 16,
    marginTop: -28,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: '#e5e7eb',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  // Modern Tab Styles
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
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
});
