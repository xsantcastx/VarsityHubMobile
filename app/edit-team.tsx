import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { Team, Organization } from '@/api/entities';
import { uploadFile } from '@/api/upload';

export default function EditTeamScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  
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

  const sports = ['Basketball', 'Football', 'Soccer', 'Baseball', 'Tennis', 'Volleyball', 'Swimming', 'Track & Field', 'Other'];
  const seasons = ['Spring 2025', 'Summer 2025', 'Fall 2025', 'Winter 2025/26'];

  useEffect(() => {
    if (params?.id) {
      loadTeam();
    }
  }, [params?.id]);

  const loadTeam = async () => {
    try {
      setLoading(true);
      const teamData = await Team.get(params.id);
      setTeam(teamData);
      setName(teamData.name || '');
      setDescription(teamData.description || '');
      setSport(teamData.sport || '');
      setSeason(teamData.season || '');
      setExistingLogoUrl(teamData.logo_url || teamData.avatar_url || null);
      
      const orgFromResponse = (teamData as any).organization;
      if (orgFromResponse?.name) {
        setOrganizationName(orgFromResponse.name);
      } else if (teamData.organization_id) {
        try {
          const org = await Organization.get(teamData.organization_id);
          setOrganizationName(org.name || '');
        } catch (err) {
          console.error('Failed to load organization:', err);
          setOrganizationName('');
        }
      } else {
        setOrganizationName('');
      }
    } catch (error) {
      console.error('Failed to load team:', error);
      Alert.alert('Error', 'Failed to load team data. Please try again.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (result.granted === false) {
      Alert.alert('Permission Required', 'Please allow access to your photos to upload a team logo.');
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
      setLogoUri(pickerResult.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.requestCameraPermissionsAsync();
    
    if (result.granted === false) {
      Alert.alert('Permission Required', 'Please allow camera access to take a team logo photo.');
      return;
    }

    const pickerResult = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      exif: false,
    });

    if (!pickerResult.canceled && pickerResult.assets[0]) {
      setLogoUri(pickerResult.assets[0].uri);
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
          const base = (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_URL) ||
            (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000');
          const uploaded = await uploadFile(base, logoUri, 'team-logo.jpg', 'image/jpeg');
          logoUrl = uploaded?.url || uploaded?.path;
          console.log('Logo uploaded:', logoUrl);
        } catch (error) {
          console.error('Logo upload failed:', error);
          Alert.alert('Warning', 'Team updated but logo upload failed. Please try updating the logo again.');
        }
      }
      
      // Handle organization - find existing or create new
      let organizationId: string | null | undefined = team?.organization_id ?? null; // Keep existing by default
      const trimmedOrgName = organizationName.trim();
      
      if (trimmedOrgName) {
        try {
          console.log('[EditTeam] Searching for organization:', trimmedOrgName);
          // Search for existing organization
          const existingOrgs = await Organization.list(trimmedOrgName, 10);
          console.log('[EditTeam] Search results:', JSON.stringify(existingOrgs));
          
          if (Array.isArray(existingOrgs) && existingOrgs.length > 0) {
            // Check for exact match (case-insensitive)
            const exactMatch = existingOrgs.find((org: any) => 
              org.name?.toLowerCase() === trimmedOrgName.toLowerCase()
            );
            
            if (exactMatch) {
              organizationId = exactMatch.id;
              console.log('[EditTeam] Using exact match:', organizationId);
            } else {
              // Use first result if no exact match
              organizationId = existingOrgs[0].id;
              console.log('[EditTeam] Using first result:', organizationId);
            }
          } else {
            // Create new organization if none found
            try {
              console.log('[EditTeam] Creating new organization');
              const newOrg = await Organization.createOrganization({
                name: trimmedOrgName,
                description: `Organization for ${trimmedOrgName}`,
              });
              organizationId = newOrg.id;
              console.log('[EditTeam] Created organization:', organizationId);
            } catch (orgErr: any) {
              console.error('[EditTeam] Failed to create organization:', orgErr);
              console.error('[EditTeam] Error message:', orgErr?.message);
              Alert.alert('Warning', `Could not create organization. Team will be updated without organization change.`);
              // Continue without changing organization if creation fails
            }
          }
        } catch (err: any) {
          console.error('[EditTeam] Error handling organization:', err);
          console.error('[EditTeam] Error message:', err?.message);
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
        season: season || undefined,
      };
      if (logoUrl) {
        teamData.logo_url = logoUrl;
      }
      // Always send organization fields when they change
      if (organizationId !== undefined) {
        teamData.organization_id = organizationId;
        teamData.organization_name = trimmedOrgName || undefined;
      }
      
      console.log('[EditTeam] Updating team with data:', JSON.stringify(teamData));
      await Team.update(params.id!, teamData);
      console.log('[EditTeam] Team update successful');
      setExistingLogoUrl(logoUrl || null);
      setLogoUri(null);
      if (organizationId !== undefined) {
        setTeam((prev: any) => prev ? {
          ...prev,
          organization_id: organizationId,
          organization: organizationId
            ? { id: organizationId, name: trimmedOrgName }
            : null,
        } : prev);
        setOrganizationName(organizationId ? trimmedOrgName : '');
      }
      Alert.alert('Success!', 'Your team has been updated successfully.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      console.error('Team update error:', e);
      Alert.alert('Error', e?.message || 'Failed to update team. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors[colorScheme].text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]}>Edit Team</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Intro Card */}
        <View style={[styles.introCard, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
          <LinearGradient colors={[Colors[colorScheme].tint, Colors[colorScheme].tint + 'CC']} style={styles.introIcon}>
            <Ionicons name="create" size={28} color="#fff" />
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
                  <Ionicons name="camera" size={32} color={Colors[colorScheme].mutedText} />
                </View>
              )}
              <View style={[styles.logoOverlay, { backgroundColor: Colors[colorScheme].tint }]}>
                <Ionicons name="camera" size={20} color="#fff" />
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
        </View>

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
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Update Team</Text>
              </>
            )}
          </Pressable>
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
    backgroundColor: 'rgba(0,0,0,0.05)',
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
});

