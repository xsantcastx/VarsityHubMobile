import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, Text, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { Support } from '@/api/entities';
import { useUserProfile } from '@/hooks/useUser';
import { Colors } from '@/constants/Colors';
import { safeGoBack } from '@/utils/navigation';

export default function ContactScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { displayName, email: profileEmail, loading: _userLoading } = useUserProfile();
  const [name, setName] = useState(displayName);
  const [emailField, setEmail] = useState(profileEmail);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Update local state when user profile loads
  useEffect(() => {
    if (displayName && !name) setName(displayName);
    if (profileEmail && !emailField) setEmail(profileEmail);
  }, [displayName, profileEmail, name, emailField]);

  const onSubmit = async () => {
    if (!subject.trim() || !message.trim()) { Alert.alert('Please fill subject and message'); return; }
    if (!emailField.trim()) { Alert.alert('Email Required', 'Please enter your email so we can respond.'); return; }
    setSending(true);
    try {
      await Support.contact({ name: name || 'Unknown', email: emailField.trim(), subject: subject.trim(), message: message.trim() });
      Alert.alert('Sent', 'Thanks for reaching out.');
      if (router.canGoBack()) {
        safeGoBack(router);
      } else {
        router.push('/(tabs)' as any);
      }
    } catch (e: any) {
      if (__DEV__) console.error('[contact] Failed to send contact message:', e);
      Alert.alert('Failed', e?.message || 'Try again later');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Contact', headerBackTitle: 'Back', headerShown: true }} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>Contact Varsity Hub Team</Text>
        <Input placeholder="Your name" value={name} onChangeText={setName} style={{ marginBottom: 8 }} />
        <Input placeholder="you@example.com" value={emailField} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={{ marginBottom: 8 }} />
        <Input placeholder="Subject" value={subject} onChangeText={setSubject} style={{ marginBottom: 8 }} />
        <Textarea placeholder="Message" value={message} onChangeText={setMessage} style={{ marginBottom: 12, minHeight: 100 }} />
        <Button onPress={onSubmit} disabled={sending}>{sending ? 'Sending…' : 'Send'}</Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingTop: 24 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
});
