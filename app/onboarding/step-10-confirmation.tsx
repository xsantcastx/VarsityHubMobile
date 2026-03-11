import PrimaryButton from '@/components/ui/PrimaryButton';
import { Type } from '@/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
// @ts-ignore
import { User } from '@/api/entities';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useOnboarding, type OnboardingState } from '@/context/OnboardingContext';
import OnboardingLayout from './components/OnboardingLayout';

export default function Step10Confirmation() {
  const router = useRouter();
  const { state: ob, clearOnboarding, setProgress, setState: setOB, progress } = useOnboarding();
  const { checkAuth, markOnboardingCompleteLocally, user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const [completing, setCompleting] = useState(false);

  // Hydrate context from server on mount to fix race condition where step-9's
  // setOB(messaging_policy_accepted: true) may not have propagated before navigation.
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const me: any = await User.me();
        if (!mounted) return;
        if (me?.preferences) {
          // eslint-disable-next-line no-console
          if (__DEV__) console.log('[Step10] Hydrated from server:', JSON.stringify({
            role: me.preferences.role,
            plan: me.preferences.plan,
            has_team_id: !!me.preferences.team_id,
            has_org_id: !!me.preferences.organization_id,
            messaging_policy_accepted: me.preferences.messaging_policy_accepted,
          }));
          setOB((prev) => ({ ...prev, ...(me.preferences as Partial<OnboardingState>) }));
        }
      } catch {
        // Non-critical — continue with local context state
      }
    })();
    return () => { mounted = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // CRITICAL: Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      if (__DEV__) console.warn('[Step10Confirmation] Unauthenticated user - redirecting to sign-in');
      router.replace('/sign-in');
    }
  }, [user, router]);

  // Fans skip this screen — their onboarding is completed in step-9
  useEffect(() => {
    if (ob.role === 'fan') {
      router.replace('/(tabs)/feed');
    }
  }, [ob.role, router]);

  const styles = useMemo(() => createStyles(colorScheme), [colorScheme]);

  useEffect(() => {
    // Only set progress if not already at step 10
    if (progress !== 9) {
      setProgress(9);
    }
  }, [setProgress, progress]);

  // Define isCoach at module scope for use across functions
  const isCoach = ob.role === 'coach';
  const displayStep = isCoach ? 10 : 9;
  const displayTotalSteps = isCoach ? 10 : 9;

  // Check completeness of onboarding
  const getCompletionStatus = () => {
    const checks = [
      {
        label: 'Email Verified',
        completed: !!user?.email_verified,
        required: true,
        route: '/(tabs)/verify-email',
        description: 'Verify your email address to unlock all features'
      },
      {
        label: 'Role Selected',
        completed: !!ob.role,
        required: true,
        route: '/onboarding/step-1-role',
        description: 'Choose your role: Fan or Coach/Organizer'
      },
      {
        label: 'Basic Info',
        completed: !!(ob.username && ob.dob),
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
        completed: !!(ob.pending_plan || ob.plan),
        required: isCoach, // Only required for coaches
        route: '/onboarding/step-3-plan',
        description: 'Choose your subscription plan (coaches only)'
      },
      {
        label: 'Page Created',
        completed: !!(ob.team_id || ob.organization_id),
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
        completed: !!ob.step_6_visited || (Array.isArray(ob.authorized) && ob.authorized.length > 0),
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

  const onComplete = async () => {
    if (!completion.allRequiredComplete) {
      Alert.alert('Setup Incomplete', 'Please complete all required steps before continuing.');
      return;
    }

    setCompleting(true);
    // eslint-disable-next-line no-console
    if (__DEV__) console.log('[Step10] onComplete start — context ob:', JSON.stringify({
      role: ob.role,
      plan: ob.plan,
      username: ob.username ? 'set' : 'MISSING',
      team_id: ob.team_id ? 'set' : 'MISSING',
      organization_id: ob.organization_id ? 'set' : 'MISSING',
      messaging_policy_accepted: ob.messaging_policy_accepted,
    }));

    try {
      // Build latestOb by merging local context with fresh server data.
      // This is the fix for the race condition where step-9's setOB may not
      // have propagated yet, and for any other fields saved server-side but
      // missing from local context (e.g. organization_id, username).
      let latestOb: OnboardingState = { ...ob };

      try {
        const prefsPatch: any = {};
        if (ob.role) {
          prefsPatch.role = ob.role;
        } else {
          // Role missing from context — recover from server
          const me: any = await User.me();
          if (me?.preferences?.role) {
            prefsPatch.role = me.preferences.role;
            latestOb = { ...latestOb, role: me.preferences.role };
            setOB((prev) => ({ ...prev, role: me.preferences.role }));
          } else {
            throw new Error('Role not set. Please go back to step 1 and select your role.');
          }
        }
        if (ob.dob) prefsPatch.dob = ob.dob;
        if (typeof ob.zip_code !== 'undefined') prefsPatch.zip_code = ob.zip_code;
        if (Object.keys(prefsPatch).length > 0) {
          await User.updatePreferences(prefsPatch);
        }

        // Fetch latest server prefs and merge — this fills any fields that were
        // saved to the backend in prior steps but are absent from local context.
        const me: any = await User.me();
        if (me?.preferences) {
          latestOb = { ...latestOb, ...(me.preferences as Partial<OnboardingState>) };
          setOB((prev) => ({ ...(prev || {}), ...(me.preferences as Partial<OnboardingState>) }));
        }
        // eslint-disable-next-line no-console
        if (__DEV__) console.log('[Step10] latestOb after server merge:', JSON.stringify({
          role: latestOb.role,
          plan: latestOb.plan,
          username: latestOb.username ? 'set' : 'MISSING',
          team_id: latestOb.team_id ? 'set' : 'MISSING',
          organization_id: latestOb.organization_id ? 'set' : 'MISSING',
          messaging_policy_accepted: latestOb.messaging_policy_accepted,
        }));
      } catch (e) {
        if (__DEV__) console.warn('[Onboarding][Step10] failed to patch preferences before complete', e);
      }

      const finalRole = latestOb.role;
      const finalIsCoach = finalRole === 'coach';

      if (!finalRole) {
        throw new Error('Role is required. Please go back to step 1 and select your role (Fan or Coach).');
      }

      // Payment is deferred until after admin approval — allow onboarding
      // to complete with payment_pending=true. The billing screen will
      // prompt for payment once the org admin approves the coach.

      const allowedAffiliations = new Set([
        'none', 'university', 'high_school', 'club', 'youth', 'school', 'independent',
      ]);
      const normalizedAffiliation =
        latestOb.affiliation === 'professional'
          ? 'independent'
          : (typeof latestOb.affiliation === 'string' && allowedAffiliations.has(latestOb.affiliation)
            ? latestOb.affiliation
            : undefined);

      // Build payload from latestOb (merged local + server), NOT the stale ob closure.
      const completionPayload: Record<string, any> = {
        role: finalRole,
        username: latestOb.username,
        affiliation: normalizedAffiliation,
        dob: latestOb.dob,
        zip: latestOb.zip,
        zip_code: latestOb.zip_code,

        plan: finalIsCoach ? latestOb.plan : undefined,
        pending_plan: finalIsCoach ? latestOb.pending_plan : undefined,
        payment_pending: finalIsCoach ? latestOb.payment_pending : undefined,

        team_id: finalIsCoach ? latestOb.team_id : undefined,
        team_name: finalIsCoach ? latestOb.team_name : undefined,
        organization_id: finalIsCoach ? latestOb.organization_id : undefined,
        organization_name: finalIsCoach ? latestOb.organization_name : undefined,
        join_request_pending: finalIsCoach ? latestOb.join_request_pending : undefined,
        sport: finalIsCoach ? latestOb.sport : undefined,

        authorized: finalIsCoach ? latestOb.authorized : undefined,
        authorized_users: finalIsCoach ? latestOb.authorized_users : undefined,

        avatar_url: latestOb.avatar_url,
        bio: latestOb.bio || undefined,
        sports_interests: latestOb.sports_interests,

        primary_intents: latestOb.primary_intents,
        personalization_goals: latestOb.personalization_goals,

        location_enabled: latestOb.location_enabled,
        notifications_enabled: latestOb.notifications_enabled,
        messaging_policy_accepted: latestOb.messaging_policy_accepted,
      };

      const cleanedPayload: Record<string, any> = {};
      Object.entries(completionPayload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          cleanedPayload[key] = value;
        }
      });

      if (finalIsCoach) {
        if (!cleanedPayload.role || cleanedPayload.role !== 'coach') {
          cleanedPayload.role = 'coach';
        }
        cleanedPayload.onboarding_completed = true;
      }

      // eslint-disable-next-line no-console
      if (__DEV__) console.log('[Step10] Final payload:', JSON.stringify({
        role: cleanedPayload.role,
        plan: cleanedPayload.plan,
        username: cleanedPayload.username ? 'set' : 'MISSING',
        team_id: cleanedPayload.team_id ? 'set' : 'MISSING',
        organization_id: cleanedPayload.organization_id ? 'set' : 'MISSING',
        messaging_policy_accepted: cleanedPayload.messaging_policy_accepted,
      }));

      await User.completeOnboarding(cleanedPayload);

      // Validate server confirmed completion BEFORE clearing local state
      const updatedUser: any = await checkAuth();
      if ((updatedUser?.preferences as any)?.onboarding_completed !== true) {
        throw new Error('Server did not confirm onboarding completion. Please try again.');
      }

      await markOnboardingCompleteLocally();
      void clearOnboarding();
      router.replace('/(tabs)');
    } catch (e: any) {
      const zodIssues = e?.data?.issues || e?.data?.details?.issues;
      if (__DEV__ && zodIssues) {
        if (__DEV__) console.warn('[Onboarding][Step10] Invalid payload issues:', zodIssues);
      }
      const errorMessage = e?.data?.error || e?.message || 'Failed to complete onboarding';
      if (__DEV__) console.error('[Step10] onComplete error:', errorMessage);
      Alert.alert(
        'Setup Not Complete',
        errorMessage,
        [
          { text: 'Retry', onPress: () => void onComplete(), style: 'default' },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } finally {
      setCompleting(false);
    }
  };

  return (
    <OnboardingLayout
      step={displayStep}
      totalSteps={displayTotalSteps}
      title="Almost Ready!"
      subtitle="Review your setup before completing onboarding"
      showBackButton={false}
    >
      <Stack.Screen options={{ title: `Step ${displayStep}/${displayTotalSteps}`, headerShown: false }} />
      
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
              accessibilityLabel={check.completed ? `${check.label}, completed` : `${check.label}, tap to fix`}
              accessibilityRole="button"
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
          {ob.role === 'coach' && (() => {
            const displayPlan = ob.pending_plan || ob.plan;
            const isPending = !!ob.pending_plan;
            return (
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Plan:</Text>
                <Text style={styles.summaryValue}>
                  {displayPlan === 'rookie' ? 'Rookie (Free)' :
                   displayPlan === 'veteran' ? `Veteran ($1.00/month per team)${isPending ? ' - pending approval' : ''}` :
                   displayPlan === 'legend' ? `Legend ($20/year unlimited)${isPending ? ' - pending approval' : ''}` : 'Not selected'}
                </Text>
              </View>
            );
          })()}
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
          <PrimaryButton
            label={completing ? 'Completing Setup...' : 'Complete Setup'}
            onPress={onComplete}
            disabled={completing || !completion.allRequiredComplete}
            loading={completing}
            accessibilityLabel={completing ? 'Completing setup' : 'Complete setup'}
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
