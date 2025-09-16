import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
// @ts-ignore
import { User } from '@/api/entities';
import { Input } from '@/components/ui/input';
import PrimaryButton from '@/ui/PrimaryButton';
import { Type } from '@/ui/tokens';

export default function OnboardingFinish() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<any>(null);

  useEffect(() => { (async () => { try { setMe(await User.me()); } catch {} })(); }, []);
  useEffect(() => {
    if (cooldown <= 0) return; 
    timerRef.current = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [cooldown]);

  const sendCode = async () => {
    setSending(true);
    try { await fetch(String((process as any).env?.EXPO_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '') + '/auth/verify/send', { method: 'POST', headers: { 'Cache-Control': 'no-store', 'If-None-Match': '' } }); setCooldown(30); }
    catch (e: any) { Alert.alert('Failed to send', e?.message || 'Try again'); }
    finally { setSending(false); }
  };

  const verify = async () => {
    if (!code.trim()) { Alert.alert('Enter the 6-digit code'); return; }
    setVerifying(true);
    try { await User.verifyEmail(code.trim()); const updated = await User.me(); setMe(updated); router.replace('/(tabs)/feed'); }
    catch (e: any) { Alert.alert('Invalid code', e?.message || 'Check the code and try again'); }
    finally { setVerifying(false); }
  };

  const skip = () => router.replace('/(tabs)/feed');

  const verified = !!me?.email_verified;
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Finish' }} />
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={styles.title}>You’re all set! 🎉</Text>
        {verified ? (
          <>
            <Text style={styles.muted}>Your email is verified. Enjoy Varsity Hub!</Text>
            <PrimaryButton label="Go to Feed" onPress={() => router.replace('/(tabs)/feed')} />
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Verify your email to unlock messaging & RSVPs</Text>
            <Input placeholder="Enter 6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" style={{ marginBottom: 8 }} />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <PrimaryButton label={cooldown>0 ? `Resend in ${cooldown}s` : 'Send Code'} onPress={sendCode} disabled={sending || cooldown>0} loading={sending} />
              <PrimaryButton label={verifying ? 'Verifying…' : 'Verify'} onPress={verify} disabled={verifying} loading={verifying} />
            </View>
            <PrimaryButton label="Skip for now" onPress={skip} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  title: { ...(Type.h1 as any), textAlign: 'center' },
  muted: { color: '#6b7280', textAlign: 'center' },
  card: { padding: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', gap: 8 },
  cardTitle: { fontWeight: '700', marginBottom: 8 },
});
