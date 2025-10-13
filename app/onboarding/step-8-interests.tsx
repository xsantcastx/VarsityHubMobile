import { useOnboarding } from '@/context/OnboardingContext';
import PrimaryButton from '@/ui/PrimaryButton';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingBackHeader } from '@/components/onboarding/OnboardingBackHeader';
// @ts-ignore
import { User } from '@/api/entities';

type Intent = 'find_local_games' | 'add_players' | 'follow';

const OPTIONS: { key: Intent; label: string }[] = [
  { key: 'find_local_games', label: 'Find Local Games' },
  { key: 'add_players', label: 'Add Players' },
  { key: 'follow', label: 'Follow Teams/Players' },
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
  router.replace('/onboarding/finish');
    } catch (e: any) {
      Alert.alert('Failed to save', e?.message || 'Try again');
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Step 8/10' }} />
      <OnboardingBackHeader
        title="Pick Your Interests"
        subtitle="Select up to three sports you care about"
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        {OPTIONS.map((o) => (
          <Pressable key={o.key} onPress={() => toggle(o.key)} style={[styles.row, sel.includes(o.key) && styles.rowSelected]}>
            <Text style={[styles.rowTitle, sel.includes(o.key) && { color: 'white' }]}>{o.label}</Text>
          </Pressable>
        ))}
        <PrimaryButton label={saving ? 'Saving…' : 'Finish'} onPress={onFinish} disabled={!sel.length || saving} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  row: { padding: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', backgroundColor: 'white', marginBottom: 12 },
  rowSelected: { backgroundColor: '#111827', borderColor: '#111827' },
  rowTitle: { fontWeight: '700' },
});
