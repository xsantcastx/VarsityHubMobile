import { Colors } from '@/constants/Colors';
import CoachAccessRedirecting from '@/components/CoachAccessRedirecting';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRequireCoach } from '@/hooks/useRequireCoach';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { materializeICloudAssetIfNeeded } from '@/utils/materializeICloudAsset';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { handleCoachAccessError } from '@/utils/coachAccess';
import { safeGoBack } from '@/utils/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Organization, Team } from '@/api/entities';
import type { TeamAdminSummaryResponse } from '@/api/schemas/team';
import { useAuth } from '@/context/AuthProvider';
import { uploadFile } from '@/api/upload';
import { getApiBaseUrl } from '@/api/http';

function EditTeamScreen() {
  const { canAccessCoachTools, loading: coachLoading } = useRequireCoach();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; orgId?: string; orgTab?: string; fallback?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const fallbackRoute =
    typeof params.fallback === 'string' && params.fallback.trim().length > 0
      ? params.fallback
      : params.orgId
        ? `/organization?id=${encodeURIComponent(params.orgId)}&tab=${encodeURIComponent(params.orgTab || 'teams')}`
        : '/organization?tab=teams';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState('');
  const [season, setSeason] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<any>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const { user: currentUser } = useAuth();

  // Transfer ownership state
  const [isOwner, setIsOwner] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [transferring, setTransferring] = useState(false);

  const sports = ['Basketball', 'Football', 'Soccer', 'Baseball', 'Tennis', 'Volleyball', 'Swimming', 'Track & Field', 'Other'];
  const seasons = (() => {
    const y = new Date().getFullYear();
    return [
      `Spring ${y}`, `Summer ${y}`, `Fall ${y}`, `Winter ${y}/${(y + 1) % 100}`,
      `Spring ${y + 1}`, `Summer ${y + 1}`, `Fall ${y + 1}`, `Winter ${y + 1}/${(y + 2) % 100}`,
    ];
  })();

  const loadTeam = useCallback(async () => {
    try {
      setLoading(true);
      if (!params.id) return;
      const summary = (await Team.adminSummary(params.id)) as TeamAdminSummaryResponse;
      const teamData = summary?.team;
      if (!teamData) {
        throw new Error('Team not found');
      }
      setTeam(teamData);
      setName(teamData.name || '');
      setDescription(teamData.description || '');
      setSport(teamData.sport || '');
      setSeason(teamData.season || '');
      setExistingLogoUrl(teamData.logo_url || teamData.avatar_url || null);
      setIsPrivate(!!teamData.is_private);

      const memberList = Array.isArray(summary?.members) ? summary.members : [];
      setMembers(memberList);
      setIsOwner(String(summary?.permissions?.membership_role || '').toLowerCase() === 'owner');
      setOrganizationName((teamData as any).organization?.name || '');
    } catch (error) {
      if (handleCoachAccessError(router, error, 'editing teams')) {
        return;
      }
      if (__DEV__) console.error('Failed to load team:', error);
      Alert.alert('Error', 'Failed to load team data. Please try again.');
      safeGoBack(router, fallbackRoute);
    } finally {
      setLoading(false);
    }
  }, [fallbackRoute, params.id, router]);

  useEffect(() => {
    if (params?.id) {
      void loadTeam();
    }
  }, [loadTeam, params?.id]);

  const pickImage = async () => {
    const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (result.granted === false) {
      Alert.alert('Permission Required', 'Please allow access to your photos to upload a team logo.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      exif: false,
    });

    if (!pickerResult.canceled && pickerResult.assets[0]) {
      const localUri = await materializeICloudAssetIfNeeded(pickerResult.assets[0].uri);
      setLogoUri(localUri);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.requestCameraPermissionsAsync();
    
    if (result.granted === false) {
      Alert.alert('Permission Required', 'Please allow camera access to take a team logo photo.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }

    const pickerResult = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      exif: false,
    });

    if (!pickerResult.canceled && pickerResult.assets[0]) {
      const localUri = await materializeICloudAssetIfNeeded(pickerResult.assets[0].uri);
      setLogoUri(localUri);
    }
  };

  const showImagePicker = () => {
    Alert.alert(
      'Select Logo',
      'Choose how you want to add a team logo',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const onSubmit = async () => {
    if (!params.id) return;
    if (!name.trim()) {
      Alert.alert('Team name required', 'Please enter a team name to continue.');
      return;
    }
    
    setSubmitting(true);
    try {
      let logoUrl = existingLogoUrl; // Keep existing logo by default
      
      // Upload new logo if one was selected
      if (logoUri) {
        try {
          const uploaded = await uploadFile(getApiBaseUrl(), logoUri, 'team-logo.jpg', 'image/jpeg');
          logoUrl = uploaded?.path || uploaded?.url;
        } catch (error) {
          if (__DEV__) console.error('Logo upload failed:', error);
          Alert.alert('Warning', 'Team updated but logo upload failed. Please try updating the logo again.');
        }
      }
      
      // Handle organization - find existing or create new
      let organizationId: string | null | undefined = team?.organization_id ?? null; // Keep existing by default
      const trimmedOrgName = organizationName.trim();
      
      if (trimmedOrgName) {
        try {
          // Search for existing organization
          const existingOrgs = await Organization.list(trimmedOrgName, 10);
          
          if (Array.isArray(existingOrgs) && existingOrgs.length > 0) {
            // Check for exact match (case-insensitive)
            const exactMatch = existingOrgs.find((org: any) => 
              org.name?.toLowerCase() === trimmedOrgName.toLowerCase()
            );
            
            if (exactMatch) {
              organizationId = exactMatch.id;
            } else {
              // Use first result if no exact match
              organizationId = existingOrgs[0].id;
            }
          } else {
            // No matching organization found — org creation requires supporting documents,
            // which must go through the onboarding flow. Skip org assignment here.
            Alert.alert(
              'Organization Not Found',
              'No matching organization found. To create a new organization, go to Settings and set up a new league with supporting documents.',
            );
            // Continue without changing organization
          }
        } catch (err: any) {
          if (__DEV__) console.error('[EditTeam] Error handling organization:', err);
          if (__DEV__) console.error('[EditTeam] Error message:', err?.message);
          Alert.alert('Warning', `Error with organization. Team will be updated without organization change.`);
          // Continue without changing organization if there's an error
        }
      } else {
        organizationId = null;
      }
      
      const teamData: Record<string, any> = {
        name: name.trim(),
        description: description.trim() || undefined,
        sport: sport || undefined,
        is_private: isPrivate,
        // Note: season is stored as display text in team state but database uses season_start/season_end
        // Don't send 'season' field - it doesn't exist in Team model
      };
      if (logoUrl) {
        teamData.logo_url = logoUrl;
      }
      // Always send organization fields when they change
      if (organizationId !== undefined) {
        teamData.organization_id = organizationId;
      }

      await Team.update(params.id, teamData);
      setExistingLogoUrl(logoUrl || null);
      setLogoUri(null);
      // Update local state so UI reflects saved data (including name)
      setTeam((prev: any) => prev ? { ...prev, name: name.trim(), description: description.trim() || prev.description, sport: sport || prev.sport } : prev);
      if (organizationId !== undefined) {
        setTeam((prev: any) => prev ? {
          ...prev,
          organization_id: organizationId,
          organization: organizationId
            ? { ...(prev.organization ?? {}), id: organizationId, name: trimmedOrgName }
            : null,
        } : prev);
        setOrganizationName(organizationId ? trimmedOrgName : '');
      }
      Alert.alert('Success!', 'Your team has been updated successfully.', [
        { text: 'OK', onPress: () => safeGoBack(router, fallbackRoute) }
      ]);
    } catch (e: any) {
      if (handleCoachAccessError(router, e, 'editing teams')) {
        return;
      }
      if (__DEV__) console.error('Team update error:', e);
      if (__DEV__) console.error('Team update error status:', e?.status);
      if (__DEV__) console.error('Team update error data:', e?.data);
      if (__DEV__) console.error('Team update error message:', e?.message);
      const errorMsg = e?.data?.error || e?.data?.message || e?.message || 'Failed to update team. Please try again.';
      Alert.alert('Error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (coachLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: Colors[colorScheme].background }]}>
        <Stack.Screen options={{ title: 'Edit Team', headerShown: false }} />
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        <Text style={[styles.loadingText, { color: Colors[colorScheme].text }]}>Loading team...</Text>
      </View>
    );
  }

  if (!canAccessCoachTools) {
    return (
      <CoachAccessRedirecting
        backgroundColor={Colors[colorScheme].background}
        spinnerColor={Colors[colorScheme].tint}
        textColor={Colors[colorScheme].mutedText}
      />
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: Colors[colorScheme].background }]}>
        <Stack.Screen options={{ title: 'Edit Team', headerShown: false }} />
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        <Text style={[styles.loadingText, { color: Colors[colorScheme].text }]}>Loading team...</Text>
      </View>
    );
  }

  const currentLogoUri = logoUri || existingLogoUrl;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Edit Team', headerShown: false }} />
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: 12 + insets.top }]}>
          <Pressable 
            style={styles.backButton} 
            onPress={() => { safeGoBack(router, fallbackRoute); }}
          >
            <MaterialIcons name="arrow-back" size={24} color={Colors[colorScheme].text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]}>Edit Team</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Intro Card */}
        <View style={[styles.introCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
          <LinearGradient colors={[Colors[colorScheme].tint, Colors[colorScheme].tint + 'CC']} style={styles.introIcon}>
            <MaterialIcons name="edit" size={28} color="#fff" />
          </LinearGradient>
          <Text style={[styles.introTitle, { color: Colors[colorScheme].text }]}>
            Update Your Team
          </Text>
          <Text style={[styles.introSubtitle, { color: Colors[colorScheme].mutedText }]}>
            Edit team information and update your team logo.
          </Text>
        </View>

        {/* Team Logo Section */}
        <View style={styles.formSection}>
          <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>Team Logo</Text>
          <View style={[styles.logoSection, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
            <Pressable style={styles.logoContainer} onPress={showImagePicker}>
              {currentLogoUri ? (
                <Image source={{ uri: currentLogoUri }} style={styles.logoImage} />
              ) : (
                <View style={[styles.logoPlaceholder, { backgroundColor: Colors[colorScheme].surface }]}>
                  <MaterialIcons name="camera-alt" size={32} color={Colors[colorScheme].mutedText} />
                </View>
              )}
              <View style={[styles.logoOverlay, { backgroundColor: Colors[colorScheme].tint, borderColor: Colors[colorScheme].background }]}>
                <MaterialIcons name="camera-alt" size={20} color="#fff" />
              </View>
            </Pressable>
            <View style={styles.logoInfo}>
              <Text style={[styles.logoTitle, { color: Colors[colorScheme].text }]}>
                {currentLogoUri ? 'Change Logo' : 'Add Logo'}
              </Text>
              <Text style={[styles.logoDescription, { color: Colors[colorScheme].mutedText }]}>
                Upload a square logo (PNG or JPG) for your team. This will be displayed on games and team profiles.
              </Text>
            </View>
          </View>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>Team Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: Colors[colorScheme].text }]}>Team Name *</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text }]}
              value={name}
              onChangeText={setName}
              placeholder="Enter your team name"
              placeholderTextColor={Colors[colorScheme].mutedText}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={[styles.inputLabel, { color: Colors[colorScheme].text }]}>Description</Text>
              <Text style={[styles.charCount, { color: description.length > 500 ? '#DC2626' : Colors[colorScheme].mutedText }]}>
                {description.length}/500
              </Text>
            </View>
            <TextInput
              style={[styles.textArea, { backgroundColor: Colors[colorScheme].surface, borderColor: description.length > 500 ? '#DC2626' : Colors[colorScheme].border, color: Colors[colorScheme].text }]}
              value={description}
              onChangeText={(text) => {
                if (text.length <= 500) {
                  setDescription(text);
                }
              }}
              placeholder="Describe your team (optional)"
              placeholderTextColor={Colors[colorScheme].mutedText}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: Colors[colorScheme].text }]}>School / Organization</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text }]}
              value={organizationName}
              onChangeText={setOrganizationName}
              placeholder="e.g., Duke, UNC, Stamford High School"
              placeholderTextColor={Colors[colorScheme].mutedText}
            />
            <Text style={[styles.fieldHint, { color: Colors[colorScheme].mutedText }]}>
              Link this team to a school or organization
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: Colors[colorScheme].text }]}>Sport</Text>
            <View style={[styles.selectContainer, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContainer}>
                {sports.map((sportOption) => (
                  <Pressable
                    key={sportOption}
                    style={[styles.chip, sport === sportOption && { backgroundColor: Colors[colorScheme].tint }]}
                    onPress={() => setSport(sport === sportOption ? '' : sportOption)}
                  >
                    <Text style={[styles.chipText, { color: sport === sportOption ? '#fff' : Colors[colorScheme].text }]}>
                      {sportOption}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: Colors[colorScheme].text }]}>Season</Text>
            <View style={[styles.selectContainer, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContainer}>
                {seasons.map((seasonOption) => (
                  <Pressable
                    key={seasonOption}
                    style={[styles.chip, season === seasonOption && { backgroundColor: Colors[colorScheme].tint }]}
                    onPress={() => setSeason(season === seasonOption ? '' : seasonOption)}
                  >
                    <Text style={[styles.chipText, { color: season === seasonOption ? '#fff' : Colors[colorScheme].text }]}>
                      {seasonOption}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Privacy Toggle */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: Colors[colorScheme].text }]}>Team Privacy</Text>
            <Pressable
              style={[
                styles.privacyToggle,
                {
                  backgroundColor: Colors[colorScheme].surface,
                  borderColor: isPrivate ? Colors[colorScheme].tint : Colors[colorScheme].border,
                },
              ]}
              onPress={() => setIsPrivate(p => !p)}
              accessibilityRole="switch"
              accessibilityState={{ checked: isPrivate }}
              accessibilityLabel={isPrivate ? 'Team is private' : 'Team is public'}
            >
              <MaterialIcons
                name={isPrivate ? 'lock' : 'public'}
                size={22}
                color={isPrivate ? Colors[colorScheme].tint : Colors[colorScheme].mutedText}
              />
              <View style={styles.privacyToggleText}>
                <Text style={[styles.privacyToggleLabel, { color: Colors[colorScheme].text }]}>
                  {isPrivate ? 'Private team' : 'Public team'}
                </Text>
                <Text style={[styles.fieldHint, { color: Colors[colorScheme].mutedText }]}>
                  {isPrivate
                    ? 'Hidden from public search. Only members, followers, and org admins can see the roster and full profile.'
                    : 'Discoverable in search. Anyone can view the team profile and follow.'}
                </Text>
              </View>
              <MaterialIcons
                name={isPrivate ? 'toggle-on' : 'toggle-off'}
                size={36}
                color={isPrivate ? Colors[colorScheme].tint : Colors[colorScheme].mutedText}
              />
            </Pressable>
          </View>
        </View>

        {/* Transfer Ownership — Owner Only */}
        {isOwner && (
          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, { color: '#DC2626' }]}>Danger Zone</Text>
            <Pressable
              style={[styles.transferButton, { borderColor: '#DC2626' }]}
              onPress={() => setShowTransferModal(true)}
            >
              <MaterialIcons name="swap-horiz" size={20} color="#DC2626" />
              <Text style={styles.transferButtonText}>Transfer Ownership</Text>
            </Pressable>
            <Text style={[styles.fieldHint, { color: Colors[colorScheme].mutedText }]}>
              Transfer team ownership to another team member. You will become a manager.
            </Text>
          </View>
        )}

        {/* Submit Button */}
        <View style={styles.submitSection}>
          <Pressable 
            style={[styles.submitButton, { backgroundColor: Colors[colorScheme].tint }, submitting && styles.submitButtonDisabled]} 
            onPress={onSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="check-circle" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Update Team</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {/* Transfer Ownership Modal */}
      <Modal visible={showTransferModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Colors[colorScheme].background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: Colors[colorScheme].text }]}>Transfer Ownership</Text>
              <Pressable onPress={() => { setShowTransferModal(false); setMemberSearch(''); }} hitSlop={12}>
                <MaterialIcons name="close" size={24} color={Colors[colorScheme].text} />
              </Pressable>
            </View>

            <Text style={[styles.modalSubtitle, { color: Colors[colorScheme].mutedText }]}>
              Select a team member to become the new owner. You will be demoted to manager.
            </Text>

            <TextInput
              style={[styles.textInput, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text, marginBottom: 12 }]}
              value={memberSearch}
              onChangeText={setMemberSearch}
              placeholder="Search by name or email..."
              placeholderTextColor={Colors[colorScheme].mutedText}
              autoCapitalize="none"
            />

            <FlatList
              data={members.filter((m: any) => {
                // Exclude current owner
                const uid = m.user_id || m.user?.id;
                if (uid === currentUser?.id) return false;
                // Filter by search
                if (!memberSearch.trim()) return true;
                const q = memberSearch.toLowerCase();
                const name = (m.user?.display_name || m.display_name || '').toLowerCase();
                const email = (m.user?.email || m.email || '').toLowerCase();
                return name.includes(q) || email.includes(q);
              })}
              keyExtractor={(m: any) => m.id || m.user_id || m.user?.id}
              style={{ maxHeight: 300 }}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: Colors[colorScheme].mutedText }]}>
                  No team members found.
                </Text>
              }
              renderItem={({ item: m }) => {
                const uid = m.user_id || m.user?.id;
                const displayName = m.user?.display_name || m.display_name || 'Unknown';
                const email = m.user?.email || m.email || '';
                const role = m.role || 'member';

                return (
                  <Pressable
                    style={[styles.memberRow, { borderColor: Colors[colorScheme].border }]}
                    onPress={() => {
                      Alert.alert(
                        'Confirm Transfer',
                        `Are you sure you want to transfer ownership to ${displayName}?\n\nThis cannot be undone. You will become a manager.`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Transfer',
                            style: 'destructive',
                            onPress: async () => {
                              setTransferring(true);
                              try {
                                if (!params.id) return;
                                await Team.transferOwnership(params.id, uid);
                                setShowTransferModal(false);
                                setMemberSearch('');
                                setIsOwner(false);
                                Alert.alert('Ownership Transferred', `${displayName} is now the team owner.`, [
                                  { text: 'OK', onPress: () => { safeGoBack(router, fallbackRoute); } }
                                ]);
                              } catch (e: any) {
                                const msg = e?.data?.error || e?.message || 'Failed to transfer ownership';
                                Alert.alert('Error', msg);
                              } finally {
                                setTransferring(false);
                              }
                            }
                          }
                        ]
                      );
                    }}
                    disabled={transferring}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.memberName, { color: Colors[colorScheme].text }]}>{displayName}</Text>
                      {email ? <Text style={[styles.memberEmail, { color: Colors[colorScheme].mutedText }]}>{email}</Text> : null}
                    </View>
                    <View style={[styles.rolePill, { backgroundColor: Colors[colorScheme].surface }]}>
                      <Text style={[styles.roleLabel, { color: Colors[colorScheme].mutedText }]}>{role}</Text>
                    </View>
                  </Pressable>
                );
              }}
            />

            {transferring && (
              <View style={styles.transferringOverlay}>
                <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
                <Text style={[{ color: Colors[colorScheme].text, marginTop: 8 }]}>Transferring...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
    fontWeight: '700',
  },
  introCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  introIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  introSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  formSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  logoSection: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  logoContainer: {
    position: 'relative',
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  logoInfo: {
    flex: 1,
  },
  logoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  logoDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  charCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  selectContainer: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
  },
  chipContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(128,128,128,0.15)',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  submitSection: {
    paddingHorizontal: 20,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  fieldHint: {
    fontSize: 13,
    marginTop: 6,
    fontStyle: 'italic',
  },
  privacyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  privacyToggleText: {
    flex: 1,
  },
  privacyToggleLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  transferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  transferButtonText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
  },
  memberEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 14,
  },
  transferringOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
});

export default EditTeamScreen;
