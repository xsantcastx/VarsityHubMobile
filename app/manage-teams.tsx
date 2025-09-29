import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
  description?: string;
  avatar_url?: string;
};

export default function ManageTeamsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);

  const loadTeams = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const list: any[] = await TeamApi.list();
      const formattedTeams = list.map((t: any) => ({
        id: String(t.id),
        name: String(t.name || 'Team'),
        members: Number(t.members || t._count?.members || 0),
        status: (t.status || 'active') as any,
        sport: t.sport || null,
        season: t.season || null,
        description: t.description || null,
        avatar_url: t.avatar_url || null,
      }));
      setTeams(formattedTeams);
    } catch (e: any) {
      console.error('Failed to load teams:', e);
      setError('Failed to load teams');
      setTeams([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadTeams({ silent: true }); } finally { setRefreshing(false); }
  }, [loadTeams]);

  const filtered = useMemo(() => {
    if (!query.trim()) return teams;
    const q = query.toLowerCase().trim();
    return teams.filter(team => 
      team.name.toLowerCase().includes(q) ||
      team.sport?.toLowerCase().includes(q) ||
      team.description?.toLowerCase().includes(q)
    );
  }, [query, teams]);

  const activeTeams = filtered.filter(t => t.status === 'active');
  const archivedTeams = filtered.filter(t => t.status === 'archived');

  const ListHeader = (
    <View>
      <View style={[styles.header, { paddingTop: 12 + insets.top }]}>
        <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Manage Teams</Text>
        <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>
          Create and organize your teams
        </Text>
      </View>

      {/* Quick Actions Section */}
      <View style={[styles.actionsSection, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4 }}>
          <Pressable 
            style={[styles.actionCard, { backgroundColor: Colors[colorScheme].tint }]}
            onPress={() => router.push('/create-team')}
          >
            <Ionicons name="add-circle-outline" size={24} color="#fff" />
            <Text style={styles.actionCardTitle}>Create Team</Text>
            <Text style={styles.actionCardDesc}>Start a new team</Text>
          </Pressable>
          
          <Pressable 
            style={[styles.actionCard, { backgroundColor: '#10B981' }]}
            onPress={() => router.push('/team-invites')}
          >
            <Ionicons name="person-add-outline" size={24} color="#fff" />
            <Text style={styles.actionCardTitle}>Invitations</Text>
            <Text style={styles.actionCardDesc}>Manage invites</Text>
          </Pressable>

          <Pressable 
            style={[styles.actionCard, { backgroundColor: '#F59E0B' }]}
            onPress={() => router.push('/archive-seasons')}
          >
            <Ionicons name="archive-outline" size={24} color="#fff" />
            <Text style={styles.actionCardTitle}>Archives</Text>
            <Text style={styles.actionCardDesc}>Past seasons</Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
        <Ionicons name="search" size={20} color={Colors[colorScheme].mutedText} />
        <TextInput
          placeholder="Search teams, sports, or descriptions..."
          placeholderTextColor={Colors[colorScheme].mutedText}
          value={query}
          onChangeText={setQuery}
          style={[styles.searchInput, { color: Colors[colorScheme].text }]}
        />
      </View>

      {/* Stats Section */}
      <View style={styles.statsSection}>
        <View style={[styles.statCard, { backgroundColor: Colors[colorScheme].surface }]}>
          <Text style={[styles.statNumber, { color: Colors[colorScheme].text }]}>{activeTeams.length}</Text>
          <Text style={[styles.statLabel, { color: Colors[colorScheme].mutedText }]}>Active Teams</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: Colors[colorScheme].surface }]}>
          <Text style={[styles.statNumber, { color: Colors[colorScheme].text }]}>
            {teams.reduce((sum, t) => sum + t.members, 0)}
          </Text>
          <Text style={[styles.statLabel, { color: Colors[colorScheme].mutedText }]}>Total Members</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: Colors[colorScheme].surface }]}>
          <Text style={[styles.statNumber, { color: Colors[colorScheme].text }]}>{archivedTeams.length}</Text>
          <Text style={[styles.statLabel, { color: Colors[colorScheme].mutedText }]}>Archived</Text>
        </View>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        </View>
      )}

      {error && !loading && (
        <View style={[styles.errorContainer, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
          <Ionicons name="alert-circle" size={20} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {activeTeams.length > 0 && (
        <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
          Active Teams ({activeTeams.length})
        </Text>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen options={{ title: 'Manage Teams', headerShown: false }} />
      
      {activeTeams.length === 0 && !loading && !error ? (
        <View style={styles.emptyStateContainer}>
          <View style={ListHeader.props.children} />
          <View style={[styles.emptyCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
            <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={32} color="#fff" />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>No teams yet</Text>
            <Text style={[styles.emptySubtitle, { color: Colors[colorScheme].mutedText }]}>
              Create your first team to get started with managing players and organizing games.
            </Text>
            <Pressable 
              style={[styles.emptyAction, { backgroundColor: Colors[colorScheme].tint }]}
              onPress={() => router.push('/create-team')}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.emptyActionText}>Create Your First Team</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <FlatList
          data={activeTeams}
          keyExtractor={(team) => team.id}
          ListHeaderComponent={ListHeader}
          renderItem={({ item: team }) => (
            <Pressable
              style={[styles.teamCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}
              onPress={() => router.push(`/team-profile?id=${team.id}`)}
            >
              <View style={styles.teamCardContent}>
                <View style={styles.teamAvatarContainer}>
                  {team.avatar_url ? (
                    <Image source={{ uri: team.avatar_url }} style={styles.teamAvatar} contentFit="cover" />
                  ) : (
                    <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.teamAvatar}>
                      <Text style={styles.teamInitials}>
                        {team.name.charAt(0).toUpperCase()}
                      </Text>
                    </LinearGradient>
                  )}
                  <View style={[styles.statusDot, { backgroundColor: team.status === 'active' ? '#10B981' : '#9CA3AF' }]} />
                </View>
                
                <View style={styles.teamInfo}>
                  <Text style={[styles.teamName, { color: Colors[colorScheme].text }]} numberOfLines={1}>
                    {team.name}
                  </Text>
                  {team.sport && (
                    <View style={styles.teamMeta}>
                      <Ionicons name="basketball-outline" size={14} color={Colors[colorScheme].mutedText} />
                      <Text style={[styles.teamSport, { color: Colors[colorScheme].mutedText }]}>
                        {team.sport}
                        {team.season && ` • ${team.season}`}
                      </Text>
                    </View>
                  )}
                  <View style={styles.teamStats}>
                    <View style={styles.teamStat}>
                      <Ionicons name="people-outline" size={14} color={Colors[colorScheme].mutedText} />
                      <Text style={[styles.teamStatText, { color: Colors[colorScheme].mutedText }]}>
                        {team.members} {team.members === 1 ? 'member' : 'members'}
                      </Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.teamActions}>
                  <Pressable
                    style={[styles.teamActionButton, { backgroundColor: Colors[colorScheme].tint + '15' }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push(`/edit-team?id=${team.id}`);
                    }}
                  >
                    <Ionicons name="create-outline" size={16} color={Colors[colorScheme].tint} />
                  </Pressable>
                  <Ionicons name="chevron-forward" size={20} color={Colors[colorScheme].mutedText} />
                </View>
              </View>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 24 }}
          refreshing={refreshing}
          onRefresh={onRefresh}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Archived Teams Section - Add if there are archived teams */}
      {archivedTeams.length > 0 && (
        <View style={styles.archivedSection}>
          <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
            Archived Teams ({archivedTeams.length})
          </Text>
          {archivedTeams.slice(0, 3).map((team) => (
            <View key={team.id} style={[styles.archivedTeamCard, { backgroundColor: Colors[colorScheme].surface }]}>
              <Text style={[styles.archivedTeamName, { color: Colors[colorScheme].mutedText }]}>{team.name}</Text>
              <Pressable onPress={() => router.push(`/team-profile?id=${team.id}`)}>
                <Text style={[styles.viewLink, { color: Colors[colorScheme].tint }]}>View</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  // Header Styles
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  title: { 
    fontSize: 28, 
    fontWeight: '900', 
    marginBottom: 4 
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  // Actions Section
  actionsSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionCard: {
    width: 120,
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 6,
    alignItems: 'center',
  },
  actionCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    marginTop: 6,
    textAlign: 'center',
  },
  actionCardDesc: {
    fontSize: 10,
    color: '#fff',
    textAlign: 'center',
    marginTop: 2,
    opacity: 0.8,
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
  },
  // Stats Section
  statsSection: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  // Loading & Error
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorText: {
    marginLeft: 8,
    color: '#DC2626',
    fontWeight: '600',
  },
  // Section Titles
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  // Empty State
  emptyStateContainer: {
    flex: 1,
  },
  emptyCard: {
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  emptyActionText: {
    color: '#fff',
    fontWeight: '700',
  },
  // Team Cards
  teamCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  teamCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  teamAvatarContainer: {
    position: 'relative',
  },
  teamAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamInitials: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  statusDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  teamMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 4,
  },
  teamSport: {
    fontSize: 13,
    fontWeight: '500',
  },
  teamStats: {
    flexDirection: 'row',
    gap: 16,
  },
  teamStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  teamStatText: {
    fontSize: 13,
    fontWeight: '500',
  },
  teamActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Archived Section
  archivedSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  archivedTeamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  archivedTeamName: {
    fontSize: 14,
    fontWeight: '600',
  },
  viewLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
