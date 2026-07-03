import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import Notifications from '@/utils/notifications';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Fan-only permissions screen — the final step of fan onboarding.
// Coaches never land here; they proceed through coach-application → step-3.
// This screen must only be reachable from the fan onboarding path.
export default function FanPermissions() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const palette = Colors[colorScheme];
  const router = useRouter();
  const { user, registerPushToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const didMount = useRef(false);

  // Guard: only fans who have completed onboarding should be on this screen.
  // If a coach somehow lands here (deep link, stale cache), redirect them.
  useEffect(() => {
    if (didMount.current) return;
    didMount.current = true;
    if (!user) {
      router.replace('/sign-in');
      return;
    }
    const role = user?.role ?? (user as any)?.preferences?.role ?? 'fan';
    if (role === 'coach') {
      router.replace('/onboarding/coach-application' as any);
    }
  }, [user, router]);

  const colors = {
    background: isDark ? '#0f172a' : '#FFFFFF',
    card: isDark ? '#1E293B' : '#F8FAFF',
    cardBorder: isDark ? '#334155' : '#DBEAFE',
    text: palette.text,
    textMuted: isDark ? '#9CA3AF' : '#6B7280',
    primary: isDark ? '#60A5FA' : '#2563EB',
    primaryMuted: isDark ? '#1E3A5F' : '#EFF6FF',
    skip: isDark ? '#6B7280' : '#9CA3AF',
  };

  const requestAndContinue = async () => {
    setLoading(true);
    try {
      // Notifications
      try {
        const { status: pushStatus } = await Notifications.getPermissionsAsync();
        if (pushStatus !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }
      } catch {
        // Non-fatal — never block navigation on permission failure
      }
      // Location
      try {
        const { status: locStatus } = await Location.getForegroundPermissionsAsync();
        if (locStatus !== 'granted') {
          await Location.requestForegroundPermissionsAsync();
        }
      } catch {
        // Non-fatal
      }
      // Register push token now that permission has been (potentially) granted
      registerPushToken().catch(() => {});
    } finally {
      setLoading(false);
      // nav-safe: onboarding completion — linear flow; going BACK from here
      // returns to the step-2 form and re-runs completeOnboarding (signup
      // loop). The stack must be cleared into the app.
      router.replace('/(tabs)/feed');
    }
  };

  const skip = () => {
    registerPushToken().catch(() => {});
    // nav-safe: onboarding completion — same as requestAndContinue above
    router.replace('/(tabs)/feed');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.inner}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={[styles.emoji]}>🏟️</Text>
          <Text style={[styles.title, { color: colors.text }]}>Stay in the game</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Allow VarsityHub to send you timely updates so you never miss a moment.
          </Text>
        </View>

        {/* Permission cards */}
        <View style={styles.cards}>
          <PermissionCard
            icon="notifications"
            iconColor="#2563EB"
            bgColor={colors.primaryMuted}
            borderColor={colors.cardBorder}
            cardBg={colors.card}
            title="Game & Team Notifications"
            description="Get real-time alerts for scores, roster updates, event reminders, and coach announcements."
            textColor={colors.text}
            mutedColor={colors.textMuted}
            isDark={isDark}
          />
          <PermissionCard
            icon="location"
            iconColor="#16A34A"
            bgColor={isDark ? '#052E16' : '#F0FDF4'}
            borderColor={isDark ? '#166534' : '#BBF7D0'}
            cardBg={colors.card}
            title="Nearby Games & Events"
            description="Discover local games, tryouts, and events happening near you."
            textColor={colors.text}
            mutedColor={colors.textMuted}
            isDark={isDark}
          />
        </View>

        {/* Fan-only callout */}
        <View
          style={[
            styles.fanNote,
            {
              backgroundColor: isDark ? '#1C1917' : '#FFFBEB',
              borderColor: isDark ? '#92400E' : '#FDE68A',
            },
          ]}
        >
          <Ionicons name="shield-checkmark" size={16} color="#D97706" />
          <Text style={[styles.fanNoteText, { color: isDark ? '#FCD34D' : '#92400E' }]}>
            Fan accounts have full read access. Apply for a coach account in Settings any time.
          </Text>
        </View>
      </View>

      {/* Footer actions */}
      <View style={[styles.footer, { borderTopColor: isDark ? '#334155' : '#E5E7EB' }]}>
        <Pressable
          onPress={requestAndContinue}
          disabled={loading}
          style={[
            styles.primaryBtn,
            { backgroundColor: loading ? colors.primaryMuted : colors.primary },
          ]}
          accessibilityLabel="Enable notifications and location"
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Enable &amp; Continue</Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={skip}
          style={styles.skipBtn}
          accessibilityLabel="Skip permissions for now"
          accessibilityRole="button"
        >
          <Text style={[styles.skipBtnText, { color: colors.skip }]}>Skip for now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function PermissionCard({
  icon,
  iconColor,
  bgColor,
  borderColor,
  cardBg,
  title,
  description,
  textColor,
  mutedColor,
  isDark,
}: {
  icon: string;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  cardBg: string;
  title: string;
  description: string;
  textColor: string;
  mutedColor: string;
  isDark: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor,
          ...(Platform.OS === 'web'
            ? { boxShadow: '0px 1px 4px rgba(0,0,0,0.06)' }
            : {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isDark ? 0.3 : 0.06,
                shadowRadius: 4,
                elevation: 2,
              }),
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: bgColor }]}>
        <Ionicons name={icon as any} size={24} color={iconColor} />
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: textColor }]}>{title}</Text>
        <Text style={[styles.cardDesc, { color: mutedColor }]}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  emoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  cards: {
    gap: 12,
    marginBottom: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
  fanNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  fanNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 8 : 20,
    borderTopWidth: 1,
    gap: 12,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipBtnText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
