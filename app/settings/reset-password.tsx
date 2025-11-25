import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ResetPasswordScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const p = password.trim();
    if (p.length < 8) { Alert.alert('Password too short', 'Use at least 8 characters.'); return; }
    if (p !== confirm.trim()) { Alert.alert('Passwords do not match'); return; }
    setSaving(true);
    try {
      // TODO: wire to backend change-password endpoint when available
      Alert.alert('Request sent', 'We will update your password shortly.');
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Reset Password', headerBackTitle: 'Back' }} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.label, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>New Password</Text>
        <Input placeholder="At least 8 characters" value={password} onChangeText={setPassword} secureTextEntry style={{ marginBottom: 16 }} />
        <Text style={[styles.label, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Confirm Password</Text>
        <Input placeholder="Re-enter your password" value={confirm} onChangeText={setConfirm} secureTextEntry style={{ marginBottom: 24 }} />
        <Button onPress={onSave} disabled={saving}>{saving ? 'Saving…' : 'Update Password'}</Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingTop: 24 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
});

