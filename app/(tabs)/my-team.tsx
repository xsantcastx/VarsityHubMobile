import CoachAccessRedirecting from '@/components/CoachAccessRedirecting';
import CustomActionModal from '@/components/CustomActionModal';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ManagedTeam, useManagedTeamsQuery } from '@/hooks/useManagedTeamsQuery';
import { useRequireTeamManagement } from '@/hooks/useRequireTeamManagement';
import { useTeamMembersQuery } from '@/hooks/useTeamMembersQuery';
import { handleCoachAccessError } from '@/utils/coachAccess';
import { getAssignableTeamRoles } from '@/utils/roleChecks';
import { safeGoBack } from '@/utils/navigation';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
// @ts-ignore JS exports
import { Team as TeamApi } from '@/api/entities';

type MemberUser = {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  username?: string;
  is_parent?: boolean;
};

type TeamMember = {
  id: string;
  role: string;
  status: string;
  position?: string;
  jersey_number?: string;
  user: MemberUser;
};

type RawTeamMember = {
  id: string;
  role?: string | null;
  status?: string | null;
  position?: string | null;
  custom_position?: string | null;
  jersey_number?: string | null;
  user?: {
    id?: string | null;
    email?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
    username?: string | null;
    is_parent?: boolean | null;
  } | null;
};

type ApiErrorLike = {
  message?: string;
};

const selectRosterMembers = (list: any[]): TeamMember[] =>
  (list as RawTeamMember[]).map(m => ({
    id: String(m.id),
    role: m.role || 'member',
    status: m.status || 'active',
    position: m.position || m.custom_position || undefined,
    jersey_number: m.jersey_number || undefined,
    user: {
      id: String(m.user?.id || ''),
      email: m.user?.email || '',
      display_name: m.user?.display_name || m.user?.email || 'Unknown',
      avatar_url: m.user?.avatar_url || undefined,
      username: m.user?.username || undefined,
      is_parent: m.user?.is_parent || false,
    },
  }));

function resolveNextSelectedTeamId(
  teams: ManagedTeam[],
  routeTeamId: string | null,
  previousSelectedTeamId: string | null
): string | null {
  if (teams.length === 0) return null;
  if (routeTeamId && teams.some(team => team.id === routeTeamId)) {
    return routeTeamId;
  }
  if (previousSelectedTeamId && teams.some(team => team.id === previousSelectedTeamId)) {
    return previousSelectedTeamId;
  }
  return teams[0].id;
}

// 2026-07-09: player/parent/member retired as assignable roles — teams hold
// staff only. ROLE_LABELS/badges below keep the legacy labels for display of
// pre-existing rows until the archive script has run.
const ROLE_OPTIONS = ['owner', 'manager', 'coach', 'assistant_coach'] as const;
type Role = (typeof ROLE_OPTIONS)[number];

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  coach: 'Coach',
  assistant_coach: 'Asst. Coach',
  player: 'Player',
  parent: 'Parent',
  member: 'Member',
};

function getRoleBadgeColor(role: string): { bg: string; text: string } {
  switch (role) {
    case 'owner':
      return { bg: '#7C3AED', text: '#FFFFFF' };
    case 'manager':
      return { bg: '#D97706', text: '#FFFFFF' };
    case 'coach':
    case 'assistant_coach':
      return { bg: '#2563EB', text: '#FFFFFF' };
    case 'player':
      return { bg: '#16A34A', text: '#FFFFFF' };
    case 'parent':
      return { bg: '#9333EA', text: '#FFFFFF' };
    default:
      return { bg: '#6B7280', text: '#FFFFFF' };
  }
}

function MyTeamScreen() {
  const { user } = useAuth();
  const { canManage, loading: coachLoading } = useRequireTeamManagement();
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const params = useLocalSearchParams<{
    teamId?: string;
    fallback?: string;
    orgId?: string;
    orgTab?: string;
  }>();

  const routeTeamId =
    typeof params.teamId === 'string' && params.teamId.trim().length > 0
      ? params.teamId.trim()
      : null;
  const explicitFallback =
    typeof params.fallback === 'string' && params.fallback.trim().startsWith('/')
      ? params.fallback.trim()
      : params.orgId
        ? `/organization?id=${encodeURIComponent(params.orgId)}&tab=${encodeURIComponent(params.orgTab || 'teams')}`
        : '/organization?tab=teams';

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Member action modal
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);

  // Edit role modal
  const [showRoleModal, setShowRoleModal] = useState(false);

  // Edit position modal
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [positionInput, setPositionInput] = useState('');

  // Remove confirm modal
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('assistant_coach');
  const [inviting, setInviting] = useState(false);
  const [memberActionLoading, setMemberActionLoading] = useState(false);

  // Team selector
  const [showTeamPicker, setShowTeamPicker] = useState(false);

  // Guard: useRequireTeamManagement handles redirect for users who can't manage

  const {
    data: teams = [],
    isPending: teamsPending,
    isError: teamsIsError,
    error: teamsError,
    refetch: refetchTeams,
  } = useManagedTeamsQuery({
    userId: user?.id,
    enabled: !!user && canManage && !coachLoading,
  });

  // If the managed() call failed with a specific coach-access error code,
  // route via the shared handler instead of showing the generic error card.
  // Mirrors the manage-teams pattern: `handledByCoachAccess` tracks whether
  // the CURRENT error was already special-cased so the generic error card
  // doesn't also render underneath the Alert.
  const [handledByCoachAccess, setHandledByCoachAccess] = useState(false);
  const lastHandledTeamsErrorRef = useRef<unknown>(null);
  useEffect(() => {
    if (!teamsIsError || !teamsError) {
      lastHandledTeamsErrorRef.current = null;
      setHandledByCoachAccess(false);
      return;
    }
    if (lastHandledTeamsErrorRef.current === teamsError) return;
    lastHandledTeamsErrorRef.current = teamsError;
    setHandledByCoachAccess(handleCoachAccessError(router, teamsError, 'loading your teams', user));
  }, [teamsIsError, teamsError, router, user]);

  const error = teamsIsError && !handledByCoachAccess ? 'Unable to load teams.' : null;

  // Keep the selected team valid as the teams list changes: prefer the route
  // param, then the previous selection, then the first team. The functional
  // update keeps `selectedTeamId` out of the deps (resolve is idempotent, so
  // re-running with the same inputs bails via React's same-value setState).
  useEffect(() => {
    setSelectedTeamId(prev => resolveNextSelectedTeamId(teams, routeTeamId, prev));
  }, [teams, routeTeamId]);

  // The shared ['team-members', teamId] entry caches the raw response;
  // this select maps it to the roster shape. Module-level so its identity
  // is stable across renders (keeps the mapped array referentially stable).
  const {
    data: members = [],
    isPending: membersPending,
    isError: membersIsError,
    error: membersError,
    refetch: refetchMembers,
  } = useTeamMembersQuery({
    teamId: selectedTeamId,
    enabled: !!selectedTeamId && canManage && !coachLoading,
    select: selectRosterMembers,
  });

  // Members failures previously emptied the roster silently (except
  // coach-access errors, which redirect). The query keeps `members` at the
  // empty default on error; this effect preserves the redirect special case.
  const lastHandledMembersErrorRef = useRef<unknown>(null);
  useEffect(() => {
    if (!membersIsError || !membersError) {
      lastHandledMembersErrorRef.current = null;
      return;
    }
    if (lastHandledMembersErrorRef.current === membersError) return;
    lastHandledMembersErrorRef.current = membersError;
    if (handleCoachAccessError(router, membersError, 'loading team members', user)) return;
    if (__DEV__) console.error('Failed to load members:', membersError);
  }, [membersIsError, membersError, router, user]);

  // Full-screen spinner only while there's no cached data yet (isPending),
  // never during background revalidation — see lib/queryClient.ts.
  const loading = teamsPending || (!!selectedTeamId && membersPending);

  // Auto-refresh when the screen regains focus (e.g. after roster changes on
  // another screen). Skip the very first focus — mount already triggers the
  // initial fetch. Background-only: refetch() doesn't flip isPending once data
  // exists, so this never re-shows the blocking spinner.
  const hasLoadedTeamsRef = useRef(false);
  hasLoadedTeamsRef.current = hasLoadedTeamsRef.current || !teamsPending;
  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedTeamsRef.current) return undefined;
      void refetchTeams().catch(e => {
        if (__DEV__) console.warn('[MyTeam] focus reload error:', e);
      });
      return undefined;
    }, [refetchTeams])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchTeams(),
        selectedTeamId ? refetchMembers() : Promise.resolve(null),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchTeams, refetchMembers, selectedTeamId]);

  const handleUpdateRole = useCallback(
    async (role: Role) => {
      if (!selectedMember || memberActionLoading) return;
      setMemberActionLoading(true);
      try {
        await TeamApi.updateMember(selectedMember.id, { role });
        if (selectedTeamId) await refetchMembers();
        setShowRoleModal(false);
        setSelectedMember(null);
      } catch (error: unknown) {
        const e = error as ApiErrorLike;
        if (handleCoachAccessError(router, e, 'updating team roles', user)) {
          return;
        }
        Alert.alert('Error', e?.message || 'Failed to update role.');
      } finally {
        setMemberActionLoading(false);
      }
    },
    [selectedMember, selectedTeamId, refetchMembers, memberActionLoading, router, user]
  );

  const handleUpdatePosition = useCallback(async () => {
    if (!selectedMember || memberActionLoading) return;
    setMemberActionLoading(true);
    try {
      await TeamApi.updateMember(selectedMember.id, { custom_position: positionInput.trim() });
      if (selectedTeamId) await refetchMembers();
      setShowPositionModal(false);
      setSelectedMember(null);
      setPositionInput('');
    } catch (error: unknown) {
      const e = error as ApiErrorLike;
      if (handleCoachAccessError(router, e, 'updating team positions', user)) {
        return;
      }
      Alert.alert('Error', e?.message || 'Failed to update position.');
    } finally {
      setMemberActionLoading(false);
    }
  }, [
    selectedMember,
    selectedTeamId,
    positionInput,
    refetchMembers,
    memberActionLoading,
    router,
    user,
  ]);

  const handleRemoveMember = useCallback(async () => {
    if (!selectedMember || memberActionLoading) return;
    setMemberActionLoading(true);
    try {
      await TeamApi.removeMember(selectedMember.id, 'Removed by team manager');
      if (selectedTeamId) await refetchMembers();
      setShowRemoveModal(false);
      setSelectedMember(null);
    } catch (error: unknown) {
      const e = error as ApiErrorLike;
      if (handleCoachAccessError(router, e, 'removing team members', user)) {
        return;
      }
      Alert.alert('Error', e?.message || 'Failed to remove member.');
    } finally {
      setMemberActionLoading(false);
    }
  }, [selectedMember, selectedTeamId, refetchMembers, memberActionLoading, router, user]);

  const handleInvite = useCallback(async () => {
    if (!selectedTeamId || !inviteIdentifier.trim()) return;
    setInviting(true);
    try {
      await TeamApi.invite(selectedTeamId, inviteIdentifier.trim(), inviteRole);
      Alert.alert('Invited', `Invitation sent to ${inviteIdentifier.trim()}`);
      setShowInviteModal(false);
      setInviteIdentifier('');
      setInviteRole('assistant_coach');
      await refetchMembers();
    } catch (error: unknown) {
      const e = error as ApiErrorLike;
      if (handleCoachAccessError(router, e, 'sending team invites', user)) {
        return;
      }
      Alert.alert('Error', (e as any)?.data?.message || e?.message || 'Failed to send invitation.');
    } finally {
      setInviting(false);
    }
  }, [selectedTeamId, inviteIdentifier, inviteRole, refetchMembers, router, user]);

  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  // Mirror the server's canAssignTeamRole so the pickers only offer roles this
  // user can actually grant (manager → team owner / org admin only; owner never
  // here). The actor's team role comes from their own row in the roster. Org
  // admins who lack a direct team-leadership role are covered by the platform
  // is_admin flag; any residual case is still enforced server-side (403).
  const myTeamRole = useMemo(
    () => members.find(m => user?.id && m.user.id === user.id)?.role ?? null,
    [members, user?.id]
  );
  const roleActor = useMemo(
    () => ({ teamRole: myTeamRole, isOrgAdmin: (user as any)?.is_admin === true }),
    [myTeamRole, user]
  );

  // Roster management (edit role/position, remove, invite) is FULL administration
  // (owner/head coach/org owner), NOT the staff tier this screen admits via
  // useRequireTeamManagement. Managers/assistant_coaches must not see these
  // actions — the server 403s them. Derived from the viewer's direct team role
  // (owner|coach) or platform admin. (Org-owner-without-a-team-role is a known
  // minor gap — they'd need a direct role or admin-summary to be admitted here.)
  const canAdministerRoster = useMemo(
    () => myTeamRole === 'owner' || myTeamRole === 'coach' || (user as any)?.is_admin === true,
    [myTeamRole, user]
  );

  const renderMember = ({ item }: { item: TeamMember }) => {
    const badge = getRoleBadgeColor(item.role);
    return (
      <Pressable
        onLongPress={() => {
          if (!canAdministerRoster) return;
          setSelectedMember(item);
          setShowActionModal(true);
        }}
        style={[
          styles.memberCard,
          {
            backgroundColor: Colors[colorScheme].surface,
            borderColor: Colors[colorScheme].border,
          },
        ]}
      >
        {item.user.avatar_url ? (
          <Image source={{ uri: item.user.avatar_url }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatar,
              styles.avatarPlaceholder,
              { backgroundColor: Colors[colorScheme].border },
            ]}
          >
            <MaterialIcons name="person" size={22} color={Colors[colorScheme].mutedText} />
          </View>
        )}

        <View style={styles.memberInfo}>
          <View style={styles.memberNameRow}>
            <Text
              style={[styles.memberName, { color: Colors[colorScheme].text }]}
              numberOfLines={1}
            >
              {item.user.display_name}
            </Text>
            {item.jersey_number ? (
              <Text style={[styles.jerseyNumber, { color: Colors[colorScheme].mutedText }]}>
                #{item.jersey_number}
              </Text>
            ) : null}
          </View>
          <View style={styles.memberMeta}>
            {item.role !== 'fan' && (
              <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.roleBadgeText, { color: badge.text }]}>
                  {ROLE_LABELS[item.role] || item.role}
                </Text>
              </View>
            )}
            {item.position ? (
              <Text style={[styles.positionText, { color: Colors[colorScheme].mutedText }]}>
                {item.position}
              </Text>
            ) : null}
          </View>
        </View>

        <MaterialIcons name="more-vert" size={20} color={Colors[colorScheme].mutedText} />
      </Pressable>
    );
  };

  const renderHeader = () => (
    <View>
      {/* Team Selector */}
      {teams.length > 1 && (
        <Pressable
          onPress={() => setShowTeamPicker(true)}
          style={[
            styles.teamSelector,
            {
              backgroundColor: Colors[colorScheme].surface,
              borderColor: Colors[colorScheme].border,
            },
          ]}
        >
          <MaterialIcons name="groups" size={20} color={Colors[colorScheme].tint} />
          <Text
            style={[styles.teamSelectorText, { color: Colors[colorScheme].text }]}
            numberOfLines={1}
          >
            {selectedTeam?.name || 'Select Team'}
          </Text>
          <MaterialIcons name="arrow-drop-down" size={24} color={Colors[colorScheme].mutedText} />
        </Pressable>
      )}

      {teams.length === 1 && (
        <View style={styles.singleTeamHeader}>
          <MaterialIcons name="groups" size={20} color={Colors[colorScheme].tint} />
          <Text style={[styles.singleTeamName, { color: Colors[colorScheme].text }]}>
            {selectedTeam?.name}
          </Text>
        </View>
      )}

      {/* Roster count + invite */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
          Roster ({members.length})
        </Text>
        {canAdministerRoster && (
          <Pressable
            onPress={() => setShowInviteModal(true)}
            style={[styles.inviteButton, { backgroundColor: Colors[colorScheme].tint }]}
          >
            <MaterialIcons name="person-add" size={16} color="#FFFFFF" />
            <Text style={styles.inviteButtonText}>Invite</Text>
          </Pressable>
        )}
      </View>
      {members.length > 0 && (
        <Text style={[styles.longPressHint, { color: Colors[colorScheme].mutedText }]}>
          Long-press a member to edit role, position, or remove
        </Text>
      )}
    </View>
  );

  const renderEmpty = () => {
    if (loading)
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
          <Text
            style={[styles.emptySubtitle, { color: Colors[colorScheme].mutedText, marginTop: 12 }]}
          >
            Loading...
          </Text>
        </View>
      );
    if (teams.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="group-off" size={48} color={Colors[colorScheme].mutedText} />
          <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>No Teams</Text>
          <Text style={[styles.emptySubtitle, { color: Colors[colorScheme].mutedText }]}>
            You don't manage any teams yet.
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="people-outline" size={48} color={Colors[colorScheme].mutedText} />
        <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>No Members</Text>
        <Text style={[styles.emptySubtitle, { color: Colors[colorScheme].mutedText }]}>
          Invite people to join your team roster.
        </Text>
      </View>
    );
  };

  if (coachLoading) {
    return (
      <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors[colorScheme].tint} />
      </View>
    );
  }

  if (!canManage) {
    return (
      <CoachAccessRedirecting
        backgroundColor={Colors[colorScheme].background}
        spinnerColor={Colors[colorScheme].tint}
        textColor={Colors[colorScheme].mutedText}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen
        options={{
          title: 'My Team',
          headerShown: true,
          headerLeft: () => (
            <Pressable
              onPress={() => safeGoBack(router, explicitFallback)}
              style={{ paddingRight: 8 }}
            >
              <MaterialIcons name="chevron-left" size={28} color={Colors[colorScheme].tint} />
            </Pressable>
          ),
        }}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        </View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="error-outline" size={48} color={Colors[colorScheme].destructive} />
          <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>Error</Text>
          <Text style={[styles.emptySubtitle, { color: Colors[colorScheme].mutedText }]}>
            {error}
          </Text>
          <Pressable
            onPress={onRefresh}
            style={[styles.retryButton, { borderColor: Colors[colorScheme].tint }]}
          >
            <Text style={{ color: Colors[colorScheme].tint, fontWeight: '600' }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={teams.length > 0 ? members : []}
          keyExtractor={item => item.id}
          renderItem={renderMember}
          ListHeaderComponent={teams.length > 0 ? renderHeader : undefined}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors[colorScheme].tint}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}

      {/* Member Action Modal */}
      <CustomActionModal
        visible={showActionModal}
        title={selectedMember?.user.display_name || ''}
        message={`${ROLE_LABELS[selectedMember?.role || ''] || selectedMember?.role || ''}${selectedMember?.position ? ' \u2022 ' + selectedMember.position : ''}`}
        onClose={() => {
          setShowActionModal(false);
          setSelectedMember(null);
        }}
        options={[
          {
            label: 'Edit Role',
            icon: 'badge',
            onPress: () => setShowRoleModal(true),
          },
          {
            label: 'Edit Position',
            icon: 'edit',
            onPress: () => {
              setPositionInput(selectedMember?.position || '');
              setShowPositionModal(true);
            },
          },
          {
            label: 'Remove Member',
            icon: 'person-remove',
            isDestructive: true,
            onPress: () => setShowRemoveModal(true),
          },
        ]}
      />

      {/* Edit Role Modal */}
      <Modal
        visible={showRoleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRoleModal(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: Colors[colorScheme].background }]}>
            <Text style={[styles.modalTitle, { color: Colors[colorScheme].text }]}>
              Select Role
            </Text>
            <Text style={[styles.modalMessage, { color: Colors[colorScheme].mutedText }]}>
              {selectedMember?.user.display_name}
            </Text>
            {memberActionLoading ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color={Colors[colorScheme].tint} />
            ) : (
              getAssignableTeamRoles(roleActor, ROLE_OPTIONS).map(role => {
                const badge = getRoleBadgeColor(role);
                const isActive = selectedMember?.role === role;
                return (
                  <Pressable
                    key={role}
                    onPress={() => handleUpdateRole(role)}
                    style={[
                      styles.roleOption,
                      {
                        backgroundColor: isActive ? badge.bg + '20' : Colors[colorScheme].surface,
                        borderColor: isActive ? badge.bg : Colors[colorScheme].border,
                      },
                    ]}
                  >
                    <View style={[styles.roleOptionDot, { backgroundColor: badge.bg }]} />
                    <Text style={[styles.roleOptionText, { color: Colors[colorScheme].text }]}>
                      {ROLE_LABELS[role]}
                    </Text>
                    {isActive && <MaterialIcons name="check" size={18} color={badge.bg} />}
                  </Pressable>
                );
              })
            )}
            <Pressable onPress={() => setShowRoleModal(false)} style={styles.cancelButton}>
              <Text style={[styles.cancelText, { color: Colors[colorScheme].mutedText }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Edit Position Modal */}
      <Modal
        visible={showPositionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPositionModal(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: Colors[colorScheme].background }]}>
            <Text style={[styles.modalTitle, { color: Colors[colorScheme].text }]}>
              Edit Position
            </Text>
            <Text style={[styles.modalMessage, { color: Colors[colorScheme].mutedText }]}>
              {selectedMember?.user.display_name}
            </Text>
            <TextInput
              value={positionInput}
              onChangeText={setPositionInput}
              placeholder="e.g. Point Guard, Midfielder"
              placeholderTextColor={Colors[colorScheme].mutedText}
              style={[
                styles.textInput,
                {
                  color: Colors[colorScheme].text,
                  backgroundColor: Colors[colorScheme].surface,
                  borderColor: Colors[colorScheme].border,
                },
              ]}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setShowPositionModal(false);
                  setPositionInput('');
                }}
                style={[styles.modalActionBtn, { borderColor: Colors[colorScheme].border }]}
              >
                <Text style={{ color: Colors[colorScheme].mutedText, fontWeight: '600' }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleUpdatePosition}
                disabled={memberActionLoading}
                style={[
                  styles.modalActionBtn,
                  {
                    backgroundColor: Colors[colorScheme].tint,
                    opacity: memberActionLoading ? 0.6 : 1,
                  },
                ]}
              >
                {memberActionLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Remove Confirmation Modal */}
      <CustomActionModal
        visible={showRemoveModal}
        title="Remove Member?"
        message={`Are you sure you want to remove ${selectedMember?.user.display_name} from the team?`}
        onClose={() => {
          setShowRemoveModal(false);
          setSelectedMember(null);
        }}
        options={[
          {
            label: 'Remove',
            icon: 'person-remove',
            isDestructive: true,
            onPress: handleRemoveMember,
          },
          {
            label: 'Cancel',
            icon: 'close',
            onPress: () => {},
          },
        ]}
      />

      {/* Invite Member Modal */}
      <Modal
        visible={showInviteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: Colors[colorScheme].background }]}>
            <Text style={[styles.modalTitle, { color: Colors[colorScheme].text }]}>
              Invite Member
            </Text>
            <Text style={[styles.modalMessage, { color: Colors[colorScheme].mutedText }]}>
              Send an invitation to join {selectedTeam?.name || 'your team'}.
            </Text>

            <Text style={[styles.inputLabel, { color: Colors[colorScheme].text }]}>
              Username or Email
            </Text>
            <TextInput
              value={inviteIdentifier}
              onChangeText={setInviteIdentifier}
              placeholder="@playername or player@example.com"
              placeholderTextColor={Colors[colorScheme].mutedText}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.textInput,
                {
                  color: Colors[colorScheme].text,
                  backgroundColor: Colors[colorScheme].surface,
                  borderColor: Colors[colorScheme].border,
                },
              ]}
              autoFocus
            />

            <Text style={[styles.inputLabel, { color: Colors[colorScheme].text, marginTop: 12 }]}>
              Role
            </Text>
            <View style={styles.roleGrid}>
              {getAssignableTeamRoles(roleActor, [
                'coach',
                'assistant_coach',
                'manager',
              ] as Role[]).map(role => {
                const badge = getRoleBadgeColor(role);
                const isActive = inviteRole === role;
                return (
                  <Pressable
                    key={role}
                    onPress={() => setInviteRole(role)}
                    style={[
                      styles.roleChip,
                      {
                        backgroundColor: isActive ? badge.bg : Colors[colorScheme].surface,
                        borderColor: isActive ? badge.bg : Colors[colorScheme].border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        { color: isActive ? '#FFFFFF' : Colors[colorScheme].text },
                      ]}
                    >
                      {ROLE_LABELS[role]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setShowInviteModal(false);
                  setInviteIdentifier('');
                  setInviteRole('assistant_coach');
                }}
                style={[styles.modalActionBtn, { borderColor: Colors[colorScheme].border }]}
              >
                <Text style={{ color: Colors[colorScheme].mutedText, fontWeight: '600' }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleInvite}
                disabled={inviting || !inviteIdentifier.trim()}
                style={[
                  styles.modalActionBtn,
                  {
                    backgroundColor: !inviteIdentifier.trim()
                      ? Colors[colorScheme].border
                      : Colors[colorScheme].tint,
                  },
                ]}
              >
                {inviting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Send Invite</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Team Picker Modal */}
      <Modal
        visible={showTeamPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTeamPicker(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: Colors[colorScheme].background }]}>
            <Text style={[styles.modalTitle, { color: Colors[colorScheme].text }]}>
              Select Team
            </Text>
            {teams.map(team => {
              const isActive = team.id === selectedTeamId;
              return (
                <Pressable
                  key={team.id}
                  onPress={() => {
                    setSelectedTeamId(team.id);
                    setShowTeamPicker(false);
                  }}
                  style={[
                    styles.roleOption,
                    {
                      backgroundColor: isActive
                        ? Colors[colorScheme].tint + '15'
                        : Colors[colorScheme].surface,
                      borderColor: isActive ? Colors[colorScheme].tint : Colors[colorScheme].border,
                    },
                  ]}
                >
                  <MaterialIcons
                    name="groups"
                    size={18}
                    color={isActive ? Colors[colorScheme].tint : Colors[colorScheme].mutedText}
                  />
                  <Text
                    style={[
                      styles.roleOptionText,
                      { color: isActive ? Colors[colorScheme].tint : Colors[colorScheme].text },
                    ]}
                    numberOfLines={1}
                  >
                    {team.name}
                  </Text>
                  {isActive && (
                    <MaterialIcons name="check" size={18} color={Colors[colorScheme].tint} />
                  )}
                </Pressable>
              );
            })}
            <Pressable onPress={() => setShowTeamPicker(false)} style={styles.cancelButton}>
              <Text style={[styles.cancelText, { color: Colors[colorScheme].mutedText }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Team selector
  teamSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 8,
  },
  teamSelectorText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  singleTeamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  singleTeamName: {
    fontSize: 18,
    fontWeight: '700',
  },

  // Section header
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  inviteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Member card
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  jerseyNumber: {
    fontSize: 13,
    fontWeight: '500',
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  positionText: {
    fontSize: 13,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  longPressHint: {
    fontSize: 12,
    marginBottom: 8,
  },
  retryButton: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },

  // Modal shared
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.12)' }
      : {
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        }),
    elevation: 6,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },

  // Role selection
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 6,
  },
  roleOptionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  roleOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Inputs
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default MyTeamScreen;
