/**
 * Coach Subscription Paywall
 *
 * iOS: Uses Apple IAP (react-native-iap) for veteran_vhub / Legend_vhub
 * Android: Uses Google Play Billing (react-native-iap) for veteran_vhub / Legend_vhub
 * Web/fallback: Uses Stripe Payment Sheets
 */

import { httpPost } from '@/api/http';
// @ts-ignore
import { User } from '@/api/entities';
import { CoachTier, CoachTierBadge, CoachTierBenefits } from '@/components/CoachTierBadge';
import CustomActionModal from '@/components/CustomActionModal';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useVHubIAP } from '@/hooks/useIAP';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { usePaymentSheet } from '@stripe/stripe-react-native';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const isIOS = Platform.OS === 'ios';

export default function SubscriptionPaywallScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const [selectedTier, setSelectedTier] = useState<CoachTier>('veteran');
  const [loading, setLoading] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const availableTiers: CoachTier[] = ['rookie', 'veteran', 'legend'];

  // Rule A: Pre-select the coach's pending_plan if they were sent here after admin approval
  useEffect(() => {
    void (async () => {
      try {
        const me: any = await User.me();
        const pp = me?.preferences?.pending_plan;
        if (pp === 'veteran' || pp === 'legend') {
          setSelectedTier(pp);
        }
      } catch { /* ignore */ }
    })();
  }, []);
  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();
  const { connected: iapConnected, purchasing: iapPurchasing, purchase: iapPurchase, getProduct, error: iapError } = useVHubIAP();
  const [modal, setModal] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    options: Array<{ label: string; onPress: () => void; color?: string }>;
  } | null>(null);

  // Get IAP price string for display (iOS and Android)
  const getIAPPrice = (tier: 'veteran' | 'legend'): string | null => {
    const product = getProduct(tier);
    return product?.displayPrice || null;
  };

  const handleSubscribe = async () => {
    if (selectedTier === 'rookie') {
      if (router.canGoBack()) router.back();
      else router.push('/(tabs)' as any);
      return;
    }

    // iOS and Android: Use native IAP (Apple IAP / Google Play Billing)
    if (isIOS || Platform.OS === 'android') {
      if (!iapConnected) {
        setModal({
          visible: true,
          title: 'Store Unavailable',
          message: isIOS
            ? 'Unable to connect to the App Store. Please try again later.'
            : 'Unable to connect to Google Play. Please try again later.',
          options: [{ label: 'OK', onPress: () => setModal(null), color: '#2563EB' }],
        });
        return;
      }

      setLoading(true);
      try {
        const success = await iapPurchase(selectedTier as 'veteran' | 'legend');
        if (success) {
          Alert.alert('Success', 'Your subscription is now active!', [
            { text: 'OK', onPress: () => {
              if (router.canGoBack()) router.back();
              else router.push('/(tabs)' as any);
            }},
          ]);
        }
      } catch (err: any) {
        setModal({
          visible: true,
          title: 'Purchase Failed',
          message: err?.message || 'Unable to complete purchase. Please try again.',
          options: [{ label: 'OK', onPress: () => setModal(null), color: '#DC2626' }],
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    // Web/fallback: Use Stripe PaymentSheet
    setLoading(true);
    try {
      const data: any = await httpPost('/payments/create-payment-sheet', {
        plan: selectedTier,
        promo_code: promoCode.trim() || undefined
      });

      if (data?.paymentIntent) {
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: data.paymentIntent,
          customerEphemeralKeySecret: data.ephemeralKey,
          customerId: data.customer,
          merchantDisplayName: 'Varsity Hub',
          paymentMethodOrder: ['card'],
        });
        if (initError) {
          Alert.alert('Error', initError.message);
          return;
        }
        const { error } = await presentPaymentSheet();
        if (error) {
          if (error.code !== 'Canceled') Alert.alert('Payment Failed', error.message);
          // Clean up: cancel the incomplete PaymentIntent so the subscription doesn't linger
          if (data.payment_intent_id) {
            httpPost('/payments/cancel-intent', { payment_intent_id: data.payment_intent_id }).catch(() => {});
          }
          return;
        }
        // Poll for plan activation (webhook may take a moment)
        let planActivated = false;
        for (let i = 0; i < 5; i++) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const me: any = await User.me();
            if (me?.preferences?.plan && !me?.preferences?.payment_pending) {
              planActivated = true;
              break;
            }
          } catch { /* ignore */ }
        }
        if (!planActivated) {
          Alert.alert('Payment Received', 'Your subscription is being processed. It may take a moment to activate.');
        }
        if (router.canGoBack()) router.back();
        else router.push('/(tabs)' as any);
      } else {
        throw new Error('No payment sheet data received');
      }
    } catch (error) {
      if (__DEV__) console.error('Subscription error:', error);
      const raw = (error as any)?.data?.error || (error as any)?.message || '';
      const safeMsg = /prod_|price_/i.test(raw) ? 'Unable to process subscription. Please try again or contact support.' : (raw || 'Unable to process subscription. Please try again.');
      setModal({
        visible: true,
        title: 'Error',
        message: safeMsg,
        options: [{ label: 'OK', onPress: () => setModal(null), color: '#DC2626' }],
      });
    } finally {
      setLoading(false);
    }
  };

  const isProcessing = loading || iapPurchasing;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Stack.Screen options={{
        title: 'Choose Your Plan',
        headerLeft: () => (
          <Pressable onPress={() => { if (router.canGoBack()) router.back(); }} style={{ paddingLeft: 8 }}>
            <MaterialIcons name="chevron-left" size={24} color="#3B82F6" />
          </Pressable>
        ),
      }} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
            Choose Your Coaching Plan
          </Text>
          <Text style={[styles.subtitle, { color: '#6B7280' }]}>
            Select the plan that fits your program's needs
          </Text>
        </View>

        {/* IAP Error Banner */}
        {(isIOS || Platform.OS === 'android') && iapError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{iapError}</Text>
          </View>
        ) : null}

        {/* Tier Selection Pills */}
        <View style={styles.tierSelector}>
          {availableTiers.map((tier) => (
            <Pressable
              key={tier}
              style={[
                styles.tierPill,
                selectedTier === tier && styles.tierPillSelected,
                selectedTier === tier && { borderColor: getTierColor(tier) },
              ]}
              onPress={() => setSelectedTier(tier)}
            >
              <CoachTierBadge tier={tier} size="small" showLabel={true} />
              {tier === 'legend' && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>BEST VALUE</Text>
                </View>
              )}
              {(isIOS || Platform.OS === 'android') && tier !== 'rookie' && getIAPPrice(tier as 'veteran' | 'legend') ? (
                <Text style={styles.iapPriceText}>
                  {getIAPPrice(tier as 'veteran' | 'legend')}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>

        {/* Selected Tier Benefits */}
        <View style={styles.benefitsSection}>
          <CoachTierBenefits tier={selectedTier} compact={false} />
        </View>

        {/* Comparison Table */}
        <View style={styles.comparisonSection}>
          <Text style={[styles.comparisonTitle, { color: Colors[colorScheme].text }]}>
            Compare Plans
          </Text>

          <View style={styles.comparisonTable}>
            {/* Header Row */}
            <View style={[styles.comparisonRow, styles.comparisonHeader]}>
              <View style={styles.comparisonFeature}>
                <Text style={[styles.comparisonHeaderText, { color: Colors[colorScheme].mutedText }]}>Feature</Text>
              </View>
              <View style={styles.comparisonTier}>
                <Text style={[styles.comparisonHeaderText, { color: Colors[colorScheme].mutedText }]}>Rookie</Text>
              </View>
              <View style={styles.comparisonTier}>
                <Text style={[styles.comparisonHeaderText, { color: Colors[colorScheme].mutedText }]}>Veteran</Text>
              </View>
              <View style={styles.comparisonTier}>
                <Text style={[styles.comparisonHeaderText, { color: Colors[colorScheme].mutedText }]}>Legend</Text>
              </View>
            </View>

            {/* Feature Rows */}
            {comparisonFeatures.map((feature, index) => (
              <View
                key={index}
                style={[styles.comparisonRow, index % 2 === 0 && styles.comparisonRowAlt]}
              >
                <View style={styles.comparisonFeature}>
                  <Text style={[styles.comparisonFeatureText, { color: Colors[colorScheme].text }]}>{feature.name}</Text>
                </View>
                <View style={styles.comparisonTier}>
                  {renderFeatureValue(feature.rookie, colorScheme)}
                </View>
                <View style={styles.comparisonTier}>
                  {renderFeatureValue(feature.veteran, colorScheme)}
                </View>
                <View style={styles.comparisonTier}>
                  {renderFeatureValue(feature.legend, colorScheme)}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Promo Code Section — web/fallback only (Apple/Google don't allow promo codes through IAP) */}
        {!isIOS && Platform.OS !== 'android' && selectedTier !== 'rookie' && (
          <View style={styles.promoSection}>
            <Text style={[styles.promoLabel, { color: Colors[colorScheme].text }]}>
              Have a promo code?
            </Text>
            <View style={styles.promoInputContainer}>
              <TextInput
                style={[
                  styles.promoInput,
                  {
                    backgroundColor: Colors[colorScheme].background,
                    color: Colors[colorScheme].text,
                    borderColor: '#D1D5DB',
                  },
                ]}
                placeholder="Enter code"
                placeholderTextColor="#9CA3AF"
                value={promoCode}
                onChangeText={setPromoCode}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isProcessing}
              />
            </View>
            <Text style={styles.promoHint}>
              Promo codes will be applied at checkout
            </Text>
          </View>
        )}

        {/* CTA Button */}
        <View style={styles.ctaSection}>
          <Pressable
            style={[
              styles.ctaButton,
              { backgroundColor: getTierColor(selectedTier) },
              isProcessing && styles.ctaButtonDisabled,
            ]}
            onPress={handleSubscribe}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.ctaButtonText}>
                  {selectedTier === 'rookie' ? 'Continue with Free Plan' : `Upgrade to ${capitalize(selectedTier)}`}
                </Text>
                {selectedTier !== 'rookie' && (
                  <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
                )}
              </>
            )}
          </Pressable>

          <Text style={[styles.ctaSubtext, { color: '#6B7280' }]}>
            {selectedTier === 'legend' && 'Billed annually • Cancel anytime'}
            {selectedTier === 'veteran' && 'Billed monthly per team • Cancel anytime'}
            {selectedTier === 'rookie' && 'Free • No credit card required'}
          </Text>

          {isIOS && selectedTier !== 'rookie' && (
            <Text style={[styles.ctaSubtext, { color: '#9CA3AF', fontSize: 11, marginTop: 4 }]}>
              Payment will be charged to your Apple ID account. Subscription automatically renews unless canceled at least 24 hours before the end of the current period. Manage subscriptions in Settings.
            </Text>
          )}
          {Platform.OS === 'android' && selectedTier !== 'rookie' && (
            <Text style={[styles.ctaSubtext, { color: '#9CA3AF', fontSize: 11, marginTop: 4 }]}>
              Payment will be charged to your Google Play account. Subscription automatically renews unless canceled at least 24 hours before the end of the current period. Manage subscriptions in Google Play.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Action Modal */}
      {modal && (
        <CustomActionModal
          visible={modal.visible}
          title={modal.title}
          message={modal.message}
          options={modal.options}
          onClose={() => setModal(null)}
        />
      )}
    </SafeAreaView>
  );
}

// Helper functions
function getTierColor(tier: CoachTier): string {
  switch (tier) {
    case 'legend':
      return '#FFD700';
    case 'veteran':
      return '#C0C0C0';
    case 'rookie':
    default:
      return '#CD7F32';
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function renderFeatureValue(value: string | boolean, scheme: 'light' | 'dark' = 'light') {
  if (typeof value === 'boolean') {
    return value ? (
      <MaterialIcons name="check-circle" size={20} color="#10B981" />
    ) : (
      <MaterialIcons name="cancel" size={20} color="#EF4444" />
    );
  }
  return <Text style={[styles.comparisonValueText, { color: Colors[scheme].mutedText }]}>{value}</Text>;
}

// Comparison table data
const comparisonFeatures = [
  { name: 'Teams', rookie: '2', veteran: 'Unlimited', legend: 'Unlimited' },
  { name: 'Priority Support', rookie: false, veteran: false, legend: true },
  { name: 'Dedicated Admin', rookie: false, veteran: true, legend: true },
  { name: 'Profile Badge', rookie: false, veteran: true, legend: true },
  { name: 'Advanced Analytics', rookie: false, veteran: false, legend: true },
  { name: 'Custom Branding', rookie: false, veteran: false, legend: true },
  { name: 'Import/Export', rookie: false, veteran: false, legend: true },
];

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
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center',
  },
  tierSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  tierPill: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    position: 'relative',
  },
  tierPillSelected: {
    borderWidth: 2,
    backgroundColor: '#F9FAFB',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  popularText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  iapPriceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 4,
  },
  benefitsSection: {
    marginBottom: 24,
  },
  comparisonSection: {
    marginBottom: 24,
  },
  comparisonTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  comparisonTable: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  comparisonRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  comparisonRowAlt: {
    backgroundColor: '#F9FAFB',
  },
  comparisonHeader: {
    backgroundColor: '#F3F4F6',
  },
  comparisonFeature: {
    flex: 2,
    padding: 12,
    justifyContent: 'center',
  },
  comparisonTier: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparisonHeaderText: {
    fontSize: 12,
    fontWeight: '700',
  },
  comparisonFeatureText: {
    fontSize: 13,
  },
  comparisonValueText: {
    fontSize: 13,
    fontWeight: '600',
  },
  promoSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  promoLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  promoInputContainer: {
    marginBottom: 8,
  },
  promoInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  promoHint: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  ctaSection: {
    alignItems: 'center',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    minHeight: 56,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ctaSubtext: {
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
});
