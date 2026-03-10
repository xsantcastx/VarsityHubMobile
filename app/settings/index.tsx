import { Colors } from '@/constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { Event, User } from '@/api/entities';
import { getConfig } from '@/config/env';
import { useAuth } from '@/context/AuthProvider';
import { useOnboardingOptional } from '@/context/OnboardingContext';

type CommentPermission = 'everyone' | 'following' | 'none';

interface Preferences {
  notifications: {
    game_event_reminders: boolean;
    team_updates: boolean;
    comments_upvotes: boolean;
    follows_notifications: boolean;
    messages_notifications: boolean;
  };
  is_parent: boolean;
  zip_code: string | null;
  profile_private: boolean;
  comment_permission: CommentPermission;
}

// Inline components for settings
function SectionCard({ title, initiallyOpen = false, children }: { title: string; initiallyOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(initiallyOpen);
  const cs = useColorScheme();
  const palette = Colors[cs ?? 'light'];
  return (
    <View style={[styles.card, { borderColor: palette.border, backgroundColor: palette.card }]}>
      <Pressable style={styles.cardHeader} onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityLabel={`${title} section`} accessibilityState={{ expanded: open }}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.chev, { color: palette.icon }, open && styles.chevOpen]}>›</Text>
      </Pressable>
      {open && <View style={styles.cardBody}>{children}</View>}
    </View>
  );
}

function NavRow({ title, subtitle, onPress, destructive, isLast }: { title: string; subtitle?: string; onPress: () => void; destructive?: boolean; isLast?: boolean }) {
  const cs = useColorScheme();
  const palette = Colors[cs ?? 'light'];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} accessibilityHint={subtitle} style={[styles.rowBetween, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: destructive ? palette.destructive : palette.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.mutedSmall, { color: palette.mutedText }]}>{subtitle}</Text>}
      </View>
      <Text style={[styles.chev, { color: palette.icon }]}>›</Text>
    </Pressable>
  );
}

function SwitchRow({ title, subtitle, value, onValueChange, isLast }: { title: string; subtitle?: string; value: boolean; onValueChange: (v: boolean) => void; isLast?: boolean }) {
  const cs = useColorScheme();
  const palette = Colors[cs ?? 'light'];
  return (
    <View style={[styles.rowBetween, !isLast && { borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: palette.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.mutedSmall, { color: palette.mutedText }]}>{subtitle}</Text>}
      </View>
      <Switch value={value} onValueChange={onValueChange} accessibilityLabel={title} />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { checkAuth, markOnboardingIncompleteLocally, signOut } = useAuth();
  const obCtx = useOnboardingOptional();
  const setOB = obCtx?.setState;
  const appConfig = getConfig();

  const [_loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [_email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>({
    notifications: {
      game_event_reminders: false,
      team_updates: false,
      comments_upvotes: false,
      follows_notifications: true,
      messages_notifications: true,
    },
    is_parent: false,
    zip_code: null,
    profile_private: false,
    comment_permission: 'everyone',
  });
  const [plan, setPlan] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [_pendingHostRequests, setPendingHostRequests] = useState<any[]>([]);
  const [_pendingLoading, setPendingLoading] = useState(false);
  const [_pendingError, setPendingError] = useState<string | null>(null);
  const [deleteWarningVisible, setDeleteWarningVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Debounced PATCH updater for preferences
  // Only sends the specific fields being changed to avoid overwriting other preferences (e.g. role)
  const patchPrefs = (patch: Partial<Preferences>) => {
    const key = JSON.stringify(patch);
    if (timers.current[key]) clearTimeout(timers.current[key]);
    
    // Use functional update to get the latest state
    setPrefs(cur => {
                  // Deep merge notifications, shallow merge the rest
                  const newPrefs = {
                    ...cur,
                    ...patch,
                    notifications: {
                      ...cur.notifications,
                      ...(patch.notifications || {}),
                    },
                  };

                  // Debounce the API call - only send the changed fields, not the full prefs object
                  const patchToSend = patch.notifications
                    ? { notifications: { ...cur.notifications, ...patch.notifications } }
                    : { ...patch };
                  timers.current[key] = setTimeout(async () => {
                    try {
                      await User.updatePreferences(patchToSend);
                    } catch (e: any) {
                      // Error handled via Alert below
                      if (__DEV__) console.error('[settings] Failed to update preferences:', e);
                      // Revert on failure if needed, though not implemented here
                      Alert.alert('Update failed', 'Could not save your preference. Please try again.');
                    }
                  }, 300);

                  return newPrefs;
                });
              };

              const restartOnboarding = async () => {
                try {
                  const me: any = await User.me();
                  const prefsFromServer = me?.preferences || {};
                  const preload = {
                    role: prefsFromServer.role || me?.role || 'fan',
                    display_name: prefsFromServer.display_name ?? me?.display_name ?? '',
                    affiliation: prefsFromServer.affiliation ?? me?.affiliation ?? '',
                    dob: prefsFromServer.dob ?? me?.dob ?? null,
                    zip_code: prefsFromServer.zip_code ?? me?.zip_code ?? '',
                    plan: prefsFromServer.plan ?? null,
                    avatar_url: me?.avatar_url ?? prefsFromServer.avatar_url ?? null,
                    bio: me?.bio ?? prefsFromServer.bio ?? '',
                    sports_interests: prefsFromServer.sports_interests ?? prefsFromServer.sports ?? [],
                    primary_intents: prefsFromServer.primary_intents ?? [],
                    authorized_users: prefsFromServer.authorized_users ?? prefsFromServer.authorized ?? [],
                  } as any;

                  // Previously we attempted to record onboarding history here, but the context no longer exposes that API.
                  try {
                    void await User.updatePreferences({ onboarding_completed: false });
                    // Also clear local AsyncStorage flag so next launch doesn't skip onboarding
                    await markOnboardingIncompleteLocally();
                  } catch (error: any) {
                    if (__DEV__) console.warn('[settings] Failed to reset onboarding_completed flag:', error);
                    // Continue anyway - user will be redirected to onboarding
                  }
                  if (setOB) void setOB(preload);
                  router.replace('/onboarding/step-1-role');
                } catch (e: any) {
                  // Error in onboarding restart - try fallback
                  if (__DEV__) console.error('[settings] Failed to restart onboarding:', e);
                  try {
                    void await User.updatePreferences({ onboarding_completed: false });
                    await markOnboardingIncompleteLocally();
                  } catch (error: any) {
                    if (__DEV__) console.warn('[settings] Failed to reset onboarding status:', error);
                    // Continue anyway - user will be redirected to onboarding
                  }
                  router.replace('/onboarding');
                }
              };

              const performSignOut = async () => {
                try {
                  void obCtx?.clearOnboarding?.();
                } catch (error: any) {
                  if (__DEV__) console.warn('[settings] Failed to clear onboarding:', error);
                }

                try {
                  await signOut();
                } catch (error: any) {
                  if (__DEV__) console.warn('[settings] Sign out via AuthProvider failed:', error);
                  router.replace('/sign-in');
                }
              };

              const performDeleteAccount = async () => {
                if (deletingAccount) return;
                setDeletingAccount(true);
                try {
                  const { httpDelete } = await import('@/api/http');
                  await httpDelete('/users/me');
                } catch (error: any) {
                  if (__DEV__) console.error('[settings] Account deletion failed:', error);
                  Alert.alert('Delete failed', error?.message || 'Could not delete your account.');
                  setDeletingAccount(false);
                  return;
                }

                setDeleteModalVisible(false);
                setDeleteConfirmText('');
                setDeletingAccount(false);
                await performSignOut();
              };

              const confirmDeleteAccount = () => {
                setDeleteWarningVisible(true);
              };

              const proceedToDeleteConfirm = () => {
                setDeleteWarningVisible(false);
                if (Platform.OS === 'ios' && Alert.prompt) {
                  Alert.prompt('Delete Account', 'This permanently deletes your account. Type DELETE to confirm.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Confirm',
                      style: 'destructive',
                      onPress: (val: string | undefined) => {
                        const value = String(val || '').trim();
                        if (value !== 'DELETE') {
                          Alert.alert('Confirmation required', 'Type DELETE in all caps to confirm.');
                          return;
                        }
                        void performDeleteAccount();
                      },
                    },
                  ], 'plain-text');
                  return;
                }

                setDeleteConfirmText('');
                setDeleteModalVisible(true);
              };

              // Move the async logic into useEffect
              useEffect(() => {
                let mounted = true;
                void (async () => {
                  setLoading(true);
                  setError(null);
                  try {
                    const me: any = await User.me();
                    if (!mounted) return;
                    setEmail(me?.email || null);
                    // Check if user is admin (email-based)
                    const adminEmails = (appConfig.adminEmails.length ? appConfig.adminEmails : ['admin@varsityhub.app'])
                      .map((e) => e.toLowerCase());
                    setIsAdmin(adminEmails.includes((me?.email || '').toLowerCase()));
                    const serverPrefs = (me && me.preferences) || {};
                    setPrefs({
                      notifications: {
                        game_event_reminders: !!serverPrefs?.notifications?.game_event_reminders,
                        team_updates: !!serverPrefs?.notifications?.team_updates,
                        comments_upvotes: !!serverPrefs?.notifications?.comments_upvotes,
                        follows_notifications: serverPrefs?.notifications?.follows_notifications !== false,
                        messages_notifications: serverPrefs?.notifications?.messages_notifications !== false,
                      },
                      is_parent: !!serverPrefs?.is_parent,
                      zip_code: serverPrefs?.zip_code ?? null,
                      profile_private: !!serverPrefs?.profile_private,
                      comment_permission: (serverPrefs?.comment_permission === 'following' || serverPrefs?.comment_permission === 'none')
                        ? serverPrefs.comment_permission
                        : 'everyone',
                    });
                    setPlan(serverPrefs?.plan ?? null);
                    const effectiveRole = (serverPrefs?.role || me?.role || null) as string | null;
                    setRole(effectiveRole);

                    // Fetch pending host event requests for coaches
                    if (effectiveRole === 'coach') {
                      setPendingLoading(true);
                      setPendingError(null);
                      try {
                        const events = await Event.filter({ event_type: 'host_request', approval_status: 'pending' });
                        if (mounted) setPendingHostRequests(Array.isArray(events) ? events : (events?.items || []));
                      } catch (e: any) {
                        if (mounted) setPendingError(e?.message || 'Failed to load event requests');
                      } finally {
                        if (mounted) setPendingLoading(false);
                      }
                    }
                  } catch (e: any) {
                    if (!mounted) return;
                    // Handle authentication errors gracefully - don't show "Unauthorized" to user
                    // AuthProvider will handle redirecting to sign-in
                    const isAuthError = e?.status === 401 || e?.status === 403 ||
                      (typeof e?.message === 'string' &&
                        (e.message.toLowerCase().includes('unauthorized') ||
                          e.message.toLowerCase().includes('forbidden')));
                    if (isAuthError) {
                      if (__DEV__) console.warn('[settings] Authentication error - refreshing auth state');
                      // Trigger auth check to let AuthProvider handle redirect
                      try {
                        await checkAuth();
                      } catch (authErr) {
                        if (__DEV__) console.warn('[settings] Auth check failed:', authErr);
                      }
                      // Don't set error - let AuthProvider redirect to sign-in
                      // The error state will be cleared when user is redirected
                      return;
                    }
                    // Only show non-auth errors to the user
                    setError(e?.message || 'Failed to load settings');
                  } finally {
                    if (!mounted) return;
                    setLoading(false);
                  }
                })();
                return () => { mounted = false; };
              }, [appConfig.adminEmails, checkAuth]);

              return (
                <>
                  <Stack.Screen
                    options={{
                      title: 'Settings',
                      headerShown: true,
                      headerBackTitle: 'Back',
                      headerLeft: () => (
                        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 8 }}>
                          <Ionicons name="chevron-back" size={28} color={Colors[colorScheme ?? 'light'].tint} />
                        </Pressable>
                      ),
                    }}
                  />
                  <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]} edges={['top', 'bottom']}>
                    <ScrollView>
                    {/* Account */}
                    <SectionCard title="Account" initiallyOpen>
                      <NavRow title="Edit Username" onPress={() => void router.push('/settings/edit-username')} />
                      <NavRow title="Reset Password" onPress={() => void router.push('/settings/reset-password')} />
                      <NavRow title="RSVP History" isLast onPress={() => void router.push('/settings/rsvp-history')} />
                    </SectionCard>

                    {/* Notifications */}
                    <SectionCard title="Notifications" initiallyOpen>
                      <SwitchRow
                        title="Game/Event Reminders"
                        value={!!prefs.notifications.game_event_reminders}
                        onValueChange={(v) => patchPrefs({ notifications: { game_event_reminders: v } } as any)}
                      />
                      <SwitchRow
                        title="Team Updates"
                        value={!!prefs.notifications.team_updates}
                        onValueChange={(v) => patchPrefs({ notifications: { team_updates: v } } as any)}
                      />
                      <SwitchRow
                        title="Comments & Upvotes"
                        value={!!prefs.notifications.comments_upvotes}
                        onValueChange={(v) => patchPrefs({ notifications: { comments_upvotes: v } } as any)}
                      />
                      <SwitchRow
                        title="New Followers"
                        subtitle="When someone follows you"
                        value={!!prefs.notifications.follows_notifications}
                        onValueChange={(v) => patchPrefs({ notifications: { follows_notifications: v } } as any)}
                      />
                      <SwitchRow
                        title="Direct Messages"
                        subtitle="When someone sends you a DM"
                        value={!!prefs.notifications.messages_notifications}
                        onValueChange={(v) => patchPrefs({ notifications: { messages_notifications: v } } as any)}
                        isLast
                      />
                    </SectionCard>

                    {/* Privacy */}
                    <SectionCard title="Privacy">
                      <SwitchRow
                        title="Private Profile"
                        subtitle="Only followers can see your posts, bio, and follower counts"
                        value={!!prefs.profile_private}
                        onValueChange={(v) => patchPrefs({ profile_private: v })}
                      />
                      <View style={[styles.rowBetween, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors[colorScheme ?? 'light'].border }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.rowTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Comment Permissions</Text>
                          <Text style={[styles.mutedSmall, { color: Colors[colorScheme ?? 'light'].mutedText }]}>
                            {prefs.comment_permission === 'everyone'
                              ? 'Everyone'
                              : prefs.comment_permission === 'following'
                                ? 'People I Follow'
                                : 'Nobody'}
                          </Text>
                        </View>
                        <Pressable
                          style={[styles.commentPermRow]}
                          onPress={() => {
                            Alert.alert(
                              'Who can comment on your posts?',
                              undefined,
                              [
                                {
                                  text: 'Everyone',
                                  onPress: () => {
                                    setPrefs((p) => ({ ...p, comment_permission: 'everyone' }));
                                    void User.updatePreferences({ comment_permission: 'everyone' });
                                  },
                                },
                                {
                                  text: 'People I Follow',
                                  onPress: () => {
                                    setPrefs((p) => ({ ...p, comment_permission: 'following' }));
                                    void User.updatePreferences({ comment_permission: 'following' });
                                  },
                                },
                                {
                                  text: 'Nobody',
                                  onPress: () => {
                                    setPrefs((p) => ({ ...p, comment_permission: 'none' }));
                                    void User.updatePreferences({ comment_permission: 'none' });
                                  },
                                },
                                { text: 'Cancel', style: 'cancel' },
                              ]
                            );
                          }}
                          accessibilityLabel="Comment permissions"
                          accessibilityRole="button"
                        >
                          <Text style={[styles.chev, { color: Colors[colorScheme ?? 'light'].icon }]}>›</Text>
                        </Pressable>
                      </View>
                      <NavRow title="Manage Blocked Users" onPress={() => void router.push('/settings/blocked-users')} />
                      <SwitchRow
                        title="I am a parent"
                        subtitle="Disclose your parent status to coaches."
                        value={!!prefs.is_parent}
                        onValueChange={(v) => patchPrefs({ is_parent: v })}
                        isLast
                      />
                    </SectionCard>

                    {/* My Content */}
                    <SectionCard title="My Content">
                      <NavRow title="View Favorites" subtitle="Posts you've saved" onPress={() => void router.push('/settings/favorites')} />
                      <NavRow title="Reserve Ad Space" subtitle="Promote your program, fundraiser, or business" onPress={() => void router.navigate('/submit-ad')} />
                      <NavRow title="My Ads" subtitle="Manage your advertisements" isLast onPress={() => void router.navigate('/my-ads')} />
                    </SectionCard>

                    {/* Billing (coaches only) */}
                    {role === 'coach' && (
                      <SectionCard title="Billing">
                        <NavRow title="Manage Subscription" isLast subtitle={Platform.OS === 'ios' ? 'Plan: Free' : (plan ? String(plan) : 'No subscription')} onPress={() => void router.push('/settings/manage-subscription')} />
                      </SectionCard>
                    )}

                    {/* Legal */}
                    <SectionCard title="Legal">
                      <NavRow title="Legal" subtitle="Terms, Privacy, DMCA & Copyright" onPress={() => void router.push('/settings/legal')} />
                      <NavRow title="View Core Values" onPress={() => void router.push('/settings/core-values')} />
                      <NavRow title="Privacy Policy" onPress={() => void router.push('/settings/privacy-policy')} />
                      <NavRow title="Terms of Service" onPress={() => void router.push('/settings/terms-of-service')} />
                      <NavRow title="Report Abuse" isLast onPress={() => void router.navigate('/report-abuse')} />
                    </SectionCard>

                    {/* Support & Feedback */}
                    <SectionCard title="Support & Feedback">
                      <NavRow title="Contact Varsity Hub Team" onPress={() => void router.push('/settings/contact')} />
                      <NavRow title="Leave Feedback" isLast onPress={() => void router.push('/settings/feedback')} />
                    </SectionCard>

                    {/* Admin Panel - Only visible to admins */}
                    {isAdmin && (
                      <SectionCard title="🛡️ Admin Panel" initiallyOpen>
                        <NavRow 
                          title="Admin Dashboard" 
                          subtitle="Overview and analytics" 
                          onPress={() => void router.navigate('/admin-dashboard')} 
                        />
                        <NavRow 
                          title="Activity Log" 
                          subtitle="Track all admin actions" 
                          onPress={() => void router.navigate('/admin-activity-log')} 
                        />
                        <NavRow 
                          title="Manage Users" 
                          subtitle="View all users, ban/unban" 
                          onPress={() => void router.navigate('/admin-users')} 
                        />
                        <NavRow 
                          title="Manage Teams" 
                          subtitle="View and moderate all teams" 
                          onPress={() => void router.navigate('/admin-teams')} 
                        />
                        <NavRow 
                          title="Manage Ads" 
                          subtitle="Review and moderate advertisements" 
                          onPress={() => void router.navigate('/admin-ads')} 
                        />
                        <NavRow
                          title="View Messages"
                          subtitle="Content moderation"
                          isLast
                          onPress={() => void router.navigate('/admin-messages')}
                        />
                      </SectionCard>
                    )}

                    {/* Session */}
                    <SectionCard title="Session">
                      <NavRow title="Log Out" destructive onPress={() => {
                        Alert.alert('Log out', 'Are you sure you want to log out?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Log Out', style: 'destructive', onPress: () => { void performSignOut(); } },
                        ]);
                      }} />
                      <NavRow title="Delete Account" destructive isLast={role === 'coach'} onPress={confirmDeleteAccount} />
                      {role !== 'coach' && <NavRow title="Upgrade to Coach Account" isLast onPress={() => {
                        Alert.alert('Upgrade to Coach Account', 'Your account will be upgraded to a coach account. You\'ll complete the coach setup steps next.', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Continue', onPress: async () => {
                            try {
                              await User.upgradeToCoach('rookie');
                              // Update onboarding context so step-3 knows user is a coach
                              if (setOB) {
                                setOB((prev) => ({ ...prev, role: 'coach', plan: undefined, step_3_visited: false, step_4_visited: false }));
                              }
                              router.push('/onboarding/step-3-plan');
                            } catch (e: any) {
                              Alert.alert('Error', e?.data?.error || e?.message || 'Failed to upgrade. Please try again.');
                            }
                          } }
                        ]);
                      }} />}
                    </SectionCard>

                    {/* Copyright Footer */}
                    <View style={{ paddingHorizontal: 16, paddingVertical: 24, alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: Colors[colorScheme ?? 'light'].mutedText, textAlign: 'center' }}>
                        © 2026 LIME PRODUCTIONS. All rights reserved.
                      </Text>
                    </View>
                    </ScrollView>
                    <Modal
                      visible={deleteWarningVisible}
                      animationType="slide"
                      onRequestClose={() => setDeleteWarningVisible(false)}
                    >
                      <View style={[styles.deleteWarningPage, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
                        <View style={styles.deleteWarningContent}>
                          <Text style={[styles.deleteWarningTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Are you sure?</Text>
                          <Text style={[styles.deleteWarningBody, { color: Colors[colorScheme ?? 'light'].mutedText }]}>
                            This will permanently delete your account and all your posts and media.
                          </Text>
                        </View>
                        <View style={styles.deleteWarningActions}>
                          <Pressable
                            style={[styles.deleteWarningBtn, { backgroundColor: Colors[colorScheme ?? 'light'].border }]}
                            onPress={() => setDeleteWarningVisible(false)}
                          >
                            <Text style={[styles.deleteWarningBtnText, { color: Colors[colorScheme ?? 'light'].text }]}>Cancel</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.deleteWarningBtn, { backgroundColor: '#DC2626' }]}
                            onPress={proceedToDeleteConfirm}
                          >
                            <Text style={[styles.deleteWarningBtnText, { color: '#FFFFFF' }]}>Continue</Text>
                          </Pressable>
                        </View>
                      </View>
                    </Modal>
                    <Modal
                      visible={deleteModalVisible}
                      transparent
                      animationType="fade"
                      onRequestClose={() => {
                        if (!deletingAccount) setDeleteModalVisible(false);
                      }}
                    >
                      <View style={styles.deleteModalBackdrop}>
                        <View style={[styles.deleteModalCard, { backgroundColor: Colors[colorScheme ?? 'light'].card, borderColor: Colors[colorScheme ?? 'light'].border }]}>
                          <Text style={[styles.deleteModalTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Delete Account</Text>
                          <Text style={[styles.deleteModalBody, { color: Colors[colorScheme ?? 'light'].mutedText }]}>
                            This permanently deletes your account. Type DELETE to confirm.
                          </Text>
                          <TextInput
                            value={deleteConfirmText}
                            onChangeText={setDeleteConfirmText}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            editable={!deletingAccount}
                            placeholder="DELETE"
                            placeholderTextColor={Colors[colorScheme ?? 'light'].mutedText}
                            style={[styles.deleteInput, { color: Colors[colorScheme ?? 'light'].text, borderColor: Colors[colorScheme ?? 'light'].border }]}
                          />
                          <View style={styles.deleteModalActions}>
                            <Pressable
                              style={[styles.deleteActionBtn, styles.deleteCancelBtn]}
                              onPress={() => {
                                if (!deletingAccount) setDeleteModalVisible(false);
                              }}
                            >
                              <Text style={[styles.deleteActionText, { color: Colors[colorScheme ?? 'light'].text }]}>Cancel</Text>
                            </Pressable>
                            <Pressable
                              style={[
                                styles.deleteActionBtn,
                                styles.deleteConfirmBtn,
                                (deleteConfirmText.trim() !== 'DELETE' || deletingAccount) && styles.deleteConfirmBtnDisabled,
                              ]}
                              disabled={deleteConfirmText.trim() !== 'DELETE' || deletingAccount}
                              onPress={() => { void performDeleteAccount(); }}
                            >
                              <Text style={styles.deleteConfirmText}>{deletingAccount ? 'Deleting…' : 'Delete'}</Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    </Modal>
                  </SafeAreaView>
                </>
              );
            }

            const styles = StyleSheet.create({
              container: { flex: 1 },
              title: { fontSize: 24, fontWeight: '700', marginBottom: 8, paddingHorizontal: 16 },
              error: { marginHorizontal: 16, marginBottom: 8 },
              card: { marginHorizontal: 16, marginBottom: 6, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
              cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12 },
              cardBody: { paddingHorizontal: 12, paddingBottom: 4 },
              cardTitle: { fontWeight: '800', fontSize: 16 },
              rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
              rowTitle: { fontWeight: '600' },
              mutedSmall: { fontSize: 12 },
              chev: { fontSize: 20, transform: [{ rotate: '0deg' }] },
              chevOpen: { transform: [{ rotate: '90deg' }] },
              commentPermRow: { padding: 8 },
              destructive: { color: '#DC2626' },
              selectedValue: { fontSize: 14 },
              themeOptions: { marginTop: 8, gap: 8 },
              themeOption: {
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 8,
                backgroundColor: 'transparent',
              },
              themeOptionSelected: {
                backgroundColor: '#f3f4f6',
              },
              themeOptionIndicator: {
                width: 16,
                height: 16,
                borderRadius: 8,
                borderWidth: 2,
                marginRight: 12,
                backgroundColor: 'transparent',
              },
              themeOptionIndicatorSelected: {
                borderColor: '#0a7ea4',
                backgroundColor: '#0a7ea4',
              },
              themeOptionText: {
                fontSize: 16,
                fontWeight: '500',
                flex: 1,
              },
              themeOptionTextSelected: {
                color: '#0a7ea4',
                fontWeight: '600',
              },
              themeOptionSubtext: {
                fontSize: 12,
                marginLeft: 'auto',
              },
              deleteWarningPage: {
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                padding: 32,
              },
              deleteWarningContent: {
                alignItems: 'center',
                marginBottom: 40,
              },
              deleteWarningTitle: {
                fontSize: 24,
                fontWeight: '800',
                marginBottom: 16,
                textAlign: 'center',
              },
              deleteWarningBody: {
                fontSize: 16,
                lineHeight: 24,
                textAlign: 'center',
              },
              deleteWarningActions: {
                width: '100%',
                gap: 12,
              },
              deleteWarningBtn: {
                paddingVertical: 16,
                borderRadius: 12,
                alignItems: 'center',
              },
              deleteWarningBtnText: {
                fontSize: 17,
                fontWeight: '700',
              },
              deleteModalBackdrop: {
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.45)',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
              },
              deleteModalCard: {
                width: '100%',
                maxWidth: 420,
                borderRadius: 12,
                borderWidth: StyleSheet.hairlineWidth,
                padding: 16,
                gap: 10,
              },
              deleteModalTitle: {
                fontSize: 18,
                fontWeight: '700',
              },
              deleteModalBody: {
                fontSize: 14,
                lineHeight: 20,
              },
              deleteInput: {
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 16,
                letterSpacing: 0.8,
              },
              deleteModalActions: {
                marginTop: 4,
                flexDirection: 'row',
                justifyContent: 'flex-end',
                gap: 10,
              },
              deleteActionBtn: {
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 8,
              },
              deleteCancelBtn: {
                backgroundColor: '#E5E7EB',
              },
              deleteConfirmBtn: {
                backgroundColor: '#DC2626',
              },
              deleteConfirmBtnDisabled: {
                opacity: 0.5,
              },
              deleteActionText: {
                fontWeight: '600',
              },
              deleteConfirmText: {
                fontWeight: '700',
                color: '#FFFFFF',
              },
            });
