
            import Switch from '@/components/ui/switch';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useThemePreference } from '@/hooks/useCustomColorScheme';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
            // @ts-ignore JS exports
            import { User } from '@/api/entities';
import { useOnboardingOptional } from '@/context/OnboardingContext';

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
                  borderColor: colorScheme === 'dark' ? '#1F2937' : '#E5E7EB',
                  backgroundColor: colorScheme === 'dark' ? '#0F172A' : '#F9FAFB'
                }]}> 
                  <Pressable onPress={() => setOpen((o) => !o)} style={styles.cardHeader}>
                    <Text style={[styles.cardTitle, { color: colorScheme === 'dark' ? '#ECEDEE' : '#11181C' }]}>{title}</Text>
                    <Text style={[styles.chev, open ? styles.chevOpen : null, { color: colorScheme === 'dark' ? '#9BA1A6' : '#6b7280' }]}>›</Text>
                  </Pressable>
                  {open ? <View style={styles.cardBody}>{children}</View> : null}
                </View>
              );
            }

            function NavRow({ title, subtitle, onPress, destructive }: { title: string; subtitle?: string; onPress: () => void; destructive?: boolean }) {
              const colorScheme = useColorScheme();
              return (
                <Pressable onPress={onPress} style={styles.rowBetween} android_ripple={{ color: '#e5e7eb' }}>
                  <View>
                    <Text style={[
                      styles.rowTitle, 
                      destructive ? styles.destructive : null,
                      { color: destructive ? '#DC2626' : (colorScheme === 'dark' ? '#ECEDEE' : '#11181C') }
                    ]}>{title}</Text>
                    {subtitle ? <Text style={[styles.mutedSmall, { color: colorScheme === 'dark' ? '#9CA3AF' : '#9CA3AF' }]}>{subtitle}</Text> : null}
                  </View>
                  <Text style={[styles.chev, { color: colorScheme === 'dark' ? '#9BA1A6' : '#6b7280' }]}>›</Text>
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
                    <Text style={[styles.rowTitle, { color: colorScheme === 'dark' ? '#ECEDEE' : '#11181C' }]}>{title}</Text>
                    {subtitle ? <Text style={[styles.mutedSmall, { color: colorScheme === 'dark' ? '#9CA3AF' : '#9CA3AF' }]}>{subtitle}</Text> : null}
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
                      <Text style={[styles.rowTitle, { color: colorScheme === 'dark' ? '#ECEDEE' : '#11181C' }]}>{title}</Text>
                      {subtitle ? <Text style={[styles.mutedSmall, { color: colorScheme === 'dark' ? '#9CA3AF' : '#9CA3AF' }]}>{subtitle}</Text> : null}
                    </View>
                    <Text style={[styles.selectedValue, { color: colorScheme === 'dark' ? '#9CA3AF' : '#6b7280' }]}>
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
                            { backgroundColor: colorScheme === 'dark' ? '#1F2937' : '#f3f4f6' }
                          ],
                        ]}
                        onPress={() => onValueChange(option.value)}
                        android_ripple={{ color: colorScheme === 'dark' ? '#1F2937' : '#e5e7eb' }}
                      >
                        <View style={[
                          styles.themeOptionIndicator,
                          { borderColor: colorScheme === 'dark' ? '#374151' : '#d1d5db' },
                          selectedValue === option.value && styles.themeOptionIndicatorSelected,
                        ]} />
                        <Text style={[
                          styles.themeOptionText,
                          { color: colorScheme === 'dark' ? '#D1D5DB' : '#374151' },
                        ]}>
                          {option.label}
                        </Text>
                        {option.value === 'system' && <Text style={[styles.themeOptionSubtext, { color: colorScheme === 'dark' ? '#6B7280' : '#9CA3AF' }]}>Follow device setting</Text>}
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
              const pushHistory = obCtx?.pushHistory ?? null;
              const colorScheme = useColorScheme();
              const { themePreference, setThemePreference } = useThemePreference();
              const [loading, setLoading] = useState(true);
              const [error, setError] = useState<string | null>(null);
              const [email, setEmail] = useState<string | null>(null);
              const [prefs, setPrefs] = useState<Preferences>({
                notifications: { game_event_reminders: false, team_updates: false, comments_upvotes: false },
                is_parent: false,
                zip_code: null,
              });
              const [plan, setPlan] = useState<string | null>(null);

              // Debounce timer refs for PATCH batching
              const timers = useRef<{ [k: string]: any }>({});

              useEffect(() => {
                let mounted = true;
                (async () => {
                  setLoading(true);
                  setError(null);
                  try {
                    const me: any = await User.me();
                    if (!mounted) return;
                    setEmail(me?.email || null);
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
                timers.current[key] = setTimeout(async () => {
                  try {
                    // merge locally for immediate UI
                    setPrefs((cur) => ({ ...(cur as any), ...(patch as any) }));
                    await User.updatePreferences(patch as any);
                  } catch (e) {
                    console.warn('Failed to patch prefs', e);
                    Alert.alert('Update failed', 'Could not save your preference. Please try again.');
                  }
                }, 150);
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
                    sports: prefsFromServer.sports_interests ?? prefsFromServer.sports ?? [],
                    primary_intents: prefsFromServer.primary_intents ?? [],
                    authorized_users: prefsFromServer.authorized_users ?? prefsFromServer.authorized ?? [],
                  } as any;

                  try { pushHistory?.(preload); } catch (e) { console.warn('Failed to push onboarding history', e); }
                  try { await User.updatePreferences({ onboarding_completed: false }); } catch (e) { /* ignore */ }
                  if (setOB) setOB(preload);
                  router.replace('/onboarding/step-1-role');
                } catch (e) {
                  console.warn('Failed to preload onboarding, falling back to simple restart', e);
                  try { await User.updatePreferences({ onboarding_completed: false }); } catch {}
                  router.replace('/onboarding');
                }
              };

              return (
                <SafeAreaView style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#0B1120' : 'white' }]} edges={['top']}>
                  <Stack.Screen options={{ title: 'Settings' }} />
                  <Text style={[styles.title, { color: colorScheme === 'dark' ? '#ECEDEE' : '#11181C' }]}>Settings</Text>
                  {/* Quick Billing CTA */}
                  <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                    <Pressable onPress={() => router.push('/settings/manage-subscription')} style={{ padding: 12, borderRadius: 12, backgroundColor: plan ? '#F3F4F6' : '#0A84FF' }}>
                      <Text style={{ color: plan ? '#111827' : '#fff', fontWeight: '800', textAlign: 'center' }}>{plan ? `Manage Billing — ${String(plan)}` : 'Subscribe — Upgrade to Veteran or Legend'}</Text>
                    </Pressable>
                  </View>
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
                    {/* Account */}
                    <SectionCard title="Account" initiallyOpen>
                      <NavRow title="Edit Username" onPress={() => router.push('/settings/edit-username')} />
                      <NavRow title="Reset Password" onPress={() => router.push('/settings/reset-password')} />
                      <NavRow
                        title="Add ZIP Code"
                        subtitle={prefs.zip_code ? String(prefs.zip_code) : 'For local event discovery'}
                        onPress={() => router.push('/settings/zip-code')}
                      />
                      <NavRow title="Followed Teams" onPress={() => router.push('/settings/followed-teams')} />
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
                      <NavRow title="Request to Host Event" onPress={() => router.push('/settings/request-host-event')} />
                      <NavRow title="RSVP History" onPress={() => router.push('/settings/rsvp-history')} />
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
                      <NavRow title="Manage Blocked Users" onPress={() => router.push('/settings/blocked-users')} />
                      <SwitchRow
                        title="I am a parent"
                        subtitle="Disclose your parent status to coaches."
                        value={!!prefs.is_parent}
                        onValueChange={(v) => patchPrefs({ is_parent: v })}
                      />
                    </SectionCard>

                    {/* My Content */}
                    <SectionCard title="My Content">
                      <NavRow title="View Favorites" subtitle="Posts you've saved" onPress={() => router.push('/settings/favorites')} />
                      <NavRow title="My Ads" subtitle="Manage your advertisements" onPress={() => router.push('/my-ads')} />
                    </SectionCard>

                    {/* Billing */}
                    <SectionCard title="Billing">
                      <NavRow title="Manage Subscription" subtitle={plan ? String(plan) : 'Free (rookie)'} onPress={() => router.push('/settings/manage-subscription')} />
                    </SectionCard>

                    {/* Legal */}
                    <SectionCard title="Legal">
                      <NavRow title="Privacy Policy" subtitle="How we protect your data" onPress={() => router.push('/settings/privacy-policy')} />
                      <NavRow title="Terms of Service" subtitle="Rules and guidelines" onPress={() => router.push('/settings/terms-of-service')} />
                      <NavRow title="Safe Zone Policy" subtitle="Messaging safety & protection" onPress={() => router.push('/settings/safe-zone-policy')} />
                      <NavRow title="View Core Values" onPress={() => router.push('/settings/core-values')} />
                      <NavRow title="Report Abuse" onPress={() => router.push('/report-abuse')} />
                      <NavRow title="DM Restrictions Summary" onPress={() => router.push('/dm-restrictions')} />
                    </SectionCard>

                    {/* Support & Feedback */}
                    <SectionCard title="Support & Feedback">
                      <NavRow title="Contact Varsity Hub Team" onPress={() => router.push('/settings/contact')} />
                      <NavRow title="Leave Feedback" onPress={() => router.push('/settings/feedback')} />
                    </SectionCard>

                    {/* Session */}
                    <SectionCard title="Session">
                      <NavRow title="Log Out" destructive onPress={() => {
                        Alert.alert('Log out', 'Are you sure you want to log out?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Log Out', style: 'destructive', onPress: async () => {
                            try { await User.logout(); } catch {}
                            try { obCtx?.clearOnboarding?.(); } catch (e) { /* ignore */ }
                            router.replace('/sign-in');
                          } },
                        ]);
                      }} />
                      <NavRow title="Delete Account" destructive onPress={() => {
                        let input = '';
                        Alert.prompt?.('Delete Account', 'This permanently deletes your account. Type DELETE to confirm.', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Confirm', style: 'destructive', onPress: async (val) => {
                            const v = String(val || '').trim();
                            if (v !== 'DELETE') { Alert.alert('Confirmation required', 'Type DELETE in all caps to confirm.'); return; }
                            try {
                              const res = await fetch((process as any).env?.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') + '/users/me', { method: 'DELETE', headers: { Authorization: `Bearer ${(await (await import('@/api/auth')).loadToken()) || ''}` } as any });
                              const ok = res.ok;
                              if (!ok) throw new Error('Failed');
                            } catch (e: any) {
                              Alert.alert('Delete failed', 'Could not delete your account.');
                              return;
                            }
                            try { await User.logout(); } catch {}
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
                                const res = await fetch((process as any).env?.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') + '/users/me', { method: 'DELETE', headers: { Authorization: `Bearer ${(await (await import('@/api/auth')).loadToken()) || ''}` } as any });
                                if (!res.ok) throw new Error('Failed');
                              } catch (e: any) { Alert.alert('Delete failed', 'Could not delete your account.'); return; }
                              try { await User.logout(); } catch {}
                              router.replace('/sign-in');
                            } },
                          ]);
                        }
                      }} />
                      <NavRow title="Restart Onboarding" onPress={() => {
                        Alert.alert('Restart Onboarding', 'You will be taken back to onboarding.', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Restart', onPress: () => { restartOnboarding(); } }
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

