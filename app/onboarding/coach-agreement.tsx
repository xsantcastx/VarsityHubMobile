import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { getCoachAgreementRouteDecision } from '@/utils/appRouteDecisions';
import { safeGoBack } from '@/utils/navigation';
import { getFreshAuthSnapshot } from '@/utils/authState';
import type { CoachUserLike } from '@/utils/roleChecks';
// @ts-ignore
import { User } from '@/api/entities';

const AGREEMENT_POINTS = [
  'No broadcast footage or copyrighted content. All uploads must be original.',
  'Athlete content may involve NIL rights. Follow your school\'s media policies.',
  'You are responsible for your team\'s compliance with school and conference policies.',
  'You agree to VarsityHub\'s Terms of Service and Community Guidelines.',
];

function CoachAgreementScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const C = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { checkAuth, user } = useAuth();
  const params = useLocalSearchParams<{ redirect?: string; reason?: string }>();
  const [accepting, setAccepting] = useState(false);
  const isOutdatedAgreement = params.reason === 'outdated';

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await User.updatePreferences({
        coach_agreement_accepted_at: new Date().toISOString(),
      });
      // Sync auth state and route from the canonical refreshed payload.
      const freshUser = (await checkAuth()) as CoachUserLike | null;
      const decision = freshUser
        ? getCoachAgreementRouteDecision(freshUser, params.redirect)
        : { route: '/onboarding/step-3-league', params: undefined };
      if (decision.params) {
        router.replace({ pathname: decision.route, params: decision.params } as never);
      } else {
        router.replace(decision.route as never);
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      Alert.alert('Error', err?.message || 'Failed to accept agreement. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B1120' : '#F8FAFC' }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.headerRow, { borderBottomColor: C.border }]}>
        <Pressable
          onPress={() => safeGoBack(router)}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
        >
          <MaterialIcons name="chevron-left" size={28} color={C.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: C.text }]}>Coach Agreement</Text>
        <Text style={[styles.subtitle, { color: C.mutedText }]}>
          {isOutdatedAgreement
            ? 'The coach agreement has been updated. Review and accept the latest version to keep using coach tools.'
            : 'Before accessing your coach tools, please review and accept the following terms.'}
        </Text>

        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.cardTitle, { color: C.text }]}>
            As an approved coach on VarsityHub, you agree that:
          </Text>
          {AGREEMENT_POINTS.map((point, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.bullet, { color: C.tint }]}>{i + 1}.</Text>
              <Text style={[styles.bulletText, { color: C.mutedText }]}>{point}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.disclaimer, { color: C.mutedText }]}>
          By tapping "I Accept" below, you acknowledge that you have read and agree to these terms. Your acceptance is logged with a timestamp.
        </Text>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: C.border }]}>
        <Pressable
          style={[styles.acceptButton, { backgroundColor: C.tint }]}
          onPress={handleAccept}
          disabled={accepting}
        >
          {accepting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.acceptText}>I Accept</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  backButton: { padding: 8 },
  scroll: { padding: 20, paddingBottom: 32 },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    marginBottom: 20,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bullet: { fontSize: 14, fontWeight: '700', width: 20 },
  bulletText: { fontSize: 14, lineHeight: 20, flex: 1 },
  disclaimer: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  acceptButton: {
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  acceptText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});

export default CoachAgreementScreen;
