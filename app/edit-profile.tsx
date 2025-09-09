import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
// @ts-ignore
import { User } from '@/api/entities';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function EditProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const me: any = await User.me();
        if (!mounted) return;
        setDisplayName(me?.display_name || '');
        setAvatarUrl(me?.avatar_url || '');
        setBio(me?.bio || '');
      } catch (e: any) {
        setError('You must sign in to edit your profile.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      await User.updateMe({ display_name: displayName, avatar_url: avatarUrl || undefined, bio: bio || undefined });
      Alert.alert('Saved', 'Profile updated.');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Edit Profile' }} />
      <Text style={styles.title}>Edit Profile</Text>
      {loading ? (
        <View style={{ paddingVertical: 24 }}><ActivityIndicator /></View>
      ) : (
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.label}>Display Name</Text>
          <Input value={displayName} onChangeText={setDisplayName} placeholder="Your name" style={{ marginBottom: 8 }} />
          <Text style={styles.label}>Avatar URL</Text>
          <Input value={avatarUrl} onChangeText={setAvatarUrl} placeholder="https://..." style={{ marginBottom: 8 }} />
          <Text style={styles.label}>Bio</Text>
          <Input value={bio} onChangeText={setBio} placeholder="About you" style={{ marginBottom: 12 }} />
          <Button onPress={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  label: { fontWeight: '700', marginBottom: 4 },
  error: { color: '#b91c1c', marginBottom: 8 },
});
