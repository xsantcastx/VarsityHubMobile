import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Calendar, DateData } from 'react-native-calendars';
import { format, startOfToday } from 'date-fns';
import { Advertisement } from '@/api/entities';
// If you don't have an alias for '@/api/entities', replace it with a relative path.

/*********************************
 * Types
 *********************************/
export type RootStackParamList = {
  Home: undefined;
  Feed: undefined;
  AdCalendar: { adId: string };
};

type AdCalendarRoute = RouteProp<RootStackParamList, 'AdCalendar'>;

type Nav = NativeStackNavigationProp<RootStackParamList>;

/*********************************
 * Constants
 *********************************/
const weekdayRate = 10;
const weekendRate = 17.5;

/*********************************
 * Helpers
 *********************************/
const todayISO = (): string => format(startOfToday(), 'yyyy-MM-dd');

function toggleSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

function getDayOfWeek(dateISO: string): number {
  // JS Date getDay(): Sun=0..Sat=6
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

/*********************************
 * Component
 *********************************/
export default function AdCalendar() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<AdCalendarRoute>();
  const { adId } = route.params || ({} as any);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const price = useMemo(() => calculatePrice(selected), [selected]);

  const marked = useMemo(() => {
    const obj: Record<string, { selected: boolean } | { disabled: boolean } | any> = {};
    for (const d of selected) obj[d] = { selected: true };
    return obj;
  }, [selected]);

  const onDayPress = (day: DateData) => {
    const iso = day.dateString; // yyyy-MM-dd
    // Guard: prevent selecting past
    if (iso < todayISO()) return;
    setSelected(prev => toggleSet(prev, iso));
  };

  const handlePayment = async () => {
    if (!adId || selected.size === 0) {
      Alert.alert('Select at least one date');
      return;
    }
    setSubmitting(true);
    try {
      await Advertisement.update(adId, {
        booked_dates: Array.from(selected), // already yyyy-MM-dd
        pricing: price,
        payment_status: 'paid',
      });
      Alert.alert('Payment successful', 'Your ad has been scheduled.');
      navigation.navigate('Feed');
    } catch (err) {
      console.error('Failed to process payment:', err);
      Alert.alert('Error', 'An error occurred during payment. Please try again.');
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
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>{'‹'}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Schedule Your Ad</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Calendar Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select Ad Campaign Dates</Text>
          <Text style={styles.cardDesc}>Choose one or more dates to run your ad.</Text>

          <Calendar
            onDayPress={onDayPress}
            markedDates={marked}
            enableSwipeMonths
            minDate={todayISO()}
          />
        </View>

        {/* Pricing Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pricing</Text>
          <View style={styles.rowBetween}> 
            <Text>Mon–Thu Rate:</Text>
            <Text style={styles.bold}>${weekdayRate.toFixed(2)}</Text>
          </View>
          <View style={styles.rowBetween}> 
            <Text>Fri–Sun Rate:</Text>
            <Text style={styles.bold}>${weekendRate.toFixed(2)}</Text>
          </View>
          <Text style={styles.muted}>Rates are flat. Any weekday(s) cost $10.00. Any weekend day(s) cost $17.50.</Text>
        </View>

        {/* Summary Card */}
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
            <Text style={[styles.bold, { fontSize: 18 }]}>Total Price:</Text>
            <Text style={{ fontSize: 22, fontWeight: '800' }}>${price.toFixed(2)}</Text>
          </View>

          <Pressable
            disabled={submitting || selected.size === 0}
            onPress={handlePayment}
            style={[styles.payBtn, (submitting || selected.size === 0) && styles.payBtnDisabled]}
          >
            {submitting ? (
              <ActivityIndicator />
            ) : (
              <Text style={styles.payBtnText}>Pay ${price.toFixed(2)}</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

/*********************************
 * Styles
 *********************************/
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
    // Shadows removed to avoid RN Web deprecation warnings
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
