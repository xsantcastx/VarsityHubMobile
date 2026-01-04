import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
// @ts-ignore
import { Organization, Team } from '@/api/entities';
import { useAuth } from '@/context/AuthProvider';

export default function OrganizationTeamScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load current org/team info if available
    const org = (user as any)?.organization;
    const team = (user as any)?.team;
    if (org) setOrgName(org.name || '');
    if (team) setTeamName(team.name || '');
  }, [user]);

  const onSave = async () => {
    setSaving(true);
    try {
      const org = (user as any)?.organization;
      const team = (user as any)?.team;
      if (orgName && org?.id) {
        await (Organization as any).update(org.id, { name: orgName });
      }
      if (teamName && team?.id) {
        await (Team as any).update(team.id, { name: teamName });
      }
      Alert.alert('Saved', 'Organization and team details updated.');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        title: 'Organization & Team',
        headerLeft: () => (
          <Pressable onPress={() => router.back()} style={{ paddingLeft: 8 }}>
            <Ionicons name="chevron-back" size={24} color="#3B82F6" />
          </Pressable>
        ),
      }} />
      <Text style={styles.title}>Edit Organization & Team</Text>
      <Text style={styles.label}>Organization Name</Text>
      <TextInput
        style={styles.input}
        value={orgName}
        onChangeText={setOrgName}
        placeholder="Enter organization name"
      />
      <Text style={styles.label}>Team Name</Text>
      <TextInput
        style={styles.input}
        value={teamName}
        onChangeText={setTeamName}
        placeholder="Enter team name"
      />
      <Pressable style={styles.saveButton} onPress={onSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 15, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, height: 44, fontSize: 16 },
  saveButton: { backgroundColor: '#2563EB', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 32 },
  saveButtonText: { color: 'white', fontWeight: '800', fontSize: 16 },
});
