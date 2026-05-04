import { Organization } from '@/api/entities';
import { httpPut } from '@/api/http';
import CoachAccessRedirecting from '@/components/CoachAccessRedirecting';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { safeGoBack } from '@/utils/navigation';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type OrganizationTab = 'overview' | 'teams' | 'requests' | 'members';

type SummaryTeam = {
  id: string;
  name: string;
  sport?: string | null;
  season?: string | null;
  status?: string | null;
  avatar_url?: string | null;
  logo_url?: string | null;
  members_count?: number;
  followers_count?: number;
};

type SummaryMember = {
  id: string;
  role: string;
  status: string;
  created_at?: string;
  user?: {
    id?: string;
    display_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    is_parent?: boolean;
  };
};

type CoachRequest = {
  id: string;
  message?: string | null;
  created_at?: string;
  user?: {
    id: string;
    display_name?: string | null;
    username?: string | null;
    approval_status?: string | null;
  };
};

type AuthorizedInvite = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at?: string;
};

type ReviewItem = {
  id: string;
  title?: string | null;
  date?: string;
  location?: string | null;
  event_type?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  creator?: {
    id?: string;
    display_name?: string | null;
    username?: string | null;
  };
  created_by?: {
    id?: string;
    display_name?: string | null;
    username?: string | null;
  };
};

type AdminSummary = {
  organization: {
    id: string;
    name: string;
    description?: string | null;
    background_url?: string | null;
    logo_url?: string | null;
    avatar_url?: string | null;
    formatted_address?: string | null;
    location?: string | null;
    followers_count?: number;
  };
  permissions: {
    can_manage: boolean;
    can_review_coach_requests: boolean;
    membership_role?: string | null;
    is_platform_admin?: boolean;
  };
  counts: {
    teams: number;
    members: number;
    followers: number;
    pending_authorized_invites: number;
    pending_coach_requests: number;
    pending_game_reviews: number;
    pending_event_reviews: number;
    upcoming_games: number;
    upcoming_events: number;
  };
  teams: SummaryTeam[];
  members: SummaryMember[];
  requests: {
    authorized_invites: AuthorizedInvite[];
    coach_requests: CoachRequest[];
    pending_games: ReviewItem[];
    pending_events: ReviewItem[];
  };
  upcoming: {
    games: ReviewItem[];
    events: ReviewItem[];
  };
};

type PublicOrganization = {
  id: string;
  name?: string;
  display_name?: string;
  description?: string | null;
  bio?: string | null;
  formatted_address?: string | null;
  location?: string | null;
  teams?: SummaryTeam[] | null;
  followers_count?: number;
  members_count?: number;
  teams_count?: number;
};

type ApiErrorLike = {
  message?: string;
  status?: number;
  response?: {
    status?: number;
  };
};

const TABS: Array<{ key: OrganizationTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'teams', label: 'Teams' },
  { key: 'requests', label: 'Requests' },
  { key: 'members', label: 'Members' },
];

function isValidTab(value: string | string[] | undefined): value is OrganizationTab {
  return value === 'overview' || value === 'teams' || value === 'requests' || value === 'members';
}

function formatDate(value?: string | null): string {
  if (!value) return 'TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function labelRole(role?: string | null): string {
  const normalized = String(role || '').replace(/_/g, ' ').trim();
  if (!normalized) return 'Member';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export default function OrganizationScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; tab?: string }>();
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<OrganizationTab>(
    isValidTab(params.tab) ? params.tab : 'overview'
  );
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [publicOrg, setPublicOrg] = useState<PublicOrganization | null>(null);
  const [resolvedOrgId, setResolvedOrgId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'member'>('member');

  useEffect(() => {
    if (isValidTab(params.tab)) {
      setActiveTab(params.tab);
    }
  }, [params.tab]);

  const resolveOrgId = useCallback(async (): Promise<string | null> => {
    const directId = typeof params.id === 'string' ? params.id.trim() : '';
    if (directId) return directId;

    try {
      const summaries = await Organization.reviewSummaries();
      if (Array.isArray(summaries) && summaries[0]?.organization?.id) {
        return String(summaries[0].organization.id);
      }
    } catch {
      // Fall through to preferences-based org resolution.
    }

    const fallbackId = user?.preferences?.organization_id;
    return typeof fallbackId === 'string' && fallbackId.trim().length > 0 ? fallbackId : null;
  }, [params.id, user?.preferences?.organization_id]);

  const loadOrganization = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setError('Unauthorized');
      return;
    }

    setError(null);
    const orgId = await resolveOrgId();
    setResolvedOrgId(orgId);

    if (!orgId) {
      setSummary(null);
      setPublicOrg(null);
      setLoading(false);
      setError('not_found');
      return;
    }

    try {
      const adminSummary = (await Organization.adminSummary(orgId)) as AdminSummary;
      setSummary(adminSummary);
      setPublicOrg(null);
      setError(null);
    } catch (error: unknown) {
      const adminErr = error as ApiErrorLike;
      const status = adminErr?.status || adminErr?.response?.status;
      if (status !== 403) {
        const message = String(adminErr?.message || '').toLowerCase();
        if (!message.includes('organization') && !message.includes('not found')) {
          setError(adminErr?.message || 'Failed to load organization tools');
          setSummary(null);
          setPublicOrg(null);
          setLoading(false);
          return;
        }
      }

      try {
        const org = (await Organization.get(orgId)) as PublicOrganization;
        setPublicOrg(org);
        setSummary(null);
        setError(null);
      } catch (error: unknown) {
        const publicErr = error as ApiErrorLike;
        setSummary(null);
        setPublicOrg(null);
        setError(String(publicErr?.message || '').toLowerCase().includes('not found') ? 'not_found' : (publicErr?.message || 'Failed to load organization'));
      }
    } finally {
      setLoading(false);
    }
  }, [resolveOrgId, user]);

  useEffect(() => {
    void loadOrganization();
  }, [loadOrganization]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrganization();
    setRefreshing(false);
  }, [loadOrganization]);

  const handleApproveCoach = useCallback(
    async (request: CoachRequest) => {
      if (!resolvedOrgId || !request.user?.id || actingId) return;
      setActingId(request.id);
      try {
        await Organization.approveCoach(resolvedOrgId, request.user.id);
        await loadOrganization();
      } catch (error: unknown) {
        const err = error as ApiErrorLike;
        Alert.alert('Unable to approve coach', err?.message || 'Please try again.');
      } finally {
        setActingId(null);
      }
    },
    [actingId, loadOrganization, resolvedOrgId]
  );

  const handleRejectCoach = useCallback(
    async (request: CoachRequest) => {
      if (!resolvedOrgId || !request.user?.id || actingId) return;
      Alert.alert(
        'Reject coach request',
        `Reject ${request.user.display_name || request.user.username || 'this coach'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reject',
            style: 'destructive',
            onPress: async () => {
              setActingId(request.id);
              try {
                await Organization.rejectCoach(resolvedOrgId, request.user!.id);
                await loadOrganization();
              } catch (error: unknown) {
                const err = error as ApiErrorLike;
                Alert.alert('Unable to reject coach', err?.message || 'Please try again.');
              } finally {
                setActingId(null);
              }
            },
          },
        ]
      );
    },
    [actingId, loadOrganization, resolvedOrgId]
  );

  const handleReview = useCallback(
    async (item: ReviewItem, kind: 'event' | 'game', action: 'approve' | 'reject') => {
      if (actingId) return;
      setActingId(`${kind}:${item.id}:${action}`);
      try {
        if (kind === 'game') {
          await httpPut(`/games/${encodeURIComponent(item.id)}/approve`, {
            approval_status: action === 'approve' ? 'approved' : 'rejected',
          });
        } else {
          await httpPut(`/events/${encodeURIComponent(item.id)}/${action}`, {});
        }
        await loadOrganization();
      } catch (error: unknown) {
        const err = error as ApiErrorLike;
        Alert.alert(
          `Unable to ${action} ${kind}`,
          err?.message || `Please try again.`
        );
      } finally {
        setActingId(null);
      }
    },
    [actingId, loadOrganization]
  );

  const handleInviteAuthorizedUser = useCallback(async () => {
    const orgId = resolvedOrgId || summary?.organization.id || null;
    const trimmedEmail = inviteEmail.trim().toLowerCase();
    if (!orgId || !trimmedEmail || actingId) return;

    setActingId(`invite:${trimmedEmail}`);
    try {
      await Organization.invite(orgId, trimmedEmail, inviteRole);
      setInviteEmail('');
      setInviteRole('member');
      setInviteModalVisible(false);
      await loadOrganization();
      Alert.alert('Invite sent', `An organization invite was sent to ${trimmedEmail}.`);
    } catch (error: unknown) {
      const err = error as ApiErrorLike;
      Alert.alert('Unable to send invite', err?.message || 'Please try again.');
    } finally {
      setActingId(null);
    }
  }, [actingId, inviteEmail, inviteRole, loadOrganization, resolvedOrgId, summary?.organization.id]);

  const handleCancelAuthorizedInvite = useCallback(
    async (invite: AuthorizedInvite) => {
      const orgId = resolvedOrgId || summary?.organization.id || null;
      if (!orgId || actingId) return;

      Alert.alert(
        'Cancel invite',
        `Cancel the pending invite for ${invite.email}?`,
        [
          { text: 'Keep', style: 'cancel' },
          {
            text: 'Cancel Invite',
            style: 'destructive',
            onPress: async () => {
              setActingId(`authorized-invite:${invite.id}`);
              try {
                await Organization.cancelInvite(orgId, invite.id);
                await loadOrganization();
              } catch (error: unknown) {
                const err = error as ApiErrorLike;
                Alert.alert('Unable to cancel invite', err?.message || 'Please try again.');
              } finally {
                setActingId(null);
              }
            },
          },
        ]
      );
    },
    [actingId, loadOrganization, resolvedOrgId, summary?.organization.id]
  );

  const counts = summary?.counts;
  const locationText =
    summary?.organization.formatted_address ||
    summary?.organization.location ||
    publicOrg?.formatted_address ||
    publicOrg?.location ||
    null;
  const orgName =
    summary?.organization.name ||
    publicOrg?.display_name ||
    publicOrg?.name ||
    'Organization';
  const orgDescription =
    summary?.organization.description || publicOrg?.bio || publicOrg?.description || null;

  const requestsTotal = useMemo(() => {
    if (!counts) return 0;
    return (
      counts.pending_coach_requests +
      counts.pending_event_reviews +
      counts.pending_game_reviews
    );
  }, [counts]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      </SafeAreaView>
    );
  }

  if (error === 'not_found') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.centered}>
          <Ionicons name="business-outline" size={40} color={theme.mutedText} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Organization not found</Text>
          <Pressable
            onPress={() => safeGoBack(router, '/(tabs)')}
            style={[styles.primaryButton, { backgroundColor: theme.tint }]}
          >
            <Text style={styles.primaryButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.centered}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>{error}</Text>
          <Pressable
            onPress={() => void loadOrganization()}
            style={[styles.primaryButton, { backgroundColor: theme.tint }]}
          >
            <Text style={styles.primaryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!summary && publicOrg) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.headerRow}>
            <Pressable onPress={() => safeGoBack(router, '/(tabs)')} hitSlop={12}>
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Pressable>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
                {orgName}
              </Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.orgName, { color: theme.text }]}>{orgName}</Text>
            <Text style={[styles.metaText, { color: theme.mutedText }]}>
              Organization tools require owner or manager access.
            </Text>
            {orgDescription ? (
              <Text style={[styles.description, { color: theme.text }]}>{orgDescription}</Text>
            ) : null}
            {locationText ? (
              <View style={styles.inlineRow}>
                <Ionicons name="location-outline" size={16} color={theme.mutedText} />
                <Text style={[styles.metaText, { color: theme.mutedText }]}>{locationText}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.statsGrid}>
            <StatCard label="Teams" value={publicOrg.teams_count || publicOrg.teams?.length || 0} theme={theme} />
            <StatCard label="Members" value={publicOrg.members_count || 0} theme={theme} />
            <StatCard label="Followers" value={publicOrg.followers_count || 0} theme={theme} />
          </View>

          <SectionCard title="Teams" theme={theme}>
            {(publicOrg.teams || []).map(team => (
              <Pressable
                key={team.id}
                onPress={() => router.push({ pathname: '/team-page', params: { id: team.id } })}
                style={[styles.listRow, { borderColor: theme.border }]}
              >
                <View style={styles.listGrow}>
                  <Text style={[styles.listTitle, { color: theme.text }]}>{team.name}</Text>
                  {!!team.sport && (
                    <Text style={[styles.metaText, { color: theme.mutedText }]}>{team.sport}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.mutedText} />
              </Pressable>
            ))}
          </SectionCard>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!summary) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <CoachAccessRedirecting
          backgroundColor={theme.background}
          spinnerColor={theme.tint}
          textColor={theme.mutedText}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => safeGoBack(router, '/(tabs)')} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
              Organization Tools
            </Text>
          </View>
          <Pressable
            onPress={() =>
              router.push({ pathname: '/edit-organization', params: { id: summary.organization.id } })
            }
            hitSlop={12}
          >
            <MaterialIcons name="edit" size={22} color={theme.text} />
          </Pressable>
        </View>

        <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.orgName, { color: theme.text }]}>{orgName}</Text>
          <Text style={[styles.metaText, { color: theme.mutedText }]}>
            {labelRole(summary.permissions.membership_role)} access
          </Text>
          {orgDescription ? (
            <Text style={[styles.description, { color: theme.text }]}>{orgDescription}</Text>
          ) : null}
          {locationText ? (
            <View style={styles.inlineRow}>
              <Ionicons name="location-outline" size={16} color={theme.mutedText} />
              <Text style={[styles.metaText, { color: theme.mutedText }]}>{locationText}</Text>
            </View>
          ) : null}
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => router.push({ pathname: '/organizations/[id]', params: { id: summary.organization.id } })}
              style={[styles.secondaryButton, { borderColor: theme.border }]}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Public Page</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/create-team')}
              style={[styles.primaryButton, { backgroundColor: theme.tint }]}
            >
              <Text style={styles.primaryButtonText}>New Team</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Teams" value={counts?.teams || 0} theme={theme} />
          <StatCard label="Members" value={counts?.members || 0} theme={theme} />
          <StatCard label="Requests" value={requestsTotal} theme={theme} />
          <StatCard label="Followers" value={counts?.followers || 0} theme={theme} />
        </View>

        <View style={[styles.tabsRow, { borderColor: theme.border }]}>
          {TABS.map(tab => {
            const selected = tab.key === activeTab;
            const badgeValue =
              tab.key === 'requests'
                ? requestsTotal
                : tab.key === 'teams'
                  ? counts?.teams || 0
                  : tab.key === 'members'
                    ? counts?.members || 0
                    : 0;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tabButton,
                  {
                    backgroundColor: selected ? theme.tint : theme.card,
                    borderColor: selected ? theme.tint : theme.border,
                  },
                ]}
              >
                <Text style={[styles.tabLabel, { color: selected ? '#fff' : theme.text }]}>
                  {tab.label}
                </Text>
                {badgeValue > 0 ? (
                  <View
                    style={[
                      styles.tabBadge,
                      { backgroundColor: selected ? 'rgba(255,255,255,0.22)' : theme.surface },
                    ]}
                  >
                    <Text style={[styles.tabBadgeText, { color: selected ? '#fff' : theme.text }]}>
                      {badgeValue}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'overview' ? (
          <>
            <SectionCard title="Upcoming Games" theme={theme}>
              {summary.upcoming.games.length === 0 ? (
                <EmptyCopy text="No upcoming games loaded for this organization." theme={theme} />
              ) : (
                summary.upcoming.games.map(game => (
                  <Pressable
                    key={game.id}
                    onPress={() => router.push({ pathname: '/game/[id]', params: { id: game.id } })}
                    style={[styles.listRow, { borderColor: theme.border }]}
                  >
                    <View style={styles.listGrow}>
                      <Text style={[styles.listTitle, { color: theme.text }]}>
                        {game.home_team && game.away_team
                          ? `${game.home_team} vs ${game.away_team}`
                          : game.title || 'Game'}
                      </Text>
                      <Text style={[styles.metaText, { color: theme.mutedText }]}>
                        {formatDate(game.date)}{game.location ? `  |  ${game.location}` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.mutedText} />
                  </Pressable>
                ))
              )}
            </SectionCard>

            <SectionCard title="Upcoming Events" theme={theme}>
              {summary.upcoming.events.length === 0 ? (
                <EmptyCopy text="No upcoming non-game events are scheduled." theme={theme} />
              ) : (
                summary.upcoming.events.map(event => (
                  <Pressable
                    key={event.id}
                    onPress={() => router.push({ pathname: '/event-detail', params: { id: event.id } })}
                    style={[styles.listRow, { borderColor: theme.border }]}
                  >
                    <View style={styles.listGrow}>
                      <Text style={[styles.listTitle, { color: theme.text }]}>
                        {event.title || 'Event'}
                      </Text>
                      <Text style={[styles.metaText, { color: theme.mutedText }]}>
                        {formatDate(event.date)}{event.location ? `  |  ${event.location}` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.mutedText} />
                  </Pressable>
                ))
              )}
            </SectionCard>
          </>
        ) : null}

        {activeTab === 'teams' ? (
          <SectionCard title="Teams" theme={theme}>
            {summary.teams.length === 0 ? (
              <EmptyCopy text="No teams are attached to this organization yet." theme={theme} />
            ) : (
              summary.teams.map(team => (
                <View key={team.id} style={[styles.listRow, { borderColor: theme.border, alignItems: 'center' }]}>
                  <View style={styles.listGrow}>
                    <Text style={[styles.listTitle, { color: theme.text }]}>{team.name}</Text>
                    <Text style={[styles.metaText, { color: theme.mutedText }]}>
                      {[team.sport, team.season, `${team.members_count || 0} members`]
                        .filter(Boolean)
                        .join('  |  ')}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/team-admin',
                        params: {
                          teamId: team.id,
                          orgId: summary.organization.id,
                          orgTab: 'teams',
                        },
                      })
                    }
                    style={[styles.inlineButton, { borderColor: theme.border }]}
                  >
                    <Text style={[styles.inlineButtonText, { color: theme.text }]}>Open</Text>
                  </Pressable>
                </View>
              ))
            )}
          </SectionCard>
        ) : null}

        {activeTab === 'requests' ? (
          <>
            <SectionCard title="Coach Requests" theme={theme}>
              {!summary.permissions.can_review_coach_requests ? (
                <EmptyCopy text="Only organization owners can approve coach join requests." theme={theme} />
              ) : summary.requests.coach_requests.length === 0 ? (
                <EmptyCopy text="No coach requests are waiting for review." theme={theme} />
              ) : (
                summary.requests.coach_requests.map(request => (
                  <View key={request.id} style={[styles.requestCard, { borderColor: theme.border }]}>
                    <View style={styles.listGrow}>
                      <Text style={[styles.listTitle, { color: theme.text }]}>
                        {request.user?.display_name || request.user?.username || 'Coach request'}
                      </Text>
                      <Text style={[styles.metaText, { color: theme.mutedText }]}>
                        {formatDate(request.created_at)}{request.message ? `  |  ${request.message}` : ''}
                      </Text>
                    </View>
                    <View style={styles.compactActions}>
                      <Pressable
                        disabled={actingId === request.id}
                        onPress={() => void handleApproveCoach(request)}
                        style={[styles.approveButton, { backgroundColor: '#16A34A' }]}
                      >
                        <Text style={styles.actionButtonText}>
                          {actingId === request.id ? '...' : 'Approve'}
                        </Text>
                      </Pressable>
                      <Pressable
                        disabled={actingId === request.id}
                        onPress={() => void handleRejectCoach(request)}
                        style={[styles.rejectButton, { backgroundColor: theme.destructive }]}
                      >
                        <Text style={styles.actionButtonText}>Reject</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </SectionCard>

            <SectionCard title="Pending Games" theme={theme}>
              {summary.requests.pending_games.length === 0 ? (
                <EmptyCopy text="No pending games are waiting on this organization." theme={theme} />
              ) : (
                summary.requests.pending_games.map(game => (
                  <ReviewRow
                    key={game.id}
                    item={game}
                    theme={theme}
                    acting={actingId === `game:${game.id}:approve` || actingId === `game:${game.id}:reject`}
                    onOpen={() => router.push({ pathname: '/game/[id]', params: { id: game.id } })}
                    onApprove={() => void handleReview(game, 'game', 'approve')}
                    onReject={() => void handleReview(game, 'game', 'reject')}
                  />
                ))
              )}
            </SectionCard>

            <SectionCard title="Pending Events" theme={theme}>
              {summary.requests.pending_events.length === 0 ? (
                <EmptyCopy text="No pending non-game events are waiting on this organization." theme={theme} />
              ) : (
                summary.requests.pending_events.map(event => (
                  <ReviewRow
                    key={event.id}
                    item={event}
                    theme={theme}
                    acting={actingId === `event:${event.id}:approve` || actingId === `event:${event.id}:reject`}
                    onOpen={() => router.push({ pathname: '/event-detail', params: { id: event.id } })}
                    onApprove={() => void handleReview(event, 'event', 'approve')}
                    onReject={() => void handleReview(event, 'event', 'reject')}
                  />
                ))
              )}
            </SectionCard>
          </>
        ) : null}

        {activeTab === 'members' ? (
          <SectionCard title="Members" theme={theme}>
            <View style={styles.sectionHeaderActions}>
              <Text style={[styles.metaText, { color: theme.mutedText, flex: 1 }]}>
                {summary.counts.pending_authorized_invites > 0
                  ? `${summary.counts.pending_authorized_invites} authorized invite${summary.counts.pending_authorized_invites === 1 ? '' : 's'} pending`
                  : 'Invite managers and members into this organization workspace.'}
              </Text>
              <Pressable
                testID="organization-invite-authorized-user-button"
                onPress={() => setInviteModalVisible(true)}
                style={[styles.inlineButton, { borderColor: theme.border }]}
              >
                <Text style={[styles.inlineButtonText, { color: theme.text }]}>Invite</Text>
              </Pressable>
            </View>

            {summary.members.length === 0 ? (
              <EmptyCopy text="No members found for this organization." theme={theme} />
            ) : (
              summary.members.map(member => (
                <View key={member.id} style={[styles.listRow, { borderColor: theme.border }]}>
                  <View style={styles.listGrow}>
                    <Text style={[styles.listTitle, { color: theme.text }]}>
                      {member.user?.display_name || member.user?.username || 'Member'}
                    </Text>
                    <Text style={[styles.metaText, { color: theme.mutedText }]}>
                      {labelRole(member.role)}  |  {member.status}
                    </Text>
                  </View>
                </View>
              ))
            )}

            <View style={styles.invitesSection}>
              <Text style={[styles.sectionSubtitle, { color: theme.text }]}>Pending Invites</Text>
              {summary.requests.authorized_invites.length === 0 ? (
                <EmptyCopy text="No pending authorized-user invites." theme={theme} />
              ) : (
                summary.requests.authorized_invites.map(invite => (
                  <View key={invite.id} style={[styles.listRow, { borderColor: theme.border }]}>
                    <View style={styles.listGrow}>
                      <Text style={[styles.listTitle, { color: theme.text }]}>{invite.email}</Text>
                      <Text style={[styles.metaText, { color: theme.mutedText }]}>
                        {labelRole(invite.role)}  |  Pending  |  {formatDate(invite.created_at)}
                      </Text>
                    </View>
                    <Pressable
                      testID={`organization-cancel-invite-${invite.id}`}
                      disabled={actingId === `authorized-invite:${invite.id}`}
                      onPress={() => void handleCancelAuthorizedInvite(invite)}
                      style={[styles.rejectButton, { backgroundColor: theme.destructive, alignSelf: 'center' }]}
                    >
                      <Text style={styles.actionButtonText}>
                        {actingId === `authorized-invite:${invite.id}` ? '...' : 'Cancel'}
                      </Text>
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </SectionCard>
        ) : null}
      </ScrollView>

      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropPressable} onPress={() => setInviteModalVisible(false)} />
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Invite Authorized User</Text>
            <Text style={[styles.metaText, { color: theme.mutedText }]}>
              Add a manager or member to this organization workspace.
            </Text>

            <TextInput
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="staff@example.com"
              placeholderTextColor={theme.mutedText}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={[
                styles.textInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                },
              ]}
            />

            <View style={styles.rolePickerRow}>
              {(['member', 'manager'] as const).map(role => {
                const active = inviteRole === role;
                return (
                  <Pressable
                    key={role}
                    onPress={() => setInviteRole(role)}
                    style={[
                      styles.roleChip,
                      {
                        backgroundColor: active ? theme.tint : theme.background,
                        borderColor: active ? theme.tint : theme.border,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? '#fff' : theme.text, fontWeight: '600' }}>
                      {labelRole(role)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setInviteModalVisible(false);
                  setInviteEmail('');
                  setInviteRole('member');
                }}
                style={[styles.secondaryButton, { borderColor: theme.border, flex: 1 }]}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleInviteAuthorizedUser()}
                disabled={!inviteEmail.trim() || !!actingId}
                style={[
                  styles.primaryButton,
                  { backgroundColor: theme.tint, flex: 1 },
                  (!inviteEmail.trim() || !!actingId) && styles.disabledButton,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {actingId?.startsWith('invite:') ? 'Sending...' : 'Send Invite'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SectionCard({
  title,
  theme,
  children,
}: {
  title: string;
  theme: typeof Colors.light;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function StatCard({
  label,
  value,
  theme,
}: {
  label: string;
  value: number;
  theme: typeof Colors.light;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.mutedText }]}>{label}</Text>
    </View>
  );
}

function EmptyCopy({
  text,
  theme,
}: {
  text: string;
  theme: typeof Colors.light;
}) {
  return <Text style={[styles.metaText, { color: theme.mutedText }]}>{text}</Text>;
}

function ReviewRow({
  item,
  theme,
  acting,
  onOpen,
  onApprove,
  onReject,
}: {
  item: ReviewItem;
  theme: typeof Colors.light;
  acting: boolean;
  onOpen: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const requester =
    item.creator?.display_name ||
    item.created_by?.display_name ||
    item.creator?.username ||
    item.created_by?.username ||
    'Unknown';

  return (
    <View style={[styles.requestCard, { borderColor: theme.border }]}>
      <Pressable onPress={onOpen} style={styles.listGrow}>
        <Text style={[styles.listTitle, { color: theme.text }]}>{item.title || 'Untitled'}</Text>
        <Text style={[styles.metaText, { color: theme.mutedText }]}>
          {formatDate(item.date)}{item.location ? `  |  ${item.location}` : ''}
        </Text>
        <Text style={[styles.metaText, { color: theme.mutedText }]}>Submitted by {requester}</Text>
      </Pressable>
      <View style={styles.compactActions}>
        <Pressable
          disabled={acting}
          onPress={onApprove}
          style={[styles.approveButton, { backgroundColor: '#16A34A' }]}
        >
          <Text style={styles.actionButtonText}>{acting ? '...' : 'Approve'}</Text>
        </Pressable>
        <Pressable
          disabled={acting}
          onPress={onReject}
          style={[styles.rejectButton, { backgroundColor: theme.destructive }]}
        >
          <Text style={styles.actionButtonText}>Reject</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 24,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 10,
  },
  orgName: {
    fontSize: 24,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  primaryButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    minWidth: '47%',
    flexGrow: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listRow: {
    borderTopWidth: 1,
    paddingTop: 12,
    flexDirection: 'row',
    gap: 12,
  },
  listGrow: {
    flex: 1,
    gap: 4,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  inlineButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'center',
  },
  inlineButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  invitesSection: {
    gap: 12,
  },
  requestCard: {
    borderTopWidth: 1,
    paddingTop: 12,
    flexDirection: 'row',
    gap: 12,
  },
  compactActions: {
    gap: 8,
    justifyContent: 'center',
  },
  approveButton: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  modalBackdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
});
