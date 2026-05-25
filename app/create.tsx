import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useCreateTeamAccess } from '@/hooks/useCreateTeamAccess';
import { getAuthSnapshot } from '@/utils/authState';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { safeGoBack } from '@/utils/navigation';

function CreateScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { user, checkAuth } = useAuth();
  const { canAccessCreateTeam } = useCreateTeamAccess();
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const verified = !!me?.email_verified;
  const isAdmin = !!(me as any)?.is_admin;
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const u = await getAuthSnapshot(checkAuth, user);
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
  }, [checkAuth, user]);
  const go = (path: string) => {
    if (!verified) return router.replace('/verify-identity?method=email');
    router.replace(path as any);
  };

  const safeBack = () => safeGoBack(router);

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
          <Pressable style={[styles.item, { borderColor: Colors[colorScheme].border, marginTop: 16, width: '100%' }]} onPress={safeBack} accessibilityRole="button" accessibilityLabel="Close" accessibilityHint="Double tap to close">
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
            borderWidth: 1, 
            borderColor: colorScheme === 'dark' ? 'rgba(254,240,138,0.3)' : '#FDE68A', 
            padding: 8, 
            borderRadius: 8, 
            marginBottom: 4 
          }}>Verify your email to enable actions below.</Text>
        ) : null}
        <Pressable style={[styles.item, { borderColor: Colors[colorScheme].border }]} onPress={() => go('/create-post')} accessibilityRole="button" accessibilityLabel="Create Post" accessibilityHint="Double tap to create a new post">
          <Text style={[styles.itemText, { color: Colors[colorScheme].text }]}>Create Post</Text>
        </Pressable>
        {canAccessCreateTeam && (
          <Pressable style={[styles.item, { borderColor: Colors[colorScheme].border }]} onPress={() => go('/create-team')} accessibilityRole="button" accessibilityLabel="Create Team" accessibilityHint="Double tap to create a new team">
            <Text style={[styles.itemText, { color: Colors[colorScheme].text }]}>Create Team</Text>
          </Pressable>
        )}
        {isAdmin && (
          <Pressable style={[styles.item, { borderColor: '#F59E0B', backgroundColor: colorScheme === 'dark' ? '#78350F20' : '#FEF9C3' }]} onPress={() => go('/admin-create-event')} accessibilityRole="button" accessibilityLabel="Broadcast Event" accessibilityHint="Double tap to create a broadcast event visible to all users">
            <Text style={[styles.itemText, { color: colorScheme === 'dark' ? '#FDE68A' : '#92400E' }]}>Broadcast Event (Admin)</Text>
          </Pressable>
        )}
        <Pressable style={[styles.item, styles.cancel, { backgroundColor: Colors[colorScheme].surface, borderColor: Colors[colorScheme].border }]} onPress={safeBack} accessibilityRole="button" accessibilityLabel="Cancel" accessibilityHint="Double tap to close Create menu">
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
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancel: {},
  itemText: { fontWeight: '700' },
});

export default CreateScreen;
