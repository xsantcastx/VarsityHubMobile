import { User } from '@/api/entities';
import type { ActionItem } from '@/api/schemas/actionQueue';
import CoachAccessRedirecting from '@/components/CoachAccessRedirecting';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRequireTeamManagement } from '@/hooks/useRequireTeamManagement';
import { getCanonicalOrganizationId } from '@/utils/authState';
import { useQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

function ManageFooter({ user, theme, router }: any) {
  const orgId = getCanonicalOrganizationId(user);
  return (
    <View style={{ marginTop: 16 }}>
      {orgId ? (
        <Pressable onPress={() => router.push(`/organization?id=${orgId}&tab=overview` as any)}>
          <Text style={{ color: theme.tint }}>Manage league</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={() => router.push('/manage-teams' as any)}>
        <Text style={{ color: theme.tint }}>Manage teams</Text>
      </Pressable>
    </View>
  );
}

export default function TeamHubScreen() {
  const { user } = useAuth();
  const { canManage, loading } = useRequireTeamManagement();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['action-queue', (user as any)?.id],
    queryFn: () => User.actionQueue(),
    enabled: canManage && !loading,
  });

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  if (!canManage) {
    return (
      <CoachAccessRedirecting
        backgroundColor={theme.background}
        spinnerColor={theme.tint}
        textColor={theme.mutedText}
      />
    );
  }

  if (isPending) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={[styles.title, { color: theme.text }]}>Couldn&apos;t load your queue</Text>
        <Pressable onPress={() => refetch()} style={{ marginTop: 12 }}>
          <Text style={{ color: theme.tint }}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (!data || data.total === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={[styles.title, { color: theme.text }]}>You&apos;re all caught up</Text>
        <Text style={[styles.subtitle, { color: theme.mutedText }]}>
          Nothing needs your approval right now.
        </Text>
        <ManageFooter user={user} theme={theme} router={router} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={[styles.title, { color: theme.text }]}>Needs your attention</Text>
      <FlatList
        data={data.items}
        keyExtractor={(item: ActionItem) => `${item.kind}-${item.id}`}
        renderItem={({ item }: { item: ActionItem }) => (
          <Pressable style={styles.row} onPress={() => router.push(item.route as any)}>
            <Text style={[styles.rowTitle, { color: theme.text }]}>{item.title}</Text>
            <Text style={[styles.rowSubtitle, { color: theme.mutedText }]}>{item.subtitle}</Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListFooterComponent={<ManageFooter user={user} theme={theme} router={router} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  container: { flex: 1, padding: 16, paddingTop: 24 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 16 },
  row: { paddingVertical: 12 },
  rowTitle: { fontWeight: '600', fontSize: 15 },
  rowSubtitle: { fontSize: 13, marginTop: 2 },
});
