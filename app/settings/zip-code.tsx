import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, Text, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { useUserProfile } from '@/hooks/useUser';
import { Colors } from '@/constants/Colors';
import { safeGoBack } from '@/utils/navigation';
import { ZipCodeMapPreview } from '@/components/ZipCodeMapPreview';

function isValidZip(v: string) {
  if (!v || v.length < 3 || v.length > 20) return false;
  const us = /^\d{5}(-\d{4})?$/;
  const generic = /^[A-Za-z0-9\s-]+$/;
  return us.test(v) || (generic.test(v) && v.length >= 3);
}

export default function ZipCodeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { zipCode, refresh: refreshUserProfile } = useUserProfile();
  const [zip, setZip] = useState(zipCode || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (zipCode && !zip) {
      setZip(zipCode);
    }
  }, [zipCode, zip]);

  const onSave = async () => {
    const v = zip.trim();
    if (v && !isValidZip(v)) { Alert.alert('Invalid ZIP/Postal Code'); return; }
    setSaving(true);
    try {
      await User.updatePreferences({ zip_code: v || null });
      const fresh = await refreshUserProfile();
      const savedZip = String(fresh?.preferences?.zip_code || fresh?.zip_code || '').trim();
      if (savedZip !== (v || '')) {
        throw new Error('Saved ZIP code did not round-trip from the server.');
      }
      safeGoBack(router);
    } catch (e: any) {
      if (__DEV__) console.error('[zip-code] Failed to save ZIP code:', e);
      Alert.alert('Save failed', e?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'ZIP Code', headerBackTitle: 'Back', headerShown: true }} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>ZIP / Postal Code</Text>
        <Input placeholder="94105" value={zip} onChangeText={setZip} keyboardType="number-pad" style={{ marginBottom: 12 }} />
        <ZipCodeMapPreview
          zipCode={zip}
          title="Your Location"
          subtitle={`Content near ZIP ${zip || 'your area'} will be prioritized for you`}
          showCircle={false}
        />
        <Button onPress={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingTop: 24 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
});
