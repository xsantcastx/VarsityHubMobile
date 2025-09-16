import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Input } from '@/components/ui/input';
import PrimaryButton from '@/ui/PrimaryButton';
import Segmented from '@/ui/Segmented';
import DateField from '@/ui/DateField';
import { Color, Type } from '@/ui/tokens';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { useOnboarding, type Affiliation } from '@/context/OnboardingContext';

const usernameRe = /^[a-z0-9_.]{3,20}$/;

export default function Step2Basic() {
  const router = useRouter();
  const { state: ob, setState: setOB } = useOnboarding();
  const [username, setUsername] = useState('');
  const [affiliation, setAffiliation] = useState<Affiliation | null>(null);
  const [dob, setDob] = useState('');
  const [zip, setZip] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { (async () => { try { const me: any = await User.me(); setUsername(me?.display_name || ''); setZip(me?.preferences?.zip_code || ''); } catch {} })(); }, []);
  useEffect(() => { if (ob.affiliation) setAffiliation(ob.affiliation); if (ob.dob) setDob(ob.dob || ''); }, [ob.affiliation, ob.dob]);

  useEffect(() => {
    if (!usernameRe.test(username)) { setAvailable(null); return; }
    const t = setTimeout(async () => {
      setChecking(true);
      try { const r: any = await User.usernameAvailable(username); setAvailable(!!r?.available); }
      catch { setAvailable(null); }
      finally { setChecking(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [username]);

  const dobError = useMemo(() => {
    if (!dob) return '';
    const m = /^\d{4}-\d{2}-\d{2}$/.exec(dob);
    if (!m) return 'Use YYYY-MM-DD';
    const dt = new Date(dob + 'T00:00:00Z');
    if (isNaN(dt.getTime())) return 'Invalid date';
    const thirteenAgo = new Date(); thirteenAgo.setFullYear(thirteenAgo.getFullYear() - 13);
    if (dt > thirteenAgo) return 'Must be at least 13 years old';
    return '';
  }, [dob]);

  const zipValid = useMemo(() => {
    if (!zip) return true;
    const us = /^\d{5}$/; const generic = /^[A-Za-z0-9\s-]{3,10}$/; return us.test(zip) || generic.test(zip);
  }, [zip]);

  const canContinue = usernameRe.test(username) && available === true && !!affiliation && !!dob && !dobError && zipValid && !saving;

  const onContinue = async () => {
    if (!canContinue) return;
    setSaving(true);
    try {
      setOB((prev) => ({ ...prev, display_name: username, affiliation: affiliation!, dob, zip_code: zip || null }));
      await User.patchMe({ display_name: username, preferences: { affiliation, dob, zip_code: zip || undefined } });
      router.push('/onboarding/step-3-plan');
    } catch (e: any) { Alert.alert('Failed to save', e?.message || 'Please try again'); } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Step 2/10' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <Text style={styles.title}>Basic Information</Text>
        <Text style={styles.subtitle}>We’ll set up your account with a username and preferences.</Text>

        <Text style={styles.label}>Username</Text>
        <Input value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="username" style={{ marginBottom: 4 }} onEndEditing={async () => {
          if (!usernameRe.test(username)) { setAvailable(null); return; }
          try { const r: any = await User.usernameAvailable(username); setAvailable(!!r?.available); } catch { setAvailable(null); }
        }} />
        {username.length > 0 && !usernameRe.test(username) ? (
          <Text style={styles.error}>Use 3–20: a–z 0–9 _ .</Text>
        ) : checking ? (
          <Text style={styles.muted}>Checking availability…</Text>
        ) : available === false ? (
          <Text style={styles.error}>That username is taken</Text>
        ) : null}

        <Text style={styles.label}>Affiliation</Text>
        <Segmented
          value={affiliation || undefined}
          onChange={(v) => setAffiliation(v as any)}
          options={[{ value: 'school', label: 'School' }, { value: 'independent', label: 'Independent' }]}
        />

        <DateField
          label="Date of Birth"
          value={dob}
          onChange={setDob}
          maxDate={(() => { const t=new Date(); return new Date(t.getFullYear()-13,t.getMonth(),t.getDate()); })()}
          helpText="Required for messaging safety features"
        />
        {dobError ? <Text style={[styles.error, { marginTop: 4 }]}>{dobError}</Text> : null}

        <Text style={styles.label}>ZIP / Postal Code (optional)</Text>
        <Input placeholder="90210" value={zip} onChangeText={setZip} style={{ marginBottom: 12 }} />
        {!zipValid ? <Text style={styles.error}>Enter a valid code</Text> : null}

        <PrimaryButton label={saving ? 'Saving…' : 'Continue'} onPress={onContinue} disabled={!canContinue} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 4, textAlign: 'center' },
  subtitle: { color: '#6b7280', marginBottom: 12, textAlign: 'center' },
  label: { ...(Type.body as any), marginBottom: 4 },
  error: { color: '#b91c1c', marginBottom: 8 },
  muted: { color: '#6b7280' },
  mutedSmall: { color: '#9CA3AF', marginBottom: 12 },
});
