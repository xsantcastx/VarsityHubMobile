import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
// @ts-ignore JS exports
import { HostingRequests, User } from '@/api/entities';

export default function RequestHostEventScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [org, setOrg] = useState('');
  const [venue, setVenue] = useState('');
  const [dates, setDates] = useState('');
  const [sending, setSending] = useState(false);
  useEffect(() => { void (async () => { try { const me: any = await User.me(); setName(me?.display_name || ''); setEmail(me?.email || ''); } catch {} })(); }, []);
  const onSubmit = async () => {
    if (!org.trim()) { Alert.alert('Enter organization name'); return; }
    if (!email.trim()) { Alert.alert('Enter a contact email'); return; }
    setSending(true);
    try {
      await HostingRequests.create({
        organization_name: org.trim(),
        contact_name: name.trim() || undefined,
        contact_email: email.trim(),
        venue: venue.trim() || undefined,
        requested_dates: dates.trim() || undefined,
      });
      Alert.alert('Sent', 'We received your request. You can track the status in My Hosting Requests.');
      router.replace('/settings/hosting-requests');
    } catch (e: any) { Alert.alert('Failed to send', e?.message || 'Try again later'); } finally { setSending(false); }
  };
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Request to Host Event' }} />
      <Text style={styles.title}>Basic Request</Text>
      <Text style={styles.label}>Organization Name</Text>
      <Input value={org} onChangeText={setOrg} placeholder="Your organization" style={{ marginBottom: 8 }} />
      <Text style={styles.label}>Contact</Text>
      <Input value={name} onChangeText={setName} placeholder="Your name" style={{ marginBottom: 8 }} />
      <Input value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" style={{ marginBottom: 8 }} />
      <Text style={styles.label}>Venue</Text>
      <Input value={venue} onChangeText={setVenue} placeholder="Gym or field" style={{ marginBottom: 8 }} />
      <Text style={styles.label}>Proposed Dates</Text>
      <Textarea value={dates} onChangeText={setDates} placeholder="e.g., Oct 22 afternoon; Oct 29 morning" style={{ marginBottom: 12, minHeight: 80 }} />
      <Button onPress={onSubmit} disabled={sending}>{sending ? 'Sending…' : 'Submit Request'}</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  label: { fontWeight: '700', marginBottom: 4 },
});
