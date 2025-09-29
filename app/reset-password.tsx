import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; code?: string }>();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [code, setCode] = useState(typeof params.code === 'string' ? params.code : '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async () => {
    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();
    if (!trimmedEmail || !trimmedCode) {
      setError('Enter your email and reset code.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      await User.resetPassword(trimmedEmail, trimmedCode, password);
      setInfo('Password updated! You can sign in with your new password.');
    } catch (e: any) {
      setError(e?.message || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Stack.Screen options={{ title: 'Reset Password' }} />
      <View style={[styles.card, { backgroundColor: palette.elevated, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>Enter your reset code</Text>
        <Text style={[styles.subtitle, { color: palette.mutedText }]}>We sent a 6-digit code to your email. Enter it with your new password.</Text>

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

        <Input
          placeholder="123456"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
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

        <Input
          placeholder="New password (min 8 characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
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

        <Input
          placeholder="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
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
          {loading ? <ActivityIndicator color="white" /> : 'Update password'}
        </Button>
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
  secondary: {
    marginTop: 24,
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
