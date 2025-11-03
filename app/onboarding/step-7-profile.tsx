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
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const styles = useMemo(() => createStyles(colorScheme), [colorScheme]);

  useEffect(() => {
    setAvatar(ob.avatar_url ?? null);
    setBio(ob.bio ?? '');
    setInterests(ob.sports_interests ?? []);
  }, []);

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
      const fd = new FormData();
      const fileName = (asset.fileName && String(asset.fileName).includes('.')) ? String(asset.fileName) : `avatar_${Date.now()}.jpg`;
      fd.append('file', { uri: manipulated.uri, name: fileName, type: 'image/jpeg' } as any);
      const token = await (await import('@/api/auth')).loadToken();
      const baseUrl = String((process as any).env?.EXPO_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
      const resp = await fetch(`${baseUrl}/upload/avatar`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd as any,
      });
      if (!resp.ok) throw new Error(await resp.text());
      const body: any = await resp.json();
      setAvatar(body.url);
    } catch (e: any) { Alert.alert('Upload failed', e?.message || 'Try again later'); }
    finally { setUploading(false); }
  };

  const onContinue = async () => {
    setSaving(true);
    try {
      // Save to context
      setOB((prev) => ({ 
        ...prev, 
        avatar_url: avatar || undefined,
        bio: bio || undefined,
        sports_interests: interests as any
      }));
      
      // Save to backend
      await User.patchMe({ 
        avatar_url: avatar || undefined, 
        bio: bio || undefined, 
        preferences: { sports_interests: interests } 
      });
      
      setProgress(7);
      if (returnToConfirmation) {
        router.replace('/onboarding/step-10-confirmation');
      } else {
        // Fans and rookies skip to role-onboarding, coaches continue to interests
        if (ob.role === 'fan' || ob.role === 'rookie') {
          // Mark onboarding as complete for fans/rookies
          await User.updatePreferences({ onboarding_completed: true });
          router.replace('/role-onboarding');
        } else {
          router.push('/onboarding/step-8-interests');
        }
      }
    } catch (e: any) { 
      Alert.alert('Failed to save profile', e?.message || 'Please try again'); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <OnboardingLayout
      step={7}
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

        {/* Bio/Tagline Section */}
        <Text style={styles.sectionTitle}>Bio / Tagline</Text>
        <Text style={styles.sectionDescription}>
          Tell others about yourself (optional)
        </Text>
        <Input 
          value={bio} 
          onChangeText={setBio} 
          placeholder="e.g., Coach with 10+ years experience, passionate about developing young athletes" 
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
            disabled={saving || uploading} 
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
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#F3F4F6',
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
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
    borderRadius: 48,
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors[colorScheme].border,
    backgroundColor: Colors[colorScheme].surface,
  },
  photoButtonText: {
    color: Colors[colorScheme].text,
    fontWeight: '600',
  },
  
  // Section Styles
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    color: Colors[colorScheme].text,
  },
  sectionDescription: {
    color: Colors[colorScheme].mutedText,
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  
  // Bio Section
  bioInput: {
    marginBottom: 32,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  
  // Interests Section
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 32,
  },
  interestChip: {
    borderWidth: 1,
    borderColor: Colors[colorScheme].border,
    backgroundColor: Colors[colorScheme].surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    color: colorScheme === 'dark' ? '#000000' : '#FFFFFF',
  },
  
  continueSection: {
    marginTop: 16,
  },
  
  // Legacy styles (keeping for compatibility)
  label: { fontWeight: '700', marginBottom: 4, color: Colors[colorScheme].text },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  chipSelected: { backgroundColor: Colors[colorScheme].tint, color: colorScheme === 'dark' ? '#000000' : 'white', borderColor: Colors[colorScheme].tint },
});








