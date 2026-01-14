import PrimaryButton from '@/components/ui/PrimaryButton';
import { Type } from '@/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
// @ts-ignore
import { User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useOnboarding } from '@/context/OnboardingContext';
import { useEffect } from 'react';
import OnboardingLayout from './components/OnboardingLayout';

export default function Step10Confirmation() {
  const router = useRouter();
  const { state: ob, clearOnboarding, setProgress, setState: setOB, progress } = useOnboarding();
  const { checkAuth, markOnboardingCompleteLocally, user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const [completing, setCompleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // CRITICAL: Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      console.warn('[Step10Confirmation] Unauthenticated user - redirecting to sign-in');
      router.replace('/sign-in');
    }
  }, [user, router]);

  const styles = useMemo(() => createStyles(colorScheme), [colorScheme]);

  useEffect(() => {
    // Only set progress if not already at step 10
    if (progress !== 8) {
      setProgress(8);
    }
  }, [setProgress, progress]);

  // Define isCoach at module scope for use across functions
  const isCoach = ob.role === 'coach';

  // Check completeness of onboarding
  const getCompletionStatus = () => {
<<<<<<< HEAD
=======
    const isFan = ob.role === 'fan';
    const isCoach = ob.role === 'coach';
    const paymentRequired = isCoach && (ob.plan === 'veteran' || ob.plan === 'legend');
    const paymentCompleted = !paymentRequired || ob.payment_pending === false;

>>>>>>> 19009a9 (fix: add runtimeVersion to align with Expo.plist for EAS build)
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
        label: 'Username',
        completed: !!ob.username,
        required: true,
        route: '/onboarding/step-7-profile',
        description: 'Choose a unique username'
      },
      {
        label: 'Plan Selected',
        completed: !!ob.plan,
        required: isCoach, // Only required for coaches
        route: '/onboarding/step-3-plan',
        description: 'Choose your subscription plan (coaches only)'
      },
      ...(paymentRequired ? [{
        label: 'Subscription Payment',
        completed: paymentCompleted,
        required: true,
        route: '/onboarding/step-3-plan',
        description: 'Complete checkout for your coach plan'
      }] : []),
      {
        label: 'Page Created',
        completed: !!(ob.team_name || ob.organization_name),
        required: isCoach, // Only required for coaches
        route: '/onboarding/step-4-organization',
        description: 'Create your team or organization page (coaches only)'
      },
      {
        label: 'Profile Setup',
        completed: !!(ob.sports_interests && ob.sports_interests.length > 0),
        required: false,
        route: '/onboarding/step-7-profile',
        description: 'Complete your profile and sports interests'
      },
      {
        label: 'Authorized Users',
        completed: Array.isArray(ob.authorized) && ob.authorized.length > 0,
        required: false,
        route: '/onboarding/step-6-authorized-users',
        description: 'Manage authorized users (optional, coaches only)'
      },
      {
        label: 'Interests Set',
        completed: !!(ob.primary_intents && ob.primary_intents.length > 0),
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

  // Define isCoach based on role
  const isCoach = ob.role === 'coach';

  const onComplete = async () => {
    if (!completion.allRequiredComplete) {
      Alert.alert('Setup Incomplete', 'Please complete all required steps before continuing.');
      setErrorMessage('Complete all required steps before finishing setup.');
      return;
    }

    setErrorMessage(null);
    setCompleting(true);
    try {
      // Debug: log final payload
      try { // eslint-disable-next-line no-console
      } catch {}
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
            // Merge server prefs into onboarding state if present
            if (me?.preferences) setOB((prev) => ({ ...(prev || {}), ...(me.preferences || {}) } as any));
          } catch {}
      } catch (e) {
        // best-effort; continue to complete onboarding
        // eslint-disable-next-line no-console
        console.warn('[Onboarding][Step10] failed to patch preferences before complete', e);
      }
      
      // Send complete onboarding state - all fields
      // IMPORTANT: Fans should NOT have plans
      const completionPayload: any = {
        // Core identity fields
        role: ob.role,
        username: ob.username,
        display_name: ob.display_name,
        messaging_policy_accepted: ob.messaging_policy_accepted,
      };
      
      // Only add defined values to avoid validation issues with undefined fields
      if (ob.affiliation) {
        // WORKAROUND: Backend may not have 'professional' enum value yet
        // Map it to 'independent' for compatibility
        completionPayload.affiliation = ob.affiliation === 'professional' ? 'independent' : ob.affiliation;
      }
      if (ob.dob) completionPayload.dob = ob.dob;
      if (ob.zip) completionPayload.zip = ob.zip;
      if (ob.zip_code) completionPayload.zip_code = ob.zip_code;
      
      // Plan and subscription (ONLY for coaches)
      if (isCoach) {
        // Always set plan for coaches, default to rookie if not set
        completionPayload.plan = ob.plan || 'rookie';
        if (ob.payment_pending !== undefined) completionPayload.payment_pending = ob.payment_pending;
      }
      
      // Team/Organization (ONLY for coaches)
      if (isCoach) {
        if (ob.team_id) completionPayload.team_id = ob.team_id;
        if (ob.team_name) completionPayload.team_name = ob.team_name;
        if (ob.organization_id) completionPayload.organization_id = ob.organization_id;
        if (ob.organization_name) completionPayload.organization_name = ob.organization_name;
        if (ob.sport) completionPayload.sport = ob.sport;
        if (ob.authorized) completionPayload.authorized = ob.authorized;
        if (ob.authorized_users) completionPayload.authorized_users = ob.authorized_users;
      }
      
      // Profile (ALL users)
      if (ob.avatar_url) completionPayload.avatar_url = ob.avatar_url;
      if (ob.bio) completionPayload.bio = ob.bio;
      if (ob.sports_interests) completionPayload.sports_interests = ob.sports_interests;
      
      // Interests/Goals (ALL users)
      if (ob.primary_intents) completionPayload.primary_intents = ob.primary_intents;
      if (ob.personalization_goals) completionPayload.personalization_goals = ob.personalization_goals;
      
      // Features/Permissions (ALL users)
      if (ob.location_enabled !== undefined) completionPayload.location_enabled = ob.location_enabled;
      if (ob.notifications_enabled !== undefined) completionPayload.notifications_enabled = ob.notifications_enabled;
      
      // Log the payload before sending
      console.log('[Step10] Completion payload:', JSON.stringify(completionPayload, null, 2));
      
      // Final submission to backend - mark onboarding as complete
      await User.completeOnboarding(completionPayload);
      
<<<<<<< HEAD
      // CRITICAL: Validate server confirmed completion BEFORE clearing local state
      const updatedUser: any = await checkAuth();
      
      if (updatedUser?.preferences?.onboarding_completed !== true) {
        throw new Error('Server did not confirm onboarding completion. Please try again.');
      }
      
      // Server confirmed success - now safe to clear local state
      await markOnboardingCompleteLocally();
      clearOnboarding();
=======
      // Clear onboarding state
      await clearOnboarding();
>>>>>>> 19009a9 (fix: add runtimeVersion to align with Expo.plist for EAS build)
      
      // Navigate to main app
      router.replace('/(tabs)');
    } catch (e: any) {
<<<<<<< HEAD
      const errorMessage = e?.message || 'Failed to complete onboarding';
      
      // Extract detailed Zod validation errors if available
      const validationIssues = e?.data?.details?.issues;
      
      console.error('[Step10] Completion failed:', {
        error: errorMessage,
        status: e?.status,
        data: e?.data,
        validationIssues: validationIssues ? JSON.stringify(validationIssues, null, 2) : 'none',
        currentPlan: ob.plan,
        role: ob.role
      });
      
      // Build user-friendly error message
      let displayMessage = errorMessage;
      if (validationIssues && Array.isArray(validationIssues)) {
        const issueMessages = validationIssues.map((issue: any) => 
          `${issue.path?.join('.') || 'unknown'}: ${issue.message}`
        ).join('\n');
        displayMessage = `Validation errors:\n${issueMessages}`;
      }
      
      Alert.alert(
        'Setup Not Complete', 
        displayMessage + '\n\nYour progress has been saved. Please review the steps and try again.',
        [
          { 
            text: 'Retry', 
            onPress: () => void onComplete(),
            style: 'default'
          },
          { 
            text: 'Review Steps', 
            style: 'cancel' 
          }
        ]
      );
      // DO NOT clear onboarding state on error - preserve user's progress
=======
      console.error('Onboarding completion error:', e);
      Alert.alert('Setup Failed', e?.message || 'Please try again or contact support.');
      setErrorMessage(e?.message || 'Unable to complete setup. Please try again.');
>>>>>>> 19009a9 (fix: add runtimeVersion to align with Expo.plist for EAS build)
    } finally { 
      setCompleting(false); 
    }
  };

  return (
    <OnboardingLayout
      step={9}
      title="Almost Ready!"
      subtitle="Review your setup before completing onboarding"
      showBackButton={false}
    >
      <Stack.Screen options={{ title: 'Step 10/10', headerShown: false }} />
      
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
                  color={check.completed ? (colorScheme === 'dark' ? '#10b981' : '#059669') : (colorScheme === 'dark' ? '#ef4444' : '#DC2626')} 
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
                      color={Colors[colorScheme].mutedText} 
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
          {ob.role === 'coach' && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Plan:</Text>
              <Text style={styles.summaryValue}>
                {ob.plan === 'rookie' ? 'Rookie (Free)' : 
                 ob.plan === 'veteran' ? 'Veteran ($1.50/month per team)' : 
                 ob.plan === 'legend' ? 'Legend ($20/year unlimited)' : 'Not selected'}
              </Text>
            </View>
          )}
          {ob.role === 'fan' && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Subscription:</Text>
              <Text style={styles.summaryValue}>Free (No subscription needed)</Text>
            </View>
          )}
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
        </View>

        {/* Warning for Incomplete Setup */}
        {!completion.allRequiredComplete && (
          <View style={styles.warningCard}>
            <Ionicons name="warning" size={20} color={colorScheme === 'dark' ? '#ef4444' : '#DC2626'} />
            <Text style={styles.warningText}>
              Some required setup steps are incomplete. Please finish these before completing onboarding.
            </Text>
          </View>
        )}

        {/* Complete Setup Button */}
        <View style={styles.completeSection}>
          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}
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
    </OnboardingLayout>
  );
}

const createStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Colors[colorScheme].background 
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
    textAlign: 'center',
    color: Colors[colorScheme].text
  },
  subtitle: { 
    color: Colors[colorScheme].mutedText, 
    textAlign: 'center', 
    fontSize: 16,
    lineHeight: 24
  },
  
  progressCard: {
    backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors[colorScheme].border,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors[colorScheme].text,
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colorScheme === 'dark' ? '#10b981' : '#059669',
    borderRadius: 4,
  },
  progressText: {
    color: Colors[colorScheme].text,
    fontSize: 14,
    fontWeight: '500',
  },
  optionalText: {
    color: Colors[colorScheme].mutedText,
    fontSize: 12,
    marginTop: 2,
  },
  
  checklistCard: {
    backgroundColor: Colors[colorScheme].surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors[colorScheme].border,
  },
  checklistTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors[colorScheme].text,
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
    backgroundColor: colorScheme === 'dark' ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5',
  },
  checklistIconIncomplete: {
    backgroundColor: colorScheme === 'dark' ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
  },
  checklistLabel: {
    flex: 1,
    fontSize: 14,
    color: Colors[colorScheme].text,
  },
  checklistLabelCompleted: {
    color: colorScheme === 'dark' ? '#10b981' : '#059669',
    fontWeight: '500',
  },
  requiredBadge: {
    backgroundColor: colorScheme === 'dark' ? 'rgba(239, 68, 68, 0.2)' : '#FCA5A5',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  requiredBadgeText: {
    color: colorScheme === 'dark' ? '#ef4444' : '#DC2626',
    fontSize: 10,
    fontWeight: '600',
  },
  
  summaryCard: {
    backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors[colorScheme].border,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors[colorScheme].text,
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  summaryLabel: {
    color: Colors[colorScheme].mutedText,
    fontSize: 14,
    width: 100,
  },
  summaryValue: {
    flex: 1,
    color: Colors[colorScheme].text,
    fontSize: 14,
    fontWeight: '500',
  },
  
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colorScheme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colorScheme === 'dark' ? 'rgba(239, 68, 68, 0.3)' : '#FCA5A5',
  },
  warningText: {
    flex: 1,
    marginLeft: 8,
    color: colorScheme === 'dark' ? '#ef4444' : '#DC2626',
    fontSize: 14,
    lineHeight: 20,
  },
  
  completeSection: {
    marginTop: 24,
  },
  errorText: {
    color: colorScheme === 'dark' ? '#fca5a5' : '#DC2626',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  completeHelpText: {
    color: Colors[colorScheme].mutedText,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },

  // New styles for interactive checklist
  checklistSubtitle: {
    color: Colors[colorScheme].mutedText,
    fontSize: 13,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  checklistItemClickable: {
    backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
    borderLeftWidth: 3,
    borderLeftColor: colorScheme === 'dark' ? '#ef4444' : '#DC2626',
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
    color: Colors[colorScheme].mutedText,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
});
