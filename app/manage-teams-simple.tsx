import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Team as TeamApi } from '@/api/entities';

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
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);

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

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen options={{ title: 'My Teams', headerShown: false }} />
      
      {/* Simple Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: Colors[colorScheme].background }]}>
        <Pressable 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={28} color={Colors[colorScheme].text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]}>My Teams</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Big Action Buttons - At the top for quick access */}
        <View style={styles.actionsSection}>
          <Pressable
            style={[styles.bigActionButton, { backgroundColor: Colors[colorScheme].tint }]}
            onPress={() => router.push('/create-team')}
          >
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={styles.bigActionButtonText}>CREATE TEAM</Text>
          </Pressable>

          <Pressable
            style={[styles.bigActionButton, { backgroundColor: '#10B981' }]}
            onPress={() => router.push('/manage-season')}
          >
            <Ionicons name="calendar" size={20} color="#FFF" />
            <Text style={styles.bigActionButtonText}>ADD EVENT</Text>
          </Pressable>
        </View>

        {/* League Card - BIG and Prominent */}
        {organization && (
          <Pressable 
            style={styles.leagueCard}
            onPress={() => {
              // TODO: Navigate to organization page
              console.log('Navigate to organization:', organization.id);
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
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            <Text style={[styles.loadingText, { color: Colors[colorScheme].mutedText }]}>
              Loading teams...
            </Text>
          </View>
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
            <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
              MY TEAMS
            </Text>
            
            {activeTeams.map((team) => (
              <Pressable
                key={team.id}
                style={[styles.teamCard, { backgroundColor: Colors[colorScheme].surface }]}
                onPress={() => router.push(`/team-profile?id=${team.id}`)}
              >
                <View style={styles.teamIcon}>
                  <Ionicons 
                    name={getSportIcon(team.sport)} 
                    size={36} 
                    color={Colors[colorScheme].tint} 
                  />
                </View>
                
                <View style={styles.teamInfo}>
                  <View style={styles.teamNameRow}>
                    <Text style={[styles.teamName, { color: Colors[colorScheme].text }]}>
                      {team.name}
                    </Text>
                    {getRoleBadge(team.my_role)}
                  </View>
                  
                  <View style={styles.teamMeta}>
                    <Ionicons name="people" size={18} color={Colors[colorScheme].mutedText} />
                    <Text style={[styles.teamMetaText, { color: Colors[colorScheme].mutedText }]}>
                      {team.members} Players
                    </Text>
                    {team.sport && (
                      <>
                        <Text style={[styles.teamMetaDivider, { color: Colors[colorScheme].mutedText }]}>•</Text>
                        <Text style={[styles.teamMetaText, { color: Colors[colorScheme].mutedText }]}>
                          {team.sport}
                        </Text>
                      </>
                    )}
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={28} color={Colors[colorScheme].mutedText} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Empty State */}
        {!loading && !error && activeTeams.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={80} color={Colors[colorScheme].mutedText} />
            <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>
              No Teams Yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: Colors[colorScheme].mutedText }]}>
              Create your first team to get started
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
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
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  bigActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  bigActionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.3,
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
