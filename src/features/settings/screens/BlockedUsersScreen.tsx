import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

export default function BlockedUsersScreen() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<any[]>([]);
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadBlocked = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await User.blockedUsers();
      setList(Array.isArray(res) ? res : []);
    } catch (err) {
      setError('Unable to load blocked users right now.');
      console.error('Failed to load blocked users', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBlocked();
  }, [loadBlocked]);

  const add = useCallback(async () => {
    const trimmed = identifier.trim();
    if (!trimmed) {
      setError('Enter the username or email of the person you want to block.');
      return;
    }
    setError(null);
    try {
      setLoading(true);
      const match = await User.lookupByIdentifier(trimmed);
      if (!match?.id) {
        setError('No account matches that username or email.');
        return;
      }
      await User.block(match.id);
      setIdentifier('');
      await loadBlocked();
      Alert.alert('Blocked', `${match.display_name || match.username || trimmed} cannot message you.`);
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Unable to block user.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [identifier, loadBlocked]);

  const remove = useCallback(async (userId: string) => {
    setError(null);
    try {
      setLoading(true);
      await User.unblock(userId);
      await loadBlocked();
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Unable to unblock user.';
      setError(message);
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
          placeholder="username or email"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          keyboardType="default"
          style={{ flex: 1 }}
        />
        <Button onPress={add} disabled={loading || !identifier.trim()}>
          <Text>{loading ? '...' : 'Block'}</Text>
        </Button>
      </View>

      {error ? (
        <Text style={[styles.muted, { color: '#DC2626', marginBottom: 8 }]}>{error}</Text>
      ) : null}

      {loading ? (
        <ActivityIndicator size="small" color="#888" style={{ marginVertical: 12 }} />
      ) : list.length === 0 ? (
        <Text style={styles.muted}>No blocked users.</Text>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(user) => user.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View>
                <Text style={styles.email}>{item.display_name || item.username || item.email}</Text>
                <Text style={[styles.muted, { fontSize: 12 }]}>{item.username ? `@${item.username}` : item.email}</Text>
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
