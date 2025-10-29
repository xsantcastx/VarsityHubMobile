import { Input } from '@/components/ui/input';
import DateField from '@/ui/DateField';
import PrimaryButton from '@/ui/PrimaryButton';
import { Type } from '@/ui/tokens';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useOnboarding, type Affiliation } from '@/context/OnboardingContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useFocusEffect } from '@react-navigation/native';
import { OnboardingLayout } from './components/OnboardingLayout';

const usernameRe = /^[a-z0-9_.]{3,20}$/;

export default function Step2Basic() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const params = useLocalSearchParams<{ returnToConfirmation?: string }>();
  const { state: ob, setState: setOB, setProgress } = useOnboarding();
  const [username, setUsername] = useState('');
  const [affiliation, setAffiliation] = useState<Affiliation>('none');
  const [dob, setDob] = useState('');
  const [zip, setZip] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);

  const returnToConfirmation = params.returnToConfirmation === 'true';

  const styles = useMemo(() => createStyles(colorScheme), [colorScheme]);

  // Check email verification status when screen focuses
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const me: any = await User.me();
          setEmailVerified(me?.email_verified ?? null);
        } catch (error) {
          console.error('Failed to check email verification:', error);
        }
      })();
    }, [])
  );

  useEffect(() => { 
    (async () => { 
      try { 
        const me: any = await User.me();
        const displayName = me?.display_name || '';
        setUsername(displayName);
        setZip(me?.preferences?.zip_code || '');
        
        // Check username availability immediately if it exists
        if (displayName && usernameRe.test(displayName)) {
          try {
            const r: any = await User.usernameAvailable(displayName);
            setAvailable(!!r?.available);
          } catch {
            setAvailable(null);
          }
        }
      } catch {} 
    })(); 
  }, []);
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
  const isCoach = ob.role === 'coach';
  const zipRequired = isCoach; // Zip code is mandatory for coaches
  const canContinue = usernameRe.test(username) && available && affiliation && dob && !dobError && (!zipRequired || zip.trim().length > 0);

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

  const onContinue = async () => {
    if (!canContinue) return;
    setSaving(true);
    try {
      setOB((prev) => ({ ...prev, display_name: username, affiliation, dob, zip_code: zip || null }));
      try { // eslint-disable-next-line no-console
        console.debug('[Onboarding][Step2] onContinue set dob', { obDob: ob.dob, newDob: dob });
      } catch (e) {}
      await User.patchMe({ display_name: username, preferences: { affiliation, dob, zip_code: zip || undefined } });
      
      // Navigate back to confirmation if we came from there, otherwise continue to next step
      if (returnToConfirmation) {
        setProgress(9); // step-10 confirmation
        router.replace('/onboarding/step-10-confirmation');
      } else {
        setProgress(2); // step-3 plan
        router.push('/onboarding/step-3-plan');
      }
    } catch (e: any) { 
      Alert.alert('Failed to save', e?.message || 'Please try again'); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <OnboardingLayout
      step={2}
      title="Basic Information"
      subtitle="We'll set up your account with a username and preferences"
      onBack={onBack}
      emailVerified={emailVerified === null ? undefined : emailVerified}
      onVerifyEmail={() => router.push('/verify-email')}
    >
      <Stack.Screen options={{ headerShown: false }} />
      
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
      <View style={styles.affiliationGrid}>
        {[
          { value: 'none', label: 'None', icon: '❌' },
          { value: 'university', label: 'University', icon: '🎓' },
          { value: 'high_school', label: 'High School', icon: '🏫' },
          { value: 'club', label: 'Club', icon: '⚽' },
          { value: 'youth', label: 'Youth', icon: '👶' },
        ].map((option) => (
          <Pressable
            key={option.value}
            style={[
              styles.affiliationButton,
              affiliation === option.value && styles.affiliationButtonSelected
            ]}
            onPress={() => setAffiliation(option.value as Affiliation)}
          >
            <Text style={styles.affiliationIcon}>{option.icon}</Text>
            <Text style={[
              styles.affiliationLabel,
              affiliation === option.value && styles.affiliationLabelSelected
            ]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <DateField
        label="Date of birth"
        value={dob} 
        onChange={setDob}
      />
      {dobError && (
        <Text style={styles.error}>Please enter a valid date of birth</Text>
      )}

      <Text style={styles.label}>Zip code {zipRequired && <Text style={styles.error}>*</Text>}</Text>
      <Input 
        value={zip} 
        onChangeText={setZip} 
        autoCapitalize="none" 
        placeholder={zipRequired ? "Required for coaches" : "12345"} 
        keyboardType="numeric" 
        maxLength={5}
      />
      {zipRequired && !zip && (
        <Text style={styles.error}>Zip code is required for coaches</Text>
      )}

      <View style={{ marginTop: 20 }}>
        <PrimaryButton
          label="Continue"
          onPress={onContinue}
          disabled={!canContinue}
          loading={saving}
        />
      </View>
    </OnboardingLayout>
  );
}

const createStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors[colorScheme].background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors[colorScheme].border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors[colorScheme].text,
  },
  title: {
    ...Type.h2,
    color: Colors[colorScheme].text,
    marginBottom: 8,
  },
  subtitle: {
    ...Type.body,
    color: Colors[colorScheme].mutedText,
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors[colorScheme].text,
    marginTop: 20,
    marginBottom: 8,
  },
  error: {
    fontSize: 14,
    color: colorScheme === 'dark' ? '#f87171' : '#ef4444',
    marginTop: 4,
  },
  success: {
    fontSize: 14,
    color: colorScheme === 'dark' ? '#4ade80' : '#22c55e',
    marginTop: 4,
  },
  muted: {
    fontSize: 14,
    color: Colors[colorScheme].mutedText,
    marginTop: 4,
  },
  affiliationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  affiliationButton: {
    width: '30%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors[colorScheme].border,
    backgroundColor: Colors[colorScheme].surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  affiliationButtonSelected: {
    borderColor: Colors[colorScheme].tint,
    backgroundColor: colorScheme === 'dark' ? 'rgba(56,189,248,0.1)' : '#EFF6FF',
    borderWidth: 2,
  },
  affiliationIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  affiliationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors[colorScheme].mutedText,
    textAlign: 'center',
  },
  affiliationLabelSelected: {
    color: Colors[colorScheme].tint,
    fontWeight: '700',
  },
});
