import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore JS exports
import { User } from '@/api/entities';

export default function EditUsernameScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { 
    void (async () => { 
      try { 
        const me: any = await User.me(); 
        setName(me?.display_name || ''); 
      } catch {} 
    })(); 
  }, []);

  const onSave = async () => {
    const v = name.trim();
    if (!v) { 
      Alert.alert('Enter a username'); 
      return; 
    }
    setSaving(true);
    try { 
      await User.updateMe({ display_name: v }); 
      Alert.alert('Success', 'Username updated successfully');
      router.back(); 
    } catch (e: any) { 
      Alert.alert('Save failed', e?.message || 'Could not save'); 
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
        }} 
      />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.label, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Username</Text>
        <Input 
          value={name} 
          onChangeText={setName} 
          placeholder="Your display name" 
          style={{ marginBottom: 24 }} 
        />
        <Button onPress={onSave} disabled={saving}>
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
});

