import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { Team as TeamApi } from '@/api/entities';
import QuickAddGameModal, { QuickGameData } from '@/components/QuickAddGameModal';
// @ts-ignore
import { Game as GameApi } from '@/api/entities';
import { EmptyState, LoadingState, SectionHeader, TeamCard } from '@/components/ui';

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
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);

  const loadTeams = useCallback(async () => {
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
      console.error('Failed to load teams:', e);
      setError('Unable to load teams. Please try again.');
      setTeams([]);
    }
  }, []);

  useEffect(() => {
    loadTeams().finally(() => setLoading(false));
  }, [loadTeams]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTeams();
    setRefreshing(false);
  }, [loadTeams]);

  // Get organization from first team that has one
  const organization = teams.find(t => t.organization)?.organization;
  const activeTeams = teams.filter(t => t.status === 'active');

  const getRoleBadge = (role?: string | null) => {
    if (!role) return null;
    const roleMap: Record<string, { label: string; color: string }> = {
      owner: { label: 'Owner', color: '#8B5CF6' },
      manager: { label: 'Manager', color: '#3B82F6' },
      coach: { label: 'Coach', color: '#10B981' },
      assistant_coach: { label: 'Asst. Coach', color: '#F59E0B' },
    };
    const info = roleMap[role] || { label: role, color: '#6B7280' };
    return (
      <View style={[styles.roleBadge, { backgroundColor: info.color }]}>
        <Text style={styles.roleBadgeText}>{info.label}</Text>
      </View>
    );
  };

  const getSportIcon = (sport?: string | null) => {
    const sportIcons: Record<string, any> = {
      football: 'football',
      basketball: 'basketball',
      baseball: 'baseball',
      soccer: 'football-outline',
      volleyball: 'tennisball',
      hockey: 'paw',
    };
    return sportIcons[sport?.toLowerCase() || ''] || 'trophy';
  };

  const handleQuickAddGame = async (data: QuickGameData) => {
    try {
      // Find the team ID from the current team name
      const team = teams.find(t => t.name === data.currentTeam);
      if (!team) {
        Alert.alert('Error', 'Please select a team first');
        return;
      }

      // Create game using the API
      const newGame = await GameApi.create({
        team_id: team.id,
        opponent: data.opponent,
        game_date: data.date,
        game_time: data.time,
        home_away: data.type,
        banner_url: data.banner_url,
        cover_image_url: data.cover_image_url,
        appearance: data.appearance,
      });

      setShowQuickAddModal(false);
      Alert.alert('Success', 'Game added successfully!', [
        { text: 'OK', onPress: () => {} }
      ]);
    } catch (error) {
      console.error('Error adding quick game:', error);
      Alert.alert(
        'Error',
        `Failed to add game: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={28} color={Colors[colorScheme].text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]}>My Teams</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Quick Action Buttons - Inline */}
      <View style={styles.quickActionsContainer}>
        <Pressable 
          style={[styles.inlineActionButton, { backgroundColor: Colors[colorScheme].tint }]}
          onPress={() => router.push('/create-team')}
        >
          <Ionicons name="add-circle-outline" size={24} color="#fff" />
          <Text style={styles.inlineActionText}>Create Team</Text>
        </Pressable>
        
        <Pressable 
          style={[styles.inlineActionButton, { backgroundColor: '#10B981' }]}
          onPress={() => {
            // Navigate to first team's add game, or show team selection if multiple teams
            if (activeTeams.length > 0) {
              router.push(`/manage-season?teamId=${activeTeams[0].id}`);
            }
          }}
        >
          <Ionicons name="basketball-outline" size={24} color="#fff" />
          <Text style={styles.inlineActionText}>Add Game</Text>
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
            onPress={() => {
              router.push({
                pathname: '/league',
                params: { 
                  id: organization.id,
                  name: organization.name 
                }
              });
            }}
          >
            <LinearGradient
              colors={['#8B5CF6', '#6366F1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.leagueGradient}
            >
              <View style={styles.leagueHeader}>
                <Ionicons name="trophy" size={40} color="#FFF" />
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
                <Ionicons name="arrow-forward" size={24} color="#FFF" />
              </View>
            </LinearGradient>
          </Pressable>
        )}

        {/* Loading State */}
        {loading && (
          <LoadingState 
            message="Loading teams..." 
            fullScreen={true}
          />
        )}

        {/* Error State */}
        {error && !loading && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={48} color="#EF4444" />
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
                onPress={() => router.push(`/team-profile?id=${team.id}`)}
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
            onPress={() => router.push('/create-team')}
          >
            <Ionicons name="add-circle" size={32} color="#FFF" />
            <Text style={styles.bigActionButtonText}>CREATE TEAM</Text>
          </Pressable>

          <Pressable
            style={[styles.bigActionButton, { backgroundColor: '#10B981' }]}
            onPress={() => setShowQuickAddModal(true)}
          >
            <Ionicons name="calendar" size={32} color="#FFF" />
            <Text style={styles.bigActionButtonText}>ADD GAME</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Quick Add Game Modal */}
      <QuickAddGameModal
        visible={showQuickAddModal}
        onClose={() => setShowQuickAddModal(false)}
        onSave={handleQuickAddGame}
        currentTeamName={activeTeams[0]?.name} // Default to first team
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
});
