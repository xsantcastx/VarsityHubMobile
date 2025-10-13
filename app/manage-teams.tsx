import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
  my_role?: string;
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
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Check if user has seen the welcome modal before
  useEffect(() => {
    const checkFirstVisit = async () => {
      try {
        const hasSeenWelcome = await AsyncStorage.getItem('hasSeenManageTeamsWelcome');
        if (!hasSeenWelcome) {
          setShowWelcomeModal(true);
          await AsyncStorage.setItem('hasSeenManageTeamsWelcome', 'true');
        }
      } catch (error) {
        console.error('Error checking first visit:', error);
      }
    };
    checkFirstVisit();
  }, []);

  const loadTeams = useCallback(async ({ silent = false, searchQuery = '' }: { silent?: boolean; searchQuery?: string } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      console.log('Loading managed teams only...');
      const list: any[] = await TeamApi.managed(searchQuery || undefined); // Pass search query to API
      console.log('Loaded teams:', list.length, list.map(t => t.name));
      
      const formattedTeams = list.map((t: any) => ({
        id: String(t.id),
        name: String(t.name || 'Team'),
        members: Number(t.members || t._count?.members || 0),
        status: (t.status || 'active') as any,
        sport: t.sport || null,
        season: t.season || null,
        description: t.description || null,
        avatar_url: t.avatar_url || null,
        my_role: t.my_role || null,
      }));
      setTeams(formattedTeams);
    } catch (e: any) {
      console.error('Failed to load teams:', e);
      if (e?.status === 401) {
        setError('Please log in to view your managed teams');
      } else {
        setError('Failed to load teams');
      }
      setTeams([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        loadTeams({ silent: true, searchQuery: query.trim() });
      } else {
        loadTeams({ silent: true });
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [query, loadTeams]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { 
      await loadTeams({ silent: true, searchQuery: query.trim() || undefined }); 
    } finally { 
      setRefreshing(false); 
    }
  }, [loadTeams, query]);

  // Since search is now done at API level, we don't need frontend filtering
  const filtered = teams;
  const activeTeams = filtered.filter(t => t.status === 'active');
  const archivedTeams = filtered.filter(t => t.status === 'archived');

  const ListHeader = (
    <View>
      <View style={[styles.header]}>
        <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Manage Teams</Text>
        <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>
          Manage teams where you have administrative access
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

      {/* Contact Section */}
      <View style={[styles.contactSection, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
        <View style={styles.contactHeader}>
          <Ionicons name="mail-outline" size={24} color={Colors[colorScheme].tint} />
          <Text style={[styles.contactTitle, { color: Colors[colorScheme].text }]}>Contact</Text>
        </View>
        <Pressable 
          style={styles.contactEmailContainer}
          onPress={() => {
            // Open email client
            const email = 'customerservice@varsityhub.app';
            const mailto = `mailto:${email}`;
            import('expo-linking').then(Linking => {
              Linking.default.openURL(mailto).catch(err => console.error('Error opening email:', err));
            });
          }}
        >
          <Text style={[styles.contactEmail, { color: Colors[colorScheme].tint }]}>
            customerservice@varsityhub.app
          </Text>
        </Pressable>
        <View style={styles.contactPurposes}>
          <View style={styles.contactPurposeItem}>
            <Ionicons name="megaphone-outline" size={16} color={Colors[colorScheme].mutedText} />
            <Text style={[styles.contactPurposeText, { color: Colors[colorScheme].mutedText }]}>
              Ad acquisitions
            </Text>
          </View>
          <View style={styles.contactPurposeItem}>
            <Ionicons name="help-circle-outline" size={16} color={Colors[colorScheme].mutedText} />
            <Text style={[styles.contactPurposeText, { color: Colors[colorScheme].mutedText }]}>
              Customer service
            </Text>
          </View>
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
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background, paddingTop: 0 }]}>
      <Stack.Screen options={{ title: 'Manage Teams', headerShown: false }} />
      
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 80, backgroundColor: Colors[colorScheme].background, zIndex: 5, paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors[colorScheme].text} />
        </Pressable>
        <View style={{ flexDirection: 'column', alignItems: 'center' }}>
          <Text style={[styles.title, { color: Colors[colorScheme].text, fontSize: 20, fontWeight: '800' }]}>Manage Teams</Text>
          
        </View>
        <Pressable 
          style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors[colorScheme].tint + '15' }} 
          onPress={() => setShowWelcomeModal(true)}
        >
          <Ionicons name="help-circle-outline" size={24} color={Colors[colorScheme].tint} />
        </Pressable>
      </View>

      {/* Welcome/How It Works Modal */}
      <Modal
        visible={showWelcomeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowWelcomeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Colors[colorScheme].background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: Colors[colorScheme].text }]}></Text>
              <Pressable onPress={() => setShowWelcomeModal(false)}>
                <Ionicons name="close" size={28} color={Colors[colorScheme].text} />
              </Pressable>
            </View>

            <Text style={[styles.modalHeading, { color: Colors[colorScheme].text }]}>Create Your League Page</Text>
            <Text style={[styles.modalSubheading, { color: Colors[colorScheme].mutedText }]}>
              This is the hub where all your teams will live
            </Text>

            <View style={[styles.howItWorksBox, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <View style={styles.howItWorksHeader}>
                <Ionicons name="book-outline" size={20} color={Colors[colorScheme].tint} />
                <Text style={[styles.howItWorksTitle, { color: Colors[colorScheme].tint }]}>How it Works</Text>
              </View>

              <View style={styles.hierarchyList}>
                <View style={styles.hierarchyItem}>
                  <Ionicons name="trophy" size={18} color="#F59E0B" />
                  <Text style={[styles.hierarchyText, { color: Colors[colorScheme].text }]}>
                    <Text style={{ fontWeight: '700' }}>Your League (League Page)</Text>
                  </Text>
                </View>

                <View style={styles.hierarchySubList}>
                  <View style={styles.hierarchyItem}>
                    <Ionicons name="football" size={16} color={Colors[colorScheme].tint} />
                    <Text style={[styles.hierarchyText, { color: Colors[colorScheme].text }]}>
                      <Text style={{ fontWeight: '700' }}>Varsity Football</Text>{' '}
                      <Text style={[styles.hierarchyLabel, { color: Colors[colorScheme].tint }]}>(Team Page)</Text>
                    </Text>
                  </View>

                  <View style={styles.hierarchyItem}>
                    <Ionicons name="basketball" size={16} color="#F59E0B" />
                    <Text style={[styles.hierarchyText, { color: Colors[colorScheme].text }]}>
                      <Text style={{ fontWeight: '700' }}>JV Basketball</Text>{' '}
                      <Text style={[styles.hierarchyLabel, { color: '#F59E0B' }]}>(Team Page)</Text>
                    </Text>
                  </View>

                  <View style={styles.hierarchyItem}>
                    <Ionicons name="football" size={16} color="#10B981" />
                    <Text style={[styles.hierarchyText, { color: Colors[colorScheme].text }]}>
                      <Text style={{ fontWeight: '700' }}>Girls Soccer</Text>{' '}
                      <Text style={[styles.hierarchyLabel, { color: '#10B981' }]}>(Team Page)</Text>
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.explanationBox}>
                <Text style={[styles.explanationText, { color: Colors[colorScheme].text }]}>
                  <Text style={{ fontWeight: '700' }}>League Page:</Text> Managed by you, displays all programs
                </Text>
                <Text style={[styles.explanationText, { color: Colors[colorScheme].text, marginTop: 4 }]}>
                  <Text style={{ fontWeight: '700' }}>Team Pages:</Text> Managed by Authorized Users you assign
                </Text>
              </View>
            </View>

            <View style={styles.examplePreview}>
              <View style={[styles.exampleHeader, { backgroundColor: Colors[colorScheme].surface }]}>
                <Image 
                  source={require('../assets/images/icon.png')} 
                  style={styles.exampleLogo}
                  contentFit="cover"
                />
                <Text style={[styles.exampleTeamName, { color: Colors[colorScheme].text }]}>the Raiders</Text>
              </View>
              
              <View style={styles.exampleTabs}>
                <View style={[styles.exampleTab, { borderBottomColor: Colors[colorScheme].tint, borderBottomWidth: 2 }]}>
                  <Ionicons name="grid" size={18} color={Colors[colorScheme].tint} />
                  <Text style={[styles.exampleTabText, { color: Colors[colorScheme].tint }]}>Feed</Text>
                </View>
                <View style={styles.exampleTab}>
                  <Ionicons name="stats-chart" size={18} color={Colors[colorScheme].mutedText} />
                  <Text style={[styles.exampleTabText, { color: Colors[colorScheme].mutedText }]}>Highlights</Text>
                </View>
                <View style={styles.exampleTab}>
                  <Ionicons name="globe" size={18} color={Colors[colorScheme].mutedText} />
                  <Text style={[styles.exampleTabText, { color: Colors[colorScheme].mutedText }]}>Discover</Text>
                </View>
                <View style={styles.exampleTab}>
                  <Ionicons name="person" size={18} color={Colors[colorScheme].mutedText} />
                  <Text style={[styles.exampleTabText, { color: Colors[colorScheme].mutedText }]}>Profile</Text>
                </View>
              </View>
            </View>

            <Pressable 
              style={[styles.modalButton, { backgroundColor: Colors[colorScheme].tint }]}
              onPress={() => setShowWelcomeModal(false)}
            >
              <Text style={styles.modalButtonText}>Got it!</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      
      {activeTeams.length === 0 && !loading && !error ? (
        <View style={[styles.emptyStateContainer, { paddingTop: insets.top + 80 }]}>
          <View style={ListHeader.props.children} />
          <View style={[styles.emptyCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
            <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={32} color="#fff" />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>No managed teams found</Text>
            <Text style={[styles.emptySubtitle, { color: Colors[colorScheme].mutedText }]}>
              {query.trim() ? 
                `No teams match "${query.trim()}". Try a different search term.` :
                'You don\'t have management access to any teams yet. Create a new team or ask to be added as a manager to an existing team.'
              }
            </Text>
            <Pressable 
              style={[styles.emptyAction, { backgroundColor: Colors[colorScheme].tint }]}
              onPress={() => router.push('/create-team')}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.emptyActionText}>
                {query.trim() ? 'Create New Team' : 'Create Your First Team'}
              </Text>
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
                  
                  {/* Role Badge */}
                  {team.my_role && (
                    <View style={styles.roleContainer}>
                      <View style={[styles.roleBadge, { 
                        backgroundColor: team.my_role === 'owner' ? '#DC2626' : 
                                       team.my_role === 'manager' ? '#0EA5E9' :
                                       team.my_role === 'coach' ? '#7C3AED' : '#10B981' 
                      }]}>
                        <Text style={styles.roleText}>
                          {team.my_role === 'owner' ? 'Owner' :
                           team.my_role === 'manager' ? 'Manager' :
                           team.my_role === 'coach' ? 'Coach' :
                           team.my_role === 'assistant_coach' ? 'Asst. Coach' : team.my_role}
                        </Text>
                      </View>
                    </View>
                  )}
                  
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
          contentContainerStyle={{ paddingTop: insets.top + 80, paddingBottom: 24 }}
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
  roleContainer: {
    marginBottom: 4,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
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
  // Welcome Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 20,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.6,
  },
  modalHeading: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 8,
  },
  modalSubheading: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  howItWorksBox: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  howItWorksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  howItWorksTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  hierarchyList: {
    marginBottom: 16,
  },
  hierarchyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  hierarchySubList: {
    marginLeft: 20,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#E5E7EB',
  },
  hierarchyText: {
    fontSize: 15,
    lineHeight: 20,
    flex: 1,
  },
  hierarchyLabel: {
    fontSize: 14,
  },
  explanationBox: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 20,
  },
  examplePreview: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  exampleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  exampleLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  exampleTeamName: {
    fontSize: 18,
    fontWeight: '700',
  },
  exampleTabs: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  exampleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  exampleTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Contact Section Styles
  contactSection: {
    marginHorizontal: 16,
    marginVertical: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  contactEmailContainer: {
    marginBottom: 12,
  },
  contactEmail: {
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  contactPurposes: {
    gap: 8,
  },
  contactPurposeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactPurposeText: {
    fontSize: 14,
    lineHeight: 20,
  },
});

