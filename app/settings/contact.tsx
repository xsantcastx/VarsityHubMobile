import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
// @ts-ignore JS exports
import { User, Support } from '@/api/entities';

export default function ContactScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { (async () => { try { const me: any = await User.me(); setName(me?.display_name || ''); setEmail(me?.email || ''); } catch {} })(); }, []);

  const onSubmit = async () => {
    if (!subject.trim() || !message.trim()) { Alert.alert('Please fill subject and message'); return; }
    setSending(true);
    try {
      await Support.contact({ name: name || 'Unknown', email: email || 'unknown@example.com', subject: subject.trim(), message: message.trim() });
      Alert.alert('Sent', 'Thanks for reaching out.');
      router.back();
    } catch (e: any) { Alert.alert('Failed', e?.message || 'Try again later'); } finally { setSending(false); }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Contact' }} />
      <Text style={styles.title}>Contact Varsity Hub Team</Text>
      <Input placeholder="Your name" value={name} onChangeText={setName} style={{ marginBottom: 8 }} />
      <Input placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={{ marginBottom: 8 }} />
      <Input placeholder="Subject" value={subject} onChangeText={setSubject} style={{ marginBottom: 8 }} />
      <Textarea placeholder="Message" value={message} onChangeText={setMessage} style={{ marginBottom: 12, minHeight: 100 }} />
      <Button onPress={onSubmit} disabled={sending}>{sending ? 'Sending…' : 'Send'}</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
});

