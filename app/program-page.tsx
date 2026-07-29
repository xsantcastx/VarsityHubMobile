import { useProgramScreenSummary } from '@/hooks/useProgramScreenSummary';
import { Colors } from '@/constants/Colors';
import { buildProgramSubTeams } from '@/constants/programs';
import { useCustomColorScheme } from '@/hooks/useCustomColorScheme';
import { replaceAsRedirect, safeGoBack } from '@/utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ProgramLevel = {
  level: string | null;
  team: Record<string, any>;
  games: Record<string, any>[];
};

/**
 * program-page is a thin redirect shim (Phase 2, owner July-28: ONE sport page).
 *
 * The canonical sport surface is `team-page` — its Events tab renders the
 * sub-team picker (Boys Varsity, Girls JV, …) for the whole sport. A program is
 * therefore opened by redirecting to its level/gender-first sub-team's team-page
 * (Boys Varsity first). The org links sports straight to team-page now, so this
 * shim is reached only by older `/programs/:id` deep links. It keeps NO rendering
 * surface of its own — that was the duplicate the owner's no-duplicates rule bans.
 */
function ProgramRedirectScreen() {
  const colorScheme = useCustomColorScheme();
  const theme = Colors[colorScheme];
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const programId = params.id?.trim() || undefined;

  const query = useProgramScreenSummary(programId);
  const data = query.data;

  const subTeams = useMemo(
    () => buildProgramSubTeams((data?.levels ?? []) as ProgramLevel[]),
    [data?.levels]
  );

  const redirectedRef = useRef(false);
  useEffect(() => {
    if (redirectedRef.current) return;
    const target = subTeams[0];
    if (!target?.teamId) return;
    const targetName =
      ((data?.levels ?? []) as ProgramLevel[]).find(
        l => String(l?.team?.id) === String(target.teamId)
      )?.team?.name ?? '';
    redirectedRef.current = true;
    replaceAsRedirect(router, {
      pathname: '/team-page',
      params: { id: String(target.teamId), name: targetName, from: 'program' },
    } as any); // nav-safe: program-page is retired — team-page is the ONE sport page (Phase 2); from=program marks a deliberate open (team-page no longer reverse-redirects)
  }, [subTeams, data, router]);

  // A program with no visible sub-teams (all private, or an unknown id) can't
  // redirect anywhere — show a graceful empty state instead of an endless spinner.
  const resolvedEmpty = !query.isPending && subTeams.length === 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {resolvedEmpty ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: theme.text }]}>
            This program isn’t available.
          </Text>
          <Pressable
            testID="program-page-back-button"
            onPress={() => safeGoBack(router, '/(tabs)/feed')}
            style={[styles.backButton, { borderColor: theme.border }]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={18} color={theme.text} />
            <Text style={[styles.backText, { color: theme.text }]}>Go back</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      )}
    </SafeAreaView>
  );
}

export default ProgramRedirectScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  emptyText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  backText: { fontSize: 15, fontWeight: '600' },
});
