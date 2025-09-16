import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import PrimaryButton from '@/ui/PrimaryButton';
import { Type } from '@/ui/tokens';
// @ts-ignore
import { User } from '@/api/entities';
import { useOnboarding } from '@/context/OnboardingContext';

type Plan = 'rookie' | 'veteran' | 'legend';

function PlanCard({ title, subtitle, selected, badge, price, onPress, benefits }: { title: string; subtitle: string; selected?: boolean; badge?: string; price?: string; onPress: () => void; benefits?: string[]; }) {
  return (
    <Pressable onPress={onPress} style={[styles.card, selected && styles.cardSelected]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.cardTitle}>{title}</Text>
        {badge ? <Text style={styles.badge}>{badge}</Text> : null}
      </View>
      {price ? <Text style={styles.price}>{price}</Text> : null}
      <Text style={styles.muted}>{subtitle}</Text>
      {Array.isArray(benefits) && benefits.length ? (
        <View style={{ marginTop: 8, gap: 4 }}>
          {benefits.map((b, i) => (
            <Text key={i} style={{ color: '#16A34A' }}>✓ <Text style={{ color: '#111827' }}>{b}</Text></Text>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

export default function Step3Plan() {
  const router = useRouter();
  const { setState: setOB } = useOnboarding();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);

  const onContinue = async () => {
    if (!plan) return;
    setSaving(true);
    try { setOB((prev) => ({ ...prev, plan })); await User.updatePreferences({ plan }); router.push('/onboarding/step-5-league'); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Step 3/10' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <Text style={styles.title}>Choose Your Plan</Text>
        <PlanCard title="Rookie" subtitle="FREE — First 6-month season" selected={plan==='rookie'} onPress={() => setPlan('rookie')} benefits={["Create a league page","Invite team managers","Post updates"]} />
        <PlanCard title="Veteran" subtitle="$70/year or $7.50/month" selected={plan==='veteran'} badge="Most Popular" onPress={() => setPlan('veteran')} benefits={["All Rookie features","Priority support","Advanced analytics"]} />
        <PlanCard title="Legend" subtitle="$150/year" selected={plan==='legend'} onPress={() => setPlan('legend')} benefits={["All Veteran features","Multi-team management","Custom branding"]} />
        {plan ? <PrimaryButton label={saving ? 'Saving…' : 'Continue'} onPress={onContinue} disabled={saving} loading={saving} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  title: { ...(Type.h1 as any), marginBottom: 12, textAlign: 'center' },
  card: { padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', marginBottom: 12 },
  cardSelected: { borderColor: '#111827', backgroundColor: '#FFFFFF' },
  cardTitle: { fontWeight: '800', fontSize: 16 },
  muted: { color: '#6b7280' },
  badge: { color: '#111827', backgroundColor: '#E5E7EB', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, fontSize: 12, fontWeight: '700' },
  price: { fontWeight: '700', marginBottom: 4 },
});
