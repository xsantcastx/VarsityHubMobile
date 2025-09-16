import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import Switch from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
// @ts-ignore JS exports
import { User, Support } from '@/api/entities';

type Preferences = {
  notifications: { game_event_reminders: boolean; team_updates: boolean; comments_upvotes: boolean };
  is_parent: boolean;
  zip_code?: string | null;
};

function SectionCard({ title, initiallyOpen, children }: { title: string; initiallyOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!initiallyOpen);
  return (
    <View style={styles.card}>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={[styles.chev, open ? styles.chevOpen : null]}>›</Text>
      </Pressable>
      {open ? <View style={styles.cardBody}>{children}</View> : null}
    </View>
  );
}

function NavRow({ title, subtitle, onPress, destructive }: { title: string; subtitle?: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.rowBetween} android_ripple={{ color: '#e5e7eb' }}>
      <View>
        <Text style={[styles.rowTitle, destructive ? styles.destructive : null]}>{title}</Text>
        {subtitle ? <Text style={styles.mutedSmall}>{subtitle}</Text> : null}
      </View>
      <Text style={styles.chev}>›</Text>
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
  return (
    <View style={styles.rowBetween}>
      <View>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.mutedSmall}>{subtitle}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Preferences>({
    notifications: { game_event_reminders: false, team_updates: false, comments_upvotes: false },
    is_parent: false,
    zip_code: null,
  });

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
        setPrefs((p) => ({
          notifications: {
            game_event_reminders: !!serverPrefs?.notifications?.game_event_reminders,
            team_updates: !!serverPrefs?.notifications?.team_updates,
            comments_upvotes: !!serverPrefs?.notifications?.comments_upvotes,
          },
          is_parent: !!serverPrefs?.is_parent,
          zip_code: serverPrefs?.zip_code ?? null,
        }));
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load settings');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; Object.values(timers.current).forEach(clearTimeout); };
  }, []);

  const patchPrefs = (patch: Partial<Preferences>) => {
    // Optimistic UI: merge local state first
    setPrefs((prev) => ({ ...prev, ...patch, notifications: { ...prev.notifications, ...(patch as any).notifications } }));
    // Debounce by key group to reduce network chatter
    const key = Object.keys(patch).sort().join(',') || 'misc';
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(async () => {
      try {
        await User.updatePreferences(patch);
      } catch (e: any) {
        // Revert on error by refetching
        try {
          const me: any = await User.me();
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
        } catch {}
        Alert.alert('Update failed', 'Could not save your preference. Please try again.');
      }
    }, 150);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Settings' }} />
      <Text style={styles.title}>Settings</Text>
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
          <NavRow title="View Favorites" subtitle="Posts you’ve saved" onPress={() => router.push('/settings/favorites')} />
        </SectionCard>

        {/* Legal */}
        <SectionCard title="Legal">
          <NavRow title="View Core Values" onPress={() => router.push('/settings/core-values')} />
          <NavRow title="Report Abuse" onPress={() => router.push('/report-abuse')} />
          <NavRow title="DM Restrictions Summary" onPress={() => router.push('/dm-restrictions')} />
        </SectionCard>

        {/* Support & Feedback */}
        <SectionCard title="Support & Feedback">
          <NavRow title="Contact Varsity Hub Team" onPress={() => router.push('/settings/contact')} />
          <NavRow title="App Walkthrough / Help Guide" onPress={() => router.push('/help')} />
          <NavRow title="Leave Feedback" onPress={() => router.push('/settings/feedback')} />
        </SectionCard>

        {/* Session */}
        <SectionCard title="Session">
          <NavRow title="Log Out" destructive onPress={() => {
            Alert.alert('Log out', 'Are you sure you want to log out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log Out', style: 'destructive', onPress: async () => { try { await User.logout(); } catch {} router.replace('/sign-in'); } },
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
              { text: 'Restart', onPress: async () => {
                try { await User.updatePreferences({ onboarding_completed: false }); } catch {}
                router.replace('/onboarding');
              } }
            ]);
          }} />
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
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
});

