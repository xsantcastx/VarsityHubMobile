import { Event, Organization, Team } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type LeagueTeam = {
  id: string;
  name: string;
  sport?: string | null;
  season?: string | null;
  logo_url?: string | null;
  description?: string | null;
  organization_id?: string | null;
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

type LeagueEvent = {
  id: string;
  title: string;
  date: string;
  location?: string;
  event_type?: string;
  description?: string;
  attendees_count?: number;
  creator?: {
    id: string;
    display_name: string;
  };
};

const toParamString = (value?: string | string[] | null): string | null => {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
};

const formatSeasonRange = (seasonStart?: string | null, seasonEnd?: string | null): string | null => {
  if (!seasonStart && !seasonEnd) return null;
  const toLabel = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString(undefined, { month: 'short', year: 'numeric' });
  };

  const startLabel = toLabel(seasonStart);
  const endLabel = toLabel(seasonEnd);

  if (startLabel && endLabel) {
    if (startLabel === endLabel) return startLabel;
    return `${startLabel} - ${endLabel}`;
  }

  return startLabel || endLabel;
};

const normalizeTeam = (team: any): LeagueTeam | null => {
  if (!team || !team.id) return null;

  const memberCount =
    typeof team?._count?.memberships === 'number'
      ? team._count.memberships
      : typeof team?.members === 'number'
        ? team.members
        : undefined;

  const normalizedCount =
    typeof memberCount === 'number'
      ? { members: memberCount }
      : undefined;

  const organizationId =
    team.organization_id ??
    (team.organization && 'id' in team.organization ? team.organization.id : null);

  return {
    id: String(team.id),
    name: team.name || 'Team',
    sport: team.sport || null,
    season: team.season || formatSeasonRange(team.season_start, team.season_end),
    logo_url: team.logo_url || team.avatar_url || null,
    description: team.description || null,
    organization_id: organizationId ? String(organizationId) : null,
    _count: normalizedCount,
  };
};

const normalizeTeams = (teams: any[]): LeagueTeam[] => {
  return (Array.isArray(teams) ? teams : [])
    .map(normalizeTeam)
    .filter((team): team is LeagueTeam => Boolean(team))
    .sort((a, b) => a.name.localeCompare(b.name));
};

const extractLeagueTeams = (organizationData: any, fallbackName?: string | string[] | null): LeagueTeam[] => {
  if (!organizationData) return [];
  if (Array.isArray(organizationData.teams)) {
    const teams = normalizeTeams(organizationData.teams);
    if (teams.length > 0) return teams;
  }

  // If the organization response included memberships with nested teams, flatten them
  if (Array.isArray(organizationData.memberships)) {
    const memberTeams = organizationData.memberships
      .map((membership: any) => membership.team)
      .filter(Boolean);
    const teams = normalizeTeams(memberTeams);
    if (teams.length > 0) return teams;
  }

  if (fallbackName) {
    const fallback = toParamString(fallbackName);
    if (fallback) {
      return normalizeTeams(
        (organizationData.teams || []).filter((team: any) =>
          String(team?.name || '').toLowerCase().includes(fallback.toLowerCase())
        )
      );
    }
  }

  return [];
};

const filterTeamsByOrganization = (
  teamsData: any,
  organizationId?: string | string[] | null,
  organizationName?: string | string[] | null
): LeagueTeam[] => {
  const orgId = toParamString(organizationId);
  const orgName = toParamString(organizationName)?.toLowerCase();

  if (!Array.isArray(teamsData)) return [];

  const filtered = teamsData.filter((team: any) => {
    const teamOrgId =
      team.organization_id ??
      (team.organization && 'id' in team.organization ? team.organization.id : null);

    if (orgId && teamOrgId && String(teamOrgId) === orgId) {
      return true;
    }

    if (orgName) {
      const organizationMatch = String(team.organization_name || team.organization?.name || '')
        .toLowerCase()
        .includes(orgName);
      if (organizationMatch) return true;

      const teamNameMatch = String(team.name || '').toLowerCase().includes(orgName);
      if (teamNameMatch) return true;
    }

    return false;
  });

  return normalizeTeams(filtered);
};

export default function LeagueScreen() {
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [league, setLeague] = useState<LeagueData | null>(null);
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [events, setEvents] = useState<LeagueEvent[]>([]);
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
            
            // Fetch full organization details if we only have partial data
            if (organizationData?.id) {
              try {
                organizationData = await Organization.get(organizationData.id);
              } catch (err) {
                console.error('[League] Error fetching organization from search result:', err);
              }
            }
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

      const formattedTeams = extractLeagueTeams(organizationData, params.name);

      // Fallback: if organization response didn't include teams, filter from all teams
      if (formattedTeams.length === 0) {
        try {
          const allTeamsData = await Team.list();
          const orgId = organizationData?.id || params.id;
          const orgName = organizationData?.name || params.name;
          const fallbackTeams = filterTeamsByOrganization(allTeamsData, orgId, orgName);
          setTeams(fallbackTeams);
        } catch (teamErr) {
          console.error('[League] Error loading fallback teams:', teamErr);
          setTeams([]);
        }
      } else {
        setTeams(formattedTeams);
      }

      // Load events for this league
      try {
        const leagueId = organizationData?.id || params.id;
        const leagueName = organizationData?.name || params.name;
        
        if (leagueId || leagueName) {
          const eventsData = await Event.filter({ status: 'approved' });
          
          // Filter events linked to this league
          const linkedEvents = (Array.isArray(eventsData) ? eventsData : [])
            .filter((event: any) => {
              // Only show approved events
              if (event.approval_status !== 'approved') return false;
              
              // Match by linked_league field
              if (leagueId && event.linked_league === leagueId) return true;
              if (leagueName && event.linked_league?.toLowerCase() === leagueName.toLowerCase()) return true;
              
              return false;
            })
            .map((event: any) => ({
              id: String(event.id),
              title: event.title,
              date: event.date,
              location: event.location,
              event_type: event.event_type,
              description: event.description,
              attendees_count: event.attendees_count || event.rsvp_count || 0,
              creator: event.creator ? {
                id: String(event.creator.id),
                display_name: event.creator.display_name || event.creator.name || 'Unknown'
              } : undefined,
            }))
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          setEvents(linkedEvents);
        } else {
          setEvents([]);
        }
      } catch (eventErr) {
        console.error('[League] Error loading events:', eventErr);
        setEvents([]);
      }
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

  const handleEventPress = (event: LeagueEvent) => {
    router.push({
      pathname: '/event-detail',
      params: { id: event.id }
    });
  };

  const formatEventDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      
      const daysDiff = Math.floor((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 0) return 'Today';
      if (daysDiff === 1) return 'Tomorrow';
      if (daysDiff === -1) return 'Yesterday';
      
      const options: Intl.DateTimeFormatOptions = { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      };
      return date.toLocaleDateString(undefined, options);
    } catch {
      return dateString;
    }
  };

  const getEventTypeIcon = (eventType?: string): keyof typeof Ionicons.glyphMap => {
    switch (eventType) {
      case 'game': return 'football';
      case 'watch_party': return 'tv';
      case 'fundraiser': return 'cash';
      case 'tryout': return 'fitness';
      case 'bbq': return 'restaurant';
      default: return 'calendar';
    }
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

  const handle = league?.name?.replace(/\s+/g, '').toLowerCase() ?? null;
  const contactText = league?.contact_info?.trim() ? league.contact_info : 'Not set';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen options={{ title: league?.display_name || 'League', headerShown: false }} />

      <ScrollView
        contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}
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
        <Pressable onPress={() => router.back()} style={[styles.backButton, { borderColor: theme.border }]}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>

        <View style={[styles.card, styles.coverCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {league?.cover_url ? (
            <Image source={{ uri: league.cover_url }} style={styles.coverImage} contentFit="cover" />
          ) : (
            <View style={[styles.coverPlaceholder, { borderColor: theme.border }]}>
              <Ionicons name="image-outline" size={24} color={theme.mutedText} />
              <Text style={[styles.placeholderText, { color: theme.mutedText }]}>
                Cover image not set
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.card, styles.profileCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.avatarShell, { borderColor: theme.border }]}>
            {league?.avatar_url ? (
              <Image source={{ uri: league.avatar_url }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: theme.surface }]}>
                <Text style={[styles.avatarInitial, { color: theme.mutedText }]}>
                  {(league?.display_name || league?.name || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.profileText}>
            <Text style={[styles.profileName, { color: theme.text }]}>
              {league?.display_name || league?.name || 'League'}
            </Text>
            {handle && (
              <Text style={[styles.profileHandle, { color: theme.mutedText }]}>
                @{handle}
              </Text>
            )}
          </View>
        </View>

        <View style={[styles.card, styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.infoTitle, { color: theme.text }]}>About</Text>
          <Text style={[styles.infoBody, { color: league?.bio ? theme.text : theme.mutedText }]}>
            {league?.bio || 'This league has not added a description yet.'}
          </Text>
          <View style={[styles.infoRow, { borderColor: theme.border }]}>
            <Ionicons name="person-outline" size={16} color={theme.mutedText} />
            <Text style={[styles.infoRowText, { color: theme.mutedText }]}>
              Contact: {contactText}
            </Text>
          </View>
        </View>

        <View style={[styles.card, styles.teamsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.teamsTitle, { color: theme.text }]}>Teams</Text>
          {teams.length === 0 ? (
            <Text style={[styles.emptyTeamsText, { color: theme.mutedText }]}>
              No teams listed yet.
            </Text>
          ) : (
            teams.map((team) => {
              const subline = [team.sport, team.season].filter(Boolean).join(' • ');
              return (
                <Pressable
                  key={team.id}
                  style={[styles.teamButton, { borderColor: theme.border }]}
                  onPress={() => handleTeamPress(team)}
                >
                  <View style={styles.teamButtonText}>
                    <Text style={[styles.teamButtonTitle, { color: theme.text }]} numberOfLines={1}>
                      {team.name}
                    </Text>
                    {subline.length > 0 && (
                      <Text style={[styles.teamButtonSubtitle, { color: theme.mutedText }]} numberOfLines={1}>
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

        <View style={[styles.card, styles.eventsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.eventsTitle, { color: theme.text }]}>Upcoming Events</Text>
          {events.length === 0 ? (
            <Text style={[styles.emptyEventsText, { color: theme.mutedText }]}>
              No events scheduled yet.
            </Text>
          ) : (
            events.map((event) => (
              <Pressable
                key={event.id}
                style={[styles.eventButton, { borderColor: theme.border }]}
                onPress={() => handleEventPress(event)}
              >
                <View style={[styles.eventIconContainer, { backgroundColor: theme.surface }]}>
                  <Ionicons name={getEventTypeIcon(event.event_type)} size={20} color={theme.tint} />
                </View>
                <View style={styles.eventButtonText}>
                  <Text style={[styles.eventButtonTitle, { color: theme.text }]} numberOfLines={1}>
                    {event.title}
                  </Text>
                  <View style={styles.eventMetaRow}>
                    <Text style={[styles.eventButtonMeta, { color: theme.mutedText }]} numberOfLines={1}>
                      {formatEventDate(event.date)}
                    </Text>
                    {event.location && (
                      <>
                        <Text style={[styles.eventMetaDot, { color: theme.mutedText }]}>•</Text>
                        <Text style={[styles.eventButtonMeta, { color: theme.mutedText }]} numberOfLines={1}>
                          {event.location}
                        </Text>
                      </>
                    )}
                    {(event.attendees_count ?? 0) > 0 && (
                      <>
                        <Text style={[styles.eventMetaDot, { color: theme.mutedText }]}>•</Text>
                        <Text style={[styles.eventButtonMeta, { color: theme.mutedText }]}>
                          {event.attendees_count} {event.attendees_count === 1 ? 'attendee' : 'attendees'}
                        </Text>
                      </>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.mutedText} />
              </Pressable>
            ))
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
  content: {
    padding: 16,
    gap: 16,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  coverCard: {
    padding: 0,
    height: 140,
    overflow: 'hidden',
  },
  coverPlaceholder: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
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
  },
  avatarShell: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
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
  avatarInitial: {
    fontSize: 24,
    fontWeight: '700',
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
  infoCard: {
    gap: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  infoBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  infoRowText: {
    fontSize: 14,
  },
  teamsCard: {
    gap: 12,
  },
  teamsTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyTeamsText: {
    fontSize: 14,
  },
  teamButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  teamButtonText: {
    flex: 1,
    gap: 2,
  },
  teamButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  teamButtonSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  eventsCard: {
    gap: 12,
  },
  eventsTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyEventsText: {
    fontSize: 14,
  },
  eventButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventButtonText: {
    flex: 1,
    gap: 4,
  },
  eventButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  eventButtonMeta: {
    fontSize: 12,
    fontWeight: '500',
  },
  eventMetaDot: {
    fontSize: 12,
    marginHorizontal: 2,
  },
});
