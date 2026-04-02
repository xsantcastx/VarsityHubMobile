// GATED — restore when ADS is ready to test
export { default } from '@/components/ComingSoon';
import settings from '@/api/settings';
import { BannerUpload } from '@/components/BannerUpload';
import { ReachMapPreview } from '@/components/ReachMapPreview';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { httpGet } from '@/api/http';
import { sanitizeText } from '@/utils/formUtils';
// @ts-ignore
import { Advertisement as AdsApi } from '@/api/entities';

type BannerFitValue = 'rotate' | 'fill' | 'stretch' | `rotate:${number}`;
type ServerBannerFitMode = 'cover' | 'contain' | 'fill';

type DraftAd = {
  id: string;
  business_name: string;
  contact_name: string;
  contact_email: string;
  banner_url?: string;
  banner_fit_mode?: BannerFitValue;
  target_url?: string;
  zip_code: string;
  description?: string;
  created_at: string;
  owner_id?: string | null;
  isLocal?: boolean;
};

function SubmitAdScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [business, setBusiness] = useState('');
  const [zip, setZip] = useState('');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [bannerFitMode, setBannerFitMode] = useState<BannerFitValue>('fill');
  const [targetUrl, setTargetUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  // Normalize URL: auto-prepend https:// if user omits protocol
  const normalizeUrl = (url: string): string => {
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const normalizeBannerFitMode = (mode: BannerFitValue): ServerBannerFitMode => {
    if (String(mode).startsWith('rotate')) return 'contain';
    if (mode === 'stretch') return 'fill';
    return 'fill';
  };

  const canSubmit = useMemo(() => {
    // Website link is required; description is optional
    if (!name.trim() || !email.trim() || !business.trim()) return false;
    if (!/^\d{5}$/.test(zip.trim())) return false; // Must be a valid 5-digit zip
    if (!bannerUrl) return false; // Banner is mandatory
    if (!targetUrl.trim()) return false; // Website link mandatory
    return true;
  }, [name, email, business, zip, bannerUrl, targetUrl]);

  const handleBannerChange = (
    uri: string,
    fitMode: BannerFitValue,
    _position?: { x: number; y: number }
  ) => {
    setBannerUrl(uri);
    setBannerFitMode(fitMode);
  };

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      let currentUserId: string | null = null;
      let normalizedEmail = email.trim().toLowerCase();
      // Quick-fail /me call (3s timeout, 0 retries) — only needed for local cache scoping.
      // The default User.me() uses 5 retries × 30s timeout = up to 3 min blocking.
      try {
        const me: any = await httpGet('/me', {}, 3000, 0);
        currentUserId = me?.id ? String(me.id) : null;
        if (!normalizedEmail && typeof me?.email === 'string') {
          normalizedEmail = me.email.trim().toLowerCase();
        }
      } catch (err) {
        if (__DEV__) console.warn('[submit-ad] /me prefetch failed:', (err as Error)?.message ?? err);
      }

      // Create ad on server
      let serverId: string | null = null;
      let createError: string | null = null;
      try {
        const created: any = await AdsApi.create({
          contact_name: sanitizeText(name),
          contact_email: email.trim(),
          business_name: sanitizeText(business),
          banner_url: bannerUrl || undefined,
          banner_fit_mode: normalizeBannerFitMode(bannerFitMode),
          target_url: normalizeUrl(targetUrl) || undefined,
          target_zip_code: zip.trim(),
          radius: 9,
          description: sanitizeText(desc) || undefined,
        });
        serverId = String(created?.id || '');
        if (created?.user_id) currentUserId = String(created.user_id);
        if (typeof created?.contact_email === 'string') {
          normalizedEmail = created.contact_email.trim().toLowerCase();
        }
      } catch (err: any) {
        createError = err?.message || 'Could not create ad on server';
        if (err?.status === 403) {
          const msg = (err?.message || err?.data?.error || '').toLowerCase();
          const code = err?.data?.code || '';
          if (msg.includes('verification') || msg.includes('verified')) {
            Alert.alert(
              'Email Verification Required',
              'You need to verify your email before submitting an ad. Would you like to verify now?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Verify Now', onPress: () => router.push('/verify-email' as any) },
              ]
            );
            return;
          }
          if (code === 'PLAN_REQUIRED' || msg.includes('subscription') || msg.includes('veteran') || msg.includes('legend')) {
            Alert.alert(
              'Subscription Required',
              'Ad creation requires a Veteran or Legend subscription. Upgrade your plan to start advertising.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'View Plans', onPress: () => router.push('/subscription-paywall' as any) },
              ]
            );
            return;
          }
        }
      }

      // If server creation failed, do NOT navigate — the ad doesn't exist on the server
      // so payment will always fail with "Ad not found"
      if (!serverId) {
        Alert.alert('Error', createError || 'Could not create your ad. Please check your connection and try again.');
        return;
      }

      const adId = serverId;
      // Keep a local copy so My Ads can show offline
      try {
        const draft: DraftAd = {
          id: adId,
          business_name: business.trim(),
          contact_name: name.trim(),
          contact_email: normalizedEmail || email.trim().toLowerCase(),
          banner_url: bannerUrl || undefined,
          banner_fit_mode: bannerFitMode,
          target_url: normalizeUrl(targetUrl) || undefined,
          zip_code: zip.trim(),
          description: desc.trim() || undefined,
          created_at: new Date().toISOString(),
          owner_id: currentUserId,
          isLocal: false,
        };
        const baseKey = settings.SETTINGS_KEYS.LOCAL_ADS;
        const scopedKey = currentUserId ? `${baseKey}_${currentUserId}` : baseKey;
        const arr = await settings.getJson<DraftAd[]>(scopedKey, []);
        // de-dup if server returned same id
        const next = arr.filter((a) => a.id !== adId).concat([draft]);
        await settings.setJson(scopedKey, next);
        if (currentUserId) {
          const legacy = await settings.getJson<DraftAd[]>(baseKey, []);
          const legacyFiltered = legacy.filter((a) => a.id !== adId);
          if (legacyFiltered.length !== legacy.length) {
            await settings.setJson(baseKey, legacyFiltered);
          }
        }
      } catch (err) {
        if (__DEV__) console.warn('[submit-ad] Failed to cache draft locally:', (err as Error)?.message ?? err);
      }

      router.push({ pathname: '/ad-calendar', params: { adId } });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save your ad.');
    } finally {
      setBusy(false);
    }
  };

  const topPadding = useMemo(() => 8, []); // Minimal padding since header is already shown
  const bottomPadding = useMemo(() => Math.max(insets.bottom + 16, 32), [insets.bottom]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['bottom']}>
      <Stack.Screen 
        options={{ 
          title: 'Submit Ad', 
          headerShown: true,
          headerLeft: () => (
            <Pressable onPress={() => safeGoBack(router)} style={{ padding: 8 }} accessibilityLabel="Go back">
              <MaterialIcons name="arrow-back" size={24} color={theme.text} />
            </Pressable>
          ),
        }} 
      />
        <ScrollView
          scrollEnabled={scrollEnabled}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: topPadding, paddingBottom: bottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Submit a Local Ad</Text>
            <Text style={[styles.subtitle, { color: theme.mutedText }]}>
              Promote your business to local teams and families. Continue to pick your campaign dates.
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.label, { color: theme.text }]}>Your Name *</Text>
            <TextInput 
              value={name} 
              onChangeText={setName} 
              placeholder="Jane Doe" 
              style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]} 
              placeholderTextColor={theme.mutedText}
              autoCapitalize="words" 
            />

            <Text style={[styles.label, { color: theme.text }]}>Email Address *</Text>
            <TextInput 
              value={email} 
              onChangeText={setEmail} 
              placeholder="you@business.com" 
              style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]} 
              placeholderTextColor={theme.mutedText}
              keyboardType="email-address" 
              autoCapitalize="none" 
            />

            <Text style={[styles.label, { color: theme.text }]}>Business Name *</Text>
            <TextInput 
              value={business} 
              onChangeText={setBusiness} 
              placeholder="Downtown Pizza & Grill" 
              style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]} 
              placeholderTextColor={theme.mutedText}
            />

            <Text style={[styles.label, { color: theme.text }]}>Target Zip Code *</Text>
            <TextInput
              value={zip}
              onChangeText={setZip}
              placeholder="12345"
              style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
              placeholderTextColor={theme.mutedText}
              keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
              maxLength={5}
            />

            {/* Reach Map Preview - Shows advertisers exactly where their ad will appear */}
            <ReachMapPreview zipCode={zip} radiusKm={9} />

            <Text style={[styles.label, { color: theme.text }]}>Ad Banner *</Text>
            <BannerUpload 
              value={bannerUrl || ''} 
              onChange={handleBannerChange}
              aspectRatio={16 / 9}
              required={true}
              onScrollLock={(locked) => setScrollEnabled(!locked)}
            />
            {!bannerUrl && (
              <Text style={[styles.muted, { color: theme.mutedText }]}>Banner image is required for your ad</Text>
            )}

            <Text style={[styles.label, { color: theme.text }]}>Website Link *</Text>
            <TextInput
              value={targetUrl}
              onChangeText={setTargetUrl}
              placeholder="https://yourwebsite.com"
              style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
              placeholderTextColor={theme.mutedText}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {targetUrl.trim() && (
              <Text style={[styles.helperText, { color: theme.mutedText }]}>
                🔗 Users can tap your ad to visit this website
              </Text>
            )}

            <Text style={[styles.label, { color: theme.text }]}>Description (Optional)</Text>
            <TextInput
              value={desc}
              onChangeText={setDesc}
              placeholder="Tell us about your business or message..."
              style={[styles.input, styles.textArea, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
              placeholderTextColor={theme.mutedText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            {/* Description is optional */}
          </View>

          <Pressable 
            onPress={submit} 
            disabled={!canSubmit || busy} 
            style={[styles.cta, (!canSubmit || busy) && styles.ctaDisabled]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>📅 Continue to Calendar</Text>
            )}
          </Pressable>
        </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'white' 
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
    borderWidth: 1, 
    borderColor: '#D1D5DB', 
    gap: 12,
    marginBottom: 20,
  },
  label: {
    fontWeight: '700',
    fontSize: 15,
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
    letterSpacing: 0,
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
    marginTop: -4,
    marginBottom: 4,
    lineHeight: 18,
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
  },
  ctaDisabled: { 
    opacity: 0.5 
  },
  ctaText: { 
    color: 'white', 
    fontWeight: '800', 
    fontSize: 17,
    letterSpacing: 0.3,
  },
});
