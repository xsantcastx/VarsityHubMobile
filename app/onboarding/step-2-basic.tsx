import { Input } from '@/components/ui/input';
import DateField from '@/ui/DateField';
import PrimaryButton from '@/ui/PrimaryButton';
import Segmented from '@/ui/Segmented';
import { Type } from '@/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { useOnboarding, type Affiliation } from '@/context/OnboardingContext';

const usernameRe = /^[a-z0-9_.]{3,20}$/;

export default function Step2Basic() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnToConfirmation?: string }>();
  const { state: ob, setState: setOB, setProgress } = useOnboarding();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [affiliation, setAffiliation] = useState<Affiliation>('none');
  const [dob, setDob] = useState('');
  const [zip, setZip] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const returnToConfirmation = params.returnToConfirmation === 'true';

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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Step 2/10' }} />
      
      {/* Header with back button */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </Pressable>
        <Text style={styles.headerTitle}>Basic Information</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <Text style={styles.title}>Basic Information</Text>
        <Text style={styles.subtitle}>We'll set up your account with a username and preferences.</Text>

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
            { value: 'none', label: 'None' },
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
          value={dob} 
          onChange={setDob} 
          placeholder="Select your date of birth"
        />
        {dobError && (
          <Text style={styles.error}>Please enter a valid date of birth</Text>
        )}

        <Text style={styles.label}>Zip code (optional)</Text>
        <Input value={zip} onChangeText={setZip} autoCapitalize="none" placeholder="12345" keyboardType="numeric" />

        <PrimaryButton
          onPress={onContinue}
          disabled={!canContinue}
          loading={saving}
          style={{ marginTop: 20 }}
        >
          Continue
        </PrimaryButton>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
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
    color: '#111827',
  },
  title: {
    ...Type.title3,
    marginBottom: 8,
  },
  subtitle: {
    ...Type.body,
    color: '#6B7280',
    marginBottom: 24,
  },
  label: {
    ...Type.headline,
    marginTop: 16,
    marginBottom: 8,
  },
  error: {
    fontSize: 14,
    color: '#ef4444',
    marginTop: 4,
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