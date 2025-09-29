import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useColorScheme,
} from 'react-native';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';

export default function SignInScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

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
          // Use a concrete typed route to satisfy the typed router
          router.replace('/(tabs)/feed');
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
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <Stack.Screen options={{ title: 'Sign In', headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={[styles.logoContainer, { backgroundColor: palette.card, shadowColor: colorScheme === 'dark' ? '#000000' : '#0f172a' }]}>
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.logo}
                contentFit="contain"
              />
            </View>
            <Text style={[styles.title, { color: palette.text }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: palette.mutedText }]}>Sign in to keep your community in sync.</Text>
          </View>

          <View style={[styles.card, { backgroundColor: palette.elevated, borderColor: palette.border }]}>
            {error ? (
              <Text style={[styles.error, { color: '#b91c1c' }]}>{error}</Text>
            ) : null}

            <View style={styles.fieldSpacing}>
              <Text style={[styles.label, { color: palette.mutedText }]}>Email</Text>
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
            </View>

            <View style={styles.fieldSpacing}>
              <Text style={[styles.label, { color: palette.mutedText }]}>Password</Text>
              <Input
                placeholder="Enter your password"
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
            </View>

            <Pressable style={styles.forgotLink} onPress={() => router.push('/forgot-password')}>
              <Text style={[styles.forgotLinkText, { color: palette.tint }]}>Forgot password?</Text>
            </Pressable>

            <Button onPress={onSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="white" /> : 'Sign In'}
            </Button>
          </View>

          <Pressable style={styles.footer} onPress={() => router.replace('/sign-up')}>
            <Text style={[styles.footerText, { color: palette.mutedText }]}>Need an account?</Text>
            <Text style={[styles.footerLink, { color: palette.tint }]}>Create one</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
  },
  logo: {
    width: 88,
    height: 88,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    maxWidth: 280,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    gap: 18,
  },
  fieldSpacing: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    marginBottom: 0,
  },
  forgotLink: {
    alignSelf: 'flex-end',
  },
  forgotLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  error: {
    marginBottom: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});







