import { Colors } from '@/constants/Colors';
import { ZipCodeMapPreview } from '@/components/ZipCodeMapPreview';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { OBProvider, useOnboarding } from '@/context/OnboardingContext';
import { getCanonicalBillingState } from '@/utils/billingState';
import { getCanonicalCoachRole } from '@/utils/roleChecks';
import {
  LEGEND_YEARLY_PRICE_LABEL,
  ROOKIE_TEAM_LIMIT,
  VETERAN_MONTHLY_TEAM_PRICE_LABEL,
} from '@/constants/plans';
import { getCoachUpgradeCta } from '@/utils/coachUpgradeCta';

type OnboardingAction = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  route: string;
  gradient: [string, string];
};

type AccountType = 'fan' | 'coach';
type CoachTier = 'rookie' | 'veteran' | 'legend';

function RoleOnboardingScreenInner() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { setState: setOB } = useOnboarding();
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [coachTier, setCoachTier] = useState<CoachTier | null>(null);
  const [zipCode, setZipCode] = useState('');
  const [zipCodeProvided, setZipCodeProvided] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAccountSelection, setShowAccountSelection] = useState(false);
  const [showCoachTierSelection, setShowCoachTierSelection] = useState(false);
  const orgOverviewRoute = '/organization';
  const orgTeamsRoute = '/organization?tab=teams';
  const logTelemetry = (event: string, data?: Record<string, unknown>) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      if (__DEV__) console.log(`[RoleOnboarding] ${event}`, data || {});
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const me: any = await User.me();
        const userRole = getCanonicalCoachRole(me);
        const billing = getCanonicalBillingState(me);
        const resolvedCoachTier = billing.selected_plan as CoachTier;

        // Determine account type (fan or coach)
        if (userRole === 'fan') {
          setAccountType('fan');
          logTelemetry('prefill-fan', {
            plan: billing.plan,
            pendingPlan: billing.pending_plan,
            subscriptionTier: me?.subscription_tier,
          });
        } else if (userRole === 'coach') {
          setAccountType('coach');
          setCoachTier(resolvedCoachTier);
          logTelemetry('prefill-coach', {
            plan: billing.plan,
            pendingPlan: billing.pending_plan,
            subscriptionTier: me?.subscription_tier,
            resolvedCoachTier,
          });
        }

        // Check if zip code is already provided
        const hasZip = me?.zip_code || me?.preferences?.zip_code;
        if (hasZip) {
          setZipCode(hasZip);
          setZipCodeProvided(true);
          logTelemetry('prefill-zip', { zip: hasZip });
        }

        // If no account type, show selection screen
        if (!userRole) {
          setShowAccountSelection(true);
        }
      } catch {
        setShowAccountSelection(true);
      }
    })();
  }, []);

  const validateZipCode = (zip: string): boolean => {
    // Global postal codes: 3-10 alphanumeric characters (with optional spaces/hyphens)
    const zipRegex = /^[A-Za-z0-9][A-Za-z0-9\s\-]{1,9}[A-Za-z0-9]$/;
    return zipRegex.test(zip.trim());
  };

  const handleSaveZipCode = async () => {
    const trimmedZip = zipCode.trim();
    if (!trimmedZip) {
      Alert.alert('ZIP Code Required', 'Please enter your ZIP code to continue.');
      return;
    }

    if (!validateZipCode(trimmedZip)) {
      Alert.alert(
        'Invalid ZIP Code',
        'Please enter a valid US ZIP code (e.g., 12345 or 12345-6789).'
      );
      return;
    }

    setSaving(true);
    try {
      logTelemetry('zip-save-attempt');
      await User.updatePreferences({ zip_code: trimmedZip });
      const fresh = await User.refresh();
      const savedZip = String(fresh?.preferences?.zip_code || fresh?.zip_code || '').trim();
      if (savedZip !== trimmedZip) {
        throw new Error('Saved ZIP code did not round-trip from the server.');
      }
      setZipCode(savedZip);
      setZipCodeProvided(true);
      logTelemetry('zip-save-success', { zip: savedZip });
      Alert.alert('Success', 'Your ZIP code has been saved!');
    } catch (e: any) {
      if (__DEV__) console.error('Failed to save ZIP code', e);
      logTelemetry('zip-save-error', { message: e?.message });
      Alert.alert('Error', 'Failed to save ZIP code. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAccountType = async (type: AccountType) => {
    setAccountType(type);
    setShowAccountSelection(false);

    // If coach, show tier selection on all platforms
    if (type === 'coach') {
      logTelemetry('select-account-type', { type });
      setShowCoachTierSelection(true);
    } else {
      // If fan, save immediately and sync to onboarding context
      setSaving(true);
      logTelemetry('select-account-type', { type });
      try {
        await User.updatePreferences({
          role: 'fan',
          plan: 'rookie',
        });
        setOB(prev => ({ ...prev, role: 'fan' }));
        logTelemetry('fan-save-success');
      } catch (e: any) {
        logTelemetry('fan-save-error', { message: e?.message });
        Alert.alert('Error', 'Failed to set account type. Please try again.');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleSelectCoachTier = async (tier: CoachTier) => {
    setSaving(true);
    try {
      logTelemetry('coach-tier-attempt', { tier });

      await User.upgradeToCoach(tier);

      setCoachTier(tier);
      setShowCoachTierSelection(false);
      // Sync role and plan to onboarding context so main flow has correct state
      const isPaidPlan = tier === 'veteran' || tier === 'legend';
      setOB(prev => ({
        ...prev,
        role: 'coach',
        plan: tier,
        pending_plan: isPaidPlan ? tier : undefined,
        payment_pending: isPaidPlan,
      }));
      logTelemetry('coach-tier-success', { tier });

      // Redirect to the coach-application step with fan steps skipped.
      router.replace('/onboarding/coach-application' as any);
    } catch (e: any) {
      if (__DEV__) console.error('Failed to set coach tier', e);
      logTelemetry('coach-tier-error', { message: e?.message });
      if (
        e?.data?.code === 'COACH_UPGRADE_IN_PROGRESS' ||
        e?.data?.code === 'COACH_REAPPLICATION_REQUIRED' ||
        e?.data?.code === 'COACH_ALREADY_APPROVED'
      ) {
        const fresh = (await User.refresh().catch(() => null)) as any;
        const nextCta = getCoachUpgradeCta({
          ...fresh,
          role: fresh?.preferences?.role || fresh?.role || null,
          preferences: fresh?.preferences || {},
        });
        if (nextCta?.route) {
          router.replace(nextCta.route as any);
          return;
        }
      }
      Alert.alert(
        'Error',
        e?.data?.error || e?.message || 'Failed to upgrade to coach. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Fan-specific actions - consumption focused
  const fanActions: OnboardingAction[] = [
    {
      icon: 'star',
      title: 'Discover Teams',
      description: 'Find and follow your favorite high school teams',
      route: '/favorites',
      gradient: ['#ef4444', '#dc2626'],
    },
    {
      icon: 'flash',
      title: 'Watch Highlights',
      description: 'Never miss the best moments from every game',
      route: '/highlights',
      gradient: ['#3b82f6', '#2563eb'],
    },
    {
      icon: 'calendar',
      title: 'Game Schedule',
      description: 'See upcoming games and RSVP to attend',
      route: '/feed',
      gradient: ['#8b5cf6', '#7c3aed'],
    },
    {
      icon: 'chatbubble',
      title: 'Connect & Share',
      description: 'Post reviews, engage with other fans',
      route: '/create-post',
      gradient: ['#10b981', '#059669'],
    },
  ];

  // Rookie Coach actions - entry level
  const rookieActions: OnboardingAction[] = [
    {
      icon: 'add-circle',
      title: 'Create Your Teams',
      description: `Set up your first ${ROOKIE_TEAM_LIMIT} teams - completely free!`,
      route: '/create-team',
      gradient: ['#2563eb', '#1d4ed8'],
    },
    {
      icon: 'people',
      title: 'Manage Roster',
      description: 'Add players, assign roles, build your squad',
      route: orgTeamsRoute,
      gradient: ['#7c3aed', '#6d28d9'],
    },
    {
      icon: 'calendar',
      title: 'Schedule Games',
      description: 'Create games and events for your teams',
      route: orgTeamsRoute,
      gradient: ['#059669', '#047857'],
    },
    {
      icon: 'trending-up',
      title: 'Track Performance',
      description: 'View stats, game results, and analytics',
      route: orgOverviewRoute,
      gradient: ['#dc2626', '#b91c1c'],
    },
  ];

  // Veteran Coach actions - paid tier
  const veteranActions: OnboardingAction[] = [
    {
      icon: 'trophy',
      title: 'Unlimited Teams',
      description: `First ${ROOKIE_TEAM_LIMIT} teams free, then ${VETERAN_MONTHLY_TEAM_PRICE_LABEL}`,
      route: orgTeamsRoute,
      gradient: ['#f59e0b', '#d97706'],
    },
    {
      icon: 'people-circle',
      title: 'Advanced Roster Tools',
      description: 'Depth charts, positions, player stats tracking',
      route: orgTeamsRoute,
      gradient: ['#8b5cf6', '#7c3aed'],
    },
    {
      icon: 'trending-up',
      title: 'Season Analytics',
      description: 'Detailed performance metrics and reports',
      route: orgOverviewRoute,
      gradient: ['#3b82f6', '#2563eb'],
    },
    {
      icon: 'megaphone',
      title: 'Team Promotion',
      description: 'Boost visibility with featured posts',
      route: '/my-ads',
      gradient: ['#10b981', '#059669'],
    },
  ];

  // Legend Coach actions - premium tier (unlimited everything)
  const legendActions: OnboardingAction[] = [
    {
      icon: 'sparkles',
      title: 'Unlimited Teams',
      description: 'Manage unlimited teams across all sports',
      route: orgTeamsRoute,
      gradient: ['#7c3aed', '#6d28d9'],
    },
    {
      icon: 'people',
      title: 'Unlimited Authorized Users',
      description: 'Add assistant coaches and staff with full access',
      route: orgTeamsRoute,
      gradient: ['#3b82f6', '#2563eb'],
    },
    {
      icon: 'business',
      title: 'Organization Management',
      description: 'Manage entire athletic programs and departments',
      route: orgOverviewRoute,
      gradient: ['#10b981', '#059669'],
    },
    {
      icon: 'shield',
      title: 'Priority Support',
      description: 'Direct access to VarsityHub team for assistance',
      route: '/edit-profile',
      gradient: ['#ef4444', '#dc2626'],
    },
  ];

  // STEP 1: Account Type Selection (Fan or Coach)
  if (showAccountSelection) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
        <Stack.Screen options={{ title: 'Choose Your Account', headerShown: false }} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
              Welcome to VarsityHub! 🏆
            </Text>
            <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>
              Are you a fan or a coach?
            </Text>
          </View>

          {/* Fan Account */}
          <Pressable
            style={[
              styles.largeAccountCard,
              {
                backgroundColor: Colors[colorScheme].card,
                borderColor: Colors[colorScheme].border,
              },
            ]}
            onPress={() => handleSelectAccountType('fan')}
            disabled={saving}
          >
            <View style={[styles.largeAccountIcon, { backgroundColor: '#ef444420' }]}>
              <Ionicons name="heart" size={48} color="#ef4444" />
            </View>
            <Text style={[styles.largeAccountName, { color: Colors[colorScheme].text }]}>
              Fan Account
            </Text>
            <Text style={[styles.largeAccountPrice, { color: '#10b981' }]}>FREE FOREVER</Text>
            <Text
              style={[styles.largeAccountDescription, { color: Colors[colorScheme].mutedText }]}
            >
              Follow teams, watch highlights, RSVP to games, and stay connected with high school
              sports
            </Text>
            <Text
              style={{
                color: Colors[colorScheme].mutedText,
                marginTop: 8,
                fontSize: 12,
                fontStyle: 'italic',
                textAlign: 'center',
              }}
            >
              *Fan accounts can be upgraded to athlete/staff upon coach approval
            </Text>
          </Pressable>

          {/* Coach Account */}
          <Pressable
            style={[
              styles.largeAccountCard,
              {
                backgroundColor: Colors[colorScheme].card,
                borderColor: '#3b82f6',
                borderWidth: 2,
              },
            ]}
            onPress={() => handleSelectAccountType('coach')}
            disabled={saving}
          >
            <View style={[styles.largeAccountIcon, { backgroundColor: '#3b82f620' }]}>
              <Ionicons name="clipboard" size={48} color="#3b82f6" />
            </View>
            <Text style={[styles.largeAccountName, { color: Colors[colorScheme].text }]}>
              Coach Account
            </Text>
            <Text style={[styles.largeAccountPrice, { color: '#3b82f6' }]}>STARTS FREE</Text>
            <Text
              style={[styles.largeAccountDescription, { color: Colors[colorScheme].mutedText }]}
            >
              Manage teams, schedule games, track stats, and build your program
            </Text>
          </Pressable>

          {saving && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // STEP 2: Coach Tier Selection (Rookie/Veteran/Legend)
  if (showCoachTierSelection) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
        <Stack.Screen options={{ title: 'Choose Your Tier', headerShown: false }} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Pressable
              onPress={() => {
                setShowCoachTierSelection(false);
                setShowAccountSelection(true);
                setAccountType(null);
              }}
            >
              <Ionicons name="arrow-back" size={24} color={Colors[colorScheme].text} />
            </Pressable>
            <Text style={[styles.title, { color: Colors[colorScheme].text, marginTop: 16 }]}>
              Choose Your League Plan 🏀
            </Text>
            <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>
              As the league owner, your plan covers all approved coaches
            </Text>
          </View>

          {/* Rookie Coach */}
          <Pressable
            style={[
              styles.accountTypeCard,
              {
                backgroundColor: Colors[colorScheme].card,
                borderColor: Colors[colorScheme].border,
              },
            ]}
            onPress={() => handleSelectCoachTier('rookie')}
            disabled={saving}
          >
            <View style={[styles.accountIconContainer, { backgroundColor: '#3b82f620' }]}>
              <Ionicons name="ribbon" size={32} color="#3b82f6" />
            </View>
            <View style={styles.accountTypeInfo}>
              <Text style={[styles.accountTypeName, { color: Colors[colorScheme].text }]}>
                Rookie Coach
              </Text>
              <Text style={[styles.accountTypePrice, { color: '#10b981' }]}>
                {`FREE • ${ROOKIE_TEAM_LIMIT} Teams Max`}
              </Text>
              <View style={{ marginTop: 8 }}>
                <Text style={[styles.bulletPoint, { color: Colors[colorScheme].mutedText }]}>
                  • Perfect for first-time coaches
                </Text>
                <Text style={[styles.bulletPoint, { color: Colors[colorScheme].mutedText }]}>
                  • First {ROOKIE_TEAM_LIMIT} teams free
                </Text>
                <Text style={[styles.bulletPoint, { color: Colors[colorScheme].mutedText }]}>
                  • (ex: Men's and Women's Soccer)
                </Text>
                <Text style={[styles.bulletPoint, { color: Colors[colorScheme].mutedText }]}>
                  • Create events including games, fundraisers, and watch parties
                </Text>
              </View>
            </View>
          </Pressable>

          {/* Veteran Coach */}
          <Pressable
            style={[
              styles.accountTypeCard,
              {
                backgroundColor: Colors[colorScheme].card,
                borderColor: Colors[colorScheme].border,
              },
            ]}
            onPress={() => handleSelectCoachTier('veteran')}
            disabled={saving}
          >
            <View style={[styles.accountIconContainer, { backgroundColor: '#f59e0b20' }]}>
              <Ionicons name="trophy" size={32} color="#f59e0b" />
            </View>
            <View style={styles.accountTypeInfo}>
              <Text style={[styles.accountTypeName, { color: Colors[colorScheme].text }]}>
                Veteran Coach
              </Text>
              <Text style={[styles.accountTypePrice, { color: '#f59e0b' }]}>
                {VETERAN_MONTHLY_TEAM_PRICE_LABEL}
              </Text>
              <Text
                style={[styles.accountTypeDescription, { color: Colors[colorScheme].mutedText }]}
              >
                {`For coaches managing multiple teams. First ${ROOKIE_TEAM_LIMIT} free, then ${VETERAN_MONTHLY_TEAM_PRICE_LABEL}`}
              </Text>
            </View>
          </Pressable>

          {/* Legend Coach */}
          <Pressable
            style={[
              styles.accountTypeCard,
              {
                backgroundColor: Colors[colorScheme].card,
                borderColor: '#7c3aed',
                borderWidth: 2,
              },
            ]}
            onPress={() => handleSelectCoachTier('legend')}
            disabled={saving}
          >
            <View style={[styles.accountIconContainer, { backgroundColor: '#7c3aed20' }]}>
              <Ionicons name="sparkles" size={32} color="#7c3aed" />
            </View>
            <View style={styles.accountTypeInfo}>
              <View style={styles.legendBadge}>
                <Text style={styles.legendBadgeText}>PREMIUM</Text>
              </View>
              <Text style={[styles.accountTypeName, { color: Colors[colorScheme].text }]}>
                Legend Coach
              </Text>
              <Text style={[styles.accountTypePrice, { color: '#7c3aed' }]}>
                {LEGEND_YEARLY_PRICE_LABEL}
              </Text>
              <Text
                style={[styles.accountTypeDescription, { color: Colors[colorScheme].mutedText }]}
              >
                Unlimited teams • Unlimited authorized users • Priority support
              </Text>
            </View>
          </Pressable>

          {saving && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!accountType || (accountType === 'coach' && !coachTier)) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
        <Stack.Screen options={{ title: 'Welcome' }} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        </View>
      </SafeAreaView>
    );
  }

  // Choose actions based on account type and tier
  let actions: OnboardingAction[] = [];
  let welcomeTitle = 'Welcome to VarsityHub! 🎉';
  let welcomeSubtitle = '';

  if (accountType === 'fan') {
    actions = fanActions;
    welcomeTitle = 'Welcome, Fan! 🎉';
    welcomeSubtitle = 'Discover teams, watch highlights, and never miss a moment';
  } else if (accountType === 'coach') {
    if (coachTier === 'rookie') {
      actions = rookieActions;
      welcomeTitle = 'Welcome, Rookie Coach! 🏀';
      welcomeSubtitle = `First ${ROOKIE_TEAM_LIMIT} teams free`;
    } else if (coachTier === 'veteran') {
      actions = veteranActions;
      welcomeTitle = 'Welcome, Veteran Coach! 🏆';
      welcomeSubtitle = `Unlimited teams at ${VETERAN_MONTHLY_TEAM_PRICE_LABEL}`;
    } else if (coachTier === 'legend') {
      actions = legendActions;
      welcomeTitle = 'Welcome, Legend Coach! ⚡';
      welcomeSubtitle = 'Unlimited teams • Unlimited users • Priority support';
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen options={{ title: 'Welcome to Varsity Hub' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: Colors[colorScheme].text }]}>{welcomeTitle}</Text>
          <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>
            {zipCodeProvided ? welcomeSubtitle : 'First, tell us where you are'}
          </Text>
        </View>

        {!zipCodeProvided ? (
          <View
            style={[
              styles.zipCodeSection,
              {
                backgroundColor: Colors[colorScheme].card,
                borderColor: Colors[colorScheme].border,
              },
            ]}
          >
            <Text style={[styles.zipCodeLabel, { color: Colors[colorScheme].text }]}>
              Your ZIP Code <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <Text style={[styles.zipCodeHint, { color: Colors[colorScheme].mutedText }]}>
              We'll use this to show you local games and ads
            </Text>
            <TextInput
              style={[
                styles.zipCodeInput,
                {
                  backgroundColor: Colors[colorScheme].background,
                  borderColor: Colors[colorScheme].border,
                  color: Colors[colorScheme].text,
                },
              ]}
              value={zipCode}
              onChangeText={setZipCode}
              placeholder="12345"
              placeholderTextColor={Colors[colorScheme].mutedText}
              keyboardType="number-pad"
              maxLength={10}
              autoFocus
            />
            <ZipCodeMapPreview
              zipCode={zipCode}
              title="Your Area"
              subtitle="We'll show you local games and ads near ZIP {zip}"
              showCircle={false}
            />
            <Pressable
              style={[
                styles.saveZipButton,
                {
                  backgroundColor: zipCode.trim()
                    ? Colors[colorScheme].tint
                    : Colors[colorScheme].border,
                  opacity: saving ? 0.6 : 1,
                },
              ]}
              onPress={handleSaveZipCode}
              disabled={saving || !zipCode.trim()}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.saveZipButtonText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.actionsGrid}>
              {actions.map((action, index) => (
                <Pressable
                  key={index}
                  style={({ pressed }) => [styles.actionCard, { opacity: pressed ? 0.8 : 1 }]}
                  onPress={() => void router.push(action.route as any)}
                >
                  <LinearGradient
                    colors={action.gradient}
                    style={styles.actionGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.iconContainer}>
                      <Ionicons name={action.icon} size={32} color="#fff" />
                    </View>
                    <Text style={styles.actionTitle}>{action.title}</Text>
                    <Text style={styles.actionDescription}>{action.description}</Text>
                  </LinearGradient>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.continueButton, { backgroundColor: Colors[colorScheme].tint }]}
              onPress={() => void router.replace('/(tabs)/feed')}
            >
              <Text style={styles.continueButtonText}>Continue to Feed</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RoleOnboardingScreen() {
  return (
    <OBProvider>
      <RoleOnboardingScreenInner />
    </OBProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  zipCodeSection: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  zipCodeLabel: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  zipCodeHint: {
    fontSize: 14,
    marginBottom: 16,
  },
  zipCodeInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  saveZipButton: {
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveZipButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  actionsGrid: {
    gap: 16,
  },
  actionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        }),
    elevation: 4,
  },
  actionGradient: {
    padding: 20,
    minHeight: 140,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  actionDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },
  continueButton: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountTypeCard: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 16,
  },
  accountIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTypeInfo: {
    flex: 1,
  },
  accountTypeName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  accountTypePrice: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  accountTypeDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  legendBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  legendBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeAccountCard: {
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    alignItems: 'center',
  },
  largeAccountIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  largeAccountName: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  largeAccountPrice: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  largeAccountDescription: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  bulletPoint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  accountUpgradeNote: {
    marginTop: 8,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

export default RoleOnboardingScreen;
