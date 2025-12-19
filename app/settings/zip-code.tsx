import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { useDeviceLocation } from '@/hooks/useDeviceLocation';
import { formatPostalCodeInput, isValidZipCode } from '@/utils/zipCodeUtils';

export default function ZipCodeScreen() {
  const router = useRouter();
  const [zip, setZip] = useState('');
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectionInfo, setDetectionInfo] = useState<string | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);
  const { permissionGranted, requestPermission, error: locationError } = useDeviceLocation();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const me: any = await User.me();
        if (!active) return;
        setZip(formatPostalCodeInput(String(me?.preferences?.zip_code || '')));
      } catch {
        // Silent failure: the user can still enter a ZIP manually
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleZipChange = (value: string) => {
    setDetectionInfo(null);
    setDetectError(null);
    setZip(formatPostalCodeInput(value));
  };

  const onSave = async () => {
    const v = zip.trim();
    if (v && !isValidZipCode(v)) { Alert.alert('Invalid ZIP/Postal Code'); return; }
    setSaving(true);
    try { await User.updatePreferences({ zip_code: v || null }); router.back(); } catch (e: any) { Alert.alert('Save failed', e?.message || 'Could not save'); } finally { setSaving(false); }
  };

  const detectFromLocation = async () => {
    if (detecting) return;
    setDetectError(null);
    setDetectionInfo(null);
    setDetecting(true);
    try {
      let granted = permissionGranted;
      if (granted !== true) {
        granted = await requestPermission();
      }
      if (!granted) {
        Alert.alert('Location Needed', 'Enable location access to detect your ZIP automatically.');
        return;
      }
      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (!currentPosition?.coords) {
        throw new Error('Unable to read GPS coordinates');
      }

      const [result] = await Location.reverseGeocodeAsync({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      });
      const postalCode = result?.postalCode?.trim();

      if (!postalCode) {
        throw new Error('No postal/ZIP code found for your current location.');
      }

      const formatted = formatPostalCodeInput(postalCode);
      setZip(formatted);
      const cityState = [result?.city, result?.region].filter(Boolean).join(', ');
      setDetectionInfo(cityState ? `Detected ${postalCode} near ${cityState}` : `Detected ${postalCode}`);
    } catch (err: any) {
      const message = err?.message || 'Could not detect your ZIP automatically.';
      setDetectError(message);
    } finally {
      setDetecting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'ZIP Code' }} />
      <Text style={styles.title}>ZIP / Postal Code</Text>
      <Input
        placeholder="94105 or SW1A 1AA"
        value={zip}
        onChangeText={handleZipChange}
        keyboardType="default"
        autoCapitalize="characters"
        autoCorrect={false}
        style={{ marginBottom: 12 }}
      />
      <Button onPress={detectFromLocation} disabled={detecting} variant="outline" style={styles.detectButton}>
        {detecting ? 'Detecting…' : 'Use Current Location'}
      </Button>
      {locationError ? <Text style={styles.infoText}>Location error: {locationError}</Text> : null}
      {detectionInfo ? <Text style={[styles.infoText, styles.successText]}>{detectionInfo}</Text> : null}
      {detectError ? <Text style={[styles.infoText, styles.errorText]}>{detectError}</Text> : null}
      <Text style={styles.helperText}>
        We only use your ZIP to personalize nearby events. You can update it anytime.
      </Text>
      <Button onPress={onSave} disabled={saving} style={styles.saveButton}>{saving ? 'Saving…' : 'Save'}</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  helperText: { fontSize: 13, color: '#6B7280', marginTop: 12, marginBottom: 16 },
  detectButton: { marginBottom: 8 },
  saveButton: { marginTop: 8 },
  infoText: { fontSize: 13, color: '#4B5563', marginBottom: 4 },
  successText: { color: '#16A34A' },
  errorText: { color: '#DC2626' },
});
