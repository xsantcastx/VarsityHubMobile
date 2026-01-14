
            import Switch from '@/components/ui/switch';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useThemePreference } from '@/hooks/useCustomColorScheme';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
            // @ts-ignore JS exports
            import { User } from '@/api/entities';
import { useOnboardingOptional } from '@/context/OnboardingContext';

const appConfig = getConfig();

            type Preferences = {
              notifications: { game_event_reminders: boolean; team_updates: boolean; comments_upvotes: boolean };
              is_parent: boolean;
              zip_code?: string | null;
            };

            function SectionCard({ title, initiallyOpen, children }: { title: string; initiallyOpen?: boolean; children: React.ReactNode }) {
              const [open, setOpen] = useState(!!initiallyOpen);
              const colorScheme = useColorScheme();
              return (
                <View style={[styles.card, { 
                  borderColor: Colors[colorScheme].border,
                  backgroundColor: Colors[colorScheme].card
                }]}> 
                  <Pressable onPress={() => setOpen((o) => !o)} style={styles.cardHeader}>
                    <Text style={[styles.cardTitle, { color: Colors[colorScheme].text }]}>{title}</Text>
                    <Text style={[styles.chev, open ? styles.chevOpen : null, { color: Colors[colorScheme].icon }]}>›</Text>
                  </Pressable>
                  {open ? <View style={styles.cardBody}>{children}</View> : null}
                </View>
              );
            }

            function NavRow({ title, subtitle, onPress, destructive }: { title: string; subtitle?: string; onPress: () => void; destructive?: boolean }) {
              const colorScheme = useColorScheme();
              return (
                <Pressable onPress={onPress} style={styles.rowBetween} android_ripple={{ color: Colors[colorScheme].border }}>
                  <View>
                    <Text style={[
                      styles.rowTitle, 
                      destructive ? styles.destructive : null,
                      { color: destructive ? Colors.light.destructive : Colors[colorScheme].text }
                    ]}>{title}</Text>
                    {subtitle ? <Text style={[styles.mutedSmall, { color: Colors[colorScheme].mutedText }]}>{subtitle}</Text> : null}
                  </View>
                  <Text style={[styles.chev, { color: Colors[colorScheme].icon }]}>›</Text>
                </Pressable>
              );
            }

            function SwitchRow({
              title,
              subtitle,
              value,
              onValueChange,
            }: {
              title: string;
              subtitle?: string;
              value: boolean;
              onValueChange: (v: boolean) => void;
            }) {
              const colorScheme = useColorScheme();
              return (
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={[styles.rowTitle, { color: Colors[colorScheme].text }]}>{title}</Text>
                    {subtitle ? <Text style={[styles.mutedSmall, { color: Colors[colorScheme].mutedText }]}>{subtitle}</Text> : null}
                  </View>
                  <Switch value={value} onValueChange={onValueChange} />
                </View>
              );
            }

            function ThemeRow({
              title,
              subtitle,
              selectedValue,
              onValueChange,
            }: {
              title: string;
              subtitle?: string;
              selectedValue: 'light' | 'dark' | 'system';
              onValueChange: (v: 'light' | 'dark' | 'system') => void;
            }) {
              const colorScheme = useColorScheme();
              const options = [
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ] as const;

              return (
                <View>
                  <View style={styles.rowBetween}>
                    <View>
                      <Text style={[styles.rowTitle, { color: Colors[colorScheme].text }]}>{title}</Text>
                      {subtitle ? <Text style={[styles.mutedSmall, { color: Colors[colorScheme].mutedText }]}>{subtitle}</Text> : null}
                    </View>
                    <Text style={[styles.selectedValue, { color: Colors[colorScheme].mutedText }]}>
                      {options.find(opt => opt.value === selectedValue)?.label}
                    </Text>
                  </View>
                  <View style={styles.themeOptions}>
                    {options.map((option) => (
                      <Pressable
                        key={option.value}
                        style={[
                          styles.themeOption,
                          selectedValue === option.value && [
                            styles.themeOptionSelected,
                            { backgroundColor: Colors[colorScheme].card }
                          ],
                        ]}
                        onPress={() => onValueChange(option.value)}
                        android_ripple={{ color: Colors[colorScheme].border }}
                      >
                        <View style={[
                          styles.themeOptionIndicator,
                          { borderColor: Colors[colorScheme].border },
                          selectedValue === option.value && styles.themeOptionIndicatorSelected,
                        ]} />
                        <Text style={[
                          styles.themeOptionText,
                          { color: Colors[colorScheme].text },
                        ]}>
                          {option.label}
                        </Text>
                        {option.value === 'system' && <Text style={[styles.themeOptionSubtext, { color: Colors[colorScheme].mutedText }]}>Follow device setting</Text>}
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            }

            export default function SettingsScreen() {
              const router = useRouter();
              // use non-throwing optional onboarding context (may be null if not within OBProvider)
              const obCtx = useOnboardingOptional();
              const setOB = obCtx?.setState ?? null;
              const colorScheme = useColorScheme();
              const { themePreference, setThemePreference } = useThemePreference();
              const [_loading, setLoading] = useState(true);
              const [error, setError] = useState<string | null>(null);
              const [_email, setEmail] = useState<string | null>(null);
              const [prefs, setPrefs] = useState<Preferences>({
                notifications: { game_event_reminders: false, team_updates: false, comments_upvotes: false },
                is_parent: false,
                zip_code: null,
              });
              const [plan, setPlan] = useState<string | null>(null);
              const [role, setRole] = useState<string | null>(null);
              const [isAdmin, setIsAdmin] = useState(false);

              // Debounce timer refs for PATCH batching
              const timers = useRef<{ [k: string]: any }>({});

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
                  } catch (e: any) {
                    if (!mounted) return;
                    setError(e?.message || 'Failed to load settings');
                  } finally {
                    if (!mounted) return;
                    setLoading(false);
                  }
                })();
                return () => { mounted = false; };
              }, []);

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
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    } catch (_e: any) {
                      // Error handled via Alert below
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
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  try { void await User.updatePreferences({ onboarding_completed: false }); } catch (_e: any) { /* ignore */ }
                  if (setOB) void setOB(preload);
                  router.replace('/onboarding/step-1-role');
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                } catch (_e: any) {
                  // Error in onboarding restart - try fallback
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  try { void await User.updatePreferences({ onboarding_completed: false }); } catch (_error: any) {}
                  router.replace('/onboarding');
                }
              };

              return (
                <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'bottom']}>
                  <Stack.Screen options={{ 
                    title: 'Settings', 
                    headerBackTitle: 'Back',
                    headerShown: true,
                  }} />
                  <ScrollView 
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 28 }}
                    showsVerticalScrollIndicator={true}
                  >
                    {error ? <Text style={styles.error}>{error}</Text> : null}
                    
                    {/* Quick Billing CTA (coaches only) */}
                    {role === 'coach' && (
                      <View style={{ paddingHorizontal: 16, marginTop: 8, marginBottom: 12 }}>
                        <Pressable onPress={() => router.push('/settings/manage-subscription')} style={{ padding: 12, borderRadius: 12, backgroundColor: plan ? Colors[colorScheme].card : Colors.light.tint }}>
                          <Text style={{ color: plan ? Colors[colorScheme].text : Colors.dark.text, fontWeight: '800', textAlign: 'center' }}>{plan ? `Manage Billing — ${String(plan)}` : 'Subscribe — Upgrade to Veteran or Legend'}</Text>
                        </Pressable>
                      </View>
                    )}
                    {/* Account */}
                    <SectionCard title="Account" initiallyOpen>
                      <NavRow title="Edit Username" onPress={() => void router.push('/settings/edit-username')} />
                      <NavRow title="Reset Password" onPress={() => void router.push('/settings/reset-password')} />
                      <NavRow
                        title="Add ZIP Code"
                        subtitle={prefs.zip_code ? String(prefs.zip_code) : 'For local event discovery'}
                        onPress={() => void router.push('/settings/zip-code')}
                      />
                      <NavRow title="Followed Teams" onPress={() => void router.push('/settings/followed-teams')} />
                    </SectionCard>

                    {/* Appearance */}
                    <SectionCard title="Appearance" initiallyOpen>
                      <ThemeRow
                        title="Theme"
                        subtitle="Choose your preferred color scheme"
                        selectedValue={themePreference}
                        onValueChange={setThemePreference}
                      />
                    </SectionCard>

                    {/* Events */}
                    <SectionCard title="Events">
                      <NavRow title="Request to Host Event" onPress={() => void router.push('/settings/request-host-event')} />
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
                      <NavRow title="Privacy Policy" subtitle="How we protect your data" onPress={() => void router.push('/settings/privacy-policy')} />
                      <NavRow title="Terms of Service" subtitle="Rules and guidelines" onPress={() => void router.push('/settings/terms-of-service')} />
                      <NavRow title="Safe Zone Policy" subtitle="Messaging safety & protection" onPress={() => void router.push('/settings/safe-zone-policy')} />
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
                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                            try { await User.logout(); } catch (_error: any) {}
                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                            try { obCtx?.clearOnboarding?.(); } catch (_error: any) { /* ignore */ }
                            router.replace('/sign-in');
                          } },
                        ]);
                      }} />
                      <NavRow title="Delete Account" destructive onPress={() => {
                        let _input = '';
                        Alert.prompt?.('Delete Account', 'This permanently deletes your account. Type DELETE to confirm.', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Confirm', style: 'destructive', onPress: async (val) => {
                            const v = String(val || '').trim();
                            if (v !== 'DELETE') { Alert.alert('Confirmation required', 'Type DELETE in all caps to confirm.'); return; }
                            try {
                              const res = await fetch(`${appConfig.apiUrl}/users/me`, { method: 'DELETE', headers: { Authorization: `Bearer ${(await (await import('@/api/auth')).loadToken()) || ''}` } as any });
                              const ok = res.ok;
                              if (!ok) throw new Error('Failed');
                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                            } catch (_e: any) {
                              Alert.alert('Delete failed', 'Could not delete your account.');
                              return;
                            }
                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                            try { await User.logout(); } catch (_error: any) {}
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
                                const res = await fetch(`${appConfig.apiUrl}/users/me`, { method: 'DELETE', headers: { Authorization: `Bearer ${(await (await import('@/api/auth')).loadToken()) || ''}` } as any });
                                if (!res.ok) throw new Error('Failed');
                              // eslint-disable-next-line @typescript-eslint/no-unused-vars
                              } catch (_e: any) { Alert.alert('Delete failed', 'Could not delete your account.'); return; }
                              // eslint-disable-next-line @typescript-eslint/no-unused-vars
                              try { await User.logout(); } catch (_error: any) {}
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
                      <Text style={{ fontSize: 12, color: Colors[colorScheme].mutedText, textAlign: 'center' }}>
                        © 2025 LIME PRODUCTIONS. All rights reserved.
                      </Text>
                    </View>
                  </ScrollView>
                </SafeAreaView>
              );
            }

            const styles = StyleSheet.create({
              container: { flex: 1 },
              title: { fontSize: 24, fontWeight: '700', marginBottom: 8, paddingHorizontal: 16 },
              error: { color: Colors.light.destructive, marginHorizontal: 16, marginBottom: 8 },
              card: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
              cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12 },
              cardBody: { padding: 12, gap: 12 },
              cardTitle: { fontWeight: '800', fontSize: 16 },
              rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
              rowTitle: { fontWeight: '600' },
              mutedSmall: { fontSize: 12 },
              chev: { fontSize: 20, transform: [{ rotate: '0deg' }] },
              chevOpen: { transform: [{ rotate: '90deg' }] },
              destructive: { color: Colors.light.destructive },
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
              themeOptionSelected: {},
              themeOptionIndicator: {
                width: 16,
                height: 16,
                borderRadius: 8,
                borderWidth: 2,
                marginRight: 12,
                backgroundColor: 'transparent',
              },
              themeOptionIndicatorSelected: {
                borderColor: Colors.light.tint,
                backgroundColor: Colors.light.tint,
              },
              themeOptionText: {
                fontSize: 16,
                fontWeight: '500',
                flex: 1,
              },
              themeOptionTextSelected: {
                fontWeight: '600',
              },
              themeOptionSubtext: {
                fontSize: 12,
                marginLeft: 'auto',
              },
            });
