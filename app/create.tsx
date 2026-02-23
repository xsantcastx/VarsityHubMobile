import { useAuth } from '@/context/AuthProvider';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export default function CreateScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { user: me, loading: authLoading, healthError, checkAuth } = useAuth();
  const verified = !!me?.email_verified;
  const go = (path: string) => {
    if (!verified) return router.push('/verify-identity?method=email');
    router.push(path as any);
  };

  const safeBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(tabs)' as any);
    }
  };

  if (authLoading) {
    return (
      <View style={[styles.overlay, { backgroundColor: Colors[colorScheme].background }]}>
        <Stack.Screen options={{ presentation: 'modal', title: 'Create' }} />
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
          <Text style={[styles.stateText, { color: Colors[colorScheme].mutedText }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (healthError) {
    return (
      <View style={[styles.overlay, { backgroundColor: Colors[colorScheme].background }]}>
        <Stack.Screen options={{ presentation: 'modal', title: 'Create' }} />
        <View style={styles.stateContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
          <Text style={[styles.errorText, { color: Colors[colorScheme].text }]}>{healthError}</Text>
          <Pressable
            style={[styles.retryButton, { backgroundColor: Colors[colorScheme].tint }]}
            onPress={() => void checkAuth()}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
          <Pressable
            style={[styles.cancelButton, { borderColor: Colors[colorScheme].border }]}
            onPress={safeBack}
          >
            <Text style={[styles.cancelButtonText, { color: Colors[colorScheme].text }]}>Cancel</Text>
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
        <Pressable style={[styles.item, { borderColor: Colors[colorScheme].border }]} onPress={() => go('/create-post')}>
          <Text style={[styles.itemText, { color: Colors[colorScheme].text }]}>Create Post</Text>
        </Pressable>
        <Pressable style={[styles.item, { borderColor: Colors[colorScheme].border }]} onPress={() => go('/create-post?type=highlight')}>
          <Text style={[styles.itemText, { color: Colors[colorScheme].text }]}>Share Highlight</Text>
        </Pressable>
        {/* Team creation - COACH ONLY */}
        {me?.preferences?.role === 'coach' && (
          <Pressable style={[styles.item, { borderColor: Colors[colorScheme].border }]} onPress={() => go('/create-team')}>
            <Text style={[styles.itemText, { color: Colors[colorScheme].text }]}>Create Team</Text>
          </Pressable>
        )}
        {/* Event creation - COACH ONLY (API also enforces) */}
        {me?.preferences?.role === 'coach' && (
          <Pressable style={[styles.item, { borderColor: Colors[colorScheme].border }]} onPress={() => go('/create-fan-event')}>
            <Text style={[styles.itemText, { color: Colors[colorScheme].text }]}>Create Event</Text>
          </Pressable>
        )}
        <Pressable style={[styles.item, { borderColor: Colors[colorScheme].border }]} onPress={() => go('/submit-ad')}>
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
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  stateText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
    fontSize: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cancelButtonText: {
    fontSize: 16,
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
