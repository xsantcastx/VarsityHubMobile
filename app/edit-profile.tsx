import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { User } from '@/api/entities';
import { uploadFile } from '@/api/upload';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const SPORTS_OPTIONS = [
  'Football', 'Basketball', 'Baseball', 'Soccer', 'Volleyball', 
  'Track & Field', 'Swimming', 'Hockey', 'Tennis', 'Golf', 'Wrestling', 'Other'
];

export default function EditProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Profile fields
  const [displayName, setDisplayName] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Sports interests
  const [sportsInterests, setSportsInterests] = useState<string[]>([]);
  
  // Team member fields
  const [position, setPosition] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  
  // User info
  const [userRole, setUserRole] = useState<string | null>(null);

  const loadUserData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me: any = await User.me();
      console.log('User data loaded:', me); // Debug log
      
      // Direct fields
      setDisplayName(me?.display_name || '');
      setBio(me?.bio || '');
      setAvatarUrl(me?.avatar_url || null);
      
      // Fields from preferences
      const prefs = me?.preferences || {};
      setFullName(prefs?.full_name || me?.full_name || '');
      setZipCode(prefs?.zip_code || me?.zip_code || '');
      
      // Handle date of birth from preferences or direct field
      const dobValue = prefs?.date_of_birth || me?.date_of_birth;
      if (dobValue) {
        try {
          const date = new Date(dobValue);
          setDateOfBirth(date);
        } catch (e) {
          console.warn('Invalid date format:', dobValue);
          setDateOfBirth(null);
        }
      }
      
      // Handle sports interests - check preferences first, then direct field, then legacy location
      const interests = prefs?.sports_interests || 
                       me?.sports_interests || 
                       [];
      setSportsInterests(Array.isArray(interests) ? interests : []);
      
      // Team member fields from preferences
      setPosition(prefs?.position || me?.position || '');
      setJerseyNumber(prefs?.jersey_number ? String(prefs.jersey_number) : (me?.jersey_number ? String(me.jersey_number) : ''));
      const derivedRole = prefs?.role || me?.user_role || me?.initial_role_selection || null;
      setUserRole(derivedRole);
    } catch (e: any) {
      console.error('Error loading profile:', e);
      setError('You must sign in to edit your profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [loadUserData])
  );

  const toggleSport = (sport: string) => {
    setSportsInterests(prev => 
      prev.includes(sport) 
        ? prev.filter(s => s !== sport)
        : prev.length < 3 
          ? [...prev, sport]
          : prev // Don't add more if already at max
    );
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || dateOfBirth;
    setShowDatePicker(Platform.OS === 'ios');
    setDateOfBirth(currentDate);
  };

  const formatDateForDisplay = (date: Date | null) => {
    if (!date) return 'Select your date of birth';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateForAPI = (date: Date | null) => {
    if (!date) return undefined;
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };

  const pickAvatarImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Gallery permission is needed to select a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const takeAvatarPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera permission is needed to take a profile picture.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    setUploadingAvatar(true);
    try {
      // Compress and resize the image
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Upload to server
      const baseUrl = (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_URL) || 'https://api-production-8ac3.up.railway.app';
      const uploadResult = await uploadFile(baseUrl, manipulatedImage.uri, 'avatar.jpg', 'image/jpeg');
      
      if (uploadResult?.url) {
        setAvatarUrl(uploadResult.url);
        Alert.alert('Success', 'Profile picture uploaded successfully!');
      } else {
        throw new Error('Upload failed - no URL returned');
      }
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      Alert.alert('Upload Failed', error?.message || 'Failed to upload profile picture. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const showAvatarOptions = () => {
    Alert.alert(
      'Profile Picture',
      'Choose how you\'d like to update your profile picture',
      [
        { text: 'Take Photo', onPress: takeAvatarPhoto },
        { text: 'Choose from Gallery', onPress: pickAvatarImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const onSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Display name is required.');
      return;
    }
    
    setSaving(true);
    try {
      // Prepare data for server - split into direct fields and preferences
      const directFields: any = {
        display_name: displayName.trim(),
        bio: bio.trim() || undefined,
      };

      // Include avatar URL if it was updated
      if (avatarUrl) {
        directFields.avatar_url = avatarUrl;
      }

      // Store additional fields in preferences object
      const preferences: any = {};
      if (fullName.trim()) preferences.full_name = fullName.trim();
      if (zipCode.trim()) preferences.zip_code = zipCode.trim();
      if (dateOfBirth) preferences.date_of_birth = formatDateForAPI(dateOfBirth);
      if (sportsInterests.length > 0) preferences.sports_interests = sportsInterests;
      if (position.trim()) preferences.position = position.trim();
      if (jerseyNumber.trim()) preferences.jersey_number = jerseyNumber.trim();

      // Add preferences to update data if we have any
      if (Object.keys(preferences).length > 0) {
        directFields.preferences = preferences;
      }
      
      console.log('Saving profile data:', directFields); // Debug log
      await User.updateMe(directFields);
      Alert.alert('Saved', 'Profile updated successfully.');
      router.back();
    } catch (e: any) {
      console.error('Save error:', e);
      Alert.alert('Error', e?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const isTeamMember = userRole === 'team_member' || userRole?.includes('team');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen 
        options={{ 
          title: 'Edit Profile',
          headerStyle: { backgroundColor: Colors[colorScheme].background },
          headerTintColor: Colors[colorScheme].text,
        }} 
      />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
          <Text style={[styles.loadingText, { color: Colors[colorScheme].mutedText }]}>
            Loading profile...
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.headerSection}>
              <Text style={[styles.pageTitle, { color: Colors[colorScheme].text }]}>
                Personalize Your Profile
              </Text>
              <Text style={[styles.pageSubtitle, { color: Colors[colorScheme].mutedText }]}>
                Help others get to know you better
              </Text>
            </View>

            {error ? (
              <View style={[styles.errorContainer, { backgroundColor: Colors[colorScheme].surface }]}>
                <Text style={[styles.error, { color: '#EF4444' }]}>{error}</Text>
              </View>
            ) : null}

            {/* Profile Picture Section */}
            <View style={[styles.section, { 
              backgroundColor: Colors[colorScheme].card,
              borderColor: Colors[colorScheme].border,
            }]}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                <Ionicons name="camera-outline" size={20} color={Colors[colorScheme].tint} />
                {' '}Profile Picture
              </Text>
              
              <View style={styles.avatarSection}>
                <View style={styles.avatarContainer}>
                  {avatarUrl ? (
                    <Image 
                      source={{ uri: avatarUrl }} 
                      style={styles.avatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: Colors[colorScheme].surface }]}>
                      <Ionicons 
                        name="person-outline" 
                        size={40} 
                        color={Colors[colorScheme].mutedText} 
                      />
                    </View>
                  )}
                  
                  {uploadingAvatar && (
                    <View style={styles.avatarLoader}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  )}
                </View>
                
                <Pressable 
                  onPress={showAvatarOptions}
                  disabled={uploadingAvatar}
                  style={[styles.changeAvatarButton, { 
                    backgroundColor: Colors[colorScheme].tint,
                    opacity: uploadingAvatar ? 0.6 : 1,
                  }]}
                >
                  <Ionicons name="camera-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.changeAvatarText}>
                    {uploadingAvatar ? 'Uploading...' : 'Change Photo'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Basic Information Section */}
            <View style={[styles.section, { 
              backgroundColor: Colors[colorScheme].card,
              borderColor: Colors[colorScheme].border,
            }]}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                <Ionicons name="person-circle-outline" size={20} color={Colors[colorScheme].tint} />
                {' '}Basic Information
              </Text>
              
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Display Name *</Text>
                <Input 
                  value={displayName} 
                  onChangeText={setDisplayName} 
                  placeholder="How you want to appear to others" 
                  placeholderTextColor={Colors[colorScheme].mutedText}
                  style={[styles.input, { 
                    borderColor: Colors[colorScheme].border,
                    backgroundColor: Colors[colorScheme].surface,
                    color: Colors[colorScheme].text,
                  }]} 
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Full Name</Text>
                <Input 
                  value={fullName} 
                  onChangeText={setFullName} 
                  placeholder="Your complete name" 
                  placeholderTextColor={Colors[colorScheme].mutedText}
                  style={[styles.input, { 
                    borderColor: Colors[colorScheme].border,
                    backgroundColor: Colors[colorScheme].surface,
                    color: Colors[colorScheme].text,
                  }]} 
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Bio</Text>
                <Input 
                  value={bio} 
                  onChangeText={setBio} 
                  placeholder="Tell everyone about yourself..." 
                  placeholderTextColor={Colors[colorScheme].mutedText}
                  multiline
                  numberOfLines={3}
                  style={[styles.textArea, { 
                    borderColor: Colors[colorScheme].border,
                    backgroundColor: Colors[colorScheme].surface,
                    color: Colors[colorScheme].text,
                  }]} 
                />
              </View>
            </View>

            {/* Location & Details Section */}
            <View style={[styles.section, { 
              backgroundColor: Colors[colorScheme].card,
              borderColor: Colors[colorScheme].border,
            }]}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                <Ionicons name="location-outline" size={20} color={Colors[colorScheme].tint} />
                {' '}Location & Details
              </Text>
              
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: Colors[colorScheme].text }]}>ZIP Code</Text>
                <Input 
                  value={zipCode} 
                  onChangeText={setZipCode} 
                  placeholder="12345" 
                  placeholderTextColor={Colors[colorScheme].mutedText}
                  keyboardType="numeric"
                  maxLength={10}
                  style={[styles.input, { 
                    borderColor: Colors[colorScheme].border,
                    backgroundColor: Colors[colorScheme].surface,
                    color: Colors[colorScheme].text,
                  }]} 
                />
                <Text style={[styles.fieldNote, { color: Colors[colorScheme].mutedText }]}>
                  Helps us show you local games and events
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Date of Birth</Text>
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  style={[styles.input, { 
                    borderColor: Colors[colorScheme].border,
                    backgroundColor: Colors[colorScheme].surface,
                    justifyContent: 'center',
                  }]}
                >
                  <Text style={[
                    styles.dateText,
                    { 
                      color: dateOfBirth ? Colors[colorScheme].text : Colors[colorScheme].mutedText 
                    }
                  ]}>
                    {formatDateForDisplay(dateOfBirth)}
                  </Text>
                  <Ionicons 
                    name="calendar-outline" 
                    size={20} 
                    color={Colors[colorScheme].mutedText}
                    style={styles.dateIcon}
                  />
                </Pressable>
                
                {showDatePicker && (
                  <DateTimePicker
                    testID="dateTimePicker"
                    value={dateOfBirth || new Date()}
                    mode="date"
                    is24Hour={true}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                    maximumDate={new Date()}
                    minimumDate={new Date(1900, 0, 1)}
                  />
                )}
                
                <Text style={[styles.fieldNote, { color: Colors[colorScheme].mutedText }]}>
                  Used for age-appropriate content and team matching
                </Text>
              </View>
            </View>

            {/* Sports & Interests Section */}
            <View style={[styles.section, { 
              backgroundColor: Colors[colorScheme].card,
              borderColor: Colors[colorScheme].border,
            }]}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                <Ionicons name="football-outline" size={20} color={Colors[colorScheme].tint} />
                {' '}Sports & Interests
              </Text>
              <Text style={[styles.sectionNote, { color: Colors[colorScheme].mutedText }]}>
                Select up to 3 sports you're interested in
              </Text>
              
              <View style={styles.sportsGrid}>
                {SPORTS_OPTIONS.map((sport) => (
                  <Pressable
                    key={sport}
                    style={[
                      styles.sportChip,
                      {
                        backgroundColor: sportsInterests.includes(sport) 
                          ? Colors[colorScheme].tint 
                          : Colors[colorScheme].surface,
                        borderColor: sportsInterests.includes(sport) 
                          ? Colors[colorScheme].tint 
                          : Colors[colorScheme].border,
                      }
                    ]}
                    onPress={() => toggleSport(sport)}
                  >
                    <Text style={[
                      styles.sportChipText,
                      {
                        color: sportsInterests.includes(sport) 
                          ? '#FFFFFF' 
                          : Colors[colorScheme].text,
                      }
                    ]}>
                      {sport}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.selectedCount, { color: Colors[colorScheme].mutedText }]}>
                Selected: {sportsInterests.length}/3
              </Text>
            </View>

            {/* Team Member Section */}
            {isTeamMember && (
              <View style={[styles.section, { 
                backgroundColor: Colors[colorScheme].card,
                borderColor: Colors[colorScheme].border,
              }]}>
                <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                  <Ionicons name="people-outline" size={20} color={Colors[colorScheme].tint} />
                  {' '}Team Member Info
                </Text>
                
                <View style={styles.fieldRow}>
                  <View style={[styles.fieldGroup, { flex: 2 }]}>
                    <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Position</Text>
                    <Input 
                      value={position} 
                      onChangeText={setPosition} 
                      placeholder="e.g., Point Guard" 
                      placeholderTextColor={Colors[colorScheme].mutedText}
                      style={[styles.input, { 
                        borderColor: Colors[colorScheme].border,
                        backgroundColor: Colors[colorScheme].surface,
                        color: Colors[colorScheme].text,
                      }]} 
                    />
                  </View>
                  
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Jersey #</Text>
                    <Input 
                      value={jerseyNumber} 
                      onChangeText={setJerseyNumber} 
                      placeholder="23" 
                      placeholderTextColor={Colors[colorScheme].mutedText}
                      keyboardType="numeric"
                      maxLength={3}
                      style={[styles.input, { 
                        borderColor: Colors[colorScheme].border,
                        backgroundColor: Colors[colorScheme].surface,
                        color: Colors[colorScheme].text,
                      }]} 
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Save Button */}
            <View style={styles.saveSection}>
              <Pressable 
                onPress={onSave} 
                disabled={saving}
                style={[
                  styles.saveButton, 
                  { 
                    backgroundColor: saving ? Colors[colorScheme].mutedText : Colors[colorScheme].tint,
                    opacity: saving ? 0.6 : 1,
                  }
                ]}
              >
                <Text style={[styles.saveButtonText, { color: '#FFFFFF' }]}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      )}
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
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  headerSection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  pageSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  error: {
    textAlign: 'center',
    fontWeight: '600',
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    alignItems: 'center',
  },
  sectionNote: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  fieldNote: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  sportChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  sportChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectedCount: {
    fontSize: 12,
    textAlign: 'center',
  },
  saveSection: {
    marginTop: 8,
    paddingTop: 16,
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 16,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  dateText: {
    fontSize: 16,
    flex: 1,
  },
  dateIcon: {
    position: 'absolute',
    right: 12,
  },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  
  // Avatar styles
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  avatarLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeAvatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  changeAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
