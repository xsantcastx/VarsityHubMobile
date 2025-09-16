import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
// @ts-ignore JS exports
import { User } from '@/api/entities';

export default function EditUsernameScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { (async () => { try { const me: any = await User.me(); setName(me?.display_name || ''); } catch {} })(); }, []);

  const onSave = async () => {
    const v = name.trim();
    if (!v) { Alert.alert('Enter a username'); return; }
    setSaving(true);
    try { await User.updateMe({ display_name: v }); router.back(); } catch (e: any) { Alert.alert('Save failed', e?.message || 'Could not save'); } finally { setSaving(false); }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Edit Username' }} />
      <Text style={styles.title}>Edit Username</Text>
      <Input value={name} onChangeText={setName} placeholder="Your display name" style={{ marginBottom: 12 }} />
      <Button onPress={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
});

