import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
// @ts-ignore
import { User } from '@/api/entities';

export default function CreateScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const verified = !!me?.email_verified;
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const u = await User.me();
        if (mounted) setMe(u);
      } catch (e: any) {
        if (mounted) setError('Unable to load your account.');
        if (__DEV__) {
          if (__DEV__) console.warn('[CreateScreen] Failed to load user:', e?.message || e);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);
  const go = (path: string) => {
    if (!verified) return router.push('/verify-identity?method=email');
    router.push(path as any);
  };

  const safeBack = () => {
    if (router.canGoBack()) {
      if (router.canGoBack()) router.back();
    } else {
      router.push('/(tabs)' as any);
    }
  };

  if (loading) {
    return (
      <View style={styles.overlay}>
        <Stack.Screen options={{ presentation: 'modal', title: 'Create' }} />
        <View style={[styles.sheet, { backgroundColor: Colors[colorScheme].background, alignItems: 'center', paddingVertical: 40 }]}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.overlay}>
        <Stack.Screen options={{ presentation: 'modal', title: 'Create' }} />
        <View style={[styles.sheet, { backgroundColor: Colors[colorScheme].background, alignItems: 'center', paddingVertical: 32 }]}>
          <MaterialIcons name="error-outline" size={40} color={Colors[colorScheme].mutedText} />
          <Text style={{ color: Colors[colorScheme].mutedText, marginTop: 8, fontSize: 15 }}>{error}</Text>
          <Pressable style={[styles.item, { borderColor: Colors[colorScheme].border, marginTop: 16, width: '100%' }]} onPress={safeBack}>
            <Text style={[styles.itemText, { color: Colors[colorScheme].text }]}>Close</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlay}>
      <Stack.Screen options={{ presentation: 'modal', title: 'Create' }} />
      <View style={[styles.sheet, { backgroundColor: Colors[colorScheme].background }]}>
        <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Create</Text>
        {!verified ? (
          <Text style={{ 
            color: colorScheme === 'dark' ? '#fef08a' : '#92400E', 
            backgroundColor: colorScheme === 'dark' ? 'rgba(254,240,138,0.1)' : '#FEF9C3', 
            borderWidth: StyleSheet.hairlineWidth, 
            borderColor: colorScheme === 'dark' ? 'rgba(254,240,138,0.3)' : '#FDE68A', 
            padding: 8, 
            borderRadius: 8, 
            marginBottom: 4 
          }}>Verify your email to enable actions below.</Text>
        ) : null}
        <Pressable style={[styles.item, { borderColor: Colors[colorScheme].border }]} onPress={() => go('/(tabs)/create-post')}>
          <Text style={[styles.itemText, { color: Colors[colorScheme].text }]}>Create Post</Text>
        </Pressable>
        <Pressable style={[styles.item, { borderColor: Colors[colorScheme].border }]} onPress={() => go('/(tabs)/create-post?type=highlight')}>
          <Text style={[styles.itemText, { color: Colors[colorScheme].text }]}>Share Highlight</Text>
        </Pressable>
        {/* Team creation - COACH ONLY */}
        {me?.preferences?.role === 'coach' && (
          <Pressable style={[styles.item, { borderColor: Colors[colorScheme].border }]} onPress={() => go('/(tabs)/create-team')}>
            <Text style={[styles.itemText, { color: Colors[colorScheme].text }]}>Create Team</Text>
          </Pressable>
        )}
        {/* Event creation - ALL USERS (fans pitch, coaches auto-approve) */}
        <Pressable style={[styles.item, { borderColor: Colors[colorScheme].border }]} onPress={() => go('/(tabs)/create-fan-event')}>
          <Text style={[styles.itemText, { color: Colors[colorScheme].text }]}>
            {me?.preferences?.role === 'coach' ? 'Create Event' : 'Pitch Event'}
          </Text>
        </Pressable>
        <Pressable style={[styles.item, { borderColor: Colors[colorScheme].border }]} onPress={() => go('/(tabs)/submit-ad')}>
          <Text style={[styles.itemText, { color: Colors[colorScheme].text }]}>Submit Ad</Text>
        </Pressable>
        <Pressable style={[styles.item, { borderColor: Colors[colorScheme].border }]} onPress={() => go('/(tabs)/my-ads')}>
          <Text style={[styles.itemText, { color: Colors[colorScheme].text }]}>My Ads</Text>
        </Pressable>
        <Pressable style={[styles.item, styles.cancel, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]} onPress={safeBack}>
          <Text style={[styles.itemText, { color: Colors[colorScheme].text }]}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    gap: 8,
  },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  item: {
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancel: {},
  itemText: { fontWeight: '700' },
});
