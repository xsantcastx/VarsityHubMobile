import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

type CurrentUser = {
  id?: string | number;
  username?: string;
  email?: string;
  full_name?: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  [key: string]: any;
};

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const u: any = await User.me();
        if (!mounted) return;
        setMe(u ?? null);
      } catch (e: any) {
        if (!mounted) return;
        console.error('Failed to load profile', e);
        setError('Unable to load profile. You may need to sign in.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const name = me?.display_name || me?.full_name || me?.username || 'User';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Profile' }} />
      {loading && (
        <View style={styles.center}><ActivityIndicator /></View>
      )}
      {error && !loading && (
        <>
          <Text style={styles.error}>{error}</Text>
          <View style={{ height: 8 }} />
          <Button onPress={() => router.push('/sign-in')}>Sign In</Button>
        </>
      )}
      {me && !loading && (
        <View style={{ gap: 16 }}>
          <View style={styles.headerRow}>
            <Avatar uri={me.avatar_url} size={72} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{name}</Text>
              {me.email ? <Text style={styles.muted}>{me.email}</Text> : null}
            </View>
          </View>
          {me.bio ? <Text>{me.bio}</Text> : null}

          <Button onPress={() => router.push('/edit-profile')}>Edit Profile</Button>
          <Button variant="outline" onPress={() => { try { User.logout(); } catch {} router.replace('/sign-in'); }}>Sign Out</Button>

          {/* Debug: basic fields we commonly expect; helps during migration */}
          <View style={styles.section}>
            {me.username ? <Text style={styles.row}><Text style={styles.label}>Username: </Text>{me.username}</Text> : null}
            {me.full_name ? <Text style={styles.row}><Text style={styles.label}>Full name: </Text>{me.full_name}</Text> : null}
            {me.id != null ? <Text style={styles.row}><Text style={styles.label}>ID: </Text>{String(me.id)}</Text> : null}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  center: { paddingVertical: 24, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800' },
  muted: { color: '#6b7280' },
  label: { fontWeight: '700' },
  row: { marginBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  section: { padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  error: { color: '#b91c1c' },
});
