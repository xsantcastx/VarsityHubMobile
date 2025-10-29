import { Organization, Team } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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

type LeagueData = {
  id: string;
  name: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  cover_url?: string;
  contact_info?: string;
};

export default function LeagueScreen() {
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [league, setLeague] = useState<LeagueData | null>(null);
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadLeague = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let organizationData: any = null;
      
      // Try to fetch organization by ID if provided
      if (params.id) {
        try {
          organizationData = await Organization.get(params.id);
        } catch (err) {
          console.error('[League] Error fetching organization by ID:', err);
        }
      }
      
      // If no organization data yet, try searching by name
      if (!organizationData && params.name) {
        try {
          const orgList = await Organization.list(params.name, 10);
          if (Array.isArray(orgList) && orgList.length > 0) {
            // Find exact match or use first result
            organizationData = orgList.find((org: any) => 
              org.name?.toLowerCase() === params.name?.toLowerCase()
            ) || orgList[0];
          }
        } catch (err) {
          console.error('[League] Error searching organizations:', err);
        }
      }
      
      // Set league data
      if (organizationData) {
        setLeague({
          id: organizationData.id,
          name: organizationData.name,
          display_name: organizationData.display_name || organizationData.name,
          avatar_url: organizationData.avatar_url,
          cover_url: organizationData.cover_url,
          bio: organizationData.bio || organizationData.description,
          contact_info: organizationData.contact_info,
        });
      } else {
        // Fallback to params if no org found
        const leagueName = params.name || 'Athletic Organization';
        setLeague({
          id: params.id || 'default',
          name: leagueName,
          display_name: leagueName,
          bio: 'Home of champions',
        });
      }

      // Fetch all teams for this organization
      const teamsData = await Team.list();
      const teamsList = Array.isArray(teamsData) ? teamsData : [];
      
      // Filter teams by organization_id or name matching
      const orgId = organizationData?.id || params.id;
      const orgName = organizationData?.name || params.name;
      
      const filteredTeams = teamsList.filter((t: any) => {
        // First try matching by organization_id
        if (orgId && t.organization_id === orgId) {
          return true;
        }
        // Otherwise match by name prefix
        if (orgName && t.name) {
          const teamNameParts = String(t.name).split(/\s+/);
          const firstPart = teamNameParts[0] || '';
          return firstPart.toLowerCase() === orgName.toLowerCase() || 
                 String(t.name).toLowerCase().includes(orgName.toLowerCase());
        }
        return false;
      });

      setTeams(filteredTeams);
    } catch (err) {
      console.error('[League] Error loading league:', err);
      setError('Failed to load league information');
    } finally {
      setLoading(false);
    }
  }, [params.id, params.name]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLeague();
    setRefreshing(false);
  }, [loadLeague]);

  useEffect(() => {
    loadLeague();
  }, [loadLeague]);

  const handleTeamPress = (team: LeagueTeam) => {
    // Navigate to team page (with Feed/Schedule/Roster)
    router.push({
      pathname: '/team-page',
      params: { 
        id: team.id,
        name: team.name,
      }
    });
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
          <Pressable onPress={loadLeague} style={[styles.retryButton, { backgroundColor: theme.tint }]}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen options={{ title: league?.display_name || 'League', headerShown: false }} />
      
      {/* Custom Header */}
      <View style={[styles.header, { 
        backgroundColor: theme.card,
        borderBottomColor: theme.border,
        paddingTop: insets.top,
      }]}>
        <Pressable 
          onPress={() => router.back()} 
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {league?.display_name || league?.name || 'League'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.tint}
            colors={[theme.tint]}
          />
        }
      >
        {/* Cover Photo */}
        <View style={styles.coverContainer}>
          {league?.cover_url ? (
            <Image
              source={{ uri: league.cover_url }}
              style={styles.coverImage}
              contentFit="cover"
            />
          ) : (
            <LinearGradient
              colors={[theme.tint, theme.tint]}
              style={styles.coverImage}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          )}
        </View>

        {/* Profile Section */}
        <View style={[styles.profileSection, { backgroundColor: theme.background }]}>
          {/* Avatar */}
          <View style={[styles.avatarContainer, { backgroundColor: theme.card }]}>
            {league?.avatar_url ? (
              <Image
                source={{ uri: league.avatar_url }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.border }]}>
                <Text style={[styles.avatarText, { color: theme.text }]}>
                  {(league?.display_name || league?.name || 'L')[0].toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* League Info */}
          <View style={styles.infoContainer}>
            <Text style={[styles.leagueName, { color: theme.text }]}>
              {league?.display_name || league?.name || 'League Name'}
            </Text>
            {league?.bio && (
              <Text style={[styles.bio, { color: theme.mutedText }]}>
                {league.bio}
              </Text>
            )}
          </View>
        </View>

        {/* Contact Info Card (if available) */}
        {league?.contact_info && (
          <View style={[styles.contactCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.contactHeader}>
              <Ionicons name="information-circle-outline" size={20} color={theme.mutedText} />
              <Text style={[styles.contactTitle, { color: theme.text }]}>Contact Info</Text>
            </View>
            <Text style={[styles.contactText, { color: theme.mutedText }]}>
              {league.contact_info}
            </Text>
          </View>
        )}

        {/* Teams Section */}
        <View style={styles.teamsSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Teams</Text>
          
          {teams.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="people-outline" size={48} color={theme.mutedText} />
              <Text style={[styles.emptyText, { color: theme.mutedText }]}>
                No teams found
              </Text>
            </View>
          ) : (
            <View style={styles.teamsGrid}>
              {teams.map((team) => (
                <Pressable
                  key={team.id}
                  style={[styles.teamCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => handleTeamPress(team)}
                >
                  {team.logo_url ? (
                    <Image
                      source={{ uri: team.logo_url }}
                      style={styles.teamLogo}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.teamLogoPlaceholder, { backgroundColor: theme.border }]}>
                      <Ionicons name="shield-outline" size={24} color={theme.mutedText} />
                    </View>
                  )}
                  <Text style={[styles.teamName, { color: theme.text }]} numberOfLines={2}>
                    {team.name}
                  </Text>
                  {team.sport && (
                    <Text style={[styles.teamSport, { color: theme.mutedText }]}>
                      {team.sport}
                    </Text>
                  )}
                  <View style={styles.teamStats}>
                    {team._count?.members !== undefined && (
                      <View style={styles.statItem}>
                        <Ionicons name="people-outline" size={14} color={theme.mutedText} />
                        <Text style={[styles.statText, { color: theme.mutedText }]}>
                          {team._count.members}
                        </Text>
                      </View>
                    )}
                    {team._count?.games !== undefined && (
                      <View style={styles.statItem}>
                        <Ionicons name="trophy-outline" size={14} color={theme.mutedText} />
                        <Text style={[styles.statText, { color: theme.mutedText }]}>
                          {team._count.games}
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerRight: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  coverContainer: {
    height: 120,
    width: '100%',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  profileSection: {
    marginTop: -30,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  infoContainer: {
    marginTop: 12,
  },
  leagueName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    lineHeight: 20,
  },
  contactCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  contactText: {
    fontSize: 14,
    lineHeight: 20,
  },
  teamsSection: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  teamsGrid: {
    gap: 12,
  },
  teamCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  teamLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  teamLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  teamSport: {
    fontSize: 14,
    marginRight: 8,
  },
  teamStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
  },
  emptyCard: {
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
});
