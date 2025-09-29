import PrimaryButton from '@/ui/PrimaryButton';
import { Type } from '@/ui/tokens';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { Subscriptions, User } from '@/api/entities';
import { useOnboarding } from '@/context/OnboardingContext';

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
    description: 'Perfect for trying VarsityHub with a single team.',
    extraNote: 'Upgrade any time to unlock organization management tools.',
    benefits: ['Create a league page', 'Invite team managers', 'Post updates'],
  },
  {
    id: 'veteran',
    title: 'Veteran',
    priceLabel: '$70 / year or $7.50 / month',
    description: 'Manage multiple teams with advanced analytics and support.',
    badge: 'Most Popular',
    extraNote: 'Stripe handles secure billing so you can focus on your program.',
    benefits: ['All Rookie features', 'Priority support', 'Advanced analytics'],
  },
  {
    id: 'legend',
    title: 'Legend',
    priceLabel: '$150 / year',
    description: 'Scale to multi-team organizations with custom branding.',
    benefits: ['All Veteran features', 'Multi-team management', 'Custom branding'],
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

  const navigateNext = () => {
    if (returnToConfirmation) {
      router.push({ pathname: '/onboarding/step-5-league', params: { returnToConfirmation: 'true' } });
    } else {
      router.push('/onboarding/step-5-league');
    }
  };

  const onContinue = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      // Prevent duplicate subscriptions: check current user's saved plan first
      try {
        const me: any = await User.me();
        const currentPlan = me?.preferences?.plan ?? null;
        // If the user already has a plan and it's not 'rookie', skip starting checkout
        if (currentPlan) {
          // If already subscribed to the same plan, warn and continue
          if (currentPlan === plan) {
            Alert.alert('Already subscribed', 'Our records show you already have this plan. No need to subscribe again.');
            navigateNext();
            return;
          }
          // If they have a paid plan already (any non-null), warn them and continue without starting a new checkout
          Alert.alert('Active plan detected', 'You already have an active subscription. If you need to change plans, manage your subscription in Settings.');
          navigateNext();
          return;
        }
      } catch (err) {
        // If we fail to fetch current user, continue to attempt subscription — we'll handle server errors during checkout.
        console.warn('Failed to check existing plan before checkout', err);
      }
      const pending = plan !== 'rookie';
      setOB((prev) => ({ ...prev, plan, payment_pending: pending }));
      try {
        await User.updatePreferences({ plan, payment_pending: pending });
      } catch (err) {
        console.warn('Failed to persist plan to backend:', err);
      }

      if (plan === 'rookie') {
        setProgress(4); // next is step-5-league (index 4)
        navigateNext();
        return;
      }

      try {
        const res: any = await Subscriptions.createCheckout(plan);
        if (res?.free) {
          setProgress(4);
          navigateNext();
          return;
        }
        if (res?.url) {
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
        if (err && err.status === 403) {
          Alert.alert('Payment blocked', 'Verify your email before purchasing a plan.');
        } else if (err && err.data && err.data.error) {
          Alert.alert('Payment error', String(err.data.error));
        } else if (err && err.message) {
          Alert.alert('Payment error', String(err.message));
        } else {
          Alert.alert('Payment', 'Unable to start checkout. You can continue and set up billing later.');
        }
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Step 3/10' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Choose Your Plan</Text>
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
      </ScrollView>
    </SafeAreaView>
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
});

