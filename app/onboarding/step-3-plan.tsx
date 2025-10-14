import PrimaryButton from '@/ui/PrimaryButton';
import { Type } from '@/ui/tokens';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
// @ts-ignore
import { Subscriptions, User } from '@/api/entities';
import { useOnboarding } from '@/context/OnboardingContext';
import { OnboardingLayout } from './components/OnboardingLayout';

type Plan = 'rookie' | 'veteran' | 'legend';

type PlanOption = {
  id: Plan;
  title: string;
  priceLabel: string;
  description: string;
  badge?: string;
  extraNote?: string;
  benefits: string[];
};

const PLAN_OPTIONS: PlanOption[] = [
  {
    id: 'rookie',
    title: 'Rookie',
    priceLabel: 'Free for the first 6-month season',
    description: 'Perfect for your first team page (e.g., Women\'s & Men\'s Soccer)',
    extraNote: 'Upgrade any time to unlock organization management tools.',
    benefits: [
      'Create a team page',
      'Invite players',
      'Assign administrators',
      'Share team experience',
    ],
  },
  {
    id: 'veteran',
    title: 'Veteran',
    priceLabel: '$70 / year or $7.50 / month',
    description: 'Manage multiple teams with advanced analytics and support.',
    badge: 'Most Popular',
    extraNote: 'Stripe handles secure billing so you can focus on your program.',
    benefits: [
      'All Rookie features',
      'Priority support',
      'Add administrator per team added',
      '🏆 Trophy emblem',
    ],
  },
  {
    id: 'legend',
    title: 'Legend',
    priceLabel: '$150 / year',
    description: 'Scale to multi-team organizations with custom branding.',
    benefits: [
      'All Veteran features',
      'Unlimited teams/administrators',
      '🥇 Gold medal emblem',
      'Custom branding',
    ],
  },
];

function PlanCard({ option, selected, onPress }: { option: PlanOption; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.card, selected && styles.cardSelected]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{option.title}</Text>
        {option.badge ? <Text style={styles.badge}>{option.badge}</Text> : null}
      </View>
      <Text style={styles.price}>{option.priceLabel}</Text>
      <Text style={styles.muted}>{option.description}</Text>
      <View style={styles.benefitsList}>
        {option.benefits.map((benefit) => (
          <Text key={benefit} style={styles.benefitItem}>{`- ${benefit}`}</Text>
        ))}
      </View>
      {option.extraNote ? <Text style={styles.extraNote}>{option.extraNote}</Text> : null}
    </Pressable>
  );
}

export default function Step3Plan() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnToConfirmation?: string }>();
  const returnToConfirmation = params.returnToConfirmation === 'true';
  const { state: ob, setState: setOB, setProgress } = useOnboarding();
  const [plan, setPlan] = useState<Plan | null>(ob.plan ?? null);
  const [saving, setSaving] = useState(false);
  
  // Email verification states
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationInfo, setVerificationInfo] = useState<string | null>(null);

  const navigateNext = () => {
    if (returnToConfirmation) {
      router.push({ pathname: '/onboarding/step-5-league', params: { returnToConfirmation: 'true' } });
    } else {
      router.push('/onboarding/step-5-league');
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
        setProgress(4); // next is step-5-league (index 4)
        navigateNext();
        return;
      }

      // For paid plans, DON'T save the plan until after successful payment
      // Only save to local onboarding context for UI purposes
      setOB((prev) => ({ ...prev, plan, payment_pending: true }));

      try {
        const res: any = await Subscriptions.createCheckout(plan);
        if (res?.free) {
          // If marked as free, save the plan now
          try {
            await User.updatePreferences({ plan, payment_pending: false });
          } catch (err) {
            console.warn('Failed to persist free plan to backend:', err);
          }
          setProgress(4);
          navigateNext();
          return;
        }
        if (res?.url) {
          // Stripe checkout was successful, user will pay through Stripe
          // The plan will be saved by the payment finalization process
          await WebBrowser.openBrowserAsync(String(res.url));
          setProgress(4);
          navigateNext();
          return;
        }
        console.warn('Unexpected subscribe response', res);
        Alert.alert('Payment', 'Unable to start checkout. You can continue and set up billing later.');
        setProgress(4);
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
      {PLAN_OPTIONS.map((option) => (
        <PlanCard
          key={option.id}
          option={option}
          selected={plan === option.id}
          onPress={() => handleSelectPlan(option.id)}
        />
      ))}
      {plan ? (
        <PrimaryButton
          label={saving ? 'Saving...' : 'Continue'}
          onPress={onContinue}
          disabled={saving}
          loading={saving}
        />
      ) : null}

      {/* Email Verification Modal */}
      <Modal
        visible={showVerifyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVerifyModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Verify Your Email</Text>
              <Text style={styles.modalSubtitle}>
                Please verify your email before purchasing a plan. Enter the 6-digit code we sent to your email.
              </Text>
              
              {verificationError ? (
                <Text style={styles.errorText}>{verificationError}</Text>
              ) : null}
              
              {verificationInfo ? (
                <Text style={styles.infoText}>{verificationInfo}</Text>
              ) : null}
              
              <TextInput
                style={styles.codeInput}
                placeholder="Enter 6-digit code"
                value={verificationCode}
              onChangeText={setVerificationCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.verifyButton]}
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
                style={[styles.modalButton, styles.resendButton]}
                onPress={onResendCode}
                disabled={resending}
              >
                {resending ? (
                  <ActivityIndicator size="small" color="#111827" />
                ) : (
                  <Text style={styles.resendButtonText}>Resend Code</Text>
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
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  content: { padding: 16, paddingBottom: 28 },
  title: { ...(Type.h1 as any), marginBottom: 12, textAlign: 'center' },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
  },
  cardSelected: {
    borderColor: '#111827',
    backgroundColor: '#FFFFFF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: { fontWeight: '800', fontSize: 16 },
  muted: { color: '#6B7280', marginTop: 4 },
  badge: {
    color: '#111827',
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
    fontWeight: '700',
  },
  price: { fontWeight: '700', marginBottom: 4 },
  benefitsList: { marginTop: 8, gap: 4 },
  benefitItem: { color: '#16A34A' },
  extraNote: { marginTop: 8, color: '#374151', fontSize: 12 },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
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
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  codeInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
  verifyButton: {
    backgroundColor: '#111827',
  },
  verifyButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  resendButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  resendButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontWeight: '600',
  },
});

