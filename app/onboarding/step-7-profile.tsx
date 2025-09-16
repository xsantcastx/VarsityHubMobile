import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Image, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Input } from '@/components/ui/input';
import PrimaryButton from '@/ui/PrimaryButton';
import { Type } from '@/ui/tokens';
// @ts-ignore
import { User } from '@/api/entities';
import upload from '@/api/upload';
import { pickerMediaTypesProp } from '@/utils/picker';

const ALL_INTERESTS = ['Football','Basketball','Baseball','Soccer','Volleyball','Track & Field','Swimming','Hockey','Other'] as const;

export default function Step7Profile() {
  const router = useRouter();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const toggleInterest = (i: string) => {
    setInterests((prev) => {
      const has = prev.includes(i);
      if (has) return prev.filter(x => x !== i);
      if (prev.length >= 3) return prev; // enforce max 3
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
      await User.patchMe({ avatar_url: avatar || undefined, bio: bio || undefined, preferences: { sports_interests: interests } });
      router.push('/onboarding/step-8-interests');
    } catch (e: any) { Alert.alert('Failed to save', e?.message || 'Please try again'); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Step 7/10' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <Text style={styles.title}>Create Your Profile</Text>
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          {avatar ? <Image source={{ uri: avatar }} style={{ width: 96, height: 96, borderRadius: 48, marginBottom: 8 }} /> : null}
          <Pressable onPress={pickImage} accessibilityRole="button" accessibilityLabel={avatar ? 'Change Photo' : 'Pick Profile Picture'} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#D1D5DB' }}>
            <Text>{avatar ? 'Change Photo' : 'Pick Profile Picture'}</Text>
          </Pressable>
        </View>
        <Text style={styles.label}>Bio / Tagline (optional)</Text>
        <Input value={bio} onChangeText={setBio} placeholder="Tell people about you" style={{ marginBottom: 12 }} />
        <Text style={styles.label}>Sports Interests (up to 3)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {ALL_INTERESTS.map((i) => (
            <Text key={i} onPress={() => toggleInterest(i)} style={[styles.chip, interests.includes(i) && styles.chipSelected]}>{i}</Text>
          ))}
        </View>
        <PrimaryButton label={saving ? 'Saving…' : 'Continue'} onPress={onContinue} disabled={saving || uploading || interests.length > 3} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  title: { ...(Type.h1 as any), marginBottom: 12, textAlign: 'center' },
  label: { fontWeight: '700', marginBottom: 4 },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#9CA3AF', color: '#111827', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  chipSelected: { backgroundColor: '#111827', color: 'white', borderColor: '#111827' },
});
