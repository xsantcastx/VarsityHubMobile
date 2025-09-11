import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert, Platform, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { uploadFile } from '@/api/upload';
// @ts-ignore
import { Advertisement as AdsApi } from '@/api/entities';
import settings from '@/api/settings';

export default function EditAdScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [business, setBusiness] = useState('');
  const [zip, setZip] = useState('');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [desc, setDesc] = useState('');
  const [status, setStatus] = useState<'draft'|'pending'|'active'|'archived'>('draft');
  const [payment, setPayment] = useState<'unpaid'|'paid'|'refunded'>('unpaid');
  const [uploading, setUploading] = useState(false);

  const canSave = useMemo(() => {
    return !!id && business.trim().length > 0 && contactEmail.trim().length > 0;
  }, [id, business, contactEmail]);

  const load = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    try {
      try {
        const ad: any = await AdsApi.get(String(id));
        setContactName(ad?.contact_name || '');
        setContactEmail(ad?.contact_email || '');
        setBusiness(ad?.business_name || '');
        setZip(ad?.target_zip_code || '');
        setBannerUrl(ad?.banner_url || null);
        setDesc(ad?.description || '');
        setStatus((ad?.status || 'draft') as any);
        setPayment((ad?.payment_status || 'unpaid') as any);
      } catch {
        // Fallback to local draft
        const local = await settings.getJson<any[]>(settings.SETTINGS_KEYS.LOCAL_ADS, []);
        const found = local.find((a) => String(a.id) === String(id));
        if (found) {
          setContactName(found.contact_name || '');
          setContactEmail(found.contact_email || '');
          setBusiness(found.business_name || '');
          setZip(found.zip_code || '');
          setBannerUrl(found.banner_url || null);
          setDesc(found.description || '');
          setStatus((found.status || 'draft') as any);
          setPayment((found.payment_status || 'unpaid') as any);
        }
      }
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

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

  const save = async () => {
    if (!id || !canSave || saving) return;
    setSaving(true);
    try {
      try {
        await AdsApi.update(String(id), {
          contact_name: contactName.trim(),
          contact_email: contactEmail.trim(),
          business_name: business.trim(),
          banner_url: bannerUrl || undefined,
          target_zip_code: zip.trim(),
          description: desc.trim() || undefined,
          status,
          payment_status: payment,
        });
      } catch (e: any) {
        // If not permitted or offline, update local draft copy
        const list = await settings.getJson<any[]>(settings.SETTINGS_KEYS.LOCAL_ADS, []);
        const idx = list.findIndex((a) => String(a.id) === String(id));
        const next = {
          id,
          contact_name: contactName.trim(),
          contact_email: contactEmail.trim(),
          business_name: business.trim(),
          banner_url: bannerUrl || undefined,
          zip_code: zip.trim(),
          description: desc.trim() || undefined,
          status,
          payment_status: payment,
          created_at: new Date().toISOString(),
        };
        if (idx >= 0) list[idx] = { ...list[idx], ...next }; else list.push(next);
        await settings.setJson(settings.SETTINGS_KEYS.LOCAL_ADS, list);
      }
      Alert.alert('Saved', 'Your ad was updated.');
      router.replace('/(tabs)/my-ads');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Edit Ad' }} />
      {loading ? (
        <View style={{ padding: 24, alignItems: 'center' }}><ActivityIndicator /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
          <Text style={styles.label}>Business Name</Text>
          <TextInput style={styles.input} value={business} onChangeText={setBusiness} />

          <Text style={styles.label}>Contact Name</Text>
          <TextInput style={styles.input} value={contactName} onChangeText={setContactName} />

          <Text style={styles.label}>Contact Email</Text>
          <TextInput style={styles.input} value={contactEmail} autoCapitalize="none" keyboardType="email-address" onChangeText={setContactEmail} />

          <Text style={styles.label}>Target Zip Code</Text>
          <TextInput style={styles.input} value={zip} onChangeText={setZip} keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'} />

          <Text style={styles.label}>Banner</Text>
          {bannerUrl ? (
            <Image source={{ uri: bannerUrl }} style={{ width: '100%', height: 90, borderRadius: 8, backgroundColor: '#E5E7EB' }} contentFit="contain" />
          ) : (
            <Text style={styles.muted}>Recommended: 728x90 PNG/JPG</Text>
          )}
          <Pressable style={styles.pickBtn} onPress={pickBanner} disabled={uploading}>
            {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.pickBtnText}>{bannerUrl ? 'Replace Banner' : 'Upload Banner'}</Text>}
          </Pressable>

          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, { height: 84, textAlignVertical: 'top' }]} value={desc} onChangeText={setDesc} multiline />

          <Text style={styles.label}>Status</Text>
          <View style={styles.row}>
            {(['draft','pending','active','archived'] as const).map(s => (
              <Pressable key={s} style={[styles.choice, status === s && styles.choiceActive]} onPress={() => setStatus(s)}>
                <Text style={[styles.choiceText, status === s && styles.choiceTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Payment</Text>
          <View style={styles.row}>
            {(['unpaid','paid','refunded'] as const).map(s => (
              <Pressable key={s} style={[styles.choice, payment === s && styles.choiceActive]} onPress={() => setPayment(s)}>
                <Text style={[styles.choiceText, payment === s && styles.choiceTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={save} disabled={!canSave || saving} style={[styles.cta, (!canSave || saving) && styles.ctaDisabled]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Save Changes</Text>}
          </Pressable>

          <Pressable onPress={() => router.push({ pathname: '/ad-calendar', params: { adId: String(id || '') } })} style={[styles.cta, styles.ctaSecondary]}>
            <Text style={[styles.ctaText, { color: '#111827' }]}>Schedule Dates</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  label: { fontWeight: '700' },
  input: { height: 44, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', paddingHorizontal: 10, backgroundColor: 'white' },
  muted: { color: '#6b7280' },
  pickBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#111827', alignSelf: 'flex-start' },
  pickBtnText: { color: 'white', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', alignItems: 'center', backgroundColor: '#F3F4F6' },
  choiceActive: { backgroundColor: '#111827', borderColor: '#111827' },
  choiceText: { fontWeight: '700', color: '#374151' },
  choiceTextActive: { color: 'white' },
  cta: { marginTop: 12, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827' },
  ctaSecondary: { backgroundColor: '#F3F4F6', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: 'white', fontWeight: '800', fontSize: 16 },
});
