import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
// @ts-ignore
import { User } from '@/api/entities';
import { PLAN_DEFINITIONS, Plan } from '@/constants/plans';
import { useOnboarding } from '@/context/OnboardingContext';
import OnboardingLayout from './components/OnboardingLayout';

// Map centralized plan definitions to UI format
type PlanOption = {
  id: Plan;
  name: string;
  icon: 'people' | 'trophy' | 'medal';
  price: string;
  period: string;
  priceId: string | null;
  features: string[];
};

const PLAN_OPTIONS: PlanOption[] = Object.values(PLAN_DEFINITIONS).map((plan) => ({
  id: plan.id,
  name: plan.name,
  icon: plan.icon,
  price: plan.price,
  period: plan.period,
  priceId: plan.priceId,
  features: plan.features,
}));

function PlanCard({
  option,
  selected,
  onPress,
  onContinue,
  saving,
  disabled,
  disabledReason,
}: {
  option: PlanOption;
  selected: boolean;
  onPress: () => void;
  onContinue?: () => void;
  saving?: boolean;
  disabled?: boolean;
  disabledReason?: string | null;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const continueDisabled = saving || disabled;

  const getPlanColor = (id: string): string => {
    switch (id) {
      case 'legend': return '#FFD700';
      case 'veteran': return '#C0C0C0';
      case 'rookie':
      default: return '#CD7F32';
    }
  };

  // Darker backgrounds for selected cards — ensures WCAG AA contrast (≥4.5:1) with white text
  const getSelectedBg = (id: string): string => {
    switch (id) {
      case 'legend': return '#FFD700';
      case 'veteran': return '#C0C0C0';
      case 'rookie':
      default: return '#8B5A2B'; // dark bronze — 5.8:1 contrast with white
    }
  };

  // Icon mapping - using MaterialIcons
  const getIconName = (): any => {
    switch (option.icon) {
      case 'people':
        return 'military-tech';
      case 'trophy':
        return 'workspace-premium';
      case 'medal':
        return 'emoji-events';
      default:
        return 'military-tech';
    }
  };
  
  return (
    <View style={styles.cardWrapper}>
      <Pressable onPress={onPress} style={[
        styles.card,
        selected && styles.cardSelected,
        selected && styles.cardWithButton,
        { borderColor: selected ? getPlanColor(option.id) : (isDark ? '#374151' : '#E5E7EB') },
        { backgroundColor: selected ? getSelectedBg(option.id) : (isDark ? '#111827' : '#F9FAFB') }
      ]}>
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <MaterialIcons name={getIconName()} size={24} color={selected ? '#FFFFFF' : getPlanColor(option.id)} />
          <Text style={[styles.cardTitle, selected && styles.selectedText, { color: selected ? '#FFFFFF' : (isDark ? '#F9FAFB' : '#111827') }]}>{option.name}</Text>
        </View>
      </View>
      <Text style={[styles.price, selected && styles.selectedText, { color: selected ? '#FFFFFF' : (isDark ? '#F9FAFB' : '#111827') }]}>{option.price} <Text style={[styles.period, selected && styles.selectedText, { color: selected ? '#FFFFFF' : (isDark ? '#9CA3AF' : '#6B7280') }]}>{option.period}</Text></Text>
      <View style={styles.benefitsList}>
        {option.features.map((benefit) => (
          <Text key={benefit} style={[styles.benefitItem, selected && styles.selectedText, { color: selected ? '#FFFFFF' : (isDark ? '#34D399' : '#16A34A') }]}>{`- ${benefit}`}</Text>
        ))}
      </View>
      </Pressable>
      
      {selected && onContinue && (
        <Pressable 
          onPress={onContinue}
          disabled={continueDisabled}
          style={styles.sideButton}
        >
          {saving ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Text style={styles.sideButtonText}>{continueDisabled && disabledReason ? 'Unavailable' : 'Continue'}</Text>
              <Text style={styles.sideButtonArrow}>→</Text>
            </>
          )}
        </Pressable>
      )}
      {selected && continueDisabled && disabledReason ? (
        <Text style={styles.sideButtonDisabledText}>{disabledReason}</Text>
      ) : null}
    </View>
  );
}

export default function Step3Plan() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnToConfirmation?: string }>();
  const returnToConfirmation = params.returnToConfirmation === 'true';
  const { state: ob, setState: setOB, setProgress } = useOnboarding();
  const [plan, setPlan] = useState<Plan | null>(ob.plan ?? null);
  const [saving, setSaving] = useState(false);
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  
  // Team count for Veteran plan (minimum 3 — first 2 free + at least 1 paid)
  const [teamCount, setTeamCount] = useState<number>(3);
  const [showTeamCountModal, setShowTeamCountModal] = useState(false);
  
  const displayedPlanOptions = PLAN_OPTIONS;

  // Fans should never see this coach-only plan selection screen
  useEffect(() => {
    if (ob.role === 'fan') {
      router.replace('/onboarding/step-7-profile');
    }
  }, [ob.role, router]);


  const navigateNext = () => {
    setOB((prev) => ({ ...prev, step_3_visited: true }));
    if (returnToConfirmation) {
      router.replace('/onboarding/step-10-confirmation');
    } else {
      router.replace('/onboarding/step-4-organization');
    }
  };

  const onContinue = async () => {
    if (!plan) return;

    // If Veteran plan and haven't confirmed team count yet, show modal
    if (plan === 'veteran' && !showTeamCountModal) {
      setShowTeamCountModal(true);
      return;
    }
    
    setSaving(true);
    try {
      // Rule A: For paid plans, store as pending_plan (NOT plan). The plan field
      // is only set after Stripe payment succeeds post-admin-approval.
      const isPaid = plan !== 'rookie';
      if (isPaid) {
        setOB((prev) => ({
          ...prev,
          pending_plan: plan,
          plan: undefined,
          payment_pending: true,
          ...(plan === 'veteran' ? { team_count_total: teamCount } : {}),
        }));
        try {
          await User.updatePreferences({
            pending_plan: plan,
            payment_pending: true,
            ...(plan === 'veteran' ? { team_count_total: teamCount } : {}),
          });
        } catch (err) {
          console.warn('Failed to persist plan selection to backend:', err);
        }
      } else {
        // Rookie (free) — set plan directly, no payment needed
        setOB((prev) => ({
          ...prev,
          plan: 'rookie',
          pending_plan: undefined,
          payment_pending: false,
        }));
        try {
          await User.updatePreferences({
            plan: 'rookie',
            pending_plan: null,
            payment_pending: false,
          });
        } catch (err) {
          console.warn('Failed to persist plan selection to backend:', err);
        }
      }

      setProgress(3);
      navigateNext();
    } finally {
      setSaving(false);
    }
  };

  const handleSelectPlan = (selectedPlan: Plan) => {
    setPlan(selectedPlan);
    // Don't set ob.plan for paid plans — Rule A: paid plans use pending_plan only
    // ob.plan is only set for rookie (free) in onContinue after user confirms
  };

  return (
    <OnboardingLayout
      step={3}
      title="Choose Your Plan"
      subtitle="Select the plan that fits your needs"
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.content}>
        {displayedPlanOptions.map((option) => (
          <PlanCard
            key={option.id}
            option={option as PlanOption}
            selected={plan === option.id}
            onPress={() => handleSelectPlan(option.id as Plan)}
            onContinue={plan === option.id ? onContinue : undefined}
            saving={saving}
          />
        ))}
      </View>

      {/* Team Count Modal for Veteran Plan */}
      <Modal
        visible={showTeamCountModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTeamCountModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1F2937' : 'white' }]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#F9FAFB' : '#111827' }]}>How Many Teams?</Text>
            <Text style={[styles.modalSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              First 2 teams are always free (ex: mens and womens soccer). Veteran plan is $1.00/month for each additional team beyond the first two.
            </Text>
            
            <View style={styles.teamCountSelector}>
              <Pressable
                style={[
                  styles.teamCountButton,
                  { backgroundColor: isDark ? '#374151' : '#F3F4F6', borderColor: isDark ? '#4B5563' : '#E5E7EB' }
                ]}
                onPress={() => setTeamCount(Math.max(3, teamCount - 1))}
              >
                <Text style={[styles.teamCountButtonText, { color: isDark ? '#F9FAFB' : '#111827' }]}>−</Text>
              </Pressable>
              
              <View style={styles.teamCountDisplay}>
                <Text style={[styles.teamCountNumber, { color: isDark ? '#F9FAFB' : '#111827' }]}>{teamCount}</Text>
                <Text style={[styles.teamCountLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>teams</Text>
              </View>
              
              <Pressable
                style={[
                  styles.teamCountButton,
                  { backgroundColor: isDark ? '#374151' : '#F3F4F6', borderColor: isDark ? '#4B5563' : '#E5E7EB' }
                ]}
                onPress={() => setTeamCount(teamCount + 1)}
              >
                <Text style={[styles.teamCountButtonText, { color: isDark ? '#F9FAFB' : '#111827' }]}>+</Text>
              </Pressable>
            </View>
            
            <View style={styles.pricingInfo}>
              <Text style={[styles.pricingText, { color: isDark ? '#34D399' : '#16A34A' }]}>
                ${((teamCount - 2) * 1.00).toFixed(2)}/month
              </Text>
              <Text style={[styles.pricingSubtext, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                (2 free + {teamCount - 2} × $1.00)
              </Text>
            </View>
            
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.verifyButton, { backgroundColor: isDark ? '#2563EB' : '#111827' }]}
                onPress={() => {
                  // Validate minimum 3 teams for Veteran plan (2 free + 1 paid minimum)
                  if (plan === 'veteran' && teamCount < 3) {
                    Alert.alert(
                      'Minimum Teams Required',
                      'Veteran plan requires at least 3 teams (first 2 free, then $1.00/month per additional team).',
                      [{ text: 'OK', onPress: () => setTeamCount(3) }]
                    );
                    return;
                  }
                  setShowTeamCountModal(false);
                  void onContinue();
                }}
              >
                <Text style={styles.verifyButtonText}>Continue</Text>
              </Pressable>
              
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowTeamCountModal(false);
                  setPlan(null);
                  setOB((prev) => ({ ...prev, plan: undefined }));
                }}
              >
                <Text style={[styles.cancelButtonText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  cardWrapper: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  card: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardWithButton: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  cardSelected: {},
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { fontWeight: '800', fontSize: 16 },
  muted: { marginTop: 4 },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
    fontWeight: '700',
  },
  price: { fontWeight: '700', marginBottom: 4, fontSize: 18 },
  period: { fontSize: 14, fontWeight: '400' },
  benefitsList: { marginTop: 8, gap: 4 },
  benefitItem: { fontWeight: '700' },
  selectedText: {
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  extraNote: { marginTop: 8, fontSize: 12 },
  sideButton: {
    width: 80,
    backgroundColor: '#1E3A8A',
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
    textAlign: 'center',
  },
  sideButtonArrow: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  sideButtonDisabledText: {
    color: '#DC2626',
    fontSize: 12,
    marginLeft: 12,
    marginTop: 4,
    maxWidth: 140,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalButtons: {
    gap: 12,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  verifyButton: {},
  verifyButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    fontWeight: '600',
  },
  
  // Team Count Modal styles
  teamCountSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginVertical: 20,
  },
  teamCountButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamCountButtonText: {
    fontSize: 24,
    fontWeight: '700',
  },
  teamCountDisplay: {
    alignItems: 'center',
    minWidth: 80,
  },
  teamCountNumber: {
    fontSize: 36,
    fontWeight: '800',
  },
  teamCountLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  pricingInfo: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  pricingText: {
    fontSize: 24,
    fontWeight: '800',
  },
  pricingSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
});
