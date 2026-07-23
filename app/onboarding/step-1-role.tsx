import { useAuth } from '@/context/AuthProvider';
import { useOnboarding } from '@/context/OnboardingContext';
import { getPostAuthRouteDecision } from '@/utils/appRouteDecisions';
import { getFreshAuthSnapshot, isOnboardingCompleteSnapshot } from '@/utils/authState';
import { GUEST_HOME_ROUTE } from '@/utils/publicRoutes';
import { getCanonicalCoachRole } from '@/utils/roleChecks';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import OnboardingLayout from './components/OnboardingLayout';

type UserRole = 'fan' | 'coach';

function RoleCard({
  title,
  description,
  icon,
  selected,
  onPress,
  features,
  onContinue,
  saving,
  roleType,
}: {
  title: string;
  description: string;
  icon: string;
  selected?: boolean;
  onPress: () => void;
  features: string[];
  onContinue?: () => void;
  saving?: boolean;
  roleType?: 'fan' | 'coach';
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const theme = Colors[colorScheme];

  // Silver for Fan, gold for Coach
  const isFan = roleType === 'fan';
  const accentColor = isFan ? '#9CA3AF' : '#FFD700'; // Silver vs gold
  const accentColorLight = isFan ? '#D1D5DB' : '#FFF44F'; // Light silver vs light gold
  const buttonBg = isFan ? '#6B7280' : '#DAA520'; // Dark silver vs goldenrod

  const colors = {
    cardBg: selected ? theme.card : theme.surface,
    cardBorder: isDark
      ? selected
        ? accentColorLight
        : '#374151' // audit: intentional border color, not text color
      : selected
        ? accentColor
        : '#D1D5DB',
    iconColor: isDark
      ? selected
        ? accentColorLight
        : '#9CA3AF'
      : selected
        ? accentColor
        : '#6B7280',
    titleColor: theme.text,
    descColor: isDark ? '#9CA3AF' : '#6B7280',
    featureText: isDark ? '#D1D5DB' : theme.text,
    buttonBg: buttonBg,
  };

  return (
    <View style={styles.cardWrapper}>
      <Pressable
        testID={`onboarding-role-${roleType}-card`}
        onPress={onPress}
        accessibilityLabel={`Select ${title} role`}
        accessibilityRole="button"
        style={[
          styles.card,
          {
            backgroundColor: colors.cardBg,
            borderColor: colors.cardBorder,
          },
          selected && styles.cardSelected,
          selected && styles.cardWithButton,
        ]}
      >
        <View style={styles.cardHeader}>
          <Ionicons name={icon as any} size={36} color={colors.iconColor} />
          <View style={styles.cardTitleContainer}>
            <Text style={[styles.cardTitle, { color: colors.titleColor }]}>{title}</Text>
            <Text style={[styles.cardDescription, { color: colors.descColor }]}>{description}</Text>
          </View>
          {selected && (
            <MaterialIcons
              name="check-circle"
              size={24}
              color={isDark ? accentColorLight : accentColor}
            />
          )}
        </View>

        <View style={styles.featuresList}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <MaterialIcons
                name="check-circle"
                size={18}
                color="#16A34A"
                style={styles.checkIcon}
              />
              <Text style={[styles.featureText, { color: colors.featureText }]}>{feature}</Text>
            </View>
          ))}
        </View>
      </Pressable>

      {selected && onContinue && (
        <Pressable
          testID="onboarding-step1-continue-button"
          onPress={onContinue}
          disabled={saving}
          style={[styles.sideButton, { backgroundColor: colors.buttonBg }]}
          accessibilityLabel="Continue"
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Text style={styles.sideButtonText}>Continue</Text>
              <MaterialIcons name="arrow-forward" size={20} color="white" />
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

export default function Step1Role() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user, signOut, checkAuth } = useAuth();
  const {
    state: ob,
    setState: setOB,
    setProgress,
    clearOnboarding: _clearOnboarding,
    dispatch,
    canNavigate,
  } = useOnboarding();
  const [role, setRole] = useState<UserRole | null>(null);
  const [saving, setSaving] = useState(false);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [confirmedCoachAge, setConfirmedCoachAge] = useState(false);

  // CRITICAL: Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      if (__DEV__) console.warn('[Step1Role] Unauthenticated user - redirecting to sign-in');
      router.replace('/sign-in');
    }
  }, [user, router]);

  // Sync local role state from onboarding context (reactive, no server calls)
  useEffect(() => {
    if (ob.role) {
      setRole(ob.role);
    }
  }, [ob.role]);

  // Bootstrap the local role draft from the canonical auth snapshot.
  useEffect(() => {
    if (ob.role || !user) return;
    const canonicalRole = getCanonicalCoachRole(user as any);
    if (canonicalRole === 'fan' || canonicalRole === 'coach') {
      setRole(canonicalRole);
      setOB(prev => ({ ...prev, role: canonicalRole }));
    }
  }, [ob.role, setOB, user]);

  useEffect(() => {
    setEmailVerified(user?.email_verified ?? null);
  }, [user?.email_verified]);

  // Reset coach age confirmation when switching away from coach
  useEffect(() => {
    if (role !== 'coach') {
      setConfirmedCoachAge(false);
    }
  }, [role]);

  const onContinue = async () => {
    if (!role) return;
    if (role === 'coach' && !confirmedCoachAge) return;

    // Prevent double-tap race condition
    if (!canNavigate || saving) {
      if (__DEV__) console.warn('[STEP-1] Navigation blocked - saving or already navigating');
      return;
    }

    setSaving(true);
    dispatch({ type: 'SAVE_START' });

    try {
      // Only clear state when SWITCHING from fan to coach (not when continuing as coach)
      // This prevents losing progress for returning coaches
      const wasCoachBefore = ob.role === 'coach';

      if (role === 'coach' && !wasCoachBefore) {
        // Switching TO coach - clear only coach-specific fields, preserve shared data (username, dob, zip)
        if (__DEV__)
          console.warn('[COACH ONBOARDING] 🔄 SWITCHING TO COACH - clearing coach-specific fields');
        const preserved = {
          username: ob.username,
          dob: ob.dob,
          zip: ob.zip,
          zip_code: ob.zip_code,
        };
        dispatch({ type: 'INIT_FROM_PROFILE', profile: { ...preserved, role: 'coach' } });
        setOB({ ...preserved, role: 'coach' });
      } else if (role === 'coach') {
        // Already a coach - just continue where they left off
        if (__DEV__) console.warn('[COACH ONBOARDING] ✅ Continuing as coach (preserving state)');
        dispatch({ type: 'UPDATE_DRAFT', data: { role: 'coach' } });
        setOB(prev => ({ ...prev, role: 'coach' }));
      } else if (role === 'fan' && wasCoachBefore) {
        // Switching TO fan - clear coach-specific fields, preserve shared data
        if (__DEV__) console.warn('[FAN ONBOARDING] 🔄 Clearing coach-specific data');
        const preserved = {
          username: ob.username,
          dob: ob.dob,
          zip: ob.zip,
          zip_code: ob.zip_code,
        };
        dispatch({ type: 'INIT_FROM_PROFILE', profile: { ...preserved, role: 'fan' } });
        setOB({ ...preserved, role: 'fan' });
      } else {
        dispatch({ type: 'UPDATE_DRAFT', data: { role } });
        setOB(prev => ({ ...prev, role }));
      }

      // Fresh onboarding users must be allowed to choose "coach" before DOB exists.
      // The server's PATCH /me/preferences coach transition correctly requires DOB,
      // so step-1 keeps role selection local until step-2/step-3 commit the canonical
      // coach state. Only already-onboarded accounts should hit the server here for
      // upgrade/recovery flows.
      let freshServerUser: any | null = user ?? null;
      const persistRole = async (attempt = 1): Promise<void> => {
        try {
          if (!freshServerUser) {
            freshServerUser = await getFreshAuthSnapshot(checkAuth, user);
          }
          const serverRole = String(getCanonicalCoachRole(freshServerUser) || '').toLowerCase();
          const onboardingCompleted = isOnboardingCompleteSnapshot(freshServerUser);

          if (!onboardingCompleted) {
            return;
          }

          const shouldUseCoachUpgradeFlow =
            role === 'coach' && serverRole !== 'coach' && onboardingCompleted;

          // Users who already finished fan onboarding cannot elevate to coach
          // via PATCH /me/preferences. Route them through the dedicated
          // upgrade endpoint here instead of surfacing the generic save alert.
          if (shouldUseCoachUpgradeFlow) {
            await User.upgradeToCoach('rookie');
            freshServerUser = (await checkAuth().catch(() => null)) ?? freshServerUser;
            return;
          }
          await User.updatePreferences({ role });
          freshServerUser = (await checkAuth().catch(() => null)) ?? freshServerUser;
        } catch (error: any) {
          const isTransient =
            error?.status === 0 ||
            error?.status === 408 ||
            error?.status === 502 ||
            error?.status === 503 ||
            /network|timeout/i.test(String(error?.message || ''));
          if (isTransient && attempt < 2) {
            await new Promise(r => setTimeout(r, 1500));
            return persistRole(attempt + 1);
          }
          throw error;
        }
      };
      try {
        await persistRole();
      } catch (error: any) {
        if (__DEV__) console.warn('[Onboarding][Step1] failed to persist role to server', error);
        // v1.0.3: distinguish the "role change post-onboarding" rejection
        // (auth.ts:2195) from generic network failure. A user who completed
        // onboarding as one role and lands back on step-1 (deep link, back
        // nav, etc.) can't switch via PATCH /me/preferences — they'd need
        // the /auth/upgrade-to-coach endpoint. Show them that path instead
        // of a vague "could not save" alert.
        const errMsg = String(error?.data?.error || error?.message || '').toLowerCase();
        const isRoleChangeBlocked = error?.status === 403 && errMsg.includes('cannot change role');
        if (isRoleChangeBlocked) {
          const freshUser: any = freshServerUser ?? (await checkAuth().catch(() => null)) ?? user;
          const recoveryRoute = getPostAuthRouteDecision(freshUser).route;
          if (recoveryRoute && recoveryRoute !== '/onboarding/step-1-role') {
            const canonicalRole = getCanonicalCoachRole(freshUser);
            if (canonicalRole === 'coach') {
              setOB(prev => ({ ...prev, role: 'coach' }));
            }
            dispatch({ type: 'SAVE_FAIL', error: error as Error });
            router.replace(recoveryRoute as any);
            return;
          }

          Alert.alert(
            'Role already set',
            'Your account role is locked after onboarding. To change from fan to coach, use the "Upgrade to Coach" option in Settings. Contact support for any other role change.'
          );
        } else {
          Alert.alert(
            'Connection issue',
            "We couldn't reach the server. Check your connection and tap Continue to try again. Your selection is still saved on this screen."
          );
        }
        dispatch({ type: 'SAVE_FAIL', error: error as Error });
        return; // Do NOT navigate to step 2 — continuing would leave server role unset.
      }

      // Always go to step 2 (basic info) after role selection — never skip
      dispatch({
        type: 'SAVE_SUCCESS',
        data: { role },
      });
      setProgress(1);
      router.push('/onboarding/step-2-basic' as any);
    } catch (error) {
      if (__DEV__) {
        if (__DEV__) console.error('[STEP-1] Error during continue:', error);
      }
      dispatch({ type: 'SAVE_FAIL', error: error as Error });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    Alert.alert('Sign Out?', 'Going back will sign you out. You can sign in again anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch {
            router.replace(GUEST_HOME_ROUTE);
          }
        },
      },
    ]);
  };

  return (
    <OnboardingLayout
      step={1}
      title="Choose Your Role"
      subtitle="Personalize your VarsityHub experience"
      showBackButton={true}
      onBackPress={handleBack}
      emailVerified={emailVerified === null ? undefined : emailVerified}
      onVerifyEmail={() => void router.push('/verify')}
    >
      <Stack.Screen options={{ title: 'Step 1', headerShown: false }} />

      <RoleCard
        title="Fan"
        description="Follow teams and players"
        icon="heart"
        selected={role === 'fan'}
        onPress={() => setRole('fan')}
        onContinue={onContinue}
        saving={saving}
        roleType="fan"
        features={[
          'Follow your favorite teams',
          'Get game updates and highlights',
          'Pitch events to your community',
          '*Fan accounts can be upgraded to staff*',
          '- Upon coach approval',
        ]}
      />

      {/* Rookie plan is selected later; not a separate role */}

      <RoleCard
        title="Coach / Organizer"
        description="Manage teams and organize games"
        icon="trophy"
        selected={role === 'coach'}
        onPress={() => setRole('coach')}
        onContinue={confirmedCoachAge ? onContinue : undefined}
        saving={saving}
        roleType="coach"
        features={[
          'Free access to three teams',
          'Create and manage teams',
          'Host games, fundraisers, watch parties, and other events',
          'Organize seasons, rosters, and schedules',
        ]}
      />

      {/* Coach 18+ Age Confirmation */}
      {role === 'coach' && (
        <View style={styles.coachAgeContainer}>
          <TouchableOpacity
            style={styles.coachAgeCheckboxRow}
            onPress={() => setConfirmedCoachAge(!confirmedCoachAge)}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: confirmedCoachAge }}
          >
            <Ionicons
              name={confirmedCoachAge ? 'checkbox' : 'checkbox-outline'}
              size={24}
              color={confirmedCoachAge ? '#DAA520' : '#9CA3AF'}
            />
            <Text style={[styles.coachAgeText, { color: theme.text }]}>
              I confirm I am at least 18 years old
            </Text>
          </TouchableOpacity>
          {!confirmedCoachAge && (
            <Text style={styles.coachAgeHint}>
              Coach and organizer accounts require users to be 18 or older.
            </Text>
          )}
        </View>
      )}
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  card: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 12,
    borderWidth: 2,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        }),
    elevation: 2,
    minHeight: 260,
  },
  cardWithButton: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  cardSelected: {
    borderWidth: 3,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 2px 12px rgba(0, 0, 0, 0.15)' }
      : {
          shadowOpacity: 0.15,
          shadowRadius: 12,
        }),
    elevation: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitleContainer: {
    marginLeft: 14,
    flex: 1,
  },
  cardTitle: {
    fontWeight: '800',
    fontSize: 20,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  cardDescription: {
    fontSize: 15,
    lineHeight: 20,
  },
  featuresList: {
    gap: 6,
    paddingTop: 2,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkIcon: {
    marginRight: 10,
  },
  featureText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  sideButton: {
    width: 80,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
        }),
    elevation: 6,
  },
  sideButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    writingDirection: 'ltr',
    transform: [{ rotate: '0deg' }],
    textAlign: 'center',
  },
  coachAgeContainer: {
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  coachAgeCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coachAgeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  coachAgeHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    marginLeft: 34,
    lineHeight: 16,
  },
});
