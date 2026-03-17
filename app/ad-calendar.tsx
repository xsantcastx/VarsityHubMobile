import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { usePaymentSheet } from '@stripe/stripe-react-native';
import React, { useMemo, useRef, useState } from 'react';
import { useAdIAP } from '@/hooks/useAdIAP';
import { ActivityIndicator, Alert, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
// @ts-ignore
import { httpPost } from '@/api/http';
import { addWeeks, format, startOfToday } from 'date-fns';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { Calendar, DateData } from 'react-native-calendars';
// @ts-ignore JS exports
import { Advertisement, Payments } from '@/api/entities';
import { getConfig } from '@/config/env';

const weekdayRate = 5.00;   // Per week (Mon-Thu slot)
const weekendRate = 8.00;   // Per week (Fri-Sun slot)

const todayISO = (): string => format(startOfToday(), 'yyyy-MM-dd');
const maxDateISO = (): string => format(addWeeks(startOfToday(), 8), 'yyyy-MM-dd');

function _toggleSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

function getDayOfWeek(dateISO: string): number {
  return new Date(dateISO + 'T00:00:00').getDay();
}

function getWeekSlotDates(dateISO: string): string[] {
  // Returns all dates in the same week slot (Mon-Thu or Fri-Sun). Use UTC to match server adPricing.
  const date = new Date(dateISO + 'T00:00:00.000Z');
  const dow = date.getUTCDay();
  const dates: string[] = [];
  
  if (dow >= 1 && dow <= 4) {
    // Weekday slot: Mon-Thu
    const daysFromMonday = dow - 1;
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - daysFromMonday);
    
    for (let i = 0; i < 4; i++) {
      const day = new Date(monday);
      day.setUTCDate(monday.getUTCDate() + i);
      dates.push(day.toISOString().slice(0, 10));
    }
  } else {
    let friday: Date;
    if (dow === 5) friday = new Date(date);
    else if (dow === 6) {
      friday = new Date(date);
      friday.setUTCDate(date.getUTCDate() - 1);
    } else {
      friday = new Date(date);
      friday.setUTCDate(date.getUTCDate() - 2);
    }
    for (let i = 0; i < 3; i++) {
      const day = new Date(friday);
      day.setUTCDate(friday.getUTCDate() + i);
      dates.push(day.toISOString().slice(0, 10));
    }
  }
  
  return dates;
}

function getWeekIdentifier(dateISO: string): string {
  // Use UTC to match server adPricing.calculateAdPriceCents
  const date = new Date(dateISO + 'T00:00:00.000Z');
  const dow = date.getUTCDay();
  if (dow >= 1 && dow <= 4) {
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - (dow - 1));
    return `${monday.toISOString().slice(0, 10)}-weekday`;
  }
  let friday = new Date(date);
  if (dow === 5) { /* already Friday */ }
  else if (dow === 6) friday.setUTCDate(date.getUTCDate() - 1);
  else friday.setUTCDate(date.getUTCDate() - 2);
  return `${friday.toISOString().slice(0, 10)}-weekend`;
}

function calculatePrice(selectedISO: Set<string>): number {
  const { weekdayBlocks, weekendBlocks } = getAdBlocks(selectedISO);
  return weekdayBlocks * weekdayRate + weekendBlocks * weekendRate;
}

function getAdBlocks(selectedISO: Set<string>): { weekdayBlocks: number; weekendBlocks: number } {
  if (selectedISO.size === 0) return { weekdayBlocks: 0, weekendBlocks: 0 };
  const weekSlots = new Set<string>();
  for (const d of selectedISO) weekSlots.add(getWeekIdentifier(d));
  let weekdayBlocks = 0;
  let weekendBlocks = 0;
  for (const slot of weekSlots) {
    if (slot.endsWith('-weekday')) weekdayBlocks++;
    else weekendBlocks++;
  }
  return { weekdayBlocks, weekendBlocks };
}

export default function AdCalendarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ adId?: string }>();
  const adId = Array.isArray(params.adId) ? params.adId[0] : params.adId || '';
  const colorScheme = useColorScheme() ?? 'light';

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { setDirty } = useUnsavedChanges({
    title: 'Discard Selection?',
    message: 'You have dates selected. Are you sure you want to go back?',
  });

  // Keep dirty state in sync with date selection
  React.useEffect(() => {
    setDirty(selected.size > 0);
  }, [selected, setDirty]);

  const [submitting, setSubmitting] = useState(false);
  const [reserved, setReserved] = useState<Set<string>>(new Set());
  const [fullDates, setFullDates] = useState<Set<string>>(new Set()); // Dates with 2/2 slots filled
  const [_dateAvailability, setDateAvailability] = useState<Record<string, { slotsUsed: number; slotsRemaining: number }>>({});
  const [promo, setPromo] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [_taxRate, _setTaxRate] = useState(0); // Tax rate as decimal
  const [zipCode, setZipCode] = useState<string>('');
  const [alternatives, setAlternatives] = useState<Array<{ zip: string; distance: number }>>([]);
  const [showingAlternatives, setShowingAlternatives] = useState(false);
  const [paymentsStatus, setPaymentsStatus] = useState<{ stripe_configured?: boolean; has_webhook_secret?: boolean } | null>(null);
  const [paymentsStatusLoading, setPaymentsStatusLoading] = useState(true);
  const [paymentsStatusError, setPaymentsStatusError] = useState<string | null>(null);
  const [showFreeSuccess, setShowFreeSuccess] = useState(false);
  const [adStatus, setAdStatus] = useState<string | null>(null);
  const freeSuccessOpacity = useRef(new Animated.Value(0)).current;
  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();
  const { purchaseAd } = useAdIAP();
  
  // Load reserved dates for THIS ad only (allow other ads to share dates)
  // AND load date availability to block fully booked dates
  React.useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        if (!adId) {
          // No adId yet (new ad flow) => nothing to disable
          if (mounted) setReserved(new Set());
          return;
        }
        const res: any = await Advertisement.reservationsForAd(String(adId));
        if (!mounted) return;
        const dates = Array.isArray(res?.dates) ? res.dates : [];
        setReserved(new Set<string>(dates));
        
        // Get zip code from ad details and load availability
        if (adId) {
          try {
            const adDetails: any = await Advertisement.get(String(adId));
            if (mounted && adDetails?.status) setAdStatus(adDetails.status);
            if (adDetails?.target_zip_code) {
              setZipCode(adDetails.target_zip_code);
              await loadAvailability(adDetails.target_zip_code);
            }
            if (mounted && adDetails?.status === 'approved' && dates.length > 0) {
              setSelected(new Set(dates));
            }
          } catch {
            // Non-critical — calendar still works without availability
          }
        }
      } catch {
        if (mounted) setReserved(new Set());
      }
    })();
    return () => { mounted = false; };
  }, [adId]);

  React.useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const status = await Payments.configStatus();
        if (!mounted) return;
        setPaymentsStatus(status);
        setPaymentsStatusError(null);
      } catch {
        if (!mounted) return;
        setPaymentsStatusError('Unable to confirm payment readiness right now.');
      } finally {
        if (mounted) setPaymentsStatusLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const loadAvailability = async (zip: string) => {
    try {
      const from = todayISO();
      const to = maxDateISO();
      
      const { httpGet } = await import('@/api/http');
      const data = await httpGet(`/ads/availability?zip=${encodeURIComponent(zip)}&from=${from}&to=${to}`);
      
      if (data?.availability) {
        const fullDatesSet = new Set<string>();
        const availabilityMap: Record<string, { slotsUsed: number; slotsRemaining: number }> = {};
        
        Object.entries(data.availability).forEach(([dateISO, info]: [string, any]) => {
          availabilityMap[dateISO] = {
            slotsUsed: info.slotsUsed || 0,
            slotsRemaining: info.slotsRemaining || 0,
          };
          
          if (!info.available || info.slotsRemaining <= 0) {
            fullDatesSet.add(dateISO);
          }
        });
        
        setDateAvailability(availabilityMap);
        setFullDates(fullDatesSet);
      }
    } catch (e) {
      if (__DEV__) console.error('Error loading availability:', e);
    }
  };

  const price = useMemo(() => calculatePrice(selected), [selected]);
  const taxCents = useMemo(() => {
    // Simple client-side tax estimation (server will calculate exact amount)
    // This is just for display purposes
    if (!price || price <= 0) return 0;
    // Rough average US sales tax ~6.5%
    return Math.round(price * 100 * 0.065);
  }, [price]);
  const _priceWithTax = useMemo(() => price + (taxCents / 100), [price, taxCents]);
  const effectiveCents = useMemo(() => {
    const subtotalCents = Math.round(price * 100);
    const discount = preview?.valid ? (preview.discount_cents || 0) : 0;
    const afterDiscount = Math.max(0, subtotalCents - discount);
    return afterDiscount + taxCents;
  }, [price, taxCents, preview?.valid, preview?.discount_cents]);
  const effective = useMemo(() => (effectiveCents / 100), [effectiveCents]);
  const paymentsTemporarilyDisabled = paymentsStatus?.stripe_configured === false;
  const showPaymentsWarning = (!paymentsStatusLoading && paymentsTemporarilyDisabled) || (!!paymentsStatusError && !paymentsTemporarilyDisabled);
  const payButtonDisabled = submitting || selected.size === 0 || paymentsTemporarilyDisabled;
  const submitForApprovalDisabled = submitting || selected.size === 0;
  const isPending = adStatus === 'pending';
  const isApproved = adStatus === 'approved';
  const isDraft = adStatus === 'draft' || adStatus === null;
  const isActive = adStatus === 'active';
  const canPay = isApproved || isActive; // Once approved, no re-approval for future runs

  const theme = Colors[colorScheme];
  const marked = useMemo(() => {
    const obj: Record<string, { selected: boolean; selectedColor?: string } | { disabled: boolean } | any> = {};
    
    // PRIORITY 1: Mark fully booked dates (3/3 slots filled) - grey X so user is aware
    for (const d of fullDates) {
      // Don't override if user has already selected this date
      if (!selected.has(d)) {
        obj[d] = { 
          disabled: true, 
          disableTouchEvent: true,
          textColor: theme.mutedText,
          customStyles: {
            container: {
              backgroundColor: theme.surface,
              borderWidth: 2,
              borderColor: theme.border,
            },
            text: {
              color: theme.mutedText,
              textDecorationLine: 'line-through',
              fontWeight: '600',
            },
          },
          marked: true,
        };
      }
    }
    
    // PRIORITY 2: Mark reserved dates as disabled (user's own reservations)
    for (const d of reserved) {
      if (!selected.has(d)) {
        obj[d] = { 
          disabled: true, 
          disableTouchEvent: true,
          textColor: theme.mutedText,
          dotColor: theme.mutedText,
          marked: true,
          customStyles: {
            container: {
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
            },
            text: {
              color: theme.mutedText,
            },
          },
        };
      }
    }
    
    // PRIORITY 3: Mark selected dates with BRIGHT weekday/weekend colors - HIGHLIGHTED
    for (const d of selected) {
      const dow = getDayOfWeek(d);
      const isWeekend = dow === 0 || dow === 5 || dow === 6; // Sun, Fri, Sat
      obj[d] = { 
        selected: true, 
        selectedColor: isWeekend ? '#EA580C' : '#2563EB', // Bright Orange for weekend, Bright Blue for weekday
        selectedTextColor: '#FFFFFF',
        marked: true,
        dotColor: '#FFFFFF',
        customStyles: {
          container: {
            backgroundColor: isWeekend ? '#EA580C' : '#2563EB',
            borderWidth: 3,
            borderColor: isWeekend ? '#C2410C' : '#1D4ED8',
            borderRadius: 8,
          },
          text: {
            color: '#FFFFFF',
            fontWeight: '700',
          },
        },
      };
    }
    
    return obj;
  }, [selected, reserved, fullDates, theme]);

  const onDayPress = (day: DateData) => {
    const iso = day.dateString; // yyyy-MM-dd
    const today = todayISO();
    const maxDate = maxDateISO();
    
    // Prevent selection before today
    if (iso < today) {
      Alert.alert('Invalid Date', 'Please select a date today or in the future.');
      return;
    }
    
    // Prevent selection beyond 8 weeks
    if (iso > maxDate) {
      Alert.alert('Booking Limit', 'Ads can only be booked up to 8 weeks in advance to maintain predictable pricing.');
      return;
    }
    
    // Prevent selection of fully booked dates
    if (fullDates.has(iso)) {
      void fetchAlternativeZips([iso]).catch(() => {});
      Alert.alert(
        'Date Fully Booked', 
        'This date already has 2/2 ad slots filled. Check below for nearby available zip codes or select a different date.'
      );
      return;
    }
    
    // Prevent selection of reserved dates
    if (reserved.has(iso)) {
      // Fetch alternative zip codes
      void fetchAlternativeZips([iso]).catch(() => {});
      Alert.alert('Date Unavailable', 'This date is already reserved. Check below for nearby available zip codes.');
      return;
    }
    
    // Get all dates in this week slot (Mon-Thu or Fri-Sun)
    const weekSlotDates = getWeekSlotDates(iso);
    
    // Check if ANY date in the week slot is already selected
    const isAnySelected = weekSlotDates.some(d => selected.has(d));
    
    setSelected(prev => {
      const next = new Set(prev);
      
      if (isAnySelected) {
        // If any date in this week slot is selected, DESELECT the entire week slot
        weekSlotDates.forEach(d => next.delete(d));
      } else {
        // Otherwise, SELECT the entire week slot (only if dates are available)
        weekSlotDates.forEach(d => {
          // Only add if not reserved or fully booked
          if (!reserved.has(d) && !fullDates.has(d)) {
            next.add(d);
          }
        });
      }
      
      return next;
    });
  };

  const applyPromo = async () => {
    setPromoError(null);
    setPromoBusy(true);
    try {
      const subtotalCents = Math.round(price * 100);
      const { httpPost } = await import('@/api/http');
      const data = await httpPost('/promos/preview', { code: promo, subtotal_cents: subtotalCents, service: 'booking' });
      if (!data?.valid) { setPreview(null); setPromoError(data?.reason || 'invalid'); }
      else setPreview(data);
    } catch (e: any) {
      setPreview(null);
      setPromoError(e?.message || 'Failed to apply promo');
    } finally { setPromoBusy(false); }
  };

  const fetchAlternativeZips = async (dates: string[]) => {
    if (!zipCode || dates.length === 0) return;
    
    try {
      const { httpGet } = await import('@/api/http');
      const dateString = dates.join(',');
      const data = await httpGet(`/ads/alternative-zips?zip=${encodeURIComponent(zipCode)}&dates=${encodeURIComponent(dateString)}`);
      if (data?.alternatives && Array.isArray(data.alternatives)) {
        setAlternatives(data.alternatives);
        setShowingAlternatives(true);
      }
    } catch (e: any) {
      if (__DEV__) console.error('Error fetching alternative zips:', e);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!adId || selected.size === 0) {
      Alert.alert('Select at least one date');
      return;
    }
    if (adId.startsWith('local-')) {
      Alert.alert('Ad Not Saved', 'This ad was not saved to the server. Please go back and re-submit your ad.');
      return;
    }
    const maxDate = maxDateISO();
    const invalidDates = Array.from(selected).filter((date) => date > maxDate);
    if (invalidDates.length > 0) {
      Alert.alert('Booking Limit Exceeded', 'Some selected dates are beyond the 8-week booking window. Please remove them and try again.');
      return;
    }
    setSubmitting(true);
    try {
      const dates = Array.from(selected).sort((a, b) => (a < b ? -1 : 1));
      await Advertisement.submitForApproval(String(adId), dates);
      setAdStatus('pending');
      setReserved(new Set(dates));
      setSelected(new Set(dates));
      Alert.alert(
        'Submitted for Approval',
        'Your ad has been submitted for review. You\'ll be notified when approved — no charge until then.'
      );
    } catch (err: any) {
      if (__DEV__) console.error('Submit for approval failed:', err);
      const msg = err?.data?.error || err?.message || 'Failed to submit for approval. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayment = async () => {
    if (paymentsTemporarilyDisabled) {
      Alert.alert(
        'Payments Unavailable',
        'Ads checkout is temporarily disabled while payments are being configured. Please try again later.'
      );
      return;
    }

    if (!adId || selected.size === 0) {
      Alert.alert('Select at least one date');
      return;
    }

    if (Platform.OS === 'web') {
      Alert.alert(
        'Web checkout unavailable',
        'Ad payment checkout is currently supported in the mobile app only. Please continue on iOS or Android.'
      );
      return;
    }

    // Guard against local-only ad IDs that were never persisted to the server
    if (adId.startsWith('local-')) {
      Alert.alert('Ad Not Saved', 'This ad was not saved to the server. Please go back and re-submit your ad.');
      return;
    }
    
    // Validate 8-week limit on selected dates
    const maxDate = maxDateISO();
    const invalidDates = Array.from(selected).filter(date => date > maxDate);
    if (invalidDates.length > 0) {
      Alert.alert(
        'Booking Limit Exceeded', 
        'Some selected dates are beyond the 8-week booking window. Please remove them and try again.'
      );
      return;
    }

    // Stripe must be configured (backend, reconciliation, etc.)
    const stripeKey = getConfig().stripePublishableKey;
    if (!stripeKey || !stripeKey.startsWith('pk_')) {
      Alert.alert(
        'Payments Not Ready',
        'Payment configuration is missing. Please update the app or try again later.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const dates = Array.from(selected).sort((a, b) => (a < b ? -1 : 1));
      const data: any = await httpPost('/payments/create-payment-sheet', { ad_id: String(adId), dates, promo_code: promo || undefined });
      // Calculate exact hours remaining for receipt
      const lastEnd = new Date(dates[dates.length - 1] + 'T23:59:59');
      const hrsRemaining = Math.max(0, Math.round((lastEnd.getTime() - Date.now()) / 3600000));

      if (data?.free) {
        setSubmitting(false);
        setShowFreeSuccess(true);
        freeSuccessOpacity.setValue(0);
        Animated.timing(freeSuccessOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start(() => {
          setTimeout(() => {
            router.replace({ pathname: '/ad-confirmation', params: { ad_id: String(adId), selectedDates: dates.join(', '), totalAmount: '$0.00 (promo)', hoursRemaining: String(hrsRemaining) } });
          }, 1200);
        });
        return;
      }
      if (Platform.OS === 'ios') {
        // iOS: use Apple IAP
        const { weekdayBlocks, weekendBlocks } = getAdBlocks(selected);
        if (weekdayBlocks <= 0 && weekendBlocks <= 0) {
          throw new Error('No ad blocks to purchase');
        }
        const result = await purchaseAd({ adId: String(adId), dates, weekdayBlocks, weekendBlocks });
        setSubmitting(false);
        if (!result.ok) {
          if (result.error) Alert.alert('Payment Error', result.error);
          return;
        }
        const paidAmount = data?.amount_cents ? `$${(data.amount_cents / 100).toFixed(2)}` : `$${calculatePrice(selected).toFixed(2)}`;
        router.replace({ pathname: '/ad-confirmation', params: { ad_id: String(adId), selectedDates: dates.join(', '), hoursRemaining: String(hrsRemaining), totalAmount: paidAmount } });
        return;
      }

      if (data?.paymentIntent) {
        // Android: Stripe PaymentSheet
        let initError: any = null;
        const { error: err1 } = await initPaymentSheet({
          paymentIntentClientSecret: data.paymentIntent,
          customerEphemeralKeySecret: data.ephemeralKey,
          customerId: data.customer,
          merchantDisplayName: 'Varsity Hub',
          googlePay: { merchantCountryCode: 'US', testEnv: __DEV__ },
          allowsDelayedPaymentMethods: false,
        });
        initError = err1;

        if (initError) {
          if (__DEV__) console.warn('[AdCalendar] PaymentSheet init failed with Google Pay, retrying card-only:', initError.message);
          const { error: err2 } = await initPaymentSheet({
            paymentIntentClientSecret: data.paymentIntent,
            customerEphemeralKeySecret: data.ephemeralKey,
            customerId: data.customer,
            merchantDisplayName: 'Varsity Hub',
            allowsDelayedPaymentMethods: false,
          });
          initError = err2;
        }

        if (initError) {
          if (__DEV__) console.error('[AdCalendar] PaymentSheet init failed:', initError);
          Alert.alert('Payment Error', initError.message || 'Unable to initialize payment. Please try again.');
          setSubmitting(false);
          return;
        }
        const { error } = await presentPaymentSheet();
        if (error) {
          if (error.code !== 'Canceled') Alert.alert('Payment Failed', error.message);
          if (data.payment_intent_id) {
            httpPost('/payments/cancel-intent', { payment_intent_id: data.payment_intent_id }).catch(() => {});
          }
          return;
        }
        const paidAmount = data.amount_cents ? `$${(data.amount_cents / 100).toFixed(2)}` : undefined;
        router.replace({ pathname: '/ad-confirmation', params: { ad_id: String(adId), selectedDates: dates.join(', '), hoursRemaining: String(hrsRemaining), ...(paidAmount ? { totalAmount: paidAmount } : {}) } });
        return;
      }
      throw new Error('Unexpected checkout response');
    } catch (err: any) {
      if (__DEV__) console.error('Failed to start checkout:', err);
      const status = err?.status;
      const raw = err?.data?.error || err?.message || '';
      let title = 'Error';
      let msg: string;
      if (status === 403 && (raw === 'Email verification required' || /verification/i.test(raw))) {
        title = 'Verify Your Email';
        msg = 'Please verify your email before paying. Check your inbox for the verification link.';
      } else if (status === 403 && (raw === 'APPROVAL_REQUIRED' || /approval.*required|must be approved/i.test(raw))) {
        title = 'Approval Required';
        msg = 'Your ad must be approved before payment. You\'ll be notified when you can pay.';
      } else if (status === 401) {
        title = 'Session Expired';
        msg = 'Please sign in again to continue.';
      } else if (status === 500 && (raw === 'Stripe not configured' || /stripe.*config/i.test(raw))) {
        title = 'Payments Unavailable';
        msg = 'Payments are being configured. Please try again later.';
      } else if (status === 408 || err?.name === 'AbortError') {
        title = 'Connection Timeout';
        msg = 'The request timed out. Check your connection and try again.';
      } else if (!status && (raw?.includes('fetch') || raw?.includes('network') || raw?.includes('Network'))) {
        title = 'Connection Error';
        msg = 'Check your internet connection and try again.';
      } else if (/prod_|price_/i.test(raw)) {
        msg = 'An error occurred starting checkout. Please try again or contact support.';
      } else if (raw) {
        msg = raw;
      } else {
        msg = 'An error occurred starting checkout. Please try again.';
      }
      Alert.alert(title, msg);
    } finally {
      setSubmitting(false);
    }
  };

  const sortedDates = useMemo(
    () => Array.from(selected).sort((a, b) => (a < b ? -1 : 1)),
    [selected]
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ 
        title: 'Schedule Your Ad',
        headerShown: false // Use custom header with SafeAreaView
      }} />
      <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
        <View style={[styles.header, { 
          backgroundColor: Colors[colorScheme].card,
          borderBottomColor: Colors[colorScheme].border 
        }]}>
          <Pressable onPress={() => safeGoBack(router)} style={[styles.iconBtn, { backgroundColor: Colors[colorScheme].surface }]}>
            <Text style={[styles.iconBtnText, { color: Colors[colorScheme].text }]}>{'<'}</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]}>Schedule Your Ad</Text>
        </View>

        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
        {showPaymentsWarning && (
          <View
            style={[
              styles.paymentBanner,
              paymentsTemporarilyDisabled ? styles.paymentBannerError : styles.paymentBannerMuted,
            ]}
          >
            <Text
              style={[
                styles.paymentBannerTitle,
                { color: paymentsTemporarilyDisabled ? '#92400E' : Colors[colorScheme].text },
              ]}
            >
              {paymentsTemporarilyDisabled ? 'Payments unavailable' : 'Payment status unknown'}
            </Text>
            <Text
              style={[
                styles.paymentBannerText,
                { color: paymentsTemporarilyDisabled ? '#92400E' : Colors[colorScheme].mutedText },
              ]}
            >
              {paymentsTemporarilyDisabled
                ? 'Checkout is disabled until our payment provider is configured. Please try again later.'
                : paymentsStatusError || 'We could not confirm payment readiness. You can still attempt checkout, but it may fail until connectivity improves.'}
            </Text>
          </View>
        )}
        {zipCode && (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>📍</Text>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Coverage Area</Text>
            </View>
            <Text style={{ color: theme.text, fontSize: 14 }}>
              Your ad will reach approximately <Text style={{ fontWeight: '700' }}>6 miles</Text> around zip code <Text style={{ fontWeight: '700' }}>{zipCode}</Text>
            </Text>
          </View>
        )}
        
        {showingAlternatives && alternatives.length > 0 && (
          <View style={[styles.card, { backgroundColor: colorScheme === 'dark' ? '#422006' : '#FEF3C7', borderColor: colorScheme === 'dark' ? '#92400E' : '#FCD34D' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>⚠️</Text>
              <Text style={[styles.cardTitle, { color: colorScheme === 'dark' ? '#FDE68A' : '#92400E' }]}>Date Unavailable - Try Nearby Zips</Text>
            </View>
            <Text style={{ color: colorScheme === 'dark' ? '#FDE68A' : '#92400E', fontSize: 13, marginBottom: 8 }}>
              The selected date is booked for zip code {zipCode}. Here are nearby alternatives:
            </Text>
            {alternatives.map((alt, idx) => (
              <Pressable
                key={idx}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  backgroundColor: theme.card,
                  borderRadius: 8,
                  marginBottom: 6,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
                onPress={() => {
                  Alert.alert(
                    'Switch to Zip Code?',
                    `Would you like to create a new ad for zip code ${alt.zip} (${alt.distance} mi away)?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Switch',
                        onPress: () => {
                          router.replace(`/submit-ad?zip=${alt.zip}`);
                        },
                      },
                    ]
                  );
                }}
              >
                <View>
                  <Text style={{ fontWeight: '600', fontSize: 15, color: theme.text }}>{alt.zip}</Text>
                  <Text style={{ fontSize: 12, color: theme.mutedText }}>{alt.distance} miles away</Text>
                </View>
                <Text style={{ color: theme.tint, fontSize: 13 }}>View →</Text>
              </Pressable>
            ))}
          </View>
        )}
        
        <View style={[styles.card, { backgroundColor: Colors[colorScheme].card }]}>
          <Text style={[styles.cardTitle, { color: Colors[colorScheme].text }]}>Select Ad Campaign Dates</Text>
          <Text style={[styles.cardDesc, { color: Colors[colorScheme].mutedText }]}>Choose one or more dates to run your ad.</Text>

          {/* Color Legend */}
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#2563EB' }]} />
              <Text style={[styles.legendText, { color: Colors[colorScheme].text }]}>Weekday (Mon-Thu) - <Text style={{ fontWeight: '700' }}>${weekdayRate.toFixed(2)} total</Text></Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EA580C' }]} />
              <Text style={[styles.legendText, { color: Colors[colorScheme].text }]}>Weekend (Fri-Sun) - <Text style={{ fontWeight: '700' }}>${weekendRate.toFixed(2)} total</Text></Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.mutedText, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }]}>
                <MaterialIcons name="close" size={12} color={theme.surface} />
              </View>
              <Text style={[styles.legendText, { color: Colors[colorScheme].text }]}>Sold out (grey X)</Text>
            </View>
          </View>

          <Calendar
            onDayPress={onDayPress}
            markedDates={marked}
            markingType="custom"
            enableSwipeMonths
            minDate={todayISO()}
            maxDate={maxDateISO()}
            theme={{
              backgroundColor: Colors[colorScheme].card,
              calendarBackground: Colors[colorScheme].card,
              textSectionTitleColor: Colors[colorScheme].mutedText,
              selectedDayBackgroundColor: Colors[colorScheme].tint,
              selectedDayTextColor: '#FFFFFF',
              todayTextColor: Colors[colorScheme].tint,
              dayTextColor: Colors[colorScheme].text,
              textDisabledColor: Colors[colorScheme].mutedText,
              monthTextColor: Colors[colorScheme].text,
              textMonthFontWeight: '700',
              arrowColor: Colors[colorScheme].tint,
              textDayFontFamily: 'system',
              textMonthFontFamily: 'system',
              textDayHeaderFontFamily: 'system',
              textDayFontSize: 14,
              textMonthFontSize: 16,
              textDayHeaderFontSize: 13,
            } as any}
          />
          <Text style={[styles.calendarHint, { color: Colors[colorScheme].mutedText }]}>Booking available up to 8 weeks in advance</Text>

          {/* Ad Space Sharing Notice - Prominent */}
          <View style={[styles.noticeBox, { 
            backgroundColor: theme.surface,
            borderColor: theme.tint,
            borderWidth: 2,
            borderLeftWidth: 6,
          }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Text style={{ fontSize: 24 }}>👥</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.noticeTitle, { color: theme.text, fontSize: 16, marginBottom: 6 }]}>
                  Ad Space Shared with 1 Company
                </Text>
                <Text style={[styles.noticeText, { color: theme.mutedText, lineHeight: 20 }]}>
                  Your ad will rotate with up to <Text style={{ fontWeight: '800', fontSize: 15 }}>1 other company</Text> on selected dates.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: Colors[colorScheme].card }]}>
          <Text style={[styles.cardTitle, { color: Colors[colorScheme].text }]}>Pricing</Text>
          <View style={styles.rowBetween}>
            <Text style={{ color: Colors[colorScheme].text, fontSize: 15 }}>Weekday Slot (Mon-Thu):</Text>
            <Text style={[styles.bold, { color: Colors[colorScheme].text, fontSize: 17 }]}>${weekdayRate.toFixed(2)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={{ color: Colors[colorScheme].text, fontSize: 15 }}>Weekend Slot (Fri-Sun):</Text>
            <Text style={[styles.bold, { color: Colors[colorScheme].text, fontSize: 17 }]}>${weekendRate.toFixed(2)}</Text>
          </View>
          <Text style={[styles.muted, { color: Colors[colorScheme].mutedText }]}>Select dates to see your total.</Text>
          
        </View>

        <View style={[styles.card, { backgroundColor: Colors[colorScheme].card }]}>
          <Text style={[styles.cardTitle, { color: Colors[colorScheme].text }]}>Promo Code</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              placeholder="Enter code"
              placeholderTextColor={Colors[colorScheme].mutedText}
              autoCapitalize="characters"
              value={promo}
              onChangeText={setPromo}
              style={{ 
                flex: 1, 
                height: 44, 
                borderRadius: 10, 
                borderWidth: StyleSheet.hairlineWidth, 
                borderColor: Colors[colorScheme].border, 
                paddingHorizontal: 12,
                backgroundColor: Colors[colorScheme].surface,
                color: Colors[colorScheme].text
              }}
            />
            <Pressable onPress={applyPromo} style={[styles.payBtn, { backgroundColor: Colors[colorScheme].tint, width: 120, height: 44 }]} disabled={promoBusy}>
              {promoBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.payBtnText}>Apply</Text>}
            </Pressable>
          </View>
          {promoError ? <Text style={{ color: '#EF4444' }}>Not valid: {promoError}</Text> : null}
          {preview?.valid ? (
            <View style={{ marginTop: 8, gap: 4 }}>
              <Text style={{ fontWeight: '600', color: Colors[colorScheme].text }}>✅ Promo Applied: {preview.code}</Text>
              <Text style={{ color: Colors[colorScheme].text }}>Discount: ${((preview.discount_cents || 0) / 100).toFixed(2)}</Text>
              <Text style={{ fontSize: 12, color: Colors[colorScheme].mutedText, marginTop: 4 }}>
                ⚠️ Limited offer: First 8 users only
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: Colors[colorScheme].card }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text style={[styles.cardTitle, { color: Colors[colorScheme].text }]}>Campaign Summary</Text>
            {sortedDates.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: Colors[colorScheme].tint }]}>
                <Text style={styles.countBadgeText}>{sortedDates.length}</Text>
              </View>
            )}
          </View>
          {sortedDates.length > 0 ? (
            <View style={{ gap: 12 }}>
              <View>
                <Text style={[styles.bold, { color: Colors[colorScheme].text, marginBottom: 8 }]}>Selected Week Slots:</Text>
                <View style={styles.badgeWrap}>
                  {(() => {
                    // Group dates by week slot identifier
                    const weekSlots = new Map<string, string[]>();
                    sortedDates.forEach((iso) => {
                      const identifier = getWeekIdentifier(iso);
                      if (!weekSlots.has(identifier)) {
                        weekSlots.set(identifier, []);
                      }
                      weekSlots.get(identifier)!.push(iso);
                    });

                    // Display one badge per week slot
                    return Array.from(weekSlots.entries()).map(([identifier, dates]) => {
                      const firstDate = dates[0];
                      const dow = getDayOfWeek(firstDate);
                      const isWeekend = dow === 0 || dow === 5 || dow === 6;
                      const rate = isWeekend ? weekendRate : weekdayRate;
                      
                      // Format date range for the week slot
                      const sortedSlotDates = dates.sort();
                      const firstDateObj = new Date(sortedSlotDates[0] + 'T00:00:00');
                      const lastDateObj = new Date(sortedSlotDates[sortedSlotDates.length - 1] + 'T00:00:00');
                      const dateRange = sortedSlotDates.length === 1 
                        ? format(firstDateObj, 'MMM d, yyyy')
                        : `${format(firstDateObj, 'MMM d')}-${format(lastDateObj, 'd, yyyy')}`;
                      const slotLabel = isWeekend ? 'Fri-Sun' : 'Mon-Thu';

                      return (
                        <View 
                          key={identifier} 
                          style={[
                            styles.dateBadge, 
                            { 
                              backgroundColor: colorScheme === 'dark' ? (isWeekend ? '#422006' : '#1E3A8A') : (isWeekend ? '#FED7AA' : '#BFDBFE'),
                              borderColor: isWeekend ? '#EA580C' : '#2563EB',
                            }
                          ]}
                        >
                          <Text style={[styles.dateBadgeText, { color: colorScheme === 'dark' ? (isWeekend ? '#FDE68A' : '#93C5FD') : (isWeekend ? '#7C2D12' : '#1E40AF') }]}>
                            {dateRange} ({slotLabel})
                          </Text>
                          <Text style={[styles.dateBadgeRate, { color: colorScheme === 'dark' ? (isWeekend ? '#FDE68A' : '#93C5FD') : (isWeekend ? '#9A3412' : '#1E3A8A') }]}>
                            ${rate.toFixed(2)} total
                          </Text>
                        </View>
                      );
                    });
                  })()}
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}>
              <View style={{ width: 40, height: 40, marginBottom: 8, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="event" size={38} color={Colors[colorScheme].tint} />
                <Text style={{ position: 'absolute', top: 14, fontSize: 13, fontWeight: '800', color: Colors[colorScheme].tint }}>24</Text>
              </View>
              <Text style={[styles.bold, { color: Colors[colorScheme].text }]}>No dates selected</Text>
              <Text style={[styles.muted, { color: Colors[colorScheme].mutedText, textAlign: 'center' }]}>
                Tap on dates in the calendar above to build your campaign
              </Text>
            </View>
          )}

          {sortedDates.length > 0 && (() => {
            const lastEnd = new Date(sortedDates[sortedDates.length - 1] + 'T23:59:59');
            const totalHrs = Math.max(0, Math.round((lastEnd.getTime() - Date.now()) / 3600000));
            const firstSelectedIsToday = sortedDates[0] <= todayISO();
            return (
              <>
                <View style={[styles.rowBetween, { marginTop: 4 }]}>
                  <Text style={[styles.bold, { color: Colors[colorScheme].text }]}>Total Hours Booked:</Text>
                  <View style={styles.hoursHighlight}>
                    <Text style={styles.hoursHighlightText}>
                      {totalHrs} hrs ({sortedDates.length} day{sortedDates.length !== 1 ? 's' : ''})
                    </Text>
                  </View>
                </View>
                {firstSelectedIsToday && (
                  <View style={styles.fullPriceNotice}>
                    <MaterialIcons name="info-outline" size={16} color="#92400E" />
                    <Text style={styles.fullPriceNoticeText}>
                      Note: Full price is charged regardless of when your ad goes live during a booked day.
                    </Text>
                  </View>
                )}
              </>
            );
          })()}

          <View style={[styles.sep, { backgroundColor: Colors[colorScheme].border }]} />

          <View style={styles.rowBetween}>
            <Text style={[styles.bold, { fontSize: 18, color: Colors[colorScheme].text }]}>Subtotal:</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: Colors[colorScheme].text }}>${price.toFixed(2)}</Text>
          </View>
          {taxCents > 0 && (
            <View style={styles.rowBetween}>
              <Text style={[styles.bold, { fontSize: 16, color: Colors[colorScheme].text }]}>Sales Tax (est.):</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors[colorScheme].text }}>${(taxCents / 100).toFixed(2)}</Text>
            </View>
          )}
          {preview?.valid ? (
            <View style={styles.rowBetween}>
              <Text style={[styles.bold, { fontSize: 16, color: Colors[colorScheme].text }]}>Promo Discount:</Text>
              <Text style={{ fontSize: 16, color: '#10B981', fontWeight: '700' }}>- ${((preview.discount_cents || 0) / 100).toFixed(2)}</Text>
            </View>
          ) : null}
          <View style={styles.rowBetween}>
            <Text style={[styles.bold, { fontSize: 18, color: Colors[colorScheme].text }]}>Total:</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: Colors[colorScheme].text }}>${effective.toFixed(2)}</Text>
          </View>

          {isPending && (
            <View style={[styles.pendingBanner, { backgroundColor: colorScheme === 'dark' ? '#422006' : '#FEF3C7', borderColor: colorScheme === 'dark' ? '#92400E' : '#FCD34D' }]}>
              <MaterialIcons name="schedule" size={24} color="#92400E" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.pendingBannerTitle, { color: colorScheme === 'dark' ? '#FDE68A' : '#92400E' }]}>Pending Approval</Text>
                <Text style={[styles.pendingBannerText, { color: colorScheme === 'dark' ? '#FDE68A' : '#92400E' }]}>
                  Your ad has been submitted for review. You'll be notified when approved — no charge until then.
                </Text>
              </View>
            </View>
          )}
          {canPay && (
            <>
              <Pressable
                disabled={payButtonDisabled}
                onPress={handlePayment}
                style={[
                  styles.payBtn,
                  { backgroundColor: Colors[colorScheme].tint },
                  payButtonDisabled && styles.payBtnDisabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={styles.payBtnText}>
                    {paymentsTemporarilyDisabled ? 'Checkout unavailable' : `Pay $${effective.toFixed(2)}`}
                  </Text>
                )}
              </Pressable>
              {paymentsTemporarilyDisabled && (
                <Text style={[styles.paymentBannerHelp, { color: colorScheme === 'dark' ? '#FCA5A5' : '#B91C1C' }]}>
                  Payments are temporarily disabled while Stripe is configured. Please try again later.
                </Text>
              )}
            </>
          )}
          {isDraft && (
            <>
              <Pressable
                disabled={submitForApprovalDisabled}
                onPress={handleSubmitForApproval}
                style={[
                  styles.payBtn,
                  { backgroundColor: Colors[colorScheme].tint },
                  submitForApprovalDisabled && styles.payBtnDisabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={styles.payBtnText}>
                    Submit for Approval
                  </Text>
                )}
              </Pressable>
              <Text style={[styles.paymentBannerHelp, { color: Colors[colorScheme].mutedText }]}>
                No charge until your ad is approved.
              </Text>
            </>
          )}
          {isActive && selected.size === 0 && (
            <View style={[styles.pendingBanner, { backgroundColor: colorScheme === 'dark' ? '#064E3B' : '#D1FAE5', borderColor: colorScheme === 'dark' ? '#047857' : '#10B981' }]}>
              <MaterialIcons name="check-circle" size={24} color="#10B981" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.pendingBannerTitle, { color: colorScheme === 'dark' ? '#6EE7B7' : '#047857' }]}>Your ad is live</Text>
                <Text style={[styles.pendingBannerText, { color: colorScheme === 'dark' ? '#6EE7B7' : '#047857' }]}>
                  Select new dates above to run this ad again — no re-approval needed.
                </Text>
                <Pressable onPress={() => router.push('/(tabs)/my-ads')} style={{ marginTop: 8 }}>
                  <Text style={{ color: Colors[colorScheme].tint, fontWeight: '600' }}>View My Ads →</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
      </View>

      {/* Free promo success overlay */}
      {showFreeSuccess && (
        <Animated.View style={[styles.successOverlay, { opacity: freeSuccessOpacity }]} pointerEvents="none">
          <View style={styles.successBadge}>
            <Text style={[styles.successCheck, { color: Colors[colorScheme].text }]}>✓</Text>
            <Text style={[styles.successLabel, { color: Colors[colorScheme].text }]}>Ad Reserved!</Text>
            <Text style={[styles.successSub, { color: Colors[colorScheme].mutedText }]}>Promo applied — redirecting...</Text>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'android' ? 14 : 8,
    paddingBottom: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    // Add shadow for depth (iOS)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    // Add elevation for depth (Android)
    elevation: 2,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: 20, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { 
    padding: 16, 
    gap: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24, // Extra padding for iOS home indicator
  },
  paymentBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  paymentBannerError: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  paymentBannerMuted: {
    backgroundColor: '#E0F2FE',
    borderColor: '#38BDF8',
  },
  paymentBannerTitle: {
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
    color: '#1F2937',
  },
  paymentBannerText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  paymentBannerHelp: {
    marginTop: 8,
    fontSize: 12,
    color: '#B91C1C',
    textAlign: 'center',
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  pendingBannerTitle: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 4,
  },
  pendingBannerText: {
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardDesc: {},
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muted: { fontSize: 12 },
  bold: { fontWeight: '600' },
  sep: { height: 1, marginVertical: 8 },
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  dateBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dateBadgeRate: {
    fontSize: 12,
    fontWeight: '600',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  legendContainer: { marginVertical: 8, gap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 16, height: 16, borderRadius: 8 },
  legendText: { fontSize: 13, fontWeight: '500' },
  calendarHint: { fontSize: 12, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
  noticeBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 18,
  },
  payBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  hoursHighlight: {
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  hoursHighlightText: {
    color: '#92400E',
    fontWeight: '800',
    fontSize: 15,
  },
  fullPriceNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  fullPriceNoticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#92400E',
    fontWeight: '500',
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 100,
  },
  successBadge: {
    backgroundColor: '#FFD700',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 48,
    alignItems: 'center',
    gap: 6,
  },
  successCheck: {
    fontSize: 52,
    fontWeight: '800',
  },
  successLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  successSub: {
    fontSize: 13,
    fontWeight: '500',
  },
});

 
