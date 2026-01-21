import { Input } from '@/components/ui/input';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { Type } from '@/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
// @ts-ignore
import { User } from '@/api/entities';
import { uploadFile } from '@/api/upload';
import { Colors } from '@/constants/Colors';
import { useOnboarding } from '@/context/OnboardingContext';
import { pickerMediaTypesProp } from '@/utils/picker';
import OnboardingLayout from './components/OnboardingLayout';

const ALL_INTERESTS = ['Football','Basketball','Baseball','Soccer','Volleyball','Track & Field','Swimming','Hockey','Other'] as const;

export default function Step7Profile() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnToConfirmation?: string }>();
  const returnToConfirmation = params.returnToConfirmation === 'true';
  const { state: ob, setState: setOB, setProgress } = useOnboarding();
  const colorScheme = useColorScheme() ?? 'light';
  const [avatar, setAvatar] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const styles = useMemo(() => createStyles(colorScheme), [colorScheme]);

  useEffect(() => {
    setAvatar(ob.avatar_url ?? null);
    setUsername(ob.username ?? '');
    setBio(ob.bio ?? '');
    setInterests(ob.sports_interests ?? []);
  }, [ob.avatar_url, ob.username, ob.bio, ob.sports_interests]);

  const toggleInterest = (i: string) => {
    setInterests((prev) => {
      const has = prev.includes(i);
      if (has) return prev.filter(x => x !== i);
      if (prev.length >= 3) {
        Alert.alert('Maximum Reached', 'You can select up to 3 sports interests.');
        return prev;
      }
      return [...prev, i];
    });
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission required'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      ...pickerMediaTypesProp(),
      allowsEditing: true,
      aspect: [1, 1],
      selectionLimit: 1,
      quality: 0.9,
    } as any);
    if ((res as any).canceled) return;
    const asset = (res as any).assets?.[0];
    if (!asset?.uri) return;
    try {
      setUploading(true);
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 800 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      const fileName = (asset.fileName && String(asset.fileName).includes('.')) ? String(asset.fileName) : `avatar_${Date.now()}.jpg`;
      
      // Use shared upload helper with consistent auth/retry logic
      const { url } = await uploadFile(null, manipulated.uri, fileName);
      setAvatar(url);
    } catch (e: any) { Alert.alert('Upload failed', e?.message || 'Try again later'); }
    finally { setUploading(false); }
  };

  const onContinue = async () => {
    // Normalize username (lowercase, replace spaces with underscores)
    const normalizedUsername = username.trim().toLowerCase().replace(/\s+/g, '_');
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/41b116d6-d712-458a-b639-8da7c3c9e7c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'step-7-profile.tsx:83',message:'Continue button pressed',data:{username:username?.length,usernameValue:username,normalizedUsername,hasAvatar:!!avatar,hasBio:!!bio,interestsCount:interests.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    // Validate username is required
    if (!normalizedUsername || normalizedUsername.length === 0) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/41b116d6-d712-458a-b639-8da7c3c9e7c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'step-7-profile.tsx:88',message:'Validation failed: username empty',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      Alert.alert('Username Required', 'Please enter a username to continue.');
      return;
    }

    if (normalizedUsername.length < 3) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/41b116d6-d712-458a-b639-8da7c3c9e7c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'step-7-profile.tsx:94',message:'Validation failed: username too short',data:{length:normalizedUsername.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      Alert.alert('Username Too Short', 'Username must be at least 3 characters.');
      return;
    }

    setSaving(true);
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/41b116d6-d712-458a-b639-8da7c3c9e7c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'step-7-profile.tsx:100',message:'Starting save process',data:{normalizedUsername,avatar:!!avatar,bio:!!bio,interests:interests},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      // Save to context (use normalized username)
      setOB((prev) => ({ 
        ...prev, 
        avatar_url: avatar || undefined,
        username: normalizedUsername,
        bio: bio || undefined,
        sports_interests: interests as any
      }));
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/41b116d6-d712-458a-b639-8da7c3c9e7c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'step-7-profile.tsx:110',message:'Context updated, calling API',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      // Save to backend (use normalized username)
      await User.patchMe({ 
        avatar_url: avatar || undefined,
        username: normalizedUsername, 
        bio: bio || undefined, 
        preferences: { sports_interests: interests } 
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/41b116d6-d712-458a-b639-8da7c3c9e7c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'step-7-profile.tsx:120',message:'API call successful, navigating',data:{returnToConfirmation},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/41b116d6-d712-458a-b639-8da7c3c9e7c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'step-7-profile.tsx:124',message:'Progress advancing to step 8',data:{currentStep:7,nextProgress:6,hasInterests:interests.length>0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      setProgress(6); // step-8-interests is index 6 in stepRoutes array
      if (returnToConfirmation) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/41b116d6-d712-458a-b639-8da7c3c9e7c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'step-7-profile.tsx:128',message:'Navigating to confirmation',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        router.replace('/onboarding/step-10-confirmation');
      } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/41b116d6-d712-458a-b639-8da7c3c9e7c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'step-7-profile.tsx:132',message:'Navigating to step-8-interests',data:{progress:6},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
        // Continue to interests - use replace to avoid back navigation issues
        console.log('[step-7-profile] Navigating to step-8-interests, progress set to:', 6);
        router.replace('/onboarding/step-8-interests');
      }
    } catch (e: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/41b116d6-d712-458a-b639-8da7c3c9e7c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'step-7-profile.tsx:138',message:'Error saving profile',data:{error:e?.message,status:e?.status,data:e?.data,stack:e?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      console.error('[step-7-profile] Failed to save:', e);
      Alert.alert('Failed to save profile', e?.message || e?.data?.error || 'Please try again'); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <OnboardingLayout
      step={6}
      title="Create Your Profile"
      subtitle="Add a profile picture, bio, and interests to help others connect with you"
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Profile Picture Section */}
      <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={32} color={Colors[colorScheme].mutedText} />
              </View>
            )}
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <Text style={styles.uploadingText}>Uploading...</Text>
              </View>
            )}
          </View>
          <Pressable 
            onPress={pickImage} 
            disabled={uploading}
            accessibilityRole="button" 
            accessibilityLabel={avatar ? 'Change Photo' : 'Pick Profile Picture'} 
            style={styles.photoButton}
          >
            <Ionicons 
              name="camera" 
              size={16} 
              color={Colors[colorScheme].text} 
              style={{ marginRight: 8 }} 
            />
            <Text style={styles.photoButtonText}>
              {avatar ? 'Change Photo' : 'Add Profile Picture'}
            </Text>
          </Pressable>
        </View>

        {/* Username Section */}
        <Text style={styles.sectionTitle}>Username</Text>
        <Text style={styles.sectionDescription}>
          Choose a unique username
        </Text>
        <Input 
          value={username} 
          onChangeText={setUsername} 
          placeholder="e.g., shamgod_00"
          autoCapitalize="none"
          style={styles.usernameInput}
        />

        {/* Bio/Tagline Section */}
        <Text style={styles.sectionTitle}>Bio / Tagline</Text>
        <Text style={styles.sectionDescription}>
          Tell others about yourself (optional)
        </Text>
        <Input 
          value={bio} 
          onChangeText={setBio} 
          placeholder={
            ob.role === 'fan' 
              ? "e.g., Huge sports fan, love supporting local teams and catching Friday night games"
              : "e.g., Coach with 10+ years experience, passionate about developing young athletes"
          }
          multiline
          numberOfLines={3}
          style={styles.bioInput}
        />

        {/* Sports Interests Section */}
        <Text style={styles.sectionTitle}>Sports Interests</Text>
        <Text style={styles.sectionDescription}>
          Choose up to 3 sports you're interested in ({interests.length}/3 selected)
        </Text>
        <View style={styles.interestsGrid}>
          {ALL_INTERESTS.map((interest) => {
            const isSelected = interests.includes(interest);
            const canSelect = interests.length < 3 || isSelected;
            
            return (
              <Pressable 
                key={interest}
                onPress={() => canSelect && toggleInterest(interest)}
                disabled={!canSelect}
                style={[
                  styles.interestChip,
                  isSelected && styles.interestChipSelected,
                  !canSelect && styles.interestChipDisabled
                ]}
              >
                <Text style={[
                  styles.interestChipText,
                  isSelected && styles.interestChipTextSelected
                ]}>
                  {interest}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Continue Button */}
        <View style={styles.continueSection}>
          <PrimaryButton 
            label={saving ? 'Saving Profile...' : 'Continue'} 
            onPress={onContinue} 
            disabled={saving || uploading || !username.trim()} 
            loading={saving} 
          />
        </View>
    </OnboardingLayout>
  );
}

const createStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors[colorScheme].background },
  title: { ...(Type.h1 as any), marginBottom: 8, textAlign: 'center', color: Colors[colorScheme].text },
  subtitle: { color: Colors[colorScheme].mutedText, marginBottom: 24, textAlign: 'center', fontSize: 16, lineHeight: 24 },
  
  // Avatar Section
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#F3F4F6',
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors[colorScheme].border,
    borderStyle: 'dashed',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors[colorScheme].border,
    backgroundColor: Colors[colorScheme].surface,
  },
  photoButtonText: {
    color: Colors[colorScheme].text,
    fontWeight: '600',
    fontSize: 14,
  },
  
  // Section Styles
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    color: Colors[colorScheme].text,
  },
  sectionDescription: {
    color: Colors[colorScheme].mutedText,
    fontSize: 13,
    marginBottom: 10,
    lineHeight: 18,
  },
  
  // Username Section
  usernameInput: {
    marginBottom: 20,
  },
  
  // Bio Section
  bioInput: {
    marginBottom: 24,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  
  // Interests Section
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  interestChip: {
    borderWidth: 1,
    borderColor: Colors[colorScheme].border,
    backgroundColor: Colors[colorScheme].surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  interestChipSelected: {
    backgroundColor: Colors[colorScheme].tint,
    borderColor: Colors[colorScheme].tint,
  },
  interestChipDisabled: {
    opacity: 0.5,
  },
  interestChipText: {
    color: Colors[colorScheme].text,
    fontSize: 14,
    fontWeight: '500',
  },
  interestChipTextSelected: {
    color: colorScheme === 'dark' ? Colors[colorScheme].text : '#FFFFFF',
  },
  
  continueSection: {
    marginTop: 16,
  },
  
  // Legacy styles (keeping for compatibility)
  label: { fontWeight: '700', marginBottom: 4, color: Colors[colorScheme].text },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  chipSelected: { backgroundColor: Colors[colorScheme].tint, color: colorScheme === 'dark' ? Colors[colorScheme].text : '#FFFFFF', borderColor: Colors[colorScheme].tint },
});






