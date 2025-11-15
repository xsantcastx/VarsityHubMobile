import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as WebBrowser from 'expo-web-browser';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { getAuthToken } from '@/api/http';
import { addWeeks, format, startOfToday } from 'date-fns';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, DateData } from 'react-native-calendars';
// @ts-ignore JS exports
import { Advertisement } from '@/api/entities';

const weekdayRate = 8.00;   // Per week (Mon-Thu slot)
const weekendRate = 10.00;  // Per week (Fri-Sun slot)

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

function getWeekSlotDates(dateISO: string): string[] {
  // Returns all dates in the same week slot (Mon-Thu or Fri-Sun)
  const date = new Date(dateISO + 'T00:00:00');
  const dow = date.getDay();
  const dates: string[] = [];
  
  if (dow >= 1 && dow <= 4) {
    // Weekday slot: Mon-Thu
    // Find Monday of this week
    const daysFromMonday = dow - 1;
    const monday = new Date(date);
    monday.setDate(date.getDate() - daysFromMonday);
    
    // Add Mon, Tue, Wed, Thu
    for (let i = 0; i < 4; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      dates.push(format(day, 'yyyy-MM-dd'));
    }
  } else {
    // Weekend slot: Fri-Sun
    let friday: Date;
    
    if (dow === 5) {
      // Already Friday
      friday = new Date(date);
    } else if (dow === 6) {
      // Saturday - go back 1 day to Friday
      friday = new Date(date);
      friday.setDate(date.getDate() - 1);
    } else {
      // Sunday (dow === 0) - go back 2 days to Friday
      friday = new Date(date);
      friday.setDate(date.getDate() - 2);
    }
    
    // Add Fri, Sat, Sun
    for (let i = 0; i < 3; i++) {
      const day = new Date(friday);
      day.setDate(friday.getDate() + i);
      dates.push(format(day, 'yyyy-MM-dd'));
    }
  }
  
  return dates;
}

function getWeekIdentifier(dateISO: string): string {
  // Returns a unique identifier for the week slot
  // For weekdays (Mon-Thu): use the Monday's date
  // For weekends (Fri-Sun): use the Friday's date
  const date = new Date(dateISO + 'T00:00:00');
  const dow = date.getDay();
  
  if (dow >= 1 && dow <= 4) {
    // Weekday (Mon-Thu): find this week's Monday
    const monday = new Date(date);
    monday.setDate(date.getDate() - (dow - 1));
    return `${format(monday, 'yyyy-MM-dd')}-weekday`;
  } else {
    // Weekend (Fri, Sat, Sun): find this week's Friday
    let friday = new Date(date);
    if (dow === 5) {
      // Already Friday
    } else if (dow === 6) {
      // Saturday - go back 1 day
      friday.setDate(date.getDate() - 1);
    } else {
      // Sunday (dow === 0) - go back 2 days
      friday.setDate(date.getDate() - 2);
    }
    return `${format(friday, 'yyyy-MM-dd')}-weekend`;
  }
}

function calculatePrice(selectedISO: Set<string>): number {
  if (selectedISO.size === 0) return 0;
  
  // Group dates by their week slot (weekday vs weekend)
  const weekSlots = new Set<string>();
  
  for (const d of selectedISO) {
    weekSlots.add(getWeekIdentifier(d));
  }
  
  // Calculate price: $8 per weekday week slot, $10 per weekend week slot
  let total = 0;
  for (const slot of weekSlots) {
    if (slot.endsWith('-weekday')) {
      total += weekdayRate; // $8.00 TOTAL for entire Mon-Thu week
    } else {
      total += weekendRate; // $10.00 TOTAL for entire Fri-Sun weekend
    }
  }
  
  return total;
}

export default function AdCalendarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ adId?: string }>();
  const adId = params.adId ?? '';
  const colorScheme = useColorScheme() ?? 'light';

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [reserved, setReserved] = useState<Set<string>>(new Set());
  const [fullDates, setFullDates] = useState<Set<string>>(new Set()); // Dates with 3/3 slots filled
  const [dateAvailability, setDateAvailability] = useState<Record<string, { slotsUsed: number; slotsRemaining: number }>>({});
  const [promo, setPromo] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [taxRate, setTaxRate] = useState(0); // Tax rate as decimal
  const [zipCode, setZipCode] = useState<string>('');
  const [alternatives, setAlternatives] = useState<Array<{ zip: string; distance: number }>>([]);
  const [showingAlternatives, setShowingAlternatives] = useState(false);
  
  // Load reserved dates for THIS ad only (allow other ads to share dates)
  // AND load date availability to block fully booked dates
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
        
        // Get zip code and load availability
        if (res?.ad?.target_zip_code) {
          const zip = res.ad.target_zip_code;
          setZipCode(zip);
          
          // Load availability for next 8 weeks
          await loadAvailability(zip);
        }
      } catch {
        if (mounted) setReserved(new Set());
      }
    })();
    return () => { mounted = false; };
  }, [adId]);

  const loadAvailability = async (zip: string) => {
    try {
      const from = todayISO();
      const to = maxDateISO();
      
      const base = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
      const headers: any = { 'Content-Type': 'application/json' };
      const token = getAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      
      const r = await fetch(
        `${base.replace(/\/$/, '')}/ads/availability?zip=${encodeURIComponent(zip)}&from=${from}&to=${to}`,
        { method: 'GET', headers }
      );
      
      if (!r.ok) {
        console.warn('Failed to load availability:', r.status);
        return;
      }
      
      const data = await r.json();
      
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
      console.error('Error loading availability:', e);
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
  const priceWithTax = useMemo(() => price + (taxCents / 100), [price, taxCents]);
  const effectiveCents = useMemo(() => {
    const subtotalCents = Math.round(price * 100);
    const discount = preview?.valid ? (preview.discount_cents || 0) : 0;
    const afterDiscount = Math.max(0, subtotalCents - discount);
    return afterDiscount + taxCents;
  }, [price, taxCents, preview?.valid, preview?.discount_cents]);
  const effective = useMemo(() => (effectiveCents / 100), [effectiveCents]);

  const marked = useMemo(() => {
    const obj: Record<string, { selected: boolean; selectedColor?: string } | { disabled: boolean } | any> = {};
    
    // PRIORITY 1: Mark fully booked dates (3/3 slots filled) - GREYED OUT
    for (const d of fullDates) {
      // Don't override if user has already selected this date
      if (!selected.has(d)) {
        obj[d] = { 
          disabled: true, 
          disableTouchEvent: true,
          textColor: '#9CA3AF',
          customStyles: {
            container: {
              backgroundColor: '#E5E7EB',
              borderWidth: 2,
              borderColor: '#9CA3AF',
            },
            text: {
              color: '#6B7280',
              textDecorationLine: 'line-through',
              fontWeight: '600',
            },
          },
          marked: true,
          dotColor: '#EF4444',
        };
      }
    }
    
    // PRIORITY 2: Mark reserved dates as disabled (user's own reservations)
    for (const d of reserved) {
      if (!selected.has(d)) {
        obj[d] = { 
          disabled: true, 
          disableTouchEvent: true,
          textColor: '#9CA3AF',
          dotColor: '#9CA3AF',
          marked: true,
          customStyles: {
            container: {
              backgroundColor: '#F9FAFB',
              borderWidth: 1,
              borderColor: '#D1D5DB',
            },
            text: {
              color: '#9CA3AF',
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
  }, [selected, reserved, fullDates]);

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
      fetchAlternativeZips([iso]);
      Alert.alert(
        'Date Fully Booked', 
        'This date already has 3/3 ad slots filled. Check below for nearby available zip codes or select a different date.'
      );
      return;
    }
    
    // Prevent selection of reserved dates
    if (reserved.has(iso)) {
      // Fetch alternative zip codes
      fetchAlternativeZips([iso]);
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

  const fetchAlternativeZips = async (dates: string[]) => {
    if (!zipCode || dates.length === 0) return;
    
    try {
      const base = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
      const headers: any = { 'Content-Type': 'application/json' };
      const token = getAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      
      const dateString = dates.join(',');
      const r = await fetch(`${base.replace(/\/$/, '')}/ads/alternative-zips?zip=${zipCode}&dates=${dateString}`, {
        method: 'GET',
        headers,
      });
      
      if (!r.ok) {
        console.warn('Failed to fetch alternative zips:', r.status);
        return;
      }
      
      const data = await r.json();
      if (data?.alternatives && Array.isArray(data.alternatives)) {
        setAlternatives(data.alternatives);
        setShowingAlternatives(true);
      }
    } catch (e: any) {
      console.error('Error fetching alternative zips:', e);
    }
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
        Alert.alert('Success!', 'Your ad reservation was completed with the promo discount.', [
          { text: 'View My Ads', onPress: () => router.replace('/(tabs)/my-ads') }
        ]);
      } else if (data?.url) {
        // Show info before opening browser
        Alert.alert(
          'Complete Payment',
          'You\'ll be redirected to Stripe to complete your payment. After payment, return to this app to see your active ads.',
          [
            {
              text: 'Continue to Payment',
              onPress: async () => {
                try {
                  const result = await WebBrowser.openBrowserAsync(String(data.url));
                  
                  // When browser closes, redirect to confirmation screen
                  console.log('[ad-calendar] Browser closed:', result.type);
                  
                  // Reset submitting state
                  setSubmitting(false);
                  
                  // Get ad details for confirmation screen
                  const adData = await Advertisement.get(adId).catch(() => null);
                  const businessName = adData?.business_name || 'Your Business';
                  const datesText = sortedDates.length > 0 
                    ? `${sortedDates.length} ${sortedDates.length === 1 ? 'day' : 'days'}`
                    : 'selected dates';
                  
                  // Redirect to confirmation screen with ad details
                  console.log('[ad-calendar] Redirecting to confirmation');
                  router.replace({
                    pathname: '/ad-confirmation',
                    params: {
                      ad_id: adId,
                      businessName,
                      selectedDates: datesText,
                      totalAmount: `$${effective.toFixed(2)}`,
                    }
                  } as any);
                  
                } catch (browserErr) {
                  console.error('Browser error:', browserErr);
                  setSubmitting(false);
                  Alert.alert('Error', 'Could not open payment page. Please try again.');
                }
              }
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setSubmitting(false)
            }
          ]
        );
      }
    } catch (err) {
      console.error('Failed to start checkout:', err);
      const msg = (err as any)?.message || 'An error occurred starting checkout.';
      Alert.alert('Error', msg);
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
          <Pressable onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: Colors[colorScheme].surface }]}>
            <Text style={[styles.iconBtnText, { color: Colors[colorScheme].text }]}>{'<'}</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]}>Schedule Your Ad</Text>
        </View>

        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
        {zipCode && (
          <View style={[styles.card, { backgroundColor: colorScheme === 'dark' ? '#1E3A8A' : '#EFF6FF', borderColor: colorScheme === 'dark' ? '#3B82F6' : '#BFDBFE' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>📍</Text>
              <Text style={[styles.cardTitle, { color: colorScheme === 'dark' ? '#BFDBFE' : '#1E40AF' }]}>Coverage Area</Text>
            </View>
            <Text style={{ color: colorScheme === 'dark' ? '#BFDBFE' : '#1E40AF', fontSize: 14 }}>
              Your ad will reach <Text style={{ fontWeight: '700' }}>20 miles</Text> around zip code <Text style={{ fontWeight: '700' }}>{zipCode}</Text>
            </Text>
          </View>
        )}
        
        {showingAlternatives && alternatives.length > 0 && (
          <View style={[styles.card, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>⚠️</Text>
              <Text style={[styles.cardTitle, { color: '#92400E' }]}>Date Unavailable - Try Nearby Zips</Text>
            </View>
            <Text style={{ color: '#92400E', fontSize: 13, marginBottom: 8 }}>
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
                  backgroundColor: '#FFFFFF',
                  borderRadius: 8,
                  marginBottom: 6,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
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
                  <Text style={{ fontWeight: '600', fontSize: 15 }}>{alt.zip}</Text>
                  <Text style={{ fontSize: 12, color: '#6B7280' }}>{alt.distance} miles away</Text>
                </View>
                <Text style={{ color: '#2563EB', fontSize: 13 }}>View →</Text>
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
          </View>

          <Calendar
            onDayPress={onDayPress}
            markedDates={marked}
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
            }}
          />
          <Text style={[styles.calendarHint, { color: Colors[colorScheme].mutedText }]}>Booking available up to 8 weeks in advance</Text>

          {/* Ad Space Sharing Notice - Prominent */}
          <View style={[styles.noticeBox, { 
            backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#DBEAFE',
            borderColor: colorScheme === 'dark' ? '#3B82F6' : '#2563EB',
            borderWidth: 2,
            borderLeftWidth: 6,
          }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Text style={{ fontSize: 24 }}>👥</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.noticeTitle, { color: colorScheme === 'dark' ? '#93C5FD' : '#1E40AF', fontSize: 16, marginBottom: 6 }]}>
                  Ad Space Shared with 3 Companies
                </Text>
                <Text style={[styles.noticeText, { color: colorScheme === 'dark' ? '#BFDBFE' : '#1E40AF', lineHeight: 20 }]}>
                  Your ad will rotate with up to <Text style={{ fontWeight: '800', fontSize: 15 }}>3 other companies</Text> on selected dates. This ensures fair visibility and competitive pricing for all advertisers.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: Colors[colorScheme].card }]}>
          <Text style={[styles.cardTitle, { color: Colors[colorScheme].text }]}>Pricing</Text>
          <View style={styles.rowBetween}>
            <Text style={{ color: Colors[colorScheme].text, fontSize: 15 }}>Weekday Slot (Mon-Thu):</Text>
            <Text style={[styles.bold, { color: Colors[colorScheme].text, fontSize: 17 }]}>${weekdayRate.toFixed(2)}/week</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={{ color: Colors[colorScheme].text, fontSize: 15 }}>Weekend Slot (Fri-Sun):</Text>
            <Text style={[styles.bold, { color: Colors[colorScheme].text, fontSize: 17 }]}>${weekendRate.toFixed(2)}/week</Text>
          </View>
          <Text style={[styles.muted, { color: Colors[colorScheme].mutedText }]}>Each ad slot is priced per week. Select multiple dates to see your total.</Text>
          
          {/* Weekly pricing explanation */}
          <View style={{ 
            marginTop: 12, 
            padding: 14, 
            backgroundColor: '#FEF9C3',
            borderRadius: 10,
            borderWidth: 2,
            borderColor: '#FCD34D',
            borderLeftWidth: 6,
          }}>
            <Text style={{ fontSize: 14, color: '#713F12', lineHeight: 20, fontWeight: '600' }}>
              💡 <Text style={{ fontWeight: '800' }}>Pricing Note:</Text> Weekly slots apply to Mon–Thu (weekday) or Fri–Sun (weekend). Booking a date reserves your ad for that <Text style={{ fontWeight: '800', textDecorationLine: 'underline' }}>entire week's slot</Text> at the listed price.
            </Text>
            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#FDE68A' }}>
              <Text style={{ fontSize: 13, color: '#92400E', lineHeight: 18 }}>
                <Text style={{ fontWeight: '700' }}>Example:</Text> Selecting any Monday = ${weekdayRate.toFixed(2)} for Mon, Tue, Wed, Thu that week.
              </Text>
              <Text style={{ fontSize: 13, color: '#92400E', lineHeight: 18, marginTop: 4 }}>
                <Text style={{ fontWeight: '700' }}>Example:</Text> Selecting any Friday = ${weekendRate.toFixed(2)} for Fri, Sat, Sun that week.
              </Text>
            </View>
          </View>

          {/* IMPORTANT: Mid-week purchase notice */}
          <View style={{ 
            marginTop: 12, 
            padding: 14, 
            backgroundColor: '#FEE2E2',
            borderRadius: 10,
            borderWidth: 2,
            borderColor: '#EF4444',
            borderLeftWidth: 6,
          }}>
            <Text style={{ fontSize: 14, color: '#7F1D1D', lineHeight: 20, fontWeight: '700', marginBottom: 8 }}>
              ⚠️ <Text style={{ fontWeight: '900', fontSize: 15 }}>IMPORTANT:</Text> Mid-Week Purchases
            </Text>
            <Text style={{ fontSize: 13, color: '#991B1B', lineHeight: 19 }}>
              If you book ad space in the <Text style={{ fontWeight: '800' }}>middle of a week</Text> (e.g., Wednesday or Saturday), you will <Text style={{ fontWeight: '800', textDecorationLine: 'underline' }}>still pay the full weekly rate</Text> for the remaining days in that week's slot.
            </Text>
            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#FCA5A5' }}>
              <Text style={{ fontSize: 12, color: '#7F1D1D', lineHeight: 17 }}>
                <Text style={{ fontWeight: '700' }}>Example:</Text> Booking on Wednesday = ${weekdayRate.toFixed(2)} for Wed + Thu only (not prorated).
              </Text>
              <Text style={{ fontSize: 12, color: '#7F1D1D', lineHeight: 17, marginTop: 3 }}>
                <Text style={{ fontWeight: '700' }}>Example:</Text> Booking on Saturday = ${weekendRate.toFixed(2)} for Sat + Sun only (not prorated).
              </Text>
            </View>
          </View>
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
                              backgroundColor: isWeekend ? '#FED7AA' : '#BFDBFE',
                              borderColor: isWeekend ? '#EA580C' : '#2563EB',
                            }
                          ]}
                        >
                          <Text style={[styles.dateBadgeText, { color: isWeekend ? '#7C2D12' : '#1E40AF' }]}>
                            {dateRange} ({slotLabel})
                          </Text>
                          <Text style={[styles.dateBadgeRate, { color: isWeekend ? '#9A3412' : '#1E3A8A' }]}>
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
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📅</Text>
              <Text style={[styles.bold, { color: Colors[colorScheme].text }]}>No dates selected</Text>
              <Text style={[styles.muted, { color: Colors[colorScheme].mutedText, textAlign: 'center' }]}>
                Tap on dates in the calendar above to build your campaign
              </Text>
            </View>
          )}

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

          <Pressable
            disabled={submitting || selected.size === 0}
            onPress={handlePayment}
            style={[styles.payBtn, { backgroundColor: Colors[colorScheme].tint }, (submitting || selected.size === 0) && styles.payBtnDisabled]}
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
});

 
