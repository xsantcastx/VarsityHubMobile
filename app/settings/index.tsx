import * as WebBrowser from 'expo-web-browser';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { Event, User } from '@/api/entities';
import { getConfig } from '@/config/env';
import { useAuth } from '@/context/AuthProvider';
import { useOnboardingOptional } from '@/context/OnboardingContext';

interface Preferences {
  notifications: {
    game_event_reminders: boolean;
    team_updates: boolean;
    comments_upvotes: boolean;
  };
  is_parent: boolean;
  zip_code: string | null;
}

// Inline components for settings
function SectionCard({ title, initiallyOpen = false, children }: { title: string; initiallyOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={styles.card}>
      <Pressable style={styles.cardHeader} onPress={() => setOpen(!open)}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={[styles.chev, open && styles.chevOpen]}>›</Text>
      </Pressable>
      {open && <View style={styles.cardBody}>{children}</View>}
    </View>
  );
}

function NavRow({ title, subtitle, onPress, destructive }: { title: string; subtitle?: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.rowBetween}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, destructive && styles.destructive]}>{title}</Text>
        {subtitle && <Text style={styles.mutedSmall}>{subtitle}</Text>}
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

function SwitchRow({ title, subtitle, value, onValueChange }: { title: string; subtitle?: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View style={styles.rowBetween}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle && <Text style={styles.mutedSmall}>{subtitle}</Text>}
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { checkAuth } = useAuth();
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
    },
    is_parent: false,
    zip_code: null,
  });
  const [plan, setPlan] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [_pendingHostRequests, setPendingHostRequests] = useState<any[]>([]);
  const [_pendingLoading, setPendingLoading] = useState(false);
  const [_pendingError, setPendingError] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Debounced PATCH updater for preferences
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

                  // Debounce the API call
                  timers.current[key] = setTimeout(async () => {
                    try {
                      await User.updatePreferences(newPrefs);
                    } catch (e: any) {
                      // Error handled via Alert below
                      console.error('[settings] Failed to update preferences:', e);
                      // Revert on failure if needed, though not implemented here
                      Alert.alert('Update failed', 'Could not save your preference. Please try again.');
                    }
                  }, 300);

                  return newPrefs;
                });
              };

              const restartOnboarding = async () => {
                try {
                  const me: any = await checkAuth();
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
                  } catch (error: any) {
                    console.warn('[settings] Failed to reset onboarding_completed flag:', error);
                    // Continue anyway - user will be redirected to onboarding
                  }
                  if (setOB) void setOB(preload);
                  router.replace('/onboarding/step-1-role');
                } catch (e: any) {
                  // Error in onboarding restart - try fallback
                  console.error('[settings] Failed to restart onboarding:', e);
                  try { 
                    void await User.updatePreferences({ onboarding_completed: false }); 
                  } catch (error: any) {
                    console.warn('[settings] Failed to reset onboarding status:', error);
                    // Continue anyway - user will be redirected to onboarding
                  }
                  router.replace('/onboarding');
                }
              };

              // Move the async logic into useEffect
              useEffect(() => {
                let mounted = true;
                void (async () => {
                  setLoading(true);
                  setError(null);
                  try {
                    const me: any = await checkAuth();
                    if (!mounted) return;
                    setEmail(me?.email || null);
                    // Check if user is admin (email-based)
                    const adminEmails = (appConfig.adminEmails.length ? appConfig.adminEmails : ['emilmancero@gmail.com'])
                      .map((e) => e.toLowerCase());
                    setIsAdmin(adminEmails.includes((me?.email || '').toLowerCase()));
                    const serverPrefs = (me && me.preferences) || {};
                    setPrefs({
                      notifications: {
                        game_event_reminders: !!serverPrefs?.notifications?.game_event_reminders,
                        team_updates: !!serverPrefs?.notifications?.team_updates,
                        comments_upvotes: !!serverPrefs?.notifications?.comments_upvotes,
                      },
                      is_parent: !!serverPrefs?.is_parent,
                      zip_code: serverPrefs?.zip_code ?? null,
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
                      console.warn('[settings] Authentication error - refreshing auth state');
                      // Trigger auth check to let AuthProvider handle redirect
                      try {
                        await checkAuth();
                      } catch (authErr) {
                        console.warn('[settings] Auth check failed:', authErr);
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
                    }} 
                  />
                  <SafeAreaView style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#0B1120' : 'white' }]} edges={['top', 'bottom']}>
                    <ScrollView>
                    {/* Account */}
                    <SectionCard title="Account" initiallyOpen>
                      <NavRow title="Edit Username" onPress={() => void router.push('/settings/edit-username')} />
                      <NavRow title="Reset Password" onPress={() => void router.push('/settings/reset-password')} />
                      <NavRow title="RSVP History" onPress={() => void router.push('/settings/rsvp-history')} />
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
                    </SectionCard>

                    {/* Privacy */}
                    <SectionCard title="Privacy">
                      <NavRow title="Manage Blocked Users" onPress={() => void router.push('/settings/blocked-users')} />
                      <SwitchRow
                        title="I am a parent"
                        subtitle="Disclose your parent status to coaches."
                        value={!!prefs.is_parent}
                        onValueChange={(v) => patchPrefs({ is_parent: v })}
                      />
                    </SectionCard>

                    {/* My Content */}
                    <SectionCard title="My Content">
                      <NavRow title="View Favorites" subtitle="Posts you've saved" onPress={() => void router.push('/settings/favorites')} />
                      <NavRow title="Reserve Ad Space" subtitle="Promote your program, fundraiser, or business" onPress={() => void router.push('/submit-ad')} />
                      <NavRow title="My Ads" subtitle="Manage your advertisements" onPress={() => void router.push('/my-ads')} />
                    </SectionCard>

                    {/* Billing (coaches only) */}
                    {role === 'coach' && (
                      <SectionCard title="Billing">
                        <NavRow title="Manage Subscription" subtitle={plan ? String(plan) : 'No subscription'} onPress={() => void router.push('/settings/manage-subscription')} />
                      </SectionCard>
                    )}

                    {/* Legal */}
                    <SectionCard title="Legal">
                      <NavRow title="Privacy Policy" onPress={() => void WebBrowser.openBrowserAsync('https://varsityhub.app/privacy')} />
                      <NavRow title="Terms of Service" onPress={() => void WebBrowser.openBrowserAsync('https://varsityhub.app/terms')} />
                      <NavRow title="View Core Values" onPress={() => void router.push('/settings/core-values')} />
                      <NavRow title="Report Abuse" onPress={() => void router.push('/report-abuse')} />
                      <NavRow title="DM Restrictions Summary" onPress={() => void router.push('/dm-restrictions')} />
                    </SectionCard>

                    {/* Support & Feedback */}
                    <SectionCard title="Support & Feedback">
                      <NavRow title="Contact Varsity Hub Team" onPress={() => void router.push('/settings/contact')} />
                      <NavRow title="Leave Feedback" onPress={() => void router.push('/settings/feedback')} />
                    </SectionCard>

                    {/* Admin Panel - Only visible to admins */}
                    {isAdmin && (
                      <SectionCard title="🛡️ Admin Panel" initiallyOpen>
                        <NavRow 
                          title="Admin Dashboard" 
                          subtitle="Overview and analytics" 
                          onPress={() => void router.push('/admin-dashboard')} 
                        />
                        <NavRow 
                          title="Activity Log" 
                          subtitle="Track all admin actions" 
                          onPress={() => void router.push('/admin-activity-log')} 
                        />
                        <NavRow 
                          title="Manage Users" 
                          subtitle="View all users, ban/unban" 
                          onPress={() => void router.push('/admin-users')} 
                        />
                        <NavRow 
                          title="Manage Teams" 
                          subtitle="View and moderate all teams" 
                          onPress={() => void router.push('/admin-teams')} 
                        />
                        <NavRow 
                          title="Manage Ads" 
                          subtitle="Review and moderate advertisements" 
                          onPress={() => void router.push('/admin-ads')} 
                        />
                        <NavRow 
                          title="View Messages" 
                          subtitle="Content moderation" 
                          onPress={() => void router.push('/admin-messages')} 
                        />
                      </SectionCard>
                    )}

                    {/* Session */}
                    <SectionCard title="Session">
                      <NavRow title="Log Out" destructive onPress={() => {
                        Alert.alert('Log out', 'Are you sure you want to log out?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Log Out', style: 'destructive', onPress: async () => {
                            try { 
                              await User.logout(); 
                            } catch (error: any) {
                              console.warn('[settings] Logout failed:', error);
                              // Continue with navigation even if logout fails
                            }
                            try { 
                              void obCtx?.clearOnboarding?.(); 
                            } catch (error: any) {
                              console.warn('[settings] Failed to clear onboarding:', error);
                              // Non-critical - continue with logout
                            }
                            router.replace('/sign-in');
                          } },
                        ]);
                      }} />
                      <NavRow title="Delete Account" destructive onPress={() => {
                        let _input = '';
                        Alert.prompt?.('Delete Account', 'This permanently deletes your account. Type DELETE to confirm.', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Confirm', style: 'destructive', onPress: async (val: string | undefined) => {
                            const v = String(val || '').trim();
                            if (v !== 'DELETE') { Alert.alert('Confirmation required', 'Type DELETE in all caps to confirm.'); return; }
                            try {
                              // Use API client instead of direct fetch
                              const { httpDelete } = await import('@/api/http');
                              await httpDelete('/users/me');
                            } catch (error: any) {
                              console.error('[settings] Account deletion failed:', error);
                              Alert.alert('Delete failed', error?.message || 'Could not delete your account.');
                              return;
                            }
                            try { 
                              await User.logout(); 
                            } catch (error: any) {
                              console.warn('[settings] Logout after deletion failed:', error);
                              // Continue with navigation even if logout fails
                            }
                            router.replace('/sign-in');
                          }}
                        ], 'plain-text');
                        // Fallback for Android (no Alert.prompt)
                        if (!Alert.prompt) {
                          Alert.alert('Delete Account', 'This permanently deletes your account. Type DELETE to confirm.', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Confirm', style: 'destructive', onPress: async () => {
                              // Simple confirm-only for Android fallback
                              try {
                                const { httpDelete } = await import('@/api/http');
                                await httpDelete('/users/me');
                              } catch (error: any) {
                                console.error('[settings] Account deletion failed (Android):', error);
                                Alert.alert('Delete failed', error?.message || 'Could not delete your account.');
                                return;
                              }
                              try { 
                                await User.logout(); 
                              } catch (error: any) {
                                console.warn('[settings] Logout after deletion failed (Android):', error);
                                // Continue with navigation even if logout fails
                              }
                              router.replace('/sign-in');
                            } },
                          ]);
                        }
                      }} />
                      <NavRow title="Restart Onboarding" onPress={() => {
                        Alert.alert('Restart Onboarding', 'You will be taken back to onboarding.', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Restart', onPress: () => { void restartOnboarding(); } }
                        ]);
                      }} />
                    </SectionCard>

                    {/* Copyright Footer */}
                    <View style={{ paddingHorizontal: 16, paddingVertical: 24, alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
                        © 2025 LIME PRODUCTIONS. All rights reserved.
                      </Text>
                    </View>
                    </ScrollView>
                  </SafeAreaView>
                </>
              );
            }

            const styles = StyleSheet.create({
              container: { flex: 1 },
              title: { fontSize: 24, fontWeight: '700', marginBottom: 8, paddingHorizontal: 16 },
              error: { color: '#b91c1c', marginHorizontal: 16, marginBottom: 8 },
              card: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
              cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12 },
              cardBody: { padding: 12, gap: 12 },
              cardTitle: { fontWeight: '800', fontSize: 16 },
              rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
              rowTitle: { fontWeight: '600' },
              mutedSmall: { color: '#9CA3AF', fontSize: 12 },
              chev: { fontSize: 20, color: '#6b7280', transform: [{ rotate: '0deg' }] },
              chevOpen: { transform: [{ rotate: '90deg' }] },
              destructive: { color: '#DC2626' },
              selectedValue: { color: '#6b7280', fontSize: 14 },
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
                borderColor: '#d1d5db',
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
                color: '#374151',
                flex: 1,
              },
              themeOptionTextSelected: {
                color: '#0a7ea4',
                fontWeight: '600',
              },
              themeOptionSubtext: {
                fontSize: 12,
                color: '#9CA3AF',
                marginLeft: 'auto',
              },
            });
