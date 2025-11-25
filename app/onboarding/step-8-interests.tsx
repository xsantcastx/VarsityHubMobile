import PrimaryButton from '@/components/ui/PrimaryButton';
import { Colors } from '@/constants/Colors';
import { useOnboarding } from '@/context/OnboardingContext';
import { Type } from '@/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
// @ts-ignore
import { User } from '@/api/entities';
import OnboardingLayout from './components/OnboardingLayout';

type Intent = 'find_local_games' | 'view_moments' | 'post_reviews' | 'support_creators' | 'claim_team' | 'follow';

const OPTIONS: { key: Intent; label: string; icon: keyof typeof Ionicons.glyphMap; color: string; route?: string }[] = [
  { key: 'find_local_games', label: 'Find Local Games', icon: 'map', color: '#3b82f6', route: '/(tabs)/discover' },
  { key: 'view_moments', label: 'View Moments', icon: 'play-circle', color: '#8b5cf6', route: '/highlights' },
  { key: 'post_reviews', label: 'Post Reviews and Highlights', icon: 'create', color: '#f59e0b', route: '/create-post' },
  { key: 'support_creators', label: 'Support Local Creators', icon: 'heart', color: '#ec4899', route: '/(tabs)/discover' },
  { key: 'claim_team', label: 'Claim My Team', icon: 'trophy', color: '#10b981', route: '/create-team' },
  { key: 'follow', label: 'Follow Teams/Players', icon: 'people', color: '#06b6d4', route: '/(tabs)/discover' },
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
  }, [ob.primary_intents]);

  const toggle = (k: Intent) => setSel((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const onFinish = async () => {
    if (!sel.length) { Alert.alert('Select at least one option'); return; }
    setSaving(true);
    try {
      // Save to onboarding context
      setOB((prev) => ({ ...prev, primary_intents: sel as any }));
      
      // Save to backend
      await User.updatePreferences({ primary_intents: sel });
      setProgress(7); // step-9 is index 7
      
      // Continue to step 9 (features)
      router.push('/onboarding/step-9-features');
    } catch (e: any) {
      Alert.alert('Failed to save', e?.message || 'Try again');
    } finally { setSaving(false); }
  };

  return (
    <OnboardingLayout
      step={7}
      title="What interests you most?"
      subtitle="Select the features you'd like to explore"
    >
      <Stack.Screen options={{ headerShown: false }} />
      {OPTIONS.map((o) => (
        <Pressable 
          key={o.key} 
          onPress={() => toggle(o.key)} 
          style={[styles.card, sel.includes(o.key) && styles.cardSelected]}
        >
          <View style={[styles.iconContainer, { backgroundColor: o.color + '20' }]}>
            <Ionicons name={o.icon} size={28} color={o.color} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[
              styles.cardTitle, 
              sel.includes(o.key) && { color: Colors[colorScheme].tint }
            ]}>
              {o.label}
            </Text>
          </View>
          {sel.includes(o.key) && (
            <View style={styles.checkmark}>
              <Ionicons name="checkmark-circle" size={24} color={Colors[colorScheme].tint} />
            </View>
          )}
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
  card: { 
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16, 
    borderRadius: 16, 
    borderWidth: 2, 
    borderColor: Colors[colorScheme].border, 
    backgroundColor: Colors[colorScheme].surface, 
    marginBottom: 12,
    minHeight: 72
  },
  cardSelected: { 
    backgroundColor: Colors[colorScheme].tint + '15',
    borderColor: Colors[colorScheme].tint
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  cardContent: {
    flex: 1
  },
  cardTitle: { 
    fontSize: 16,
    fontWeight: '600',
    color: Colors[colorScheme].text
  },
  checkmark: {
    marginLeft: 8
  }
});
