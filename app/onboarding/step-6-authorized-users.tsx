import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PrimaryButton from '@/ui/PrimaryButton';
import { Type } from '@/ui/tokens';
// @ts-ignore
import { User, TeamMemberships, TeamInvites } from '@/api/entities';
import { useOnboarding } from '@/context/OnboardingContext';

type Role = 'Team Manager' | 'Coach' | 'Admin';

export default function Step6AuthorizedUsers() {
  const router = useRouter();
  const { state: ob } = useOnboarding();
  const [email, setEmail] = useState('');
  const [assignTeam, setAssignTeam] = useState('');
  const [role, setRole] = useState<Role>('Team Manager');
  const [list, setList] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);

  const addUser = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes('@')) { Alert.alert('Enter a valid email'); return; }
    const team_id = ob.team_id;
    if (!team_id) { Alert.alert('Missing team', 'Create your league first.'); return; }
    setAdding(true);
    try {
      try {
        const u: any = await User.lookupByEmail(e);
        await TeamMemberships.create({ team_id, user_id: u.id, role });
        setList([{ type: 'member', email: u.email, role }, ...list]);
      } catch (_err: any) {
        await TeamInvites.create({ team_id, email: e, role });
        setList([{ type: 'invite', email: e, role }, ...list]);
      }
      setEmail(''); setAssignTeam('');
    } catch (e: any) {
      Alert.alert('Failed to add', e?.message || 'Try again later');
    } finally { setAdding(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Step 6/10' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <Text style={styles.title}>Add Authorized Users</Text>
        {ob.team_id ? (
          <View style={styles.createdChip}><Text style={styles.createdChipText}>✓ League created</Text></View>
        ) : null}
        <Text style={styles.label}>Email</Text>
        <Input value={email} onChangeText={setEmail} placeholder="coach@example.com" autoCapitalize="none" keyboardType="email-address" style={{ marginBottom: 8 }} />
        <Text style={styles.label}>Assign Team (optional)</Text>
        <Input value={assignTeam} onChangeText={setAssignTeam} placeholder="e.g., 10U Tigers" style={{ marginBottom: 8 }} />
        <Text style={styles.label}>Role</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {(['Team Manager','Coach','Admin'] as Role[]).map(r => (
            <Button key={r} variant={role===r?'default':'outline'} onPress={() => setRole(r)}>{r}</Button>
          ))}
        </View>
        <Button onPress={addUser} disabled={adding}>{adding ? 'Adding…' : 'Add User'}</Button>
        <View style={{ height: 12 }} />
        {list.length > 0 && <Text style={styles.subtitle}>Added</Text>}
        {list.map((it, idx) => (
          <View key={idx} style={[styles.row, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            <View>
              <Text style={styles.rowTitle}>{it.email}</Text>
              <Text style={styles.mutedSmall}>{it.type === 'invite' ? 'Invited' : it.role}</Text>
            </View>
            <Button variant="outline" onPress={() => setList((arr) => arr.filter((_, i) => i !== idx))}>Remove</Button>
          </View>
        ))}
        <View style={{ height: 16 }} />
        <PrimaryButton label="Continue" onPress={() => { if (list.length === 0) { Alert.alert('No users added', 'You can add authorized users later in team settings.', [ { text: 'Cancel', style: 'cancel' }, { text: 'Continue', onPress: () => router.push('/onboarding/step-7-profile') } ]); } else { router.push('/onboarding/step-7-profile'); } }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  title: { ...(Type.h1 as any), marginBottom: 12, textAlign: 'center' },
  label: { fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#6b7280', marginBottom: 8 },
  row: { padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', marginBottom: 8 },
  rowTitle: { fontWeight: '700' },
  mutedSmall: { color: '#9CA3AF', fontSize: 12 },
  createdChip: { alignSelf: 'center', backgroundColor: '#DCFCE7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#BBF7D0' },
  createdChipText: { color: '#166534', fontWeight: '700' },
});
