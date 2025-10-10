import * as WebBrowser from 'expo-web-browser';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
// @ts-ignore
import { getAuthToken } from '@/api/http';
import { addWeeks, format, startOfToday } from 'date-fns';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, DateData } from 'react-native-calendars';
// @ts-ignore JS exports
import { Advertisement } from '@/api/entities';

const weekdayRate = 10;
const weekendRate = 17.5;

const todayISO = (): string => format(startOfToday(), 'yyyy-MM-dd');
const maxDateISO = (): string => format(addWeeks(startOfToday(), 8), 'yyyy-MM-dd');

function toggleSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

function getDayOfWeek(dateISO: string): number {
  return new Date(dateISO + 'T00:00:00').getDay();
}

function calculatePrice(selectedISO: Set<string>): number {
  if (selectedISO.size === 0) return 0;
  let hasWeekday = false; // Mon..Thu
  let hasWeekend = false; // Fri..Sun
  for (const d of selectedISO) {
    const dow = getDayOfWeek(d);
    if (dow >= 1 && dow <= 4) hasWeekday = true; else hasWeekend = true;
    if (hasWeekday && hasWeekend) break;
  }
  let total = 0;
  if (hasWeekday) total += weekdayRate;
  if (hasWeekend) total += weekendRate;
  return total;
}

export default function AdCalendarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ adId?: string }>();
  const adId = params.adId ?? '';

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [reserved, setReserved] = useState<Set<string>>(new Set());
  const [promo, setPromo] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  // Load reserved dates for THIS ad only (allow other ads to share dates)
  React.useEffect(() => {
    let mounted = true;
    (async () => {
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
      } catch {
        if (mounted) setReserved(new Set());
      }
    })();
    return () => { mounted = false; };
  }, [adId]);

  const price = useMemo(() => calculatePrice(selected), [selected]);
  const effectiveCents = useMemo(() => {
    const cents = Math.round(price * 100);
    const discount = preview?.valid ? (preview.discount_cents || 0) : 0;
    return Math.max(0, cents - discount);
  }, [price, preview?.valid, preview?.discount_cents]);
  const effective = useMemo(() => (effectiveCents / 100), [effectiveCents]);

  const marked = useMemo(() => {
    const obj: Record<string, { selected: boolean; selectedColor?: string } | { disabled: boolean } | any> = {};
    
    // Mark selected dates with weekday/weekend colors
    for (const d of selected) {
      const dow = getDayOfWeek(d);
      const isWeekend = dow === 0 || dow === 5 || dow === 6; // Sun, Fri, Sat
      obj[d] = { 
        selected: true, 
        selectedColor: isWeekend ? '#EA580C' : '#2563EB', // Orange for weekend, Blue for weekday
        selectedTextColor: '#FFFFFF'
      };
    }
    
    // Mark reserved dates as disabled
    for (const d of reserved) {
      obj[d] = { 
        disabled: true, 
        disableTouchEvent: true,
        dotColor: '#9CA3AF',
        marked: true
      };
    }
    
    return obj;
  }, [selected, reserved]);

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
    
    // Prevent selection of reserved dates
    if (reserved.has(iso)) {
      Alert.alert('Date Unavailable', 'This date is already reserved.');
      return;
    }
    
    setSelected(prev => toggleSet(prev, iso));
  };

  const applyPromo = async () => {
    setPromoError(null);
    setPromoBusy(true);
    try {
      const subtotalCents = Math.round(price * 100);
      const base = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
      const headers: any = { 'Content-Type': 'application/json' };
      const token = getAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const r = await fetch(`${base.replace(/\/$/, '')}/promos/preview`, {
        method: 'POST', headers, body: JSON.stringify({ code: promo, subtotal_cents: subtotalCents, service: 'booking' })
      });
      const text = await r.text();
      const data = text ? JSON.parse(text) : null;
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      if (!data?.valid) { setPreview(null); setPromoError(data?.reason || 'invalid'); }
      else setPreview(data);
    } catch (e: any) {
      setPreview(null);
      setPromoError(e?.message || 'Failed to apply promo');
    } finally { setPromoBusy(false); }
  };

  const handlePayment = async () => {
    if (!adId || selected.size === 0) {
      Alert.alert('Select at least one date');
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
    
    setSubmitting(true);
    try {
      const dates = Array.from(selected).sort((a, b) => (a < b ? -1 : 1));
      const base = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
      const headers: any = { 'Content-Type': 'application/json' };
      const token = getAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const r = await fetch(`${base.replace(/\/$/, '')}/payments/checkout`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ad_id: String(adId), dates, promo_code: promo || undefined }),
      });
      const txt = await r.text();
      const data = txt ? JSON.parse(txt) : null;
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      if (data?.free) {
        Alert.alert('Payment', 'Your reservation was completed with the promo discount.');
        router.replace('/(tabs)/my-ads');
      } else if (data?.url) {
        await WebBrowser.openBrowserAsync(String(data.url));
        // Don't redirect here - let the Stripe callback (payment-success) handle the redirect
        // The user will be redirected to payment-success screen after completing payment
      }
    } catch (err) {
      console.error('Failed to start checkout:', err);
      const msg = (err as any)?.message || 'An error occurred starting checkout.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const sortedDates = useMemo(
    () => Array.from(selected).sort((a, b) => (a < b ? -1 : 1)),
    [selected]
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A0D' }}>
      <Stack.Screen options={{ title: 'Schedule Your Ad' }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>{'<'}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Schedule Your Ad</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select Ad Campaign Dates</Text>
          <Text style={styles.cardDesc}>Choose one or more dates to run your ad.</Text>

          {/* Color Legend */}
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#2563EB' }]} />
              <Text style={styles.legendText}>Weekday (Mon-Thu) - ${weekdayRate}/bundle</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EA580C' }]} />
              <Text style={styles.legendText}>Weekend (Fri-Sun) - ${weekendRate}/bundle</Text>
            </View>
          </View>

          <Calendar
            onDayPress={onDayPress}
            markedDates={marked}
            enableSwipeMonths
            minDate={todayISO()}
            maxDate={maxDateISO()}
          />
          <Text style={styles.calendarHint}>Booking available up to 8 weeks in advance</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pricing</Text>
          <View style={styles.rowBetween}>
            <Text>Mon-Thu Rate:</Text>
            <Text style={styles.bold}>${weekdayRate.toFixed(2)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text>Fri-Sun Rate:</Text>
            <Text style={styles.bold}>${weekendRate.toFixed(2)}</Text>
          </View>
          <Text style={styles.muted}>Rates are flat. Any weekday(s) cost $10.00. Any weekend day(s) cost $17.50.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Promo Code</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              placeholder="Enter code"
              autoCapitalize="characters"
              value={promo}
              onChangeText={setPromo}
              style={{ flex: 1, height: 44, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#d1d5db', paddingHorizontal: 12 }}
            />
            <Pressable onPress={applyPromo} style={[styles.payBtn, { backgroundColor: '#2563EB', width: 120, height: 44 }]} disabled={promoBusy}>
              {promoBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.payBtnText}>Apply</Text>}
            </Pressable>
          </View>
          {promoError ? <Text style={{ color: '#b91c1c' }}>Not valid: {promoError}</Text> : null}
          {preview?.valid ? (
            <View style={{ marginTop: 8, gap: 4 }}>
              <Text>Code: {preview.code}</Text>
              <Text>Discount: ${((preview.discount_cents || 0) / 100).toFixed(2)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Campaign Summary</Text>
          {sortedDates.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.bold}>Selected Dates:</Text>
              <View style={styles.badgeWrap}>
                {sortedDates.map((iso) => (
                  <View key={iso} style={styles.badge}>
                    <Text style={styles.badgeText}>{format(new Date(iso + 'T00:00:00'), 'MMM d')}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text style={styles.muted}>Select dates on the calendar to see your summary.</Text>
          )}

          <View style={styles.sep} />

          <View style={styles.rowBetween}>
            <Text style={[styles.bold, { fontSize: 18 }]}>Subtotal:</Text>
            <Text style={{ fontSize: 18, fontWeight: '700' }}>${price.toFixed(2)}</Text>
          </View>
          {preview?.valid ? (
            <View style={styles.rowBetween}>
              <Text style={[styles.bold, { fontSize: 16 }]}>Promo Discount:</Text>
              <Text style={{ fontSize: 16, color: '#16a34a', fontWeight: '700' }}>- ${((preview.discount_cents || 0) / 100).toFixed(2)}</Text>
            </View>
          ) : null}
          <View style={styles.rowBetween}>
            <Text style={[styles.bold, { fontSize: 18 }]}>Total:</Text>
            <Text style={{ fontSize: 22, fontWeight: '800' }}>${effective.toFixed(2)}</Text>
          </View>

          <Pressable
            disabled={submitting || selected.size === 0}
            onPress={handlePayment}
            style={[styles.payBtn, (submitting || selected.size === 0) && styles.payBtnDisabled]}
          >
            {submitting ? (
              <ActivityIndicator />
            ) : (
              <Text style={styles.payBtnText}>Pay ${effective.toFixed(2)}</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  iconBtnText: { fontSize: 20, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 16, gap: 16 },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardDesc: { color: '#6b7280' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muted: { color: '#6b7280', fontSize: 12 },
  bold: { fontWeight: '600' },
  sep: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, backgroundColor: '#F3F4F6' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  legendContainer: { marginVertical: 8, gap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 16, height: 16, borderRadius: 8 },
  legendText: { fontSize: 13, color: '#4B5563', fontWeight: '500' },
  calendarHint: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
  payBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
});

 
