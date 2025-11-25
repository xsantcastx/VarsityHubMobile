import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
// @ts-ignore
import { Subscriptions, User } from '@/api/entities';
import { useOnboarding } from '@/context/OnboardingContext';
import OnboardingLayout from './components/OnboardingLayout';

type Plan = 'rookie' | 'veteran' | 'legend';

type PlanOption = {
  id: Plan;
  name: string;
  icon: 'people' | 'trophy' | 'medal';
  price: string;
  period: string;
  priceId: string | null;
  features: string[];
};

const PLAN_OPTIONS = [
  {
    id: 'rookie',
    name: 'Rookie',
    icon: 'people' as const,
    price: 'First two teams free',
    period: '',
    priceId: null,
    features: [
      'Entry-level access',
      'First two teams free',
      'Example: mens and womens soccer',
      'Assign one extra administrator for each team',
    ],
  },
  {
    id: 'veteran',
    name: 'Veteran',
    icon: 'trophy' as const,
    price: '$2.50',
    period: '/ month per team added',
    priceId: 'prod_RNLc2l1BdUdSn9',
    features: [
      'Everything in Rookie',
      '$2.50/month per additional team (first 2 free)',
      '2 authorized users per team',
    ],
  },
  {
    id: 'legend',
    name: 'Legend',
    icon: 'medal' as const,
    price: '$19.99',
    period: '/ year',
    priceId: 'prod_RNLdYADy7i6dB5',
    features: [
      'Everything in Veteran',
      'Unlimited teams',
      'Create extracurricular clubs - Theater, Chess, etc.',
    ],
  },
];

function PlanCard({ option, selected, onPress, onContinue, saving }: { option: PlanOption; selected: boolean; onPress: () => void; onContinue?: () => void; saving?: boolean }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Icon mapping - using Ionicons
  const getIconName = (): any => {
    switch (option.icon) {
      case 'people':
        return 'people';
      case 'trophy':
        return 'trophy';
      case 'medal':
        return 'medal';
      default:
        return 'people';
    }
  };
  
  return (
    <View style={styles.cardWrapper}>
      <Pressable onPress={onPress} style={[
        styles.card, 
        selected && styles.cardSelected,
        selected && styles.cardWithButton,
        { borderColor: selected ? (isDark ? '#60A5FA' : '#111827') : (isDark ? '#374151' : '#E5E7EB') },
        { backgroundColor: selected ? (isDark ? '#1F2937' : '#FFFFFF') : (isDark ? '#111827' : '#F9FAFB') }
      ]}>
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <Ionicons name={getIconName()} size={24} color={isDark ? '#60A5FA' : '#2563EB'} />
          <Text style={[styles.cardTitle, { color: isDark ? '#F9FAFB' : '#111827' }]}>{option.name}</Text>
        </View>
      </View>
      <Text style={[styles.price, { color: isDark ? '#F9FAFB' : '#111827' }]}>{option.price} <Text style={[styles.period, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{option.period}</Text></Text>
      <View style={styles.benefitsList}>
        {option.features.map((benefit) => (
          <Text key={benefit} style={[styles.benefitItem, { color: isDark ? '#34D399' : '#16A34A' }]}>{`- ${benefit}`}</Text>
        ))}
      </View>
      </Pressable>
      
      {selected && onContinue && (
        <Pressable 
          onPress={onContinue}
          disabled={saving}
          style={styles.sideButton}
        >
          {saving ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Text style={styles.sideButtonText}>Continue</Text>
              <Text style={styles.sideButtonArrow}>→</Text>
            </>
          )}
        </Pressable>
      )}
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Team count for Veteran plan
  const [teamCount, setTeamCount] = useState<number>(3); // Minimum 3 teams for Veteran
  const [showTeamCountModal, setShowTeamCountModal] = useState(false);
  
  // Email verification states
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationInfo, setVerificationInfo] = useState<string | null>(null);

  const navigateNext = () => {
    if (returnToConfirmation) {
      router.replace('/onboarding/step-10-confirmation');
    } else {
      router.push('/onboarding/step-4-organization');
    }
  };

  const onVerifyEmail = async () => {
    if (!verificationCode.trim()) return;
    setVerifying(true);
    setVerificationError(null);
    setVerificationInfo(null);
    
    try {
      await User.verifyEmail(verificationCode.trim());
      setVerificationInfo('Email verified!');
      setShowVerifyModal(false);
      // Now retry the subscription
      setTimeout(() => {
        onContinue();
      }, 500);
    } catch (e: any) {
      setVerificationError(e?.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const onResendCode = async () => {
    setResending(true);
    setVerificationError(null);
    setVerificationInfo(null);
    
    try {
      const res: any = await User.requestVerification();
      setVerificationInfo(res?.dev_verification_code ? `Code sent (dev: ${res.dev_verification_code})` : 'Code sent');
    } catch (e: any) {
      setVerificationError(e?.message || 'Resend failed');
    } finally {
      setResending(false);
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
      // Prevent duplicate subscriptions: check current user's saved plan first
      try {
        const me: any = await User.me();
        const currentPlan = me?.preferences?.plan ?? 'rookie'; // Default to rookie if no plan
        
        // If already subscribed to the same plan, warn and continue
        if (currentPlan === plan) {
          Alert.alert('Already subscribed', 'Our records show you already have this plan. No need to subscribe again.');
          navigateNext();
          return;
        }
        
        // Only block if they have a PAID plan different from what they're selecting
        // Allow upgrades from rookie to veteran/legend, and between veteran/legend
        if (currentPlan !== 'rookie' && currentPlan !== plan && plan !== 'rookie') {
          Alert.alert('Plan change', `You currently have the ${currentPlan} plan. To change plans, please manage your subscription in Settings or contact support.`);
          navigateNext();
          return;
        }
      } catch (err) {
        // If we fail to fetch current user, continue to attempt subscription — we'll handle server errors during checkout.
        console.warn('Failed to check existing plan before checkout', err);
      }
      
      // For rookie plan, save immediately since no payment is required
      if (plan === 'rookie') {
        const pending = false;
        setOB((prev) => ({ ...prev, plan, payment_pending: pending }));
        try {
          await User.updatePreferences({ plan, payment_pending: pending });
        } catch (err) {
          console.warn('Failed to persist rookie plan to backend:', err);
        }
        setProgress(3);
        navigateNext();
        return;
      }

      // For paid plans, DON'T save the plan until after successful payment
      // Only save to local onboarding context for UI purposes
      setOB((prev) => ({ ...prev, plan, payment_pending: true }));

      try {
        // Persist selected team count into onboarding state for downstream screens
        if (plan === 'veteran') {
          setOB((prev) => ({ ...prev, team_count_total: teamCount }));
        }
        const res: any = await Subscriptions.createCheckout(plan, plan === 'veteran' ? teamCount : undefined);
        if (res?.free) {
          // If marked as free, save the plan now
          try {
            await User.updatePreferences({ plan, payment_pending: false });
          } catch (err) {
            console.warn('Failed to persist free plan to backend:', err);
          }
          setProgress(3);
          navigateNext();
          return;
        }
        if (res?.url) {
          // Stripe checkout was successful, user will pay through Stripe
          // The plan will be saved by the payment finalization process
          await WebBrowser.openBrowserAsync(String(res.url));
          setProgress(3);
          navigateNext();
          return;
        }
        console.warn('Unexpected subscribe response', res);
        Alert.alert('Payment', 'Unable to start checkout. You can continue and set up billing later.');
        setProgress(3);
        navigateNext();
      } catch (err: any) {
        console.warn('Failed to start subscription checkout for plan:', err);
        console.log('Error details:', { status: err?.status, message: err?.message, data: err?.data });
        
        // Check for email verification required error in multiple ways
        const isEmailVerificationError = 
          (err && err.status === 403) || // HTTP 403 status
          (err && err.message && err.message.toLowerCase().includes('verification')) || // Error message contains verification
          (err && err.data && err.data.error && err.data.error.toLowerCase().includes('verification')) || // Server error response
          (err && String(err).toLowerCase().includes('verification')); // Fallback check
          
        console.log('Is email verification error:', isEmailVerificationError);
          
        if (isEmailVerificationError) {
          // Show email verification modal instead of just showing an alert
          console.log('Showing email verification modal...');
          setShowVerifyModal(true);
          return; // Don't navigate to next step when showing verification modal
        } else if (err && err.data && err.data.error) {
          Alert.alert('Payment error', String(err.data.error));
        } else if (err && err.message) {
          Alert.alert('Payment error', String(err.message));
        } else {
          Alert.alert('Payment', 'Unable to start checkout. You can continue and set up billing later.');
        }
        
        // Reset the plan selection since payment failed
        setOB((prev) => ({ ...prev, plan: 'rookie', payment_pending: false }));
        navigateNext();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSelectPlan = (selectedPlan: Plan) => {
    setPlan(selectedPlan);
    setOB((prev) => ({ ...prev, plan: selectedPlan }));
  };

  return (
    <OnboardingLayout
      step={3}
      title="Choose Your Plan"
      subtitle="Select the plan that fits your needs"
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.content}>
        {PLAN_OPTIONS.map((option) => (
          <PlanCard
            key={option.id}
            option={option}
            selected={plan === option.id}
            onPress={() => handleSelectPlan(option.id)}
            onContinue={plan === option.id ? onContinue : undefined}
            saving={saving}
          />
        ))}
      </View>

      {/* Email Verification Modal */}
      <Modal
        visible={showVerifyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVerifyModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: isDark ? '#1F2937' : 'white' }]}>
              <Text style={[styles.modalTitle, { color: isDark ? '#F9FAFB' : '#111827' }]}>Verify Your Email</Text>
              <Text style={[styles.modalSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                Please verify your email before purchasing a plan. Enter the 6-digit code we sent to your email.
              </Text>
              
              {verificationError ? (
                <Text style={styles.errorText}>{verificationError}</Text>
              ) : null}
              
              {verificationInfo ? (
                <Text style={styles.infoText}>{verificationInfo}</Text>
              ) : null}
              
              <TextInput
                style={[
                  styles.codeInput,
                  { 
                    borderColor: isDark ? '#374151' : '#E5E7EB',
                    backgroundColor: isDark ? '#111827' : 'white',
                    color: isDark ? '#F9FAFB' : '#111827'
                  }
                ]}
                placeholder="Enter 6-digit code"
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                value={verificationCode}
              onChangeText={setVerificationCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.verifyButton, { backgroundColor: isDark ? '#2563EB' : '#111827' }]}
                onPress={onVerifyEmail}
                disabled={verifying || verificationCode.trim().length < 4}
              >
                {verifying ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.verifyButtonText}>Verify & Continue</Text>
                )}
              </Pressable>
              
              <Pressable
                style={[
                  styles.modalButton, 
                  styles.resendButton,
                  { 
                    backgroundColor: isDark ? '#374151' : '#F3F4F6',
                    borderColor: isDark ? '#4B5563' : '#E5E7EB'
                  }
                ]}
                onPress={onResendCode}
                disabled={resending}
              >
                {resending ? (
                  <ActivityIndicator size="small" color={isDark ? '#F9FAFB' : '#111827'} />
                ) : (
                  <Text style={[styles.resendButtonText, { color: isDark ? '#F9FAFB' : '#111827' }]}>Resend Code</Text>
                )}
              </Pressable>
              
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowVerifyModal(false);
                  setVerificationCode('');
                  setVerificationError(null);
                  setVerificationInfo(null);
                }}
              >
                <Text style={[styles.cancelButtonText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
              First 2 teams are always free. Veteran plan is $2.50/month for each additional team beyond the first two.
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
                ${((teamCount - 2) * 2.50).toFixed(2)}/month
              </Text>
              <Text style={[styles.pricingSubtext, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                (2 free + {teamCount - 2} × $2.50)
              </Text>
            </View>
            
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.verifyButton, { backgroundColor: isDark ? '#2563EB' : '#111827' }]}
                onPress={() => {
                  setShowTeamCountModal(false);
                  onContinue();
                }}
              >
                <Text style={styles.verifyButtonText}>Continue to Checkout</Text>
              </Pressable>
              
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowTeamCountModal(false);
                  setPlan(null);
                  setOB((prev) => ({ ...prev, plan: null }));
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
  benefitItem: {},
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
  codeInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorText: {
    color: '#B91C1C',
    textAlign: 'center',
    marginBottom: 12,
  },
  infoText: {
    color: '#065F46',
    textAlign: 'center',
    marginBottom: 12,
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
  resendButton: {
    borderWidth: 1,
  },
  resendButtonText: {
    fontWeight: '600',
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

