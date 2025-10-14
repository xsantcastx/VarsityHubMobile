import { useOnboarding } from '@/context/OnboardingContext';
import PrimaryButton from '@/ui/PrimaryButton';
import { Type } from '@/ui/tokens';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
// @ts-ignore
import { User } from '@/api/entities';
import { OnboardingLayout } from './components/OnboardingLayout';

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
  const { setProgress } = useOnboarding();
  const [sel, setSel] = useState<Intent[]>([]);
  const [saving, setSaving] = useState(false);

  const toggle = (k: Intent) => setSel((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const onFinish = async () => {
    if (!sel.length) { Alert.alert('Select at least one option'); return; }
    setSaving(true);
    try {
      await User.updatePreferences({ primary_intents: sel });
      await User.updatePreferences({ onboarding_completed: true });
      setProgress(8);
      
      // Navigate to the route of the first selected option
      const firstSelected = OPTIONS.find(o => sel.includes(o.key));
      if (firstSelected?.route) {
        router.replace(firstSelected.route as any);
      } else {
        router.replace('/onboarding/finish');
      }
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
          <Text style={[styles.rowTitle, sel.includes(o.key) && { color: 'white' }]}>{o.label}</Text>
        </Pressable>
      ))}
      <PrimaryButton label={saving ? 'Saving…' : 'Finish'} onPress={onFinish} disabled={!sel.length || saving} loading={saving} />
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  title: { ...(Type.h1 as any), marginBottom: 12, textAlign: 'center' },
  row: { padding: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', backgroundColor: 'white', marginBottom: 12 },
  rowSelected: { backgroundColor: '#111827', borderColor: '#111827' },
  rowTitle: { fontWeight: '700' },
});
