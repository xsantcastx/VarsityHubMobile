import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
// @ts-ignore
import { User } from '@/api/entities';

export default function CreateScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [me, setMe] = useState<any>(null);
  const verified = !!me?.email_verified;
  useEffect(() => { (async () => { try { const u = await User.me(); setMe(u); } catch {} })(); }, []);
  const go = (path: string) => {
    if (!verified) return router.push('/verify-email');
    router.push(path as any);
  };

  const safeBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(tabs)' as any);
    }
  };

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
        <Pressable style={[styles.item, { borderColor: Colors[colorScheme].border }]} onPress={() => go('/create-team')}>
          <Text style={[styles.itemText, { color: Colors[colorScheme].text }]}>Create Team</Text>
        </Pressable>
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

