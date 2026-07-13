import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Alert, useColorScheme } from 'react-native';
// @ts-ignore JS exports
import { Support } from '@/api/entities';
import { useAuth } from '@/context/AuthProvider';
import { safeGoBack } from '@/utils/navigation';
import { SettingsFormScreen } from '@/components/settings/SettingsFormShared';

export default function ContactScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const displayName = user?.display_name || '';
  const profileEmail = user?.email || '';
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
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Please fill subject and message');
      return;
    }
    if (!emailField.trim()) {
      Alert.alert('Email Required', 'Please enter your email so we can respond.');
      return;
    }
    setSending(true);
    try {
      await Support.contact({
        name: name || 'Unknown',
        email: emailField.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });
      Alert.alert('Sent', 'Thanks for reaching out.');
      safeGoBack(router);
    } catch (e: any) {
      if (__DEV__) console.error('[contact] Failed to send contact message:', e);
      Alert.alert('Failed', e?.message || 'Try again later');
    } finally {
      setSending(false);
    }
  };

  return (
    <SettingsFormScreen
      title="Contact"
      headerTitle="Contact VarsityHub Team"
      colorScheme={colorScheme}
    >
      <Input
        placeholder="Your name"
        value={name}
        onChangeText={setName}
        style={{ marginBottom: 8 }}
      />
      <Input
        placeholder="you@example.com"
        value={emailField}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{ marginBottom: 8 }}
      />
      <Input
        placeholder="Subject"
        value={subject}
        onChangeText={setSubject}
        style={{ marginBottom: 8 }}
      />
      <Textarea
        placeholder="Message"
        value={message}
        onChangeText={setMessage}
        style={{ marginBottom: 12, minHeight: 100 }}
      />
      <Button onPress={onSubmit} disabled={sending}>
        {sending ? 'Sending…' : 'Send'}
      </Button>
    </SettingsFormScreen>
  );
}
