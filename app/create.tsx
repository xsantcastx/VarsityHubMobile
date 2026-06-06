import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useCreateTeamAccess } from '@/hooks/useCreateTeamAccess';
import { safeGoBack } from '@/utils/navigation';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

function CreateScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { user, loading: authLoading } = useAuth();
  const { canAccessCreateTeam, loading: createAccessLoading } = useCreateTeamAccess();
  const me = user ?? null;
  const loading = authLoading || createAccessLoading;
  const verified = !!me?.email_verified;
  const isAdmin = !!(me as any)?.is_admin;

  const go = (path: string) => {
    if (!verified) return router.replace('/verify-identity?method=email');
    router.replace(path as any);
  };

  const safeBack = () => safeGoBack(router);

  if (loading) {
    return (
      <View style={styles.overlay}>
        <Stack.Screen options={{ presentation: 'modal', title: 'Create' }} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: Colors[colorScheme].background,
              alignItems: 'center',
              paddingVertical: 40,
            },
          ]}
        >
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        </View>
      </View>
    );
  }

  // Guest (not logged in) — show Glaze-style Login Required prompt
  if (!me) {
    return (
      <View style={styles.overlay}>
        <Stack.Screen options={{ presentation: 'modal', title: 'Create' }} />
        <Pressable style={styles.overlayDismiss} onPress={safeBack} />
        <View style={[styles.sheet, styles.loginSheet, { backgroundColor: Colors[colorScheme].background }]}>
          <Text style={[styles.loginTitle, { color: Colors[colorScheme].text }]}>
            Login Required
          </Text>
          <Text style={[styles.loginBody, { color: Colors[colorScheme].mutedText }]}>
            Log in to create and publish your moments.
          </Text>
          <Pressable
            style={[styles.loginBtn, { backgroundColor: Colors[colorScheme].tint }]}
            onPress={() => router.replace('/sign-in')}
            accessibilityRole="button"
            accessibilityLabel="Log in"
          >
            <Text style={styles.loginBtnText}>Login</Text>
          </Pressable>
          <Pressable
            style={[styles.cancelBtn, { borderColor: Colors[colorScheme].border, backgroundColor: Colors[colorScheme].surface }]}
            onPress={safeBack}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={[styles.cancelBtnText, { color: Colors[colorScheme].text }]}>Cancel</Text>
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
          <Text
            style={{
              color: colorScheme === 'dark' ? '#fef08a' : '#92400E',
              backgroundColor: colorScheme === 'dark' ? 'rgba(254,240,138,0.1)' : '#FEF9C3',
              borderWidth: 1,
              borderColor: colorScheme === 'dark' ? 'rgba(254,240,138,0.3)' : '#FDE68A',
              padding: 8,
              borderRadius: 8,
              marginBottom: 4,
            }}
          >
            Verify your email to enable actions below.
          </Text>
        ) : null}
        <Pressable
          style={[styles.item, { borderColor: Colors[colorScheme].border }]}
          onPress={() => go('/create-post')}
          accessibilityRole="button"
          accessibilityLabel="Create Post"
          accessibilityHint="Double tap to create a new post"
        >
          <Text style={[styles.itemText, { color: Colors[colorScheme].text }]}>Create Post</Text>
        </Pressable>
        {canAccessCreateTeam && (
          <Pressable
            style={[styles.item, { borderColor: Colors[colorScheme].border }]}
            onPress={() => go('/create-team')}
            accessibilityRole="button"
            accessibilityLabel="Create Team"
            accessibilityHint="Double tap to create a new team"
          >
            <Text style={[styles.itemText, { color: Colors[colorScheme].text }]}>Create Team</Text>
          </Pressable>
        )}
        {isAdmin && (
          <Pressable
            style={[
              styles.item,
              {
                borderColor: '#F59E0B',
                backgroundColor: colorScheme === 'dark' ? '#78350F20' : '#FEF9C3',
              },
            ]}
            onPress={() => go('/admin-create-event')}
            accessibilityRole="button"
            accessibilityLabel="Broadcast Event"
            accessibilityHint="Double tap to create a broadcast event visible to all users"
          >
            <Text
              style={[styles.itemText, { color: colorScheme === 'dark' ? '#FDE68A' : '#92400E' }]}
            >
              Broadcast Event (Admin)
            </Text>
          </Pressable>
        )}
        <Pressable
          style={[
            styles.item,
            styles.cancel,
            {
              backgroundColor: Colors[colorScheme].surface,
              borderColor: Colors[colorScheme].border,
            },
          ]}
          onPress={safeBack}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          accessibilityHint="Double tap to close Create menu"
        >
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
  overlayDismiss: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    gap: 8,
  },
  loginSheet: {
    paddingVertical: 24,
    gap: 12,
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
  loginTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  loginBody: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  loginBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  loginBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  cancelBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelBtnText: {
    fontWeight: '700',
    fontSize: 16,
  },
});

export default CreateScreen;
