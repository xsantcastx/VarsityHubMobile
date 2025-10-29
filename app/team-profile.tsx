import CustomActionModal, { ActionModalOption } from '@/components/CustomActionModal';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Team as TeamApi, User } from '@/api/entities';
import { SectionHeader, SettingItem } from '@/components/ui';

interface AppUser {
  id: string;
  display_name: string;
  username: string;
  email?: string;
  avatar_url?: string;
  verified?: boolean;
  mutual_friends?: number;
}

interface CustomRole {
  id: string;
  name: string;
  displayName: string;
  color: string;
  permissions: {
    canInviteMembers: boolean;
    canManageRoles: boolean;
    canEditTeam: boolean;
    canViewStats: boolean;
    canScheduleGames: boolean;
    canRemoveMembers: boolean;
  };
  isCustom: boolean;
  sportSpecific?: boolean;
}

type Member = {
  id: string;
  user?: {
    id: string;
    display_name?: string;
    email?: string;
    avatar_url?: string;
  };
  role: string; // Now references role ID
  customPosition?: string; // Custom position like "Goalkeeper", "Point Guard"
  status: 'active' | 'inactive';
  joined_date?: string;
  stats?: {
    games_played: number;
    points: number;
  };
};

export default function TeamProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [team, setTeam] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'members' | 'settings'>('overview');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('player');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);

  // Modal state for universal action modal
  // (Removed duplicate actionModal declaration)

  // Prompt modal state (for Alert.prompt replacement)
  const [promptModal, setPromptModal] = useState<{
    visible: boolean;
    title?: string;
    message?: string;
    defaultValue?: string;
    onSubmit?: (value: string) => void;
  }>({ visible: false });

  // Prompt input state
  const [promptValue, setPromptValue] = useState('');
  
  // New user selection states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AppUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Default role system with sport-specific and custom roles
  const defaultRoles: CustomRole[] = useMemo(() => [
    {
      id: 'owner',
      name: 'owner',
      displayName: 'Team Owner',
      color: '#DC2626',
      permissions: {
        canInviteMembers: true,
        canManageRoles: true,
        canEditTeam: true,
        canViewStats: true,
        canScheduleGames: true,
        canRemoveMembers: true,
      },
      isCustom: false,
    },
    {
      id: 'coach',
      name: 'coach',
      displayName: 'Head Coach',
      color: '#7C3AED',
      permissions: {
        canInviteMembers: true,
        canManageRoles: true,
        canEditTeam: true,
        canViewStats: true,
        canScheduleGames: true,
        canRemoveMembers: true,
      },
      isCustom: false,
    },
    {
      id: 'assistant_coach',
      name: 'assistant_coach',
      displayName: 'Assistant Coach',
      color: '#9333EA',
      permissions: {
        canInviteMembers: false,
        canManageRoles: false,
        canEditTeam: false,
        canViewStats: true,
        canScheduleGames: true,
        canRemoveMembers: false,
      },
      isCustom: false,
    },
    {
      id: 'captain',
      name: 'captain',
      displayName: 'Team Captain',
      color: '#F59E0B',
      permissions: {
        canInviteMembers: true,
        canManageRoles: false,
        canEditTeam: false,
        canViewStats: true,
        canScheduleGames: false,
        canRemoveMembers: false,
      },
      isCustom: false,
    },
    {
      id: 'vice_captain',
      name: 'vice_captain',
      displayName: 'Vice Captain',
      color: '#F97316',
      permissions: {
        canInviteMembers: false,
        canManageRoles: false,
        canEditTeam: false,
        canViewStats: true,
        canScheduleGames: false,
        canRemoveMembers: false,
      },
      isCustom: false,
    },
    {
      id: 'player',
      name: 'player',
      displayName: 'Player',
      color: '#10B981',
      permissions: {
        canInviteMembers: false,
        canManageRoles: false,
        canEditTeam: false,
        canViewStats: true,
        canScheduleGames: false,
        canRemoveMembers: false,
      },
      isCustom: false,
    },
    {
      id: 'substitute',
      name: 'substitute',
      displayName: 'Substitute',
      color: '#6B7280',
      permissions: {
        canInviteMembers: false,
        canManageRoles: false,
        canEditTeam: false,
        canViewStats: true,
        canScheduleGames: false,
        canRemoveMembers: false,
      },
      isCustom: false,
    },
    {
      id: 'manager',
      name: 'manager',
      displayName: 'Team Manager',
      color: '#0EA5E9',
      permissions: {
        canInviteMembers: true,
        canManageRoles: false,
        canEditTeam: true,
        canViewStats: true,
        canScheduleGames: true,
        canRemoveMembers: false,
      },
      isCustom: false,
    },
  ], []);

  // Sport-specific positions (basketball example)
  const sportPositions = useMemo(() => {
    const teamSport = team?.sport?.toLowerCase() || 'basketball';
    
    const positionMap: Record<string, string[]> = {
      basketball: ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'],
      soccer: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'Winger'],
      football: ['Quarterback', 'Running Back', 'Wide Receiver', 'Tight End', 'Offensive Line', 'Defensive Line', 'Linebacker', 'Cornerback', 'Safety'],
      baseball: ['Pitcher', 'Catcher', 'First Base', 'Second Base', 'Third Base', 'Shortstop', 'Outfield'],
      volleyball: ['Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Libero'],
      hockey: ['Goalie', 'Defenseman', 'Left Wing', 'Right Wing', 'Center'],
    };

    return positionMap[teamSport] || [];
  }, [team?.sport]);

  const allRoles = useMemo(() => [...defaultRoles, ...customRoles], [defaultRoles, customRoles]);

  const getRoleById = (roleId: string): CustomRole | undefined => {
    return allRoles.find(role => role.id === roleId);
  };

  const showRoleSelector = (member: Member) => {
    const roleOptions = allRoles.map(role => ({
      label: role.displayName,
      onPress: () => updateMemberRole(member.id, role.id),
    }));
    setActionModal({
      visible: true,
      title: 'Change Role',
      message: `Select new role for ${member.user?.display_name || 'this member'}`,
      options: [
        { label: 'Cancel', onPress: () => {}, color: undefined },
        ...roleOptions,
        { label: 'Custom Position...', onPress: () => showCustomPositionEditor(member) },
      ],
    });
  };

  const showCustomPositionEditor = (member: Member) => {
    setPromptModal({
      visible: true,
      title: 'Custom Position',
      message: `Set a custom position for ${member.user?.display_name || 'this member'}`,
      defaultValue: member.customPosition || '',
      onSubmit: (position) => updateMemberPosition(member.id, position || ''),
    });
  };

  const updateMemberPosition = async (memberId: string, position: string) => {
    try {
      setMembers(prev => prev.map(m => 
        m.id === memberId 
          ? { ...m, customPosition: position.trim() || undefined }
          : m
      ));
      // TODO: Save to backend
      console.log('Updated position:', { memberId, position });
    } catch (error) {
      setActionModal({
        visible: true,
        title: 'Error',
        message: 'Failed to update member position',
        options: [{ label: 'OK', onPress: () => {}, color: undefined }],
      });
    }
  };

  // User search and suggestion functions
  // Modal state for universal action modal
  const [actionModal, setActionModal] = useState<{
    visible: boolean;
    title?: string;
    message?: string;
    options: ActionModalOption[];
  }>({ visible: false, options: [] });

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      // Use real API for user search
      const results = await User.searchForMentions(query, 10);
      // Defensive: ensure results is an array
      const safeResults = Array.isArray(results) ? results : [];
      // Convert to AppUser format with strict validation
      const convertedResults: AppUser[] = safeResults
        .filter((user: any) => user && user.id) // Only include users with valid IDs
        .map((user: any) => ({
          id: String(user.id),
          display_name: user.display_name || user.username || user.email?.split('@')[0] || 'User',
          username: user.username || user.email?.split('@')[0] || 'user',
          email: user.email || '',
          avatar_url: user.avatar_url || null,
          verified: user.email_verified || false,
          mutual_friends: user.mutual_friends || 0,
        }));
      setSearchResults(convertedResults);
    } catch (error) {
      console.error('User search failed:', error);
      setSearchResults([]);
      setActionModal({
        visible: true,
        title: 'Search Error',
        message: 'Failed to search for users. Please try again.',
        options: [{ label: 'OK', onPress: () => {}, color: undefined }],
      });
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Reset invite modal when opening
  const openInviteModal = useCallback(() => {
    setInviteModalOpen(true);
    setSearchQuery('');
    setSelectedUser(null);
    setSearchResults([]);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  const loadTeamData = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    const id = String(params?.id || '');
    if (!id) { setLoading(false); setError('Missing team id.'); return; }
    
    if (!silent) setLoading(true);
    setError(null);
    
    try {
      const [teamData, membersData] = await Promise.all([
        TeamApi.get(id), 
        TeamApi.members(id)
      ]);
      setTeam(teamData);
      const formattedMembers = Array.isArray(membersData) ? membersData.map((m: any) => {
        const user = m.user || {};
        return {
          id: String(m.id),
          user: {
            id: String(user.id || m.id),
            display_name: user.display_name || user.name || user.username || user.email || 'Unknown',
            username: user.username || '',
            email: user.email || '',
            avatar_url: user.avatar_url || '',
          },
          role: m.role || 'player',
          status: m.status || 'active',
          joined_date: m.joined_date || m.created_at,
          stats: m.stats || { games_played: 0, points: 0 }
        };
      }) : [];
      setMembers(formattedMembers);
    } catch (e: any) {
      console.error('Failed to load team:', e);
      setError('Failed to load team data');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [params?.id]);

  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadTeamData({ silent: true }); } finally { setRefreshing(false); }
  }, [loadTeamData]);

  const sendInvite = async () => {
    if (!selectedUser) {
      setActionModal({
        visible: true,
        title: 'User required',
        message: 'Please select a user to invite',
        options: [{ label: 'OK', onPress: () => {}, color: undefined }],
      });
      return;
    }
    
    if (!team?.id) {
      setActionModal({
        visible: true,
        title: 'Error',
        message: 'Team information not available',
        options: [{ label: 'OK', onPress: () => {}, color: undefined }],
      });
      return;
    }
    
    // Check roster limit (1-99 active players)
    const activePlayers = members.filter(m => m.status === 'active');
    if (activePlayers.length >= 99) {
      setActionModal({
        visible: true,
        title: 'Roster Full',
        message: 'Teams can have a maximum of 99 active players. Please remove inactive players before adding new members.',
        options: [{ label: 'OK', onPress: () => {}, color: undefined }],
      });
      setSendingInvite(false);
      return;
    }
    
    setSendingInvite(true);
    try {
      // Only send invite if user has a valid email
      if (!selectedUser.email) {
        setActionModal({
          visible: true,
          title: 'Email required',
          message: 'Cannot invite user without a valid email address.',
          options: [{ label: 'OK', onPress: () => {}, color: undefined }],
        });
        setSendingInvite(false);
        return;
      }
      await TeamApi.invite(team.id, selectedUser.email, 'member');
      setActionModal({
        visible: true,
        title: 'Invite sent!',
        message: `Invitation sent to ${selectedUser?.display_name ?? selectedUser?.email ?? ''}`,
        options: [{ label: 'OK', onPress: () => {}, color: undefined }],
      });
      setSelectedUser(null);
      setSearchQuery('');
      setSearchResults([]);
      setInviteModalOpen(false);
    } catch (error: any) {
      console.error('Failed to send invitation:', error);
      const errorMessage = error?.message || 'Failed to send invitation';
      setActionModal({
        visible: true,
        title: 'Error',
        message: errorMessage,
        options: [{ label: 'OK', onPress: () => {}, color: undefined }],
      });
    } finally {
      setSendingInvite(false);
    }
  };

  const updateMemberRole = async (memberId: string, newRole: string) => {
    try {
      // Update member role via API
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole as any } : m));
      setActionModal({
        visible: true,
        title: 'Updated!',
        message: 'Member role updated successfully',
        options: [{ label: 'OK', onPress: () => {}, color: undefined }],
      });
    } catch (error) {
      setActionModal({
        visible: true,
        title: 'Error',
        message: 'Failed to update member role',
        options: [{ label: 'OK', onPress: () => {}, color: undefined }],
      });
    }
  };

  const removeMember = async (memberId: string) => {
    setActionModal({
      visible: true,
      title: 'Remove Member',
      message: 'Are you sure you want to remove this member from the team?',
      options: [
        { label: 'Cancel', onPress: () => {}, color: undefined },
        { label: 'Remove', isDestructive: true, onPress: async () => {
            try {
              // Use TeamApi.membersRemove or similar if available, fallback to local remove
              // await TeamApi.removeMember(team.id, memberId); // If this exists
              setMembers(prev => prev.filter(m => m.id !== memberId));
              setActionModal({
                visible: true,
                title: 'Removed',
                message: 'Member removed from team',
                options: [{ label: 'OK', onPress: () => {}, color: undefined }],
              });
            } catch (error) {
              setActionModal({
                visible: true,
                title: 'Error',
                message: 'Failed to remove member',
                options: [{ label: 'OK', onPress: () => {}, color: undefined }],
              });
            }
          }
        },
      ],
    });
  };

  const activePlayers = members.filter(m => m.status === 'active');
  // When promptModal opens, set default value
  useEffect(() => {
    if (promptModal.visible) {
      setPromptValue(promptModal.defaultValue || '');
    }
  }, [promptModal.visible, promptModal.defaultValue]);
  {/* Universal Action Modal for errors and actions */}
  <CustomActionModal
    visible={actionModal.visible}
    title={actionModal.title}
    message={actionModal.message}
    options={actionModal.options.map(opt => ({
      ...opt,
      onPress: () => {
        setActionModal(a => ({ ...a, visible: false }));
        setTimeout(opt.onPress, 150);
      },
    }))}
    onClose={() => setActionModal(a => ({ ...a, visible: false }))}
  />

  {/* Prompt Modal (for Alert.prompt replacement) */}
  <CustomActionModal
    visible={promptModal.visible}
    title={promptModal.title}
    message={promptModal.message}
    options={[
      { label: 'Cancel', onPress: () => setPromptModal(p => ({ ...p, visible: false })), color: undefined },
      { label: 'Save', onPress: () => {
          setPromptModal(p => ({ ...p, visible: false }));
          promptModal.onSubmit?.(promptValue);
        }
      },
    ]}
    onClose={() => setPromptModal(p => ({ ...p, visible: false }))}
  >
    {/* Input field for prompt */}
    <View style={{ marginVertical: 12 }}>
      <Text style={{ fontSize: 16, marginBottom: 6 }}>Custom Position:</Text>
      <View style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8 }}>
        <TextInput
          style={{ fontSize: 16 }}
          value={promptValue}
          onChangeText={setPromptValue}
          placeholder="Enter position"
        />
      </View>
    </View>
  </CustomActionModal>
  const teamStats = {
    totalGames: activePlayers.reduce((sum, m) => sum + (m.stats?.games_played || 0), 0),
    totalPoints: activePlayers.reduce((sum, m) => sum + (m.stats?.points || 0), 0),
    captains: members.filter(m => m.role === 'captain').length,
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: Colors[colorScheme].background }]}>
        <Stack.Screen options={{ title: 'Team Management', headerShown: false }} />
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        <Text style={[styles.loadingText, { color: Colors[colorScheme].mutedText }]}>Loading team...</Text>
      </View>
    );
  }

  if (error || !team) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: Colors[colorScheme].background }]}>
        <Stack.Screen options={{ title: 'Team Management', headerShown: false }} />
        <Ionicons name="alert-circle-outline" size={48} color={Colors[colorScheme].mutedText} />
        <Text style={[styles.errorTitle, { color: Colors[colorScheme].text }]}>Something went wrong</Text>
        <Text style={[styles.errorText, { color: Colors[colorScheme].mutedText }]}>{error || 'Team not found'}</Text>
        <Pressable 
          style={[styles.retryButton, { backgroundColor: Colors[colorScheme].tint }]}
          onPress={() => loadTeamData()}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Team Management', headerShown: false }} />
      
      {/* Custom Header */}
      <View style={[styles.header, { paddingTop: 12 + insets.top }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors[colorScheme].text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]}>{team.name}</Text>
        <View style={styles.headerActions}>
          <Pressable 
            style={styles.actionButton}
            onPress={() => router.push(`/team-viewer?id=${team.id}`)}
          >
            <Ionicons name="eye-outline" size={22} color={Colors[colorScheme].text} />
          </Pressable>
          <Pressable 
            style={styles.actionButton}
            onPress={() => router.push(`/edit-team?id=${team.id}`)}
          >
            <Ionicons name="create-outline" size={22} color={Colors[colorScheme].text} />
          </Pressable>
        </View>
      </View>

      <ScrollView 
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors[colorScheme].tint]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Team Overview Card */}
        <View style={[styles.teamOverviewCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
          <View style={styles.teamHeader}>
            <View style={styles.teamAvatarContainer}>
              {team.avatar_url ? (
                <Image source={{ uri: team.avatar_url }} style={styles.teamAvatar} contentFit="cover" />
              ) : (
                <LinearGradient colors={[Colors[colorScheme].tint, Colors[colorScheme].tint + 'CC']} style={styles.teamAvatar}>
                  <Text style={styles.teamInitials}>{team.name ? team.name.charAt(0).toUpperCase() : ''}</Text>
                </LinearGradient>
              )}
              <View style={[styles.statusIndicator, { backgroundColor: '#10B981' }]} />
            </View>
            
            <View style={styles.teamInfo}>
              <Text style={[styles.teamName, { color: Colors[colorScheme].text }]} numberOfLines={1}>{team.name}</Text>
              {team.sport && (
                <View style={styles.teamMeta}>
                  <Ionicons name="basketball-outline" size={14} color={Colors[colorScheme].mutedText} />
                  <Text style={[styles.metaText, { color: Colors[colorScheme].mutedText }]}>
                    {team.sport}{team.season && ` • ${team.season}`}
                  </Text>
                </View>
              )}
              {team.description && (
                <Text style={[styles.teamDescription, { color: Colors[colorScheme].mutedText }]} numberOfLines={2}>
                  {team.description}
                </Text>
              )}
            </View>
          </View>

          {/* Team Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: Colors[colorScheme].text }]}>{activePlayers.length}</Text>
              <Text style={[styles.statLabel, { color: Colors[colorScheme].mutedText }]}>Members</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: Colors[colorScheme].text }]}>{teamStats.captains}</Text>
              <Text style={[styles.statLabel, { color: Colors[colorScheme].mutedText }]}>Captains</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: Colors[colorScheme].text }]}>{teamStats.totalGames}</Text>
              <Text style={[styles.statLabel, { color: Colors[colorScheme].mutedText }]}>Games</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={[styles.quickActionsCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
          <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>Quick Actions</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4 }}>
            <Pressable 
              style={[styles.quickActionButton, { backgroundColor: Colors[colorScheme].tint }]}
              onPress={openInviteModal}
            >
              <Ionicons name="person-add-outline" size={20} color="#fff" />
              <Text style={styles.quickActionText}>Invite Player</Text>
            </Pressable>
            
            <Pressable 
              style={[styles.quickActionButton, { backgroundColor: '#10B981' }]}
              onPress={() => router.push(`/manage-season?teamId=${team.id}`)}
            >
              <Ionicons name="calendar-outline" size={20} color="#fff" />
              <Text style={styles.quickActionText}>Manage Season</Text>
            </Pressable>
            
            {/* Team Chat button hidden - not needed for simplified coach UX */}
            {false && (
              <Pressable 
                style={[styles.quickActionButton, { backgroundColor: '#F59E0B' }]}
                onPress={() => router.push(`/team-contacts?id=${team.id}`)}
              >
                <Ionicons name="chatbubble-outline" size={20} color="#fff" />
                <Text style={styles.quickActionText}>Team Chat</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>

        {/* Tab Navigation */}
        <View style={[styles.tabContainer, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
          {(['overview', 'members', 'settings'] as const).map((tab) => (
            <Pressable
              key={tab}
              style={[
                styles.tab,
                { backgroundColor: selectedTab === tab ? Colors[colorScheme].tint : 'transparent' }
              ]}
              onPress={() => setSelectedTab(tab)}
            >
              <Text style={[
                styles.tabText,
                { color: selectedTab === tab ? '#fff' : Colors[colorScheme].text }
              ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab Content */}
        {selectedTab === 'overview' && (
          <View style={styles.tabContent}>
            <View style={[styles.activityCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>Team Overview</Text>
              <Text style={[styles.activityText, { color: Colors[colorScheme].mutedText, textAlign: 'center', paddingVertical: 20 }]}>
                Team activity will appear here
              </Text>
            </View>
          </View>
        )}

        {selectedTab === 'members' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>Team Members</Text>
              <Text style={[styles.rosterCount, { color: activePlayers.length >= 99 ? '#DC2626' : Colors[colorScheme].mutedText }]}>
                {activePlayers.length}/99
              </Text>
            </View>
            {activePlayers.map((member) => (
              <View key={member.id} style={[styles.memberCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
                <View style={styles.memberInfo}>
                  <View style={styles.memberAvatarContainer}>
                    {member.user?.avatar_url ? (
                      <Image source={{ uri: member.user.avatar_url }} style={styles.memberAvatar} contentFit="cover" />
                    ) : (
                      <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.memberAvatar}>
                        <Text style={styles.memberInitials}>
                          {member.user?.display_name?.charAt(0)?.toUpperCase() || 'M'}
                        </Text>
                      </LinearGradient>
                    )}
                    <View style={[styles.roleIndicator, { backgroundColor: getRoleById(member.role)?.color || '#6B7280' }]} />
                  </View>
                  
                  <View style={styles.memberDetails}>
                    <Text style={[styles.memberName, { color: Colors[colorScheme].text }]} numberOfLines={1}>
                      {member.user?.display_name || 'Unknown Member'}
                    </Text>
                    <Text style={[styles.memberRole, { color: Colors[colorScheme].mutedText }]}>
                      {getRoleById(member.role)?.displayName || 'Player'}
                      {member.customPosition && ` • ${member.customPosition}`}
                    </Text>
                    {member.stats && (
                      <Text style={[styles.memberStats, { color: Colors[colorScheme].mutedText }]}>
                        {member.stats.games_played} games • {member.stats.points} pts
                      </Text>
                    )}
                  </View>
                </View>
                
                <View style={styles.memberActions}>
                  <Pressable 
                    style={[styles.actionButton, { backgroundColor: Colors[colorScheme].tint + '15' }]}
                    onPress={() => showRoleSelector(member)}
                  >
                    <Ionicons name="person-outline" size={14} color={Colors[colorScheme].tint} />
                  </Pressable>
                  <Pressable 
                    style={[styles.actionButton, { backgroundColor: '#EF4444' + '15' }]}
                    onPress={() => removeMember(member.id)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {selectedTab === 'settings' && (
          <View style={styles.tabContent}>
            {/* General Settings - SIMPLIFIED FOR COACHES */}
            <View style={[styles.settingsCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <SectionHeader title="Team Management" style={{ paddingHorizontal: 0, paddingTop: 0 }} />
              
              <SettingItem
                icon="create-outline"
                label="Edit Team Info"
                onPress={() => router.push(`/edit-team?id=${team.id}`)}
              />
              
              <SettingItem
                icon="calendar-outline"
                label="Manage Season & Games"
                onPress={() => router.push(`/manage-season?teamId=${team.id}`)}
              />
            </View>

            {/* Team Actions */}
            <View style={[styles.settingsCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <SectionHeader title="Actions" style={{ paddingHorizontal: 0, paddingTop: 0 }} />
              
              <SettingItem
                icon="archive-outline"
                label="Archive Team"
                destructive={false}
                onPress={() => {
                  Alert.alert(
                    'Archive Team',
                    'This will hide the team from your active list. You can restore it later.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Archive', style: 'destructive', onPress: () => console.log('Archive team') }
                    ]
                  );
                }}
              />

              <SettingItem
                icon="trash-outline"
                label="Delete Team"
                destructive={true}
                onPress={() => {
                  Alert.alert(
                    'Delete Team',
                    'This will permanently delete the team and all its data. This action cannot be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Delete', 
                        style: 'destructive', 
                        onPress: async () => {
                          try {
                            await TeamApi.delete(team.id);
                            Alert.alert('Success', 'Team deleted successfully', [
                              { text: 'OK', onPress: () => router.replace('/manage-teams') }
                            ]);
                          } catch (error: any) {
                            console.error('Failed to delete team:', error);
                            Alert.alert('Error', error?.message || 'Failed to delete team');
                          }
                        }
                      }
                    ]
                  );
                }}
              />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Enhanced Invite Modal */}
      <Modal
        visible={inviteModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setInviteModalOpen(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: Colors[colorScheme].background }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setInviteModalOpen(false)}>
              <Text style={[styles.modalCancel, { color: Colors[colorScheme].text }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: Colors[colorScheme].text }]}>Invite to Team</Text>
            <Pressable 
              onPress={sendInvite}
              disabled={sendingInvite || !selectedUser}
            >
              <Text style={[styles.modalDone, { color: sendingInvite || !selectedUser ? Colors[colorScheme].mutedText : Colors[colorScheme].tint }]}>
                {sendingInvite ? 'Sending...' : 'Send'}
              </Text>
            </Pressable>
          </View>
          
          <View style={styles.modalContent}>
            {/* Search Section */}
            <Text style={[styles.modalLabel, { color: Colors[colorScheme].text }]}>Search Users</Text>
            <View style={[styles.searchContainer, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <Ionicons name="search" size={20} color={Colors[colorScheme].mutedText} />
              <TextInput
                style={[styles.searchInput, { color: Colors[colorScheme].text }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by name or username"
                placeholderTextColor={Colors[colorScheme].mutedText}
                autoCapitalize="none"
              />
              {searchLoading && <ActivityIndicator size="small" color={Colors[colorScheme].tint} />}
            </View>

            {/* Selected User */}
            {selectedUser && (
              <View style={[styles.selectedUserCard, { backgroundColor: Colors[colorScheme].tint + '10', borderColor: Colors[colorScheme].tint }]}>
                <View style={styles.userInfo}>
                  <View style={[styles.userAvatar, { backgroundColor: Colors[colorScheme].tint }]}>
                    <Text style={styles.userInitials}>
                      {selectedUser.display_name ? selectedUser.display_name.charAt(0).toUpperCase() : ''}
                    </Text>
                  </View>
                  <View style={styles.userDetails}>
                    <View style={styles.userNameRow}>
                      <Text style={[styles.userName, { color: Colors[colorScheme].text }]}>
                        {selectedUser.display_name}
                      </Text>
                      {selectedUser.verified && (
                        <Ionicons name="checkmark-circle" size={16} color={Colors[colorScheme].tint} />
                      )}
                    </View>
                    <Text style={[styles.userUsername, { color: Colors[colorScheme].mutedText }]}>
                      @{selectedUser.username || 'user'}
                    </Text>
                    {(selectedUser.mutual_friends ?? 0) > 0 && (
                      <Text style={[styles.mutualFriends, { color: Colors[colorScheme].mutedText }]}>
                        {selectedUser.mutual_friends} mutual friends
                      </Text>
                    )}
                  </View>
                </View>
                <Pressable 
                  style={styles.removeButton}
                  onPress={() => setSelectedUser(null)}
                >
                  <Ionicons name="close" size={20} color={Colors[colorScheme].mutedText} />
                </Pressable>
              </View>
            )}

            {/* Search Results */}
            {searchQuery && !selectedUser && (
              <View style={styles.searchResults}>
                {searchResults.length > 0 ? (
                  <View style={{ maxHeight: 200 }}>
                    <FlatList
                      data={searchResults}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => (
                        <Pressable
                          style={[styles.userCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}
                          onPress={() => setSelectedUser(item)}
                        >
                          <View style={styles.userInfo}>
                            <View style={[styles.userAvatar, { backgroundColor: Colors[colorScheme].tint }]}>
                              <Text style={styles.userInitials}>
                                {(item.display_name || 'U').charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <View style={styles.userDetails}>
                              <View style={styles.userNameRow}>
                                <Text style={[styles.userName, { color: Colors[colorScheme].text }]}>
                                  {item.display_name || item.username || 'User'}
                                </Text>
                                {item.verified && (
                                  <Ionicons name="checkmark-circle" size={16} color={Colors[colorScheme].tint} />
                                )}
                              </View>
                              <Text style={[styles.userUsername, { color: Colors[colorScheme].mutedText }]}>
                                @{item.username || 'user'}
                              </Text>
                              {(item.mutual_friends ?? 0) > 0 && (
                                <Text style={[styles.mutualFriends, { color: Colors[colorScheme].mutedText }]}>
                                  {item.mutual_friends} mutual friends
                                </Text>
                              )}
                            </View>
                          </View>
                          <Ionicons name="add-circle-outline" size={24} color={Colors[colorScheme].tint} />
                        </Pressable>
                      )}
                    />
                  </View>
                ) : searchQuery.length > 0 && !searchLoading ? (
                  <View style={styles.noResults}>
                    <Text style={[styles.noResultsText, { color: Colors[colorScheme].mutedText }]}>
                      No users found for "{searchQuery}"
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
            
            <Text style={[styles.modalLabel, { color: Colors[colorScheme].text, marginTop: 24 }]}>Role</Text>
            <View style={styles.roleSelector}>
              {allRoles.filter(role => ['player', 'captain', 'substitute'].includes(role.id)).map((role) => (
                <Pressable
                  key={role.id}
                  style={[
                    styles.roleOption,
                    { 
                      backgroundColor: inviteRole === role.id ? Colors[colorScheme].tint : Colors[colorScheme].surface,
                      borderColor: Colors[colorScheme].border
                    }
                  ]}
                  onPress={() => setInviteRole(role.id)}
                >
                  <Text style={[
                    styles.roleOptionText,
                    { color: inviteRole === role.id ? '#fff' : Colors[colorScheme].text }
                  ]}>
                    {role.displayName}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  // Loading States
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  moreButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Team Overview
  teamOverviewCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  teamHeader: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  teamAvatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  teamAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamInitials: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: '#fff',
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  teamMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '500',
  },
  teamDescription: {
    fontSize: 15,
    lineHeight: 20,
  },
  // Stats
  statsContainer: {
    flexDirection: 'row',
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  // Quick Actions
  quickActionsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 12,
    gap: 8,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Tabs
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  // Sections
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rosterCount: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Activity
  activityCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 15,
    fontWeight: '500',
  },
  activityTime: {
    fontSize: 13,
    marginTop: 2,
  },
  // Members
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitials: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  roleIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  memberStats: {
    fontSize: 12,
    fontWeight: '500',
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Settings
  settingsCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  settingLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  // Modal
  modalContainer: {
    flex: 1,
    paddingTop: 60,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  modalCancel: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalDone: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalContent: {
    padding: 16,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 16,
  },
  modalInput: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  
  // User Selection Styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  searchResults: {
    maxHeight: 200,
  },
  selectedUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userInitials: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  userDetails: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
  },
  userUsername: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  mutualFriends: {
    fontSize: 12,
    fontWeight: '500',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResults: {
    padding: 24,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 15,
    textAlign: 'center',
  },

  // Settings Styles
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingValueText: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleSwitch: {
    width: 32,
    height: 18,
    borderRadius: 9,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
  },
});
