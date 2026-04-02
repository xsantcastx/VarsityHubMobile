import { Game, Organization, Team, User } from '@/api/entities';
import { useAuth } from '@/context/AuthProvider';
import { Colors } from '@/constants/Colors';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeGoBack } from '@/utils/navigation';

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
  memberships?: Array<{
    user?: { id: string };
    user_id?: string;
    role?: string;
  }>;
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
};

export default function OrganizationScreen() {
  const { user } = useAuth();
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [games, setGames] = useState<GameItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [pendingCoachCount, setPendingCoachCount] = useState(0);
  const [pendingCoachError, setPendingCoachError] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [isRequestingJoin, setIsRequestingJoin] = useState(false);

  const mounted = useRef(true);
  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadOrganization = useCallback(async () => {
    if (!mounted.current || !user) return;
    setError(null);
    try {
      let orgId = params.id?.trim();

      // Fallback: if no orgId in params, look up the user's org from the server
      if (!orgId || orgId === 'undefined' || orgId === 'null' || !/^[a-zA-Z0-9_-]{1,128}$/.test(orgId)) {
        try {
          const myOrgs = await Organization.mine();
          const firstOrg = Array.isArray(myOrgs) ? myOrgs[0] : null;
          if (firstOrg?.id) {
            orgId = firstOrg.id;
          } else {
            if (mounted.current) { setError('not_found'); setLoading(false); }
            return;
          }
        } catch {
          if (mounted.current) { setError('not_found'); setLoading(false); }
          return;
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

      try {
        const currentUser = await User.me();
        if (!mounted.current) return;
        if (currentUser && orgData?.memberships && Array.isArray(orgData.memberships)) {
          const membership = orgData.memberships.find((m) => {
            const memberUserId = m.user?.id || m.user_id;
            if (memberUserId !== currentUser.id) return false;
            return ['owner', 'manager'].includes(String(m.role || '').toLowerCase());
          });
          if (mounted.current) setIsOrgAdmin(!!membership);
          // Fetch pending coach count for league owners
          if (membership) {
            Organization.pendingCoaches(orgId as string).then((pending: any) => {
              if (mounted.current) {
                setPendingCoachError(false);
                setPendingCoachCount(Array.isArray(pending) ? pending.length : 0);
              }
            }).catch(() => {
              if (mounted.current) setPendingCoachError(true);
            });
          }
        } else {
          if (mounted.current) setIsOrgAdmin(false);
        }
      } catch (err: any) {
        if (__DEV__) console.error('[organization] Failed to load current user:', err);
        if (mounted.current) setIsOrgAdmin(false);
      }

      let allTeams: any[] = [];
      try {
        allTeams = await Team.list();
      } catch (err: any) {
        if (__DEV__) console.error('[organization] Failed to load teams list:', err);
        allTeams = [];
      }

      if (!mounted.current) return;

      const orgTeams: TeamItem[] = allTeams
        .filter((t: any) => t.organization_id === orgId)
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
        const allGamesData = await Game.list('-date');
        if (!mounted.current) return;
        const allGames = Array.isArray(allGamesData) ? allGamesData : (allGamesData?.games || allGamesData?.items || []);
        const teamNames = orgTeams.map((t) => t.name.toLowerCase());
        const orgGames: GameItem[] = allGames
          .filter((g: any) => {
            const homeTeam = (g.home_team || '').toLowerCase();
            const awayTeam = (g.away_team || '').toLowerCase();
            return teamNames.some((name) => homeTeam.includes(name) || awayTeam.includes(name));
          })
          .map((g: any) => ({
            id: String(g.id),
            date: g.date,
            scheduled_date: g.scheduled_date,
            home_team: g.home_team,
            away_team: g.away_team,
            opponent_name: g.opponent_name,
            location: g.location,
            game_type: g.game_type,
          }))
          .sort((a: GameItem, b: GameItem) => {
            const dateA = new Date((a.scheduled_date || a.date) as string).getTime();
            const dateB = new Date((b.scheduled_date || b.date) as string).getTime();
            return dateA - dateB;
          });
        setGames(orgGames);
      } catch (err: any) {
        if (__DEV__) console.error('[organization] Failed to load games:', err);
        if (mounted.current) setGames([]);
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
    router.push({ pathname: '/team-profile', params: { id: team.id, name: team.name } });
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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      </SafeAreaView>
    );
  }

  if (error === 'not_found') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="business" size={48} color={theme.mutedText} style={{ marginBottom: 12 }} />
          <Text style={[styles.errorText, { color: theme.text, fontSize: 18, fontWeight: '600' }]}>Not Found</Text>
          <Text style={{ color: theme.mutedText, textAlign: 'center', marginTop: 4, marginBottom: 16 }}>This organization doesn't exist or the link is invalid.</Text>
          <Pressable onPress={() => safeGoBack(router)} style={[styles.retryButton, { backgroundColor: theme.tint }]}>
            <Text style={styles.retryText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
          <Pressable onPress={loadOrganization} style={[styles.retryButton, { backgroundColor: theme.tint }]}>
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
  const upcomingGames = games
    .filter((g) => {
      const d = g.scheduled_date || g.date;
      return d && new Date(d as string) >= new Date();
    })
    .slice(0, 10);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen options={{ title: orgName, headerShown: false }} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} colors={[theme.tint]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button */}
        <Pressable
          onPress={() => safeGoBack(router)}
          style={[styles.backButton, { borderColor: theme.border }]}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>

        {/* Admin: View Join Requests */}
        {isOrgAdmin && organization?.id && (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/organization-join-requests',
                  params: { organization_id: organization.id, organization_name: organization.name || orgName },
                })
              }
              style={[styles.adminButton, { backgroundColor: theme.tint, flex: 1 }]}
            >
              <Ionicons name="people" size={20} color="#fff" />
              <Text style={styles.adminButtonText}>Coach Requests</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Alert.prompt(
                  'Invite Coach',
                  'Enter the email address of the coach to invite:',
                  async (email) => {
                    if (!email?.trim()) return;
                    try {
                      await Organization.invite(organization.id, email.trim(), 'member');
                      Alert.alert('Invited', `Invitation sent to ${email.trim()}`);
                    } catch (err: any) {
                      Alert.alert('Error', err?.data?.error || err?.message || 'Failed to send invite');
                    }
                  },
                  'plain-text',
                  '',
                  'email-address'
                );
              }}
              style={[styles.adminButton, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, flex: 1 }]}
            >
              <Ionicons name="person-add-outline" size={20} color={theme.text} />
              <Text style={[styles.adminButtonText, { color: theme.text }]}>Invite Coach</Text>
            </Pressable>
          </View>
        )}

        {/* Cover Image */}
        <View style={[styles.card, styles.coverCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {organization?.background_url ? (
            <Image source={{ uri: organization.background_url }} style={styles.coverImage} contentFit="cover" />
          ) : (
            <View style={[styles.coverPlaceholder, { borderColor: theme.border }]}>
              <Ionicons name="business-outline" size={28} color={theme.mutedText} />
              <Text style={[styles.placeholderText, { color: theme.mutedText }]}>No cover image</Text>
            </View>
          )}
        </View>

        {/* Profile Card */}
        <View style={[styles.card, styles.profileCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
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
              <Text style={[styles.statLabel, { color: theme.mutedText }]}> Teams  </Text>
              <Text style={[styles.statNumber, { color: theme.text }]}>{organization?.followers_count ?? 0}</Text>
              <Text style={[styles.statLabel, { color: theme.mutedText }]}> Followers</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          {isOrgAdmin ? (
            <Pressable
              style={[styles.actionBtn, { flex: 1, backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}
              onPress={() => router.push({ pathname: '/edit-organization', params: { id: organization?.id } })}
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
                      setOrganization((prev) =>
                        prev ? { ...prev, followers_count: Math.max(0, (prev.followers_count ?? 0) - 1) } : null
                      );
                    } else {
                      await Organization.follow(organization.id);
                      setIsFollowing(true);
                      setOrganization((prev) =>
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
                <Ionicons name={isFollowing ? 'checkmark' : 'add'} size={16} color={isFollowing ? '#fff' : theme.tint} />
                <Text style={[styles.actionBtnText, { color: isFollowing ? '#fff' : theme.tint }]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.actionBtn,
                  { flex: 1, backgroundColor: 'transparent', borderColor: theme.border, borderWidth: 1 },
                ]}
                disabled={isRequestingJoin}
                onPress={async () => {
                  if (!organization?.id) return;
                  setIsRequestingJoin(true);
                  try {
                    await Organization.requestToJoin(organization.id);
                    Alert.alert('Request Sent', 'Your request to join this organization has been submitted.');
                  } catch (err: any) {
                    Alert.alert('Error', err?.message || 'Failed to send join request.');
                  } finally {
                    setIsRequestingJoin(false);
                  }
                }}
              >
                {isRequestingJoin ? (
                  <ActivityIndicator size="small" color={theme.text} />
                ) : (
                  <>
                    <Ionicons name="person-add-outline" size={16} color={theme.text} />
                    <Text style={[styles.actionBtnText, { color: theme.text }]}>Request to Join</Text>
                  </>
                )}
              </Pressable>
            </>
          )}
        </View>

        {/* Pending Coaches Quick Action */}
        {isOrgAdmin && pendingCoachError && organization?.id && (
          <Pressable
            style={[styles.card, styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12 }]}
            onPress={() => router.push('/approvals')}
          >
            <MaterialIcons name="error-outline" size={24} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, color: '#DC2626', fontWeight: '600' }}>Could not load pending coaches</Text>
              <Text style={{ fontSize: 12, color: theme.mutedText, marginTop: 2 }}>Tap to open approvals</Text>
            </View>
          </Pressable>
        )}
        {isOrgAdmin && pendingCoachCount > 0 && organization?.id && (
          <Pressable
            style={[styles.card, styles.sectionCard, { backgroundColor: '#FEF9C3', borderColor: '#DAA520', flexDirection: 'row', alignItems: 'center', gap: 12 }]}
            onPress={() => router.push('/approvals')}
          >
            <MaterialIcons name="group-add" size={24} color="#DAA520" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#92400E' }}>
                {pendingCoachCount} coach{pendingCoachCount !== 1 ? 'es' : ''} pending approval
              </Text>
              <Text style={{ fontSize: 12, color: '#A16207', marginTop: 2 }}>Tap to review requests</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#DAA520" />
          </Pressable>
        )}

        {/* About */}
        <View style={[styles.card, styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>About</Text>
          {orgBio ? (
            <Text style={[styles.bioText, { color: theme.text }]}>
              {orgBio}
            </Text>
          ) : null}
          {contactText && (
            <View style={[styles.contactRow, { borderColor: theme.border }]}>
              <Ionicons name="mail-outline" size={16} color={theme.mutedText} />
              <Text style={[styles.contactText, { color: theme.mutedText }]} selectable>{contactText}</Text>
            </View>
          )}
          {organization?.created_at && (
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={14} color={theme.mutedText} />
              <Text style={[styles.metaText, { color: theme.mutedText }]}>
                Created {new Date(organization.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
            </View>
          )}
        </View>

        {/* Location */}
        {locationText ? (
          <View style={[styles.card, styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Location</Text>
            <Pressable onPress={handleLocationPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="location-outline" size={16} color={theme.tint} />
              <Text style={{ color: theme.tint }}>{locationText}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Teams */}
        <View style={[styles.card, styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Teams</Text>
          {teams.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.mutedText }]}>No teams yet.</Text>
          ) : (
            teams.map((team) => {
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
                      <Text style={[styles.rowSubtitle, { color: theme.mutedText }]} numberOfLines={1}>
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

        {/* Upcoming Events */}
        <View style={[styles.card, styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Upcoming Events</Text>
          {upcomingGames.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.mutedText }]}>No upcoming events.</Text>
          ) : (
            upcomingGames.map((game) => {
              const dateStr = formatEventDate(game.scheduled_date || game.date);
              const opponent = game.opponent_name || game.away_team || 'TBD';
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
                      vs {opponent}
                    </Text>
                    <View style={styles.eventMetaRow}>
                      <Text style={[styles.rowSubtitle, { color: theme.mutedText }]}>{dateStr}</Text>
                      {game.location && (
                        <>
                          <Text style={[styles.rowSubtitle, { color: theme.mutedText }]}> • </Text>
                          <Text style={[styles.rowSubtitle, { color: theme.mutedText }]} numberOfLines={1}>
                            {game.location}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.mutedText} />
                </Pressable>
              );
            })
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
});
