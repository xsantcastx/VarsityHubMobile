import { Input } from '@/components/ui/input';
import PrimaryButton from '@/ui/PrimaryButton';
import Segmented from '@/ui/Segmented';
import { Type } from '@/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { OnboardingBackHeader } from '@/components/onboarding/OnboardingBackHeader';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { Organization, Team } from '@/api/entities';
import { useOnboarding } from '@/context/OnboardingContext';

export default function Step5League() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnToConfirmation?: string }>();
  const returnToConfirmation = params.returnToConfirmation === 'true';
  const { state: ob, setState: setOB, setProgress } = useOnboarding();
  const [orgName, setOrgName] = useState('');
  const [location, setLocation] = useState('');
  const [orgType, setOrgType] = useState<'school' | 'organization' | null>(null);
  const [teamName, setTeamName] = useState('');
  const [ageGroup, setAgeGroup] = useState<'youth' | 'adult' | 'mixed' | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ob.team_name) setTeamName(ob.team_name);
    if (ob.organization_name) setOrgName(ob.organization_name);
    if (ob.affiliation === 'school') setOrgType('school');
    else if (ob.affiliation) setOrgType('organization');
  }, [ob.team_name, ob.organization_name, ob.affiliation]);

  // Determine what type of page to create based on plan
  const pageConfig = useMemo(() => {
    switch (ob.plan) {
      case 'rookie':
        return {
          type: 'team',
          title: 'Create Your Team Page',
          description: 'Create a team page to manage your players, schedule games, and share updates.'
        };
      case 'veteran':
      case 'legend':
        return {
          type: 'organization',
          title: 'Create Your Organization Page',
          description: 'Create an organization page that can contain multiple team pages. Perfect for schools, clubs, and leagues.'
        };
      default:
        return {
          type: 'team',
          title: 'Create Your Page',
          description: 'Create your page to get started.'
        };
    }
  }, [ob.plan]);

  const canContinue = useMemo(() => {
    if (saving) return false;
    
    if (pageConfig.type === 'team') {
      return teamName.trim().length > 0 && location.trim().length > 0 && ageGroup;
    } else {
      return orgName.trim().length > 0 && location.trim().length > 0 && orgType;
    }
  }, [pageConfig.type, teamName, orgName, location, ageGroup, orgType, saving]);

  const onContinue = async () => {
    if (!canContinue) return;
    setSaving(true);
    try {
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
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Step 5/10' }} />
      <OnboardingBackHeader
        title={pageConfig.title}
        subtitle={pageConfig.subtitle}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>


        
        <View style={styles.infoBox}>
          <Ionicons 
            name={pageConfig.type === 'team' ? 'people' : 'business'} 
            size={24} 
            color="#166534" 
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  label: { fontWeight: '700', marginBottom: 4 },
  infoBox: { 
    flexDirection: 'row',
    padding: 12, 
    borderRadius: 12, 
    backgroundColor: '#F0FDF4', 
    borderWidth: StyleSheet.hairlineWidth, 
    borderColor: '#BBF7D0', 
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
  infoTitle: { fontWeight: '800', marginBottom: 4, color: '#166534' },
  infoText: { color: '#166534', fontSize: 14, lineHeight: 20 },
  planReminder: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  planReminderTitle: {
    fontWeight: '700',
    marginBottom: 8,
    color: '#374151',
  },
  benefitsList: {
    gap: 4,
  },
  benefitItem: {
    color: '#16A34A',
    fontSize: 14,
  },
});











