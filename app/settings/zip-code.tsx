import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { useUserProfile } from '@/hooks/useUser';

function isValidZip(v: string) {
  const us = /^\d{5}$/;
  const generic = /^[A-Za-z0-9\s-]{3,10}$/;
  return us.test(v) || generic.test(v);
}

export default function ZipCodeScreen() {
  const router = useRouter();
  const { zipCode } = useUserProfile();
  const [zip, setZip] = useState(zipCode || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (zipCode && !zip) {
      setZip(zipCode);
    }
  }, [zipCode]);

  const onSave = async () => {
    const v = zip.trim();
    if (v && !isValidZip(v)) { Alert.alert('Invalid ZIP/Postal Code'); return; }
    setSaving(true);
    try { await User.updatePreferences({ zip_code: v || null }); router.back(); } catch (e: any) { Alert.alert('Save failed', e?.message || 'Could not save'); } finally { setSaving(false); }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'ZIP Code' }} />
      <Text style={styles.title}>ZIP / Postal Code</Text>
      <Input placeholder="94105" value={zip} onChangeText={setZip} keyboardType="number-pad" style={{ marginBottom: 12 }} />
      <Button onPress={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
});

