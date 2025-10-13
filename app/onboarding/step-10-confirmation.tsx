import PrimaryButton from '@/ui/PrimaryButton';
import { Type } from '@/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { OnboardingBackHeader } from '@/components/onboarding/OnboardingBackHeader';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { User } from '@/api/entities';
import { useOnboarding } from '@/context/OnboardingContext';
import { useEffect } from 'react';

export default function Step10Confirmation() {
  const router = useRouter();
  const { state: ob, clearOnboarding, setProgress, setState: setOB } = useOnboarding();

  useEffect(() => {
    setProgress(9);
  }, [setProgress]);
  const [completing, setCompleting] = useState(false);

  // Check completeness of onboarding
  const getCompletionStatus = () => {
    const checks = [
      {
        label: 'Role Selected',
        completed: !!ob.role,
        required: true,
        route: '/onboarding/step-1-role',
        description: 'Choose your role: Fan or Coach/Organizer'
      },
      {
        label: 'Basic Info',
        completed: !!(ob.display_name && ob.dob && (ob.zip || ob.zip_code)),
        required: true,
        route: '/onboarding/step-2-basic',
        description: 'Set username, date of birth, and location'
      },
      {
        label: 'Plan Selected',
        completed: !!ob.plan,
        required: true,
        route: '/onboarding/step-3-plan',
        description: 'Choose your subscription plan'
      },
      {
        label: 'Season Set',
        completed: !!(ob.season_start && ob.season_end),
        required: true,
        route: '/onboarding/step-4-season',
        description: 'Set your season dates'
      },
      {
        label: 'Page Created',
        completed: !!(ob.team_name || ob.organization_name),
        required: true,
        route: '/onboarding/step-5-league',
        description: 'Create your team or organization page'
      },
      {
        label: 'Profile Setup',
        completed: !!(ob.bio && ob.sports_interests?.length),
        required: false,
        route: '/onboarding/step-7-profile',
        description: 'Complete your profile and sports interests'
      },
      {
        label: 'Authorized Users',
        completed: Array.isArray(ob.authorized) && ob.authorized.length > 0,
        required: false,
        route: '/onboarding/step-6-authorized-users',
        description: 'Manage authorized users (optional)'
      },
      {
        label: 'Interests Set',
        completed: !!(ob.personalization_goals?.length),
        required: false,
        route: '/onboarding/step-8-interests',
        description: 'Set your personalization preferences'
      },
      {
        label: 'Features Configured',
        completed: ob.messaging_policy_accepted === true,
        required: true,
        route: '/onboarding/step-9-features',
        description: 'Configure app features and permissions'
      },
    ];
    
    const requiredCompleted = checks.filter(check => check.required && check.completed).length;
    const totalRequired = checks.filter(check => check.required).length;
    const optionalCompleted = checks.filter(check => !check.required && check.completed).length;
    const totalOptional = checks.filter(check => !check.required).length;
    
    return { 
      checks, 
      requiredCompleted, 
      totalRequired, 
      optionalCompleted, 
      totalOptional,
      allRequiredComplete: requiredCompleted === totalRequired 
    };
  };

  const completion = getCompletionStatus();

  const handleStepPress = (step: any) => {
    if (!step.completed) {
      router.push({
        pathname: step.route,
        params: { returnToConfirmation: 'true' }
      });
    }
  };

  const onComplete = async () => {
    if (!completion.allRequiredComplete) {
      Alert.alert('Setup Incomplete', 'Please complete all required steps before continuing.');
      return;
    }

    setCompleting(true);
    try {
      // Debug: log final payload
      try { // eslint-disable-next-line no-console
        console.debug('[Onboarding][Step10] final payload', { role: ob.role, dob: ob.dob, ob });
      } catch (e) {}
      // Ensure basic preferences (role etc.) persisted before finalizing onboarding
      try {
        const prefsPatch: any = {};
        if (ob.role) prefsPatch.role = ob.role;
        if (ob.display_name) prefsPatch.display_name = ob.display_name;
        if (ob.dob) prefsPatch.dob = ob.dob;
        if (typeof ob.zip_code !== 'undefined') prefsPatch.zip_code = ob.zip_code;
        if (Object.keys(prefsPatch).length > 0) {
          await User.updatePreferences(prefsPatch);
        }
          try {
            const me: any = await User.me();
            // eslint-disable-next-line no-console
            console.debug('[Onboarding][Step10] server prefs after patch', me?.preferences);
            // Merge server prefs into onboarding state if present
            if (me?.preferences) setOB((prev) => ({ ...(prev || {}), ...(me.preferences || {}) } as any));
          } catch (e) {}
      } catch (e) {
        // best-effort; continue to complete onboarding
        // eslint-disable-next-line no-console
        console.warn('[Onboarding][Step10] failed to patch preferences before complete', e);
      }
      // Final submission to backend - mark onboarding as complete
      await User.completeOnboarding(ob);
      
      // Clear onboarding state
      clearOnboarding();
      
      // Navigate to main app - use router.push to ensure proper navigation
      router.push('/(tabs)/feed');
    } catch (e: any) {
      console.error('Onboarding completion error:', e);
      Alert.alert('Setup Failed', e?.message || 'Please try again or contact support.');
    } finally { 
      setCompleting(false); 
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Step 10/10' }} />
      <OnboardingBackHeader
        title="Review & Finish"
        subtitle="Double-check your setup before going live"
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={48} color="#059669" />
          </View>
          <Text style={styles.title}>Almost Ready!</Text>
          <Text style={styles.subtitle}>
            Review your setup before completing onboarding
          </Text>
        </View>

        {/* Progress Overview */}
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Setup Progress</Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${(completion.requiredCompleted / completion.totalRequired) * 100}%` 
                }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {completion.requiredCompleted} of {completion.totalRequired} required steps completed
          </Text>
          {completion.optionalCompleted > 0 && (
            <Text style={styles.optionalText}>
              Plus {completion.optionalCompleted} optional steps completed
            </Text>
          )}
        </View>

        {/* Completion Checklist */}
        <View style={styles.checklistCard}>
          <Text style={styles.checklistTitle}>Setup Checklist</Text>
          <Text style={styles.checklistSubtitle}>Tap incomplete steps to fix them</Text>
          {completion.checks.map((check, index) => (
            <Pressable 
              key={index} 
              style={[
                styles.checklistItem,
                !check.completed && styles.checklistItemClickable
              ]}
              onPress={() => handleStepPress(check)}
              disabled={check.completed}
            >
              <View style={[
                styles.checklistIcon, 
                check.completed ? styles.checklistIconCompleted : styles.checklistIconIncomplete
              ]}>
                <Ionicons 
                  name={check.completed ? "checkmark" : "close"} 
                  size={16} 
                  color={check.completed ? "#059669" : "#DC2626"} 
                />
              </View>
              <View style={styles.checklistContent}>
                <View style={styles.checklistHeader}>
                  <Text style={[
                    styles.checklistLabel, 
                    check.completed && styles.checklistLabelCompleted
                  ]}>
                    {check.label}
                  </Text>
                  {check.required && !check.completed && (
                    <View style={styles.requiredBadge}>
                      <Text style={styles.requiredBadgeText}>Required</Text>
                    </View>
                  )}
                  {!check.completed && (
                    <Ionicons 
                      name="chevron-forward" 
                      size={16} 
                      color="#6B7280" 
                      style={styles.chevronIcon}
                    />
                  )}
                </View>
                {!check.completed && (
                  <Text style={styles.checklistDescription}>
                    {check.description}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
        </View>

        {/* Account Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Account Summary</Text>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Role:</Text>
            <Text style={styles.summaryValue}>
              {ob.role === 'fan' ? 'Fan' : 'Coach/Organizer'}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Plan:</Text>
            <Text style={styles.summaryValue}>
              {ob.plan === 'rookie' ? 'Rookie (Free)' : 
               ob.plan === 'veteran' ? 'Veteran ($70/year)' : 'Legend ($150/year)'}
            </Text>
          </View>
          {ob.team_name && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Team:</Text>
              <Text style={styles.summaryValue}>{ob.team_name}</Text>
            </View>
          )}
          {ob.organization_name && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Organization:</Text>
              <Text style={styles.summaryValue}>{ob.organization_name}</Text>
            </View>
          )}
          {ob.season_start && ob.season_end && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Season:</Text>
              <Text style={styles.summaryValue}>
                {new Date(ob.season_start).toLocaleDateString()} - {new Date(ob.season_end).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        {/* Warning for Incomplete Setup */}
        {!completion.allRequiredComplete && (
          <View style={styles.warningCard}>
            <Ionicons name="warning" size={20} color="#DC2626" />
            <Text style={styles.warningText}>
              Some required setup steps are incomplete. Please finish these before completing onboarding.
            </Text>
          </View>
        )}

        {/* Complete Setup Button */}
        <View style={styles.completeSection}>
          <PrimaryButton 
            label={completing ? 'Completing Setup...' : 'Complete Setup'} 
            onPress={onComplete} 
            disabled={completing || !completion.allRequiredComplete} 
            loading={completing} 
          />
          <Text style={styles.completeHelpText}>
            You'll be taken to your dashboard after completing setup
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'white' 
  },
  scrollContent: { 
    padding: 16, 
    paddingBottom: 32 
  },
  
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    marginBottom: 16,
  },
  title: { 
    ...(Type.h1 as any), 
    marginBottom: 8, 
    textAlign: 'center' 
  },
  subtitle: { 
    color: '#6b7280', 
    textAlign: 'center', 
    fontSize: 16,
    lineHeight: 24
  },
  
  progressCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#059669',
    borderRadius: 4,
  },
  progressText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '500',
  },
  optionalText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  
  checklistCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  checklistTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  checklistIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checklistIconCompleted: {
    backgroundColor: '#D1FAE5',
  },
  checklistIconIncomplete: {
    backgroundColor: '#FEE2E2',
  },
  checklistLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  checklistLabelCompleted: {
    color: '#059669',
    fontWeight: '500',
  },
  requiredBadge: {
    backgroundColor: '#FCA5A5',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  requiredBadgeText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '600',
  },
  
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#64748B',
    fontSize: 14,
    width: 100,
  },
  summaryValue: {
    flex: 1,
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '500',
  },
  
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  warningText: {
    flex: 1,
    marginLeft: 8,
    color: '#DC2626',
    fontSize: 14,
    lineHeight: 20,
  },
  
  completeSection: {
    marginTop: 24,
  },
  completeHelpText: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },

  // New styles for interactive checklist
  checklistSubtitle: {
    color: '#6B7280',
    fontSize: 13,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  checklistItemClickable: {
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  checklistContent: {
    flex: 1,
    marginLeft: 12,
  },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chevronIcon: {
    marginLeft: 8,
  },
  checklistDescription: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
});

