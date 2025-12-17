import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

export default function BlockedUsersScreen() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<any[]>([]);
  const [email, setEmail] = useState('');

  const loadBlocked = useCallback(async () => {
    setLoading(true);
    try {
      const res = await User.blockedUsers();
      setList(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load blocked users', err);
      Alert.alert('Error', 'Unable to load blocked users right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBlocked();
  }, [loadBlocked]);

  const add = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      Alert.alert('Invalid email', 'Enter the email of the person you want to block.');
      return;
    }
    try {
      setLoading(true);
      const match = await User.lookupByEmail(trimmed);
      if (!match?.id) {
        Alert.alert('User not found', 'No account matches that email.');
        return;
      }
      await User.block(match.id);
      setEmail('');
      await loadBlocked();
      Alert.alert('Blocked', `${match.display_name || trimmed} cannot message you.`);
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Unable to block user.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [email, loadBlocked]);

  const remove = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      await User.unblock(userId);
      await loadBlocked();
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Unable to unblock user.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [loadBlocked]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Blocked Users' }} />
      <Text style={styles.title}>Blocked Users</Text>
      <Text style={styles.subtitle}>People you won’t receive messages from.</Text>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <Input
          placeholder="user@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={{ flex: 1 }}
        />
        <Button onPress={add} disabled={loading || !email.trim()}>
          <Text>{loading ? '...' : 'Block'}</Text>
        </Button>
      </View>

      {loading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : list.length === 0 ? (
        <Text style={styles.muted}>No blocked users.</Text>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(user) => user.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View>
                <Text style={styles.email}>{item.display_name || item.email}</Text>
                <Text style={[styles.muted, { fontSize: 12 }]}>{item.email}</Text>
              </View>
              <Pressable onPress={() => remove(item.id)} style={styles.removeBtn}>
                <Text style={styles.removeText}>Unblock</Text>
              </Pressable>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  subtitle: { marginBottom: 8 },
  muted: {},
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  email: { fontWeight: '600' },
  removeBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  removeText: { color: 'white', fontWeight: '700' },
});
