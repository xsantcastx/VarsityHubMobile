import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Input } from '@/components/ui/input';
import PrimaryButton from '@/ui/PrimaryButton';
import { Type } from '@/ui/tokens';
// @ts-ignore
import { Team } from '@/api/entities';
import { useOnboarding } from '@/context/OnboardingContext';

export default function Step5League() {
  const router = useRouter();
  const { setState: setOB } = useOnboarding();
  const [orgName, setOrgName] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const canContinue = orgName.trim().length > 0 && location.trim().length > 0 && !saving;

  const onContinue = async () => {
    if (!canContinue) return;
    setSaving(true);
    try {
      const desc = 'League Page' + (location ? ` — ${location.trim()}` : '');
      const t = await Team.create({ name: orgName.trim(), description: desc });
      setOB((prev) => ({ ...prev, team_id: t?.id }));
      router.push('/onboarding/step-6-authorized-users');
    } catch (e: any) { Alert.alert('Failed to create league', e?.message || 'Please verify your email and try again'); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Step 5/10' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <Text style={styles.title}>Create Your League Page</Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoText}>League → Teams → Players. Create your league page and invite managers to their teams.</Text>
        </View>
        <Text style={styles.label}>Organization Name</Text>
        <Input value={orgName} onChangeText={setOrgName} placeholder="Springfield Youth League" style={{ marginBottom: 8 }} />
        <Text style={styles.label}>Location</Text>
        <Input value={location} onChangeText={setLocation} placeholder="City, State" style={{ marginBottom: 12 }} />
        <PrimaryButton label={saving ? 'Saving…' : 'Continue'} onPress={onContinue} disabled={!canContinue} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  title: { ...(Type.h1 as any), marginBottom: 12, textAlign: 'center' },
  label: { fontWeight: '700', marginBottom: 4 },
  infoBox: { padding: 12, borderRadius: 12, backgroundColor: '#F0FDF4', borderWidth: StyleSheet.hairlineWidth, borderColor: '#BBF7D0', marginBottom: 12 },
  infoTitle: { fontWeight: '800', marginBottom: 4, color: '#166534' },
  infoText: { color: '#166534' },
});
