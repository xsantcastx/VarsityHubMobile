import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert, Platform, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { uploadFile } from '@/api/upload';
import settings from '@/api/settings';
// @ts-ignore
import { Advertisement as AdsApi } from '@/api/entities';

type DraftAd = {
  id: string;
  business_name: string;
  contact_name: string;
  contact_email: string;
  banner_url?: string;
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
  const [hasBanner, setHasBanner] = useState<boolean | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const canSubmit = useMemo(() => {
    if (!name.trim() || !email.trim() || !business.trim() || !zip.trim() || hasBanner === null) return false;
    if (hasBanner && !bannerUrl) return false;
    return true;
  }, [name, email, business, zip, hasBanner, bannerUrl]);

  const pickBanner = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
    if (r.canceled || !r.assets || !r.assets[0]) return;
    const a = r.assets[0];
    try {
      setUploading(true);
      const base = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
      const up = await uploadFile(base, a.uri, a.fileName || 'banner.jpg', a.mimeType || 'image/jpeg');
      setBannerUrl(up?.url || up?.path || null);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Please try again.');
    } finally {
      setUploading(false);
    }
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

        <Text style={styles.label}>Do you have a banner ready? *</Text>
        <View style={styles.row}>
          <Pressable style={[styles.choice, hasBanner === true && styles.choiceActive]} onPress={() => setHasBanner(true)}>
            <Text style={[styles.choiceText, hasBanner === true && styles.choiceTextActive]}>Yes</Text>
          </Pressable>
          <Pressable style={[styles.choice, hasBanner === false && styles.choiceActive]} onPress={() => setHasBanner(false)}>
            <Text style={[styles.choiceText, hasBanner === false && styles.choiceTextActive]}>No</Text>
          </Pressable>
        </View>

        {hasBanner ? (
          <View style={styles.uploader}>
            {bannerUrl ? (
              <Image source={{ uri: bannerUrl }} style={styles.bannerPreview} contentFit="contain" />
            ) : (
              <Text style={styles.muted}>Recommended: 728x90 PNG/JPG</Text>
            )}
            <Pressable style={styles.pickBtn} onPress={pickBanner} disabled={uploading}>
              {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.pickBtnText}>{bannerUrl ? 'Replace Banner' : 'Upload Banner'}</Text>}
            </Pressable>
          </View>
        ) : hasBanner === false ? (
          <View style={styles.helperBox}>
            <Text style={styles.helperText}>No banner? We’ll help you design one after you submit.</Text>
          </View>
        ) : null}

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
  row: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, paddingVertical: 10, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', alignItems: 'center', backgroundColor: '#F3F4F6' },
  choiceActive: { backgroundColor: '#111827', borderColor: '#111827' },
  choiceText: { fontWeight: '700', color: '#374151' },
  choiceTextActive: { color: 'white' },
  uploader: { gap: 8, alignItems: 'center' },
  bannerPreview: { width: '100%', height: 100, borderRadius: 8, backgroundColor: '#E5E7EB' },
  pickBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#111827' },
  pickBtnText: { color: 'white', fontWeight: '700' },
  helperBox: { padding: 10, borderRadius: 8, backgroundColor: '#EFF6FF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#BFDBFE' },
  helperText: { color: '#1D4ED8' },
  muted: { color: '#6b7280' },
  cta: { marginTop: 12, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827' },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: 'white', fontWeight: '800', fontSize: 16 },
});
