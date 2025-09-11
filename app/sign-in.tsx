import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res: any = await User.loginViaEmailPassword(email, password);
      if (res?.access_token) {
        if (res?.needs_verification) {
          Alert.alert('Verify Email', 'Please verify your email to continue.');
          router.replace('/verify-email');
        } else {
          Alert.alert('Signed in', 'Welcome back!');
          router.replace('/(tabs)');
        }
      } else {
        setError('Invalid login response');
      }
    } catch (e: any) {
      console.error('Login failed', e);
      setError(e?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Sign In' }} />
      <Text style={styles.title}>Sign In</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Input
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{ marginBottom: 10 }}
      />
      <Input
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <View style={{ height: 12 }} />
      <Button onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator /> : 'Sign In'}
      </Button>
      <Pressable style={{ marginTop: 12 }} onPress={() => router.replace('/sign-up')}>
        <Text style={{ color: '#2563EB', fontWeight: '700' }}>Create an account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  error: { color: '#b91c1c', marginBottom: 8 },
});
