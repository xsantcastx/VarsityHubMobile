import { useAuth } from '@/context/AuthProvider';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { Team as TeamApi, User } from '@/api/entities';
import QuickAddGameModal, { QuickGameData } from '@/components/QuickAddGameModal';
// @ts-ignore
import { Game as GameApi } from '@/api/entities';
import { EmptyState, SectionHeader, TeamCard, TeamCardSkeleton } from '@/components/ui';
import { safeGoBack } from '@/utils/navigation';

type Team = { 
  id: string; 
  name: string; 
  members: number; 
  status: 'active' | 'archived';
  sport?: string;
  season?: string;
  avatar_url?: string;
  my_role?: string;
  organization?: {
    id: string;
    name: string;
    description?: string;
    sport?: string;
  } | null;
};

export default function ManageTeamsSimpleScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'none' | 'pending_approval' | 'ready_to_pay'>('none');
  const [userPlan, setUserPlan] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const list: any[] = await TeamApi.managed();
      const formattedTeams = list.map((t: any) => ({
        id: String(t.id),
        name: String(t.name || 'Team'),
        members: Number(t.members || t._count?.members || 0),
        status: (t.status || 'active') as any,
        sport: t.sport || null,
        season: t.season || null,
        avatar_url: t.avatar_url || null,
        my_role: t.my_role || null,
        organization: t.organization || null,
      }));
      setTeams(formattedTeams);
    } catch (e: any) {
      if (__DEV__) console.error('Failed to load teams:', e);
      setError('Unable to load teams. Please try again.');
      setTeams([]);
    }
  }, []);

  useEffect(() => {
    void loadTeams().finally(() => setLoading(false)).catch((e) => { if (__DEV__) console.warn('[ManageTeams] load error:', e); });
  }, [loadTeams]);

  // Auto-refresh when screen regains focus (e.g. after creating a team)
  useFocusEffect(
    useCallback(() => {
      void loadTeams().catch((e) => { if (__DEV__) console.warn('[ManageTeams] focus reload error:', e); });
    }, [loadTeams])
  );

  // Guard: redirect non-coach users away + check payment status
  useEffect(() => {
    void (async () => {
      try {
        const me: any = await User.me();
        const prefs = me?.preferences || {};
        const role = prefs.role;
        if (role !== 'coach') {
          Alert.alert('Restricted', 'Only coach accounts can access Manage Teams.');
          router.push('/(tabs)');
          return;
        }
        // Check deferred payment status for paid plans (Rule A: use pending_plan)
        const plan = prefs.pending_plan || prefs.plan;
        setUserPlan(plan);
        if (prefs.payment_pending === true && (prefs.pending_plan === 'veteran' || prefs.pending_plan === 'legend')) {
          // Independent coaches (no join request) can pay immediately
          if (prefs.payment_approved === true || prefs.join_request_pending !== true) {
            setPaymentStatus('ready_to_pay');
          } else {
            setPaymentStatus('pending_approval');
          }
        } else {
          setPaymentStatus('none');
        }
      } catch {
        // silently ignore
      }
    })().catch(() => {});
  }, [router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTeams();
    // Re-check payment status on refresh
    try {
      const me: any = await User.me();
      const prefs = me?.preferences || {};
      const plan = prefs.pending_plan || prefs.plan;
      setUserPlan(plan);
      if (prefs.payment_pending === true && (prefs.pending_plan === 'veteran' || prefs.pending_plan === 'legend')) {
        setPaymentStatus((prefs.payment_approved === true || prefs.join_request_pending !== true) ? 'ready_to_pay' : 'pending_approval');
      } else {
        setPaymentStatus('none');
      }
    } catch { /* ignore */ }
    setRefreshing(false);
  }, [loadTeams]);

  // Get organization from first team that has one
  const organization = teams.find(t => t.organization)?.organization;
  const activeTeams = teams.filter(t => t.status === 'active');

  const handleQuickAddGame = async (data: QuickGameData) => {
    try {
      // Find the team ID from the current team name
      const team = teams.find(t => t.name === data.currentTeam);
      if (!team) {
        Alert.alert('Error', 'Please select a team first');
        return;
      }

      // Parse date and time to create ISO datetime
      const [year, month, day] = data.date.split('-').map(Number);
      const timeMatch = data.time.match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)?$/i);
      if (!timeMatch) {
        Alert.alert('Error', 'Invalid time format');
        return;
      }
      
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2] || '0', 10);
      const meridiem = timeMatch[3]?.toUpperCase();
      
      if (meridiem === 'PM' && hours !== 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;
      
      const gameDateTime = new Date(Date.UTC(year, month - 1, day, hours, minutes));
      
      // Determine home/away team IDs based on game type
      const homeTeamId = data.type === 'home' ? (data.currentTeamId || team.id) : data.opponentTeamId;
      const awayTeamId = data.type === 'home' ? data.opponentTeamId : (data.currentTeamId || team.id);

      // Create game payload matching backend schema
      const gamePayload: Record<string, any> = {
        title: data.isCompetitive 
          ? `${data.currentTeam} vs ${data.opponent}`
          : `${data.currentTeam} Event`,
        date: gameDateTime.toISOString(),
        description: data.isCompetitive
          ? `${data.type === 'home' ? 'Home' : 'Away'} game: ${data.currentTeam} vs ${data.opponent}`
          : `Event for ${data.currentTeam}`,
      };

      // Only add team fields if this is a competitive game
      if (data.isCompetitive) {
        gamePayload.home_team = data.type === 'home' ? data.currentTeam : data.opponent;
        gamePayload.away_team = data.type === 'home' ? data.opponent : data.currentTeam;
        
        if (homeTeamId) gamePayload.home_team_id = homeTeamId;
        if (awayTeamId) {
          gamePayload.away_team_id = awayTeamId;
        } else if (data.opponent) {
          gamePayload.away_team_name = data.opponent;
        }
      } else {
        // For non-competitive events, still send home_team_id for approval workflow
        if (data.currentTeamId) {
          gamePayload.home_team_id = data.currentTeamId;
        }
      }

      // Add expected attendance if provided
      if (data.expectedAttendance) {
        gamePayload.expected_attendance = data.expectedAttendance;
      }

      // Add event type
      if (data.eventType) {
        gamePayload.event_type = data.eventType;
      }
      
      // Add event type-specific fields
      if (data.donationGoal) {
        gamePayload.donation_goal = data.donationGoal;
      }
      if (data.watchLocation) {
        gamePayload.watch_location = data.watchLocation;
        if (data.watchLocationLat) gamePayload.watch_location_lat = data.watchLocationLat;
        if (data.watchLocationLng) gamePayload.watch_location_lng = data.watchLocationLng;
        if (data.watchLocationPlaceId) gamePayload.watch_location_place_id = data.watchLocationPlaceId;
      }
      if (data.destination) {
        gamePayload.destination = data.destination;
      }

      // Add game venue location
      const venue = data.type === 'home' ? data.homeVenue : data.awayVenue;
      const venueLat = data.type === 'home' ? data.homeVenueLat : data.awayVenueLat;
      const venueLng = data.type === 'home' ? data.homeVenueLng : data.awayVenueLng;
      if (venue) {
        gamePayload.location = venue;
        if (venueLat) gamePayload.latitude = venueLat;
        if (venueLng) gamePayload.longitude = venueLng;
      } else {
        // Fallback: use watch location, destination, or 'TBD' — backend requires location
        gamePayload.location = data.watchLocation || data.destination || 'TBD';
      }

      if (data.banner_url) {
        gamePayload.banner_url = data.banner_url;
        gamePayload.cover_image_url = data.banner_url;
      } else if (data.cover_image_url) {
        gamePayload.cover_image_url = data.cover_image_url;
      }

      if (data.appearance) {
        gamePayload.appearance = data.appearance;
      }


      // Create game using the API
      await GameApi.create(gamePayload);

      setShowQuickAddModal(false);
      Alert.alert(
        'Success', 
        data.isCompetitive ? 'Game added successfully!' : 'Event added successfully!', 
        [{ text: 'OK', onPress: () => {} }]
      );
    } catch (error) {
      if (__DEV__) console.error('Error adding quick game:', error);
      Alert.alert(
        'Error',
        `Failed to add event: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'My Teams', headerShown: false }} />
      
      {/* Simple Header */}
      <View style={[styles.header, { backgroundColor: Colors[colorScheme].background }]}>
        <Pressable 
          style={styles.backButton} 
          onPress={() => safeGoBack(router)}
        >
          <MaterialIcons name="arrow-back" size={28} color={Colors[colorScheme].text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]}>My Teams</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Payment Status Banner */}
      {paymentStatus === 'pending_approval' && (
        <View style={styles.paymentBanner}>
          <MaterialIcons name="hourglass-top" size={24} color="#92400E" />
          <View style={{ flex: 1 }}>
            <Text style={styles.paymentBannerTitle}>
              {userPlan ? `${userPlan.charAt(0).toUpperCase() + userPlan.slice(1)} Plan Selected` : 'Plan Selected'}
            </Text>
            <Text style={styles.paymentBannerText}>
              Payment will be processed after your league admin approves your account.
            </Text>
          </View>
        </View>
      )}
      {paymentStatus === 'ready_to_pay' && (
        <Pressable
          style={styles.paymentBannerAction}
          onPress={() => void router.push('/subscription-paywall')}
        >
          <MaterialIcons name="check-circle" size={24} color="#065F46" />
          <View style={{ flex: 1 }}>
            <Text style={styles.paymentBannerActionTitle}>You're Approved!</Text>
            <Text style={styles.paymentBannerActionText}>
              Complete your {userPlan} plan payment to unlock all features.
            </Text>
          </View>
          <MaterialIcons name="arrow-forward" size={20} color="#065F46" />
        </Pressable>
      )}

      {/* Quick Action Buttons - Inline */}
      <View style={styles.quickActionsContainer}>
        <Pressable 
          style={[styles.inlineActionButton, { backgroundColor: Colors[colorScheme].tint }]}
          onPress={() => void router.push('/(tabs)/create-team')}
        >
          <MaterialIcons name="add-circle-outline" size={24} color="#fff" />
          <Text style={styles.inlineActionText}>Create Team</Text>
        </Pressable>
        
        <Pressable
          style={[styles.inlineActionButton, { backgroundColor: '#10B981' }]}
          onPress={() => {
            if (activeTeams.length === 0) {
              Alert.alert('No Teams', 'Create a team first before adding events.');
              return;
            }
            void router.push(`/manage-season?teamId=${activeTeams[0].id}`);
          }}
        >
          <MaterialIcons name="sports-basketball" size={24} color="#fff" />
          <Text style={styles.inlineActionText}>Schedule</Text>
        </Pressable>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* League Card - BIG and Prominent */}
        {organization && (
          <Pressable 
            style={styles.leagueCard}
            onPress={() => { void router.push({
                pathname: '/(tabs)/organization',
                params: {
                  id: organization.id,
                  name: organization.name
                }
              } as any);
            }}
          >
            <LinearGradient
              colors={['#111827', '#1F2937']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.leagueGradient}
            >
              <View style={styles.leagueHeader}>
                <MaterialIcons name="emoji-events" size={40} color="#FFF" />
                <View style={styles.leagueHeaderText}>
                  <Text style={styles.leagueLabel}>MY LEAGUE</Text>
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
                <Text style={styles.leagueActionText}>View League Page</Text>
                <MaterialIcons name="arrow-forward" size={24} color="#FFF" />
              </View>
            </LinearGradient>
          </Pressable>
        )}

        {/* Loading State */}
        {loading && (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <TeamCardSkeleton />
            <TeamCardSkeleton />
          </View>
        )}

        {/* Error State */}
        {error && !loading && (
          <View style={styles.errorCard}>
            <MaterialIcons name="error" size={48} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={loadTeams}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </Pressable>
          </View>
        )}

        {/* Teams Section */}
        {!loading && !error && activeTeams.length > 0 && (
          <View style={styles.teamsSection}>
            <SectionHeader 
              title="MY TEAMS"
              style={{ paddingHorizontal: 0 }}
            />
            
            {activeTeams.map((team) => (
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
                onPress={() => void router.push(`/(tabs)/team-profile?id=${team.id}`)}
                showRole={true}
                style={{ marginBottom: 12 }}
              />
            ))}
          </View>
        )}

        {/* Empty State */}
        {!loading && !error && activeTeams.length === 0 && (
          <EmptyState
            icon="people-outline"
            title="No Teams Yet"
            subtitle="Create your first team to get started"
          />
        )}

        {/* Big Action Buttons */}
        <View style={styles.actionsSection}>
          <Pressable
            style={[styles.bigActionButton, { backgroundColor: Colors[colorScheme].tint }]}
            onPress={() => void router.push('/(tabs)/create-team')}
          >
            <MaterialIcons name="add-circle" size={32} color="#FFF" />
            <Text style={styles.bigActionButtonText}>CREATE TEAM</Text>
          </Pressable>

          <Pressable
            style={[styles.bigActionButton, { backgroundColor: '#10B981' }]}
            onPress={() => {
              if (activeTeams.length === 0) {
                Alert.alert('No Teams', 'Create a team first before adding events.');
                return;
              }
              setShowQuickAddModal(true);
            }}
          >
            <MaterialIcons name="event" size={32} color="#FFF" />
            <Text style={styles.bigActionButtonText}>QUICK ADD EVENT</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Quick Add Event Modal */}
      <QuickAddGameModal
        visible={showQuickAddModal}
        onClose={() => setShowQuickAddModal(false)}
        onSave={handleQuickAddGame}
        currentTeamName={activeTeams[0]?.name} // Default to first team
        currentTeamId={activeTeams[0]?.id}
        userRole="coach"
      />
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

  // Action Buttons
  actionsSection: {
    paddingHorizontal: 20,
    gap: 12,
  },
  bigActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  bigActionButtonText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
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
