import { Colors } from '@/constants/Colors';
import { useOnboarding } from '@/context/OnboardingContext';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { Type } from '@/ui/tokens';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, useColorScheme } from 'react-native';
// @ts-ignore
import { User } from '@/api/entities';
import OnboardingLayout from './components/OnboardingLayout';

type Intent = 'find_local_games' | 'view_moments' | 'post_reviews' | 'support_creators' | 'claim_team' | 'follow';

const OPTIONS: { key: Intent; label: string; route?: string }[] = [
  { key: 'find_local_games', label: 'Find Local Games', route: '/(tabs)/discover' },
  { key: 'view_moments', label: 'View Moments', route: '/highlights' },
  { key: 'post_reviews', label: 'Post Reviews and Highlights', route: '/create-post' },
  { key: 'support_creators', label: 'Support Local Creators', route: '/(tabs)/discover' },
  { key: 'claim_team', label: 'Claim My Team', route: '/create-team' },
  { key: 'follow', label: 'Follow Teams/Players', route: '/(tabs)/discover' },
];

export default function Step8Interests() {
  const router = useRouter();
  const { setProgress, setState: setOB, state: ob } = useOnboarding();
  const colorScheme = useColorScheme();
  const [sel, setSel] = useState<Intent[]>([]);
  const [saving, setSaving] = useState(false);

  const styles = useMemo(() => createStyles(colorScheme), [colorScheme]);

  // Load existing selections from context
  useEffect(() => {
    if (ob.primary_intents && Array.isArray(ob.primary_intents)) {
      setSel(ob.primary_intents as Intent[]);
    }
  }, []);

  const toggle = (k: Intent) => setSel((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const onFinish = async () => {
    if (!sel.length) { Alert.alert('Select at least one option'); return; }
    setSaving(true);
    try {
      // Save to onboarding context
      setOB((prev) => ({ ...prev, primary_intents: sel as any }));
      
      // Save to backend
      await User.updatePreferences({ primary_intents: sel });
      setProgress(8);
      
      // Continue to step 9 (features)
      router.push('/onboarding/step-9-features');
    } catch (e: any) {
      Alert.alert('Failed to save', e?.message || 'Try again');
    } finally { setSaving(false); }
  };

  return (
    <OnboardingLayout
      step={8}
      title="What interests you most?"
      subtitle=""
    >
      <Stack.Screen options={{ headerShown: false }} />
      {OPTIONS.map((o) => (
        <Pressable key={o.key} onPress={() => toggle(o.key)} style={[styles.row, sel.includes(o.key) && styles.rowSelected]}>
          <Text style={[styles.rowTitle, sel.includes(o.key) && { color: Colors[colorScheme].background }]}>{o.label}</Text>
        </Pressable>
      ))}
      <PrimaryButton label={saving ? 'Saving…' : 'Continue'} onPress={onFinish} disabled={!sel.length || saving} loading={saving} />
    </OnboardingLayout>
  );
}

const createStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Colors[colorScheme].background 
  },
  title: { 
    ...(Type.h1 as any), 
    color: Colors[colorScheme].text,
    marginBottom: 12, 
    textAlign: 'center' 
  },
  row: { 
    padding: 16, 
    borderRadius: 12, 
    borderWidth: StyleSheet.hairlineWidth, 
    borderColor: Colors[colorScheme].border, 
    backgroundColor: Colors[colorScheme].surface, 
    marginBottom: 12 
  },
  rowSelected: { 
    backgroundColor: Colors[colorScheme].text, 
    borderColor: Colors[colorScheme].text 
  },
  rowTitle: { 
    fontWeight: '700',
    color: Colors[colorScheme].text
  },
});
