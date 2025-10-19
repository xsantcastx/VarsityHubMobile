import { Post } from '@/api/entities';
import CollageView, { type CollageData, type CollageFrame } from '@/components/CollageView';
import { Button } from '@/components/ui/button';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

const templates = {
  '2up': [
    { id: 'a', x:0, y:0, w:0.5, h:1 },
    { id: 'b', x:0.5, y:0, w:0.5, h:1 },
  ],
  '3triptych': [
    { id: 'a', x:0, y:0, w:1/3, h:1 },
    { id: 'b', x:1/3, y:0, w:1/3, h:1 },
    { id: 'c', x:2/3, y:0, w:1/3, h:1 },
  ],
  '4grid': [
    { id: 'a', x:0, y:0, w:0.5, h:0.5 },
    { id: 'b', x:0.5, y:0, w:0.5, h:0.5 },
    { id: 'c', x:0, y:0.5, w:0.5, h:0.5 },
    { id: 'd', x:0.5, y:0.5, w:0.5, h:0.5 },
  ],
  'asym3': [
    { id: 'a', x:0, y:0, w:0.6, h:1 },
    { id: 'b', x:0.6, y:0, w:0.4, h:0.5 },
    { id: 'c', x:0.6, y:0.5, w:0.4, h:0.5 },
  ],
  'asym4': [
    { id: 'a', x:0, y:0, w:1, h:0.5 },
    { id: 'b', x:0, y:0.5, w:1/3, h:0.5 },
    { id: 'c', x:1/3, y:0.5, w:1/3, h:0.5 },
    { id: 'd', x:2/3, y:0.5, w:1/3, h:0.5 },
  ],
  'organic2': [
    { id: 'a', x: 0, y: 0, w: 0.68, h: 0.75 },
    { id: 'b', x: 0.72, y: 0.1, w: 0.28, h: 0.6 }
  ],
  'organic3': [
    { id: 'a', x: 0, y: 0, w: 0.55, h: 0.65 },
    { id: 'b', x: 0.6, y: 0, w: 0.4, h: 0.4 },
    { id: 'c', x: 0.6, y: 0.45, w: 0.4, h: 0.55 }
  ],
  'organic4': [
    { id: 'a', x: 0, y: 0, w: 0.48, h: 0.6 },
    { id: 'b', x: 0.52, y: 0, w: 0.48, h: 0.35 },
    { id: 'c', x: 0, y: 0.65, w: 0.48, h: 0.35 },
    { id: 'd', x: 0.52, y: 0.4, w: 0.48, h: 0.6 }
  ],
} as const;

export default function CreateCollageScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const [template, setTemplate] = useState<keyof typeof templates>('organic2');
  const [gutter, setGutter] = useState(8);
  const [radius, setRadius] = useState(8);
  const [bg, setBg] = useState(colorScheme === 'dark' ? '#1F2937' : '#FFFFFF');
  const [frames, setFrames] = useState<CollageFrame[]>(templates['organic2'].map(f => ({
    ...f, media: { url: '', type: 'image', scale: 1, translateX: 0, translateY: 0, rotation: 0 }
  })));
  const ref = useRef<View|null>(null);

  const collage: CollageData = useMemo(() => ({
    bg_color: bg, gutter, radius, template,
    frames,
  }), [bg, gutter, radius, template, frames]);

  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, selectionLimit: frames.length, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (res.canceled) return;
    const assets = res.assets ?? [];
    setFrames((prev) => prev.map((f, i) => ({
      ...f,
      media: { ...f.media, url: assets[i]?.uri ?? f.media.url }
    })));
  };

  const onTemplateChange = (t: keyof typeof templates) => {
    setTemplate(t);
    const base = templates[t];
    setFrames(base.map((f, i) => ({
      ...f,
      media: { url: frames[i]?.media?.url ?? '', type: 'image', scale: 1, translateX: 0, translateY: 0, rotation: 0 }
    })));
  };

  const onPublish = async () => {
    try {
      if (!frames.some(f => f.media.url)) {
        Alert.alert('Add media', 'Please add at least one image.');
        return;
      }
      const previewUri = await captureRef(ref, { format: 'jpg', quality: 0.92 } as any);
      // TODO: Upload previewUri to your image endpoint if needed
      // For now, create collage with local file (server should handle upload separately if needed)
      await Post.createCollage({ caption: '', preview_url: String(previewUri), collage });
      Alert.alert('Published', 'Your collage has been posted.');
      router.back();
    } catch (e: any) {
      Alert.alert('Publish failed', e?.message || 'Try again later.');
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Text style={[styles.h1, { color: Colors[colorScheme].text }]}>Create Collage</Text>
      <Text style={[styles.subtitle, { color: Colors[colorScheme].mutedText }]}>Choose from organic layouts for a more natural look</Text>
      <Text style={[styles.sectionLabel, { color: Colors[colorScheme].text }]}>Organic Templates</Text>
      <View style={styles.row}>
        {(['organic2','organic3','organic4'] as const).map((t) => (
          <Pressable key={t} onPress={() => onTemplateChange(t)} style={[styles.templatePill, { backgroundColor: Colors[colorScheme].surface }, template===t && { backgroundColor: Colors[colorScheme].tint }]}>
            <Text style={[styles.templateText, { color: Colors[colorScheme].text }, template===t && styles.templateTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>
      
      <Text style={[styles.sectionLabel, { color: Colors[colorScheme].text }]}>Classic Templates</Text>
      <View style={styles.row}>
        {(['2up','3triptych','4grid','asym3','asym4'] as const).map((t) => (
          <Pressable key={t} onPress={() => onTemplateChange(t)} style={[styles.templatePill, { backgroundColor: Colors[colorScheme].surface }, template===t && { backgroundColor: Colors[colorScheme].tint }]}>
            <Text style={[styles.templateText, { color: Colors[colorScheme].text }, template===t && styles.templateTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={pickImages} style={{ marginTop: 12 }}>
        <Text style={[styles.link, { color: Colors[colorScheme].tint }]}>Pick images</Text>
      </Pressable>

      <View ref={ref as any} style={{ width: '100%', aspectRatio: 1, marginTop: 12 }}>
        <CollageView collage={collage} style={{ width: '100%', height: '100%' }} />
      </View>

      <View style={{ height: 16 }} />

      <Button onPress={onPublish}><Text>Publish</Text></Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  h1: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 4, marginBottom: 16 },
  sectionLabel: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  templatePill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  templateText: { fontWeight: '600', fontSize: 13 },
  templateTextActive: { color: 'white' },
  link: { fontWeight: '600' },
});
