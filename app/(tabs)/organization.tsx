import { Organization, Team } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { NavigationHistoryContext } from '@/context/NavigationHistoryContext';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { getCanonicalOrganizationId } from '@/utils/authState';
import { goBackToTrackedRoute } from '@/utils/navigation';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter, useUnstableGlobalHref } from 'expo-router';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type OrganizationData = {
  id: string;
  name?: string;
  display_name?: string;
  description?: string;
  bio?: string;
  background_url?: string;
  logo_url?: string;
  avatar_url?: string;
  created_at?: string;
  contact_info?: string;
  location?: string;
  formatted_address?: string;
  followers_count?: number;
  is_following?: boolean;
  viewer_role?: string | null;
  is_member?: boolean;
  is_owner?: boolean;
  can_edit?: boolean;
  can_manage?: boolean;
  can_review_coaches?: boolean;
};

type TeamItem = {
  id: string;
  name: string;
  sport?: string | null;
  season?: string | null;
  logo_url?: string | null;
  organization_id?: string;
};

type GameItem = {
  id: string;
  date?: string | Date;
  scheduled_date?: string;
  home_team?: string;
  away_team?: string;
  opponent_name?: string;
  location?: string;
  game_type?: string;
  description?: string;
};

type ScheduleStage = {
  label: string;
  games: GameItem[];
};

// Parse the stage label from a game description.
// Seed formats: "FIFA World Cup 2026 — Group A, Match 1. ..."
//               "FIFA World Cup 2026 — Round of 32, Round of 32. ..."
// Take the text after the first " — " and before the first ",".
function parseStageLabel(description?: string): string | null {
  if (!description) return null;
  const dashIdx = description.indexOf(' — ');
  if (dashIdx === -1) return null;
  const afterDash = description.slice(dashIdx + 3);
  const commaIdx = afterDash.indexOf(',');
  const label = (commaIdx === -1 ? afterDash : afterDash.slice(0, commaIdx)).trim();
  return label.length > 0 ? label : null;
}

const CATCH_ALL_STAGE = 'Games';

// Knockout bracket order (earliest round first). Tolerant of common label variants.
const KNOCKOUT_ORDER: { match: (label: string) => boolean }[] = [
  { match: l => /round of 64/i.test(l) },
  { match: l => /round of 32/i.test(l) },
  { match: l => /round of 16/i.test(l) },
  { match: l => /quarter/i.test(l) },
  { match: l => /semi/i.test(l) },
  { match: l => /\bfinal\b/i.test(l) && !/semi|quarter/i.test(l) },
];

function knockoutRank(label: string): number {
  for (let i = 0; i < KNOCKOUT_ORDER.length; i += 1) {
    if (KNOCKOUT_ORDER[i].match(label)) return i;
  }
  return -1;
}

// Order: Group A, B, C… (alphabetical) first; then knockout rounds in bracket
// order; then the catch-all "Games" bucket last.
function stageSortKey(label: string): [number, string | number] {
  if (label === CATCH_ALL_STAGE) return [3, label];
  if (/^group\b/i.test(label)) return [0, label.toLowerCase()];
  const ko = knockoutRank(label);
  if (ko >= 0) return [1, ko];
  return [2, label.toLowerCase()];
}

function gameDate(g: GameItem): number {
  return new Date((g.scheduled_date || g.date) as string).getTime();
}

function groupGamesByStage(games: GameItem[]): ScheduleStage[] {
  const buckets = new Map<string, GameItem[]>();
  for (const game of games) {
    const label = parseStageLabel(game.description) || CATCH_ALL_STAGE;
    const bucket = buckets.get(label);
    if (bucket) bucket.push(game);
    else buckets.set(label, [game]);
  }
  return Array.from(buckets.entries())
    .map(([label, list]) => ({
      label,
      games: list.slice().sort((a, b) => gameDate(a) - gameDate(b)),
    }))
    .sort((a, b) => {
      const [ga, sa] = stageSortKey(a.label);
      const [gb, sb] = stageSortKey(b.label);
      if (ga !== gb) return ga - gb;
      if (typeof sa === 'number' && typeof sb === 'number') return sa - sb;
      return String(sa).localeCompare(String(sb));
    });
}

type AuthorizedInvite = {
  id: string;
  email?: string | null;
  role?: string | null;
  status?: string | null;
};

function buildOrganizationJoinRequestsRoute(id: string, name?: string | null) {
  return {
    pathname: '/organization-join-requests' as const,
    params: {
      organization_id: id,
      organization_name: name || 'Organization',
    },
  };
}

export default function OrganizationScreen() {
  const { user } = useAuth();
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; from?: string; tab?: string }>();
  const navHistory = useContext(NavigationHistoryContext);
  const href = useUnstableGlobalHref();
  const currentHref = typeof href === 'string' ? href : null;
  const backFallback = params.from === 'discover-quick-actions' ? '/(tabs)/discover' : undefined;
  const handleBack = useCallback(() => {
    goBackToTrackedRoute(router, currentHref, navHistory?.getFallbackRoute?.(), backFallback);
  }, [backFallback, currentHref, navHistory, router]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [games, setGames] = useState<GameItem[]>([]);
  const [gamesError, setGamesError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [isOrgOwner, setIsOrgOwner] = useState(false);
  const [canReviewCoachRequests, setCanReviewCoachRequests] = useState(false);
  const [pendingCoachCount, setPendingCoachCount] = useState(0);
  const [pendingCoachError, setPendingCoachError] = useState(false);
  const [pendingAuthorizedInviteCount, setPendingAuthorizedInviteCount] = useState(0);
  const [pendingAuthorizedInvites, setPendingAuthorizedInvites] = useState<AuthorizedInvite[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  const mounted = useRef(true);
  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadOrganization = useCallback(async () => {
    if (!mounted.current || !user) return;
    setError(null);
    setGamesError(false);
    try {
      let orgId = params.id?.trim();

      // Fallback: if no orgId in params, look up the user's org from the server
      if (
        !orgId ||
        orgId === 'undefined' ||
        orgId === 'null' ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(orgId)
      ) {
        try {
          const summaries = await Organization.reviewSummaries();
          const firstOrg = Array.isArray(summaries) ? summaries[0]?.organization : null;
          if (firstOrg?.id) {
            orgId = firstOrg.id;
          } else {
            // Coaches who joined via request have role='member' — mine() won't return their org.
            // Fall back to the org ID stored in their preferences during onboarding.
            orgId = getCanonicalOrganizationId(user as any) || undefined;
          }
          if (!orgId) {
            if (mounted.current) {
              setError('not_found');
              setLoading(false);
            }
            return;
          }
        } catch {
          orgId = getCanonicalOrganizationId(user as any) || undefined;
          if (orgId) {
            // fall through and load via canonical auth snapshot
          } else {
            if (mounted.current) {
              setError('not_found');
              setLoading(false);
            }
            return;
          }
        }
      }

      let orgData: OrganizationData | null = null;
      try {
        orgData = await Organization.get(orgId as string);
        if (!mounted.current) return;
        setOrganization(orgData);
        setIsFollowing(!!(orgData as any).is_following);
      } catch (err: any) {
        if (!mounted.current) return;
        if (__DEV__) console.error('[organization] Failed to load organization data:', err);
        const errMsg = err?.message || 'Failed to load organization';
        // Surface the error rather than showing a blank page
        if (mounted.current) {
          setError(errMsg.toLowerCase().includes('not found') ? 'not_found' : errMsg);
          setLoading(false);
        }
        return;
      }

      const ownerAccess =
        (orgData as any)?.can_edit === true || (orgData as any)?.is_owner === true;
      const adminAccess = (orgData as any)?.can_manage === true || ownerAccess;
      const reviewCoachAccess =
        (orgData as any)?.can_review_coaches === true || (orgData as any)?.is_owner === true;
      if (mounted.current) {
        setIsOrgAdmin(adminAccess);
        setIsOrgOwner(ownerAccess);
        setCanReviewCoachRequests(reviewCoachAccess);
      }
      if (adminAccess) {
        Organization.adminSummary(orgId as string)
          .then((summary: any) => {
            if (!mounted.current) return;
            setPendingCoachError(false);
            setPendingCoachCount(Number(summary?.counts?.pending_coach_requests || 0));
            setPendingAuthorizedInviteCount(
              Number(summary?.counts?.pending_authorized_invites || 0)
            );
            setPendingAuthorizedInvites(
              Array.isArray(summary?.requests?.authorized_invites)
                ? (summary.requests.authorized_invites as AuthorizedInvite[])
                : []
            );
          })
          .catch(() => {
            if (!mounted.current) return;
            setPendingCoachError(true);
            setPendingCoachCount(0);
            setPendingAuthorizedInviteCount(0);
            setPendingAuthorizedInvites([]);
          });
      } else if (mounted.current) {
        setIsOrgAdmin(false);
        setCanReviewCoachRequests(false);
        setPendingCoachCount(0);
        setPendingCoachError(false);
        setPendingAuthorizedInviteCount(0);
        setPendingAuthorizedInvites([]);
      }

      let allTeams: any[] = [];
      try {
        allTeams = await Team.list(undefined, undefined, {
          organization_id: orgId as string,
          limit: 100,
        });
      } catch (err: any) {
        if (__DEV__) console.error('[organization] Failed to load teams list:', err);
        allTeams = [];
      }

      if (!mounted.current) return;

      const orgTeams: TeamItem[] = allTeams
        .map((t: any) => ({
          id: String(t.id),
          name: t.name || 'Team',
          sport: t.sport || null,
          season: t.season || null,
          logo_url: t.logo_url || t.avatar_url || null,
          organization_id: t.organization_id,
        }))
        .sort((a: TeamItem, b: TeamItem) => a.name.localeCompare(b.name));
      setTeams(orgTeams);

      try {
        const orgGamesData = await Organization.games(orgId as string);
        if (!mounted.current) return;
        const rawGames = Array.isArray(orgGamesData) ? orgGamesData : orgGamesData?.games || [];
        const orgGames: GameItem[] = rawGames
          .map((g: any) => ({
            id: String(g.id),
            date: g.date,
            scheduled_date: g.scheduled_date,
            home_team: g.home_team,
            away_team: g.away_team,
            opponent_name: g.opponent_name,
            location: g.location,
            game_type: g.game_type,
            description: g.description,
          }))
          .sort((a: GameItem, b: GameItem) => gameDate(a) - gameDate(b));
        setGames(orgGames);
        setGamesError(false);
      } catch (err: any) {
        if (__DEV__) console.error('[organization] Failed to load games:', err);
        if (mounted.current) {
          setGames([]);
          setGamesError(true);
        }
      }
    } catch (err: any) {
      if (!mounted.current) return;
      if (__DEV__) console.error('[organization] Failed to load organization:', err);
      setError(err?.message || 'Failed to load organization data');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [params.id, user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrganization();
    setRefreshing(false);
  }, [loadOrganization]);

  useEffect(() => {
    void loadOrganization();
  }, [loadOrganization]);

  const handleTeamPress = (team: TeamItem) => {
    router.push({ pathname: '/team-page', params: { id: team.id, name: team.name } });
  };

  const handleGamePress = (game: GameItem) => {
    router.push({ pathname: '/game/[id]', params: { id: game.id } });
  };

  const formatEventDate = (dateValue?: string | Date | null): string => {
    if (!dateValue) return 'TBD';
    try {
      const date = new Date(dateValue as string);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const daysDiff = Math.floor((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff === 0) return 'Today';
      if (daysDiff === 1) return 'Tomorrow';
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    } catch {
      return String(dateValue);
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      </SafeAreaView>
    );
  }

  if (error === 'not_found') {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <View style={styles.errorContainer}>
          <Ionicons
            name="business"
            size={48}
            color={theme.mutedText}
            style={{ marginBottom: 12 }}
          />
          <Text style={[styles.errorText, { color: theme.text, fontSize: 18, fontWeight: '600' }]}>
            Not Found
          </Text>
          <Text
            style={{ color: theme.mutedText, textAlign: 'center', marginTop: 4, marginBottom: 16 }}
          >
            This organization doesn't exist or the link is invalid.
          </Text>
          <Pressable
            onPress={handleBack}
            style={[styles.retryButton, { backgroundColor: theme.tint }]}
          >
            <Text style={styles.retryText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
          <Pressable
            onPress={loadOrganization}
            style={[styles.retryButton, { backgroundColor: theme.tint }]}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const orgName = organization?.display_name || organization?.name || 'Organization';
  const handle = orgName.replace(/\s+/g, '').toLowerCase();
  const orgBio = organization?.bio || organization?.description || null;
  const contactText = organization?.contact_info?.trim() || null;
  const locationText = organization?.formatted_address || organization?.location || null;

  const handleLocationPress = () => {
    if (!locationText) return;
    const query = encodeURIComponent(locationText);
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      default: `https://maps.google.com/?q=${query}`,
    });
    void Linking.openURL(url).catch(() => {
      void Linking.openURL(`https://maps.google.com/?q=${query}`);
    });
  };
  const scheduleStages = groupGamesByStage(games);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen options={{ title: orgName, headerShown: false }} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.tint}
            colors={[theme.tint]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button */}
        <Pressable onPress={handleBack} style={[styles.backButton, { borderColor: theme.border }]}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>

        {/* Admin: View Join Requests */}
        {organization?.id && (canReviewCoachRequests || isOrgAdmin) && (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            {canReviewCoachRequests ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/organization-join-requests',
                    params: {
                      organization_id: organization.id,
                      organization_name: organization.name || orgName,
                    },
                  })
                }
                style={[styles.adminButton, { backgroundColor: theme.tint, flex: 1 }]}
              >
                <Ionicons name="people" size={20} color="#fff" />
                <Text style={styles.adminButtonText}>Coach Requests</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                setInviteEmail('');
                setInviteModalVisible(true);
              }}
              style={[
                styles.adminButton,
                {
                  backgroundColor: theme.card,
                  borderWidth: 1,
                  borderColor: theme.border,
                  flex: canReviewCoachRequests ? 1 : undefined,
                },
              ]}
            >
              <Ionicons name="person-add-outline" size={20} color={theme.text} />
              <Text style={[styles.adminButtonText, { color: theme.text }]}>Invite Coach</Text>
            </Pressable>
          </View>
        )}

        {/* Cover Image */}
        <View
          style={[
            styles.card,
            styles.coverCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          {organization?.background_url ? (
            <Image
              source={{ uri: organization.background_url }}
              style={styles.coverImage}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.coverPlaceholder, { borderColor: theme.border }]}>
              <Ionicons name="business-outline" size={28} color={theme.mutedText} />
              <Text style={[styles.placeholderText, { color: theme.mutedText }]}>
                No cover image
              </Text>
            </View>
          )}
        </View>

        {/* Profile Card */}
        <View
          style={[
            styles.card,
            styles.profileCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={[styles.avatarShell, { borderColor: theme.border }]}>
            {organization?.avatar_url || organization?.logo_url ? (
              <Image
                source={{ uri: String(organization.avatar_url || organization.logo_url) }}
                style={styles.avatarImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: theme.surface }]}>
                <Ionicons name="business" size={28} color={theme.mutedText} />
              </View>
            )}
          </View>
          <View style={styles.profileText}>
            <Text style={[styles.profileName, { color: theme.text }]}>{orgName}</Text>
            <Text style={[styles.profileHandle, { color: theme.mutedText }]}>@{handle}</Text>
            <View style={styles.statsRow}>
              <Text style={[styles.statNumber, { color: theme.text }]}>{teams.length}</Text>
              <Text style={[styles.statLabel, { color: theme.mutedText }]}> Teams </Text>
              <Text style={[styles.statNumber, { color: theme.text }]}>
                {organization?.followers_count ?? 0}
              </Text>
              <Text style={[styles.statLabel, { color: theme.mutedText }]}> Followers</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          {isOrgOwner ? (
            <Pressable
              style={[
                styles.actionBtn,
                { flex: 1, backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 },
              ]}
              onPress={() =>
                router.push({
                  pathname: '/edit-organization',
                  params: {
                    id: organization?.id,
                    fallback: organization?.id
                      ? `/organization?id=${encodeURIComponent(organization.id)}&tab=overview`
                      : '/organization?tab=overview',
                  },
                })
              }
            >
              <Ionicons name="pencil-outline" size={16} color={theme.text} />
              <Text style={[styles.actionBtnText, { color: theme.text }]}>Edit Profile</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                style={[
                  styles.actionBtn,
                  {
                    flex: 1,
                    backgroundColor: isFollowing ? theme.tint : 'transparent',
                    borderColor: theme.tint,
                    borderWidth: 1,
                  },
                ]}
                disabled={followBusy}
                onPress={async () => {
                  if (!organization?.id || followBusy) return;
                  setFollowBusy(true);
                  try {
                    if (isFollowing) {
                      await Organization.unfollow(organization.id);
                      setIsFollowing(false);
                      setOrganization(prev =>
                        prev
                          ? {
                              ...prev,
                              followers_count: Math.max(0, (prev.followers_count ?? 0) - 1),
                            }
                          : null
                      );
                    } else {
                      await Organization.follow(organization.id);
                      setIsFollowing(true);
                      setOrganization(prev =>
                        prev ? { ...prev, followers_count: (prev.followers_count ?? 0) + 1 } : null
                      );
                    }
                  } catch (err) {
                    if (__DEV__) console.error('Organization follow/unfollow failed:', err);
                    Alert.alert('Error', 'Failed to update follow status. Please try again.');
                  } finally {
                    setFollowBusy(false);
                  }
                }}
              >
                <Ionicons
                  name={isFollowing ? 'checkmark' : 'add'}
                  size={16}
                  color={isFollowing ? '#fff' : theme.tint}
                />
                <Text style={[styles.actionBtnText, { color: isFollowing ? '#fff' : theme.tint }]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Pending Coaches Quick Action */}
        {canReviewCoachRequests && pendingCoachError && organization?.id && (
          <Pressable
            style={[
              styles.card,
              styles.sectionCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              },
            ]}
            onPress={() =>
              router.push(
                buildOrganizationJoinRequestsRoute(organization.id, organization.name || orgName)
              )
            }
          >
            <MaterialIcons name="error-outline" size={24} color={theme.destructive} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, color: theme.destructive, fontWeight: '600' }}>
                Could not load pending coaches
              </Text>
              <Text style={{ fontSize: 12, color: theme.mutedText, marginTop: 2 }}>
                Tap to open approvals
              </Text>
            </View>
          </Pressable>
        )}
        {canReviewCoachRequests && pendingCoachCount > 0 && organization?.id && (
          <Pressable
            style={[
              styles.card,
              styles.sectionCard,
              {
                backgroundColor: colorScheme === 'dark' ? 'rgba(245,158,11,0.12)' : '#FEF9C3',
                borderColor: colorScheme === 'dark' ? 'rgba(245,158,11,0.35)' : '#DAA520',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              },
            ]}
            onPress={() =>
              router.push(
                buildOrganizationJoinRequestsRoute(organization.id, organization.name || orgName)
              )
            }
          >
            <MaterialIcons
              name="group-add"
              size={24}
              color={colorScheme === 'dark' ? '#FCD34D' : '#DAA520'}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: colorScheme === 'dark' ? '#FDE68A' : '#92400E',
                }}
              >
                {pendingCoachCount} coach{pendingCoachCount !== 1 ? 'es' : ''} pending approval
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colorScheme === 'dark' ? '#FCD34D' : '#A16207',
                  marginTop: 2,
                }}
              >
                Tap to review requests
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colorScheme === 'dark' ? '#FCD34D' : '#DAA520'}
            />
          </Pressable>
        )}

        {isOrgAdmin && (
          <View
            style={[
              styles.card,
              styles.sectionCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Authorized Invites</Text>
              <Text style={[styles.metaText, { color: theme.mutedText }]}>
                {pendingAuthorizedInviteCount || pendingAuthorizedInvites.length} pending
              </Text>
            </View>
            {pendingAuthorizedInvites.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.mutedText }]}>
                No pending authorized invites.
              </Text>
            ) : (
              pendingAuthorizedInvites.map(invite => (
                <View
                  key={invite.id}
                  style={[
                    styles.rowItem,
                    { borderColor: theme.border, justifyContent: 'space-between' },
                  ]}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                      {invite.email || 'Pending invite'}
                    </Text>
                    <Text
                      style={[styles.rowSubtitle, { color: theme.mutedText }]}
                      numberOfLines={1}
                    >
                      {String(invite.role || 'member').replace(/_/g, ' ')}
                    </Text>
                  </View>
                  <Pressable
                    onPress={async () => {
                      if (!organization?.id) return;
                      try {
                        await Organization.cancelInvite(organization.id, invite.id);
                        await loadOrganization();
                      } catch (err: any) {
                        Alert.alert('Error', err?.message || 'Failed to cancel invite.');
                      }
                    }}
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: 'transparent',
                        borderColor: theme.border,
                        borderWidth: 1,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        minHeight: 0,
                      },
                    ]}
                  >
                    <Text style={[styles.actionBtnText, { color: theme.text }]}>Cancel</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}

        {/* About */}
        <View
          style={[
            styles.card,
            styles.sectionCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>About</Text>
          {orgBio ? <Text style={[styles.bioText, { color: theme.text }]}>{orgBio}</Text> : null}
          {contactText && (
            <View style={[styles.contactRow, { borderColor: theme.border }]}>
              <Ionicons name="mail-outline" size={16} color={theme.mutedText} />
              <Text style={[styles.contactText, { color: theme.mutedText }]} selectable>
                {contactText}
              </Text>
            </View>
          )}
          {organization?.created_at && (
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={14} color={theme.mutedText} />
              <Text style={[styles.metaText, { color: theme.mutedText }]}>
                Created{' '}
                {new Date(organization.created_at).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>
          )}
        </View>

        {/* Location */}
        {locationText ? (
          <View
            style={[
              styles.card,
              styles.sectionCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Location</Text>
            <Pressable
              onPress={handleLocationPress}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Ionicons name="location-outline" size={16} color={theme.tint} />
              <Text style={{ color: theme.tint }}>{locationText}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Teams */}
        <View
          style={[
            styles.card,
            styles.sectionCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Teams</Text>
          {teams.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.mutedText }]}>No teams yet.</Text>
          ) : (
            teams.map(team => {
              const subline = [team.sport, team.season].filter(Boolean).join(' • ');
              return (
                <Pressable
                  key={team.id}
                  style={[styles.rowItem, { borderColor: theme.border }]}
                  onPress={() => handleTeamPress(team)}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                      {team.name}
                    </Text>
                    {subline.length > 0 && (
                      <Text
                        style={[styles.rowSubtitle, { color: theme.mutedText }]}
                        numberOfLines={1}
                      >
                        {subline}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.mutedText} />
                </Pressable>
              );
            })
          )}
        </View>

        {/* Schedule — read-only, grouped by tournament stage */}
        <View
          style={[
            styles.card,
            styles.sectionCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Schedule</Text>
          {gamesError ? (
            <Text style={[styles.emptyText, { color: theme.mutedText }]}>
              Could not load the schedule.
            </Text>
          ) : scheduleStages.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.mutedText }]}>No games yet.</Text>
          ) : (
            scheduleStages.map(stage => (
              <View key={stage.label} style={{ gap: 8 }}>
                <Text style={[styles.stageHeading, { color: theme.mutedText }]}>{stage.label}</Text>
                {stage.games.map(game => {
                  const dateStr = formatEventDate(game.scheduled_date || game.date);
                  const home = game.home_team || 'TBD';
                  const away = game.away_team || game.opponent_name || 'TBD';
                  return (
                    <Pressable
                      key={game.id}
                      style={[styles.rowItem, { borderColor: theme.border }]}
                      onPress={() => handleGamePress(game)}
                    >
                      <View style={[styles.eventIconContainer, { backgroundColor: theme.surface }]}>
                        <Ionicons name="football-outline" size={20} color={theme.tint} />
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                          {home} vs {away}
                        </Text>
                        <View style={styles.eventMetaRow}>
                          <Text style={[styles.rowSubtitle, { color: theme.mutedText }]}>
                            {dateStr}
                          </Text>
                          {game.location && (
                            <>
                              <Text style={[styles.rowSubtitle, { color: theme.mutedText }]}>
                                {' '}
                                •{' '}
                              </Text>
                              <Text
                                style={[styles.rowSubtitle, { color: theme.mutedText }]}
                                numberOfLines={1}
                              >
                                {game.location}
                              </Text>
                            </>
                          )}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={theme.mutedText} />
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}
        </View>
      </ScrollView>
      {/* Invite Coach Modal — replaces iOS-only Alert.prompt */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setInviteModalVisible(false)}>
          <Pressable
            style={[styles.modalContent, { backgroundColor: theme.card }]}
            onPress={() => {}}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>Invite Coach</Text>
            <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>
              Enter the email address of the coach to invite:
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
              ]}
              placeholder="coach@example.com"
              placeholderTextColor={theme.mutedText}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, { borderColor: theme.border }]}
                onPress={() => setInviteModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.mutedText }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, { backgroundColor: theme.tint }]}
                onPress={async () => {
                  if (!inviteEmail.trim() || !organization) return;
                  try {
                    await Organization.invite(organization.id, inviteEmail.trim(), 'member');
                    setInviteModalVisible(false);
                    await loadOrganization();
                    Alert.alert('Invited', `Invitation sent to ${inviteEmail.trim()}`);
                  } catch (err: any) {
                    Alert.alert(
                      'Error',
                      err?.data?.error || err?.message || 'Failed to send invite'
                    );
                  }
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>Send Invite</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
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
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  adminButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
  },
  coverCard: {
    height: 160,
    overflow: 'hidden',
    padding: 0,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderText: {
    fontSize: 13,
    fontWeight: '500',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
  },
  avatarShell: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
  },
  profileHandle: {
    fontSize: 14,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  statNumber: {
    fontSize: 14,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '400',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    minHeight: 40,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionCard: {
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  stageHeading: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  contactText: {
    fontSize: 14,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  metaText: {
    fontSize: 13,
  },
  emptyText: {
    fontSize: 14,
  },
  rowItem: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  eventIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modalButtonText: { fontSize: 16, fontWeight: '600' },
});
