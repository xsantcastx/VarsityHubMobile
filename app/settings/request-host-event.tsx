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

export default function RequestHostEventScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { displayName, email: profileEmail, loading: userLoading } = useUserProfile();
  const [name, setName] = useState(displayName);
  const [emailField, setEmail] = useState(profileEmail);
  const [org, setOrg] = useState('');
  const [venue, setVenue] = useState('');
  const [dates, setDates] = useState('');
  const [sending, setSending] = useState(false);

  // Update local state when user profile loads
  useEffect(() => {
    if (displayName && !name) setName(displayName);
    if (profileEmail && !emailField) setEmail(profileEmail);
  }, [displayName, profileEmail]);
  const onSubmit = async () => {
    if (!org.trim()) { Alert.alert('Enter organization name'); return; }
    setSending(true);
    try {
      await Support.contact({ name: name || 'Unknown', email: emailField || 'unknown@example.com', subject: 'Request to Host Event', message: `Org: ${org}\nVenue: ${venue}\nProposed dates: ${dates}` });
      Alert.alert('Sent', 'We received your request.');
      router.back();
    } catch (e: any) { Alert.alert('Failed to send', e?.message || 'Try again later'); } finally { setSending(false); }
  };
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Request to Host Event', headerBackTitle: 'Back', headerShown: true }} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.title, { color: isDark ? '#ECEDEE' : '#11181C' }]}>Basic Request</Text>
        <Text style={[styles.label, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Organization Name</Text>
        <Input value={org} onChangeText={setOrg} placeholder="Your organization" style={{ marginBottom: 8 }} />
        <Text style={[styles.label, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Contact</Text>
        <Input value={name} onChangeText={setName} placeholder="Your name" style={{ marginBottom: 8 }} />
        <Input value={emailField} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" style={{ marginBottom: 8 }} />
        <Text style={[styles.label, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Venue</Text>
        <Input value={venue} onChangeText={setVenue} placeholder="Gym or field" style={{ marginBottom: 8 }} />
        <Text style={[styles.label, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Proposed Dates</Text>
        <Textarea value={dates} onChangeText={setDates} placeholder="e.g., Oct 22 afternoon; Oct 29 morning" style={{ marginBottom: 12, minHeight: 80 }} />
        <Button onPress={onSubmit} disabled={sending}>{sending ? 'Sending…' : 'Submit Request'}</Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingTop: 24 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  label: { fontWeight: '700', marginBottom: 4 },
});
