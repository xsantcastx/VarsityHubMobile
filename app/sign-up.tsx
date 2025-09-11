import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
// @ts-ignore
import { User } from '@/api/entities';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function SignUpScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!email || !password) { setError('Please enter email and password'); return; }
    setLoading(true); setError(null); setDevCode(null);
    try {
      const res: any = await User.register(email, password, name || undefined);
      // In dev, backend may return the code to speed up verification.
      if (res?.dev_verification_code) setDevCode(String(res.dev_verification_code));
      router.replace('/verify-email');
    } catch (e: any) {
      setError(e?.message || 'Sign up failed');
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Create Account' }} />
      <Text style={styles.title}>Create Account</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Input placeholder="Display name (optional)" value={name} onChangeText={setName} style={{ marginBottom: 10 }} />
      <Input placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={{ marginBottom: 10 }} />
      <Input placeholder="Password (min 8 chars)" value={password} onChangeText={setPassword} secureTextEntry />
      <View style={{ height: 12 }} />
      <Button onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator /> : 'Sign Up'}
      </Button>
      <Pressable style={{ marginTop: 12 }} onPress={() => router.replace('/sign-in')}>
        <Text style={{ color: '#2563EB', fontWeight: '700' }}>Already have an account? Sign in</Text>
      </Pressable>
      {devCode ? <Text style={{ marginTop: 12, color: '#6b7280' }}>Dev code: {devCode}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  error: { color: '#b91c1c', marginBottom: 8 },
});

