import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/Colors';
import PrimaryButton from '@/components/ui/PrimaryButton';
import Segmented from '@/ui/Segmented';
import { Type } from '@/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View, useColorScheme } from 'react-native';
// @ts-ignore
import { Organization, Team } from '@/api/entities';
import { useOnboarding } from '@/context/OnboardingContext';
import OnboardingLayout from './components/OnboardingLayout';

export default function Step5League() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const params = useLocalSearchParams<{ returnToConfirmation?: string }>();
  const returnToConfirmation = params.returnToConfirmation === 'true';
  const { state: ob, setState: setOB, setProgress } = useOnboarding();
  const [orgName, setOrgName] = useState('');
  const [location, setLocation] = useState('');
  const [orgType, setOrgType] = useState<'school' | 'organization' | null>(null);
  const [teamName, setTeamName] = useState('');
  const [ageGroup, setAgeGroup] = useState<'youth' | 'adult' | 'mixed' | null>(null);
  const [saving, setSaving] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [existingTeam, setExistingTeam] = useState<any>(null);
  const [existingOrg, setExistingOrg] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  const styles = useMemo(() => createStyles(colorScheme), [colorScheme]);

  // Check if user already has a team or organization in the database
  useEffect(() => {
    (async () => {
      setChecking(true);
      try {
        // Check for existing managed teams
        const teams = await Team.managed();
        if (teams && teams.length > 0) {
          const firstTeam = teams[0];
          setExistingTeam(firstTeam);
          setTeamName(firstTeam.name || '');
          setAlreadyExists(true);
          // Update onboarding state with existing team
          setOB((prev) => ({ 
            ...prev, 
            team_id: firstTeam.id, 
            team_name: firstTeam.name 
          }));
          
          // Auto-skip this step if team already exists
          setProgress(5); // step-6
          if (returnToConfirmation) {
            router.replace('/onboarding/step-10-confirmation');
          } else {
            router.replace('/onboarding/step-6-authorized-users');
          }
          return;
        } else if (ob.plan === 'veteran' || ob.plan === 'legend') {
          // Check for existing organizations
          const orgs = await Organization.list();
          if (orgs && orgs.length > 0) {
            const firstOrg = orgs[0];
            setExistingOrg(firstOrg);
            setOrgName(firstOrg.name || '');
            setAlreadyExists(true);
            // Update onboarding state with existing org
            setOB((prev) => ({ 
              ...prev, 
              organization_id: firstOrg.id, 
              organization_name: firstOrg.name 
            }));
            
            // Auto-skip this step if org already exists
            setProgress(5); // step-6
            if (returnToConfirmation) {
              router.replace('/onboarding/step-10-confirmation');
            } else {
              router.replace('/onboarding/step-6-authorized-users');
            }
            return;
          }
        }
      } catch (error) {
        console.error('Error checking existing team/org:', error);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (ob.team_name && !existingTeam) setTeamName(ob.team_name);
    if (ob.organization_name && !existingOrg) setOrgName(ob.organization_name);
    if (ob.affiliation === 'school') setOrgType('school');
    else if (ob.affiliation) setOrgType('organization');
    
    // Check if team or organization already exists in onboarding state
    if (!alreadyExists && (ob.team_id || ob.organization_id)) {
      setAlreadyExists(true);
    }
  }, [ob.team_name, ob.organization_name, ob.affiliation, ob.team_id, ob.organization_id]);

  // Determine what type of page to create based on plan
  const pageConfig = useMemo(() => {
    if (alreadyExists) {
      const displayName = existingTeam?.name || existingOrg?.name || ob.team_name || ob.organization_name;
      return {
        type: existingTeam || ob.team_id ? 'team' : 'organization',
        title: existingTeam || ob.team_id ? 'Team Already Created' : 'Organization Already Created',
        subtitle: existingTeam || ob.team_id
          ? `Your team "${displayName}" is ready to go!` 
          : `Your organization "${displayName}" is ready to go!`,
        description: existingTeam || ob.team_id
          ? 'Your team page has been created. Continue to add authorized users and complete your setup.'
          : 'Your organization page has been created. Continue to add authorized users and complete your setup.',
        alreadyExists: true
      };
    }
    
    switch (ob.plan) {
      case 'rookie':
        return {
          type: 'team',
          title: 'Create Your Team Page',
          subtitle: 'Set up your team to start organizing games and connecting with players',
          description: 'Create a team page to manage your players, schedule games, and share updates.',
          alreadyExists: false
        };
      case 'veteran':
      case 'legend':
        return {
          type: 'organization',
          title: 'Create Your Organization Page',
          subtitle: 'Set up your school or organization to manage multiple teams',
          description: 'Create an organization page that can contain multiple team pages. Perfect for schools, clubs, and leagues.',
          alreadyExists: false
        };
      default:
        return {
          type: 'team',
          title: 'Create Your Page',
          subtitle: 'Set up your presence on VarsityHub',
          description: 'Create your page to get started.',
          alreadyExists: false
        };
    }
  }, [ob.plan, alreadyExists, ob.team_id, ob.team_name, ob.organization_id, ob.organization_name, existingTeam, existingOrg]);

  const canContinue = useMemo(() => {
    if (saving) return false;
    
    // If team/org already exists, user can continue immediately
    if (alreadyExists) return true;
    
    if (pageConfig.type === 'team') {
      return teamName.trim().length > 0 && location.trim().length > 0 && ageGroup;
    } else {
      return orgName.trim().length > 0 && location.trim().length > 0 && orgType;
    }
  }, [pageConfig.type, teamName, orgName, location, ageGroup, orgType, saving, alreadyExists]);

  const onContinue = async () => {
    if (!canContinue) return;
    setSaving(true);
    try {
      // If team/org already exists, just navigate to next step
      if (alreadyExists) {
        if (returnToConfirmation) {
          setProgress(9);
          router.replace('/onboarding/step-10-confirmation');
        } else {
          setProgress(5); // step-6
          router.push('/onboarding/step-6-authorized-users');
        }
        return;
      }
      
      if (pageConfig.type === 'team') {
        // Rookie plan - create team page only
        const desc = `${ageGroup} team` + (location ? ` in ${location.trim()}` : '');
        const t = await Team.create({ 
          name: teamName.trim(), 
          description: desc
        });
        setOB((prev) => ({ ...prev, team_id: t?.id, team_name: teamName.trim() }));
      } else {
        // Veteran/Legend plan - create organization page
        const desc = `${orgType === 'school' ? 'School' : 'Organization'}` + (location ? ` in ${location.trim()}` : '');
        // Create an organization using the dedicated API
        const payload: any = {
          name: orgName.trim(),
          description: desc,
        };
        // include season and plan if present in onboarding state
        if (ob.season_start) payload.season_start = ob.season_start;
        if (ob.season_end) payload.season_end = ob.season_end;
        if (ob.plan) payload.plan = ob.plan;

        const org = await Organization.createOrganization(payload);
        setOB((prev) => ({ ...prev, organization_id: org?.id, organization_name: orgName.trim() }));
      }
      // If onboarding indicates payment is pending, persist that to server preferences
      try {
        if (ob.payment_pending) {
          await (await import('@/api/entities')).User.updatePreferences({ payment_pending: true });
        }
      } catch (e) {
        // non-fatal
        console.warn('Failed to persist payment_pending flag:', (e as any)?.message || e);
      }
      
      // If we created an entity and are ending onboarding here, just navigate to confirmation.
      // Final onboarding completion is handled in step-10 to ensure all IDs and fields are present.
      if (returnToConfirmation) {
        setProgress(9);
        router.replace('/onboarding/step-10-confirmation');
      } else {
        setProgress(5); // step-6
        router.push('/onboarding/step-6-authorized-users');
      }
    } catch (e: any) { 
      Alert.alert('Failed to create page', e?.message || 'Please verify your email and try again'); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <OnboardingLayout
      step={5}
      title={pageConfig.title}
      subtitle={pageConfig.subtitle}
    >
      <Stack.Screen options={{ headerShown: false }} />
      
      {alreadyExists ? (
        // Show success message if team/org already exists
        <>
          <View style={styles.successBox}>
            <Ionicons 
              name="checkmark-circle" 
              size={48} 
              color={colorScheme === 'dark' ? '#4ade80' : '#16A34A'} 
              style={{ marginBottom: 16 }} 
            />
            <Text style={styles.successTitle}>
              {pageConfig.type === 'team' ? 'Team Already Created' : 'Organization Already Created'}
            </Text>
            <Text style={styles.successText}>
              {pageConfig.type === 'team' 
                ? `Your team "${existingTeam?.name || ob.team_name}" has already been set up. You can continue to the next step.`
                : `Your organization "${existingOrg?.name || ob.organization_name}" has already been set up. You can continue to the next step.`
              }
            </Text>
          </View>
          
          <PrimaryButton 
            label={checking ? 'Checking...' : 'Continue'} 
            onPress={onContinue} 
            disabled={!canContinue || checking} 
            loading={saving || checking}
          />
        </>
      ) : checking ? (
        // Show loading state while checking
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
          <Text style={{ ...Type.body, color: Colors[colorScheme].mutedText }}>
            Checking for existing teams...
          </Text>
        </View>
      ) : (
        // Show creation form
        <>
          <View style={styles.infoBox}>
          <Ionicons 
            name={pageConfig.type === 'team' ? 'people' : 'business'} 
            size={24} 
            color={colorScheme === 'dark' ? '#4ade80' : '#166534'} 
            style={styles.infoIcon} 
          />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>
              {pageConfig.type === 'team' ? 'Team Page' : 'Organization Page'}
            </Text>
            <Text style={styles.infoText}>{pageConfig.description}</Text>
          </View>
        </View>

        {pageConfig.type === 'team' ? (
          // Team creation form (Rookie plan)
          <>
            <Text style={styles.label}>Team Name</Text>
            <Input 
              value={teamName} 
              onChangeText={setTeamName} 
              placeholder="Springfield Warriors" 
              style={{ marginBottom: 12 }} 
            />
            
            <Text style={styles.label}>Age Group</Text>
            <Segmented
              value={ageGroup || undefined}
              onChange={(v) => setAgeGroup(v as any)}
              options={[
                { value: 'youth', label: 'Youth' },
                { value: 'adult', label: 'Adult' }, 
                { value: 'mixed', label: 'Mixed' }
              ]}
            />
            <View style={{ height: 12 }} />
          </>
        ) : (
          // Organization creation form (Veteran/Legend plan)
          <>
            <Text style={styles.label}>Organization Name</Text>
            <Input 
              value={orgName} 
              onChangeText={setOrgName} 
              placeholder="Springfield High School" 
              style={{ marginBottom: 12 }} 
            />
            
            <Text style={styles.label}>Organization Type</Text>
            <Segmented
              value={orgType || undefined}
              onChange={(v) => setOrgType(v as any)}
              options={[
                { value: 'school', label: 'School' },
                { value: 'organization', label: 'Club/League' }
              ]}
            />
            <View style={{ height: 12 }} />
          </>
        )}

        <Text style={styles.label}>Location</Text>
        <Input 
          value={location} 
          onChangeText={setLocation} 
          placeholder="City, State" 
          style={{ marginBottom: 24 }} 
        />
        
        {/* Plan Benefits Reminder */}
        <View style={styles.planReminder}>
          <Text style={styles.planReminderTitle}>
            {ob.plan === 'rookie'
              ? 'Rookie Plan Benefits'
              : ob.plan === 'veteran'
              ? 'Veteran Plan Benefits'
              : 'Legend Plan Benefits'}
          </Text>
          <View style={styles.benefitsList}>
            {ob.plan === 'rookie' ? (
              <>
                <Text style={styles.benefitItem}>- 1 team page</Text>
                <Text style={styles.benefitItem}>- 1 authorized user</Text>
                <Text style={styles.benefitItem}>- 6-month free trial</Text>
              </>
            ) : ob.plan === 'veteran' ? (
              <>
                <Text style={styles.benefitItem}>- 1 organization plus up to 6 teams</Text>
                <Text style={styles.benefitItem}>- Up to 12 authorized users</Text>
                <Text style={styles.benefitItem}>- Advanced features</Text>
              </>
            ) : (
              <>
                <Text style={styles.benefitItem}>- 1 organization plus unlimited teams</Text>
                <Text style={styles.benefitItem}>- Unlimited authorized users</Text>
                <Text style={styles.benefitItem}>- Premium features</Text>
              </>
            )}
          </View>
        </View>
        <PrimaryButton 
          label={saving ? 'Creating...' : 'Continue'} 
          onPress={onContinue} 
          disabled={!canContinue} 
          loading={saving}
        />
      </>
      )}
    </OnboardingLayout>
  );
}

const createStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Colors[colorScheme].background 
  },
  title: { 
    ...(Type.h1 as any), 
    color: Colors[colorScheme].text,
    marginBottom: 8, 
    textAlign: 'center' 
  },
  subtitle: { 
    color: Colors[colorScheme].mutedText, 
    marginBottom: 16, 
    textAlign: 'center', 
    fontSize: 16 
  },
  label: { 
    fontWeight: '700', 
    color: Colors[colorScheme].text,
    marginBottom: 4 
  },
  infoBox: { 
    flexDirection: 'row',
    padding: 12, 
    borderRadius: 12, 
    backgroundColor: colorScheme === 'dark' ? 'rgba(240,253,244,0.1)' : '#F0FDF4', 
    borderWidth: StyleSheet.hairlineWidth, 
    borderColor: colorScheme === 'dark' ? 'rgba(187,247,208,0.2)' : '#BBF7D0', 
    marginBottom: 20,
    alignItems: 'flex-start'
  },
  infoIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: { 
    fontWeight: '800', 
    marginBottom: 4, 
    color: colorScheme === 'dark' ? '#4ade80' : '#166534' 
  },
  infoText: { 
    color: colorScheme === 'dark' ? '#4ade80' : '#166534', 
    fontSize: 14, 
    lineHeight: 20 
  },
  planReminder: {
    backgroundColor: colorScheme === 'dark' ? 'rgba(243,244,246,0.1)' : '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  planReminderTitle: {
    fontWeight: '700',
    marginBottom: 8,
    color: Colors[colorScheme].text,
  },
  benefitsList: {
    gap: 4,
  },
  benefitItem: {
    color: colorScheme === 'dark' ? '#4ade80' : '#16A34A',
    fontSize: 14,
  },
  successBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 12,
    backgroundColor: colorScheme === 'dark' ? 'rgba(240,253,244,0.1)' : '#F0FDF4',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colorScheme === 'dark' ? 'rgba(187,247,208,0.2)' : '#BBF7D0',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colorScheme === 'dark' ? '#4ade80' : '#16A34A',
    marginBottom: 8,
    textAlign: 'center',
  },
  successText: {
    color: Colors[colorScheme].text,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
});











