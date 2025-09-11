import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
// @ts-ignore
import { Team, User } from '@/api/entities';

export default function CreateTeamScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!name.trim()) { Alert.alert('Team name is required'); return; }
    setSubmitting(true);
    try {
      try { await User.me(); } catch { Alert.alert('Sign in required', 'Please sign in to create a team.'); setSubmitting(false); return; }
      const t = await Team.create({ name: name.trim(), description: description.trim() || undefined });
      Alert.alert('Created', 'Team created successfully.');
      router.replace(`/team-profile?id=${t.id}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create team');
    } finally { setSubmitting(false); }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Create Team' }} />
      <Text style={styles.title}>Create Team</Text>
      <Text style={styles.subtitle}>Start by choosing a team name.</Text>
      <Text style={styles.label}>Team Name</Text>
      <Input value={name} onChangeText={setName} placeholder="e.g. Springfield Eagles" style={{ marginBottom: 8 }} />
      <Text style={styles.label}>Description (optional)</Text>
      <Input value={description} onChangeText={setDescription} placeholder="What is this team about?" style={{ marginBottom: 12 }} />
      <Button onPress={onSubmit} disabled={submitting}>{submitting ? <ActivityIndicator color="#fff" /> : 'Create'}</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#6b7280', marginBottom: 8 },
  label: { fontWeight: '700', marginBottom: 4 },
});
