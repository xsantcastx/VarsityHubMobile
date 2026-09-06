import { Colors } from '@/constants/Colors';
import { EVENT_BANNER_OUTPUT_WIDTH } from '@/constants/eventPresentation';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  clampImageCrop,
  imageCropRect,
  type CropSize,
  type CropTransform,
} from '@/utils/imageCrop';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  imageUri: string | null;
  aspectRatio: number;
  onSave: (uri: string) => void | Promise<void>;
  onClose: () => void;
};
const centered: CropTransform = { zoom: 1, x: 0, y: 0 };

export default function ImageCropEditor({
  visible,
  imageUri,
  aspectRatio,
  onSave,
  onClose,
}: Props) {
  const palette = Colors[useColorScheme() ?? 'light'];
  const [source, setSource] = useState<CropSize | null>(null);
  const [width, setWidth] = useState(320);
  const [transform, setTransform] = useState(centered);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const frame = { width, height: width / aspectRatio };
  const current = useRef({ source, frame, transform, saving });
  current.current = { source, frame, transform, saving };
  const gestureStart = useRef({ ...centered, distance: 0, dx: 0, dy: 0, touches: 0 });
  useEffect(() => {
    let active = true;
    setSource(null);
    setTransform(centered);
    setLoadError(false);
    if (visible && imageUri)
      Image.getSize(
        imageUri,
        (w, h) => {
          if (active) setSource({ width: w, height: h });
        },
        () => {
          if (active) setLoadError(true);
        }
      );
    return () => {
      active = false;
    };
  }, [visible, imageUri]);
  const apply = (value: CropTransform) => {
    const state = current.current;
    if (state.source && !state.saving)
      setTransform(clampImageCrop(state.source, state.frame, value));
  };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !current.current.saving,
      onMoveShouldSetPanResponder: () => !current.current.saving,
      onPanResponderGrant: () => {
        gestureStart.current = {
          ...current.current.transform,
          distance: 0,
          dx: 0,
          dy: 0,
          touches: 0,
        };
      },
      onPanResponderMove: (event, gesture) => {
        const touches = event.nativeEvent.touches;
        const distance =
          touches.length > 1
            ? Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY)
            : 0;
        if (gestureStart.current.touches !== touches.length) {
          gestureStart.current = {
            ...current.current.transform,
            distance,
            dx: gesture.dx,
            dy: gesture.dy,
            touches: touches.length,
          };
        }
        const start = gestureStart.current;
        apply({
          zoom:
            start.distance > 0 && distance > 0
              ? (start.zoom * distance) / start.distance
              : start.zoom,
          x: start.x + gesture.dx - start.dx,
          y: start.y + gesture.dy - start.dy,
        });
      },
    })
  ).current;
  const save = async () => {
    if (!imageUri || !source || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const crop = imageCropRect(source, frame, transform);
      const result = await manipulateAsync(
        imageUri,
        [{ crop }, { resize: { width: Math.min(EVENT_BANNER_OUTPUT_WIDTH, crop.width) } }],
        { compress: 0.9, format: SaveFormat.JPEG }
      );
      await onSave(result.uri);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Unable to save image. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };
  if (!visible) return null;
  const rendered = source ? clampImageCrop(source, frame, transform) : null;
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (!saving) onClose();
      }}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} disabled={saving}>
            <Text style={{ color: palette.tint }}>Cancel</Text>
          </Pressable>
          <Text style={[styles.title, { color: palette.text }]}>Fit Event Banner</Text>
          <Pressable
            onPress={() => void save()}
            disabled={!source || saving}
            accessibilityLabel="Save banner crop"
          >
            {saving ? (
              <ActivityIndicator color={palette.tint} />
            ) : (
              <Text style={{ color: source ? palette.tint : palette.mutedText }}>Save</Text>
            )}
          </Pressable>
        </View>
        <Text style={[styles.help, { color: palette.mutedText }]}>
          Pinch to zoom and drag to position your photo.
        </Text>
        <View
          onLayout={event => setWidth(event.nativeEvent.layout.width)}
          style={[styles.frame, { aspectRatio, backgroundColor: palette.surface }]}
          {...responder.panHandlers}
        >
          {rendered && imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={{
                position: 'absolute',
                width: rendered.width,
                height: rendered.height,
                left: (frame.width - rendered.width) / 2 + rendered.x,
                top: (frame.height - rendered.height) / 2 + rendered.y,
              }}
              resizeMode="stretch"
            />
          ) : loadError ? (
            <Text style={{ color: palette.text }}>
              Image could not load. Close and choose another photo.
            </Text>
          ) : (
            <ActivityIndicator color={palette.tint} />
          )}
        </View>
        {saveError ? (
          <Text accessibilityRole="alert" style={{ color: palette.destructive, marginTop: 16 }}>
            {saveError}
          </Text>
        ) : null}
        <View style={styles.controls}>
          {[
            { label: 'Zoom out', zoom: transform.zoom - 0.25 },
            { label: 'Reset', zoom: 1 },
            { label: 'Zoom in', zoom: transform.zoom + 0.25 },
          ].map(control => (
            <Pressable
              key={control.label}
              accessibilityRole="button"
              disabled={!source || saving}
              onPress={() =>
                apply(control.label === 'Reset' ? centered : { ...transform, zoom: control.zoom })
              }
              style={[styles.button, { borderColor: palette.border }]}
            >
              <Text style={{ color: palette.text }}>{control.label}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  title: { fontSize: 17, fontWeight: '700' },
  help: { marginVertical: 20, textAlign: 'center' },
  frame: { width: '100%', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 24 },
  button: { padding: 12, borderWidth: 1, borderRadius: 8 },
});
