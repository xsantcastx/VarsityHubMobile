import settingsStore, { SETTINGS_KEYS } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

export default function BlockedUsersScreen() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<string[]>([]);
  const [email, setEmail] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const arr = await settingsStore.getJson<string[]>(SETTINGS_KEYS.BLOCKED_USERS, []);
      if (!mounted) return;
      setList(Array.isArray(arr) ? arr : []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const save = async (arr: string[]) => {
    setList(arr);
    await settingsStore.setJson(SETTINGS_KEYS.BLOCKED_USERS, arr);
  };

  const add = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes('@')) { Alert.alert('Enter a valid email'); return; }
    if (list.includes(e)) { setEmail(''); return; }
    await save([e, ...list]);
    setEmail('');
  };

  const remove = async (e: string) => {
    await save(list.filter(x => x !== e));
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Blocked Users' }} />
      <Text style={styles.title}>Blocked Users</Text>
      <Text style={styles.subtitle}>People you won’t receive messages from.</Text>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <Input placeholder="user@example.com" value={email} onChangeText={setEmail} style={{ flex: 1 }} />
  <Button onPress={add}><Text>Add</Text></Button>
      </View>

      {loading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : list.length === 0 ? (
        <Text style={styles.muted}>No blocked users.</Text>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(e) => e}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.email}>{item}</Text>
              <Pressable onPress={() => remove(item)} style={styles.removeBtn}><Text style={styles.removeText}>Remove</Text></Pressable>
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
