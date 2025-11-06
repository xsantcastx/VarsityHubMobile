import { User } from '@/api/entities';
import { useOnboarding } from '@/context/OnboardingContext';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { Type } from '@/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import OnboardingLayout from './components/OnboardingLayout';

export default function Step4Season() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnToConfirmation?: string }>();
  const returnToConfirmation = params.returnToConfirmation === 'true';
  const { state: ob, setState: setOB, setProgress } = useOnboarding();
  const [startDate, setStartDate] = useState<string | null>(ob.season_start ?? null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ob.season_start) setStartDate(ob.season_start);
  }, [ob.season_start]);


  // Calculate 6-month end date
  const endDate = useMemo(() => {
    if (!startDate) return null;
    const start = new Date(startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 6);
    return end.toISOString().split('T')[0];
  }, [startDate]);

  // Get plan details for UI
  const planInfo = useMemo(() => {
    switch (ob.plan) {
      case 'rookie':
        return {
          name: 'Rookie (Free Trial)',
          description: '6-month free trial season',
          color: '#16A34A'
        };
      case 'veteran':
        return {
          name: 'Veteran ($70/year)',
          description: '6-month subscription season',
          color: '#2563EB'
        };
      case 'legend':
        return {
          name: 'Legend ($150/year)',
          description: '6-month subscription season',
          color: '#7C3AED'
        };
      default:
        return {
          name: 'Selected Plan',
          description: '6-month season',
          color: '#6B7280'
        };
    }
  }, [ob.plan]);

  const onContinue = async () => {
    if (!startDate || !endDate) return;
    setSaving(true);
    try {
      setOB((prev) => ({ 
        ...prev, 
        season_start: startDate,
        season_end: endDate
      }));
      
      // Persist season dates to user's preferences so server knows the selected season
      try {
        await User.updatePreferences({ season_start: startDate, season_end: endDate });
      } catch (err) {
        // Non-fatal: continue onboarding even if preferences persistence fails
        console.warn('Failed to persist season to backend:', err);
      }

      setProgress(4);
      if (returnToConfirmation) {
        router.replace('/onboarding/step-10-confirmation');
      } else {
        router.push('/onboarding/step-5-league');
      }
    } catch (e: any) {
      console.error('Failed to save season:', e);
      if (returnToConfirmation) {
        router.replace('/onboarding/step-10-confirmation');
      } else {
        router.push('/onboarding/step-5-league');
      }
    } finally {
      setSaving(false);
    }
  };

  // Generate suggested seasons
  const suggestedSeasons = useMemo(() => {
    const now = new Date();
    const suggestions = [];
    
    // Current month as start
    const current = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentEnd = new Date(current);
    currentEnd.setMonth(currentEnd.getMonth() + 6);
    
    // Next month as start
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextEnd = new Date(next);
    nextEnd.setMonth(nextEnd.getMonth() + 6);
    
    // Academic year (September start)
    const academic = new Date(now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1, 8, 1);
    const academicEnd = new Date(academic);
    academicEnd.setMonth(academicEnd.getMonth() + 6);
    
    suggestions.push({
      label: 'Start This Month',
      start: current.toISOString().split('T')[0],
      end: currentEnd.toISOString().split('T')[0],
    });
    
    suggestions.push({
      label: 'Start Next Month',
      start: next.toISOString().split('T')[0],
      end: nextEnd.toISOString().split('T')[0],
    });
    
    if (academic.getTime() !== current.getTime()) {
      suggestions.push({
        label: 'Academic Season',
        start: academic.toISOString().split('T')[0],
        end: academicEnd.toISOString().split('T')[0],
      });
    }
    
    return suggestions;
  }, []);

  return (
    <OnboardingLayout
      step={4}
      title="Set Your Season"
      subtitle="Choose when your 6-month season begins"
    >
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Plan Info */}
      <View style={[styles.planInfo, { borderLeftColor: planInfo.color }]}>
          <Text style={[styles.planName, { color: planInfo.color }]}>{planInfo.name}</Text>
          <Text style={styles.planDescription}>{planInfo.description}</Text>
        </View>

        {/* Quick Suggestions */}
        <Text style={styles.sectionTitle}>Quick Start Options</Text>
        {suggestedSeasons.map((season, index) => (
          <Pressable
            key={index}
            style={[
              styles.suggestionCard,
              startDate === season.start && styles.suggestionSelected
            ]}
            onPress={() => setStartDate(season.start)}
          >
            <View style={styles.suggestionHeader}>
              <Text style={styles.suggestionLabel}>{season.label}</Text>
              {startDate === season.start && (
                <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
              )}
            </View>
            <Text style={styles.suggestionDates}>
              {new Date(season.start).toLocaleDateString()} - {new Date(season.end).toLocaleDateString()}
            </Text>
          </Pressable>
        ))}

        {/* Custom Calendar */}
        <Text style={styles.sectionTitle}>Or Pick a Custom Start Date</Text>
        <View style={styles.calendarContainer}>
          <Calendar
            onDayPress={(day) => setStartDate(day.dateString)}
            markedDates={startDate ? {
              [startDate]: {
                selected: true,
                selectedColor: '#111827'
              }
            } : {}}
            minDate={new Date().toISOString().split('T')[0]}
            theme={{
              selectedDayBackgroundColor: '#111827',
              todayTextColor: '#2563EB',
              arrowColor: '#111827',
            }}
          />
        </View>

        {/* Season Summary */}
        {startDate && endDate && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Season Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Start Date:</Text>
              <Text style={styles.summaryValue}>{new Date(startDate).toLocaleDateString()}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>End Date:</Text>
              <Text style={styles.summaryValue}>{new Date(endDate).toLocaleDateString()}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Duration:</Text>
              <Text style={styles.summaryValue}>6 months</Text>
            </View>
          </View>
        )}

        {startDate && (
          <PrimaryButton 
            label={saving ? 'Setting up season...' : 'Continue'} 
            onPress={onContinue} 
            disabled={saving} 
          loading={saving} 
        />
      )}
    </OnboardingLayout>
  );
}const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'white' 
  },
  scrollContent: { 
    padding: 16, 
    paddingBottom: 28 
  },
  title: { 
    ...(Type.h1 as any), 
    marginBottom: 8, 
    textAlign: 'center' 
  },
  subtitle: { 
    color: '#6b7280', 
    marginBottom: 24, 
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24
  },
  planInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    marginBottom: 24,
  },
  planName: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 2,
  },
  planDescription: {
    color: '#6B7280',
    fontSize: 14,
  },
  sectionTitle: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 12,
    marginTop: 8,
  },
  suggestionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  suggestionSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#111827',
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  suggestionLabel: {
    fontWeight: '600',
    fontSize: 14,
  },
  suggestionDates: {
    color: '#6B7280',
    fontSize: 12,
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    overflow: 'hidden',
  },
  summaryCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  summaryTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#166534',
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryLabel: {
    color: '#166534',
    fontSize: 14,
  },
  summaryValue: {
    color: '#166534',
    fontSize: 14,
    fontWeight: '600',
  },
});








