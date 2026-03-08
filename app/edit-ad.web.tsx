import { uploadFile } from '@/api/upload';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { pickerMediaTypesProp } from '@/utils/picker';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Web version: ReachMapPreview removed (maps not supported on web)
// @ts-ignore
import { Advertisement as AdsApi } from '@/api/entities';
import settings from '@/api/settings';
import { getApiBaseUrl } from '../api/http';

export default function EditAdScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [business, setBusiness] = useState('');
  const [zip, setZip] = useState('');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [status, setStatus] = useState<'draft'|'pending'|'active'|'rejected'|'archived'>('draft');
  const [payment, setPayment] = useState<'unpaid'|'paid'|'refunded'>('unpaid');
  const [uploading, setUploading] = useState(false);
  const [bookedDates, setBookedDates] = useState<string[]>([]);

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
        if (ad?.payment_status === 'paid') {
          try {
            const res: any = await AdsApi.reservationsForAd(String(id));
            setBookedDates(Array.isArray(res?.dates) ? [...res.dates].sort() : []);
          } catch { setBookedDates([]); }
        }
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

  useEffect(() => { void load(); }, [load]);

  const pickBanner = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({ ...pickerMediaTypesProp(), allowsEditing: true, aspect: [4,3], selectionLimit: 1, quality: 0.9 } as any);
    if ((r as any).canceled || !(r as any).assets || !(r as any).assets[0]) return;
    const a = (r as any).assets[0];
    try {
      setUploading(true);
      const manipulated = await ImageManipulator.manipulateAsync(a.uri, [{ resize: { width: 1200 } }], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
      const up = await uploadFile(getApiBaseUrl(), manipulated.uri, a.fileName || 'banner.jpg', 'image/jpeg');
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
      } catch {
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
      if (router.canGoBack()) router.back(); else router.push('/(tabs)/my-ads');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Edit Ad', headerShown: true }} />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={[styles.loadingText, { color: theme.mutedText }]}>Loading ad details...</Text>
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
              <Text style={[styles.title, { color: theme.text }]}>Edit Advertisement</Text>
              <Text style={[styles.subtitle, { color: theme.mutedText }]}>Update your ad details and settings</Text>
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.label, { color: theme.text }]}>Business Name *</Text>
              <TextInput 
                style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]} 
                value={business} 
                onChangeText={setBusiness}
                placeholder="Acme Pizza"
                placeholderTextColor={theme.mutedText}
              />

              <Text style={[styles.label, { color: theme.text }]}>Contact Name</Text>
              <TextInput 
                style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]} 
                value={contactName} 
                onChangeText={setContactName}
                placeholder="John Smith"
                placeholderTextColor={theme.mutedText}
                autoCapitalize="words"
              />

              <Text style={[styles.label, { color: theme.text }]}>Contact Email *</Text>
              <TextInput 
                style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]} 
                value={contactEmail} 
                autoCapitalize="none" 
                keyboardType="email-address" 
                onChangeText={setContactEmail}
                placeholder="you@business.com"
                placeholderTextColor={theme.mutedText}
              />

              <Text style={[styles.label, { color: theme.text }]}>Target Zip Code</Text>
              <TextInput 
                style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]} 
                value={zip} 
                onChangeText={setZip} 
                keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                placeholder="12345"
                maxLength={10}
                placeholderTextColor={theme.mutedText}
              />

              {/* Map preview not available on web */}

              <Text style={[styles.label, { color: theme.text }]}>Banner Image</Text>
              {bannerUrl ? (
                <View style={[styles.bannerPreview, { backgroundColor: theme.surface }]}>
                  <Image 
                    source={{ uri: bannerUrl }} 
                    style={styles.bannerImage}
                    contentFit="contain" 
                  />
                </View>
              ) : (
                <View style={[styles.bannerPlaceholder, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.bannerPlaceholderText, { color: theme.mutedText }]}>No banner uploaded</Text>
                  <Text style={[styles.muted, { color: theme.mutedText }]}>Recommended: 16:9 ratio, PNG/JPG</Text>
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

              <Text style={[styles.label, { color: theme.text }]}>Website Link (Optional)</Text>
              <TextInput 
                style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]} 
                value={targetUrl} 
                onChangeText={setTargetUrl}
                placeholder="https://example.com"
                autoCapitalize="none"
                keyboardType="url"
                placeholderTextColor={theme.mutedText}
              />
              {targetUrl.trim() && (
                <Text style={[styles.helperText, { color: theme.mutedText }]}>
                  🔗 Users can tap your ad to visit this website
                </Text>
              )}

              <Text style={[styles.label, { color: theme.text }]}>Description</Text>
              <TextInput 
                style={[styles.input, styles.textArea, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]} 
                value={desc} 
                onChangeText={setDesc} 
                multiline
                numberOfLines={4}
                placeholder="Tell us about your business or message..."
                textAlignVertical="top"
                placeholderTextColor={theme.mutedText}
              />

              <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.infoLabel, { color: theme.mutedText }]}>Ad Status</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
              </View>

              <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.infoLabel, { color: theme.mutedText }]}>Payment Status</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{payment.charAt(0).toUpperCase() + payment.slice(1)}</Text>
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

            {payment === 'paid' && bookedDates.length > 0 ? (
              <View style={[styles.bookedDatesCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.bookedDatesTitle, { color: theme.text }]}>📅 Scheduled Campaign Dates</Text>
                <View style={styles.bookedDatesWrap}>
                  {bookedDates.map((d) => (
                    <View key={d} style={[styles.bookedDateChip, { borderColor: theme.border }]}>
                      <Text style={[styles.bookedDateText, { color: theme.text }]}>
                        {new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => void router.push({ pathname: '/ad-calendar', params: { adId: String(id || '') } })}
                style={[styles.ctaSecondary, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <Text style={[styles.ctaSecondaryText, { color: theme.text }]}>📅 Schedule Campaign Dates</Text>
              </Pressable>
            )}
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
  bookedDatesCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  bookedDatesTitle: {
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 10,
  },
  bookedDatesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bookedDateChip: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  bookedDateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0C4A6E',
  },
});
