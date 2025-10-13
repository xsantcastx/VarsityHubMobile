import settings from '@/api/settings';
import { BannerUpload } from '@/components/BannerUpload';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
// @ts-ignore
import { Advertisement as AdsApi } from '@/api/entities';

type DraftAd = {
  id: string;
  business_name: string;
  contact_name: string;
  contact_email: string;
  banner_url?: string;
  banner_fit_mode?: string;
  zip_code: string;
  description?: string;
  created_at: string;
};

export default function SubmitAdScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [business, setBusiness] = useState('');
  const [zip, setZip] = useState('');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [bannerFitMode, setBannerFitMode] = useState<'letterbox' | 'fill' | 'stretch'>('fill');
  const [targetUrl, setTargetUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    if (!name.trim() || !email.trim() || !business.trim() || !zip.trim()) return false;
    return true;
  }, [name, email, business, zip]);

  const handleBannerChange = (uri: string, fitMode: 'letterbox' | 'fill' | 'stretch') => {
    setBannerUrl(uri);
    setBannerFitMode(fitMode);
  };

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      // Try server-side creation first
      let serverId: string | null = null;
      try {
        const created: any = await AdsApi.create({
          contact_name: name.trim(),
          contact_email: email.trim(),
          business_name: business.trim(),
          banner_url: bannerUrl || undefined,
          banner_fit_mode: bannerFitMode,
          target_url: targetUrl.trim() || undefined,
          target_zip_code: zip.trim(),
          radius: 45,
          description: desc.trim() || undefined,
        });
        serverId = String(created?.id || '');
      } catch {}

      const adId = serverId || `local-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      // Keep a local copy so My Ads can show offline
      try {
        const draft: DraftAd = {
          id: adId,
          business_name: business.trim(),
          contact_name: name.trim(),
          contact_email: email.trim(),
          banner_url: bannerUrl || undefined,
          banner_fit_mode: bannerFitMode,
          target_url: targetUrl.trim() || undefined,
          zip_code: zip.trim(),
          description: desc.trim() || undefined,
          created_at: new Date().toISOString(),
        };
        const arr = await settings.getJson<DraftAd[]>(settings.SETTINGS_KEYS.LOCAL_ADS, []);
        // de-dup if server returned same id
        const next = arr.filter((a) => a.id !== adId).concat([draft]);
        await settings.setJson(settings.SETTINGS_KEYS.LOCAL_ADS, next);
      } catch {}

      router.push({ pathname: '/ad-calendar', params: { adId } });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save your ad.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Submit Ad' }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.title}>Submit a Local Ad</Text>
        <Text style={styles.subtitle}>Promote your business to local teams and families. Continue to pick your campaign dates.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Your Name *</Text>
          <TextInput value={name} onChangeText={setName} placeholder="John Smith" style={styles.input} autoCapitalize="words" />

          <Text style={styles.label}>Email Address *</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" style={styles.input} keyboardType="email-address" autoCapitalize="none" />

          <Text style={styles.label}>Business Name *</Text>
          <TextInput value={business} onChangeText={setBusiness} placeholder="Acme Pizza" style={styles.input} />

          <Text style={styles.label}>Target Zip Code *</Text>
          <TextInput value={zip} onChangeText={setZip} placeholder="12345" style={styles.input} keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'} maxLength={10} />

          <Text style={styles.label}>Ad Banner (Optional)</Text>
          <BannerUpload 
            value={bannerUrl || ''} 
            onChange={handleBannerChange}
            aspectRatio={16 / 9}
            required={false}
          />

          <Text style={styles.label}>Target URL (Optional)</Text>
          <TextInput
            value={targetUrl}
            onChangeText={setTargetUrl}
            placeholder="https://yourwebsite.com"
            style={styles.input}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.muted}>When users click your ad, they'll be taken to this URL</Text>

          <Text style={styles.label}>Short Description (optional)</Text>
          <TextInput
            value={desc}
            onChangeText={setDesc}
            placeholder="Tell us about your business or message..."
            style={[styles.input, { height: 84, textAlignVertical: 'top' }]}
            multiline
          />
        </View>

        <Pressable onPress={submit} disabled={!canSubmit || busy} style={[styles.cta, (!canSubmit || busy) && styles.ctaDisabled]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Continue to Calendar</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: '#6b7280', marginBottom: 12 },
  card: { padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', gap: 8 },
  label: { fontWeight: '700' },
  input: { height: 44, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', paddingHorizontal: 10, backgroundColor: 'white' },
  cta: { marginTop: 12, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827' },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: 'white', fontWeight: '800', fontSize: 16 },
});
