import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert, Platform, ScrollView, KeyboardAvoidingView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { pickerMediaTypesProp } from '@/utils/picker';
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
  const [targetUrl, setTargetUrl] = useState('');
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
        setTargetUrl(ad?.target_url || '');
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
          setTargetUrl(found.target_url || '');
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
    const r = await ImagePicker.launchImageLibraryAsync({ ...pickerMediaTypesProp(), allowsEditing: true, aspect: [4,3], selectionLimit: 1, quality: 0.9 } as any);
    if ((r as any).canceled || !(r as any).assets || !(r as any).assets[0]) return;
    const a = (r as any).assets[0];
    try {
      setUploading(true);
      const manipulated = await ImageManipulator.manipulateAsync(a.uri, [{ resize: { width: 1200 } }], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
      const base = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
      const up = await uploadFile(base, manipulated.uri, a.fileName || 'banner.jpg', 'image/jpeg');
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
          target_url: targetUrl.trim() || undefined,
          target_zip_code: zip.trim(),
          description: desc.trim() || undefined,
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
          target_url: targetUrl.trim() || undefined,
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
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Edit Ad', headerShown: true }} />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading ad details...</Text>
        </View>
      ) : (
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={styles.title}>Edit Advertisement</Text>
              <Text style={styles.subtitle}>Update your ad details and settings</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Business Name *</Text>
              <TextInput 
                style={styles.input} 
                value={business} 
                onChangeText={setBusiness}
                placeholder="Acme Pizza"
              />

              <Text style={styles.label}>Contact Name</Text>
              <TextInput 
                style={styles.input} 
                value={contactName} 
                onChangeText={setContactName}
                placeholder="John Smith"
                autoCapitalize="words"
              />

              <Text style={styles.label}>Contact Email *</Text>
              <TextInput 
                style={styles.input} 
                value={contactEmail} 
                autoCapitalize="none" 
                keyboardType="email-address" 
                onChangeText={setContactEmail}
                placeholder="you@example.com"
              />

              <Text style={styles.label}>Target Zip Code</Text>
              <TextInput 
                style={styles.input} 
                value={zip} 
                onChangeText={setZip} 
                keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                placeholder="12345"
                maxLength={10}
              />
              {zip.trim() && (
                <Text style={styles.helperText}>
                  📍 Your ad will reach 20 miles around zip code {zip}
                </Text>
              )}

              <Text style={styles.label}>Banner Image</Text>
              {bannerUrl ? (
                <View style={styles.bannerPreview}>
                  <Image 
                    source={{ uri: bannerUrl }} 
                    style={styles.bannerImage}
                    contentFit="contain" 
                  />
                </View>
              ) : (
                <View style={styles.bannerPlaceholder}>
                  <Text style={styles.bannerPlaceholderText}>No banner uploaded</Text>
                  <Text style={styles.muted}>Recommended: 16:9 ratio, PNG/JPG</Text>
                </View>
              )}
              <Pressable 
                style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]} 
                onPress={pickBanner} 
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.uploadBtnText}>
                    {bannerUrl ? '🔄 Replace Banner' : '📤 Upload Banner'}
                  </Text>
                )}
              </Pressable>

              <Text style={styles.label}>Website Link (Optional)</Text>
              <TextInput 
                style={styles.input} 
                value={targetUrl} 
                onChangeText={setTargetUrl}
                placeholder="https://example.com"
                autoCapitalize="none"
                keyboardType="url"
              />
              {targetUrl.trim() && (
                <Text style={styles.helperText}>
                  🔗 Users can tap your ad to visit this website
                </Text>
              )}

              <Text style={styles.label}>Description</Text>
              <TextInput 
                style={[styles.input, styles.textArea]} 
                value={desc} 
                onChangeText={setDesc} 
                multiline
                numberOfLines={4}
                placeholder="Tell us about your business or message..."
                textAlignVertical="top"
              />

              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Ad Status</Text>
                <Text style={styles.infoValue}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Payment Status</Text>
                <Text style={styles.infoValue}>{payment.charAt(0).toUpperCase() + payment.slice(1)}</Text>
              </View>
            </View>

            <Pressable 
              onPress={save} 
              disabled={!canSave || saving} 
              style={[styles.cta, (!canSave || saving) && styles.ctaDisabled]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>💾 Save Changes</Text>
              )}
            </Pressable>

            <Pressable 
              onPress={() => router.push({ pathname: '/ad-calendar', params: { adId: String(id || '') } })} 
              style={styles.ctaSecondary}
            >
              <Text style={styles.ctaSecondaryText}>📅 Schedule Campaign Dates</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'white' 
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 15,
  },
  scrollContent: { 
    padding: 16, 
    paddingBottom: 32 
  },
  header: {
    marginBottom: 20,
  },
  title: { 
    fontSize: 28, 
    fontWeight: '800', 
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: { 
    color: '#6b7280', 
    fontSize: 16,
    lineHeight: 24,
  },
  card: { 
    padding: 16, 
    borderRadius: 12, 
    backgroundColor: '#F9FAFB', 
    borderWidth: StyleSheet.hairlineWidth, 
    borderColor: '#E5E7EB', 
    gap: 12,
    marginBottom: 20,
  },
  label: { 
    fontWeight: '700',
    fontSize: 15,
    color: '#111827',
    marginBottom: 6,
  },
  input: { 
    height: 48, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#D1D5DB', 
    paddingHorizontal: 14, 
    backgroundColor: 'white',
    fontSize: 16,
    color: '#111827',
  },
  infoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
    paddingBottom: 12,
  },
  helperText: { 
    fontSize: 13, 
    color: '#059669', 
    marginTop: -4,
    marginBottom: 4,
  },
  muted: { 
    fontSize: 13, 
    color: '#6b7280',
    lineHeight: 18,
  },
  bannerPreview: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    marginBottom: 8,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 8,
  },
  bannerPlaceholderText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  uploadBtn: { 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderRadius: 8, 
    backgroundColor: '#111827', 
    alignItems: 'center',
  },
  uploadBtnDisabled: {
    opacity: 0.5,
  },
  uploadBtnText: { 
    color: 'white', 
    fontWeight: '700',
    fontSize: 15,
  },
  cta: { 
    height: 52, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  ctaSecondary: { 
    height: 52, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: '#F3F4F6', 
    borderWidth: 1, 
    borderColor: '#D1D5DB',
  },
  ctaDisabled: { 
    opacity: 0.5,
  },
  ctaText: { 
    color: 'white', 
    fontWeight: '800', 
    fontSize: 17,
    letterSpacing: 0.3,
  },
  ctaSecondaryText: {
    color: '#111827', 
    fontWeight: '800', 
    fontSize: 17,
    letterSpacing: 0.3,
  },
});
