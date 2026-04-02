// GATED — restore when FOLLOWED TEAMS is ready to test
export { default } from '@/components/ComingSoon';
import { httpGet } from '@/api/http';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

interface FollowedTeam {
  id: string;
  name: string;
  description?: string;
}

function FollowedTeamsScreen() {
  const colorScheme = useColorScheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<FollowedTeam[]>([]);
  useEffect(() => {
    let mounted = true;
    void (async () => {
      setLoading(true); setError(null);
      try {
        const rows = await httpGet('/follows/teams?user_id=me') as FollowedTeam[];
        if (mounted) setItems(Array.isArray(rows) ? rows : []);
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Followed Teams', headerBackTitle: 'Back', headerShown: true }} />
      <View style={styles.content}>
        <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>Followed Teams</Text>
        {error ? <Text style={[styles.error, { color: Colors[colorScheme ?? 'light'].destructive }]}>{error}</Text> : null}
        {loading ? <Text style={[styles.muted, { color: Colors[colorScheme ?? 'light'].mutedText }]}>Loading…</Text> : (
          <FlatList
            data={items}
            keyExtractor={(it) => String(it.id)}
            renderItem={({ item }) => (
              <View style={[styles.row, { 
                backgroundColor: Colors[colorScheme ?? 'light'].card,
                borderColor: Colors[colorScheme ?? 'light'].border
              }]}>
                <Text style={[styles.rowTitle, { color: Colors[colorScheme ?? 'light'].text }]}>{item.name}</Text>
                <Text style={[styles.mutedSmall, { color: Colors[colorScheme ?? 'light'].mutedText }]}>{item.description || ''}</Text>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={<Text style={[styles.muted, { color: Colors[colorScheme ?? 'light'].mutedText }]}>No followed teams yet.</Text>}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 16, paddingTop: 24 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  error: { marginBottom: 8 },
  muted: { marginBottom: 8 },
  mutedSmall: { fontSize: 12 },
  row: { padding: 12, borderRadius: 12, borderWidth: 1 },
  rowTitle: { fontWeight: '600' },
});

