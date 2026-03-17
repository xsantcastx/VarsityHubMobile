import { User } from '@/api/entities';
import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeGoBack } from '@/utils/navigation';

interface BlockedUser {
  id: string;
  email: string;
  display_name?: string;
}

export default function BlockedUsersScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const theme = Colors[colorScheme];
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<BlockedUser[]>([]);
  const [username, setUsername] = useState('');

  const loadBlocked = useCallback(async () => {
    setLoading(true);
    try {
      const res = await User.blockedUsers() as BlockedUser[];
      setList(Array.isArray(res) ? res : []);
    } catch (err) {
      if (__DEV__) console.error('Failed to load blocked users', err);
      Alert.alert('Error', 'Unable to load blocked users right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBlocked();
  }, [loadBlocked]);

  const add = useCallback(async () => {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert('Invalid username', 'Enter the username of the person you want to block.');
      return;
    }
    try {
      setLoading(true);
      const match = await User.lookupByUsername(trimmed);
      if (!match?.id) {
        Alert.alert('User not found', 'No account matches that username.');
        setLoading(false);
        return;
      }
      await User.block(match.id);
      setUsername('');
      await loadBlocked();
      Alert.alert('Blocked', `${match.display_name || trimmed} cannot message you.`);
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Unable to block user.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [username, loadBlocked]);

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
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Blocked Users', headerBackTitle: 'Back', headerShown: true, headerLeft: () => (
            <Pressable onPress={() => { safeGoBack(router); }} style={{ paddingRight: 8 }}>
              <MaterialIcons name="chevron-left" size={28} color="#007AFF" />
            </Pressable>
          ) }} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.title, { color: theme.text }]}>Blocked Users</Text>
        <Text style={[styles.subtitle, { color: theme.mutedText }]}>People you won't receive messages from.</Text>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <Input
            placeholder="username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            style={{ flex: 1 }}
          />
          <Pressable
            onPress={add}
            disabled={loading || !username.trim()}
            style={[styles.blockBtn, { backgroundColor: theme.tint, opacity: loading || !username.trim() ? 0.6 : 1 }]}
          >
            <Text style={styles.blockBtnText}>{loading ? '...' : 'Block'}</Text>
          </Pressable>
        </View>

        {loading ? (
          <Text style={[styles.muted, { color: theme.mutedText }]}>Loading…</Text>
        ) : list.length === 0 ? (
          <Text style={[styles.muted, { color: theme.mutedText }]}>No blocked users.</Text>
        ) : (
          <FlatList
            data={list}
            keyExtractor={(user) => user.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={[styles.row, { 
                backgroundColor: isDark ? '#1F2937' : '#F9FAFB',
                borderColor: isDark ? '#374151' : '#E5E7EB'
              }]}>
                <View>
                  <Text style={[styles.email, { color: theme.text }]}>{item.display_name || item.username || 'User'}</Text>
                  {item.username ? <Text style={[styles.muted, { fontSize: 12, color: theme.mutedText }]}>@{item.username}</Text> : null}
                </View>
                <Pressable onPress={() => remove(item.id)} style={styles.removeBtn}>
                  <Text style={styles.removeText}>Unblock</Text>
                </Pressable>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingTop: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  subtitle: { marginBottom: 8 },
  muted: {},
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  email: { fontWeight: '600' },
  blockBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  blockBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  removeBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#DC2626' },
  removeText: { color: 'white', fontWeight: '700' },
});
