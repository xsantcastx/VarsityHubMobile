import { Colors } from '@/constants/Colors';
import { formatLevelLabel, formatProgramLabel, groupTeamsByProgram } from '@/constants/programs';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useManagedTeamsQuery } from '@/hooks/useManagedTeamsQuery';
import { useOrgProgramsQuery } from '@/hooks/useOrgProgramsQuery';
import { useRequireTeamManagement } from '@/hooks/useRequireTeamManagement';
import { getAuthSnapshot } from '@/utils/authState';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, SectionHeader, TeamCard } from '@/components/ui';
import { handleCoachAccessError } from '@/utils/coachAccess';
import { safeGoBack } from '@/utils/navigation';

function ManageTeamsSimpleScreen() {
  const { user, checkAuth } = useAuth();
  const { canManage, loading: coachLoading } = useRequireTeamManagement();
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string; fallback?: string; orgId?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [refreshing, setRefreshing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'none' | 'pending_approval' | 'ready_to_pay'>(
    'none'
  );
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const explicitFallback =
    typeof params.fallback === 'string' && params.fallback.trim().startsWith('/')
      ? params.fallback.trim()
      : params.from === 'discover-quick-actions'
        ? '/(tabs)/discover'
        : params.orgId
          ? `/organization?id=${encodeURIComponent(params.orgId)}&tab=teams`
          : '/organization?tab=teams';

  const {
    data: teams = [],
    isPending: loading,
    isError,
    error: queryError,
    refetch,
    isRefetching,
  } = useManagedTeamsQuery({
    userId: user?.id,
    enabled: !!user && canManage && !coachLoading,
  });

  // If the managed() call failed with a specific coach-access error code,
  // route via the shared handler instead of showing the generic error card.
  // `handledByCoachAccess` tracks whether the CURRENT error was already
  // special-cased so the generic error card doesn't also render underneath
  // the Alert.
  const [handledByCoachAccess, setHandledByCoachAccess] = useState(false);
  const lastHandledErrorRef = useRef<unknown>(null);
  useEffect(() => {
    if (!isError || !queryError) {
      lastHandledErrorRef.current = null;
      setHandledByCoachAccess(false);
      return;
    }
    if (lastHandledErrorRef.current === queryError) return;
    lastHandledErrorRef.current = queryError;
    setHandledByCoachAccess(handleCoachAccessError(router, queryError, 'loading your teams', user));
  }, [isError, queryError, router, user]);

  const error = isError && !handledByCoachAccess ? 'Unable to load teams. Please try again.' : null;

  // Auto-refresh when screen regains focus (e.g. after creating a team).
  // Skip the very first focus (mount already triggers the initial fetch) by
  // only refetching once the query already has data — mirrors the old
  // hasLoadedTeamsRef guard. Background-only: refetch() doesn't flip
  // isPending once data already exists, so this never re-shows the blocking
  // spinner.
  const hasLoadedTeamsRef = useRef(false);
  hasLoadedTeamsRef.current = hasLoadedTeamsRef.current || !loading;
  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedTeamsRef.current) return undefined;
      void refetch().catch(e => {
        if (__DEV__) console.warn('[ManageTeams] focus reload error:', e);
      });
      return undefined;
    }, [refetch])
  );

  useEffect(() => {
    if (coachLoading || !canManage) return;
    void (async () => {
      try {
        const me: any = await getAuthSnapshot(checkAuth, user);
        const prefs = me?.preferences || {};
        // Check deferred payment status for paid plans (Rule A: use pending_plan)
        const plan = prefs.pending_plan || prefs.plan;
        setUserPlan(plan);
        if (
          prefs.payment_pending === true &&
          (prefs.pending_plan === 'veteran' || prefs.pending_plan === 'legend')
        ) {
          // Independent coaches (no join request) can pay immediately
          if (prefs.payment_approved === true || prefs.join_request_pending !== true) {
            setPaymentStatus('ready_to_pay');
          } else {
            setPaymentStatus('pending_approval');
          }
        } else {
          setPaymentStatus('none');
        }
      } catch (e) {
        if (__DEV__) console.warn('[ManageTeams] payment status check error:', e);
      }
    })().catch(() => {});
  }, [canManage, checkAuth, coachLoading, user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    // Re-check payment status on refresh
    try {
      const me: any = await getAuthSnapshot(checkAuth, user);
      const prefs = me?.preferences || {};
      const plan = prefs.pending_plan || prefs.plan;
      setUserPlan(plan);
      if (
        prefs.payment_pending === true &&
        (prefs.pending_plan === 'veteran' || prefs.pending_plan === 'legend')
      ) {
        setPaymentStatus(
          prefs.payment_approved === true || prefs.join_request_pending !== true
            ? 'ready_to_pay'
            : 'pending_approval'
        );
      } else {
        setPaymentStatus('none');
      }
    } catch {
      /* ignore */
    }
    setRefreshing(false);
  }, [checkAuth, refetch, user]);

  // Get organization from first team that has one
  const organization = teams.find(t => t.organization)?.organization;
  const activeTeams = teams.filter(t => t.status === 'active');

  const { data: orgPrograms = [] } = useOrgProgramsQuery({
    organizationId: organization?.id,
    enabled: !!organization?.id,
  });
  const programsById = useMemo(() => new Map(orgPrograms.map(p => [p.id, p])), [orgPrograms]);
  const teamGroups = useMemo(() => groupTeamsByProgram(activeTeams), [activeTeams]);
  // Only show program headers when at least one team actually has a
  // program_id — a fully ungrouped org keeps today's flat look.
  const hasProgramGroups = teamGroups.some(g => g.programId !== null);
  const handleCreateTeamPress = useCallback(() => {
    void router.push({
      pathname: '/create-team',
      params: {
        fallback: explicitFallback,
        ...(organization?.id ? { orgId: organization.id } : {}),
      },
    } as any);
  }, [explicitFallback, organization?.id, router]);
  const handleManageSeasonPress = useCallback(() => {
    if (activeTeams.length === 0) {
      Alert.alert('No Teams', 'Create a team first before managing your schedule.');
      return;
    }

    void router.push({
      pathname: '/manage-season',
      params: {
        ...(activeTeams.length === 1 ? { teamId: activeTeams[0].id } : {}),
        fallback: explicitFallback,
        ...(params.from ? { from: params.from } : {}),
      },
    } as any);
  }, [activeTeams, explicitFallback, params.from, router]);

  if (coachLoading || !canManage) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}
        edges={['top', 'bottom']}
      >
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors[colorScheme].tint} />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}
        edges={['top', 'bottom']}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top', 'bottom']}
    >
      <Stack.Screen options={{ title: 'My Teams', headerShown: false }} />

      {/* Simple Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => safeGoBack(router, explicitFallback)}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="back-button"
        >
          <MaterialIcons name="arrow-back" size={28} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>My Teams</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Payment Status Banner */}
      {paymentStatus === 'pending_approval' && (
        <View
          style={[
            styles.paymentBanner,
            {
              backgroundColor: colorScheme === 'dark' ? 'rgba(245,158,11,0.12)' : '#FEF3C7',
              borderColor: colorScheme === 'dark' ? 'rgba(245,158,11,0.35)' : '#FCD34D',
            },
          ]}
        >
          <MaterialIcons
            name="hourglass-top"
            size={24}
            color={colorScheme === 'dark' ? '#FCD34D' : '#92400E'}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.paymentBannerTitle,
                { color: colorScheme === 'dark' ? '#FDE68A' : '#92400E' },
              ]}
            >
              {userPlan
                ? `${userPlan.charAt(0).toUpperCase() + userPlan.slice(1)} Plan Selected`
                : 'Plan Selected'}
            </Text>
            <Text
              style={[
                styles.paymentBannerText,
                { color: colorScheme === 'dark' ? '#FDE68A' : '#92400E' },
              ]}
            >
              Payment will be processed after your organization admin approves your account.
            </Text>
          </View>
        </View>
      )}
      {paymentStatus === 'ready_to_pay' && (
        <Pressable
          style={[
            styles.paymentBannerAction,
            {
              backgroundColor: colorScheme === 'dark' ? 'rgba(16,185,129,0.12)' : '#D1FAE5',
              borderColor: colorScheme === 'dark' ? 'rgba(52,211,153,0.35)' : '#6EE7B7',
            },
          ]}
          onPress={() => void router.push('/settings/manage-subscription')}
        >
          <MaterialIcons
            name="check-circle"
            size={24}
            color={colorScheme === 'dark' ? '#6EE7B7' : '#065F46'}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.paymentBannerActionTitle,
                { color: colorScheme === 'dark' ? '#A7F3D0' : '#065F46' },
              ]}
            >
              You're Approved!
            </Text>
            <Text
              style={[
                styles.paymentBannerActionText,
                { color: colorScheme === 'dark' ? '#A7F3D0' : '#065F46' },
              ]}
            >
              Complete your {userPlan} plan payment to unlock all features.
            </Text>
          </View>
          <MaterialIcons
            name="arrow-forward"
            size={20}
            color={colorScheme === 'dark' ? '#6EE7B7' : '#065F46'}
          />
        </Pressable>
      )}

      {/* Quick Action Buttons - Inline */}
      <View style={styles.quickActionsContainer}>
        <Pressable
          style={[styles.inlineActionButton, { backgroundColor: theme.tint }]}
          onPress={handleCreateTeamPress}
        >
          <MaterialIcons name="add-circle-outline" size={24} color="#fff" />
          <Text style={styles.inlineActionText}>Create Team</Text>
        </Pressable>

        <Pressable
          style={[styles.inlineActionButton, { backgroundColor: '#10B981' }]}
          onPress={handleManageSeasonPress}
        >
          <MaterialIcons name="sports-basketball" size={24} color="#fff" />
          <Text style={styles.inlineActionText}>Schedule</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing || isRefetching} onRefresh={onRefresh} />
        }
      >
        {/* League Card - BIG and Prominent */}
        {organization && (
          <Pressable
            style={styles.leagueCard}
            onPress={() => {
              void router.push({
                pathname: '/organization',
                params: {
                  id: organization.id,
                  name: organization.name,
                },
              } as any);
            }}
          >
            <LinearGradient
              colors={
                colorScheme === 'dark' ? [theme.background, theme.card] : ['#111827', '#1F2937'] // audit: intentional league card gradient, not text color
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.leagueGradient}
            >
              <View style={styles.leagueHeader}>
                <MaterialIcons name="emoji-events" size={40} color="#FFF" />
                <View style={styles.leagueHeaderText}>
                  <Text style={styles.leagueLabel}>MY ORGANIZATION</Text>
                  <Text style={styles.leagueName}>{organization.name}</Text>
                </View>
              </View>

              <View style={styles.leagueStats}>
                <View style={styles.leagueStat}>
                  <Text style={styles.leagueStatNumber}>{activeTeams.length}</Text>
                  <Text style={styles.leagueStatLabel}>Teams</Text>
                </View>
                <View style={styles.leagueStat}>
                  <Text style={styles.leagueStatNumber}>
                    {activeTeams.reduce((sum, t) => sum + t.members, 0)}
                  </Text>
                  <Text style={styles.leagueStatLabel}>Players</Text>
                </View>
              </View>

              <View style={styles.leagueAction}>
                <Text style={styles.leagueActionText}>View Organization Page</Text>
                <MaterialIcons name="arrow-forward" size={24} color="#FFF" />
              </View>
            </LinearGradient>
          </Pressable>
        )}

        {/* Error State */}
        {error && !loading && (
          <View style={styles.errorCard}>
            <MaterialIcons name="error" size={48} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => void refetch()}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </Pressable>
          </View>
        )}

        {/* Teams Section */}
        {!loading && !error && activeTeams.length > 0 && (
          <View style={styles.teamsSection}>
            <SectionHeader title="MY TEAMS" style={{ paddingHorizontal: 0 }} />

            {hasProgramGroups
              ? teamGroups.map(group => {
                  const program = group.programId ? programsById.get(group.programId) : undefined;
                  const headerTitle = group.programId
                    ? program
                      ? formatProgramLabel(program)
                      : group.teams[0]?.sport || 'Teams'
                    : 'Other teams';
                  return (
                    <View key={group.programId ?? 'other'}>
                      <SectionHeader
                        title={headerTitle}
                        showBorder={false}
                        style={{ paddingHorizontal: 0, paddingTop: 8 }}
                      />
                      {group.teams.map(team => {
                        const levelLabel = formatLevelLabel(team.level);
                        const seasonText =
                          [team.season, levelLabel].filter(Boolean).join(' • ') || undefined;
                        return (
                          <TeamCard
                            key={team.id}
                            team={{
                              id: team.id,
                              name: team.name,
                              sport: team.sport || undefined,
                              season: seasonText,
                              logo_url: team.avatar_url || undefined,
                              member_count: team.members,
                              role: team.my_role as any,
                            }}
                            onPress={() =>
                              void router.push(`/team-page?id=${team.id}&from=program`)
                            }
                            showRole={true}
                            style={{ marginBottom: 12 }}
                          />
                        );
                      })}
                    </View>
                  );
                })
              : activeTeams.map(team => (
                  <TeamCard
                    key={team.id}
                    team={{
                      id: team.id,
                      name: team.name,
                      sport: team.sport || undefined,
                      season: team.season || undefined,
                      logo_url: team.avatar_url || undefined,
                      member_count: team.members,
                      role: team.my_role as any,
                    }}
                    onPress={() => void router.push(`/team-page?id=${team.id}&from=program`)}
                    showRole={true}
                    style={{ marginBottom: 12 }}
                  />
                ))}
          </View>
        )}

        {/* Empty State */}
        {/* v1.0.2 pass 9: added action button so newly-approved coaches don't hit a dead end here. */}
        {!loading && !error && activeTeams.length === 0 && (
          <View>
            <EmptyState
              icon="people-outline"
              title="No Teams Yet"
              subtitle="Create your first team to get started"
            />
            <View style={{ alignItems: 'center', marginTop: 12, paddingHorizontal: 24 }}>
              {/* v1.0.2 pass 10: use theme tint color so button matches dark/light schemes. */}
              <Pressable
                onPress={handleCreateTeamPress}
                style={{
                  backgroundColor: theme.tint,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 8,
                }}
                accessibilityRole="button"
                accessibilityLabel="Create your first team"
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Create Your First Team</Text>
              </Pressable>
            </View>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },

  // Quick Action Buttons (Inline)
  quickActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  inlineActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  inlineActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // League Card
  leagueCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  leagueGradient: {
    padding: 24,
  },
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  leagueHeaderText: {
    marginLeft: 16,
    flex: 1,
  },
  leagueLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  leagueName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
  },
  leagueStats: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 20,
  },
  leagueStat: {
    alignItems: 'center',
  },
  leagueStatNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
  },
  leagueStatLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  leagueAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  leagueActionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },

  // Teams Section
  teamsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  teamIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  teamInfo: {
    flex: 1,
  },
  teamNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  teamName: {
    fontSize: 20,
    fontWeight: '700',
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  teamMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamMetaText: {
    fontSize: 15,
    fontWeight: '500',
  },
  teamMetaDivider: {
    fontSize: 15,
    fontWeight: '700',
  },

  // States
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
  },
  errorCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  paymentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  paymentBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  paymentBannerText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  paymentBannerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  paymentBannerActionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 2,
  },
  paymentBannerActionText: {
    fontSize: 13,
    color: '#065F46',
    lineHeight: 18,
  },
});

export default ManageTeamsSimpleScreen;
