import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ResetPasswordScreen() {
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
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Reset Password' }} />
      <Text style={styles.title}>Reset Password</Text>
      <Input placeholder="New password" value={password} onChangeText={setPassword} secureTextEntry style={{ marginBottom: 8 }} />
      <Input placeholder="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry style={{ marginBottom: 12 }} />
      <Button onPress={onSave} disabled={saving}>{saving ? 'Saving…' : 'Update Password'}</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
});

