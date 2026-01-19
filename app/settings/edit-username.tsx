import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, Text, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { User } from '@/api/entities';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/context/AuthProvider';

export default function EditUsernameScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, loading: userLoading, refresh: refreshUser } = useUser();
  const { checkAuth } = useAuth();
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.username) {
      setUsername(user.username);
    }
  }, [user?.username]);

  const onSave = async () => {
    const v = username.trim().toLowerCase(); // Usernames must be lowercase
    if (!v) { 
      Alert.alert('Enter a username'); 
      return; 
    }
    // Check if username hasn't changed
    if (user?.username && v === user.username.toLowerCase()) {
      Alert.alert('No changes', 'Username is the same as current');
      return;
    }
    // Validate username format (lowercase letters, numbers, dots, underscores only)
    if (!/^[a-z0-9_.]+$/.test(v)) {
      Alert.alert('Invalid username', 'Username can only contain lowercase letters, numbers, dots, and underscores');
      return;
    }
    if (v.length < 3) {
      Alert.alert('Username too short', 'Username must be at least 3 characters');
      return;
    }
    if (v.length > 20) {
      Alert.alert('Username too long', 'Username must be 20 characters or less');
      return;
    }
    setSaving(true);
    try { 
      console.log('[edit-username] Updating username to:', v);
      const result = await User.updateMe({ username: v });
      console.log('[edit-username] Update result:', result);
      // Refresh user data in both useUser hook and AuthProvider
      await Promise.all([
        refreshUser(),
        checkAuth().catch(() => {}), // Refresh AuthProvider state
      ]);
      console.log('[edit-username] User data refreshed in all contexts');
      Alert.alert('Success', 'Username updated successfully');
      router.back(); 
    } catch (e: any) { 
      console.error('[edit-username] Update failed:', e);
      console.error('[edit-username] Error details:', {
        message: e?.message,
        data: e?.data,
        response: e?.response,
        status: e?.status,
      });
      let errorMessage = 'Could not save username';
      if (e?.data?.message) {
        errorMessage = e.data.message;
      } else if (e?.data?.error) {
        errorMessage = e.data.error;
      } else if (e?.message) {
        errorMessage = e.message;
      } else if (e?.response?.data?.message) {
        errorMessage = e.response.data.message;
      } else if (e?.response?.data?.error) {
        errorMessage = e.response.data.error;
      }
      Alert.alert('Save failed', errorMessage); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]} edges={['bottom']}>
      <Stack.Screen 
        options={{ 
          title: 'Edit Username',
          headerBackTitle: 'Back',
          headerShown: true,
        }} 
      />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.label, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Username</Text>
        <Text style={[styles.hint, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
          This is your @ handle (e.g., @rwerwqer). Lowercase letters, numbers, dots, and underscores only.
        </Text>
        {userLoading ? (
          <Text style={[styles.hint, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>Loading...</Text>
        ) : (
          <Input 
            value={username} 
            onChangeText={(text) => setUsername(text.toLowerCase())} 
            placeholder={user?.username || "username"} 
            autoCapitalize="none"
            autoCorrect={false}
            style={{ marginBottom: 24 }} 
          />
        )}
        <Button onPress={onSave} disabled={saving || userLoading}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingTop: 24,
  },
  label: { 
    fontSize: 14, 
    fontWeight: '600', 
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    marginBottom: 8,
  },
});

