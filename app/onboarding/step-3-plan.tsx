import PrimaryButton from '@/ui/PrimaryButton';
import { Type } from '@/ui/tokens';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
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
    priceLabel: 'First two teams free',
    description: 'Perfect for getting started with your first teams',
    extraNote: 'Upgrade any time to unlock more teams and organization management tools.',
    benefits: [
      'Up to 2 teams',
      'Invite players',
      'Assign administrators',
      'Share team experience',
    ],
  },
  {
    id: 'veteran',
    title: 'Veteran',
    priceLabel: '$1.50 / month per team',
    description: 'Manage multiple teams with flexible per-team pricing.',
    badge: 'Most Popular',
    extraNote: 'Pay only for the teams you add beyond your first two. Stripe handles secure billing.',
    benefits: [
      'All Rookie features',
      'Add unlimited teams',
      'Priority support',
      'Per-team administrators',
      '🏆 Trophy emblem',
    ],
  },
  {
    id: 'legend',
    title: 'Legend',
    priceLabel: '$17.50 / year unlimited',
    description: 'Best value for multi-team organizations and established programs.',
    benefits: [
      'All Veteran features',
      'Unlimited teams included',
      'Unlimited administrators',
      '🥇 Gold medal emblem',
      'Custom branding',
      'Advanced analytics',
    ],
  },
];

function PlanCard({ option, selected, onPress }: { option: PlanOption; selected: boolean; onPress: () => void }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <Pressable onPress={onPress} style={[
      styles.card, 
      selected && styles.cardSelected,
      { borderColor: selected ? (isDark ? '#60A5FA' : '#111827') : (isDark ? '#374151' : '#E5E7EB') },
      { backgroundColor: selected ? (isDark ? '#1F2937' : '#FFFFFF') : (isDark ? '#111827' : '#F9FAFB') }
    ]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: isDark ? '#F9FAFB' : '#111827' }]}>{option.title}</Text>
        {option.badge ? (
          <Text style={[styles.badge, { 
            color: isDark ? '#F9FAFB' : '#111827',
            backgroundColor: isDark ? '#374151' : '#E5E7EB'
          }]}>
            {option.badge}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.price, { color: isDark ? '#F9FAFB' : '#111827' }]}>{option.priceLabel}</Text>
      <Text style={[styles.muted, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{option.description}</Text>
      <View style={styles.benefitsList}>
        {option.benefits.map((benefit) => (
          <Text key={benefit} style={[styles.benefitItem, { color: isDark ? '#34D399' : '#16A34A' }]}>{`- ${benefit}`}</Text>
        ))}
      </View>
      {option.extraNote ? (
        <Text style={[styles.extraNote, { color: isDark ? '#9CA3AF' : '#374151' }]}>{option.extraNote}</Text>
      ) : null}
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
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
      router.push('/onboarding/step-4-season');
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
        setProgress(3);
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
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  title: { ...(Type.h1 as any), marginBottom: 12, textAlign: 'center' },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  cardSelected: {},
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
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
  price: { fontWeight: '700', marginBottom: 4 },
  benefitsList: { marginTop: 8, gap: 4 },
  benefitItem: {},
  extraNote: { marginTop: 8, fontSize: 12 },
  
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
});

