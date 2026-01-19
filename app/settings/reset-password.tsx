import auth from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/context/AuthProvider';
import { Colors } from '@/constants/Colors';

export default function ResetPasswordScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { refresh: refreshUser } = useUser(false);
  const { checkAuth } = useAuth();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const currentValue = current.trim();
    const p = password.trim();
    if (!currentValue.length) { Alert.alert('Enter your current password.'); return; }
    if (p.length < 8) { Alert.alert('Password too short', 'Use at least 8 characters.'); return; }
    if (p !== confirm.trim()) { Alert.alert('Passwords do not match'); return; }
    setSaving(true);
    try {
      console.log('[reset-password] Changing password...');
      await auth.changePassword(currentValue, p);
      console.log('[reset-password] Password changed successfully');
      
      // Refresh user data in both useUser hook and AuthProvider
      await Promise.all([
        refreshUser().catch(() => {}), // Refresh useUser hook
        checkAuth().catch(() => {}), // Refresh AuthProvider state
      ]);
      console.log('[reset-password] User data refreshed in all contexts');
      
      Alert.alert('Password updated', 'Your password has been changed. A confirmation email has been sent to your account.');
      setCurrent('');
      setPassword('');
      setConfirm('');
    } catch (err: any) {
      console.error('[reset-password] Password change failed:', err);
      const message = err?.message || err?.data?.error || 'Unable to update password.';
      Alert.alert('Unable to update password', message);
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Change Password', headerBackTitle: 'Back', headerShown: true }} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.label, { color: Colors[colorScheme ?? 'light'].mutedText }]}>Current Password</Text>
        <Input placeholder="Enter current password" value={current} onChangeText={setCurrent} secureTextEntry style={{ marginBottom: 16 }} />
        <Text style={[styles.label, { color: Colors[colorScheme ?? 'light'].mutedText }]}>New Password</Text>
        <Input placeholder="At least 8 characters" value={password} onChangeText={setPassword} secureTextEntry style={{ marginBottom: 16 }} />
        <Text style={[styles.label, { color: Colors[colorScheme ?? 'light'].mutedText }]}>Confirm Password</Text>
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
