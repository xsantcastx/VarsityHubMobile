import { Input } from '@/components/ui/input';
import PrimaryButton from '@/ui/PrimaryButton';
import { Type } from '@/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { User } from '@/api/entities';
import { useOnboarding } from '@/context/OnboardingContext';
import { pickerMediaTypesProp } from '@/utils/picker';

const ALL_INTERESTS = ['Football','Basketball','Baseball','Soccer','Volleyball','Track & Field','Swimming','Hockey','Other'] as const;

export default function Step7Profile() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnToConfirmation?: string }>();
  const returnToConfirmation = params.returnToConfirmation === 'true';
  const { state: ob, setState: setOB, setProgress } = useOnboarding();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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
  router.push('/onboarding/step-8-interests');
    } catch (e: any) { 
      Alert.alert('Failed to save profile', e?.message || 'Please try again'); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Step 7/10' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <Text style={styles.title}>Create Your Profile</Text>
        <Text style={styles.subtitle}>
          Add a profile picture, bio, and interests to help others connect with you
        </Text>

        {/* Profile Picture Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={32} color="#9CA3AF" />
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
              color="#374151" 
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  title: { ...(Type.h1 as any), marginBottom: 8, textAlign: 'center' },
  subtitle: { color: '#6b7280', marginBottom: 24, textAlign: 'center', fontSize: 16, lineHeight: 24 },
  
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
    backgroundColor: '#F3F4F6',
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
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
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  photoButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  
  // Section Styles
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    color: '#111827',
  },
  sectionDescription: {
    color: '#6B7280',
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
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  interestChipSelected: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  interestChipDisabled: {
    opacity: 0.5,
  },
  interestChipText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  interestChipTextSelected: {
    color: 'white',
  },
  
  continueSection: {
    marginTop: 16,
  },
  
  // Legacy styles (keeping for compatibility)
  label: { fontWeight: '700', marginBottom: 4 },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#9CA3AF', color: '#111827', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  chipSelected: { backgroundColor: '#111827', color: 'white', borderColor: '#111827' },
});








