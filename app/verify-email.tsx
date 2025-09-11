import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
// @ts-ignore
import { User } from '@/api/entities';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onVerify = async () => {
    if (!code.trim()) return;
    setLoading(true); setError(null); setInfo(null);
    try {
      await User.verifyEmail(code.trim());
      setInfo('Email verified!');
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e?.message || 'Verification failed');
    } finally { setLoading(false); }
  };

  const onResend = async () => {
    setLoading(true); setError(null); setInfo(null);
    try {
      const res: any = await User.requestVerification();
      setInfo(res?.dev_verification_code ? `Code sent (dev: ${res.dev_verification_code})` : 'Code sent');
    } catch (e: any) {
      setError(e?.message || 'Resend failed');
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Verify Email' }} />
      <Text style={styles.title}>Verify Your Email</Text>
      <Text style={styles.muted}>Enter the 6-digit code we sent to your email.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}
      <Input placeholder="123456" value={code} onChangeText={setCode} keyboardType="number-pad" style={{ marginTop: 8 }} />
      <View style={{ height: 12 }} />
      <Button onPress={onVerify} disabled={loading || code.trim().length < 4}>
        {loading ? <ActivityIndicator /> : 'Verify'}
      </Button>
      <Pressable style={{ marginTop: 12 }} onPress={onResend}>
        <Text style={{ color: '#2563EB', fontWeight: '700' }}>Resend Code</Text>
      </Pressable>
      <Pressable style={{ marginTop: 12 }} onPress={() => router.replace('/(tabs)')}>
        <Text style={{ color: '#6b7280' }}>Skip for now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  muted: { color: '#6b7280' },
  error: { color: '#b91c1c', marginTop: 8 },
  info: { color: '#065F46', marginTop: 8 },
});

