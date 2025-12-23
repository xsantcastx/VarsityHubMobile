import DateField from '@/components/ui/DateField';
import { Input } from '@/components/ui/input';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { Type } from '@/ui/tokens';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useOnboarding, type Affiliation } from '@/context/OnboardingContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useFocusEffect } from '@react-navigation/native';
import OnboardingLayout from './components/OnboardingLayout';

// Allow spaces temporarily so prefilled Apple display names don't block progress; we normalize to underscores.
const usernameRe = /^[a-z0-9_. ]{3,20}$/;

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
      void (async () => {
        try {
          const me: any = await User.me();
          setEmailVerified(me?.email_verified ?? null);
        } catch {
          setEmailVerified(null);
        }
      })();
    }, [])
  );

  useEffect(() => { 
    void (async () => { 
      try { 
        const me: any = await User.me();
        const displayName = me?.display_name || '';
        // Normalize display name to a username-friendly format (underscores, lowercase)
        const normalized = displayName.trim().toLowerCase().replace(/\s+/g, '_');
        setUsername(normalized);
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
  useEffect(() => {
    if (ob.affiliation) setAffiliation(ob.affiliation);
    if (ob.dob) setDob(ob.dob || '');
  }, [ob.affiliation, ob.dob]);

  useEffect(() => {
    // Normalize live input (replace spaces) so user doesn't get stuck on Continue
    if (username.includes(' ')) {
      setUsername((prev) => prev.replace(/\s+/g, '_'));
      return; // will re-run effect
    }
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
  const canContinue = usernameRe.test(username) && available && affiliation && dob && !dobError;

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
    // SECURITY: Prevent double submission
    if (!canContinue || saving) return;
    
    // Final normalization pass
    const finalUsername = username.trim().toLowerCase().replace(/\s+/g, '_');
    setSaving(true);
    try {
      setOB((prev) => ({ ...prev, display_name: finalUsername, affiliation, dob, zip_code: zip || null }));
      await User.patchMe({ display_name: finalUsername, preferences: { affiliation, dob, zip_code: zip || undefined } });
      
      // Navigate back to confirmation if we came from there, otherwise continue based on role
      if (returnToConfirmation) {
        setProgress(7); // step-10 is index 7
        router.replace('/onboarding/step-10-confirmation');
      } else {
        // Fan: light path → profile setup
        if (ob.role === 'fan') {
          setProgress(5); // step-7 is index 5
          router.push('/onboarding/step-7-profile');
          return;
        }

        // Coach: go to plan selection
        setProgress(2); // step-3 is index 2
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
      onVerifyEmail={() => void router.push('/verify-email')}
    >
      <Stack.Screen options={{ headerShown: false }} />
      
      <Text style={styles.label}>Username</Text>
      <Input value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="username" style={{ marginBottom: 4, letterSpacing: 0 }} onEndEditing={async () => {
        if (!usernameRe.test(username)) { setAvailable(null); return; }
        try { const r: any = await User.usernameAvailable(username); setAvailable(!!r?.available); } catch { setAvailable(null); }
      }} />
      {usernameError ? (
        <Text style={styles.error}>Use 3-20 lowercase letters, numbers, underscores, or periods.</Text>
      ) : checking ? (
        <Text style={styles.muted}>Checking availability…</Text>
      ) : available === false ? (
        <Text style={styles.error}>That username is taken</Text>
      ) : available === true && username.length > 0 ? (
        <Text style={styles.success}>Available!</Text>
      ) : null}

      <Text style={styles.label}>Organization Type</Text>
      <Text style={[styles.hint, { color: Colors[colorScheme].mutedText }]}>
        Select the type of organization you're affiliated with (optional)
      </Text>
      <View style={styles.affiliationGrid}>
        {[
          { value: 'none', label: 'None', icon: '❌' },
          { value: 'professional', label: 'Professional', icon: '🏟️' },
          { value: 'university', label: 'University', icon: '🎓' },
          { value: 'high_school', label: 'High School', icon: '🏫' },
          { value: 'club', label: 'Club', icon: '⚽' },
          { value: 'youth', label: 'Youth Org', icon: '🏀' },
        ].map((option) => (
          <Pressable
            key={option.value}
            style={[
              styles.affiliationButton,
              affiliation === option.value && styles.affiliationButtonSelected
            ]}
            onPress={() => setAffiliation(option.value as Affiliation)}
            accessibilityLabel={`${option.label} affiliation`}
            accessibilityRole="button"
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
        label={ob.role === 'coach' ? 'Date of birth (Authorized User)' : 'Date of birth'}
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
        autoCapitalize="none" 
        placeholder="12345" 
        keyboardType="numeric" 
        maxLength={5}
      />

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
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors[colorScheme].text,
    marginTop: 12,
    marginBottom: 6,
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
  hint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  affiliationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 12,
  },
  affiliationButton: {
    width: '31%',
    paddingVertical: 10,
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
    marginBottom: 2,
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
