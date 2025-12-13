import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View, Animated, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { User } from '@/api/entities';
import { uploadFile } from '@/api/upload';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getApiBaseUrl } from '../api/http';

const SPORTS_OPTIONS = [
  'Football', 'Basketball', 'Baseball', 'Soccer', 'Volleyball', 
  'Track & Field', 'Swimming', 'Hockey', 'Tennis', 'Golf', 'Wrestling', 'Other'
];

const THEME_COLORS = [
  { name: 'VarsityHub Blue', value: '#3B82F6', gradient: ['#1e3a8a', '#3b82f6', '#60a5fa'] },
  { name: 'Championship Red', value: '#DC2626', gradient: ['#7f1d1d', '#dc2626', '#ef4444'] },
  { name: 'Victory Green', value: '#10B981', gradient: ['#065f46', '#10b981', '#34d399'] },
  { name: 'Gold Medal', value: '#F59E0B', gradient: ['#78350f', '#f59e0b', '#fbbf24'] },
  { name: 'Royal Purple', value: '#8B5CF6', gradient: ['#4c1d95', '#8b5cf6', '#a78bfa'] },
  { name: 'Classic Gray', value: '#6B7280', gradient: ['#1f2937', '#6b7280', '#9ca3af'] },
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
  const [location, setLocation] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
  const [headerImageTouched, setHeaderImageTouched] = useState(false);
  const [uploadingHeaderImage, setUploadingHeaderImage] = useState(false);
  const [headerImageOffset, setHeaderImageOffset] = useState(0); // normalized -1..1
  const [headerImageOffsetTouched, setHeaderImageOffsetTouched] = useState(false);
  
  // Sports interests
  const [sportsInterests, setSportsInterests] = useState<string[]>([]);
  
  // Theme color
  const [themeColor, setThemeColor] = useState<string>('#3B82F6'); // Default VarsityHub Blue
  
  // Team member fields
  const [position, setPosition] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  
  // Athlete-specific fields
  const [gradeLevel, setGradeLevel] = useState<'Freshman' | 'Sophomore' | 'Junior' | 'Senior' | ''>('');
  const [graduationYear, setGraduationYear] = useState('');
  const [accolades, setAccolades] = useState(''); // Comma-separated string
  const [primarySport, setPrimarySport] = useState('');
  
  // User info
  const [userRole, setUserRole] = useState<string | null>(null);
  const [hasTeamMembership, setHasTeamMembership] = useState(false);

  const HEADER_IMAGE_DRAG_LIMIT = 120;
  const clampValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const headerImagePanStart = useRef(0);
  const headerImageAnimatedOffset = useRef(new Animated.Value(0)).current;

  const loadUserData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me: any = await User.me();
      const prefs = me?.preferences || {};
      
      // Direct fields
      setDisplayName(me?.display_name || '');
      setBio(me?.bio || '');
      setAvatarUrl(me?.avatar_url || null);
      const headerImagePref = prefs?.header_image_url || prefs?.profile_header_image_url || me?.header_image_url;
      setHeaderImageUrl(headerImagePref || null);
      setHeaderImageTouched(false);
      setHeaderImageOffset(typeof prefs?.header_image_focus_y === 'number' ? clampValue(prefs.header_image_focus_y, -1, 1) : 0);
      setHeaderImageOffsetTouched(false);
      
      // Fields from preferences
      setFullName(prefs?.full_name || me?.full_name || '');
      setLocation(prefs?.location || me?.location || '');
      setZipCode(prefs?.zip_code || me?.zip_code || '');
      
      // Handle date of birth from preferences or direct field
      const dobValue = prefs?.date_of_birth || me?.date_of_birth;
      if (dobValue) {
        try {
          const date = new Date(dobValue);
          setDateOfBirth(date);
        } catch (_error) {
          console.warn('Invalid date format:', dobValue);
          setDateOfBirth(null);
        }
      }
      
      // Handle sports interests - check preferences first, then direct field, then legacy location
      const interests = prefs?.sports_interests || 
                       me?.sports_interests || 
                       [];
      setSportsInterests(Array.isArray(interests) ? interests : []);
      
      // Theme color from preferences
      setThemeColor(prefs?.theme_color || '#3B82F6');
      
      // Team member fields from preferences
      setPosition(prefs?.position || me?.position || '');
      setJerseyNumber(prefs?.jersey_number ? String(prefs.jersey_number) : (me?.jersey_number ? String(me.jersey_number) : ''));
      
      // Athlete-specific fields from preferences
      setGradeLevel(prefs?.grade_level || '');
      setGraduationYear(prefs?.graduation_year ? String(prefs.graduation_year) : '');
      setAccolades(prefs?.accolades && Array.isArray(prefs.accolades) ? prefs.accolades.join(', ') : '');
      setPrimarySport(prefs?.primary_sport || prefs?.sport || '');
      
      const membershipArrays = [
        prefs?.team_roles,
        prefs?.memberships,
        prefs?.teams,
        me?.team_roles,
        me?.teams,
        me?.memberships,
        me?.team_memberships,
      ];
      const membershipHints = [
        prefs?.team_role,
        prefs?.team_id,
        prefs?.primary_team_id,
        me?.team_role,
        me?.team_id,
        me?.primary_team_id,
      ];
      const detectedMembership =
        membershipArrays.some((value) => Array.isArray(value) && value.length > 0) ||
        membershipHints.some((value) => Boolean(value));
      setHasTeamMembership(detectedMembership);

      let derivedRole = prefs?.role || me?.role || me?.user_role || me?.initial_role_selection || null;
      if (detectedMembership && (!derivedRole || derivedRole === 'fan')) {
        derivedRole = 'team_member';
      }
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
      exif: false,
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
      exif: false,
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
      const uploadResult = await uploadFile(getApiBaseUrl(), manipulatedImage.uri, 'avatar.jpg', 'image/jpeg');
      
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

  const pickHeaderImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Gallery permission is needed to select a background image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 2],
      quality: 0.85,
      exif: false,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      await uploadHeaderImage(result.assets[0].uri);
    }
  };

  const uploadHeaderImage = async (uri: string) => {
    setUploadingHeaderImage(true);
    try {
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      const uploadResult = await uploadFile(getApiBaseUrl(), manipulatedImage.uri, 'profile-cover.jpg', 'image/jpeg');
      if (uploadResult?.url) {
        setHeaderImageUrl(uploadResult.url);
        setHeaderImageTouched(true);
        Alert.alert('Background updated', 'Your profile background image looks great!');
      } else {
        throw new Error('Upload failed - no URL returned');
      }
    } catch (error: any) {
      console.error('Header image upload error:', error);
      Alert.alert('Upload Failed', error?.message || 'Failed to upload background image. Please try again.');
    } finally {
      setUploadingHeaderImage(false);
    }
  };

  const removeHeaderImage = () => {
    setHeaderImageUrl(null);
    setHeaderImageTouched(true);
    setHeaderImageOffset(0);
    setHeaderImageOffsetTouched(true);
  };

  useEffect(() => {
    Animated.spring(headerImageAnimatedOffset, {
      toValue: headerImageOffset * HEADER_IMAGE_DRAG_LIMIT,
      useNativeDriver: true,
    }).start();
  }, [headerImageOffset, headerImageAnimatedOffset]);

  const headerImagePanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => Boolean(headerImageUrl),
    onMoveShouldSetPanResponder: () => Boolean(headerImageUrl),
    onPanResponderGrant: () => {
      headerImagePanStart.current = headerImageOffset;
    },
    onPanResponderMove: (_evt, gestureState) => {
      if (!headerImageUrl) return;
      const next = clampValue(headerImagePanStart.current + gestureState.dy / HEADER_IMAGE_DRAG_LIMIT, -1, 1);
      headerImageAnimatedOffset.setValue(next * HEADER_IMAGE_DRAG_LIMIT);
    },
    onPanResponderRelease: (_evt, gestureState) => {
      if (!headerImageUrl) return;
      const next = clampValue(headerImagePanStart.current + gestureState.dy / HEADER_IMAGE_DRAG_LIMIT, -1, 1);
      setHeaderImageOffset(next);
      setHeaderImageOffsetTouched(true);
    },
    onPanResponderTerminationRequest: () => true,
    onPanResponderTerminate: () => {},
  }), [headerImageUrl, headerImageOffset, headerImageAnimatedOffset]);

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
      if (location.trim()) preferences.location = location.trim();
      if (zipCode.trim()) preferences.zip_code = zipCode.trim();
      if (dateOfBirth) preferences.date_of_birth = formatDateForAPI(dateOfBirth);
      if (sportsInterests.length > 0) preferences.sports_interests = sportsInterests;
      if (themeColor) preferences.theme_color = themeColor;
      if (headerImageTouched) {
        preferences.header_image_url = headerImageUrl || null;
      }
      if (position.trim()) preferences.position = position.trim();
      if (jerseyNumber.trim()) preferences.jersey_number = jerseyNumber.trim();
      
      // Athlete-specific fields
      if (gradeLevel) preferences.grade_level = gradeLevel;
      if (graduationYear.trim()) {
        const year = parseInt(graduationYear.trim(), 10);
        if (!isNaN(year) && year >= 2020 && year <= 2040) {
          preferences.graduation_year = year;
        }
      }
      if (accolades.trim()) {
        // Split by comma and clean up
        const accoladesList = accolades.split(',').map(a => a.trim()).filter(Boolean);
        if (accoladesList.length > 0) {
          preferences.accolades = accoladesList;
        }
      }
      if (primarySport.trim()) preferences.primary_sport = primarySport.trim().toLowerCase();

      // Add preferences to update data if we have any
      if (Object.keys(preferences).length > 0) {
        directFields.preferences = preferences;
      }
      
      await User.updateMe(directFields);
      Alert.alert('Saved', 'Profile updated successfully.');
      
      // Redirect based on role
      if (userRole === 'coach' || userRole === 'admin') {
        // Coaches and admins go to team profile
        router.replace('/team-profile');
      } else {
        // Fans go back to previous screen
        router.back();
      }
    } catch (e: any) {
      console.error('Save error:', e);
      Alert.alert('Error', e?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const isTeamMember =
    userRole === 'team_member' ||
    userRole === 'athlete' ||
    (typeof userRole === 'string' && userRole.includes('team')) ||
    hasTeamMembership;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen 
        options={{ 
          title: 'Edit Profile',
          headerStyle: { backgroundColor: Colors[colorScheme].background },
          headerTintColor: Colors[colorScheme].text,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ paddingLeft: 8 }}>
              <Ionicons name="chevron-back" size={24} color={Colors[colorScheme].tint} />
            </Pressable>
          ),
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

              {/* Profile Background Image */}
              <View style={styles.bannerSection}>
                <Text style={[styles.bannerLabel, { color: Colors[colorScheme].text }]}>
                  <Ionicons name="image-outline" size={18} color={Colors[colorScheme].tint} /> {' '}
                  Profile Background
                </Text>
                <View style={[
                  styles.bannerPreview, 
                  { borderColor: Colors[colorScheme].border, backgroundColor: Colors[colorScheme].surface }
                ]}>
                  {headerImageUrl ? (
                    <Animated.View
                      style={[
                        styles.bannerImageWrapper,
                        {
                          transform: [{ translateY: headerImageAnimatedOffset }],
                        },
                      ]}
                      {...headerImagePanResponder.panHandlers}
                    >
                      <Image 
                        source={{ uri: headerImageUrl }} 
                        style={styles.bannerImage}
                        contentFit="cover"
                      />
                    </Animated.View>
                  ) : (
                    <View style={styles.bannerPlaceholder}>
                      <Ionicons name="color-wand-outline" size={32} color={Colors[colorScheme].mutedText} />
                      <Text style={[styles.bannerPlaceholderText, { color: Colors[colorScheme].mutedText }]}>
                        Add a wide highlight photo to appear behind your avatar
                      </Text>
                    </View>
                  )}
                  {(uploadingHeaderImage) && (
                    <View style={styles.bannerOverlay}>
                      <ActivityIndicator color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <View style={styles.bannerActions}>
                  <Pressable
                    onPress={pickHeaderImage}
                    disabled={uploadingHeaderImage}
                    style={[
                      styles.bannerButton,
                      { backgroundColor: Colors[colorScheme].tint, opacity: uploadingHeaderImage ? 0.6 : 1 },
                    ]}
                  >
                    <Ionicons name="image" size={16} color="#FFFFFF" />
                    <Text style={styles.bannerButtonText}>
                      {uploadingHeaderImage ? 'Uploading...' : headerImageUrl ? 'Change Background' : 'Add Background'}
                    </Text>
                  </Pressable>
                  {headerImageUrl ? (
                    <Pressable
                      onPress={removeHeaderImage}
                      style={[styles.bannerButton, styles.bannerRemoveButton]}
                    >
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                      <Text style={[styles.bannerButtonText, { color: '#DC2626' }]}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
                {headerImageUrl ? (
                  <View style={styles.bannerAdjustmentRow}>
                    <Text style={[styles.fieldNote, { color: Colors[colorScheme].mutedText, flex: 1 }]}>
                      Drag the image to fine-tune what shows in your profile hero.
                    </Text>
                    <Pressable
                      onPress={() => { setHeaderImageOffset(0); setHeaderImageOffsetTouched(true); }}
                      style={styles.bannerResetButton}
                    >
                      <Ionicons name="refresh" size={16} color={Colors[colorScheme].tint} />
                      <Text style={[styles.bannerButtonText, { color: Colors[colorScheme].tint }]}>Reset Position</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={[styles.fieldNote, { color: Colors[colorScheme].mutedText }]}>
                    Recommended 3:2 photo (at least 1200px wide) so your profile hero matches the latest design.
                  </Text>
                )}
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
                <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Location / Team</Text>
                <Input 
                  value={location} 
                  onChangeText={setLocation} 
                  placeholder="e.g., Lincoln Lions or Gotcha" 
                  placeholderTextColor={Colors[colorScheme].mutedText}
                  style={[styles.input, { 
                    borderColor: Colors[colorScheme].border,
                    backgroundColor: Colors[colorScheme].surface,
                    color: Colors[colorScheme].text,
                  }]} 
                />
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Bio</Text>
                  <Text style={[styles.charCount, { color: bio.length > 300 ? '#DC2626' : Colors[colorScheme].mutedText }]}>
                    {bio.length}/300
                  </Text>
                </View>
                <Input 
                  value={bio} 
                  onChangeText={(text) => {
                    if (text.length <= 300) {
                      setBio(text);
                    }
                  }} 
                  placeholder="Tell everyone about yourself..." 
                  placeholderTextColor={Colors[colorScheme].mutedText}
                  multiline
                  numberOfLines={3}
                  maxLength={300}
                  style={[styles.textArea, { 
                    borderColor: bio.length > 300 ? '#DC2626' : Colors[colorScheme].border,
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

            {/* Theme Color Section */}
            <View style={[styles.section, { 
              backgroundColor: Colors[colorScheme].card,
              borderColor: Colors[colorScheme].border,
            }]}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
                <Ionicons name="color-palette-outline" size={20} color={Colors[colorScheme].tint} />
                {' '}Profile Theme Color
              </Text>
              <Text style={[styles.sectionNote, { color: Colors[colorScheme].mutedText }]}>
                Choose a color that represents you
              </Text>
              
              <View style={styles.colorGrid}>
                {THEME_COLORS.map((color) => (
                  <Pressable
                    key={color.value}
                    style={[
                      styles.colorOption,
                      {
                        borderColor: themeColor === color.value 
                          ? color.value
                          : Colors[colorScheme].border,
                        borderWidth: themeColor === color.value ? 3 : 1,
                      }
                    ]}
                    onPress={() => setThemeColor(color.value)}
                  >
                    <View style={[styles.colorSwatch, { backgroundColor: color.value }]}>
                      {themeColor === color.value && (
                        <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                      )}
                    </View>
                    <Text style={[
                      styles.colorName,
                      {
                        color: Colors[colorScheme].text,
                        fontWeight: themeColor === color.value ? '700' : '500',
                      }
                    ]}>
                      {color.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              
              <View style={[styles.colorPreview, { 
                backgroundColor: Colors[colorScheme].surface,
                borderColor: Colors[colorScheme].border,
              }]}>
                <Text style={[styles.colorPreviewLabel, { color: Colors[colorScheme].mutedText }]}>
                  Preview:
                </Text>
                <View style={[styles.colorPreviewBox, { backgroundColor: themeColor }]}>
                  <Text style={styles.colorPreviewText}>Your Profile</Text>
                </View>
              </View>
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
                
                {/* Athlete-Specific Fields */}
                <View style={styles.athleteSection}>
                  <Text style={[styles.subsectionTitle, { color: Colors[colorScheme].mutedText }]}>
                    Athlete Details (Optional)
                  </Text>
                  
                  {/* Grade Level Picker */}
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Grade Level</Text>
                    <View style={styles.gradeOptions}>
                      {['Freshman', 'Sophomore', 'Junior', 'Senior'].map((grade) => (
                        <Pressable
                          key={grade}
                          onPress={() => setGradeLevel(grade as any)}
                          style={[
                            styles.gradeOption,
                            {
                              backgroundColor: gradeLevel === grade ? Colors[colorScheme].tint : Colors[colorScheme].surface,
                              borderColor: gradeLevel === grade ? Colors[colorScheme].tint : Colors[colorScheme].border,
                            }
                          ]}
                        >
                          <Text style={[
                            styles.gradeOptionText,
                            {
                              color: gradeLevel === grade ? '#FFFFFF' : Colors[colorScheme].text,
                            }
                          ]}>
                            {grade}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  
                  {/* Graduation Year */}
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Graduation Year</Text>
                    <Input 
                      value={graduationYear} 
                      onChangeText={setGraduationYear} 
                      placeholder="2025" 
                      placeholderTextColor={Colors[colorScheme].mutedText}
                      keyboardType="numeric"
                      maxLength={4}
                      style={[styles.input, { 
                        borderColor: Colors[colorScheme].border,
                        backgroundColor: Colors[colorScheme].surface,
                        color: Colors[colorScheme].text,
                      }]} 
                    />
                  </View>
                  
                  {/* Primary Sport */}
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Primary Sport</Text>
                    <Input 
                      value={primarySport} 
                      onChangeText={setPrimarySport} 
                      placeholder="e.g., basketball, football, soccer" 
                      placeholderTextColor={Colors[colorScheme].mutedText}
                      style={[styles.input, { 
                        borderColor: Colors[colorScheme].border,
                        backgroundColor: Colors[colorScheme].surface,
                        color: Colors[colorScheme].text,
                      }]} 
                    />
                  </View>
                  
                  {/* Accolades */}
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Accolades</Text>
                    <Input 
                      value={accolades} 
                      onChangeText={setAccolades} 
                      placeholder="e.g., All-State Guard, Team MVP (comma separated)" 
                      placeholderTextColor={Colors[colorScheme].mutedText}
                      multiline
                      numberOfLines={2}
                      style={[styles.input, styles.textArea, { 
                        borderColor: Colors[colorScheme].border,
                        backgroundColor: Colors[colorScheme].surface,
                        color: Colors[colorScheme].text,
                      }]} 
                    />
                    <Text style={[styles.helperText, { color: Colors[colorScheme].mutedText }]}>
                      Separate multiple accolades with commas
                    </Text>
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
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  charCount: {
    fontSize: 13,
    fontWeight: '500',
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
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  colorOption: {
    width: '47%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  colorSwatch: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  colorName: {
    fontSize: 13,
    textAlign: 'center',
  },
  colorPreview: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  colorPreviewLabel: {
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '500',
  },
  colorPreviewBox: {
    width: '100%',
    height: 80,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  colorPreviewText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
  bannerSection: {
    marginTop: 20,
    gap: 12,
  },
  bannerLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  bannerPreview: {
    height: 150,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerImageWrapper: {
    width: '100%',
    height: '100%',
  },
  bannerPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  bannerPlaceholderText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerActions: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  bannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bannerButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bannerRemoveButton: {
    borderWidth: 1,
    borderColor: '#DC2626',
    backgroundColor: 'rgba(220,38,38,0.08)',
  },
  bannerAdjustmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  bannerResetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  
  // Athlete section styles
  athleteSection: {
    marginTop: 16,
    gap: 12,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gradeOptions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  gradeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 90,
    alignItems: 'center',
  },
  gradeOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
