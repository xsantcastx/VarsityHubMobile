import { Game, Organization, Post, Team, User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { getGradientForColor } from '@/utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import GameVerticalFeedScreen, { FeedPost } from './game-details/GameVerticalFeedScreen';
import { safeGoBack } from '@/utils/navigation';

type LeagueTeam = {
  id: string;
  name: string;
  sport?: string;
  season?: string;
  logo_url?: string;
  description?: string;
  organization_id?: string;
  created_at?: string;
  _count?: {
    members?: number;
    games?: number;
    posts?: number;
    followers?: number;
    following?: number;
  };
};

type GameItem = {
  id: string;
  date?: string | Date;
  created_at?: string | Date;
  home_team?: string;
  homeTeam?: string;
  away_team?: string;
  awayTeam?: string;
};

type PostItem = {
  id: string;
  media_url?: string;
  caption?: string;
  content?: string;
  upvotes_count?: number;
  comments_count?: number;
  created_at?: string;
  created_date?: string;
  _count?: {
    comments?: number;
  };
};

type TeamMember = {
  id: string;
  user_id?: string;
  team_id?: string;
  role?: string;
  status?: string;
  jersey_number?: string | number;
  position?: string;
  user?: {
    id: string;
    display_name?: string;
    full_name?: string;
    username?: string;
    avatar_url?: string;
    is_parent?: boolean;
  };
};

const VIDEO_EXT = /\.(mp4|mov|webm|m4v|avi)$/i;
const HEADER_IMAGE_DRAG_LIMIT = 120;
const _clampValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toFeedPost = (item: any): FeedPost | null => {
  const id = item?.id ? String(item.id) : null;
  if (!id) return null;
  const media = typeof item?.media_url === 'string' ? item.media_url : null;
  const explicit = typeof item?.media_type === 'string' ? String(item.media_type).toLowerCase() : null;
  const media_type: 'video' | 'image' = media
    ? (explicit === 'video' || explicit === 'image' ? (explicit as any) : (VIDEO_EXT.test(media) ? 'video' : 'image'))
    : 'image';
  return {
    id,
    media_url: media,
    media_type,
    caption: item?.caption ?? item?.content ?? '',
    upvotes_count: item?.upvotes_count ?? 0,
    comments_count: item?.comments_count ?? item?._count?.comments ?? 0,
    bookmarks_count: item?.bookmarks_count ?? 0,
    created_at: item?.created_at ?? null,
    author: item?.author ? { id: String(item.author.id ?? id), username: (item.author as any).username ?? null, display_name: (item.author as any).display_name ?? null, avatar_url: item.author.avatar_url ?? null } : null,
    has_upvoted: Boolean(item?.has_upvoted),
    has_bookmarked: Boolean(item?.has_bookmarked),
    is_following_author: Boolean(item?.is_following_author),
  };
};

function TeamScreen() {
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; name?: string; from?: string; gameId?: string }>();
  const { from, gameId } = params;
  const navigation = useNavigation();
  
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<LeagueTeam | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [games, setGames] = useState<GameItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'upvotes' | 'events'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isTeamAdmin, setIsTeamAdmin] = useState(false);
  const [me, setMe] = useState<{ id?: string; username?: string; display_name?: string; avatar_url?: string } | null>(null);
  
  // Posts state - matching profile.tsx
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [_postsCursor, _setPostsCursor] = useState<string | null>(null);
  const [postsHasMore, setPostsHasMore] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const postsRequestInFlight = useRef(false);

  const [replies, setReplies] = useState<PostItem[]>([]);
  const [_repliesCursor, _setRepliesCursor] = useState<string | null>(null);
  const [repliesHasMore, setRepliesHasMore] = useState(true);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const repliesRequestInFlight = useRef(false);
  
  const [upvotes, setUpvotes] = useState<PostItem[]>([]);
  const [_upvotesCursor, _setUpvotesCursor] = useState<string | null>(null);
  const [upvotesHasMore, setUpvotesHasMore] = useState(true);
  const [upvotesLoading, setUpvotesLoading] = useState(false);
  const upvotesRequestInFlight = useRef(false);
  
  const [_sort, _setSort] = useState<'newest' | 'most_upvoted' | 'most_commented'>('newest');
  const [teamThemeColor, setTeamThemeColor] = useState<string>('#3B82F6');
  
  // Vertical viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerItems, setViewerItems] = useState<FeedPost[]>([]);

  const handleBack = useCallback(() => {
    if (from === 'game-details' && gameId) {
      if (navigation.canGoBack()) {
        safeGoBack(router);
      } else {
        router.push({ pathname: '/game/[id]', params: { id: gameId } } as any);
      }
    } else {
      safeGoBack(router);
    }
  }, [from, gameId, navigation, router]);

  // Mounted guard to prevent state updates after unmount
  const mounted = useRef(true);
  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const refreshPosts = useCallback(async (_teamId: string) => {
    if (postsRequestInFlight.current || !mounted.current) return;
    postsRequestInFlight.current = true;
    if (mounted.current) setPostsLoading(true);
    try {
      // Fetch posts for team games
      const teamNameLower = (team?.name || '').toLowerCase();
      const allGamesData = await Game.list('-date');
      if (!mounted.current) return;
      const allGames = Array.isArray(allGamesData) ? allGamesData : (allGamesData?.games || allGamesData?.items || []);

      const teamGames = allGames.filter((g: GameItem) => {
            const homeTeam = (g.home_team || g.homeTeam || '').toLowerCase();
            const awayTeam = (g.away_team || g.awayTeam || '').toLowerCase();
            return homeTeam.includes(teamNameLower) || awayTeam.includes(teamNameLower);
          });
      
      const gameIds = teamGames.map((g: GameItem) => g.id);
      if (!mounted.current) return;
      
      if (gameIds.length === 0) {
        if (mounted.current) {
          setPosts([]);
          setPostsHasMore(false);
        }
        return;
      }
      
      // Fetch posts for all team games (aggregate from all games)
      const postPromises = gameIds.slice(0, 10).map((gameId: string) =>
        Post.filter({ game_id: gameId }, '-created_at', 20).catch(() => [])
      );
      const postBatches = await Promise.all(postPromises);
      if (!mounted.current) return;
      
      // Aggregate and deduplicate posts
      const allPosts: PostItem[] = [];
      const seenIds = new Set<string>();
      
      postBatches.forEach(batch => {
        if (Array.isArray(batch)) {
          batch.forEach((post: PostItem) => {
            if (post?.id && !seenIds.has(String(post.id))) {
              seenIds.add(String(post.id));
              allPosts.push(post);
            }
          });
        }
      });
      
      // Sort by creation date (newest first)
      allPosts.sort((a: PostItem, b: PostItem) => {
        const dateA = new Date(a.created_at || a.created_date || 0).getTime();
        const dateB = new Date(b.created_at || b.created_date || 0).getTime();
        return dateB - dateA;
      });
      
      if (mounted.current) {
        setPosts(allPosts);
        setPostsHasMore(false); // Simplified pagination
      }
    } finally {
      postsRequestInFlight.current = false;
      if (mounted.current) setPostsLoading(false);
    }
  }, [team?.name]);

  const refreshReplies = useCallback(async (_teamId: string) => {
    if (repliesRequestInFlight.current || !mounted.current) return;
    repliesRequestInFlight.current = true;
    if (mounted.current) setRepliesLoading(true);
    try {
      // For teams, replies would be comments on team posts
      // Simplified for now - empty
      if (mounted.current) {
        setReplies([]);
        setRepliesHasMore(false);
      }
    } finally {
      repliesRequestInFlight.current = false;
      if (mounted.current) setRepliesLoading(false);
    }
  }, []);

  const refreshUpvotes = useCallback(async (_teamId: string) => {
    if (upvotesRequestInFlight.current || !mounted.current) return;
    upvotesRequestInFlight.current = true;
    if (mounted.current) setUpvotesLoading(true);
    try {
      // For teams, upvotes would be upvoted posts
      // Simplified for now - empty
      if (mounted.current) {
        setUpvotes([]);
        setUpvotesHasMore(false);
      }
    } finally {
      upvotesRequestInFlight.current = false;
      if (mounted.current) setUpvotesLoading(false);
    }
  }, []);

  const loadTeam = useCallback(async () => {
    if (!mounted.current) return;
    setLoading(true);
    setError(null);
    try {
      // Validate and sanitize route params
      const teamId = params.id?.trim();
      const teamName = params.name?.trim();
      
      // Validate ID format (alphanumeric, dash, underscore only)
      if (teamId && !/^[a-zA-Z0-9_-]+$/.test(teamId)) {
        if (mounted.current) {
          setError('Invalid team ID format');
          setLoading(false);
        }
        return;
      }
      
      if (!teamId && !teamName) {
        if (mounted.current) {
          setError('No team ID or name provided');
          setLoading(false);
        }
        return;
      }

      let teamData: LeagueTeam | null = null;

      try {
        // If we have a team ID, use Team.get() to get full details including organization_id
        if (teamId) {
          try {
            const fullTeamData = await Team.get(teamId);
            if (fullTeamData) {
              teamData = fullTeamData as LeagueTeam;
            }
          } catch (getErr: any) {
            if (__DEV__) console.warn('[team-page] Failed to get team by ID, trying list:', getErr);
          }
        }
        
        // Fallback to list if get() didn't work or we only have teamName
        if (!teamData) {
          const allTeams = await Team.list(undefined, undefined, { limit: 100 });
          const teamsList = Array.isArray(allTeams) ? allTeams : [];
          
          if (teamId && !teamData) {
            teamData = teamsList.find((t: LeagueTeam) => t.id === teamId) || null;
          }
          
          if (!teamData && teamName) {
            teamData = teamsList.find((t: LeagueTeam) => 
              t.name?.toLowerCase() === teamName.toLowerCase()
            ) || null;
          }
        }
      } catch (apiErr: any) {
        if (__DEV__) console.error('[team-page] Failed to fetch teams from API:', apiErr);
        // Continue to try fallback logic
      }

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

      if (!mounted.current) return;
      
      // Extract organization_id from team data (could be direct or nested in organization object)
      const orgId = (teamData as any)?.organization_id || (teamData as any)?.organization?.id;
      if (orgId) {
        teamData = { ...teamData, organization_id: String(orgId) } as LeagueTeam;
      }
      
      setTeam(teamData);
      setIsFollowing(!!(teamData as any).is_following);

      // Load current user, team memberships, and org data in parallel
      // (was sequential: User.me → Team.members → Organization.get)
      {
        const currentUser = me || await User.me().catch(() => null);
        if (!mounted.current) return;
        if (currentUser && !me) setMe(currentUser);

        if (currentUser && teamData.id) {
          try {
            // Parallelize membership check and org owner check
            const [memberships, org] = await Promise.all([
              Team.members(teamData.id).catch(() => []),
              orgId ? Organization.get(orgId).catch(() => null) : Promise.resolve(null),
            ]);
            if (!mounted.current) return;

            const memberList = Array.isArray(memberships) ? memberships : [];
            const membership = memberList.find((m: TeamMember) => {
              const memberUserId = m.user_id || m.user?.id;
              if (memberUserId !== currentUser.id) return false;
              const role = String(m.role || '').toLowerCase();
              return ['owner', 'manager', 'coach', 'assistant_coach', 'admin'].includes(role);
            });
            const isOrgOwner = !!(org?.league_owner_id && org.league_owner_id === currentUser.id);
            if (mounted.current) setIsTeamAdmin(!!membership || isOrgOwner);
          } catch (err: any) {
            if (__DEV__) console.error('[team-page] Failed to check team admin status:', err);
            if (mounted.current) setIsTeamAdmin(false);
          }
        } else if (!currentUser) {
          if (mounted.current) { setMe(null); setIsTeamAdmin(false); }
        }
      }

      // Use default theme color (teams don't have preferences field yet)
      if (mounted.current) setTeamThemeColor('#3B82F6');

      // Fetch games, posts, and members
      const [gamesResult, membersResult] = await Promise.all([
        Game.list('-date')
          .then(allGamesData => {
            if (!mounted.current) return [];
            const allGames = Array.isArray(allGamesData) ? allGamesData : (allGamesData?.games || allGamesData?.items || []);
            const teamNameLower = (teamData!.name || '').toLowerCase();
            return allGames
              .filter((g: GameItem) => {
                  const homeTeam = (g.home_team || g.homeTeam || '').toLowerCase();
                  const awayTeam = (g.away_team || g.awayTeam || '').toLowerCase();
                  return homeTeam.includes(teamNameLower) || awayTeam.includes(teamNameLower);
                })
              .sort((a: GameItem, b: GameItem) => {
                  const dateA = new Date(a.date || a.created_at || 0).getTime();
                  const dateB = new Date(b.date || b.created_at || 0).getTime();
                  return dateA - dateB;
                });
          })
          .catch((err: any) => {
            if (__DEV__) console.error('[team-page] Failed to load games:', err);
            return [];
          }),
        
        (async () => {
          try {
            if (!teamData?.id || !mounted.current) return [];
            const teamMembers = await Team.members(teamData.id);
            if (!mounted.current) return [];
            
            const memberList = Array.isArray(teamMembers) ? teamMembers : [];
            return memberList
              .filter((m: TeamMember) => m.team_id === teamData!.id)
              .sort((a: TeamMember, b: TeamMember) => {
                const aJersey = parseInt(String(a.jersey_number || 999), 10);
                const bJersey = parseInt(String(b.jersey_number || 999), 10);
                if (aJersey !== bJersey) return aJersey - bJersey;
                const aName = a.user?.display_name || '';
                const bName = b.user?.display_name || '';
                return aName.localeCompare(bName);
              });
          } catch (err: any) {
            if (__DEV__) console.error('[team-page] Failed to load members:', err);
            return [];
          }
        })(),
      ]);

      if (!mounted.current) return;
      setGames(gamesResult);
      setMembers(membersResult);
      
      // Load initial posts
      if (teamData.id) {
        await refreshPosts(teamData.id);
      }
    } catch (err: any) {
      if (!mounted.current) return;
      if (__DEV__) console.error('[team-page] Failed to load team:', err);
      const errorMessage = err?.message || 'Failed to load team data';
      setError(errorMessage);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [params.id, params.name, me, refreshPosts]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  // Re-fetch team data when screen regains focus (e.g., after editing team name)
  const hasLoadedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      // Skip the initial focus — useEffect above already handles that
      if (!hasLoadedOnce.current) {
        hasLoadedOnce.current = true;
        return;
      }
      void loadTeam();
    }, [loadTeam])
  );

  // Refresh when switching tabs
  useEffect(() => {
    if (!team?.id) return;
    setError(null);
    if (activeTab === 'posts') {
      void refreshPosts(String(team.id));
    } else if (activeTab === 'replies') {
      void refreshReplies(String(team.id));
    } else if (activeTab === 'upvotes') {
      void refreshUpvotes(String(team.id));
    }
  }, [activeTab, team?.id, refreshPosts, refreshReplies, refreshUpvotes]);

  const loadMorePosts = useCallback(async () => {
    if (postsLoading || !postsHasMore || !team?.id || !mounted.current) return;
    if (mounted.current) setPostsLoading(true);
    try {
      // Simplified - in production you'd implement cursor-based pagination
      if (mounted.current) setPostsHasMore(false);
    } finally {
      if (mounted.current) setPostsLoading(false);
    }
  }, [postsHasMore, postsLoading, team?.id]);

  const loadMoreReplies = useCallback(async () => {
    if (repliesLoading || !repliesHasMore || !team?.id) return;
    setRepliesLoading(true);
    try {
      setRepliesHasMore(false);
    } finally {
      setRepliesLoading(false);
    }
  }, [repliesHasMore, repliesLoading, team?.id]);

  const loadMoreUpvotes = useCallback(async () => {
    if (upvotesLoading || !upvotesHasMore || !team?.id || !mounted.current) return;
    if (mounted.current) setUpvotesLoading(true);
    try {
      if (mounted.current) setUpvotesHasMore(false);
    } finally {
      if (mounted.current) setUpvotesLoading(false);
    }
  }, [upvotesHasMore, upvotesLoading, team?.id]);

  const unwrapPost = useCallback((item: PostItem | { post?: PostItem; target?: PostItem | { post?: PostItem } }) => {
    const postItem = item as any; // Complex nested structure from interactions
    return postItem?.post || postItem?.target?.post || postItem?.target || item;
  }, []);

  // Get header background (teams don't have preferences field yet, so no custom header image)
  const headerBackgroundImage = null; // Future: team?.header_image_url
  const headerImageFocusY = 0;
  const heroGradientColors: [string, string, ...string[]] = headerBackgroundImage
    ? ['rgba(4,7,20,0.85)', 'rgba(15,23,42,0.45)']
    : (getGradientForColor(teamThemeColor) as [string, string, ...string[]]);
  
  const teamName = team?.name || 'Team';
  const teamHandle = `@${(team?.name || 'team').toLowerCase().replace(/\s+/g, '')}`;

  const renderHeader = () => (
    <>
      {/* Banner Header - Exact Match to Profile Design */}
      <View style={[styles.headerContainer, { backgroundColor: theme.background }]}>
        {/* Background Image / Gradient */}
        <View style={styles.headerBackgroundPressable}>
          {headerBackgroundImage ? (
            <Image
              source={{ uri: headerBackgroundImage }}
              style={[
                styles.headerBackgroundImage,
                { transform: [{ translateY: headerImageFocusY * HEADER_IMAGE_DRAG_LIMIT }] },
              ]}
              contentFit="cover"
            />
          ) : (
            <View style={styles.headerBackgroundImage} />
          )}
        </View>
        {!headerBackgroundImage && (
          <LinearGradient
            colors={heroGradientColors}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}
        {/* Dark scrim at the bottom of the header for text readability */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)']}
          style={styles.headerGradient}
          start={{ x: 0, y: 0.3 }}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
        />

        {/* Back Button - Top Left */}
        <View style={[styles.headerControls, { top: Math.max(12, insets.top), left: 16 }]}>
          <Pressable
            testID="team-page-back-button"
            onPress={handleBack}
            style={[styles.controlButton, { backgroundColor: colorScheme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.9)' }]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={18} color={theme.text} />
          </Pressable>
        </View>

        {/* Settings Button - Top Right */}
        {isTeamAdmin && (
          <View style={[styles.headerControls, { top: Math.max(12, insets.top) }]}>
            <Pressable
              testID="team-page-settings-button"
              onPress={() => void router.push('/settings')}
              style={[styles.controlButton, { backgroundColor: colorScheme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.9)' }]}
              accessibilityRole="button"
              accessibilityLabel="Team settings"
            >
              <Ionicons name="settings-outline" size={18} color={theme.text} />
            </Pressable>
          </View>
        )}
        
        {/* Profile Content - Avatar centered at banner bottom edge */}
        <View style={styles.profileContent}>
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              {team?.logo_url ? (
                <Image source={{ uri: String(team.logo_url) }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.surface || theme.card }]}>
                  <Ionicons name="people" size={48} color={theme.mutedText} />
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Content Below Banner */}
      <View style={styles.profileDetailsContainer}>
        {/* Team Name + Badge - to the right of avatar overlap */}
        <View style={styles.teamHeaderRow}>
          <View style={styles.teamHeaderSpacer} />
          <View style={styles.teamHeaderInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.userName, { color: theme.text }]}>{teamName}</Text>
              <View style={[styles.roleBadge, styles.teamBadge]}>
                <Text style={styles.roleText}>TEAM</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Handle and Action Buttons Row */}
        <View style={styles.usernameRow}>
          <Text style={[styles.userHandle, { color: theme.text }]}>{teamHandle}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {isTeamAdmin && (
              <Pressable
                testID="team-page-edit-button"
                style={[styles.editButtonBelowBanner, { backgroundColor: theme.surface || theme.background, borderColor: theme.border }]}
                onPress={() => void router.push(`/edit-team?id=${team?.id}` as any)}
                accessibilityRole="button"
                accessibilityLabel="Edit team profile"
              >
                <Text style={[styles.editButtonBelowBannerText, { color: theme.text }]}>Edit profile</Text>
              </Pressable>
            )}
            {!isTeamAdmin && (
              <Pressable
                testID="team-page-follow-button"
                style={[
                  styles.followButtonBelowBanner,
                  {
                    backgroundColor: isFollowing ? '#10B981' : '#FFD600',
                    borderWidth: 0,
                  },
                  followLoading && { opacity: 0.5 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={isFollowing ? 'Unfollow team' : 'Follow team'}
                disabled={followLoading}
                onPress={async () => {
                  // eslint-disable-next-line no-console
                  if (__DEV__) console.log('[Follow] button pressed — team?.id:', team?.id, '| isFollowing:', isFollowing);
                  if (!team?.id || team.id.startsWith('temp-') || followLoading) {
                    // eslint-disable-next-line no-console
                    if (__DEV__) console.warn('[Follow] blocked: team or team.id is missing/temporary');
                    return;
                  }
                  setFollowLoading(true);
                  try {
                    if (isFollowing) {
                      // eslint-disable-next-line no-console
                      if (__DEV__) console.log('[Follow] calling Team.unfollow(', team.id, ')');
                      await Team.unfollow(team.id);
                      // eslint-disable-next-line no-console
                      if (__DEV__) console.log('[Follow] unfollow success');
                      setIsFollowing(false);
                      setTeam((prev) => prev ? { ...prev, followers_count: Math.max(0, ((prev as any).followers_count ?? 0) - 1) } : null);
                    } else {
                      // eslint-disable-next-line no-console
                      if (__DEV__) console.log('[Follow] calling Team.follow(', team.id, ')');
                      await Team.follow(team.id);
                      // eslint-disable-next-line no-console
                      if (__DEV__) console.log('[Follow] follow success');
                      setIsFollowing(true);
                      setTeam((prev) => prev ? { ...prev, followers_count: ((prev as any).followers_count ?? 0) + 1 } : null);
                    }
                  } catch (err: any) {
                    const serverMsg = err?.data?.error || err?.data?.message || err?.message || 'Unknown error';
                    if (__DEV__) console.error('[Follow] Team follow/unfollow failed — status:', err?.status, '| server:', serverMsg, '| data:', JSON.stringify(err?.data));
                    Alert.alert('Follow Failed', `${serverMsg} (status: ${err?.status || 'unknown'})`);
                  } finally {
                    setFollowLoading(false);
                  }
                }}
              >
                {isFollowing ? (
                  <Ionicons name="checkmark" size={18} color={theme.text} />
                ) : (
                  <Ionicons name="person-add" size={16} color={theme.text} />
                )}
              </Pressable>
            )}
          </View>
        </View>

        {/* Team Details - Left aligned with avatar */}
        <View style={styles.userDetails}>
          {team?.description && (
            <Text style={[styles.userBio, { color: theme.text }]}>{team.description}</Text>
          )}
          
          {/* Created Date */}
          {team?.created_at && (
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color={theme.mutedText} />
              <Text style={[styles.metaText, { color: theme.mutedText }]}>
                Created {new Date(team.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
            </View>
          )}
          
          {/* Stats - Members, Followers, Games */}
          <View style={styles.statsRow}>
            <Text style={[styles.statNumber, { color: theme.text }]}>
              {members.length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}> Members </Text>
            <Text style={[styles.statNumber, { color: theme.text }]}>
              {(team as any)?.followers_count ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}> Followers </Text>
            <Text style={[styles.statNumber, { color: theme.text }]}>
              {games.length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}> Games</Text>
          </View>
          
          {/* Roster - Public, shows all members with roles */}
          {members.length > 0 && (
            <View style={[styles.rosterSection, { borderColor: theme.border, backgroundColor: theme.card }]}>
              <Text style={[styles.rosterTitle, { color: theme.text }]}>Roster</Text>
              <ScrollView style={styles.rosterScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              <View style={styles.rosterList}>
                {members
                  .filter((m) => m.status === 'active')
                  .map((m) => (
                    <Pressable
                      key={m.id}
                      style={({ pressed }) => [
                        styles.rosterRow,
                        { backgroundColor: pressed ? theme.surface : 'transparent', borderColor: theme.border },
                      ]}
                      onPress={() => m.user?.id && router.push({ pathname: '/user-profile', params: { id: m.user.id } } as any)}
                    >
                      {m.user?.avatar_url ? (
                        <Image source={{ uri: m.user.avatar_url }} style={styles.rosterAvatar} contentFit="cover" />
                      ) : (
                        <View style={[styles.rosterAvatarPlaceholder, { backgroundColor: theme.tint + '30' }]}>
                          <Ionicons name="person" size={16} color={theme.tint} />
                        </View>
                      )}
                      <View style={styles.rosterInfo}>
                        <Text style={[styles.rosterName, { color: theme.text }]} numberOfLines={1}>
                          {m.user?.display_name || m.user?.username || 'Unknown'}
                        </Text>
                        <View style={styles.rosterMeta}>
                          {(m.jersey_number != null && m.jersey_number !== '') && (
                            <Text style={[styles.rosterMetaText, { color: theme.mutedText }]}>#{m.jersey_number}</Text>
                          )}
                          {m.position && (
                            <Text style={[styles.rosterMetaText, { color: theme.mutedText }]}>{m.position}</Text>
                          )}
                          <Text style={[styles.rosterRole, { color: theme.tint }]}>
                            {String(m.role || 'member').replace(/_/g, ' ')}
                          </Text>
                        </View>
                      </View>
                      {m.user?.id && (
                        <Ionicons name="chevron-forward" size={14} color={theme.mutedText} />
                      )}
                    </Pressable>
                  ))}
              </View>
              </ScrollView>
            </View>
          )}

          {/* Organization Link Button - white bg, black text */}
          <Pressable
            style={[styles.orgButton, { borderColor: theme.border, backgroundColor: '#fff' }]}
            onPress={() => {
              const orgId = team?.organization_id;
              if (orgId) {
                router.push({ pathname: '/league', params: { id: orgId } } as any);
              }
            }}
            disabled={!team?.organization_id}
          >
            <Ionicons
              name="trophy-outline"
              size={16}
              color={team?.organization_id ? theme.text : theme.mutedText}
            />
            <Text style={[
              styles.orgButtonText,
              { color: team?.organization_id ? theme.text : theme.mutedText }
            ]}>
              {team?.organization_id ? 'My League' : 'No Organization'}
            </Text>
            {team?.organization_id && (
              <Ionicons name="chevron-forward" size={14} color={theme.text} />
            )}
          </Pressable>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: theme.border }]}>
        <Pressable
          testID="team-page-posts-tab"
          onPress={() => setActiveTab('posts')}
          style={[styles.tab, activeTab === 'posts' && { borderBottomWidth: 2, borderBottomColor: theme.tint }]}
          accessibilityRole="tab"
          accessibilityLabel="Posts"
          accessibilityState={{ selected: activeTab === 'posts' }}
        >
          <Text style={[styles.tabText, { color: activeTab === 'posts' ? theme.tint : theme.mutedText }]}>Posts</Text>
        </Pressable>
        <Pressable
          testID="team-page-replies-tab"
          onPress={() => setActiveTab('replies')}
          style={[styles.tab, activeTab === 'replies' && { borderBottomWidth: 2, borderBottomColor: theme.tint }]}
          accessibilityRole="tab"
          accessibilityLabel="Replies"
          accessibilityState={{ selected: activeTab === 'replies' }}
        >
          <Text style={[styles.tabText, { color: activeTab === 'replies' ? theme.tint : theme.mutedText }]}>Replies</Text>
        </Pressable>
        <Pressable
          testID="team-page-upvotes-tab"
          onPress={() => setActiveTab('upvotes')}
          style={[styles.tab, activeTab === 'upvotes' && { borderBottomWidth: 2, borderBottomColor: theme.tint }]}
          accessibilityRole="tab"
          accessibilityLabel="Upvotes"
          accessibilityState={{ selected: activeTab === 'upvotes' }}
        >
          <Text style={[styles.tabText, { color: activeTab === 'upvotes' ? theme.tint : theme.mutedText }]}>Upvotes</Text>
        </Pressable>
        <Pressable
          testID="team-page-events-tab"
          onPress={() => setActiveTab('events')}
          style={[styles.tab, activeTab === 'events' && { borderBottomWidth: 2, borderBottomColor: theme.tint }]}
          accessibilityRole="tab"
          accessibilityLabel="Events"
          accessibilityState={{ selected: activeTab === 'events' }}
        >
          <Text style={[styles.tabText, { color: activeTab === 'events' ? theme.tint : theme.mutedText }]}>Events</Text>
        </Pressable>
      </View>
    </>
  );

  const renderEmptyPosts = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>No posts yet</Text>
      <Text style={[styles.emptySubtitle, { color: theme.mutedText }]}>Posts from this team's games will appear here</Text>
    </View>
  );

  const renderEmptyReplies = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>No replies yet</Text>
    </View>
  );

  const renderEmptyUpvotes = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>No upvotes yet</Text>
    </View>
  );

  const renderEmptyEvents = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>No past events</Text>
      <Text style={[styles.emptySubtitle, { color: theme.mutedText }]}>Past games and events will appear here</Text>
    </View>
  );

  const onEndReachedPosts = useCallback(() => { if (team?.id) void loadMorePosts(); }, [team?.id, loadMorePosts]);
  const onEndReachedReplies = useCallback(() => { if (team?.id) void loadMoreReplies(); }, [team?.id, loadMoreReplies]);
  const onEndReachedUpvotes = useCallback(() => { if (team?.id) void loadMoreUpvotes(); }, [team?.id, loadMoreUpvotes]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <Stack.Screen options={{ title: 'Team' }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <Stack.Screen options={{ title: 'Team' }} />
        <View style={styles.center}>
          <Text style={[styles.error, { color: theme.text }]}>{error}</Text>
          <Pressable onPress={loadTeam} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!team) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <Stack.Screen options={{ title: 'Team' }} />
        <View style={styles.center}>
          <Text style={[styles.error, { color: theme.text }]}>Team not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen options={{ title: team?.name || 'Team', headerShown: false }} />
      {activeTab === 'posts' ? (
        <FlatList
          data={posts}
          key={`${activeTab}-grid-2cols`}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyPosts}
          contentContainerStyle={{ paddingBottom: Math.max(32, insets.bottom + 16) }}
          onEndReachedThreshold={0.5}
          onEndReached={onEndReachedPosts}
          renderItem={({ item, index }) => {
            const thumb = item.media_url;
            const _isVideo = !!thumb && VIDEO_EXT.test(thumb);
            const likes = item.upvotes_count ?? 0;
            const comments = item.comments_count ?? item?._count?.comments ?? 0;
            return (
              <Pressable
                style={[styles.gridItem, { backgroundColor: theme.card }]}
                onPress={() => {
                  const mapped = (posts || []).map(toFeedPost);
                  const items = mapped.filter(Boolean) as FeedPost[];
                  const targetId = mapped[index]?.id;
                  const targetIdx = targetId ? items.findIndex((p) => p.id === targetId) : index;
                  setViewerItems(items);
                  setViewerIndex(Math.max(0, targetIdx));
                  setViewerOpen(true);
                }}
              >
                {thumb ? (
                  <View style={styles.gridImageContainer}>
                    <Image source={{ uri: thumb }} style={styles.gridImage} contentFit="cover" />
                    <View style={styles.gridImageOverlay} />
                  </View>
                ) : (
                  <View style={[styles.gridImage, styles.gridImageFallback]}>
                    <LinearGradient 
                      colors={["#667eea", "#764ba2", "#f093fb"]} 
                      style={StyleSheet.absoluteFillObject as any} 
                      start={{ x: 0, y: 0 }} 
                      end={{ x: 1, y: 1 }}
                    />
                    <View style={styles.textPostOverlay}>
                      <Text numberOfLines={4} style={styles.gridTextOnly}>{String(item.caption || item.content || '').trim() || 'Post'}</Text>
                    </View>
                  </View>
                )}
                <View style={styles.gridCounts}>
                  <View style={styles.gridCountItem}>
                    <Ionicons name="arrow-up" size={12} color="#fff" />
                    <Text style={styles.gridCountText}>{likes}</Text>
                  </View>
                  <View style={styles.gridCountItem}>
                    <Ionicons name="chatbubble-ellipses" size={12} color="#fff" />
                    <Text style={styles.gridCountText}>{comments}</Text>
                  </View>
                </View>
                <View style={styles.gridIconBadge}>
                  <Ionicons name={thumb ? 'camera-outline' : 'text'} size={14} color="#fff" />
                </View>
              </Pressable>
            );
          }}
          ListFooterComponent={postsLoading ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
        />
      ) : activeTab === 'replies' ? (
        <FlatList
          data={replies}
          key={`${activeTab}-grid-2cols`}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          keyExtractor={(item, index) => {
            const postItem = unwrapPost(item);
            return postItem?.id ?? item?.id ?? `reply-${index}`;
          }}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyReplies}
          contentContainerStyle={{ paddingBottom: Math.max(32, insets.bottom + 16) }}
          onEndReachedThreshold={0.5}
          onEndReached={onEndReachedReplies}
          renderItem={({ item, index }) => {
            const postItem = unwrapPost(item);
            const thumb = postItem?.media_url;
            const _isVideo = !!thumb && VIDEO_EXT.test(thumb);
            const likes = postItem?.upvotes_count ?? 0;
            const comments = postItem?.comments_count ?? postItem?._count?.comments ?? 0;
            return (
              <Pressable
                style={[styles.gridItem, { backgroundColor: theme.card }]}
                onPress={() => {
                  const mapped = (replies || []).map(unwrapPost).map(toFeedPost);
                  const items = mapped.filter(Boolean) as FeedPost[];
                  const targetId = unwrapPost(replies[index])?.id;
                  const targetIdx = targetId ? items.findIndex((p) => p.id === targetId) : index;
                  setViewerItems(items);
                  setViewerIndex(Math.max(0, targetIdx));
                  setViewerOpen(true);
                }}
              >
                {thumb ? (
                  <View style={styles.gridImageContainer}>
                    <Image source={{ uri: thumb }} style={styles.gridImage} contentFit="cover" />
                    <View style={styles.gridImageOverlay} />
                  </View>
                ) : (
                  <View style={[styles.gridImage, styles.gridImageFallback]}>
                    <LinearGradient 
                      colors={["#667eea", "#764ba2", "#f093fb"]} 
                      style={StyleSheet.absoluteFillObject as any} 
                      start={{ x: 0, y: 0 }} 
                      end={{ x: 1, y: 1 }}
                    />
                    <View style={styles.textPostOverlay}>
                      <Text numberOfLines={4} style={styles.gridTextOnly}>{String(postItem?.caption || postItem?.content || '').trim() || 'Post'}</Text>
                    </View>
                  </View>
                )}
                <View style={styles.gridCounts}>
                  <View style={styles.gridCountItem}>
                    <Ionicons name="arrow-up" size={12} color="#fff" />
                    <Text style={styles.gridCountText}>{likes}</Text>
                  </View>
                  <View style={styles.gridCountItem}>
                    <Ionicons name="chatbubble-ellipses" size={12} color="#fff" />
                    <Text style={styles.gridCountText}>{comments}</Text>
                  </View>
                </View>
                <View style={styles.gridIconBadge}>
                  <Ionicons name={thumb ? 'camera-outline' : 'text'} size={14} color="#fff" />
                </View>
              </Pressable>
            );
          }}
          ListFooterComponent={repliesLoading ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
        />
      ) : activeTab === 'upvotes' ? (
        <FlatList
          data={upvotes}
          key={`${activeTab}-grid-2cols`}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          keyExtractor={(item, index) => {
            const postItem = unwrapPost(item);
            return postItem?.id ?? item?.id ?? `upvote-${index}`;
          }}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyUpvotes}
          contentContainerStyle={{ paddingBottom: Math.max(32, insets.bottom + 16) }}
          onEndReachedThreshold={0.5}
          onEndReached={onEndReachedUpvotes}
          renderItem={({ item, index }) => {
            const postItem = unwrapPost(item);
            const thumb = postItem?.media_url;
            const _isVideo = !!thumb && VIDEO_EXT.test(thumb);
            const likes = postItem?.upvotes_count ?? 0;
            const comments = postItem?.comments_count ?? postItem?._count?.comments ?? 0;
            return (
              <Pressable
                style={[styles.gridItem, { backgroundColor: theme.card }]}
                onPress={() => {
                  const mapped = (upvotes || []).map(unwrapPost).map(toFeedPost);
                  const items = mapped.filter(Boolean) as FeedPost[];
                  const targetId = unwrapPost(upvotes[index])?.id;
                  const targetIdx = targetId ? items.findIndex((p) => p.id === targetId) : index;
                  setViewerItems(items);
                  setViewerIndex(Math.max(0, targetIdx));
                  setViewerOpen(true);
                }}
              >
                {thumb ? (
                  <View style={styles.gridImageContainer}>
                    <Image source={{ uri: thumb }} style={styles.gridImage} contentFit="cover" />
                    <View style={styles.gridImageOverlay} />
                  </View>
                ) : (
                  <View style={[styles.gridImage, styles.gridImageFallback]}>
                    <LinearGradient 
                      colors={["#667eea", "#764ba2", "#f093fb"]} 
                      style={StyleSheet.absoluteFillObject as any} 
                      start={{ x: 0, y: 0 }} 
                      end={{ x: 1, y: 1 }}
                    />
                    <View style={styles.textPostOverlay}>
                      <Text numberOfLines={4} style={styles.gridTextOnly}>{String(postItem?.caption || postItem?.content || '').trim() || 'Post'}</Text>
                    </View>
                  </View>
                )}
                <View style={styles.gridCounts}>
                  <View style={styles.gridCountItem}>
                    <Ionicons name="arrow-up" size={12} color="#fff" />
                    <Text style={styles.gridCountText}>{likes}</Text>
                  </View>
                  <View style={styles.gridCountItem}>
                    <Ionicons name="chatbubble-ellipses" size={12} color="#fff" />
                    <Text style={styles.gridCountText}>{comments}</Text>
                  </View>
                </View>
                <View style={styles.gridIconBadge}>
                  <Ionicons name={thumb ? 'camera-outline' : 'text'} size={14} color="#fff" />
                </View>
              </Pressable>
            );
          }}
          ListFooterComponent={upvotesLoading ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
        />
      ) : (
        <FlatList
          data={games.filter(g => {
            const d = (g as any).scheduled_date || g.date;
            return d && new Date(d as string) < new Date();
          })}
          key={`${activeTab}-list`}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyEvents}
          contentContainerStyle={{ paddingBottom: Math.max(32, insets.bottom + 16) }}
          renderItem={({ item }) => {
            const g = item as any;
            const rawDate = g.scheduled_date || g.date;
            const dateStr = rawDate
              ? new Date(rawDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'TBD';
            const opponent = g.opponent_name || g.away_team || g.awayTeam || 'TBD';
            const gameType = g.game_type || 'Game';
            const hasScore = g.home_score != null || g.away_score != null;
            return (
              <View style={[styles.eventRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={[styles.eventDateBadge, { backgroundColor: theme.tint + '22' }]}>
                  <Text style={[styles.eventDate, { color: theme.tint }]}>{dateStr}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.eventTitle, { color: theme.text }]} numberOfLines={1}>vs {opponent}</Text>
                  <Text style={[styles.eventTypeText, { color: theme.mutedText }]}>{gameType}</Text>
                </View>
                {hasScore && (
                  <Text style={[styles.eventScore, { color: theme.text }]}>
                    {g.home_score ?? '-'} - {g.away_score ?? '-'}
                  </Text>
                )}
              </View>
            );
          }}
        />
      )}

      <Modal visible={viewerOpen} animationType="slide" onRequestClose={() => setViewerOpen(false)}>
        <GameVerticalFeedScreen
          onClose={() => setViewerOpen(false)}
          showHeader
          initialPosts={viewerItems}
          startIndex={viewerIndex}
          title={activeTab === 'posts' ? 'Team posts' : activeTab === 'replies' ? 'Team replies' : activeTab === 'upvotes' ? 'Team upvotes' : 'Team events'}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1
  },
  center: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#b91c1c', textAlign: 'center', marginBottom: 16 },
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
  
  // Header Styles - Exact Match to Profile
  headerContainer: {
    position: 'relative',
    width: '100%',
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  headerBackgroundPressable: {
    position: 'relative',
    height: 200,
    width: '100%',
  },
  headerBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    height: 200,
    width: '100%',
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
    height: 200,
  },
  headerControls: {
    position: 'absolute',
    right: 16,
    zIndex: 200,
    elevation: 200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  profileContent: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 0,
    zIndex: 100,
    elevation: 100,
  },
  avatarSection: {
    marginBottom: -50, // Half of 100px avatar hangs below banner
    zIndex: 99999,
    elevation: 99999,
    position: 'relative',
    flexShrink: 0,
  },
  avatarContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 99999,
    backgroundColor: '#ffffff',
    zIndex: 99999,
    overflow: 'visible',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 46,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 46,
    backgroundColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 0,
    flexShrink: 1,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    flexShrink: 1,
    maxWidth: '100%',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    gap: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  teamBadge: { backgroundColor: '#10B981' },
  roleText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  editButtonBelowBanner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#D1D5DB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonBelowBannerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  followButtonBelowBanner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD600',
  },
  followButtonBelowBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.text,
  },
  followingIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileDetailsContainer: {
    backgroundColor: 'transparent',
    paddingTop: 0, // teamHeaderRow handles avatar clearance
    marginBottom: 0,
    paddingBottom: 0,
  },
  teamHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52, // 50px avatar overlap + 2px clearance
    paddingRight: 16,
  },
  teamHeaderSpacer: {
    width: 124, // avatar (100) + border (8) + gap (16)
  },
  teamHeaderInfo: {
    flex: 1,
    minWidth: 0,
  },
  userDetails: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 0,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 12,
  },
  userHandle: {
    fontSize: 15,
    fontWeight: '400',
    flex: 1,
  },
  userBio: {
    fontSize: 15,
    fontWeight: '400',
    marginBottom: 4,
    lineHeight: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '400',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
    gap: 0,
  },
  statNumber: {
    fontSize: 15,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 15,
    fontWeight: '400',
  },
  tabsContainer: { 
    flexDirection: 'row', 
    borderBottomWidth: 1, 
    backgroundColor: 'transparent',
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontWeight: '600', fontSize: 15 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptySubtitle: { textAlign: 'center', marginBottom: 20, fontSize: 15, lineHeight: 22 },
  gridRow: {
    gap: 12,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  gridItem: { 
    flex: 1, 
    aspectRatio: 1, 
    margin: 0,
    borderRadius: 14,
    overflow: 'hidden', 
    backgroundColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  gridImageContainer: { width: '100%', height: '100%', position: 'relative' },
  gridImage: { width: '100%', height: '100%' },
  gridImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  gridImageFallback: { alignItems: 'center', justifyContent: 'center', padding: 12, position: 'relative' },
  textPostOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    margin: 8,
  },
  gridTextOnly: { 
    textAlign: 'center', 
    color: '#ffffff', 
    fontWeight: '700', 
    fontSize: 12, 
    lineHeight: 16,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  },
  gridIconBadge: { 
    position: 'absolute', 
    bottom: 8, 
    right: 8, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    borderRadius: 14, 
    width: 28, 
    height: 28, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2
  },
  gridCounts: { 
    position: 'absolute', 
    left: 8, 
    bottom: 8, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    borderRadius: 14, 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2
  },
  gridCountItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  gridCountText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  eventRow: {
    marginHorizontal: 16,
    marginVertical: 6,
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
  eventDate: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  eventTypeText: {
    fontSize: 13,
  },
  eventScore: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 12,
  },
  orgButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 0,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  orgButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  rosterSection: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 240,
  },
  rosterScroll: { maxHeight: 200 },
  rosterTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  rosterList: {
    gap: 4,
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderBottomWidth: 1,
    gap: 10,
  },
  rosterAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  rosterAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rosterInfo: { flex: 1, minWidth: 0 },
  rosterName: { fontSize: 15, fontWeight: '600' },
  rosterMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  rosterMetaText: { fontSize: 12 },
  rosterRole: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
});

export default TeamScreen;
