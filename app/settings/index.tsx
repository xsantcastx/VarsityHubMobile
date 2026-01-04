import Switch from '@/components/ui/switch';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { getConfig } from '@/config/env';
import { Colors } from '@/constants/Colors';
import { useOnboardingOptional } from '@/context/OnboardingContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useThemePreference } from '@/hooks/useCustomColorScheme';

const appConfig = getConfig();

type Preferences = {
  notifications: { game_event_reminders: boolean; team_updates: boolean; comments_upvotes: boolean };
  is_parent: boolean;
  zip_code?: string | null;
};

function SectionCard({ title, initiallyOpen, children, style }: { title: string; initiallyOpen?: boolean; children: React.ReactNode; style?: any }) {
  const [open, setOpen] = useState(!!initiallyOpen);
  const colorScheme = useColorScheme();
  return (
    <View
      style={[
        styles.card,
        {
          borderColor: Colors[colorScheme].border,
          backgroundColor: Colors[colorScheme].card,
        },
        style,
      ]}
    >
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: Colors[colorScheme].text }]}>{title}</Text>
        <Text style={[styles.chev, open ? styles.chevOpen : null, { color: Colors[colorScheme].mutedText }]}>›</Text>
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
        <Text
          style={[
            styles.rowTitle,
            destructive ? styles.destructive : null,
            { color: destructive ? Colors[colorScheme].danger : Colors[colorScheme].text },
          ]}
        >
          {title}
        </Text>
        {subtitle ? <Text style={[styles.mutedSmall, { color: Colors[colorScheme].mutedText }]}>{subtitle}</Text> : null}
      </View>
      <Text style={[styles.chev, { color: Colors[colorScheme].mutedText }]}>›</Text>
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
  const options: Array<{ value: 'light' | 'dark' | 'system'; label: string; helper: string }> = [
    { value: 'light', label: 'Light', helper: 'Bright backgrounds' },
    { value: 'dark', label: 'Dark', helper: 'Low-light friendly' },
    { value: 'system', label: 'System', helper: 'Follow device' },
  ];

  return (
    <View style={{ gap: 2 }}>
      <Text style={[styles.rowTitle, { color: Colors[colorScheme].text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.mutedSmall, { color: Colors[colorScheme].mutedText }]}>{subtitle}</Text> : null}
      <View style={styles.themeOptionsCompact}>
        {options.map((opt) => {
          const selected = selectedValue === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={[styles.themeOption, selected ? styles.themeOptionSelected : null]}
              onPress={() => onValueChange(opt.value)}
            >
              <View
                style={[
                  styles.themeOptionIndicator,
                  selected ? styles.themeOptionIndicatorSelected : null,
                  { borderColor: Colors[colorScheme].border },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.themeOptionText, selected ? styles.themeOptionTextSelected : null]}>{opt.label}</Text>
                <Text style={styles.themeOptionSubtext}>{opt.helper}</Text>
              </View>
            </Pressable>
          );
        })}
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
  const [athleteSummary, setAthleteSummary] = useState<{ jersey?: string | number | null; position?: string | null; sport?: string | null }>({});

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
            team_updates: !!serverPrefs?.team_updates,
            comments_upvotes: !!serverPrefs?.comments_upvotes,
          },
          is_parent: !!serverPrefs?.is_parent,
          zip_code: serverPrefs?.zip_code ?? null,
        });
        setPlan(serverPrefs?.plan ?? null);
        const effectiveRole = (serverPrefs?.role || me?.role || null) as string | null;
        setRole(effectiveRole);

        setAthleteSummary({
          jersey: serverPrefs?.jersey_number ?? me?.jersey_number ?? null,
          position: serverPrefs?.position ?? me?.position ?? null,
          sport: serverPrefs?.primary_sport || serverPrefs?.sport || me?.primary_sport || me?.sport || null,
        });
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

  // Harden onboarding reset: blocking spinner, error handling, toast
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
      try {
        await User.updatePreferences({ onboarding_completed: false });
      } catch {
        Alert.alert('Failed', 'Failed to reset onboarding. Please try again.');
        return;
      }
      if (setOB) void setOB(preload);
      router.replace('/onboarding/step-1-role');
    } catch {
      Alert.alert('Unexpected error', 'Unexpected error during onboarding reset.');
    }
  };


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['bottom']}>
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={true}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}


        {/* Organization & Team: Only for coaches */}
        {role === 'coach' && (
          <SectionCard title="Organization & Team" initiallyOpen style={styles.sectionSpacing}>
            <NavRow
              title="Edit Organization & Team"
              subtitle="Update your organization and team info"
              onPress={() => void router.push('/manage-teams')}
            />
          </SectionCard>
        )}

        {/* Billing & Plan: Visible for all roles (if needed, restrict to coach as well) */}
        <SectionCard title="Billing & Plan" initiallyOpen style={styles.sectionSpacing}>
          <NavRow
            title="Manage Subscription"
            subtitle="Manage your subscription and plan"
            onPress={() => void router.push('/settings/manage-subscription')}
          />
        </SectionCard>

        {/* Quick Billing CTA (coaches only) */}
        {role === 'coach' && (
          <View style={{ paddingHorizontal: 16, marginTop: 8, marginBottom: 12 }}>
            <Pressable onPress={() => void router.push('/settings/manage-subscription')} style={{ padding: 12, borderRadius: 12, backgroundColor: plan ? (colorScheme === 'dark' ? '#1F2937' : '#F3F4F6') : '#0A84FF' }}>
              <Text style={{ color: plan ? (colorScheme === 'dark' ? '#ECEDEE' : '#111827') : '#fff', fontWeight: '800', textAlign: 'center' }}>{plan ? `Manage Billing — ${String(plan)}` : 'Subscribe — Upgrade to Veteran or Legend'}</Text>
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

        {/* Athlete Profile (athletes only) */}
        {role === 'athlete' && (athleteSummary.jersey || athleteSummary.position) && (
          <SectionCard title="Athlete Profile" style={styles.sectionSpacing}>
            <NavRow
              title="Edit Athlete Info"
              subtitle={[
                athleteSummary.position ? `${athleteSummary.position}` : null,
                athleteSummary.jersey ? `#${athleteSummary.jersey}` : null,
                athleteSummary.sport ? `${athleteSummary.sport}` : null,
              ].filter(Boolean).join(' · ') || 'Jersey, position, stats'}
              onPress={() => void router.push('/edit-profile')}
            />
          </SectionCard>
        )}

        {/* Appearance */}
        <SectionCard title="Appearance" initiallyOpen style={styles.sectionSpacing}>
          <ThemeRow
            title="Theme"
            subtitle="Light, dark, or follow system"
            selectedValue={themePreference}
            onValueChange={setThemePreference}
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
        <SectionCard title="Privacy" style={styles.sectionSpacing}>
          <NavRow title="Manage Blocked Users" onPress={() => void router.push('/settings/blocked-users')} />
          <SwitchRow
            title="I am a parent"
            subtitle="Disclose your parent status to coaches."
            value={!!prefs.is_parent}
            onValueChange={(v) => patchPrefs({ is_parent: v })}
          />
        </SectionCard>

        {/* My Content */}
        <SectionCard title="My Content" style={styles.sectionSpacing}>
          <NavRow title="View Favorites" subtitle="Posts you've saved" onPress={() => void router.push('/settings/favorites')} />
          <NavRow title="My Ads" subtitle="Manage your advertisements" onPress={() => void router.push('/my-ads')} />
          <NavRow title="Create New Ad" subtitle="Promote your program, fundraiser, or business" onPress={() => void router.push('/submit-ad')} />
        </SectionCard>

        {/* Billing (coaches only) */}
        {role === 'coach' && (
          <SectionCard title="Billing" style={styles.sectionSpacing}>
            <NavRow title="Manage Subscription" subtitle={plan ? String(plan) : 'No subscription'} onPress={() => void router.push('/settings/manage-subscription')} />
          </SectionCard>
        )}

        {/* Legal - condensed */}
        <SectionCard title="Legal" style={styles.sectionSpacing}>
          <NavRow title="View Core Values" onPress={() => void router.push('/settings/core-values')} />
          <NavRow title="Report Abuse" onPress={() => void router.push('/report-abuse')} />
          <NavRow title="DM Restrictions Summary" onPress={() => void router.push('/dm-restrictions')} />
        </SectionCard>

        {/* Support & Feedback */}
        <SectionCard title="Support & Feedback" style={styles.sectionSpacing}>
          <NavRow title="Contact Varsity Hub Team" onPress={() => void router.push('/settings/contact')} />
          <NavRow title="Leave Feedback" onPress={() => void router.push('/settings/feedback')} />
        </SectionCard>

        {/* Admin Panel - Only visible to admins */}
        {isAdmin && (
          <SectionCard title="🛡️ Admin Panel" initiallyOpen style={styles.sectionSpacing}>
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
        <SectionCard title="Session" style={styles.sectionSpacing}>
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
          <Text style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
            © 2025 LIME PRODUCTIONS. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
              sectionSpacing: { marginTop: 20 },
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
              themeOptionsCompact: { marginTop: 2, gap: 2 },
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
              diagnosticBox: {
                borderWidth: 1,
                borderRadius: 8,
                padding: 12,
                gap: 4,
              },
              diagnosticLabel: {
                fontWeight: '600',
                fontSize: 14,
              },
              diagnosticSmall: {
                fontSize: 12,
              },
              testButton: {
                paddingVertical: 12,
                borderRadius: 8,
                justifyContent: 'center',
              },
              resultBox: {
                borderWidth: 1,
                borderRadius: 8,
                padding: 12,
              },
              resultText: {
                fontSize: 13,
                fontWeight: '500',
              },
            });
