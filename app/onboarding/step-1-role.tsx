import { useOnboarding } from '@/context/OnboardingContext';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import PrimaryButton from '@/ui/PrimaryButton';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { OnboardingLayout } from './components/OnboardingLayout';

type UserRole = 'fan' | 'coach';

function RoleCard({ 
  title, 
  description, 
  icon, 
  selected, 
  onPress, 
  features 
}: { 
  title: string; 
  description: string; 
  icon: string; 
  selected?: boolean; 
  onPress: () => void; 
  features: string[]; 
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const colors = {
    cardBg: isDark ? (selected ? '#1F2937' : '#111827') : (selected ? '#FFFFFF' : '#F9FAFB'),
    cardBorder: isDark ? (selected ? '#60A5FA' : '#374151') : (selected ? '#2563EB' : '#E5E7EB'),
    iconColor: isDark ? (selected ? '#60A5FA' : '#9CA3AF') : (selected ? '#2563EB' : '#6B7280'),
    titleColor: isDark ? '#F9FAFB' : '#111827',
    descColor: isDark ? '#9CA3AF' : '#6B7280',
    featureText: isDark ? '#D1D5DB' : '#374151',
  };

  return (
    <Pressable 
      onPress={onPress} 
      style={[
        styles.card, 
        { 
          backgroundColor: colors.cardBg,
          borderColor: colors.cardBorder,
        },
        selected && styles.cardSelected
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
            color={isDark ? '#60A5FA' : '#2563EB'} 
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
  );
}

export default function Step1Role() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnToConfirmation?: string }>();
  const { state: ob, setState: setOB, setProgress } = useOnboarding();
  const [role, setRole] = useState<UserRole | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ob.role) setRole(ob.role);
  }, [ob.role]);

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
          console.debug('[Onboarding][Step1] server prefs after update', me?.preferences);
          // If server agrees on the role, ensure onboarding state reflects it (no-op if same)
          if (me?.preferences?.role) setOB((prev) => ({ ...(prev || {}), role: me.preferences.role }));
        } catch (e) {
          // ignore; best-effort
        }
      } catch (e) {
        // best-effort; swallow but log for debugging
        // eslint-disable-next-line no-console
        console.warn('[Onboarding][Step1] failed to persist role to server', e);
      }
      try {
        // eslint-disable-next-line no-console
        console.debug('[Onboarding][Step1] onContinue set role', { role });
      } catch (e) {}
      
      // If we came from confirmation, go back there
      if (returnToConfirmation) {
        router.replace('/onboarding/step-10-confirmation');
      } else {
        // Both roles complete the basic info step next
        setProgress(1); // step-2
        router.push('/onboarding/step-2-basic');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingLayout
      step={1}
      title="Choose Your Role"
      subtitle="Tell us how you'll be using VarsityHub to personalize your experience"
      showBackButton={false}
    >
      <Stack.Screen options={{ title: 'Step 1/10', headerShown: false }} />
      
      <RoleCard
        title="Fan"
        description="Follow teams and players"
        icon="heart"
        selected={role === 'fan'}
        onPress={() => setRole('fan')}
        features={[
          'Follow your favorite teams',
          'Get game updates and highlights',
          'Connect with other fans',
          'Quick setup process'
        ]}
      />

      <RoleCard
        title="Coach / Organizer"
        description="Manage teams and organize games"
        icon="trophy"
        selected={role === 'coach'}
        onPress={() => setRole('coach')}
        features={[
          'Create and manage teams',
          'Organize games and events',
          'Invite players and staff',
          'Full management tools',
          'Communication features'
        ]}
      />

      {role && (
        <View style={styles.continueContainer}>
          <PrimaryButton 
            label={saving ? 'Setting up...' : 'Continue'} 
            onPress={onContinue} 
            disabled={saving} 
            loading={saving} 
          />
        </View>
      )}
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  card: { 
    padding: 20, 
    borderRadius: 16, 
    borderWidth: 2, 
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    gap: 10,
    paddingTop: 4,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkIcon: {
    marginRight: 10,
  },
  featureText: {
    fontSize: 15,
    flex: 1,
    lineHeight: 22,
  },
  continueContainer: {
    marginTop: 32,
    marginBottom: 20,
  },
});





