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
import { STEP_ROUTES, nextIncompleteStep } from '@/context/onboardingReducer';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useFocusEffect } from '@react-navigation/native';
import OnboardingLayout from './components/OnboardingLayout';

// Username validation: lowercase letters, numbers, dots, underscores only (matches backend)
// Spaces are normalized to underscores BEFORE validation
const usernameRe = /^[a-z0-9_.]+$/;

export default function Step2Basic() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const params = useLocalSearchParams<{ returnToConfirmation?: string }>();
  const { state: ob, setState: setOB, setProgress, dispatch, canNavigate } = useOnboarding();
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
        } catch (error) {
          console.warn('[step-2-basic] Failed to check email verification:', error);
          setEmailVerified(null);
        }
      })();
    }, [])
  );

  useEffect(() => { 
    void (async () => { 
      try { 
        const me: any = await User.me();
        // Use username if available, otherwise try to normalize from display_name (legacy)
        const existingUsername = me?.username || '';
        const legacyDisplayName = me?.display_name || '';
        const normalized = existingUsername || legacyDisplayName.trim().toLowerCase().replace(/\s+/g, '_');
        setUsername(normalized);
        setZip(me?.preferences?.zip_code || '');
        
        // Check username availability immediately if it exists
        if (normalized && usernameRe.test(normalized)) {
          try {
            const r: any = await User.usernameAvailable(normalized);
            setAvailable(!!r?.available);
          } catch (error) {
            console.warn('[step-2-basic] Username availability check failed:', error);
            setAvailable(null);
          }
        }
      } catch (error) {
        console.warn('[step-2-basic] Failed to load user data:', error);
      } 
    })(); 
  }, []);
  useEffect(() => {
    if (ob.affiliation) setAffiliation(ob.affiliation);
    if (ob.dob) setDob(ob.dob || '');
  }, [ob.affiliation, ob.dob]);

  useEffect(() => {
    // Normalize live input (replace spaces with underscores, convert to lowercase)
    // This ensures validation matches backend requirements
    const normalized = username.trim().toLowerCase().replace(/\s+/g, '_');
    if (normalized !== username) {
      setUsername(normalized);
      return; // will re-run effect with normalized value
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
      } catch (error) {
        console.warn('[step-2-basic] Username availability check failed:', error);
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [username]);

  const dobError = dob && (new Date(dob).getFullYear() < 1920 || new Date(dob) > new Date());
  const isUnder13 = dob && (() => {
    const d = new Date(dob);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age < 13;
  })();
  const usernameError = username.length > 0 && !usernameRe.test(username);
  
  // Validation rules:
  // - Username: required, valid format, available
  // - DOB: required, valid date
  // - Affiliation: required ONLY for coaches (optional for fans)
  // - Zip code: optional for all users
  const canContinue = usernameRe.test(username) && 
    available === true && 
    dob && 
    !dobError &&
    !isUnder13 &&
    (ob.role === 'fan' || affiliation); // Affiliation required for coaches only

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

    // COPPA: Block under-13 users - do not store any data
    if (isUnder13) {
      Alert.alert(
        'Age Requirement',
        'VarsityHub is not available for users under 13. Please have a parent or guardian contact support@varsityhub.app.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Prevent race conditions
    if (!canNavigate || saving) {
      if (__DEV__) console.warn('[STEP-2] Navigation blocked - saving or already navigating');
      return;
    }
    
    // Final normalization pass
    const finalUsername = username.trim().toLowerCase().replace(/\s+/g, '_');
    setSaving(true);
    dispatch({ type: 'SAVE_START' });
    
    try {
      const updatedData = {
        username: finalUsername,
        affiliation,
        dob,
        zip: zip || undefined,
        zip_code: zip || null,
      };
      
      setOB((prev) => ({ 
        ...prev, 
        ...updatedData,
      }));
      
      // Save username (not display_name) - this is the single identifier
      await User.patchMe({ username: finalUsername, preferences: { affiliation, dob, zip_code: zip || undefined } });
      
      // Navigate back to confirmation if we came from there, otherwise use reducer to calculate next step
      if (returnToConfirmation) {
        dispatch({ type: 'SET_STEP', stepIndex: 8, reason: 'RETURN_TO_CONFIRMATION' });
        setProgress(8);
        router.replace('/onboarding/step-10-confirmation');
      } else {
        // Preserve role in updated data to prevent it from being lost
        const currentRole = ob.role;
        const updatedDataWithRole = { ...updatedData, role: currentRole };
        const updatedState = { ...ob, ...updatedDataWithRole };
        const isCoach = currentRole === 'coach';
        const nextStepIndex = isCoach
          ? 2 // Step 3 (Plan) for coaches, always sequential from Step 2
          : nextIncompleteStep(updatedState, currentRole);
        const nextRoute = isCoach
          ? '/onboarding/step-3-plan'
          : (STEP_ROUTES[nextStepIndex] || STEP_ROUTES[0]);
        
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log('[STEP-2] Navigation after save:', {
            role: currentRole,
            isCoach,
            nextStepIndex,
            nextRoute,
            calculatedNext: nextIncompleteStep(updatedState, currentRole),
          });
        }
        
        // Save and navigate - include role to ensure reducer state is consistent
        dispatch({ 
          type: 'SAVE_SUCCESS', 
          data: updatedDataWithRole 
        });
        setProgress(nextStepIndex);
        router.replace(nextRoute as any);
      }
    } catch (e: any) { 
      console.error('[step-2-basic] Failed to save:', e);
      dispatch({ type: 'SAVE_FAIL', error: e });
      const errorMessage = e?.message || e?.data?.error || 'Please try again';
      Alert.alert('Failed to save', errorMessage, [
        { text: 'OK', style: 'default' }
      ]); 
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
        try { const r: any = await User.usernameAvailable(username); setAvailable(!!r?.available); } catch (error) { console.warn('[onboarding] Username availability check failed:', error); setAvailable(null); }
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

      {/* Organization Type - Only shown for coaches/organizers */}
      {ob.role === 'coach' && (
        <>
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
        </>
      )}

      <DateField
        label={ob.role === 'coach' ? 'Date of birth (Authorized User)' : 'Date of birth'}
        value={dob} 
        onChange={setDob}
      />
      {dobError && (
        <Text style={styles.error}>Please enter a valid date of birth</Text>
      )}
      {isUnder13 && !dobError && (
        <Text style={styles.error}>VarsityHub is not available for users under 13. Please have a parent or guardian contact support@varsityhub.app.</Text>
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
