import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter the email you use to sign in.');
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res: any = await User.requestPasswordReset(trimmed);
      if (res?.ok) {
        setInfo('Check your email for a reset code.');
      } else {
        setInfo('If that email is registered, we sent reset instructions.');
      }
    } catch (e: any) {
      setError(e?.message || 'Unable to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Stack.Screen options={{ title: 'Forgot Password' }} />
      <View style={[styles.card, { backgroundColor: palette.elevated, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>Reset your password</Text>
        <Text style={[styles.subtitle, { color: palette.mutedText }]}>Enter your account email and we'll send a 6-digit code to reset your password.</Text>

        {error ? <Text style={[styles.error, { color: '#b91c1c' }]}>{error}</Text> : null}
        {info ? <Text style={[styles.info, { color: '#065F46' }]}>{info}</Text> : null}

        <Input
          placeholder="name@school.edu"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor={palette.mutedText}
          style={[
            styles.input,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              color: palette.text,
            },
          ]}
        />

        <Button onPress={onSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : 'Send reset code'}
        </Button>

        <Pressable
          style={styles.linkRow}
          onPress={() => router.push({ pathname: '/reset-password', params: { email: email.trim() } })}
          disabled={!email.trim()}
        >
          <Text style={[styles.link, { color: palette.tint }]}>Already have a code? Reset now</Text>
        </Pressable>
      </View>

      <Pressable style={styles.secondary} onPress={() => router.replace('/sign-in')}>
        <Text style={[styles.secondaryText, { color: palette.tint }]}>Back to sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    fontWeight: '600',
  },
  info: {
    fontWeight: '600',
  },
  input: {
    marginTop: 4,
  },
  linkRow: {
    alignItems: 'center',
  },
  link: {
    fontSize: 14,
    fontWeight: '700',
  },
  secondary: {
    marginTop: 24,
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
