import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
// @ts-ignore JS exports
import { Support, User } from '@/api/entities';

export default function FeedbackScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<'bug' | 'idea' | 'other'>('bug');
  const [message, setMessage] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { (async () => { try { await User.me(); } catch {} })(); }, []);

  const onSubmit = async () => {
    if (!message.trim()) { Alert.alert('Please enter a message'); return; }
    setSending(true);
    try {
      await Support.feedback({ user_id: 'me', category, message: message.trim(), screenshot_url: screenshotUrl.trim() || undefined });
      Alert.alert('Thanks!', 'Your feedback was sent.');
      router.back();
    } catch (e: any) { Alert.alert('Failed', e?.message || 'Try again later'); } finally { setSending(false); }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Leave Feedback' }} />
      <Text style={styles.title}>Feedback</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <Button variant={category === 'bug' ? 'default' : 'outline'} onPress={() => setCategory('bug')}><Text>Bug</Text></Button>
        <Button variant={category === 'idea' ? 'default' : 'outline'} onPress={() => setCategory('idea')}><Text>Idea</Text></Button>
        <Button variant={category === 'other' ? 'default' : 'outline'} onPress={() => setCategory('other')}><Text>Other</Text></Button>
      </View>
      <Textarea placeholder="Message" value={message} onChangeText={setMessage} style={{ marginBottom: 8, minHeight: 100 }} />
      <Input placeholder="Screenshot URL (optional)" value={screenshotUrl} onChangeText={setScreenshotUrl} autoCapitalize="none" style={{ marginBottom: 12 }} />
    <Button onPress={onSubmit} disabled={sending}><Text>{sending ? 'Sending…' : 'Submit'}</Text></Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
});

