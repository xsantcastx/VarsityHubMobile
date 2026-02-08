import { Input } from '@/components/ui/input';
import PrimaryButton from '@/components/ui/PrimaryButton';
// Segmented replaced by wheel picker for roles
import { Type } from '@/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
// @ts-ignore
import { httpPost } from '@/api/http';
import { Colors } from '@/constants/Colors';
import { useOnboarding } from '@/context/OnboardingContext';
import OnboardingLayout from './components/OnboardingLayout';

type TeamRole =
  | 'Coach'
  | 'Manager'
  | 'Assistant'
  | 'Equipment'
  | 'Health and Wellness';

export default function Step6AuthorizedUsers() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnToConfirmation?: string }>();
  const returnToConfirmation = params.returnToConfirmation === 'true';
  const { state: ob, setState: setOB, progress, setProgress } = useOnboarding();
  const colorScheme = useColorScheme() ?? 'light';
  const [email, setEmail] = useState('');
  const [assignTeam, setAssignTeam] = useState('');
  const [role, setRole] = useState<TeamRole>('Coach');
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);

  const styles = useMemo(() => createStyles(colorScheme), [colorScheme]);
  const roleLabels: Record<TeamRole, string> = useMemo(() => ({
    Coach: 'Coach',
    Manager: 'Manager',
    Assistant: 'Assistant',
    Equipment: 'Equipment',
    'Health and Wellness': 'Health and Wellness',
  }), []);

  const mapRoleToBackend = (r: TeamRole, target: 'team' | 'org'): string => {
    if (target === 'team') {
      switch (r) {
        case 'Manager':
          return 'manager';
        case 'Coach':
          return 'coach';
        case 'Assistant':
          return 'assistant_coach';
        case 'Equipment':
          return 'equipment';
        case 'Health and Wellness':
          return 'health_wellness';
        default:
          return 'member';
      }
    }
    // Organization roles are simpler: owner | manager | member
    switch (r) {
      case 'Manager':
        return 'manager';
      default:
        return 'member';
    }
  };

  useEffect(() => {
    if (Array.isArray(ob.authorized) && ob.authorized.length) {
      setList(ob.authorized);
    }
  }, [ob.authorized]);

  // Get plan limits and information (dynamic based on plan and selected team count)
  const planInfo = useMemo(() => {
    const totalTeams = typeof ob.team_count_total === 'number' && ob.team_count_total > 0 ? ob.team_count_total : undefined;
    const veteranLimit = totalTeams ? totalTeams * 2 : 12; // fallback to 12 if not provided
    switch (ob.plan) {
      case 'rookie':
        return {
          name: 'Rookie',
          maxUsers: 1,
          description: 'Add 1 authorized user (Coach, Manager, Assistant, Equipment, or Health & Wellness) to help manage your team',
          allowedRoles: ['Coach', 'Manager', 'Assistant', 'Equipment', 'Health and Wellness'] as TeamRole[]
        };
      case 'veteran':
        return {
          name: 'Veteran', 
          maxUsers: veteranLimit,
          description: `Add up to ${veteranLimit} authorized users (2 per team) to manage your organization`,
          allowedRoles: ['Coach', 'Manager', 'Assistant', 'Equipment', 'Health and Wellness'] as TeamRole[]
        };
      case 'legend':
        return {
          name: 'Legend',
          maxUsers: Infinity,
          description: 'Add unlimited authorized users to manage your organization',
          allowedRoles: ['Coach', 'Manager', 'Assistant', 'Equipment', 'Health and Wellness'] as TeamRole[]
        };
      default:
        return {
          name: 'Plan',
          maxUsers: 1,
          description: 'Add 1 authorized user (Coach, Manager, Assistant, Equipment, or Health & Wellness) to help manage your organization',
          allowedRoles: ['Coach', 'Manager', 'Assistant', 'Equipment', 'Health and Wellness'] as TeamRole[]
        };
    }
  }, [ob.plan, ob.team_count_total]);

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
    
    const targetId = ob.plan === 'rookie' ? ob.team_id : ob.organization_id;
    if (!targetId) { 
      Alert.alert('Missing Organization', 'Please create your organization first or select an organization you manage.'); 
      return; 
    }
    
    setAdding(true);
    try {
      // Call backend to create an invite (organization for Veteran/Legend, team for Rookie)
      if (ob.plan === 'rookie' && ob.team_id) {
        await httpPost(`/teams/${ob.team_id}/invite`, { email: e, role: mapRoleToBackend(role, 'team') });
      } else if (ob.organization_id) {
        await httpPost(`/organizations/${ob.organization_id}/invite`, { email: e, role: mapRoleToBackend(role, 'org') });
      }

      const newUser = { email: e, role, assign_team: assignTeam.trim() || undefined, type: 'invited' };
      setList([newUser, ...list]);
      setEmail(''); 
      setAssignTeam('');
      setRole(planInfo.allowedRoles[0]);
      
      Alert.alert('Invite Sent', `${e} has been invited.`);
    } catch (e: any) {
      const msg = e?.data?.error || e?.message || 'Please try again';
      if ((e?.status === 403) && /permission/i.test(String(msg))) {
        Alert.alert(
          'Need Admin Access',
          'You are not an administrator for this organization. Go back and create a new organization page or select one you manage.',
          [
            { text: 'OK' }
          ]
        );
      } else {
        Alert.alert('Failed to add user', msg);
      }
    } finally { 
      setAdding(false); 
    }
  };

  const onContinue = () => {
    if (__DEV__) console.warn('[STEP-6] Continue clicked, current progress:', progress);
    if (__DEV__) console.warn('[STEP-6] Current state:', JSON.stringify(ob, null, 2));

    // Save authorized users to state AND mark step 6 as visited (CRITICAL for navigation)
    setOB((prev) => ({ ...prev, authorized: list, step_6_visited: true }));
    
    if (returnToConfirmation) {
      if (__DEV__) console.warn('[STEP-6] Returning to confirmation');
      setProgress(7);
      router.replace('/onboarding/step-10-confirmation');
    } else {
      // CRITICAL: Validate coach has completed steps 2-4 before allowing step 7
      if (ob.role === 'coach') {
        const hasStep2 = !!(ob.username && ob.dob && (ob.zip || ob.zip_code));
        const hasStep3 = !!ob.plan;
        const hasStep4 = !!(ob.team_id || ob.organization_id);
        
        if (__DEV__) console.warn('[STEP-6] Coach validation:', { hasStep2, hasStep3, hasStep4 });
        
        if (!hasStep2) {
          if (__DEV__) console.warn('[STEP-6] Missing Step 2, redirecting');
          setProgress(1);
          router.replace('/onboarding/step-2-basic');
          return;
        }
        if (!hasStep3) {
          if (__DEV__) console.warn('[STEP-6] Missing Step 3, redirecting');
          setProgress(2);
          router.replace('/onboarding/step-3-plan');
          return;
        }
        if (!hasStep4) {
          if (__DEV__) console.warn('[STEP-6] Missing Step 4, redirecting');
          setProgress(3);
          router.replace('/onboarding/step-4-organization');
          return;
        }
      }
      
      // All validations passed - advance to Step 7
      if (__DEV__) console.warn('[STEP-6] ✅ All validations passed, advancing to Step 7 (progress: 5)');
      setProgress(5); // Advance to Step 7 (index 5 in stepRoutes)
      // Use replace to prevent back navigation issues
      router.replace('/onboarding/step-7-profile');
    }
  };

  const skipStep = () => {
    if (isOptional) {
      // Mark step 6 as visited even when skipping (CRITICAL for navigation)
      setOB((prev) => ({ ...prev, authorized: [], step_6_visited: true }));
      if (returnToConfirmation) {
        setProgress(7);
        router.replace('/onboarding/step-10-confirmation');
      } else {
        // CRITICAL: Validate coach has completed steps 2-4 before allowing step 7
        if (ob.role === 'coach') {
          const hasStep2 = !!(ob.username && ob.dob && (ob.zip || ob.zip_code));
          const hasStep3 = !!ob.plan;
          const hasStep4 = !!(ob.team_id || ob.organization_id);
          
          if (!hasStep2) {
            setProgress(1);
            router.replace('/onboarding/step-2-basic');
            return;
          }
          if (!hasStep3) {
            setProgress(2);
            router.replace('/onboarding/step-3-plan');
            return;
          }
          if (!hasStep4) {
            setProgress(3);
            router.replace('/onboarding/step-4-organization');
            return;
          }
        }
        
        setProgress(5); // Advance to Step 7
        router.replace('/onboarding/step-7-profile');
      }
    }
  };

  return (
    <OnboardingLayout
      step={6}
      title="Add Authorized Users"
      subtitle={planInfo.description}
    >
      <Stack.Screen options={{ headerShown: false }} />

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
            <Ionicons name="checkmark-circle" size={16} color={colorScheme === 'dark' ? '#4ade80' : '#166534'} />
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
            <Pressable
              style={[styles.selectField, { borderColor: Colors[colorScheme].border, backgroundColor: Colors[colorScheme].surface }]}
              onPress={() => setShowRolePicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Select role"
            >
              <Text style={styles.selectFieldText}>{roleLabels[role] || role}</Text>
              <Ionicons name="chevron-down" size={18} color={Colors[colorScheme].mutedText} />
            </Pressable>
            <View style={{ height: 12 }} />

            <PrimaryButton 
              label={adding ? 'Adding…' : 'Add User'}
              onPress={addUser}
              disabled={adding || !email.trim()}
            />
          </View>
        )}

        {/* Role Wheel Picker Modal */}
        <Modal visible={showRolePicker} animationType="fade" transparent onRequestClose={() => setShowRolePicker(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowRolePicker(false)}>
            <View
              style={[styles.modalSheet, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]}
              accessibilityViewIsModal
            >
              <Text style={styles.modalTitle}>Select Role</Text>
              <Picker selectedValue={role} onValueChange={(val) => setRole(val as TeamRole)}>
                {planInfo.allowedRoles.map((opt) => (
                  <Picker.Item key={opt} label={roleLabels[opt]} value={opt} />
                ))}
              </Picker>
              <View style={styles.modalActions}>
                <Pressable style={styles.modalButton} onPress={() => setShowRolePicker(false)}>
                  <Text style={styles.modalButtonText}>Done</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>

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
                  <Ionicons name="trash-outline" size={16} color={colorScheme === 'dark' ? '#ef4444' : '#DC2626'} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <PrimaryButton 
            label={list.length > 0 ? 'Continue' : 'Continue'} 
            onPress={onContinue}
          />
          {list.length === 0 && (
            <Pressable onPress={skipStep} accessibilityRole="button" style={styles.skipLink}>
              <Text style={styles.skipLinkText}>Skip for now</Text>
            </Pressable>
          )}
        </View>
    </OnboardingLayout>
  );
}

const createStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors[colorScheme].background },
  title: { ...(Type.h1 as any), marginBottom: 8, textAlign: 'center', color: Colors[colorScheme].text },
  subtitle: { color: Colors[colorScheme].mutedText, marginBottom: 20, textAlign: 'center', fontSize: 16 },
  label: { fontWeight: '700', marginBottom: 4, color: Colors[colorScheme].text },
  
  planInfo: {
    backgroundColor: Colors[colorScheme].surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors[colorScheme].border,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  planName: {
    fontWeight: '700',
    color: Colors[colorScheme].text,
  },
  planLimit: {
    color: Colors[colorScheme].mutedText,
    fontSize: 14,
  },
  limitWarning: {
    color: colorScheme === 'dark' ? '#ef4444' : '#DC2626',
    fontSize: 12,
    marginTop: 4,
  },
  
  createdChip: { 
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center', 
    backgroundColor: colorScheme === 'dark' ? 'rgba(74, 222, 128, 0.15)' : '#DCFCE7', 
    borderRadius: 999, 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    marginBottom: 16, 
    borderWidth: StyleSheet.hairlineWidth, 
    borderColor: colorScheme === 'dark' ? 'rgba(74, 222, 128, 0.3)' : '#BBF7D0',
    gap: 4,
  },
  createdChipText: { 
    color: colorScheme === 'dark' ? '#4ade80' : '#166534', 
    fontWeight: '700',
    fontSize: 14,
  },
  
  addUserForm: {
    backgroundColor: Colors[colorScheme].surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    marginHorizontal: 'auto',
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: Colors[colorScheme].border,
  },
  formTitle: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 12,
    color: Colors[colorScheme].text,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectFieldText: {
    color: Colors[colorScheme].text,
    fontSize: 14,
    fontWeight: '600',
  },
  
  usersList: {
    marginBottom: 20,
  },
  usersListTitle: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 12,
    color: Colors[colorScheme].text,
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors[colorScheme].border,
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 4,
    color: Colors[colorScheme].text,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userRole: {
    color: Colors[colorScheme].mutedText,
    fontSize: 12,
  },
  metaSeparator: {
    color: Colors[colorScheme].border,
    marginHorizontal: 6,
    fontSize: 12,
  },
  userTeam: {
    color: Colors[colorScheme].mutedText,
    fontSize: 12,
  },
  removeButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: colorScheme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    paddingBottom: 12,
  },
  modalTitle: {
    fontWeight: '700',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    color: Colors[colorScheme].text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  modalButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colorScheme === 'dark' ? '#2563EB' : '#3B82F6',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  
  actionButtons: {
    marginTop: 24,
    alignItems: 'center',
    width: '100%',
    alignSelf: 'center'
  },
  skipLink: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  skipLinkText: {
    color: Colors[colorScheme].mutedText,
    fontSize: 14,
    textDecorationLine: 'underline'
  },
  noUsersMessage: {
    color: Colors[colorScheme].mutedText,
    textAlign: 'center',
    fontSize: 14,
    fontStyle: 'italic',
  },
  
  // Legacy styles (keeping for compatibility)
  row: { 
    padding: 12, 
    borderRadius: 12, 
    borderWidth: StyleSheet.hairlineWidth, 
    borderColor: Colors[colorScheme].border, 
    backgroundColor: Colors[colorScheme].surface, 
    marginBottom: 8 
  },
  rowTitle: { fontWeight: '700', color: Colors[colorScheme].text },
  mutedSmall: { color: Colors[colorScheme].mutedText, fontSize: 12 },
});









