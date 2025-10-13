import { useOnboarding } from '@/context/OnboardingContext';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import PrimaryButton from '@/ui/PrimaryButton';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingBackHeader } from '@/components/onboarding/OnboardingBackHeader';

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
  return (
    <Pressable 
      onPress={onPress} 
      style={[styles.card, selected && styles.cardSelected]}
    >
      <View style={styles.cardHeader}>
        <Ionicons 
          name={icon as any} 
          size={32} 
          color={selected ? '#111827' : '#6b7280'} 
        />
        <View style={styles.cardTitleContainer}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardDescription}>{description}</Text>
        </View>
      </View>
      
      <View style={styles.featuresList}>
        {features.map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <Ionicons 
              name="checkmark" 
              size={16} 
              color="#16A34A" 
              style={styles.checkIcon} 
            />
            <Text style={styles.featureText}>{feature}</Text>
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
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Step 1/10' }} />
      <OnboardingBackHeader
        title="Choose Your Role"
        subtitle="Tell us how you'll be using VarsityHub"
        onBack={() => router.replace('/sign-in')}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>

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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'white' 
  },
  scrollContent: { 
    padding: 16, 
    paddingBottom: 28 
  },
  card: { 
    padding: 20, 
    borderRadius: 12, 
    borderWidth: 2, 
    borderColor: '#E5E7EB', 
    backgroundColor: '#F9FAFB', 
    marginBottom: 16 
  },
  cardSelected: { 
    borderColor: '#111827', 
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardTitleContainer: {
    marginLeft: 12,
    flex: 1,
  },
  cardTitle: { 
    fontWeight: '800', 
    fontSize: 18,
    color: '#111827',
    marginBottom: 4,
  },
  cardDescription: {
    color: '#6b7280',
    fontSize: 14,
  },
  featuresList: {
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkIcon: {
    marginRight: 8,
  },
  featureText: {
    color: '#374151',
    fontSize: 14,
    flex: 1,
  },
  continueContainer: {
    marginTop: 24,
  },
});





