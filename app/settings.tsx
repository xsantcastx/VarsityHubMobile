import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Switch from '@/components/ui/switch';
import settingsStore, { SETTINGS_KEYS } from '@/api/settings';

type Me = { email?: string; display_name?: string; bio?: string };

export default function SettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  // Profile fields (persist to /auth/me)
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');

  // Local-only settings for now
  const [privateAccount, setPrivateAccount] = useState(false);
  const [dmPolicy, setDmPolicy] = useState<'everyone' | 'following' | 'no_one'>('everyone');
  const [notifyMsg, setNotifyMsg] = useState(true);
  const [notifyFollow, setNotifyFollow] = useState(true);
  const [blockedCount, setBlockedCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const u: any = await User.me();
        if (!mounted) return;
        setMe(u);
        setDisplayName(u?.display_name || '');
        setBio(u?.bio || '');

        // Local settings
        const [priv, dm, nm, nf, bl] = await Promise.all([
          settingsStore.getBool(SETTINGS_KEYS.PRIVATE_ACCOUNT, false),
          settingsStore.getString(SETTINGS_KEYS.DM_POLICY, 'everyone'),
          settingsStore.getBool(SETTINGS_KEYS.NOTIFY_MSG, true),
          settingsStore.getBool(SETTINGS_KEYS.NOTIFY_FOLLOW, true),
          settingsStore.getJson<string[]>(SETTINGS_KEYS.BLOCKED_USERS, []),
        ]);
        if (!mounted) return;
        setPrivateAccount(!!priv);
        setDmPolicy((dm as any) === 'following' || dm === 'no_one' ? (dm as any) : 'everyone');
        setNotifyMsg(!!nm);
        setNotifyFollow(!!nf);
        setBlockedCount(Array.isArray(bl) ? bl.length : 0);
      } catch (e: any) {
        if (!mounted) return;
        setError('You may need to sign in to view settings.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const dmLabel = useMemo(() => {
    switch (dmPolicy) {
      case 'following': return 'People you follow';
      case 'no_one': return 'No one';
      default: return 'Everyone';
    }
  }, [dmPolicy]);

  const onSave = async () => {
    setSaving(true);
    try {
      await User.updateMe({ display_name: displayName || undefined, bio: bio || undefined });
      // Persist local settings
      await Promise.all([
        settingsStore.setBool(SETTINGS_KEYS.PRIVATE_ACCOUNT, privateAccount),
        settingsStore.setString(SETTINGS_KEYS.DM_POLICY, dmPolicy),
        settingsStore.setBool(SETTINGS_KEYS.NOTIFY_MSG, notifyMsg),
        settingsStore.setBool(SETTINGS_KEYS.NOTIFY_FOLLOW, notifyFollow),
      ]);
    } catch (e: any) {
      setError(e?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Settings' }} />
      <Text style={styles.title}>Settings</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <View style={{ paddingVertical: 24 }}><ActivityIndicator /></View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {/* Account */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account</Text>
            <View style={styles.rowBetween}><Text style={styles.muted}>Email</Text><Text style={styles.value}>{me?.email || '—'}</Text></View>
            <View style={styles.rowBetween}>
              <Text style={styles.muted}>Verification</Text>
              {(me as any)?.email_verified ? (
                <Text style={[styles.value, { color: '#16A34A' }]}>Verified</Text>
              ) : (
                <Pressable onPress={() => router.push('/verify-email')}>
                  <Text style={{ color: '#92400E', backgroundColor: '#FEF9C3', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: '#FDE68A' }}>Verify Email</Text>
                </Pressable>
              )}
            </View>
            <Text style={styles.label}>Display Name</Text>
            <Input value={displayName} onChangeText={setDisplayName} placeholder="Your name" style={{ marginBottom: 8 }} />
            <Text style={styles.label}>Bio</Text>
            <Input value={bio} onChangeText={setBio} placeholder="About you" style={{ marginBottom: 8 }} />
            <Button variant="outline" onPress={() => router.push('/edit-profile')}>Open Edit Profile</Button>
          </View>

          {/* Privacy */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Privacy</Text>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.rowTitle}>Private Account</Text>
                <Text style={styles.mutedSmall}>Only approved followers can see your content</Text>
              </View>
              <Switch value={privateAccount} onValueChange={setPrivateAccount} />
            </View>
            <Pressable style={styles.linkRow} onPress={() => router.push('/dm-restrictions')}>
              <Text style={styles.rowTitle}>DM Restrictions</Text>
              <Text style={styles.linkValue}>{dmLabel}</Text>
            </Pressable>
            <Pressable style={styles.linkRow} onPress={() => router.push('/blocked-users')}>
              <Text style={styles.rowTitle}>Blocked Users</Text>
              <Text style={styles.linkValue}>{blockedCount} blocked</Text>
            </Pressable>
            <Pressable style={styles.linkRow} onPress={() => router.push('/team-invites')}>
              <Text style={styles.rowTitle}>Team Invites</Text>
              <Text style={styles.linkValue}>View</Text>
            </Pressable>
            <Pressable style={styles.linkRow} onPress={() => router.push('/rsvp-history')}>
              <Text style={styles.rowTitle}>RSVP History</Text>
              <Text style={styles.linkValue}>View</Text>
            </Pressable>
          </View>

          {/* Admin */}
          {(me as any)?.is_admin ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Admin</Text>
              <Pressable style={styles.linkRow} onPress={() => router.push('/admin-ads')}>
                <Text style={styles.rowTitle}>All Ads</Text>
                <Text style={styles.linkValue}>Open</Text>
              </Pressable>
              <Pressable style={styles.linkRow} onPress={() => router.push('/admin-messages')}>
                <Text style={styles.rowTitle}>All Messages</Text>
                <Text style={styles.linkValue}>Open</Text>
              </Pressable>
              <Pressable style={styles.linkRow} onPress={() => router.push('/admin-teams')}>
                <Text style={styles.rowTitle}>All Teams</Text>
                <Text style={styles.linkValue}>Open</Text>
              </Pressable>
              <Pressable style={styles.linkRow} onPress={() => router.push('/admin-users')}>
                <Text style={styles.rowTitle}>All Users</Text>
                <Text style={styles.linkValue}>Open</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Notifications */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notifications</Text>
            <View style={styles.rowBetween}>
              <Text style={styles.rowTitle}>New Messages</Text>
              <Switch value={notifyMsg} onValueChange={setNotifyMsg} />
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.rowTitle}>New Followers</Text>
              <Switch value={notifyFollow} onValueChange={setNotifyFollow} />
            </View>
          </View>

          <Button onPress={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</Button>
          <View style={{ height: 12 }} />
          <Button variant="outline" onPress={async () => { try { await User.logout(); } catch {} router.replace('/sign-in'); }}>
            Sign Out
          </Button>
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  label: { fontWeight: '700', marginBottom: 4 },
  error: { color: '#b91c1c', marginBottom: 8 },
  value: { fontWeight: '700' },
  muted: { color: '#6b7280' },
  mutedSmall: { color: '#9CA3AF', fontSize: 12 },
  card: { padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', marginBottom: 12, gap: 8 },
  cardTitle: { fontWeight: '800', fontSize: 16 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { fontWeight: '600' },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  linkValue: { color: '#6b7280' },
});
