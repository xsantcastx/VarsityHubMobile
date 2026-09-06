import { Team } from '@/api/entities';
import { Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';

interface FollowedTeam {
  id: string;
  name: string;
  description?: string;
}

function FollowedTeamsScreen() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  // react-query owns the fetch: revisiting the screen shows the cached list
  // instantly and revalidates in the background. Spinner gated on isPending
  // (no cached data yet), never on background refetches.
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['followed-teams', user?.id ?? null],
    enabled: Boolean(user?.id),
    queryFn: () => Team.followed() as Promise<FollowedTeam[]>,
  });
  const items = Array.isArray(data) ? data : [];
  const loading = isPending;
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}
      edges={['bottom']}
    >
      <Stack.Screen
        options={{ title: 'Followed Teams', headerBackTitle: 'Back', headerShown: true }}
      />
      <View style={styles.content}>
        <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>
          Followed Teams
        </Text>
        {isError ? (
          <View style={styles.error}>
            <Text style={{ color: Colors[colorScheme ?? 'light'].destructive }}>
              Unable to load followed teams. Please try again.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry followed teams"
              onPress={() => void refetch()}
              style={styles.retry}
            >
              <Text style={{ color: Colors[colorScheme ?? 'light'].tint, fontWeight: '600' }}>
                Retry
              </Text>
            </Pressable>
          </View>
        ) : null}
        {loading ? (
          <Text style={[styles.muted, { color: Colors[colorScheme ?? 'light'].mutedText }]}>
            Loading…
          </Text>
        ) : (
          <FlatList
            data={items}
            keyExtractor={it => String(it.id)}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.row,
                  {
                    backgroundColor: Colors[colorScheme ?? 'light'].card,
                    borderColor: Colors[colorScheme ?? 'light'].border,
                  },
                ]}
              >
                <Text style={[styles.rowTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                  {item.name}
                </Text>
                <Text
                  style={[styles.mutedSmall, { color: Colors[colorScheme ?? 'light'].mutedText }]}
                >
                  {item.description || ''}
                </Text>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={
              isError ? null : (
                <Text style={[styles.muted, { color: Colors[colorScheme ?? 'light'].mutedText }]}>
                  No followed teams yet.
                </Text>
              )
            }
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
  retry: { alignSelf: 'flex-start', paddingVertical: 12, paddingRight: 16 },
  muted: { marginBottom: 8 },
  mutedSmall: { fontSize: 12 },
  row: { padding: 12, borderRadius: 12, borderWidth: 1 },
  rowTitle: { fontWeight: '600' },
});

export default FollowedTeamsScreen;
