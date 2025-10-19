import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { Team as TeamApi, User } from '@/api/entities';

export default function AdminTeamsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      await User.me();
      const list = await TeamApi.list('', false); // Explicitly pass false for mine parameter to get all teams
      setTeams(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.status === 403 ? 'Access denied (admin only).' : (e?.message || 'Failed to load teams'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Admin · All Teams' }} />
      {loading ? <View style={{ padding: 24, alignItems: 'center' }}><ActivityIndicator /></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && (
        <FlatList
          data={teams}
          keyExtractor={(t) => String(t.id)}
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: Colors[colorScheme].card, borderColor: Colors[colorScheme].border }]}>
              <Text style={[styles.title, { color: Colors[colorScheme].text }]}>{item.name}</Text>
              {item.description ? <Text style={[styles.meta, { color: Colors[colorScheme].mutedText }]}>{item.description}</Text> : null}
              <Text style={[styles.meta, { color: Colors[colorScheme].mutedText }]}>Members: {item.members}</Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  title: { fontWeight: '800', fontSize: 16 },
  meta: { color: '#6b7280' },
  error: { color: '#b91c1c', padding: 12 },
});

