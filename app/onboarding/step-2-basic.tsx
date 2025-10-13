import { Input } from '@/components/ui/input';
import DateField from '@/ui/DateField';
import PrimaryButton from '@/ui/PrimaryButton';
import Segmented from '@/ui/Segmented';
import { Type } from '@/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { OnboardingBackHeader } from '@/components/onboarding/OnboardingBackHeader';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { useOnboarding, type Affiliation } from '@/context/OnboardingContext';

const usernameRe = /^[a-z0-9_.]{3,20}$/;
const zipRe = /^\d{5}$/;

export default function Step2Basic() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnToConfirmation?: string }>();
  const { state: ob, setState: setOB, setProgress } = useOnboarding();
  const [username, setUsername] = useState('');
  const [affiliation, setAffiliation] = useState<Affiliation>('none');
  const [dob, setDob] = useState('');
  const [zip, setZip] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [zipTouched, setZipTouched] = useState(false);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [verificationInfo, setVerificationInfo] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const returnToConfirmation = params.returnToConfirmation === 'true';

  const refreshEmailVerification = useCallback(async () => {
    try {
      const me: any = await User.me();
      setEmailVerified(Boolean(me?.email_verified));
      setEmail(me?.email || '');
      return me;
    } catch (err) {
      console.warn('[Onboarding][Step2] failed to refresh verification status', err);
      return null;
    }
  }, []);

  useEffect(() => { 
    (async () => { 
      const me = await refreshEmailVerification();
      if (!me) return;
      const displayName = me?.display_name || '';
      if (displayName) {
        setUsername(displayName);
        if (usernameRe.test(displayName)) {
          try {
            const r: any = await User.usernameAvailable(displayName);
            setAvailable(!!r?.available);
          } catch {
            setAvailable(null);
          }
        }
      }
      const initialZip = me?.preferences?.zip_code || '';
      if (initialZip) setZip(initialZip);
    })(); 
  }, [refreshEmailVerification]);

  useFocusEffect(
    useCallback(() => {
      refreshEmailVerification();
    }, [refreshEmailVerification])
  );
  useEffect(() => { if (ob.affiliation) setAffiliation(ob.affiliation); if (ob.dob) setDob(ob.dob || '');
    try { // eslint-disable-next-line no-console
      console.debug('[Onboarding][Step2] mount', { obDob: ob.dob, localDob: dob });
    } catch (e) {}
  }, [ob.affiliation, ob.dob]);

  useEffect(() => {
    // Don't check if username is empty or invalid format
    if (!username || !usernameRe.test(username)) {
      setAvailable(null);
      setChecking(false);
      return;
    }

    // Debounce username checks
    const timeoutId = setTimeout(async () => {
      setChecking(true);
      try {
        const r: any = await User.usernameAvailable(username);
        setAvailable(!!r?.available);
      } catch {
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [username]);

  const dobError = dob && (new Date(dob).getFullYear() < 1920 || new Date(dob) > new Date());
  const usernameError = username.length > 0 && !usernameRe.test(username);
  const normalizedZipValue = zip.trim();
  const zipValid = zipRe.test(normalizedZipValue);
  const baseContinueReady = usernameRe.test(username) && available && affiliation && dob && !dobError && zipValid;
  const continueDisabled = !baseContinueReady || emailVerified === false || saving;
  const continueLabel = emailVerified === false ? 'Verify email to continue' : 'Continue';

  const onBack = () => {
    // If we came from confirmation, go back to confirmation
    if (returnToConfirmation) {
      router.replace('/onboarding/step-10-confirmation');
    } else {
      setProgress(0);
      // Safe navigation - check if we can go back
      if (router.canGoBack()) {
        router.back();
      } else {
        // Fallback to step 1 or main app
        router.replace('/onboarding/step-1-role');
      }
    }
  };

  const handleVerifyNow = () => {
    router.push({ pathname: '/verify-email', params: { returnTo: '/onboarding/step-2-basic' } });
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setVerificationError(null);
    setVerificationInfo(null);
    try {
      const res: any = await User.requestVerification();
      const message = res?.dev_verification_code
        ? `Code sent! (dev: ${res.dev_verification_code})`
        : 'Verification email sent. Please check your inbox.';
      setVerificationInfo(message);
    } catch (e: any) {
      setVerificationError(e?.message || 'Failed to resend verification code. Try again shortly.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleRefreshVerification = async () => {
    setCheckingVerification(true);
    await refreshEmailVerification();
    setCheckingVerification(false);
  };

  const onContinue = async () => {
    if (!baseContinueReady) {
      if (!zipValid) {
        setZipTouched(true);
      }
      return;
    }
    setSaving(true);
    try {
      const normalizedZip = normalizedZipValue;
      setOB((prev) => ({ ...prev, display_name: username, affiliation, dob, zip_code: normalizedZip || null }));
      try { // eslint-disable-next-line no-console
        console.debug('[Onboarding][Step2] onContinue set dob', { obDob: ob.dob, newDob: dob });
      } catch (e) {}
      await User.patchMe({ display_name: username, preferences: { affiliation, dob, zip_code: normalizedZip || undefined } });
      const refreshed = await refreshEmailVerification();
      const verified = Boolean(refreshed?.email_verified);
      if (!verified) {
        Alert.alert(
          'Verify your email',
          'Please verify your email before continuing.',
          [
            { text: 'Verify now', onPress: () => handleVerifyNow() },
            { text: 'Close', style: 'cancel' },
          ]
        );
        return;
      }

      // Navigate back to confirmation if we came from there, otherwise continue to next step
      if (returnToConfirmation) {
        setProgress(9); // step-10 confirmation
        router.replace('/onboarding/step-10-confirmation');
      } else {
        const role = ob.role;
        if (role === 'fan') {
          setProgress(6); // step-7 profile
          router.push('/onboarding/step-7-profile');
        } else {
          setProgress(2); // step-3 plan
          router.push('/onboarding/step-3-plan');
        }
      }
    } catch (e: any) { 
      Alert.alert('Failed to save', e?.message || 'Please try again'); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Step 2/10' }} />

      <OnboardingBackHeader
        title="Basic Information"
        subtitle="We'll set up your account with a username and preferences."
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>

        <Text style={styles.label}>Username</Text>
        <Input value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="username" style={{ marginBottom: 4 }} onEndEditing={async () => {
          if (!usernameRe.test(username)) { setAvailable(null); return; }
          try { const r: any = await User.usernameAvailable(username); setAvailable(!!r?.available); } catch { setAvailable(null); }
        }} />
        {usernameError ? (
          <Text style={styles.error}>Use 3–20: a–z 0–9 _ .</Text>
        ) : checking ? (
          <Text style={styles.muted}>Checking availability…</Text>
        ) : available === false ? (
          <Text style={styles.error}>That username is taken</Text>
        ) : available === true && username.length > 0 ? (
          <Text style={styles.success}>Available!</Text>
        ) : null}

        <Text style={styles.label}>Affiliation</Text>
        <Segmented
          options={[
            { value: 'none', label: 'Other' },
            { value: 'university', label: 'University' },
            { value: 'high_school', label: 'High school' },
            { value: 'club', label: 'Club' },
            { value: 'youth', label: 'Youth' },
          ]}
          value={affiliation}
          onChange={(item) => setAffiliation(item as Affiliation)}
        />

        <Text style={styles.label}>Date of birth</Text>
        <DateField
          label="Date of birth"
          value={dob} 
          onChange={setDob}
        />
        {dobError && (
          <Text style={styles.error}>Please enter a valid date of birth</Text>
        )}

        <Text style={styles.label}>Zip code</Text>
        <Input
          value={zip}
          onChangeText={setZip}
          onBlur={() => setZipTouched(true)}
          autoCapitalize="none"
          placeholder="12345"
          keyboardType="numeric"
          maxLength={5}
        />
        {zipTouched && !zip && (
          <Text style={styles.error}>Zip code is required</Text>
        )}
        {zipTouched && zip.length > 0 && !zipValid && (
          <Text style={styles.error}>Enter a valid 5-digit zip code</Text>
        )}

        {emailVerified === false && (
          <View style={styles.verifyCard}>
            <View style={styles.verifyHeader}>
              <Ionicons name="alert-circle-outline" size={22} color="#B45309" />
              <Text style={styles.verifyTitle}>Verify your email to continue</Text>
            </View>
            <Text style={styles.verifyDescription}>
              We sent a verification code to {email || 'your email address'}. Verify your email to unlock the rest of onboarding.
            </Text>
            {verificationInfo ? (
              <Text style={styles.verifyInfo}>{verificationInfo}</Text>
            ) : null}
            {verificationError ? (
              <Text style={styles.verifyError}>{verificationError}</Text>
            ) : null}
            <View style={styles.verifyActions}>
              <Pressable style={styles.verifyPrimaryButton} onPress={handleVerifyNow}>
                <Ionicons name="mail-open-outline" size={18} color="#FFFFFF" />
                <Text style={styles.verifyPrimaryText}>Verify email now</Text>
              </Pressable>
              <Pressable
                style={[styles.verifySecondaryButton, resendLoading && styles.verifySecondaryDisabled]}
                onPress={handleResendVerification}
                disabled={resendLoading}
              >
                <Text style={styles.verifySecondaryText}>{resendLoading ? 'Sending…' : 'Resend code'}</Text>
              </Pressable>
              <Pressable
                style={styles.verifyRefreshButton}
                onPress={handleRefreshVerification}
                disabled={checkingVerification}
              >
                <Ionicons name="refresh" size={16} color="#1D4ED8" />
                <Text style={styles.verifyRefreshText}>
                  {checkingVerification ? 'Checking…' : "I've already verified"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={{ marginTop: 20 }}>
          <PrimaryButton
            label={continueLabel}
            onPress={onContinue}
            disabled={continueDisabled}
            loading={saving}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  label: {
    ...Type.h1,
    marginTop: 16,
    marginBottom: 8,
  },
  error: {
    fontSize: 14,
    color: '#ef4444',
    marginTop: 4,
  },
  verifyCard: {
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    marginBottom: 8,
  },
  verifyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  verifyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
  },
  verifyDescription: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
    marginBottom: 12,
  },
  verifyActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  verifyPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1D4ED8',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  verifyPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  verifySecondaryButton: {
    borderWidth: 1,
    borderColor: '#1D4ED8',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  verifySecondaryDisabled: {
    opacity: 0.6,
  },
  verifySecondaryText: {
    color: '#1D4ED8',
    fontWeight: '600',
  },
  verifyRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  verifyRefreshText: {
    color: '#1D4ED8',
    fontWeight: '600',
  },
  verifyInfo: {
    color: '#047857',
    marginBottom: 8,
  },
  verifyError: {
    color: '#B91C1C',
    marginBottom: 8,
  },
  success: {
    fontSize: 14,
    color: '#22c55e',
    marginTop: 4,
  },
  muted: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
});
