import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Alert, useColorScheme } from 'react-native';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { useAuth } from '@/context/AuthProvider';
import { safeGoBack } from '@/utils/navigation';
import { toUserMessage } from '@/utils/toUserMessage';
import { ZipCodeMapPreview } from '@/components/ZipCodeMapPreview';
import { SettingsFormScreen } from '@/components/settings/SettingsFormShared';

function isValidZip(v: string) {
  if (!v || v.length < 3 || v.length > 20) return false;
  const us = /^\d{5}(-\d{4})?$/;
  const generic = /^[A-Za-z0-9\s-]+$/;
  return us.test(v) || (generic.test(v) && v.length >= 3);
}

export default function ZipCodeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { user, checkAuth } = useAuth();
  const zipCode = String(user?.preferences?.zip_code || user?.zip_code || '').trim();
  const [zip, setZip] = useState(zipCode || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (zipCode && !zip) {
      setZip(zipCode);
    }
  }, [zipCode, zip]);

  const onSave = async () => {
    const v = zip.trim();
    if (v && !isValidZip(v)) {
      Alert.alert('Invalid ZIP/Postal Code');
      return;
    }
    setSaving(true);
    try {
      await User.updatePreferences({ zip_code: v || null });
      const fresh = await checkAuth().catch(error => {
        if (__DEV__) console.warn('[zip-code] checkAuth failed after save:', error);
        return null;
      });
      if (!fresh) {
        throw new Error('Saved ZIP code but could not refresh account state.');
      }
      const savedZip = String(fresh?.preferences?.zip_code || fresh?.zip_code || '').trim();
      if (savedZip !== (v || '')) {
        throw new Error('Saved ZIP code did not round-trip from the server.');
      }
      safeGoBack(router);
    } catch (e: any) {
      if (__DEV__) console.error('[zip-code] Failed to save ZIP code:', e);
      Alert.alert('Save failed', toUserMessage(e, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsFormScreen title="ZIP Code" headerTitle="ZIP / Postal Code" colorScheme={colorScheme}>
      <Input
        placeholder="e.g. 94105 or M5V 3L9"
        value={zip}
        onChangeText={setZip}
        keyboardType="default"
        autoCapitalize="characters"
        maxLength={10}
        style={{ marginBottom: 12 }}
      />
      <ZipCodeMapPreview
        zipCode={zip}
        title="Your Location"
        subtitle={`Content near ZIP ${zip || 'your area'} will be prioritized for you`}
        showCircle={false}
      />
      <Button onPress={onSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </SettingsFormScreen>
  );
}
