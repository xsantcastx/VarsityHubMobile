import { useAuth } from '@/context/AuthProvider';
import { useOnboarding } from '@/context/OnboardingContext';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
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
  roleType
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Silver for Fan, gold for Coach
  const isFan = roleType === 'fan';
  const accentColor = isFan ? '#9CA3AF' : '#FFD700'; // Silver vs gold
  const accentColorLight = isFan ? '#D1D5DB' : '#FFF44F'; // Light silver vs light gold
  const buttonBg = isFan ? '#6B7280' : '#DAA520'; // Dark silver vs goldenrod

  const colors = {
    cardBg: isDark ? (selected ? '#1F2937' : '#111827') : (selected ? '#FFFFFF' : '#F9FAFB'),
    cardBorder: isDark ? (selected ? accentColorLight : '#374151') : (selected ? accentColor : '#E5E7EB'),
    iconColor: isDark ? (selected ? accentColorLight : '#9CA3AF') : (selected ? accentColor : '#6B7280'),
    titleColor: isDark ? '#F9FAFB' : '#111827',
    descColor: isDark ? '#9CA3AF' : '#6B7280',
    featureText: isDark ? '#D1D5DB' : '#374151',
    buttonBg: buttonBg,
  };

  return (
    <View style={styles.cardWrapper}>
      <Pressable 
        onPress={onPress} 
        style={[
          styles.card, 
          { 
            backgroundColor: colors.cardBg,
            borderColor: colors.cardBorder,
          },
          selected && styles.cardSelected,
          selected && styles.cardWithButton
        ]}
      >
      <View style={styles.cardHeader}>
        <Ionicons 
          name={icon as any} 
          size={36} 
          color={colors.iconColor} 
        />
        <View style={styles.cardTitleContainer}>
          <Text style={[styles.cardTitle, { color: colors.titleColor }]}>{title}</Text>
          <Text style={[styles.cardDescription, { color: colors.descColor }]}>{description}</Text>
        </View>
        {selected && (
          <Ionicons 
            name="checkmark-circle" 
            size={24} 
            color={isDark ? accentColorLight : accentColor} 
          />
        )}
      </View>
      
      <View style={styles.featuresList}>
        {features.map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <Ionicons 
              name="checkmark-circle" 
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
          onPress={onContinue}
          disabled={saving}
          style={[styles.sideButton, { backgroundColor: colors.buttonBg }]}
        >
          {saving ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Text style={styles.sideButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="white" />
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

export default function Step1Role() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ returnToConfirmation?: string }>();
  const { state: ob, setState: setOB, setProgress } = useOnboarding();
  const [role, setRole] = useState<UserRole | null>(null);
  const [saving, setSaving] = useState(false);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);

  // CRITICAL: Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      console.warn('[Step1Role] Unauthenticated user - redirecting to sign-in');
      router.replace('/sign-in');
    }
  }, [user, router]);

  useEffect(() => {
    if (ob.role) setRole(ob.role);
  }, [ob.role]);

  // Check email verification status on mount and when screen focuses
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          const me: any = await User.me();
          setEmailVerified(me?.email_verified ?? null);
        } catch (error) {
          console.error('Failed to check email verification:', error);
        }
      })();
    }, [])
  );

  const returnToConfirmation = params.returnToConfirmation === 'true';

  const onContinue = async () => {
    if (!role) return;
    setSaving(true);
    try {
      setOB((prev) => ({ ...prev, role }));
      // Persist role to server so the schema/preferences reflect the user's selection
      try {
        await User.updatePreferences({ role });
        // Re-fetch me to confirm server saved the preference and help downstream code react
        try {
          const me: any = await User.me();
          // eslint-disable-next-line no-console
          // If server agrees on the role, ensure onboarding state reflects it (no-op if same)
          if (me?.preferences?.role) setOB((prev) => ({ ...(prev || {}), role: me.preferences.role }));
        } catch {
          // ignore; best-effort
        }
      } catch (error) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[Onboarding][Step1] failed to persist role to server', error);
        }
      }
      try {
        // eslint-disable-next-line no-console
      } catch {}
      
      // If we came from confirmation, go back there
      if (returnToConfirmation) {
        router.replace('/onboarding/step-10-confirmation');
      } else {
        // Route based on role selection for normal onboarding flow
        if (role === 'fan') {
          // Fan gets lightest setup - skip to profile
          setProgress(5); // step-7 is index 5
          router.push('/onboarding/step-7-profile');
        } else {
          // Coach/Organizer gets full onboarding with teams and subscriptions
          setProgress(1); // step-2 is index 1
          router.push('/onboarding/step-2-basic');
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBack = async () => {
    // Log out and return to sign-in
    try {
      await User.logout();
      router.replace('/sign-in');
    } catch (error) {
      console.error('Failed to logout:', error);
      router.replace('/sign-in');
    }
  };

  return (
    <OnboardingLayout
      step={1}
      title="Choose Your Role"
      subtitle="Personalize your VarsityHub experience"
      showBackButton={true}
      onBackPress={handleBack}
      emailVerified={emailVerified === null ? undefined : emailVerified}
<<<<<<< HEAD
      onVerifyEmail={() => void router.push('/verify-email')}
=======
      onVerifyEmail={() => router.push('/verify-identity?method=email')}
>>>>>>> 19009a9 (fix: add runtimeVersion to align with Expo.plist for EAS build)
    >
      <Stack.Screen options={{ title: 'Step 1/10', headerShown: false }} />
      
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
          '*Fan accounts can be upgraded to athlete/staff*',
          '- Upon coach approval'
        ]}
      />

      {/* Rookie plan is selected later; not a separate role */}

      <RoleCard
        title="Coach / Organizer"
        description="Manage teams and organize games"
        icon="trophy"
        selected={role === 'coach'}
        onPress={() => setRole('coach')}
        onContinue={onContinue}
        saving={saving}
        roleType="coach"
        features={[
          'First two teams free',
          'Create and manage teams',
          'Host games, fundraisers, watch parties, and other events',
          'Organize seasons, rosters, and schedules',
        ]}
      />
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    minHeight: 260,
  },
  cardWithButton: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  cardSelected: { 
    borderWidth: 3,
    shadowOpacity: 0.15,
    shadowRadius: 12,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
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
});


<<<<<<< HEAD
=======


>>>>>>> 19009a9 (fix: add runtimeVersion to align with Expo.plist for EAS build)
