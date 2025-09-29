import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PrimaryButton from '@/ui/PrimaryButton';
import Segmented from '@/ui/Segmented';
import { Type } from '@/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import { useOnboarding } from '@/context/OnboardingContext';

type TeamRole = 'Team Manager' | 'Assistant' | 'Coach' | 'Admin';

export default function Step6AuthorizedUsers() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnToConfirmation?: string }>();
  const returnToConfirmation = params.returnToConfirmation === 'true';
  const { state: ob, setState: setOB, setProgress } = useOnboarding();
  const [email, setEmail] = useState('');
  const [assignTeam, setAssignTeam] = useState('');
  const [role, setRole] = useState<TeamRole>('Team Manager');
  const [list, setList] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (Array.isArray(ob.authorized) && ob.authorized.length) {
      setList(ob.authorized);
    }
  }, [ob.authorized]);

  // Get plan limits and information
  const planInfo = useMemo(() => {
    switch (ob.plan) {
      case 'rookie':
        return {
          name: 'Rookie',
          maxUsers: 1,
          description: 'Add 1 Assistant to help manage your team',
          allowedRoles: ['Assistant'] as TeamRole[]
        };
      case 'veteran':
        return {
          name: 'Veteran', 
          maxUsers: 12,
          description: 'Add up to 12 authorized users to manage your organization',
          allowedRoles: ['Team Manager', 'Assistant', 'Coach', 'Admin'] as TeamRole[]
        };
      case 'legend':
        return {
          name: 'Legend',
          maxUsers: Infinity,
          description: 'Add unlimited authorized users to manage your organization',
          allowedRoles: ['Team Manager', 'Assistant', 'Coach', 'Admin'] as TeamRole[]
        };
      default:
        return {
          name: 'Plan',
          maxUsers: 1,
          description: 'Add users to help manage your organization',
          allowedRoles: ['Assistant'] as TeamRole[]
        };
    }
  }, [ob.plan]);

  const canAddMore = list.length < planInfo.maxUsers;
  const isOptional = true; // Allow skipping add-users on all plans for now

  const addUser = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes('@')) { 
      Alert.alert('Invalid Email', 'Please enter a valid email address'); 
      return; 
    }
    
    if (!canAddMore) {
      Alert.alert('User Limit Reached', `Your ${planInfo.name} plan allows up to ${planInfo.maxUsers} user${planInfo.maxUsers === 1 ? '' : 's'}.`);
      return;
    }

    // Check if user already added
    if (list.some(u => u.email === e)) {
      Alert.alert('Already Added', 'This user has already been added to your list.');
      return;
    }
    
    const team_id = ob.team_id || ob.organization_id;
    if (!team_id) { 
      Alert.alert('Missing Organization', 'Please create your organization first.'); 
      return; 
    }
    
    setAdding(true);
    try {
      const newUser = {
        email: e,
        role,
        assign_team: assignTeam.trim() || undefined,
        type: 'pending'
      };
      
      // For now, just add to list - actual invite sending can be done later
      setList([newUser, ...list]);
      setEmail(''); 
      setAssignTeam('');
      setRole(planInfo.allowedRoles[0]);
      
    } catch (e: any) {
      Alert.alert('Failed to add user', e?.message || 'Please try again');
    } finally { 
      setAdding(false); 
    }
  };

  const onContinue = () => {
    setOB((prev) => ({ ...prev, authorized: list }));
    if (returnToConfirmation) {
      setProgress(9);
      router.replace('/onboarding/step-10-confirmation');
    } else {
      setProgress(6);
      router.push('/onboarding/step-7-profile');
    }
  };

  const skipStep = () => {
    if (isOptional) {
      setOB((prev) => ({ ...prev, authorized: [] }));
      if (returnToConfirmation) {
        setProgress(9);
        router.replace('/onboarding/step-10-confirmation');
      } else {
        setProgress(6);
        router.push('/onboarding/step-7-profile');
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Step 6/10' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <Text style={styles.title}>Add Authorized Users</Text>
        <Text style={styles.subtitle}>{planInfo.description}</Text>

        {/* Plan Info */}
        <View style={styles.planInfo}>
          <View style={styles.planHeader}>
            <Text style={styles.planName}>{planInfo.name} Plan</Text>
            <Text style={styles.planLimit}>
              {list.length}/{planInfo.maxUsers === Infinity ? '∞' : planInfo.maxUsers} users
            </Text>
          </View>
          {!canAddMore && (
            <Text style={styles.limitWarning}>
              You've reached your plan limit. Upgrade for more users.
            </Text>
          )}
        </View>

        {/* Organization Status */}
        {(ob.team_id || ob.organization_id) && (
          <View style={styles.createdChip}>
            <Ionicons name="checkmark-circle" size={16} color="#166534" />
            <Text style={styles.createdChipText}>
              {ob.plan === 'rookie' ? 'Team created' : 'Organization created'}
            </Text>
          </View>
        )}

        {/* Add User Form */}
        {canAddMore && (
          <View style={styles.addUserForm}>
            <Text style={styles.formTitle}>Add New User</Text>
            
            <Text style={styles.label}>Email Address</Text>
            <Input 
              value={email} 
              onChangeText={setEmail} 
              placeholder="coach@example.com" 
              autoCapitalize="none" 
              keyboardType="email-address" 
              style={{ marginBottom: 12 }} 
            />

            {ob.plan !== 'rookie' && (
              <>
                <Text style={styles.label}>Assign to Team (optional)</Text>
                <Input 
                  value={assignTeam} 
                  onChangeText={setAssignTeam} 
                  placeholder="e.g., Varsity Football" 
                  style={{ marginBottom: 12 }} 
                />
              </>
            )}

            <Text style={styles.label}>Role</Text>
            <Segmented
              value={role}
              onChange={(v) => setRole(v as TeamRole)}
              options={planInfo.allowedRoles.map(r => ({ value: r, label: r }))}
            />
            <View style={{ height: 12 }} />

            <Button 
              onPress={addUser} 
              disabled={adding || !email.trim()}
            >
              <Text>{adding ? 'Adding…' : 'Add User'}</Text>
            </Button>
          </View>
        )}

        {/* Added Users List */}
        {list.length > 0 && (
          <View style={styles.usersList}>
            <Text style={styles.usersListTitle}>Added Users</Text>
            {list.map((user, idx) => (
              <View key={idx} style={styles.userCard}>
                <View style={styles.userInfo}>
                  <Text style={styles.userEmail}>{user.email}</Text>
                  <View style={styles.userMeta}>
                    <Text style={styles.userRole}>{user.role}</Text>
                    {user.assign_team && (
                      <>
                        <Text style={styles.metaSeparator}>•</Text>
                        <Text style={styles.userTeam}>{user.assign_team}</Text>
                      </>
                    )}
                  </View>
                </View>
                <Pressable 
                  onPress={() => setList(arr => arr.filter((_, i) => i !== idx))}
                  style={styles.removeButton}
                >
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {list.length > 0 ? (
            <PrimaryButton 
              label="Continue" 
              onPress={onContinue}
            />
          ) : (
            <View style={styles.optionalActions}>
              <Button 
                variant="outline" 
                onPress={skipStep}
                style={styles.skipButton}
              >
                <Text>Skip for Now</Text>
              </Button>
              <PrimaryButton 
                label="Continue" 
                onPress={onContinue}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  title: { ...(Type.h1 as any), marginBottom: 8, textAlign: 'center' },
  subtitle: { color: '#6b7280', marginBottom: 20, textAlign: 'center', fontSize: 16 },
  label: { fontWeight: '700', marginBottom: 4 },
  
  planInfo: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  planName: {
    fontWeight: '700',
    color: '#374151',
  },
  planLimit: {
    color: '#6B7280',
    fontSize: 14,
  },
  limitWarning: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
  },
  
  createdChip: { 
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center', 
    backgroundColor: '#DCFCE7', 
    borderRadius: 999, 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    marginBottom: 16, 
    borderWidth: StyleSheet.hairlineWidth, 
    borderColor: '#BBF7D0',
    gap: 4,
  },
  createdChipText: { 
    color: '#166534', 
    fontWeight: '700',
    fontSize: 14,
  },
  
  addUserForm: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  formTitle: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 12,
  },
  
  usersList: {
    marginBottom: 20,
  },
  usersListTitle: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 12,
    color: '#374151',
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 4,
    color: '#111827',
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userRole: {
    color: '#6B7280',
    fontSize: 12,
  },
  metaSeparator: {
    color: '#D1D5DB',
    marginHorizontal: 6,
    fontSize: 12,
  },
  userTeam: {
    color: '#6B7280',
    fontSize: 12,
  },
  removeButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  
  actionButtons: {
    marginTop: 16,
  },
  optionalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  skipButton: {
    flex: 1,
  },
  noUsersMessage: {
    color: '#6B7280',
    textAlign: 'center',
    fontSize: 14,
    fontStyle: 'italic',
  },
  
  // Legacy styles (keeping for compatibility)
  row: { 
    padding: 12, 
    borderRadius: 12, 
    borderWidth: StyleSheet.hairlineWidth, 
    borderColor: '#E5E7EB', 
    backgroundColor: '#F9FAFB', 
    marginBottom: 8 
  },
  rowTitle: { fontWeight: '700' },
  mutedSmall: { color: '#9CA3AF', fontSize: 12 },
});









